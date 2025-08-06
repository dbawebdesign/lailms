import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
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
  private supabase: any;

  constructor(supabaseClient?: any) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 3,
    });
    
    // If a supabase client is provided, use it; otherwise create service role client
    // This is critical for bypassing RLS in background jobs
    if (supabaseClient) {
      console.log(`🔧 AssessmentGenerationService: Using provided Supabase client`);
      this.supabase = supabaseClient;
    } else {
      console.log(`⚠️ AssessmentGenerationService: Creating service role client to bypass RLS`);
      
      // Create service role client to bypass RLS
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      if (serviceRoleKey && supabaseUrl) {
        const { createClient } = require('@supabase/supabase-js');
        this.supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
        console.log(`✅ AssessmentGenerationService: Created service role client`);
      } else {
        console.error(`❌ AssessmentGenerationService: Service role key not available, falling back to server client`);
        this.supabase = createSupabaseServerClient();
      }
    }
  }

  async generateAssessment(params: AssessmentGenerationParams): Promise<Assessment> {
    const { onProgress } = params;
    
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

  /**
   * Create a class exam by pulling questions from existing lesson and path assessments
   * This avoids content length issues and reuses already generated questions
   */
  async compileExamFromExistingQuestions(params: {
    baseClassId: string;
    assessmentTitle: string;
    assessmentDescription?: string;
    questionCount: number;
    timeLimit?: number;
    passingScore?: number;
    onProgress?: (message: string) => void;
  }): Promise<Assessment> {
    const { onProgress } = params;
    
    try {
      onProgress?.('Fetching existing assessment questions from lessons and paths...');
      
      // 1. Get all lesson and path assessments for this base class
      const { data: assessments, error: assessmentError } = await this.supabase
        .from('assessments')
        .select(`
          id,
          title,
          lesson_id,
          path_id,
          assessment_questions (
            id,
            question_text,
            question_type,
            options,
            correct_answer,
            answer_key,
            sample_response,
            grading_rubric,
            points,
            ai_grading_enabled
          )
        `)
        .eq('base_class_id', params.baseClassId)
        .or('lesson_id.not.is.null,path_id.not.is.null');
      
      if (assessmentError) {
        console.error('Error fetching assessments:', assessmentError);
        throw new Error(`Failed to fetch existing assessments: ${assessmentError.message}`);
      }
      
      if (!assessments || assessments.length === 0) {
        throw new Error('No existing assessments found to compile exam from');
      }
      
      onProgress?.(`Found ${assessments.length} existing assessments with questions`);
      
      // 2. Collect all questions and categorize by type
      const allQuestions: any[] = [];
      const questionsByType = new Map<string, any[]>();
      
      for (const assessment of assessments) {
        if (assessment.assessment_questions && Array.isArray(assessment.assessment_questions)) {
          for (const question of assessment.assessment_questions) {
            // Add source information to each question
            const enrichedQuestion = {
              ...question,
              source_assessment_id: assessment.id,
              source_scope: assessment.lesson_id ? 'lesson' : 'path',
              source_scope_id: assessment.lesson_id || assessment.path_id
            };
            
            allQuestions.push(enrichedQuestion);
            
            // Categorize by type
            const type = question.question_type || 'unknown';
            if (!questionsByType.has(type)) {
              questionsByType.set(type, []);
            }
            questionsByType.get(type)!.push(enrichedQuestion);
          }
        }
      }
      
      onProgress?.(`Collected ${allQuestions.length} total questions across ${questionsByType.size} types`);
      
      if (allQuestions.length === 0) {
        throw new Error('No questions found in existing assessments');
      }
      
      // 3. Select a diverse set of questions for the exam
      const selectedQuestions: any[] = [];
      const targetCount = Math.min(params.questionCount, allQuestions.length);
      
      // Try to get a balanced mix of question types
      const typesArray = Array.from(questionsByType.keys());
      const questionsPerType = Math.floor(targetCount / typesArray.length);
      const remainder = targetCount % typesArray.length;
      
      // First, select evenly from each type
      for (const [index, type] of typesArray.entries()) {
        const typeQuestions = questionsByType.get(type)!;
        const countForThisType = questionsPerType + (index < remainder ? 1 : 0);
        
        // Randomly select questions from this type
        const shuffled = [...typeQuestions].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(countForThisType, typeQuestions.length));
        selectedQuestions.push(...selected);
      }
      
      // If we need more questions, randomly select from all remaining
      if (selectedQuestions.length < targetCount) {
        const remaining = allQuestions.filter(q => !selectedQuestions.includes(q));
        const shuffled = [...remaining].sort(() => Math.random() - 0.5);
        const needed = targetCount - selectedQuestions.length;
        selectedQuestions.push(...shuffled.slice(0, needed));
      }
      
      // Shuffle the final selection for random ordering
      const finalQuestions = selectedQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, targetCount);
      
      onProgress?.(`Selected ${finalQuestions.length} diverse questions for the exam`);
      
      // 4. Create the exam assessment
      const { data: assessment, error: createError } = await this.supabase
        .from('assessments')
        .insert({
          base_class_id: params.baseClassId,
          assessment_type: 'class',  // Changed from 'scope' to 'assessment_type'
          title: params.assessmentTitle,
          description: params.assessmentDescription || `Comprehensive exam compiled from ${assessments.length} course assessments`,
          time_limit_minutes: params.timeLimit || 120,  // Changed from 'time_limit' to 'time_limit_minutes'
          passing_score_percentage: params.passingScore || 70,  // Changed from 'passing_score' to 'passing_score_percentage'
          randomize_questions: true,
          show_results_immediately: true,
          allow_review: true,
          ai_grading_enabled: true,
          ai_model: 'gpt-4.1-mini'
          // Removed non-existent columns: scope_id, is_active, total_points, question_count, metadata
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating exam assessment:', createError);
        throw new Error(`Failed to create exam assessment: ${createError.message}`);
      }
      
      onProgress?.(`Created exam assessment: ${assessment.id}`);
      
      // 5. Insert the selected questions
      const questionsToInsert = finalQuestions.map((q, index) => ({
        assessment_id: assessment.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        answer_key: q.answer_key,
        sample_response: q.sample_response,
        grading_rubric: q.grading_rubric,
        points: q.points || 1,
        order_index: index,
        required: true,
        ai_grading_enabled: q.ai_grading_enabled !== false,
        metadata: {
          source_assessment_id: q.source_assessment_id,
          source_scope: q.source_scope,
          source_scope_id: q.source_scope_id,
          original_question_id: q.id
        }
      }));
      
      const { error: insertError } = await this.supabase
        .from('assessment_questions')
        .insert(questionsToInsert);
      
      if (insertError) {
        console.error('Error inserting exam questions:', insertError);
        // Try to clean up the assessment
        await this.supabase
          .from('assessments')
          .delete()
          .eq('id', assessment.id);
        throw new Error(`Failed to insert exam questions: ${insertError.message}`);
      }
      
      onProgress?.(`Successfully compiled exam with ${finalQuestions.length} questions from existing assessments`);
      
      return assessment;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.(`Error compiling exam: ${errorMessage}`);
      throw error;
    }
  }

  private async getContentForScope(scope: 'lesson' | 'path' | 'class', scopeId: string): Promise<string> {
    let content = '';

    try {
      switch (scope) {
        case 'lesson':
          // Implement retry mechanism for lesson content fetching
          const MAX_RETRIES = 5;
          const RETRY_DELAY_MS = 3000; // 3 seconds between retries
          let lastError: Error | null = null;

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              console.log(`📖 Assessment Generation: Attempting to fetch content for lesson ${scopeId} (attempt ${attempt}/${MAX_RETRIES})`);
              
              // Debug: Check if we have the right Supabase client
              console.log(`🔍 Using Supabase client, checking lesson_sections for: ${scopeId}`);
              
              // First try lesson_sections table
              const { data: sections, error: sectionsError } = await this.supabase
                .from('lesson_sections')
                .select('title, content, section_type')
                .eq('lesson_id', scopeId)
                .order('order_index') as any;

              // Log query results for debugging
              console.log(`📊 Query result - sections:`, sections ? `${sections.length} found` : 'null', `error:`, sectionsError ? 'yes' : 'no');
              
              if (sectionsError) {
                console.error(`❌ Attempt ${attempt}: Database error fetching lesson sections for ${scopeId}:`, sectionsError);
                console.error(`❌ Error details:`, JSON.stringify(sectionsError));
                lastError = sectionsError;
              } else if (sections && sections.length > 0) {
                console.log(`✅ Found ${sections.length} sections for lesson ${scopeId}`);
                // Content found in lesson_sections - extract text from JSONB structure
                content = sections.map((section: any) => {
                  let sectionText = section.title || '';
                  
                  // Handle JSONB content structure
                  if (section.content) {
                    if (typeof section.content === 'string') {
                      // If content is a plain string
                      sectionText += '\n' + section.content;
                    } else if (typeof section.content === 'object') {
                      // Extract text from the JSONB structure
                      const contentObj = section.content;
                      
                      // Common fields in the lesson content structure
                      const textFields = [
                        'introduction',
                        'sectionTitle',
                        'conceptIntroduction',
                        'detailedExplanation',
                        'expertSummary',
                        'bridgeToNext'
                      ];
                      
                      // Extract main text fields
                      textFields.forEach(field => {
                        if (contentObj[field]) {
                          sectionText += '\n' + contentObj[field];
                        }
                      });
                      
                      // Extract expert teaching content if present
                      if (contentObj.expertTeachingContent) {
                        const etc = contentObj.expertTeachingContent;
                        
                        // Expert insights
                        if (Array.isArray(etc.expertInsights)) {
                          sectionText += '\n\nExpert Insights:\n' + etc.expertInsights.join('\n');
                        }
                        
                        // Practical examples
                        if (Array.isArray(etc.practicalExamples)) {
                          etc.practicalExamples.forEach((example: any) => {
                            if (example.title) sectionText += '\n\n' + example.title;
                            if (example.context) sectionText += '\n' + example.context;
                            if (example.walkthrough) sectionText += '\n' + example.walkthrough;
                            if (Array.isArray(example.keyTakeaways)) {
                              sectionText += '\nKey Takeaways:\n' + example.keyTakeaways.join('\n');
                            }
                          });
                        }
                      }
                      
                      // Extract check for understanding questions
                      if (Array.isArray(contentObj.checkForUnderstanding)) {
                        sectionText += '\n\nCheck for Understanding:\n' + contentObj.checkForUnderstanding.join('\n');
                      }
                      
                      // Extract common misconceptions
                      if (Array.isArray(contentObj.commonMisconceptions)) {
                        contentObj.commonMisconceptions.forEach((misc: any) => {
                          if (misc.misconception) sectionText += '\n\nCommon Misconception: ' + misc.misconception;
                          if (misc.correction) sectionText += '\nCorrection: ' + misc.correction;
                        });
                      }
                      
                      // Extract real world connections
                      if (Array.isArray(contentObj.realWorldConnections)) {
                        sectionText += '\n\nReal World Connections:\n' + contentObj.realWorldConnections.join('\n');
                      }
                    }
                  }
                  
                  return sectionText;
                }).join('\n\n---\n\n');
                
                if (content.trim().length > 0) {
                  console.log(`✅ Successfully retrieved content from lesson_sections for ${scopeId} (${content.length} characters)`);
                  return content;
                }
              }

              // If no sections or empty content, try generated_lesson_content table
              const { data: generatedContent, error: generatedError } = await this.supabase
                .from('generated_lesson_content')
                .select('content_type, generated_content')
                .eq('lesson_id', scopeId);

              if (!generatedError && generatedContent && generatedContent.length > 0) {
                content = generatedContent.map((item: any) => 
                  `${item.content_type}\n${JSON.stringify(item.generated_content)}`
                ).join('\n\n---\n\n');
                
                if (content.trim().length > 0) {
                  console.log(`✅ Successfully retrieved content from generated_lesson_content for ${scopeId} (${content.length} characters)`);
                  return content;
                }
              }

              // If still no content and this is not the last attempt, wait and retry
              if (attempt < MAX_RETRIES) {
                console.log(`⏳ No content found for lesson ${scopeId} yet. Waiting ${RETRY_DELAY_MS}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                continue;
              }

              // On final attempt, try lesson basic info as last resort
              const { data: lessonBasic, error: basicError } = await this.supabase
                .from('lessons')
                .select('title, description')
                .eq('id', scopeId)
                .single();

              if (!basicError && lessonBasic) {
                content = `${lessonBasic.title}\n${lessonBasic.description || 'No description available'}`;
                console.warn(`⚠️ Assessment Generation: Using basic lesson info for ${scopeId} - sections may not be generated yet`);
                return content;
              }
              
              // If we get here, no content was found after all retries
              throw new Error(`Could not retrieve content for lesson ${scopeId} after ${MAX_RETRIES} attempts`);
              
            } catch (error) {
              lastError = error as Error;
              
              if (attempt === MAX_RETRIES) {
                // Final attempt failed, throw the error
                throw lastError;
              }
              
              // Log the error and continue to next attempt
              console.warn(`⚠️ Attempt ${attempt} failed for lesson ${scopeId}:`, lastError.message);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            }
          }
          
          // Should not reach here, but throw error if we do
          throw lastError || new Error(`Could not retrieve content for lesson ${scopeId}`);
          break;

        case 'path':
          // Get all lessons in the path, then their sections
          const { data: pathLessons, error: pathError } = await this.supabase
            .from('lessons')
            .select(`
              title, description,
              lesson_sections(title, content, section_type)
            `)
            .eq('path_id', scopeId)
            .order('order_index') as any; // Complex query with joins, using any cast

          if (pathError) throw pathError;

          content = pathLessons?.map((lesson: any) => {
            const sectionContent = lesson.lesson_sections?.map((section: any) => {
              let sectionText = section.title || '';
              
              // Handle JSONB content structure
              if (section.content) {
                if (typeof section.content === 'string') {
                  sectionText += '\n' + section.content;
                } else if (typeof section.content === 'object') {
                  // Extract key text fields from JSONB
                  const contentObj = section.content;
                  const mainFields = ['introduction', 'conceptIntroduction', 'detailedExplanation', 'expertSummary'];
                  
                  mainFields.forEach(field => {
                    if (contentObj[field]) {
                      sectionText += '\n' + contentObj[field];
                    }
                  });
                  
                  // Add expert insights if available
                  if (contentObj.expertTeachingContent?.expertInsights) {
                    sectionText += '\n' + contentObj.expertTeachingContent.expertInsights.join('\n');
                  }
                }
              }
              
              return sectionText;
            }).join('\n\n') || '';
            return `Lesson: ${lesson.title}\n${lesson.description}\n\n${sectionContent}`;
          }).join('\n\n---\n\n') || '';
          break;

        case 'class':
          // Get all content from the base class
          const { data: classPaths, error: classError } = await this.supabase
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
              const sectionContent = lesson.lesson_sections?.map((section: any) => {
                let sectionText = section.title || '';
                
                // Handle JSONB content structure
                if (section.content) {
                  if (typeof section.content === 'string') {
                    sectionText += '\n' + section.content;
                  } else if (typeof section.content === 'object') {
                    // Extract key text fields from JSONB
                    const contentObj = section.content;
                    const mainFields = ['introduction', 'conceptIntroduction', 'detailedExplanation', 'expertSummary'];
                    
                    mainFields.forEach(field => {
                      if (contentObj[field]) {
                        sectionText += '\n' + contentObj[field];
                      }
                    });
                    
                    // Add expert insights if available
                    if (contentObj.expertTeachingContent?.expertInsights) {
                      sectionText += '\n' + contentObj.expertTeachingContent.expertInsights.join('\n');
                    }
                  }
                }
                
                return sectionText;
              }).join('\n\n') || '';
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
    // Truncate content if too long to prevent token overflow
    const maxContentLength = 50000; // ~12,500 tokens (4:1 ratio)
    let processedContent = content;
    if (content.length > maxContentLength) {
      console.warn(`⚠️ Content too long (${content.length} chars), truncating to ${maxContentLength} chars`);
      processedContent = content.substring(0, maxContentLength) + '\n\n[Content truncated for assessment generation]';
    }
    
    const prompt = this.buildQuestionGenerationPrompt(processedContent, count, questionTypes, difficulty);
    
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
          max_tokens: 20000, // Increased for class exams
        })
      );

      const messageContent = response.choices[0].message?.content;
      const finishReason = response.choices[0].finish_reason;
      
      if (!messageContent) {
        throw new Error('Empty response from GPT-4.1-mini');
      }
      
      // Check if response was truncated
      if (finishReason === 'length') {
        console.warn('⚠️ AI response was truncated due to token limit, questions may be incomplete');
      }

      const questions = this.parseQuestionsResponse(messageContent);
      onProgress?.(`Parsed ${questions.length} questions from AI response`);
      
      // Enhanced debugging for class exam failures
      if (questions.length === 0) {
        console.error('❌ No questions parsed from AI response');
        console.error('Raw AI response length:', messageContent.length);
        console.error('Raw AI response preview:', messageContent.substring(0, 500));
        console.error('Content length provided to AI:', content.length);
        console.error('Content preview:', content.substring(0, 200));
      }
      
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
      
      // Enhanced JSON repair for truncated responses
      if (!cleanedResponse.endsWith(']')) {
        console.warn('Response appears truncated, attempting comprehensive repair...');
        
        // Find the last complete question object
        let repairAttempts = [
          // Attempt 1: Find last complete object and close array
          () => {
            const lastCompleteObjectIndex = cleanedResponse.lastIndexOf('}');
            if (lastCompleteObjectIndex > 0) {
              return cleanedResponse.substring(0, lastCompleteObjectIndex + 1) + ']';
            }
            return null;
          },
          
          // Attempt 2: Find last complete question by looking for question_text
          () => {
            const questionMatches = [...cleanedResponse.matchAll(/"question_text":\s*"[^"]*"/g)];
            if (questionMatches.length > 0) {
              const lastQuestionStart = cleanedResponse.lastIndexOf('{', questionMatches[questionMatches.length - 1].index);
              if (lastQuestionStart > 0) {
                const beforeLastQuestion = cleanedResponse.substring(0, lastQuestionStart);
                const lastComma = beforeLastQuestion.lastIndexOf(',');
                if (lastComma > 0) {
                  return beforeLastQuestion.substring(0, lastComma) + ']';
                }
              }
            }
            return null;
          },
          
          // Attempt 3: Extract only complete questions by parsing incrementally
          () => {
            const questions = [];
            let currentPos = 0;
            const jsonStart = cleanedResponse.indexOf('[');
            if (jsonStart === -1) return null;
            
            currentPos = jsonStart + 1;
            let braceCount = 0;
            let inString = false;
            let currentQuestion = '';
            
            for (let i = currentPos; i < cleanedResponse.length; i++) {
              const char = cleanedResponse[i];
              
              if (char === '"' && cleanedResponse[i-1] !== '\\') {
                inString = !inString;
              }
              
              if (!inString) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
              }
              
              currentQuestion += char;
              
              if (!inString && braceCount === 0 && char === '}') {
                // Complete question found
                try {
                  const testJson = '[' + currentQuestion + ']';
                  const testParsed = JSON.parse(testJson);
                  if (testParsed.length > 0) {
                    questions.push(currentQuestion);
                  }
                } catch (e) {
                  // Skip malformed question
                }
                currentQuestion = '';
                
                // Skip comma if present
                if (cleanedResponse[i + 1] === ',') {
                  i++;
                }
              }
            }
            
            return questions.length > 0 ? '[' + questions.join(',') + ']' : null;
          }
        ];
        
        // Try repair attempts in order
        for (const attempt of repairAttempts) {
          try {
            const repairedJson = attempt();
            if (repairedJson) {
              const testParsed = JSON.parse(repairedJson);
              if (Array.isArray(testParsed) && testParsed.length > 0) {
                cleanedResponse = repairedJson;
                console.log(`✅ Successfully repaired JSON, recovered ${testParsed.length} questions`);
                break;
              }
            }
          } catch (e) {
            // Try next repair attempt
            continue;
          }
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

      const { data: assessment, error: assessmentError } = await this.supabase
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

      const { error: questionsError } = await this.supabase
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
    try {
      const { data: attempts, error } = await this.supabase
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
    try {
      // Get summary statistics
      const { data: attempts, error: attemptsError } = (await this.supabase
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
      const { data: responses, error: responsesError } = (await this.supabase
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