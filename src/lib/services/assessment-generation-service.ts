import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from '../../../packages/types/db';
import OpenAI from 'openai';
import { encode } from 'gpt-tokenizer';
import pLimit from 'p-limit';
import { AIGradingService } from './ai-grading-service';

// Types for the new 4-table assessment schema
interface Assessment {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  assessment_type: 'lesson' | 'path' | 'class';
  base_class_id: string;
  lesson_id?: string;
  path_id?: string;
  time_limit_minutes?: number;
  max_attempts?: number;
  passing_score_percentage?: number;
  randomize_questions?: boolean;
  show_results_immediately?: boolean;
  allow_review?: boolean;
  ai_grading_enabled?: boolean;
  ai_model?: string;
  created_by?: string;
}

interface AssessmentQuestion {
  id?: string;
  assessment_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching';
  points?: number;
  order_index: number;
  required?: boolean;
  answer_key: any; // JSONB - structure varies by question type
  sample_response?: string; // For AI grading
  grading_rubric?: any; // JSONB
  ai_grading_enabled?: boolean;
}

interface AssessmentGenerationParams {
  scope: 'lesson' | 'path' | 'class';
  scopeId: string;
  baseClassId: string;
  questionCount: number;
  assessmentTitle: string;
  assessmentDescription?: string;
  questionTypes?: ('multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching')[];
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimit?: number;
  passingScore?: number;
  onProgress?: (message: string) => void;
}

interface GeneratedQuestion {
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching';
  options?: any; // JSONB - for questions that need options (multiple choice, matching, etc.)
  correct_answer?: any; // JSONB - the correct answer(s)
  answer_key: any; // JSONB - enhanced answer key with explanations and grading criteria
  sample_response?: string;
  grading_rubric?: any;
  points: number;
  explanation?: string;
}

interface ContentAnalysis {
  key_concepts: string[];
  learning_objectives: string[];
  cognitive_levels: string[];
  difficulty_indicators: string[];
  question_opportunities: {
    concept: string;
    question_types: string[];
    cognitive_level: string;
    difficulty: string;
  }[];
  content_structure: {
    main_topics: string[];
    supporting_details: string[];
    examples_provided: string[];
    definitions: Record<string, string>;
  };
}

const limit = pLimit(3); // Limit concurrent API calls

export class AssessmentGenerationService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 3,
    });
  }

  async generateAssessment(params: AssessmentGenerationParams): Promise<Assessment> {
    const { onProgress } = params;
    const supabase = createSupabaseServerClient();
    
    onProgress?.(`Starting assessment generation for ${params.scope}: ${params.scopeId}`);

    try {
      // 1. Get content for the specified scope
      const content = await this.getContentForScope(params.scope, params.scopeId);
      if (!content || content.trim().length === 0) {
        throw new Error(`Could not retrieve content for ${params.scope} ${params.scopeId}`);
      }
      onProgress?.(`Retrieved content for assessment (${content.length} characters)`);

      // 2. Generate questions using GPT-4.1-mini
      const questions = await this.generateQuestionsFromContent(
        content,
        params.questionCount,
        params.questionTypes || ['multiple_choice', 'true_false', 'short_answer'],
        params.difficulty || 'medium',
        onProgress
      );

      if (questions.length === 0) {
        throw new Error('Failed to generate any questions from content');
      }
      onProgress?.(`Generated ${questions.length} questions`);

      // 3. Create assessment in database
      const assessment = await this.createAssessmentInDatabase(params, questions);
      onProgress?.(`Successfully created assessment: ${assessment.id}`);

      return assessment;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.(`Error: ${errorMessage}`);
      throw error;
    }
  }

  private async getContentForScope(scope: 'lesson' | 'path' | 'class', scopeId: string): Promise<string> {
    const supabase = createSupabaseServerClient();
    let content = '';

    try {
      switch (scope) {
        case 'lesson':
          // Get all lesson sections content
          const { data: sections, error: sectionsError } = await supabase
            .from('lesson_sections')
            .select('title, content, section_type')
            .eq('lesson_id', scopeId)
            .order('order_index') as any; // Complex query with joins, using any cast

          if (sectionsError) throw sectionsError;
          
          content = sections?.map((section: any) => 
            `${section.title}\n${section.content}`
          ).join('\n\n') || '';
          break;

        case 'path':
          // Get all lessons in the path, then their sections
          const { data: pathLessons, error: pathError } = await supabase
            .from('lessons')
            .select(`
              title, description,
              lesson_sections(title, content, section_type)
            `)
            .eq('path_id', scopeId)
            .order('order_index') as any; // Complex query with joins, using any cast

          if (pathError) throw pathError;

          content = pathLessons?.map((lesson: any) => {
            const sectionContent = lesson.lesson_sections?.map((section: any) => 
              `${section.title}\n${section.content}`
            ).join('\n\n') || '';
            return `Lesson: ${lesson.title}\n${lesson.description}\n\n${sectionContent}`;
          }).join('\n\n---\n\n') || '';
          break;

        case 'class':
          // Get all content from the base class
          const { data: classPaths, error: classError } = await supabase
            .from('paths')
            .select(`
              title, description,
              lessons(
                title, description,
                lesson_sections(title, content, section_type)
              )
            `)
            .eq('base_class_id', scopeId)
            .order('order_index') as any; // Complex query with joins, using any cast

          if (classError) throw classError;

          content = classPaths?.map((path: any) => {
            const pathContent = path.lessons?.map((lesson: any) => {
              const sectionContent = lesson.lesson_sections?.map((section: any) => 
                `${section.title}\n${section.content}`
              ).join('\n\n') || '';
              return `Lesson: ${lesson.title}\n${lesson.description}\n\n${sectionContent}`;
            }).join('\n\n---\n\n') || '';
            return `Module: ${path.title}\n${path.description}\n\n${pathContent}`;
          }).join('\n\n=== MODULE BREAK ===\n\n') || '';
          break;
      }

      return content;
    } catch (error) {
      console.error(`Error fetching content for ${scope} ${scopeId}:`, error);
      throw new Error(`Failed to fetch content for ${scope}`);
    }
  }

  private async generateQuestionsFromContent(
    content: string,
    count: number,
    questionTypes: string[],
    difficulty: string,
    onProgress?: (message: string) => void
  ): Promise<GeneratedQuestion[]> {
    const prompt = this.buildQuestionGenerationPrompt(content, count, questionTypes, difficulty);
    
    onProgress?.('Generating questions with GPT-4.1-mini...');
    
    try {
      const response = await limit(() =>
        this.openai.chat.completions.create({
          model: 'gpt-4.1-mini', // Using GPT-4.1-mini as requested
          messages: [
            {
              role: 'system',
              content: 'You are an expert educational assessment creator with deep expertise in cognitive assessment design. Your specialty is generating diverse, well-randomized questions that authentically test student understanding while avoiding predictable patterns. You excel at creating questions with varied answer positions, balanced true/false distributions, and comprehensive content coverage. Always think step-by-step through your question generation process to ensure quality and randomization.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8, // Slightly higher for more creative variation in question generation
          max_tokens: 4000,
        })
      );

      const messageContent = response.choices[0].message?.content;
      if (!messageContent) {
        throw new Error('Empty response from GPT-4.1-mini');
      }

      const questions = this.parseQuestionsResponse(messageContent);
      onProgress?.(`Parsed ${questions.length} questions from AI response`);
      
      return questions;

    } catch (error) {
      console.error('Error generating questions with GPT-4.1-mini:', error);
      throw new Error('Failed to generate questions using AI');
    }
  }

  private buildQuestionGenerationPrompt(
    content: string,
    count: number,
    questionTypes: string[],
    difficulty: string
  ): string {
    const processedContent = this.preprocessContent(content);
    
    return `# Role and Objective
You are an expert educational assessment creator specializing in generating high-quality, varied questions that test comprehension, application, and analysis. Your goal is to create ${count} diverse assessment questions from the provided content with ${difficulty} difficulty level.

# Instructions

## Core Requirements
1. Generate exactly ${count} questions based solely on the provided educational content
2. Use these question types: ${questionTypes.join(', ')}
3. Ensure ${difficulty} difficulty level throughout
4. Output MUST be valid JSON array format
5. Questions must directly test understanding of the provided content

## Critical Randomization Requirements
- **RANDOMIZE ANSWER POSITIONS**: For multiple choice questions, vary the correct answer position (A, B, C, D) unpredictably
- **AVOID PATTERNS**: Do not place correct answers predominantly in position A or any single position
- **TRUE/FALSE VARIATION**: Mix true and false answers roughly equally - avoid making most answers "true"
- **MATCHING ORDER**: For matching questions, randomize the order of both left and right items
- **MATCHING PAIRS**: Scramble the correct pairings - do NOT match Item 1 with Match A, Item 2 with Match B, etc.
- **ANSWER DISTRIBUTION**: Ensure natural distribution across all possible answer choices

## Question Generation Strategy
For each question type, follow these specific guidelines:

### Multiple Choice Questions
- Create 4 plausible options with varied correct answer positions
- Make distractors believable but clearly incorrect
- Vary correct answer placement: sometimes A, sometimes B, C, or D
- Include at least one question where correct answer is in each position (A, B, C, D)

### True/False Questions  
- Create balanced mix of true and false statements
- Avoid making majority of answers "true"
- Base statements on specific content details
- Ensure clear distinction between true and false

### Short Answer Questions
- Accept multiple valid phrasings
- Include synonyms and alternative expressions
- Set appropriate scoring thresholds

### Essay Questions
- Focus on analysis and synthesis
- Provide clear evaluation criteria
- Include comprehensive rubrics

### Matching Questions
- Randomize item order in both columns (left and right items should NOT be in the same order)
- Ensure one-to-one correspondence with SCRAMBLED pairing (Item 1 should NOT match with Match A, etc.)
- Avoid alphabetical, numerical, or logical ordering patterns
- Mix up the correct pairings so they appear random (e.g., Item 1 → Match C, Item 2 → Match A, Item 3 → Match B)

# Reasoning Steps
Before generating each question:
1. **Content Analysis**: Identify key concepts, facts, and relationships in the content
2. **Question Planning**: Determine which concepts to test and appropriate question types
3. **Answer Randomization**: Deliberately vary correct answer positions and true/false distribution
4. **Quality Check**: Ensure questions test understanding rather than memorization
5. **Validation**: Verify answers are unambiguous and well-supported by content

# Output Format
Return a valid JSON array with this exact structure:

[
  {
    "question_text": "Clear, specific question text",
    "question_type": "multiple_choice|true_false|short_answer|essay|matching",
    "options": [...] or null,
    "correct_answer": "exact answer or array/object as appropriate",
    "answer_key": {
      // Detailed answer information with explanations
    },
    "sample_response": "For short_answer and essay only",
    "grading_rubric": null,
    "points": 1,
    "explanation": "What this question tests"
  }
]

# Question Type Specifications

## Multiple Choice Format
- **options**: ["Option A text", "Option B text", "Option C text", "Option D text"]
- **correct_answer**: "Exact text of correct option"
- **answer_key**: {
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "correct_option": "Exact text of correct option",
    "correct_position": "A|B|C|D",
    "explanations": {
      "Option A text": "Explanation of why this is correct/incorrect",
      "Option B text": "Explanation of why this is correct/incorrect",
      "Option C text": "Explanation of why this is correct/incorrect",
      "Option D text": "Explanation of why this is correct/incorrect"
    }
  }

## True/False Format  
- **options**: null
- **correct_answer**: true or false
- **answer_key**: {
    "correct_answer": "true or false",
    "explanation": "Detailed explanation of why this statement is true/false based on the content"
  }

## Short Answer Format
- **options**: null
- **correct_answer**: ["primary answer", "alternative answer"]
- **answer_key**: {
    "acceptable_answers": ["primary answer", "alternative answer", "synonym"],
    "keywords": ["keyword1", "keyword2"],
    "min_score_threshold": 0.7,
    "grading_notes": "What to look for when grading"
  }
- **sample_response**: "Model correct answer demonstrating expected depth"

## Essay Format
- **options**: null
- **correct_answer**: null
- **answer_key**: {
    "grading_criteria": "What to evaluate when grading this essay response",
    "key_points": ["essential point 1", "essential point 2", "essential point 3"],
    "rubric": {"content": 40, "organization": 30, "analysis": 30}
  }
- **sample_response**: "Comprehensive model essay response"

## Matching Format
- **options**: {"left_items": ["Item 1", "Item 2", "Item 3"], "right_items": ["Match C", "Match A", "Match B"]}
- **correct_answer**: {"Item 1": "Match B", "Item 2": "Match C", "Item 3": "Match A"}
- **answer_key**: {
    "pairs": [
      {"left": "Item 1", "right": "Match B"},
      {"left": "Item 2", "right": "Match C"},
      {"left": "Item 3", "right": "Match A"}
    ],
    "explanation": "Brief explanation of the matching logic and relationships"
  }

# Content to Analyze
\`\`\`
${processedContent}
\`\`\`

# Final Instructions and Reasoning Prompt
Now think step by step about the content and generate ${count} high-quality assessment questions. 

**CRITICAL REMINDER**: Ensure true randomization of answer positions and avoid any predictable patterns. For multiple choice questions, deliberately vary where you place the correct answer. For true/false questions, create a natural mix of true and false statements. 

Begin by analyzing the content for key testable concepts, then generate questions that genuinely assess understanding while maintaining proper answer randomization throughout.`;
  }

  private preprocessContent(content: string): string {
    // Clean up content for better AI processing
    let cleaned = content
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Convert links to text
      .replace(/[#*_`]/g, '') // Remove markdown formatting
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Truncate if too long (GPT-4.1-mini context limit)
    const maxTokens = 8000; // Leave room for prompt and response
    const tokens = encode(cleaned);
    if (tokens.length > maxTokens) {
      // Truncate to fit within token limit
      const truncatedTokens = tokens.slice(0, maxTokens);
      cleaned = new TextDecoder().decode(new Uint8Array(truncatedTokens));
    }

    return cleaned;
  }

  private parseQuestionsResponse(response: string): GeneratedQuestion[] {
    try {
      // Remove markdown code blocks if present
      let cleanedResponse = response.replace(/^```json\s*|```$/gm, '').trim();
      
      // Handle potentially truncated JSON by finding the last complete object
      if (!cleanedResponse.endsWith(']')) {
        console.warn('Response appears truncated, attempting to repair...');
        const lastCompleteObjectIndex = cleanedResponse.lastIndexOf('}');
        if (lastCompleteObjectIndex > 0) {
          cleanedResponse = cleanedResponse.substring(0, lastCompleteObjectIndex + 1) + ']';
        }
      }
      
      const parsed = JSON.parse(cleanedResponse);

      if (!Array.isArray(parsed)) {
        console.error('AI response is not an array:', parsed);
        return [];
      }

      return parsed.filter(q => 
        q.question_text && 
        q.question_type && 
        q.answer_key
      ).map((q, index) => {
        const question: GeneratedQuestion = {
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options || null, // Include options field
          correct_answer: q.correct_answer || null, // Include correct_answer field
          answer_key: q.answer_key,
          sample_response: q.sample_response || null,
          grading_rubric: q.grading_rubric || null,
          points: q.points || 1,
          explanation: q.explanation || null
        };
        
        // Transform answer key to ensure database compatibility
        return this.transformAnswerKeyForDatabase(question);
      });

    } catch (error) {
      console.error('Failed to parse questions response:', error);
      console.error('Response length:', response.length);
      console.error('Response preview:', response.substring(0, 500) + '...');
      return [];
    }
  }

  private async createAssessmentInDatabase(
    params: AssessmentGenerationParams,
    questions: GeneratedQuestion[]
  ): Promise<Assessment> {
    const supabase = createSupabaseServerClient();

    try {
      // 1. Create the assessment
      const assessmentData = {
        title: params.assessmentTitle,
        description: params.assessmentDescription || null,
        assessment_type: params.scope, // Use scope directly instead of mapping
        base_class_id: params.baseClassId,
        lesson_id: params.scope === 'lesson' ? params.scopeId : null,
        path_id: params.scope === 'path' ? params.scopeId : null,
        time_limit_minutes: params.timeLimit || null,
        passing_score_percentage: params.passingScore || 70,
        randomize_questions: false,
        show_results_immediately: true,
        allow_review: true,
        ai_grading_enabled: true,
        ai_model: 'gpt-4.1-mini'
      };

      const { data: assessment, error: assessmentError } = await supabase
        .from('assessments')
        .insert(assessmentData)
        .select()
        .single() as any;

      if (assessmentError) throw assessmentError;

      // 2. Create the questions with options and correct_answer fields
      const questionsData = questions.map((q, index) => ({
        assessment_id: assessment.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options || null, // Include options for questions that need them
        correct_answer: q.correct_answer || null, // Include correct answer
        answer_key: q.answer_key,
        sample_response: q.sample_response,
        grading_rubric: q.grading_rubric,
        points: q.points,
        order_index: index + 1,
        required: true,
        ai_grading_enabled: ['short_answer', 'essay'].includes(q.question_type)
      }));

      const { error: questionsError } = await supabase
        .from('assessment_questions')
        .insert(questionsData);

      if (questionsError) throw questionsError;

      // Return assessment with proper typing (cast to avoid schema mismatch)
      return assessment as any;

    } catch (error) {
      console.error('Error creating assessment in database:', error);
      throw new Error('Failed to save assessment to database');
    }
  }

  // Enhanced method to analyze content and extract key concepts with learning objectives
  async analyzeContentForConcepts(content: string, assessmentType: 'lesson' | 'path' | 'class' = 'lesson'): Promise<ContentAnalysis> {
    try {
      const processedContent = this.preprocessContent(content);
      const analysisDepth = this.getAnalysisDepth(assessmentType);
      
      const response = await limit(() =>
        this.openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert educational content analyst. Analyze educational content and extract key learning concepts, objectives, and assessment opportunities. Return structured JSON.`
            },
            {
              role: 'user',
              content: this.buildContentAnalysisPrompt(processedContent, analysisDepth)
            }
          ],
          temperature: 0.3,
          max_tokens: 1000,
        })
      );

      const analysisText = response.choices[0].message?.content;
      if (!analysisText) {
        throw new Error('Empty response from content analysis');
      }

      return this.parseContentAnalysis(analysisText);

    } catch (error) {
      console.error('Error analyzing content for concepts:', error);
      return this.createFallbackAnalysis(content);
    }
  }

  private getAnalysisDepth(assessmentType: 'lesson' | 'path' | 'class'): 'basic' | 'detailed' | 'comprehensive' {
    switch (assessmentType) {
      case 'lesson': return 'basic';
      case 'path': return 'detailed';
      case 'class': return 'comprehensive';
    }
  }

  private buildContentAnalysisPrompt(content: string, depth: 'basic' | 'detailed' | 'comprehensive'): string {
    const conceptCount = depth === 'basic' ? '3-5' : depth === 'detailed' ? '5-8' : '8-12';
    const objectiveCount = depth === 'basic' ? '2-4' : depth === 'detailed' ? '4-6' : '6-10';

    return `
Analyze this educational content and extract key learning elements:

CONTENT:
\`\`\`
${content}
\`\`\`

Extract the following in JSON format:
{
  "key_concepts": [${conceptCount} main concepts students should understand],
  "learning_objectives": [${objectiveCount} specific learning objectives],
  "cognitive_levels": ["remember", "understand", "apply", "analyze", "evaluate", "create"],
  "difficulty_indicators": ["beginner", "intermediate", "advanced"],
  "question_opportunities": [
    {
      "concept": "concept name",
      "question_types": ["multiple_choice", "true_false", "short_answer", "essay", "matching"],
      "cognitive_level": "understand",
      "difficulty": "intermediate"
    }
  ],
  "content_structure": {
    "main_topics": ["topic1", "topic2"],
    "supporting_details": ["detail1", "detail2"],
    "examples_provided": ["example1", "example2"],
    "definitions": {"term1": "definition1"}
  }
}

Focus on extracting concepts that can be assessed through questions.`;
  }

  private parseContentAnalysis(analysisText: string): ContentAnalysis {
    try {
      const cleanedResponse = analysisText.replace(/^```json\s*|```$/gm, '').trim();
      const parsed = JSON.parse(cleanedResponse);

      return {
        key_concepts: Array.isArray(parsed.key_concepts) ? parsed.key_concepts : [],
        learning_objectives: Array.isArray(parsed.learning_objectives) ? parsed.learning_objectives : [],
        cognitive_levels: Array.isArray(parsed.cognitive_levels) ? parsed.cognitive_levels : ['understand'],
        difficulty_indicators: Array.isArray(parsed.difficulty_indicators) ? parsed.difficulty_indicators : ['intermediate'],
        question_opportunities: Array.isArray(parsed.question_opportunities) ? parsed.question_opportunities : [],
        content_structure: parsed.content_structure || {
          main_topics: [],
          supporting_details: [],
          examples_provided: [],
          definitions: {}
        }
      };
    } catch (error) {
      console.error('Failed to parse content analysis:', error);
      return this.createFallbackAnalysis('');
    }
  }

  private createFallbackAnalysis(content: string): ContentAnalysis {
    // Create a basic analysis when AI analysis fails
    const words = content.toLowerCase().split(/\s+/);
    const concepts = ['core concept', 'key principle', 'fundamental idea'];
    
    return {
      key_concepts: concepts,
      learning_objectives: ['Understand the main concepts', 'Apply the principles'],
      cognitive_levels: ['understand', 'apply'],
      difficulty_indicators: ['intermediate'],
      question_opportunities: [
        {
          concept: 'general content',
          question_types: ['multiple_choice', 'short_answer'],
          cognitive_level: 'understand',
          difficulty: 'intermediate'
        }
      ],
      content_structure: {
        main_topics: ['general topic'],
        supporting_details: [],
        examples_provided: [],
        definitions: {}
      }
    };
  }

  // Enhanced question generation with validation and balancing
  async generateValidatedQuestions(
    content: string,
    count: number,
    questionTypes: string[],
    difficulty: string,
    onProgress?: (message: string) => void
  ): Promise<GeneratedQuestion[]> {
    onProgress?.('Generating questions with validation...');
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const questions = await this.generateQuestionsFromContent(
          content,
          count,
          questionTypes,
          difficulty,
          onProgress
        );
        
        // Validate each question's answer key
        const validQuestions = questions.filter(q => this.validateAnswerKey(q));
        
        if (validQuestions.length >= Math.ceil(count * 0.8)) { // Accept if 80% valid
          // Balance difficulty and finalize
          const balancedQuestions = this.balanceQuestionDifficulty(validQuestions, difficulty);
          onProgress?.(`Generated ${balancedQuestions.length} validated questions`);
          return balancedQuestions.slice(0, count); // Ensure exact count
        }
        
        attempts++;
        onProgress?.(`Attempt ${attempts}: Only ${validQuestions.length}/${count} questions valid, retrying...`);
        
      } catch (error) {
        attempts++;
        onProgress?.(`Attempt ${attempts} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Fallback: return basic questions if validation fails
    onProgress?.('Validation failed, using fallback generation...');
    return this.generateQuestionsFromContent(content, count, questionTypes, difficulty, onProgress);
  }

  // AI Grading Integration Methods
  async gradeStudentAttempt(attemptId: string, onProgress?: (message: string) => void): Promise<void> {
    const gradingService = new AIGradingService();
    await gradingService.gradeAttempt(attemptId, onProgress);
  }

  async batchGradeAttempts(attemptIds: string[], onProgress?: (message: string) => void): Promise<void> {
    const gradingService = new AIGradingService();
    await gradingService.batchGradeAttempts(attemptIds, onProgress);
  }

  async applyManualGrade(
    responseId: string,
    manualScore: number,
    manualFeedback: string,
    gradedBy: string,
    overrideReason?: string
  ): Promise<void> {
    const gradingService = new AIGradingService();
    await gradingService.applyManualGrade(responseId, manualScore, manualFeedback, gradedBy, overrideReason);
  }

  // Utility method to get assessment results
  async getAssessmentResults(assessmentId: string): Promise<any> {
    const supabase = createSupabaseServerClient();

    try {
      const { data: attempts, error } = await supabase
        .from('student_attempts')
        .select(`
          *,
          profiles!inner(
            user_id,
            first_name,
            last_name,
            email
          ),
          student_responses(
            *,
            assessment_questions(
              question_text,
              question_type,
              points,
              answer_key
            )
          )
        `)
        .eq('assessment_id', assessmentId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return attempts;

    } catch (error) {
      console.error('Error fetching assessment results:', error);
      throw new Error('Failed to fetch assessment results');
    }
  }

  // Get assessment analytics
  async getAssessmentAnalytics(assessmentId: string): Promise<any> {
    const supabase = createSupabaseServerClient();

    try {
      // Get summary statistics
      const { data: attempts, error: attemptsError } = (await supabase
        .from('student_attempts')
        .select('percentage_score, status, time_spent_minutes')
        .eq('assessment_id', assessmentId)
        .eq('status', 'graded')) as any;

      if (attemptsError) throw attemptsError;

      // Calculate analytics
      const totalAttempts = attempts?.length || 0;
      const scores = attempts?.map((a: any) => a.percentage_score || 0) || [];
      const averageScore = scores.length > 0 ? scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length : 0;
      const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
      const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
      const passedCount = scores.filter((score: number) => score >= 70).length; // Assuming 70% pass rate
      const passRate = totalAttempts > 0 ? (passedCount / totalAttempts) * 100 : 0;

      // Get question-level analytics
      const { data: responses, error: responsesError } = (await supabase
        .from('student_responses')
        .select(`
          question_id,
          is_correct,
          final_score,
          assessment_questions!inner(
            question_text,
            question_type,
            points
          )
        `)
        .in('attempt_id', attempts?.map((a: any) => a.id) || [])) as any;

      if (responsesError) throw responsesError;

      // Group by question for question analytics
      const questionStats = responses?.reduce((acc: any, response: any) => {
        const questionId = response.question_id;
        if (!acc[questionId]) {
          acc[questionId] = {
            question_text: response.assessment_questions.question_text,
            question_type: response.assessment_questions.question_type,
            total_responses: 0,
            correct_responses: 0,
            average_score: 0,
            scores: []
          };
        }
        
        acc[questionId].total_responses++;
        if (response.is_correct) acc[questionId].correct_responses++;
        acc[questionId].scores.push(response.final_score || 0);
        
        return acc;
      }, {});

      // Calculate averages for each question
      Object.values(questionStats || {}).forEach((stat: any) => {
        stat.average_score = stat.scores.reduce((sum: number, score: number) => sum + score, 0) / stat.scores.length;
        stat.accuracy_rate = (stat.correct_responses / stat.total_responses) * 100;
      });

      return {
        overview: {
          totalAttempts,
          averageScore: Math.round(averageScore * 100) / 100,
          highestScore,
          lowestScore,
          passRate: Math.round(passRate * 100) / 100,
          passedCount
        },
        questionAnalytics: Object.values(questionStats || {}),
        scoreDistribution: this.calculateScoreDistribution(scores)
      };

    } catch (error) {
      console.error('Error calculating assessment analytics:', error);
      throw new Error('Failed to calculate assessment analytics');
    }
  }

  private calculateScoreDistribution(scores: number[]): any {
    const ranges = [
      { label: '90-100%', min: 90, max: 100, count: 0 },
      { label: '80-89%', min: 80, max: 89, count: 0 },
      { label: '70-79%', min: 70, max: 79, count: 0 },
      { label: '60-69%', min: 60, max: 69, count: 0 },
      { label: '50-59%', min: 50, max: 59, count: 0 },
      { label: 'Below 50%', min: 0, max: 49, count: 0 }
    ];

    scores.forEach(score => {
      const range = ranges.find(r => score >= r.min && score <= r.max);
      if (range) range.count++;
    });

    return ranges;
  }

  // Enhanced difficulty balancing for questions
  private balanceQuestionDifficulty(questions: GeneratedQuestion[], targetDifficulty: string): GeneratedQuestion[] {
    // Distribute points based on difficulty
    const difficultyPoints = this.getDifficultyPointDistribution(targetDifficulty);
    
    return questions.map((question, index) => {
      const questionDifficulty = this.assessQuestionDifficulty(question);
      const adjustedPoints = this.calculatePointsForDifficulty(questionDifficulty, difficultyPoints);
      
      return {
        ...question,
        points: adjustedPoints,
        explanation: question.explanation || this.generateQuestionExplanation(question)
      };
    });
  }

  private getDifficultyPointDistribution(difficulty: string): { easy: number, medium: number, hard: number } {
    switch (difficulty) {
      case 'easy':
        return { easy: 70, medium: 25, hard: 5 }; // Percentage distribution
      case 'medium':
        return { easy: 20, medium: 60, hard: 20 };
      case 'hard':
        return { easy: 10, medium: 30, hard: 60 };
      default:
        return { easy: 20, medium: 60, hard: 20 };
    }
  }

  private assessQuestionDifficulty(question: GeneratedQuestion): 'easy' | 'medium' | 'hard' {
    // Assess difficulty based on question type and complexity
    const complexityFactors = {
      multiple_choice: 1,
      true_false: 0.5,
      short_answer: 2,
      essay: 3,
      matching: 1.5
    };

    const baseComplexity = complexityFactors[question.question_type] || 1;
    const textComplexity = this.assessTextComplexity(question.question_text);
    
    const totalComplexity = baseComplexity + textComplexity;
    
    if (totalComplexity < 1.5) return 'easy';
    if (totalComplexity < 2.5) return 'medium';
    return 'hard';
  }

  private assessTextComplexity(text: string): number {
    // Simple complexity assessment based on text characteristics
    const words = text.split(/\s+/).length;
    const avgWordLength = text.replace(/\s+/g, '').length / words;
    const hasComplexTerms = /\b(analyze|evaluate|compare|synthesize|critique)\b/i.test(text);
    
    let complexity = 0;
    if (words > 20) complexity += 0.5;
    if (avgWordLength > 6) complexity += 0.3;
    if (hasComplexTerms) complexity += 0.7;
    
    return complexity;
  }

  private calculatePointsForDifficulty(questionDifficulty: 'easy' | 'medium' | 'hard', distribution: any): number {
    const basePoints = {
      easy: 1,
      medium: 2,
      hard: 3
    };
    
    return basePoints[questionDifficulty];
  }

  private generateQuestionExplanation(question: GeneratedQuestion): string {
    const typeExplanations = {
      multiple_choice: 'Tests comprehension and recognition of key concepts',
      true_false: 'Evaluates understanding of factual information',
      short_answer: 'Assesses ability to recall and express key information',
      essay: 'Measures analytical thinking and comprehensive understanding',
      matching: 'Tests ability to connect related concepts and terms'
    };
    
    return typeExplanations[question.question_type] || 'Assesses understanding of content';
  }

  // Answer key validation to ensure quality
  private validateAnswerKey(question: GeneratedQuestion): boolean {
    try {
      const { question_type, answer_key } = question;
      
      switch (question_type) {
        case 'multiple_choice':
          return this.validateMultipleChoiceAnswerKey(answer_key);
        case 'true_false':
          return this.validateTrueFalseAnswerKey(answer_key);
        case 'short_answer':
          return this.validateShortAnswerAnswerKey(answer_key);
        case 'essay':
          return this.validateEssayAnswerKey(answer_key);
        case 'matching':
          return this.validateMatchingAnswerKey(answer_key);
        default:
          return false;
      }
    } catch (error) {
      console.error('Error validating answer key:', error);
      return false;
    }
  }

  private validateMultipleChoiceAnswerKey(answerKey: any): boolean {
    return (
      answerKey &&
      Array.isArray(answerKey.options) &&
      answerKey.options.length >= 3 &&
      answerKey.correct_option &&
      answerKey.options.includes(answerKey.correct_option)
    );
  }

  private validateTrueFalseAnswerKey(answerKey: any): boolean {
    return (
      answerKey &&
      typeof answerKey.correct_answer === 'boolean' &&
      answerKey.explanation &&
      answerKey.explanation.length > 10
    );
  }

  private validateShortAnswerAnswerKey(answerKey: any): boolean {
    return (
      answerKey &&
      Array.isArray(answerKey.acceptable_answers) &&
      answerKey.acceptable_answers.length > 0 &&
      Array.isArray(answerKey.keywords) &&
      typeof answerKey.min_score_threshold === 'number'
    );
  }

  private validateEssayAnswerKey(answerKey: any): boolean {
    return (
      answerKey &&
      answerKey.grading_criteria &&
      Array.isArray(answerKey.key_points) &&
      answerKey.key_points.length > 0 &&
      answerKey.rubric &&
      typeof answerKey.rubric === 'object'
    );
  }

  private validateMatchingAnswerKey(answerKey: any): boolean {
    return (
      answerKey &&
      Array.isArray(answerKey.pairs) &&
      answerKey.pairs.length >= 3 &&
      answerKey.pairs.every((pair: any) => pair.left && pair.right)
    );
  }

  private transformAnswerKeyForDatabase(question: GeneratedQuestion): GeneratedQuestion {
    // Ensure answer_key conforms to database validation function requirements
    const { question_type, answer_key } = question;
    
    try {
      switch (question_type) {
        case 'multiple_choice':
          // Ensure we have options and correct_option
          if (!answer_key.options || !answer_key.correct_option) {
            // Try to construct from existing data
            const options = question.options || answer_key.options || [];
            const correctOption = answer_key.correct_option || question.correct_answer;
            
            return {
              ...question,
              answer_key: {
                ...answer_key,
                options: options,
                correct_option: correctOption,
                explanations: answer_key.explanations || answer_key.distractors || {}
              }
            };
          }
          break;
          
        case 'true_false':
          // Ensure we have correct_answer boolean
          if (typeof answer_key.correct_answer !== 'boolean') {
            const correctAnswer = question.correct_answer === true || question.correct_answer === 'true' || 
                                question.correct_answer === 'True';
            
            return {
              ...question,
              answer_key: {
                ...answer_key,
                correct_answer: correctAnswer,
                explanation: answer_key.explanation || 'No explanation provided'
              }
            };
          }
          break;
          
        case 'short_answer':
          // Ensure we have acceptable_answers array
          if (!answer_key.acceptable_answers) {
            const acceptableAnswers = Array.isArray(question.correct_answer) 
              ? question.correct_answer 
              : [question.correct_answer].filter(Boolean);
              
            return {
              ...question,
              answer_key: {
                ...answer_key,
                acceptable_answers: acceptableAnswers,
                keywords: answer_key.keywords || [],
                min_score_threshold: answer_key.min_score_threshold || 0.7
              }
            };
          }
          break;
          
        case 'essay':
          // Ensure we have grading_criteria
          if (!answer_key.grading_criteria) {
            return {
              ...question,
              answer_key: {
                ...answer_key,
                grading_criteria: answer_key.grading_criteria || 'Evaluate based on content knowledge, organization, and analysis',
                key_points: answer_key.key_points || [],
                rubric: answer_key.rubric || {}
              }
            };
          }
          break;
          
        case 'matching':
          // Ensure we have pairs array
          if (!answer_key.pairs) {
            const correctAnswer = question.correct_answer || {};
            const pairs = Object.entries(correctAnswer).map(([left, right]) => ({
              left,
              right
            }));
            
            return {
              ...question,
              answer_key: {
                ...answer_key,
                pairs: pairs,
                explanation: answer_key.explanation || 'Match the items correctly'
              }
            };
          }
          break;
      }
      
      return question;
    } catch (error) {
      console.error('Error transforming answer key for database:', error);
      return question;
    }
  }
} 