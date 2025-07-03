import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { jsPDF } from 'jspdf';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lessonId } = await params;

    // Fetch lesson details
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        *,
        base_classes!inner(name, settings),
        paths!inner(title, description)
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Fetch lesson sections
    const { data: sections, error: sectionsError } = await supabase
      .from('lesson_sections')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('order_index');

    if (sectionsError) {
      return NextResponse.json({ error: 'Failed to fetch lesson sections' }, { status: 500 });
    }

    // Extract content from sections
    const sectionContent = sections?.map(section => ({
      title: section.title,
      content: (section.content as any)?.text || section.content || '',
      type: section.section_type
    })) || [];

    // Get grade level from base class settings
    const gradeLevel = (lesson.base_classes?.settings as any)?.gradeLevel || 'Middle School';

    // Check if outline already exists
    const lessonWithOutline = lesson as any;
    if (lessonWithOutline.teaching_outline_content) {
      // Generate PDF from existing content
      const pdfBuffer = await generatePDF(lessonWithOutline.teaching_outline_content, lesson.title);
      
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="teaching-outline-${lesson.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf"`,
        },
      });
    }

    // Generate new teaching outline using AI
    const teachingOutline = await generateTeachingOutline({
      lessonTitle: lesson.title,
      lessonDescription: lesson.description || '',
      sections: sectionContent,
      gradeLevel,
      className: lesson.base_classes?.name || 'Class',
      pathTitle: lesson.paths?.title || '',
      estimatedTime: lesson.estimated_time || 45
    });

    // Save the generated outline to the database
    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        teaching_outline_content: teachingOutline,
        teaching_outline_generated_at: new Date().toISOString()
      } as any)
      .eq('id', lessonId);

    if (updateError) {
      console.error('Error saving teaching outline:', updateError);
      // Continue anyway - we can still return the PDF
    }

    // Generate PDF
    const pdfBuffer = await generatePDF(teachingOutline, lesson.title);

    // Return the PDF as a downloadable response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="teaching-outline-${lesson.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating teaching outline:', error);
    return NextResponse.json({ error: 'Failed to generate teaching outline' }, { status: 500 });
  }
}

interface TeachingOutlineData {
  lessonTitle: string;
  lessonDescription: string;
  sections: Array<{
    title: string;
    content: string;
    type: string;
  }>;
  gradeLevel: string;
  className: string;
  pathTitle: string;
  estimatedTime: number;
}

async function generateTeachingOutline(data: TeachingOutlineData) {
  const prompt = `<role>
You are an experienced classroom teacher creating a practical teaching outline for in-person instruction. Your goal is to create a reference document that a teacher can use while actively teaching the lesson.
</role>

<context>
Lesson: ${data.lessonTitle}
Subject: ${data.className}
Grade Level: ${data.gradeLevel}
Duration: ${data.estimatedTime} minutes
Description: ${data.lessonDescription}

Lesson Content:
${data.sections.map((section, index) => `
Section ${index + 1}: ${section.title} (${section.type})
${section.content}
`).join('\n')}
</context>

<task>
Create a structured teaching outline that includes the actual lesson content organized for classroom delivery. The outline should serve as lecture notes the teacher can reference while teaching.

Requirements:
1. Extract and organize the key educational content from the lesson sections
2. Present content in logical teaching sequence
3. Include specific talking points, examples, and explanations
4. Provide clear timing and pacing guidance
5. Focus on practical classroom implementation
</task>

<format>
Use this exact structure:

## LESSON OVERVIEW
**Learning Objectives:**
- [Specific, measurable objective 1]
- [Specific, measurable objective 2]
- [Specific, measurable objective 3]

**Key Concepts:**
- [Main concept 1]
- [Main concept 2]
- [Main concept 3]

**Materials Needed:**
- [Essential material 1]
- [Essential material 2]

## OPENING (5 minutes)
**Hook/Attention Grabber:**
[Specific opening question or activity based on lesson content]

**Today's Learning:**
[Brief preview of what students will learn today]

## MAIN CONTENT DELIVERY

### Topic 1: [Specific topic name] (X minutes)
**Key Points to Teach:**
- [Actual content point from lesson]
- [Actual content point from lesson]
- [Actual content point from lesson]

**How to Explain:**
[Specific teaching approach or analogy]

**Examples to Use:**
[Concrete examples from the lesson content]

**Check Understanding:**
[Quick question or activity to verify comprehension]

### Topic 2: [Specific topic name] (X minutes)
**Key Points to Teach:**
- [Actual content point from lesson]
- [Actual content point from lesson]

**How to Explain:**
[Specific teaching approach or analogy]

**Examples to Use:**
[Concrete examples from the lesson content]

**Check Understanding:**
[Quick question or activity to verify comprehension]

[Continue for all major content areas]

## STUDENT PRACTICE (X minutes)
**Activity:**
[Specific practice activity based on lesson content]

**Instructions for Students:**
[Clear directions for the activity]

**Teacher's Role:**
[How to facilitate and support students]

## WRAP-UP (5 minutes)
**Key Takeaways:**
- [Main point 1]
- [Main point 2]
- [Main point 3]

**Exit Assessment:**
[Quick question to check learning]

**Next Lesson Connection:**
[Brief preview of upcoming content]

## TEACHING NOTES
**Timing Reminders:**
- [Pacing note 1]
- [Pacing note 2]

**Common Student Challenges:**
- [Challenge 1 and how to address]
- [Challenge 2 and how to address]

**Differentiation Tips:**
- [Tip for advanced learners]
- [Tip for struggling learners]
</format>

<instructions>
1. Extract the actual educational content from the lesson sections provided
2. Organize content into a logical teaching sequence
3. Include specific facts, concepts, and information the teacher should present
4. Provide concrete examples and explanations from the lesson material
5. Make timing realistic for a ${data.estimatedTime}-minute lesson
6. Ensure the teacher can use this as their primary reference while teaching
7. Focus on practical classroom delivery rather than theoretical pedagogy
</instructions>`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    max_tokens: 4000,
    temperature: 0.7,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  return response.choices[0]?.message?.content || '';
}

async function generatePDF(content: string, lessonTitle: string): Promise<Buffer> {
  const doc = new jsPDF();
  
  // Document setup
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;
  
  // Header with lesson title
  doc.setFillColor(41, 128, 185); // Professional blue
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Teaching Outline', margin, 15);
  
  doc.setFontSize(14);
  doc.text(lessonTitle, margin, 25);
  
  // Reset colors and position
  doc.setTextColor(0, 0, 0);
  yPosition = 50;
  
  // Process content
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we need a new page
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = margin;
    }
    
    // Main section headers (##)
    if (line.startsWith('## ')) {
      yPosition += 8; // Extra space before sections
      doc.setFillColor(240, 248, 255); // Light blue background
      doc.rect(margin - 5, yPosition - 8, contentWidth + 10, 12, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(41, 128, 185);
      doc.text(line.replace('## ', ''), margin, yPosition);
      yPosition += 15;
      doc.setTextColor(0, 0, 0);
    }
    // Sub-section headers (###)
    else if (line.startsWith('### ')) {
      yPosition += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(52, 73, 94);
      doc.text(line.replace('### ', ''), margin + 5, yPosition);
      yPosition += 10;
      doc.setTextColor(0, 0, 0);
    }
    // Bold text (**text**)
    else if (line.includes('**') && line.trim().length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const cleanText = line.replace(/\*\*/g, '');
      const wrappedLines = doc.splitTextToSize(cleanText, contentWidth - 10);
      doc.text(wrappedLines, margin + 5, yPosition);
      yPosition += wrappedLines.length * 6;
    }
    // Bullet points (-)
    else if (line.trim().startsWith('- ')) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const bulletText = line.replace(/^\s*- /, '');
      const wrappedLines = doc.splitTextToSize(`• ${bulletText}`, contentWidth - 15);
      doc.text(wrappedLines, margin + 10, yPosition);
      yPosition += wrappedLines.length * 5;
    }
    // Regular text
    else if (line.trim().length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const wrappedLines = doc.splitTextToSize(line.trim(), contentWidth - 5);
      doc.text(wrappedLines, margin + 5, yPosition);
      yPosition += wrappedLines.length * 5;
    }
    // Empty line
    else {
      yPosition += 3;
    }
  }
  
  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, pageHeight - 10);
  }
  
  // Convert to buffer
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
} 