import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { z } from 'zod';

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
  // Base prompt
  let prompt = `
You are the Class Co-Pilot, an expert instructional designer AI. Your task is to generate a structured course outline based on the teacher's prompt.

The output MUST be a valid JSON object adhering *exactly* to the following TypeScript interface:
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

Design Guidelines:
- Analyze the teacher's prompt to extract key information like subject, grade level, duration, core topics, and desired outcomes.
- Infer reasonable values for fields if not explicitly stated in the prompt (e.g., suggest a course name).
- Generate a logical sequence of modules, breaking down the subject matter appropriately.
- Ensure modules follow a progressive learning path, building on previous knowledge.
- Include 3-5 suggested lessons per module with clear learning objectives.
- Add a mix of assessments (quizzes, tests, projects, assignments) appropriate for the content.
- Adjust difficulty and content depth based on grade level.
- Focus on engaging, modern teaching approaches.
`;

  // Add example if there's no template to follow
  if (!request.templateBaseClassId) {
    prompt += `
Example Output:
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
\`\`\`
`;
  }

  // Add grade level context if provided
  if (request.gradeLevel) {
    prompt += `\nPlease tailor this course specifically for ${request.gradeLevel} grade level students, with appropriate complexity and examples.`;
  }

  // Add course length context if provided
  if (request.lengthInWeeks) {
    prompt += `\nThe course should be designed to span approximately ${request.lengthInWeeks} weeks of instruction.`;
  }

  // Final instructions
  prompt += `\nEnsure the final output is ONLY the JSON object, with no other text before or after it.`;

  return prompt;
};

// Function to fetch template base class details
async function fetchTemplateBaseClass(supabase: any, templateId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('base_classes')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to fetch template base class:', error);
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  let requestBody: GenerateOutlineRequest;

  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body. JSON expected.' }, { status: 400 });
  }

  const { prompt, knowledgeBaseIds, templateBaseClassId, gradeLevel, lengthInWeeks } = requestBody;

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return NextResponse.json({ error: 'Prompt is required and must be a non-empty string.' }, { status: 400 });
  }

  // Check if development mode and no API key
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useOpenAI = openai && process.env.OPENAI_API_KEY;

  // Handle case when OpenAI client is not available (more graceful error for development)
  if (!useOpenAI && !isDevelopment) {
    return NextResponse.json({ 
      error: 'OpenAI API key not configured on the server.',
      details: 'Please add OPENAI_API_KEY to your environment variables.'
    }, { status: 500 });
  }

  try {
    // Authenticate user (ensure they are a teacher/admin)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    
    // Add role check to ensure user is teacher/admin - using profiles table instead of members
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organisation_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('API Auth: Could not fetch user profile for generate-course-outline', profileError);
      return NextResponse.json({ error: 'User profile not found.' }, { status: 403 });
    }

    if (!['admin', 'teacher'].includes(profile.role)) {
      return NextResponse.json({ error: 'User does not have sufficient privileges (teacher or admin required).' }, { status: 403 });
    }

    // Use mock data in development with no API key
    if (isDevelopment && !useOpenAI) {
      console.log('DEVELOPMENT MODE: Using mock course outline data');
      
      // Add a slight delay to simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return the mock response
      const mockResponse = {...MOCK_COURSE_OUTLINE};
      
      // Customize the mock response based on prompt keywords
      if (prompt.toLowerCase().includes('math')) {
        mockResponse.baseClassName = "Mathematics Fundamentals";
        mockResponse.subject = "Mathematics";
      } else if (prompt.toLowerCase().includes('science')) {
        mockResponse.baseClassName = "Introduction to Science";
        mockResponse.subject = "Science";
      }
      
      // We passed Zod validation because our mock data conforms to the schema
      return NextResponse.json(mockResponse);
    }

    // Normal flow with OpenAI API
    // Gather additional context if provided
    let additionalContext = '';
    let templateBaseClass = null;

    // Fetch template base class details if provided
    if (templateBaseClassId) {
      templateBaseClass = await fetchTemplateBaseClass(supabase, templateBaseClassId);
      if (templateBaseClass) {
        additionalContext += `\nUse this existing base class as a template/inspiration: ${JSON.stringify(templateBaseClass)}`;
      }
    }

    // TODO: If knowledgeBaseIds is provided, fetch knowledge base documents
    // This would require additional implementation for knowledge base integration

    // --- Call OpenAI API --- 
    console.log('Generating course outline for prompt:', prompt);

    // Create a complete request with all context
    const requestWithContext: GenerateOutlineRequest = {
      prompt,
      knowledgeBaseIds,
      templateBaseClassId,
      gradeLevel,
      lengthInWeeks
    };

    const systemPrompt = generateSystemPrompt(requestWithContext);
    
    // Combine the user's prompt with any additional context
    const enhancedPrompt = `${prompt}${additionalContext ? '\n\nAdditional Context:' + additionalContext : ''}`;

    const completion = await openai!.chat.completions.create({
      model: "gpt-4.1-mini", // Use the specified model
      response_format: { type: "json_object" }, // Request JSON mode
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: enhancedPrompt }
      ],
      temperature: 0.7, // Add some creativity
      max_tokens: 4000, // Ensure we have enough tokens for detailed outlines
    });

    const jsonResponse = completion.choices[0]?.message?.content;

    if (!jsonResponse) {
      throw new Error('OpenAI response content was empty or missing.');
    }

    // Parse and validate the JSON response from OpenAI
    let generatedOutline: GeneratedCourseOutline;
    try {
      // Parse JSON response
      generatedOutline = JSON.parse(jsonResponse);
      
      // Validate against schema
      const validationResult = generatedCourseOutlineSchema.safeParse(generatedOutline);
      
      if (!validationResult.success) {
        console.error("JSON validation failed:", validationResult.error);
        throw new Error('Generated course outline does not match the expected structure.');
      }
      
      // Successfully validated
      generatedOutline = validationResult.data;
      
    } catch (parseError) {
      console.error("Failed to parse or validate OpenAI JSON response:", jsonResponse, parseError);
      throw new Error('Failed to parse or validate the generated course outline from AI response.');
    }
    
    console.log('Successfully generated outline:', generatedOutline);
    return NextResponse.json(generatedOutline);

  } catch (error: any) {
    console.error('Error in /api/teach/generate-course-outline:', error);
    // Distinguish OpenAI API errors from other errors if possible
    if (error instanceof OpenAI.APIError) {
        return NextResponse.json({ error: `OpenAI API Error: ${error.status} ${error.name}`, details: error.message }, { status: error.status || 500 });
    }
    return NextResponse.json({ error: 'Failed to generate course outline.', details: error.message }, { status: 500 });
  }
} 