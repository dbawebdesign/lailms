import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { Tables } from 'packages/types/db';

// Enhanced request schema with optional context fields
interface GenerateOutlineRequest {
  prompt: string;
  knowledgeBaseIds?: string[]; // IDs of knowledge bases to provide context
  templateBaseClassId?: string; // Optional ID of a base class to use as a template
  gradeLevel?: string; // Optional preferred grade level
  lengthInWeeks?: number; // Preferred course duration
}

// Define a structure for the course outline
interface CourseOutlineModule {
  title: string;
  topics: string[];
  suggestedLessons?: { title: string; objective?: string }[];
  suggestedAssessments?: { type: string; description?: string }[];
}

interface GeneratedCourseOutline {
  baseClassName?: string; // Suggested name for the BaseClass
  description?: string;
  subject?: string;
  gradeLevel?: string;
  lengthInWeeks?: number;
  modules: CourseOutlineModule[];
}

// Zod schema for validation
const courseOutlineModuleSchema = z.object({
  title: z.string(),
  topics: z.array(z.string()),
  suggestedLessons: z.array(
    z.object({
      title: z.string(),
      objective: z.string().optional()
    })
  ).optional(),
  suggestedAssessments: z.array(
    z.object({
      type: z.string(),
      description: z.string().optional()
    })
  ).optional()
});

const generatedCourseOutlineSchema = z.object({
  baseClassName: z.string().optional(),
  description: z.string().optional(),
  subject: z.string().optional(),
  gradeLevel: z.string().optional(),
  lengthInWeeks: z.number().optional(),
  modules: z.array(courseOutlineModuleSchema)
});

// Debug environment variables
console.log('Environment check:');
console.log('OPENAI_API_KEY defined:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY first 10 chars:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'undefined');
console.log('NODE_ENV:', process.env.NODE_ENV);

// Ensure OPENAI_API_KEY is available in environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error("WARNING: OPENAI_API_KEY environment variable is not set. API will use mock responses in development.");
}

// Sample mock response for development when API key is not available
const MOCK_COURSE_OUTLINE: GeneratedCourseOutline = {
  baseClassName: "Introduction to Web Development",
  description: "A comprehensive introduction to modern web development, covering HTML, CSS, and JavaScript fundamentals.",
  subject: "Computer Science",
  gradeLevel: "9-12",
  lengthInWeeks: 12,
  modules: [
    {
      title: "Module 1: HTML Fundamentals",
      topics: ["HTML Structure", "Elements & Tags", "Semantic HTML", "Forms & Inputs"],
      suggestedLessons: [
        { title: "Introduction to HTML", objective: "Understand the basic structure of HTML documents" },
        { title: "Semantic Elements", objective: "Learn to use the right elements for the right purpose" },
        { title: "Building Forms", objective: "Create interactive forms for user input" }
      ],
      suggestedAssessments: [
        { type: "Quiz", description: "HTML tags and their purposes" },
        { type: "Project", description: "Create a simple personal profile page using semantic HTML" }
      ]
    },
    {
      title: "Module 2: CSS Styling",
      topics: ["CSS Selectors", "Box Model", "Layout Techniques", "Responsive Design"],
      suggestedLessons: [
        { title: "CSS Basics", objective: "Apply styles to HTML elements" },
        { title: "Flexbox & Grid", objective: "Create flexible layouts" },
        { title: "Media Queries", objective: "Design responsive websites for different screen sizes" }
      ],
      suggestedAssessments: [
        { type: "Assignment", description: "Style the profile page created in Module 1" },
        { type: "Quiz", description: "CSS selectors and properties" }
      ]
    },
    {
      title: "Module 3: JavaScript Basics",
      topics: ["Variables & Data Types", "Functions", "Control Flow", "DOM Manipulation"],
      suggestedLessons: [
        { title: "JavaScript Syntax", objective: "Learn basic syntax and programming concepts" },
        { title: "Working with the DOM", objective: "Manipulate web page elements dynamically" },
        { title: "Event Handling", objective: "Respond to user interactions" }
      ],
      suggestedAssessments: [
        { type: "Project", description: "Create an interactive form validation" },
        { type: "Quiz", description: "JavaScript fundamentals" }
      ]
    }
  ]
};

// Create OpenAI client with explicit API key handling
let openai: OpenAI | null = null;
try {
  const apiKey = process.env.OPENAI_API_KEY || "";
  console.log('API Key length:', apiKey.length);
  
  if (apiKey.trim() === "") {
    console.error("OpenAI API key is empty string or only whitespace");
  } else {
    openai = new OpenAI({
      apiKey: apiKey,
    });
    console.log('OpenAI client initialized successfully');
  }
} catch (error) {
  console.error("Failed to initialize OpenAI client:", error);
  // Will handle this in the API route
}

// Enhanced system prompt with examples
const generateSystemPrompt = (request: GenerateOutlineRequest): string => {
  // Optimized prompt following GPT-4.1 best practices
  let prompt = `# Role and Objective
You are the Class Co-Pilot, an expert instructional designer AI. Your task is to generate a structured course outline based on the teacher's prompt.

# Instructions

## Output Requirements
- The output MUST be a valid JSON object adhering *exactly* to the provided TypeScript interface
- Return ONLY the JSON object, with no other text before or after it
- Ensure all required fields are populated with appropriate values

## TypeScript Interface
\`\`\`typescript
interface GeneratedCourseOutline {
  baseClassName?: string; // Suggested name for the course (e.g., "Introduction to Python")
  description?: string; // Brief description of the course
  subject?: string; // e.g., Mathematics, History, Computer Science
  gradeLevel?: string; // e.g., 9th Grade, 10-12
  lengthInWeeks?: number; // Estimated total weeks (e.g., 10, 16, 38)
  modules: Array<{ // Array of course modules/units
    title: string; // Title of the module (e.g., "Module 1: Basic Syntax")
    topics: string[]; // List of specific topics covered in this module
    suggestedLessons?: Array<{ title: string; objective?: string }>; // Optional suggested lesson titles and objectives
    suggestedAssessments?: Array<{ type: string; description?: string }>; // Optional suggested assessments (e.g., { type: "Quiz", description: "End of module quiz" })
  }>
}
\`\`\`

## Design Guidelines
1. **Content Analysis**: Analyze the teacher's prompt to extract key information like subject, grade level, duration, core topics, and desired outcomes
2. **Logical Progression**: Generate a logical sequence of modules, breaking down the subject matter appropriately
3. **Progressive Learning**: Ensure modules follow a progressive learning path, building on previous knowledge
4. **Grade-Appropriate Content**: Adjust difficulty and content depth based on grade level
5. **Comprehensive Structure**: Include 3-5 suggested lessons per module with clear learning objectives
6. **Assessment Integration**: Add a mix of assessments (quizzes, tests, projects, assignments) appropriate for the content
7. **Modern Pedagogy**: Focus on engaging, modern teaching approaches
8. **Reasonable Inference**: Infer reasonable values for fields if not explicitly stated in the prompt (e.g., suggest a course name)

# Reasoning Steps
1. First, analyze the teacher's prompt to identify the subject matter, target audience, and scope
2. Determine appropriate course metadata (name, description, subject, grade level, duration)
3. Break down the content into logical modules that build upon each other
4. For each module, identify 3-5 key topics that should be covered
5. Design suggested lessons with clear, measurable learning objectives
6. Plan appropriate assessments that align with the content and grade level
7. Ensure the overall structure supports effective learning progression`;

  // Add example if there's no template to follow
  if (!request.templateBaseClassId) {
    prompt += `

# Example Output
\`\`\`json
{
  "baseClassName": "Introduction to Web Development",
  "description": "A comprehensive introduction to modern web development, covering HTML, CSS, and JavaScript fundamentals.",
  "subject": "Computer Science",
  "gradeLevel": "9-12",
  "lengthInWeeks": 12,
  "modules": [
    {
      "title": "Module 1: HTML Fundamentals",
      "topics": ["HTML Structure", "Elements & Tags", "Semantic HTML", "Forms & Inputs"],
      "suggestedLessons": [
        { "title": "Introduction to HTML", "objective": "Understand the basic structure of HTML documents" },
        { "title": "Semantic Elements", "objective": "Learn to use the right elements for the right purpose" },
        { "title": "Building Forms", "objective": "Create interactive forms for user input" }
      ],
      "suggestedAssessments": [
        { "type": "Quiz", "description": "HTML tags and their purposes" },
        { "type": "Project", "description": "Create a simple personal profile page using semantic HTML" }
      ]
    },
    {
      "title": "Module 2: CSS Styling",
      "topics": ["CSS Selectors", "Box Model", "Layout Techniques", "Responsive Design"],
      "suggestedLessons": [
        { "title": "CSS Basics", "objective": "Apply styles to HTML elements" },
        { "title": "Flexbox & Grid", "objective": "Create flexible layouts" },
        { "title": "Media Queries", "objective": "Design responsive websites for different screen sizes" }
      ],
      "suggestedAssessments": [
        { "type": "Assignment", "description": "Style the profile page created in Module 1" },
        { "type": "Quiz", "description": "CSS selectors and properties" }
      ]
    }
  ]
}
\`\`\``;
  }

  // Add contextual requirements
  if (request.gradeLevel) {
    prompt += `

# Grade Level Requirements
Tailor this course specifically for ${request.gradeLevel} grade level students, with appropriate complexity and examples.`;
  }

  if (request.lengthInWeeks) {
    prompt += `

# Duration Requirements
The course should be designed to span approximately ${request.lengthInWeeks} weeks of instruction.`;
  }

  // Final output instruction
  prompt += `

# Final Output Format
Ensure the final output is ONLY the JSON object, with no other text before or after it.`;

  return prompt;
};

// Function to fetch template base class details
async function fetchTemplateBaseClass(supabase: any, templateId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('base_classes')
    .select('name, description, settings')
      .eq('id', templateId)
      .single();
    
  if (error) {
    console.error(`Error fetching template base class (${templateId}):`, error);
    return null;
  }
  return data;
}

export async function POST(request: Request) {
  try {
  const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Check if user has teacher role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single<Tables<"profiles">>();

    if (profileError || !profile || profile.role !== 'teacher') {
      return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { 
      prompt, 
      knowledgeBaseIds,
      templateBaseClassId,
      gradeLevel,
      lengthInWeeks
    }: GenerateOutlineRequest = await request.json();

    if (!prompt) {
      return new NextResponse(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let additionalContext = '';
    // --- Add context from template ---
    if (templateBaseClassId) {
      const templateData = await fetchTemplateBaseClass(supabase, templateBaseClassId);
      if (templateData) {
        additionalContext += `\n\n# Context from Template Course: "${templateData.name}"
## Description
${templateData.description || 'No description provided.'}
## Existing Outline (if available)
${JSON.stringify(templateData.settings?.generatedOutline, null, 2) || 'No existing outline.'}`;
      }
    }
    // TODO: If knowledgeBaseIds is provided, fetch knowledge base documents
    // This would require additional implementation for knowledge base integration

    // --- Call OpenAI API --- 
    if (!openai) {
      console.error("OpenAI client not initialized. Check API key.");
      // Return mock response if in development and no API key is available
      if (process.env.NODE_ENV === 'development') {
        console.log("Returning MOCK course outline due to missing OpenAI client.");
        return new NextResponse(JSON.stringify(MOCK_COURSE_OUTLINE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new NextResponse(JSON.stringify({ error: 'AI service not available' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log("Calling OpenAI API...");
    const systemPrompt = generateSystemPrompt({ prompt, templateBaseClassId, gradeLevel, lengthInWeeks });
    const userPrompt = `${prompt}${additionalContext}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000,
    });
    console.log("OpenAI API call successful.");

    const generatedContent = response.choices[0].message.content;

    if (!generatedContent) {
      throw new Error("Received empty content from OpenAI");
    }

    // --- Validate and return response ---
    try {
      const parsedOutline: GeneratedCourseOutline = JSON.parse(generatedContent);
      const validatedOutline = generatedCourseOutlineSchema.parse(parsedOutline);
      return NextResponse.json(validatedOutline);
    } catch (validationError) {
      console.error("Failed to validate OpenAI response:", validationError);
      console.error("Raw OpenAI Content:", generatedContent);
      throw new Error("AI generated an invalid outline structure");
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error in generate-course-outline API:', errorMessage);
    return new NextResponse(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 