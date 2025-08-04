import { CourseModule, CourseGenerationRequest } from './course-generator';

/**
 * Optimized content generation that reduces AI API calls from 100+ to ~10
 * by generating entire modules at once
 */
export async function generateModuleContentOptimized(
  module: CourseModule,
  request: CourseGenerationRequest,
  getAcademicGuidance: (level?: string) => string,
  getDetailGuidance: (level?: string) => string,
  openai: any
): Promise<any> {
  const prompt = `
Generate comprehensive educational content for an ENTIRE MODULE with all lessons and sections.

MODULE: ${module.title}
Description: ${module.description}
Academic Level: ${request.academicLevel}
Detail Level: ${request.lessonDetailLevel}

LESSONS TO GENERATE:
${module.lessons.map((l, i) => `
Lesson ${i + 1}: ${l.title}
- Description: ${l.description}
- Sections: ${l.contentOutline.join(', ')}
- Duration: ${l.estimatedDurationHours} hours
`).join('\n')}

${getAcademicGuidance(request.academicLevel)}
${getDetailGuidance(request.lessonDetailLevel)}

Generate complete educational content as JSON:
{
  "moduleTitle": "${module.title}",
  "lessons": [
    {
      "lessonTitle": "Title",
      "sections": [
        {
          "sectionTitle": "Title",
          "introduction": "2-3 engaging sentences",
          "mainContent": [
            {
              "heading": "Key Concept",
              "content": "ACTUAL TEACHING CONTENT - Multiple paragraphs that thoroughly explain and teach the concept at ${request.academicLevel} level",
              "examples": ["Detailed example with full explanation", "Another detailed example"],
              "keyPoints": ["Important takeaway 1", "Important takeaway 2"],
              "commonMisconceptions": ["What students often get wrong", "Why they get it wrong"]
            }
          ],
          "activities": [
            {
              "type": "guided_practice",
              "title": "Activity Name",
              "instruction": "Step-by-step instructions",
              "duration": "15 minutes",
              "expectedOutcome": "What students should achieve"
            }
          ],
          "checkForUnderstanding": [
            "Question to verify comprehension",
            "Another check question"
          ],
          "keyTakeaways": ["Main learning point", "Secondary point"]
        }
      ],
      "assessmentQuestions": [
        {
          "questionText": "Age-appropriate question testing understanding?",
          "questionType": "multiple_choice",
          "bloomLevel": "understand",
          "options": [
            { "text": "Option A", "correct": false, "explanation": "Why this is incorrect" },
            { "text": "Option B", "correct": true, "explanation": "Why this is correct" },
            { "text": "Option C", "correct": false, "explanation": "Why this is incorrect" },
            { "text": "Option D", "correct": false, "explanation": "Why this is incorrect" }
          ],
          "points": 10
        }
      ]
    }
  ],
  "moduleQuiz": {
    "title": "${module.title} Module Assessment",
    "timeLimit": 45,
    "questions": [
      {
        "questionText": "Comprehensive question covering multiple lessons?",
        "questionType": "multiple_choice",
        "bloomLevel": "analyze",
        "options": [
          { "text": "Option A", "correct": false },
          { "text": "Option B", "correct": true },
          { "text": "Option C", "correct": false },
          { "text": "Option D", "correct": false }
        ],
        "points": 20
      }
    ]
  }
}

CRITICAL: Generate REAL EDUCATIONAL CONTENT that teaches concepts thoroughly. Each section should have substantial content appropriate for ${request.academicLevel} learners with ${request.lessonDetailLevel} depth.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You are an expert educator creating comprehensive teaching materials. Generate detailed, engaging content that helps students learn and master concepts."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 16000 // Optimized for efficient module content generation
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Failed to generate module content');

  const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, content];
  return JSON.parse(jsonMatch[1]);
}

/**
 * Process all modules with controlled concurrency
 */
export async function generateAllModulesOptimized(
  modules: CourseModule[],
  request: CourseGenerationRequest,
  getAcademicGuidance: (level?: string) => string,
  getDetailGuidance: (level?: string) => string,
  openai: any,
  onProgress?: (current: number, total: number) => void
): Promise<any[]> {
  const batchSize = 2; // Process 2 modules at a time
  const results = [];

  for (let i = 0; i < modules.length; i += batchSize) {
    const batch = modules.slice(i, i + batchSize);
    const batchPromises = batch.map(module => 
      generateModuleContentOptimized(
        module, 
        request, 
        getAcademicGuidance,
        getDetailGuidance,
        openai
      )
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    if (onProgress) {
      onProgress(Math.min(i + batchSize, modules.length), modules.length);
    }
  }

  return results;
}

/**
 * Performance metrics for different course sizes
 */
export const PERFORMANCE_ESTIMATES = {
  small: { // 1-2 modules, 5-10 lessons
    apiCalls: 4,
    estimatedTime: '1-2 minutes'
  },
  medium: { // 3-4 modules, 15-20 lessons  
    apiCalls: 8,
    estimatedTime: '2-3 minutes'
  },
  large: { // 5-8 modules, 25-40 lessons
    apiCalls: 16,
    estimatedTime: '5-8 minutes'
  },
  comprehensive: { // 10+ modules, 50+ lessons
    apiCalls: 25,
    estimatedTime: '10-15 minutes'
  }
}; 