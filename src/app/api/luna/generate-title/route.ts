import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

export async function POST(request: NextRequest) {
  if (!openaiClient) {
    console.error("[Luna Title Generation API] OpenAI client is not initialized. Check API key.");
    return NextResponse.json(
      { error: "OpenAI client is not initialized. Administrator, please check the server logs and API key configuration." },
      { status: 500 }
    );
  }

  let requestBody: any;
  
  try {
    // Parse the request body
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error('Error parsing request JSON:', error);
      return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 });
    }
    
    const { messages, conversationId } = requestBody;

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
    }

    // Filter to get meaningful content (skip system messages, loading messages, etc.)
    const meaningfulMessages = messages
      .filter((msg: any) => 
        msg.content && 
        msg.content.trim() && 
        !msg.isLoading &&
        (msg.role === 'user' || msg.role === 'assistant')
      )
      .slice(0, 8); // Use first 8 meaningful messages for context

    if (meaningfulMessages.length === 0) {
      return NextResponse.json({ error: 'No meaningful messages found' }, { status: 400 });
    }

    // Create a conversation summary for title generation
    const conversationContext = meaningfulMessages
      .map((msg: any) => `${msg.role === 'user' ? 'Student' : 'Luna'}: ${msg.content}`)
      .join('\n\n');

    console.log('[Luna Title Generation API] Generating title for conversation:', conversationId);
    
    // Generate title using AI
    const titleResponse = await openaiClient.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: `You are an expert at creating concise, descriptive conversation titles. 

Your task is to analyze the conversation and create a SHORT, SPECIFIC title that captures the main topic or purpose of the discussion.

RULES:
- Maximum 6 words
- Be specific and descriptive
- Focus on the main topic, subject, or goal
- Use title case (e.g., "Creating Math Quiz for Algebra")
- Avoid generic words like "Chat", "Conversation", "Discussion"
- If it's about creating something, start with "Creating" or "Building"
- If it's about learning/teaching a topic, use the subject name
- If it's about solving a problem, mention the problem type

GOOD EXAMPLES:
- "Creating Biology Assessment Questions"
- "Explaining Photosynthesis to Students"
- "Building Course Outline History"
- "Fixing Assignment Rubric Issues"
- "Grade 8 Math Problem Help"

BAD EXAMPLES:
- "Luna Chat Discussion"
- "Help with Teaching"
- "Student Questions"
- "Educational Content"

Respond with ONLY the title, nothing else.`
        },
        {
          role: "user",
          content: `Analyze this conversation and create a concise, specific title:\n\n${conversationContext}`
        }
      ],
      temperature: 0.3,
      max_tokens: 20
    });

    const generatedTitle = titleResponse.choices[0].message.content?.trim();
    
    if (!generatedTitle) {
      // Fallback to first message approach if AI fails
      const firstUserMessage = meaningfulMessages.find((msg: any) => msg.role === 'user');
      const fallbackTitle = firstUserMessage?.content?.split(' ').slice(0, 5).join(' ') + '...' || 'Conversation';
      
      return NextResponse.json({ 
        title: fallbackTitle,
        wasGenerated: false,
        fallback: true
      });
    }

    console.log('[Luna Title Generation API] Generated title:', generatedTitle);

    return NextResponse.json({ 
      title: generatedTitle,
      wasGenerated: true,
      fallback: false
    });

  } catch (error) {
    console.error('[Luna Title Generation API] Error generating title:', error);
    
    // Fallback to simple title generation
    const firstMessage = requestBody?.messages?.[0]?.content;
    const fallbackTitle = firstMessage ? 
      firstMessage.split(' ').slice(0, 5).join(' ') + '...' : 
      'Conversation';
    
    return NextResponse.json({ 
      title: fallbackTitle,
      wasGenerated: false,
      fallback: true,
      error: 'AI title generation failed, using fallback'
    });
  }
} 