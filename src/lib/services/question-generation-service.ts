import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';

// Types for question generation
interface QuestionGenerationOptions {
  lessonId: string;
  sectionIds?: string[];
  baseClassId?: string; // No longer the primary identifier, can be derived from lesson
  questionTypes: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  numQuestions: number;
  bloomTaxonomy: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  learningObjectives?: string[];
  focusAreas?: string[];
  userId: string;
  // Enhanced distribution configuration
  questionDistribution?: QuestionDistribution;
}

// New interface for question distribution
interface QuestionDistribution {
  typeDistribution: { [key: string]: number }; // question_type -> count
  difficultyDistribution: { [key: string]: number }; // difficulty -> count
  bloomTaxonomyDistribution: { [key: string]: number }; // bloom level -> count
  focusAreaDistribution?: { [key: string]: number }; // focus area -> count
}

interface GeneratedQuestion {
  question_text: string;
  question_type: string;
  points: number;
  options?: {
    option_text: string;
    is_correct: boolean;
    explanation?: string;
  }[];
  metadata: {
    difficulty_level: string;
    bloom_taxonomy: string;
    learning_objectives: string[];
    tags: string[];
    estimated_time: number;
    lesson_content_refs: string[];
    source_content: string;
    ai_generated: boolean;
    validation_status: string;
  };
  explanation?: string;
  sample_answers?: string[];
}

interface ContentSection {
  id: string;
  title: string;
  content: any;
  section_type: string;
  lesson_title: string;
  lesson_id: string;
  lesson_description?: string;
  path_title?: string;
  path_description?: string;
  order_index: number;
}

// Enhanced comprehensive content interface
interface ComprehensiveContent {
  baseClass: {
    id: string;
    name: string;
    description?: string;
    settings?: any;
  };
  paths: Array<{
    id: string;
    title: string;
    description?: string;
    level?: string;
    order_index: number;
  }>;
  lessons: Array<{
    id: string;
    title: string;
    description?: string;
    level?: string;
    path_title?: string;
    order_index: number;
  }>;
  sections: ContentSection[];
  totalSections: number;
  totalLessons: number;
  totalPaths: number;
}

export class QuestionGenerationService {
  private openai: OpenAI;
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase!;
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // New method for lesson-level question generation
  async generateLessonQuestions(options: {
    lessonId: string;
    lessonTitle: string;
    lessonContent: string;
    questionCount: number;
    difficultyLevels: string[];
    questionTypes: string[];
    bloomTaxonomyLevels: string[];
    learningObjectives: string[];
    userId?: string;
    saveToDatabase?: boolean;
  }) {
    try {
      console.log('Generating questions for lesson:', options.lessonId);

      // Create a focused prompt for lesson-specific content
      const prompt = this.buildLessonQuestionPrompt(options);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational assessment designer. Generate high-quality questions based on specific lesson content that support mastery learning progression.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      });

      const aiResponse = response.choices[0]?.message?.content || '';
      
      // Parse the AI response into structured questions
      const questions = this.parseLessonQuestions(aiResponse, options);
      
      // Save to database if requested and userId provided
      if (options.saveToDatabase && options.userId) {
        const savedQuestions = await this.saveLessonQuestionsToDatabase(questions, options);
        return {
          questions: savedQuestions,
          metadata: {
            lessonId: options.lessonId,
            lessonTitle: options.lessonTitle,
            questionCount: questions.length,
            generationTimestamp: new Date().toISOString(),
            difficultyLevels: options.difficultyLevels,
            questionTypes: options.questionTypes,
            bloomTaxonomyLevels: options.bloomTaxonomyLevels,
            learningObjectives: options.learningObjectives
          }
        };
      }
      
      return { questions, metadata: null };
    } catch (error) {
      console.error('Error generating lesson questions:', error);
      throw error;
    }
  }

  async generateQuestionsFromContent(options: QuestionGenerationOptions) {
    try {
      // 1. Fetch comprehensive content from the lesson
      const comprehensiveContent = await this.fetchComprehensiveContent(options);
      
      // Add baseClassId to options for any downstream methods that might still need it (like folder creation, etc.)
      // Although ideal to remove, this provides a bridge during refactoring.
      const optionsWithContext = {
        ...options,
        baseClassId: comprehensiveContent.baseClass.id,
      };
      
      // 2. Analyze and extract key concepts from all content
      const analyzedContent = await this.analyzeComprehensiveContent(comprehensiveContent);
      
      // 3. Create question distribution plan
      const distributionPlan = this.createDistributionPlan(optionsWithContext);
      
      // 4. Generate questions using AI with distribution plan
      const questions = await this.generateQuestionsWithDistribution(analyzedContent, optionsWithContext, distributionPlan);
      
      // 5. Validate and enhance questions
      const validatedQuestions = await this.validateQuestions(questions, optionsWithContext);
      
      // 6. Save questions to database
      const savedQuestions = await this.saveQuestionsToDatabase(validatedQuestions, optionsWithContext);

      return {
        questions: savedQuestions,
        metadata: {
          sourceContentCount: comprehensiveContent.totalSections,
          totalLessons: comprehensiveContent.totalLessons,
          totalPaths: comprehensiveContent.totalPaths,
          generationTimestamp: new Date().toISOString(),
          difficulty: options.difficulty,
          questionTypes: options.questionTypes,
          bloomTaxonomy: options.bloomTaxonomy,
          distributionPlan
        },
        sourceContent: {
          baseClass: comprehensiveContent.baseClass,
          paths: comprehensiveContent.paths,
          lessons: comprehensiveContent.lessons,
          sections: comprehensiveContent.sections.map(section => ({
            id: section.id,
            title: section.title,
            lesson_title: section.lesson_title,
            path_title: section.path_title,
            section_type: section.section_type
          }))
        }
      };
    } catch (error) {
      console.error('Question generation failed:', error);
      throw error;
    }
  }

  // Rewritten to be lesson-centric instead of base-class-centric
  private async fetchComprehensiveContent(options: QuestionGenerationOptions): Promise<ComprehensiveContent> {
    console.log(`Fetching comprehensive content for lesson: ${options.lessonId}`);
    
    // 1. Fetch the lesson and its parent info
    const { data: lessonData, error: lessonError } = await this.supabase
      .from('lessons')
      .select(`
        id, 
        title, 
        description, 
        level, 
        order_index,
        paths (
          id,
          title,
          description,
          level,
          order_index,
          base_classes (
            id,
            name,
            description,
            settings
          )
        )
      `)
      .eq('id', options.lessonId)
      .single();

    if (lessonError || !lessonData) {
      throw new Error(`Failed to fetch lesson information: ${lessonError?.message || 'Lesson not found'}`);
    }

    const pathData = lessonData.paths;
    const baseClassData = pathData?.base_classes;

    if (!pathData || !baseClassData) {
      throw new Error('Lesson is not properly associated with a path and base class.');
    }
    
    // 2. Fetch sections for the lesson (or specific sections if ids provided)
    let sectionQuery = this.supabase
      .from('sections')
      .select(`
        id,
        title,
        content,
        section_type,
        order_index,
        lessons (
          id,
          title,
          description,
          paths (
            title,
            description
          )
        )
      `)
      .eq('lesson_id', options.lessonId);

    if (options.sectionIds && options.sectionIds.length > 0) {
      sectionQuery = sectionQuery.in('id', options.sectionIds);
    }

    const { data: sections, error: sectionsError } = await sectionQuery.order('order_index', { ascending: true });

    if (sectionsError) {
      throw new Error(`Failed to fetch sections: ${sectionsError.message}`);
    }

    // 3. Construct the ComprehensiveContent object
    const comprehensiveContent: ComprehensiveContent = {
      baseClass: {
        id: baseClassData.id,
        name: baseClassData.name,
        description: baseClassData.description,
        settings: baseClassData.settings,
      },
      paths: [{
        id: pathData.id,
        title: pathData.title,
        description: pathData.description,
        level: pathData.level,
        order_index: pathData.order_index,
      }],
      lessons: [{
        id: lessonData.id,
        title: lessonData.title,
        description: lessonData.description,
        level: lessonData.level,
        path_title: pathData.title,
        order_index: lessonData.order_index,
      }],
      sections: sections.map(s => ({
        id: s.id,
        title: s.title,
        content: s.content,
        section_type: s.section_type,
        lesson_title: s.lessons?.title || lessonData.title,
        lesson_id: s.lessons?.id || lessonData.id,
        lesson_description: s.lessons?.description || lessonData.description,
        path_title: s.lessons?.paths?.title || pathData.title,
        path_description: s.lessons?.paths?.description || pathData.description,
        order_index: s.order_index,
      })),
      totalSections: sections.length,
      totalLessons: 1,
      totalPaths: 1,
    };

    return comprehensiveContent;
  }

  private async analyzeComprehensiveContent(comprehensiveContent: ComprehensiveContent) {
    console.log('Analyzing comprehensive content with', comprehensiveContent.totalSections, 'sections');
    
    const contentAnalysis = {
      baseClassContext: {
        name: comprehensiveContent.baseClass.name,
        description: comprehensiveContent.baseClass.description || '',
        totalPaths: comprehensiveContent.totalPaths,
        totalLessons: comprehensiveContent.totalLessons,
        totalSections: comprehensiveContent.totalSections
      },
      pathsContext: comprehensiveContent.paths.map(path => ({
        title: path.title,
        description: path.description || '',
        level: path.level || ''
      })),
      lessonsContext: comprehensiveContent.lessons.map(lesson => ({
        title: lesson.title,
        description: lesson.description || '',
        level: lesson.level || '',
        pathTitle: lesson.path_title || ''
      })),
      sectionsContent: comprehensiveContent.sections.map(section => {
        const content = typeof section.content === 'string' 
          ? JSON.parse(section.content) 
          : section.content;
        
        return {
          sectionId: section.id,
          title: section.title,
          lessonTitle: section.lesson_title,
          lessonDescription: section.lesson_description || '',
          pathTitle: section.path_title || '',
          pathDescription: section.path_description || '',
          sectionType: section.section_type,
          text: content?.text || '',
          concepts: this.extractKeyConcepts(content?.text || ''),
          lessonId: section.lesson_id,
          orderIndex: section.order_index
        };
      })
    };

    // Extract global concepts and themes across all content
    const allText = contentAnalysis.sectionsContent.map(s => s.text).join(' ');
    const globalConcepts = this.extractKeyConcepts(allText);
    const topicClusters = this.identifyTopicClusters(contentAnalysis.sectionsContent);

    return {
      ...contentAnalysis,
      globalConcepts,
      topicClusters,
      contentStats: {
        averageContentLength: allText.length / comprehensiveContent.totalSections,
        totalWordCount: allText.split(/\s+/).length,
        conceptDensity: globalConcepts.length / comprehensiveContent.totalSections
      }
    };
  }

  // Create distribution plan based on options
  private createDistributionPlan(options: QuestionGenerationOptions): QuestionDistribution {
    const { numQuestions, questionTypes, questionDistribution } = options;
    
    // If custom distribution provided, use it
    if (questionDistribution) {
      return questionDistribution;
    }

    // Otherwise, create balanced distribution
    const typeCount = questionTypes.length;
    const baseQuestionsPerType = Math.floor(numQuestions / typeCount);
    const remainder = numQuestions % typeCount;

    const typeDistribution: { [key: string]: number } = {};
    questionTypes.forEach((type, index) => {
      typeDistribution[type] = baseQuestionsPerType + (index < remainder ? 1 : 0);
    });

    // Default difficulty distribution (balanced)
    const difficultyLevels = ['easy', 'medium', 'hard'];
    const difficultyDistribution: { [key: string]: number } = {
      easy: Math.ceil(numQuestions * 0.3),
      medium: Math.ceil(numQuestions * 0.5),
      hard: Math.floor(numQuestions * 0.2)
    };

    // Adjust if total doesn't match
    const totalDifficulty = Object.values(difficultyDistribution).reduce((sum, count) => sum + count, 0);
    if (totalDifficulty !== numQuestions) {
      difficultyDistribution.medium += numQuestions - totalDifficulty;
    }

    // Bloom taxonomy distribution
    const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
    const bloomTaxonomyDistribution: { [key: string]: number } = {
      remember: Math.ceil(numQuestions * 0.15),
      understand: Math.ceil(numQuestions * 0.25),
      apply: Math.ceil(numQuestions * 0.25),
      analyze: Math.ceil(numQuestions * 0.20),
      evaluate: Math.ceil(numQuestions * 0.10),
      create: Math.ceil(numQuestions * 0.05)
    };

    // Adjust bloom taxonomy totals
    const totalBloom = Object.values(bloomTaxonomyDistribution).reduce((sum, count) => sum + count, 0);
    if (totalBloom !== numQuestions) {
      bloomTaxonomyDistribution.understand += numQuestions - totalBloom;
    }

    return {
      typeDistribution,
      difficultyDistribution,
      bloomTaxonomyDistribution
    };
  }

  // Generate questions with distribution plan
  private async generateQuestionsWithDistribution(
    analyzedContent: any, 
    options: QuestionGenerationOptions,
    distributionPlan: QuestionDistribution
  ): Promise<GeneratedQuestion[]> {
    const allQuestions: GeneratedQuestion[] = [];
    
    console.log('Generating questions with distribution plan:', distributionPlan);
    
    // Generate questions for each type according to distribution
    for (const [questionType, count] of Object.entries(distributionPlan.typeDistribution)) {
      if (count > 0) {
        console.log(`Generating ${count} questions of type: ${questionType}`);
        
        // Create a focused prompt for this question type batch
        const prompt = this.buildComprehensivePrompt(
          analyzedContent, 
          questionType, 
          options, 
          count,
          distributionPlan
        );
        
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini', // More cost-effective for question generation
          messages: [
            {
              role: 'system',
              content: 'You are an expert educational assessment designer specializing in creating high-quality questions from comprehensive course content.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 4000
        });

        const aiResponse = response.choices[0]?.message?.content || '';
        const questions = this.parseQuestions(aiResponse, questionType, analyzedContent.sectionsContent, options);
        
        allQuestions.push(...questions);
        
        // Brief pause to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Generated ${allQuestions.length} total questions`);
    return allQuestions;
  }

  // Enhanced prompt building with comprehensive content context
  private buildComprehensivePrompt(
    analyzedContent: any, 
    questionType: string, 
    options: QuestionGenerationOptions,
    numQuestions: number,
    distributionPlan: QuestionDistribution
  ): string {
    const { baseClassContext, pathsContext, lessonsContext, sectionsContent, globalConcepts, topicClusters } = analyzedContent;
    
    // Build comprehensive context
    const contextSection = `
## COMPREHENSIVE COURSE CONTEXT

### Base Class Overview
- **Course Name**: ${baseClassContext.name}
- **Description**: ${baseClassContext.description}
- **Structure**: ${baseClassContext.totalPaths} learning paths, ${baseClassContext.totalLessons} lessons, ${baseClassContext.totalSections} content sections

### Learning Paths
${pathsContext.map((path: any, idx: number) => `
**Path ${idx + 1}: ${path.title}**
- Level: ${path.level}
- Description: ${path.description}
`).join('')}

### Key Lessons Overview
${lessonsContext.slice(0, 10).map((lesson: any, idx: number) => `
**${lesson.title}** (${lesson.pathTitle})
- Level: ${lesson.level}
- Description: ${lesson.description}
`).join('')}

### Global Concepts Identified
${globalConcepts.slice(0, 15).join(', ')}

### Topic Clusters
${topicClusters.map((cluster: any) => `- ${cluster.theme}: ${cluster.concepts.join(', ')}`).join('\n')}
`;

    // Build detailed content sections
    const contentSection = `
## DETAILED LESSON CONTENT

${sectionsContent.map((section: any) => `
### Section: ${section.title}
**Context**: ${section.lessonTitle} → ${section.pathTitle}
**Type**: ${section.sectionType}
**Content**: 
${section.text.substring(0, 800)}${section.text.length > 800 ? '...' : ''}
**Key Concepts**: ${section.concepts.join(', ')}
---
`).join('')}
`;

    // Question type specific instructions
    const questionTypeInstructions = this.getQuestionTypeInstructions(questionType);
    
    // Difficulty distribution for this batch
    const difficultyInfo = Object.entries(distributionPlan.difficultyDistribution)
      .map(([level, count]) => `${level}: ${count} questions`)
      .join(', ');

    const bloomInfo = Object.entries(distributionPlan.bloomTaxonomyDistribution)
      .map(([level, count]) => `${level}: ${count} questions`)
      .join(', ');

    return `
${contextSection}

${contentSection}

## QUESTION GENERATION REQUIREMENTS

### Task
Generate ${numQuestions} high-quality ${questionType.replace('_', ' ')} questions based on the comprehensive course content above.

### Distribution Requirements
- **Difficulty Distribution**: ${difficultyInfo}
- **Bloom Taxonomy Distribution**: ${bloomInfo}
- **Focus Areas**: ${options.focusAreas?.join(', ') || 'All content areas equally'}
- **Learning Objectives**: ${options.learningObjectives?.join(', ') || 'Derived from content'}

### Question Type Instructions
${questionTypeInstructions}

### Quality Standards
1. **Content Coverage**: Questions should span across multiple lessons and paths
2. **Conceptual Depth**: Test understanding of key concepts and their relationships
3. **Practical Application**: Include real-world application where relevant
4. **Progressive Difficulty**: Range from basic recall to higher-order thinking
5. **Content Accuracy**: Ensure all questions are factually correct based on provided content
6. **Clear Language**: Use clear, unambiguous language appropriate for the course level

### Output Format
Provide ${numQuestions} questions in this exact JSON format:

\`\`\`json
[
  {
    "question_text": "Your question here...",
    "question_type": "${questionType}",
    "difficulty_level": "easy|medium|hard",
    "bloom_taxonomy": "remember|understand|apply|analyze|evaluate|create",
    "points": 1-10,
    "options": [/* For multiple choice, true/false, matching */],
    "explanation": "Why this answer is correct...",
    "sample_answers": [/* For open-ended questions */],
    "learning_objectives": ["objective1", "objective2"],
    "tags": ["tag1", "tag2"],
    "estimated_time": 2-15,
    "source_content_refs": ["section_id1", "section_id2"]
  }
]
\`\`\`

Generate exactly ${numQuestions} questions now:
`;
  }

  private extractKeyConcepts(text: string): string[] {
    // Extract key concepts using simple heuristics
    // In a production system, you might use NLP libraries
    const sentences = text.split(/[.!?]+/);
    const concepts: string[] = [];
    
    sentences.forEach(sentence => {
      // Look for important terms (capitalized words, technical terms)
      const words = sentence.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
      if (words) {
        concepts.push(...words.filter(word => word.length > 3));
      }
    });

    return [...new Set(concepts)].slice(0, 10); // Top 10 unique concepts
  }

  // New method to identify topic clusters across content
  private identifyTopicClusters(sectionsContent: any[]): Array<{theme: string, concepts: string[]}> {
    const clusters: Array<{theme: string, concepts: string[]}> = [];
    
    // Group sections by lesson/path
    const lessonGroups = sectionsContent.reduce((groups, section) => {
      const key = section.lessonTitle;
      if (!groups[key]) groups[key] = [];
      groups[key].push(section);
      return groups;
    }, {} as { [key: string]: any[] });

    // Create clusters for each lesson
    Object.entries(lessonGroups).forEach(([lessonTitle, sections]) => {
      const allConcepts = (sections as any[]).flatMap((s: any) => s.concepts as string[]);
      const uniqueConcepts = [...new Set(allConcepts)].slice(0, 5);
      
      if (uniqueConcepts.length > 0) {
        clusters.push({
          theme: lessonTitle,
          concepts: uniqueConcepts
        });
      }
    });

    return clusters.slice(0, 8); // Top 8 topic clusters
  }

  private getQuestionTypeInstructions(questionType: string): string {
    const instructions: { [key: string]: string } = {
      multiple_choice: `
**Multiple Choice Instructions:**
- Create questions with 4-5 answer options
- Only one correct answer per question
- Incorrect options should be plausible but clearly wrong
- Avoid "all of the above" or "none of the above" unless necessary
- Include brief explanations for why the correct answer is right`,
      
      true_false: `
**True/False Instructions:**
- Create clear, unambiguous statements
- Avoid tricky wording or double negatives
- Focus on key facts and concepts
- Include explanations for both true and false answers`,
      
      short_answer: `
**Short Answer Instructions:**
- Questions should require 1-3 sentences to answer
- Focus on key concepts, definitions, or explanations
- Provide sample acceptable answers
- Include scoring rubrics when appropriate`,
      
      essay: `
**Essay Instructions:**
- Create questions requiring 1-2 paragraphs minimum
- Focus on analysis, synthesis, and critical thinking
- Provide clear evaluation criteria
- Include sample response outlines`,
      
      fill_in_blank: `
**Fill in the Blank Instructions:**
- Remove 1-3 key terms from important sentences
- Blanks should test essential vocabulary or concepts
- Provide word banks when appropriate
- Ensure only one clear answer fits each blank`,
      
      matching: `
**Matching Instructions:**
- Create 5-8 items to match between two columns
- Include one extra distractor item
- Ensure clear one-to-one relationships
- Items should be logically related`,
      
      sequence: `
**Sequence Instructions:**
- Create 4-6 steps in a logical process
- Present items out of order for students to arrange
- Focus on procedures, timelines, or cause-effect chains
- Provide clear context for the sequence`
    };

    return instructions[questionType] || 'Create high-quality questions based on the content provided.';
  }

  private parseQuestions(
    aiResponse: string, 
    questionType: string, 
    content: any[], 
    options: QuestionGenerationOptions
  ): GeneratedQuestion[] {
    try {
      // Extract JSON from the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const parsedQuestions = JSON.parse(jsonMatch[0]);
      
      return parsedQuestions.map((q: any) => ({
        question_text: q.question_text,
        question_type: questionType,
        points: q.points || 1,
        options: q.options || undefined,
        explanation: q.explanation,
        sample_answers: q.sample_answers || undefined,
        metadata: {
          difficulty_level: options.difficulty,
          bloom_taxonomy: options.bloomTaxonomy,
          learning_objectives: options.learningObjectives || [],
          tags: q.key_concepts || [],
          estimated_time: this.estimateTimeForQuestion(questionType),
          lesson_content_refs: q.source_section_ids || content.map(c => c.sectionId),
          source_content: content.map(c => c.text).join('\n\n').substring(0, 1000),
          ai_generated: true,
          validation_status: 'draft'
        }
      }));
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return [];
    }
  }

  private estimateTimeForQuestion(questionType: string): number {
    const timeEstimates = {
      multiple_choice: 2,
      true_false: 1,
      short_answer: 5,
      essay: 15,
      fill_in_blank: 2,
      matching: 3,
      drag_drop: 4,
      sequence: 3
    };
    
    return timeEstimates[questionType as keyof typeof timeEstimates] || 2;
  }

  private async validateQuestions(
    questions: GeneratedQuestion[], 
    options: QuestionGenerationOptions
  ): Promise<GeneratedQuestion[]> {
    // Basic validation - in production, you might add more sophisticated checks
    return questions.filter(question => {
      // Ensure question text exists and is meaningful
      if (!question.question_text || question.question_text.length < 10) {
        return false;
      }

      // Validate multiple choice questions have correct number of options
      if (question.question_type === 'multiple_choice') {
        if (!question.options || question.options.length < 2) {
          return false;
        }
        
        const correctAnswers = question.options.filter(opt => opt.is_correct);
        if (correctAnswers.length !== 1) {
          return false;
        }
      }

      return true;
    });
  }

  private async saveQuestionsToDatabase(
    questions: GeneratedQuestion[], 
    options: QuestionGenerationOptions
  ) {
    console.log(`Saving ${questions.length} questions for lesson ${options.lessonId}`);

    const questionsToInsert = questions.map(q => ({
      question_text: q.question_text,
      question_type: q.question_type,
      points: q.points,
      difficulty_score: this.difficultyToScore(q.metadata.difficulty_level),
      cognitive_level: q.metadata.bloom_taxonomy,
      tags: q.metadata.tags,
      learning_objectives: q.metadata.learning_objectives,
      estimated_time: q.metadata.estimated_time,
      metadata: q.metadata,
      lesson_id: options.lessonId, // Associate with the lesson
      created_by: options.userId,
    }));

    // Perform the insert operation
    const { data: insertedQuestions, error } = await this.supabase
      .from('questions')
      .insert(questionsToInsert)
      .select();

    if (error) {
      console.error('Error saving generated questions:', error);
      throw new Error(`Failed to save questions to database: ${error.message}`);
    }

    // Since we are not using folders, we just return the inserted questions.
    return insertedQuestions;
  }

  private difficultyToScore(difficulty: string): number {
    const scores = { easy: 3, medium: 5, hard: 8 };
    return scores[difficulty as keyof typeof scores] || 5;
  }

  // Helper methods for lesson-level question generation
  private buildLessonQuestionPrompt(options: {
    lessonId: string;
    lessonTitle: string;
    lessonContent: string;
    questionCount: number;
    difficultyLevels: string[];
    questionTypes: string[];
    bloomTaxonomyLevels: string[];
    learningObjectives: string[];
  }): string {
    return `
Generate ${options.questionCount} educational assessment questions based ONLY on the following lesson content.

LESSON INFORMATION:
Title: ${options.lessonTitle}
Content: ${options.lessonContent}

REQUIREMENTS:
- Question Types: ${options.questionTypes.join(', ')}
- Difficulty Levels: ${options.difficultyLevels.join(', ')}
- Bloom's Taxonomy Levels: ${options.bloomTaxonomyLevels.join(', ')}
- Learning Objectives: ${options.learningObjectives.join(', ')}

CRITICAL FORMATTING REQUIREMENTS:
1. Questions must be directly tied to the lesson content provided
2. Support mastery learning progression - build from basic to advanced concepts
3. Each question should assess specific learning objectives
4. Provide clear, unambiguous correct answers with proper validation data
5. Include explanations that reinforce learning
6. Ensure answers are formatted for easy student interaction and automated grading

QUESTION TYPE SPECIFICATIONS:

MULTIPLE CHOICE:
- Provide exactly 4 options (A, B, C, D)
- Only ONE option should be correct
- Options should be plausible but clearly distinguishable
- Avoid "all of the above" or "none of the above"
- correctAnswer should match exactly one of the options

TRUE/FALSE:
- Question should have a clear true or false answer
- correctAnswer should be exactly "true" or "false" (lowercase)
- Provide explanation for why the statement is true or false

SHORT ANSWER:
- Questions should have specific, measurable answers
- correctAnswer should be the expected response (can include multiple acceptable variations)
- Keep answers concise (1-3 sentences max)
- Provide clear grading criteria in explanation

ESSAY:
- Questions should require thoughtful analysis or synthesis
- correctAnswer should include key points that should be addressed
- Provide rubric-style guidance in explanation
- Include minimum word count expectations

FORMAT YOUR RESPONSE AS JSON:
[
  {
    "question": "Clear, specific question text here",
    "type": "multiple_choice|true_false|short_answer|essay",
    "difficulty": "easy|medium|hard",
    "bloomLevel": "remember|understand|apply|analyze|evaluate|create",
    "points": 1-5,
    "options": ["Option A", "Option B", "Option C", "Option D"], // Only for multiple_choice
    "correctAnswer": "Exact correct answer or key points for essay",
    "explanation": "Detailed explanation including why this is correct and learning reinforcement",
    "learningObjectives": ["specific objective from lesson"],
    "tags": ["lesson_concept", "topic_area"],
    "gradingCriteria": "Specific criteria for automated or manual grading", // For short_answer and essay
    "acceptableVariations": ["alternative correct answers"], // For short_answer
    "estimatedTime": 2-10 // minutes to complete
  }
]

QUALITY STANDARDS:
- Questions should be engaging and relevant to real-world applications
- Use clear, student-friendly language appropriate for the grade level
- Avoid trick questions or ambiguous wording
- Ensure cultural sensitivity and inclusivity
- Test understanding, not just memorization (except for remember-level questions)

Generate questions that create an intuitive, clean, premium learning experience for students.
`;
  }

  private parseLessonQuestions(aiResponse: string, options: {
    lessonId: string;
    lessonTitle: string;
    lessonContent: string;
    questionCount: number;
    difficultyLevels: string[];
    questionTypes: string[];
    bloomTaxonomyLevels: string[];
    learningObjectives: string[];
  }) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const questionsData = JSON.parse(jsonMatch[0]);
      
      return questionsData.map((q: any, index: number) => {
        // Validate and format the question based on type
        const questionType = q.type || 'multiple_choice';
        let formattedOptions = [];
        let correctAnswer = q.correctAnswer || '';

        // Format options for multiple choice questions
        if (questionType === 'multiple_choice' && q.options) {
          formattedOptions = q.options.map((opt: string, idx: number) => ({
            id: `option_${idx}`,
            text: opt,
            value: opt,
            isCorrect: opt === correctAnswer
          }));
        }

        // Validate true/false answers
        if (questionType === 'true_false') {
          correctAnswer = correctAnswer.toLowerCase() === 'true' ? 'true' : 'false';
        }

        return {
          question: q.question || '',
          type: questionType,
          difficulty: q.difficulty || 'medium',
          bloomLevel: q.bloomLevel || 'understand',
          points: q.points || 1,
          options: formattedOptions,
          correctAnswer,
          explanation: q.explanation || '',
          learningObjectives: q.learningObjectives || options.learningObjectives,
          tags: q.tags || [options.lessonTitle.toLowerCase().replace(/\s+/g, '_')],
          gradingCriteria: q.gradingCriteria || '',
          acceptableVariations: q.acceptableVariations || [],
          estimatedTime: q.estimatedTime || 3,
          metadata: {
            lessonId: options.lessonId,
            lessonTitle: options.lessonTitle,
            generatedAt: new Date().toISOString(),
            validated: true
          }
        };
      });
    } catch (error) {
      console.error('Error parsing lesson questions:', error);
      // Fallback: return a basic question structure
      return [{
        question: `Based on the lesson "${options.lessonTitle}", what is the main concept covered?`,
        type: 'short_answer',
        difficulty: 'medium',
        bloomLevel: 'understand',
        points: 1,
        options: [],
        correctAnswer: 'Answer based on lesson content',
        explanation: 'This question assesses understanding of the main lesson concepts',
        learningObjectives: options.learningObjectives,
        tags: [options.lessonTitle.toLowerCase().replace(/\s+/g, '_')],
        gradingCriteria: 'Answer should demonstrate understanding of the main lesson concepts',
        acceptableVariations: [],
        estimatedTime: 3,
        metadata: {
          lessonId: options.lessonId,
          lessonTitle: options.lessonTitle,
          generatedAt: new Date().toISOString(),
          validated: false,
          fallback: true
        }
      }];
    }
  }

  // Save lesson questions to the new lesson_questions table
  private async saveLessonQuestionsToDatabase(
    questions: any[], 
    options: {
      lessonId: string;
      lessonTitle: string;
      userId?: string;
      difficultyLevels: string[];
      questionTypes: string[];
      bloomTaxonomyLevels: string[];
      learningObjectives: string[];
    }
  ) {
    const savedQuestions = [];

    for (const question of questions) {
      // Insert question into lesson_questions table with enhanced metadata
      const { data: questionData, error: questionError } = await this.supabase
        .from('lesson_questions')
        .insert({
          lesson_id: options.lessonId,
          question_text: question.question,
          question_type: question.type,
          difficulty_level: question.difficulty,
          bloom_taxonomy_level: question.bloomLevel,
          points: question.points,
          correct_answer: question.correctAnswer,
          explanation: question.explanation,
          learning_objectives: question.learningObjectives,
          tags: question.tags,
          ai_generated: true,
          created_by: options.userId,
          estimated_time: question.estimatedTime,
          metadata: {
            generation_context: 'lesson_specific',
            lesson_title: options.lessonTitle,
            generation_timestamp: new Date().toISOString(),
            grading_criteria: question.gradingCriteria,
            acceptable_variations: question.acceptableVariations,
            validated: question.metadata?.validated || false,
            fallback: question.metadata?.fallback || false
          }
        })
        .select()
        .single();

      if (questionError) {
        console.error('Failed to save lesson question:', questionError);
        continue;
      }

      // Insert options for multiple choice questions with enhanced format
      if (question.type === 'multiple_choice' && question.options && questionData) {
        const optionsToInsert = question.options.map((opt: any, index: number) => ({
          question_id: questionData.id,
          option_text: opt.text || opt,
          is_correct: opt.isCorrect || (opt.text === question.correctAnswer) || (opt === question.correctAnswer),
          order_index: index,
          option_id: opt.id || `option_${index}`
        }));

        const { error: optionsError } = await this.supabase
          .from('lesson_question_options')
          .insert(optionsToInsert);

        if (optionsError) {
          console.error('Failed to save question options:', optionsError);
        }
      }

      savedQuestions.push({
        ...questionData,
        options: question.options,
        formattedForUI: true
      });
    }

    return savedQuestions;
  }
} 