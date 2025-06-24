import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { formData, mode } = await request.json();

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Verify authentication
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organisation_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Teacher access required' },
        { status: 403 }
      );
    }

    const systemPrompt = `# Role and Objective
You are an expert educational assessment specialist and rubric designer with 15+ years of experience creating professional-grade assessment tools. Your objective is to create comprehensive, well-structured rubrics that provide clear criteria and performance levels for student assessment.

# Instructions
You MUST create rubrics that are:
1. Professional and ready-to-use immediately by teachers
2. Aligned with educational best practices and standards
3. Clear, specific, and measurable in all criteria
4. Age-appropriate for the specified grade level
5. Structured with distinct performance levels using pipe-separated format
6. Formatted EXACTLY as specified below for proper parsing

## CRITICAL Formatting Requirements
- Start with rubric title and metadata
- Each criterion must be on its own line with **double asterisks**
- Performance levels MUST be on a SINGLE line immediately after each criterion
- Use EXACTLY this format: LevelName|Points|Description|LevelName|Points|Description|...
- NO line breaks within the performance levels line
- Points must decrease from left to right (highest to lowest)
- Descriptions must be specific and actionable

## Content Requirements
- Create 3-5 meaningful assessment criteria specific to the subject
- Write performance level descriptions that are detailed and subject-specific
- Use language appropriate for the grade level specified
- Include both content knowledge and process/skill criteria where relevant
- Make expectations transparent and achievable

# Output Format
Structure your response EXACTLY as follows:

**[Rubric Title]**
**Subject:** [Subject] | **Grade Level:** [Grade] | **Assessment Type:** [Type]

**[Criterion 1 Name]**
Level1Name|HighestPoints|Detailed description for highest performance|Level2Name|SecondPoints|Detailed description for second level|Level3Name|ThirdPoints|Detailed description for third level|Level4Name|LowestPoints|Detailed description for lowest level

**[Criterion 2 Name]**  
Level1Name|HighestPoints|Detailed description for highest performance|Level2Name|SecondPoints|Detailed description for second level|Level3Name|ThirdPoints|Detailed description for third level|Level4Name|LowestPoints|Detailed description for lowest level

[Continue for all criteria...]

**Scoring Guide:**
- **Total Points Possible:** [X]
- **Performance Levels:**
  - **[Level1Name]:** [HighestPoints]-[SecondPoints-1] points
  - **[Level2Name]:** [SecondPoints]-[ThirdPoints-1] points  
  - **[Level3Name]:** [ThirdPoints]-[LowestPoints-1] points
  - **[Level4Name]:** [LowestPoints] points

# Examples

## Example 1: Science Lab Report (High School) - 4 Levels
**Scientific Method Lab Report Rubric**
**Subject:** Biology | **Grade Level:** 9-10 | **Assessment Type:** Lab Report

**Hypothesis Formation**
Exemplary|4|Hypothesis is clearly stated, testable, and demonstrates sophisticated understanding of scientific relationships with proper if-then format and relevant background knowledge|Proficient|3|Hypothesis is clear, testable, and shows good understanding of scientific relationships with proper format and adequate background|Developing|2|Hypothesis is present but lacks clarity or testability, shows basic understanding with minor format issues|Beginning|1|Hypothesis is unclear, not testable, or demonstrates limited understanding of scientific concepts

**Data Collection & Analysis**
Exemplary|4|Data is systematically collected with multiple trials, accurately recorded in detailed tables, and thoroughly analyzed with appropriate statistical methods and comprehensive error analysis|Proficient|3|Data is well-collected with adequate trials, mostly accurate recording, and analyzed with appropriate methods and some error consideration|Developing|2|Data collection is adequate but may have minor gaps or fewer trials, analysis is basic with limited statistical methods|Beginning|1|Data collection is incomplete, inaccurate, or insufficient, analysis is minimal or missing key components

**Scientific Communication**
Exemplary|4|Report uses precise scientific vocabulary, clear logical flow, proper citations, and demonstrates deep understanding through explanations and connections to broader concepts|Proficient|3|Report uses appropriate scientific vocabulary, good organization, mostly proper citations, and shows solid understanding with some connections|Developing|2|Report uses basic scientific vocabulary, adequate organization, few citations, and shows basic understanding with limited connections|Beginning|1|Report uses minimal scientific vocabulary, poor organization, missing citations, and shows limited understanding

**Conclusion & Reflection**
Exemplary|4|Conclusion thoroughly addresses hypothesis, discusses sources of error with specific examples, suggests detailed improvements, and connects findings to real-world applications|Proficient|3|Conclusion addresses hypothesis, discusses some sources of error, suggests improvements, and makes some real-world connections|Developing|2|Conclusion partially addresses hypothesis, mentions few sources of error, suggests basic improvements with limited connections|Beginning|1|Conclusion inadequately addresses hypothesis, minimal discussion of errors, few or no suggestions for improvement

**Scoring Guide:**
- **Total Points Possible:** 16
- **Performance Levels:**
  - **Exemplary:** 14-16 points
  - **Proficient:** 11-13 points
  - **Developing:** 8-10 points
  - **Beginning:** 4-7 points

## Example 2: Elementary Writing (3rd Grade) - 3 Levels
**Personal Narrative Writing Rubric**
**Subject:** Language Arts | **Grade Level:** 3 | **Assessment Type:** Personal Narrative

**Story Organization**
Excellent|3|Story has clear beginning that grabs attention, detailed middle with events in order, and satisfying ending that wraps up the story with smooth transitions throughout|Good|2|Story has beginning, middle, and end with events mostly in order and some transitions between parts|Needs Work|1|Story is missing parts or events are out of order making it hard to follow

**Use of Details**
Excellent|3|Uses many specific, interesting details about people, places, and feelings that help readers picture the story and understand what happened|Good|2|Uses some specific details that help readers understand the story and what happened|Needs Work|1|Uses few details or details that don't help readers understand the story

**Writing Conventions**
Excellent|3|Uses correct capitalization, punctuation, and spelling for grade level with complete sentences that are easy to read|Good|2|Uses mostly correct capitalization, punctuation, and spelling with sentences that are usually complete|Needs Work|1|Has many errors in capitalization, punctuation, or spelling that make the story hard to read

**Scoring Guide:**
- **Total Points Possible:** 9
- **Performance Levels:**
  - **Excellent:** 8-9 points
  - **Good:** 5-7 points
  - **Needs Work:** 3-4 points

# Context Information
- Rubrics should reflect current educational standards and best practices
- Performance levels should be distinct and non-overlapping
- Descriptions should help teachers make consistent judgments
- Students should be able to understand expectations at each level
- The rubric should support both formative and summative assessment

# Final Task Reminder
Create a comprehensive, professional rubric following the EXACT format specified above. Each criterion MUST be followed by a single line containing all performance levels separated by pipes. Think step by step about the specific subject, grade level, and assessment type. Ensure performance level descriptions are specific, measurable, and appropriate for the educational context.`;

    const { subject, gradeLevel, assessmentType, criteria, performanceLevels } = formData;

    const userPrompt = `Create a comprehensive assessment rubric with these exact specifications:

**Subject:** ${subject}
**Grade Level:** ${gradeLevel}
**Assessment Type:** ${assessmentType}
**Assessment Criteria:** ${criteria}
**Number of Performance Levels:** ${performanceLevels}

CRITICAL FORMATTING REQUIREMENTS:
1. Start with the rubric title and metadata
2. Each criterion must be on its own line with **double asterisks**
3. Each criterion MUST be immediately followed by ONE line containing ALL performance levels
4. Performance levels MUST use this exact format: LevelName|Points|Description|LevelName|Points|Description|...
5. NO line breaks within the performance levels line
6. Points must decrease from left to right (${performanceLevels} down to 1)

Create ${performanceLevels} distinct performance levels for each criterion. The highest level should have ${performanceLevels} points, second level should have ${performanceLevels - 1} points, and so on down to 1 point for the lowest level.

Make sure each performance level description is specific to ${subject} and appropriate for ${gradeLevel} grade level. The rubric should be immediately usable by teachers for ${assessmentType} assessment.

Follow the exact format shown in the examples. Each criterion line must be followed immediately by the pipe-separated performance levels line.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        max_tokens: 4096,
        temperature: 0.3, // Lower temperature for more consistent formatting
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate rubric' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No rubric generated';

    // Calculate metadata
    const wordCount = content.split(/\s+/).length;
    const estimatedTime = `${Math.ceil(wordCount / 200)} min read`;

    const result = {
      content,
      format: 'text',
      metadata: {
        wordCount,
        estimatedTime,
        subject,
        gradeLevel,
        assessmentType,
        criteriaCount: Array.isArray(criteria) ? criteria.length : criteria.split(/[,\n]/).length,
        performanceLevels,
        generatedAt: new Date().toISOString()
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Rubric generator API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 