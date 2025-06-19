import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

export class ContentExtractionService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createSupabaseServerClient();
  }

  async extractLessonContent(lessonId: string): Promise<string> {
    const { data: sections, error } = await this.supabase
      .from('sections')
      .select('content, section_type')
      .eq('lesson_id', lessonId)
      .order('order_index');
    
    if (error) {
      console.error(`Failed to fetch lesson sections for lesson ${lessonId}:`, error);
      throw new Error(`Failed to fetch lesson sections: ${error.message}`);
    }
    if (!sections || sections.length === 0) return '';
    
    let extractedContent = '';
    
    for (const section of sections) {
      const content = section.content as any; // Cast to any to access properties
      if (section.section_type === 'text_editor' && content?.text) {
        extractedContent += this.cleanTextContent(content.text) + '\n\n';
      } else if (section.section_type === 'code_block' && content?.code) {
        extractedContent += `Code example:\n${content.code}\n\n`;
      } else if (section.section_type === 'image' && content?.alt) {
        extractedContent += `Image: ${content.alt}\n\n`;
      }
    }
    
    return this.preprocessContent(extractedContent);
  }

  async extractPathContent(pathId: string): Promise<string> {
    const { data: lessons, error } = await this.supabase
      .from('lessons')
      .select('id, title')
      .eq('path_id', pathId)
      .order('order_index');
    
    if (error) {
      console.error(`Failed to fetch lessons for path ${pathId}:`, error);
      throw new Error(`Failed to fetch path lessons: ${error.message}`);
    }
    if (!lessons || lessons.length === 0) return '';
    
    let pathContent = '';
    const maxLessonsToInclude = Math.min(lessons.length, 10); // Limit to prevent token overflow
    
    for (let i = 0; i < maxLessonsToInclude; i++) {
      const lessonContent = await this.extractLessonContent(lessons[i].id);
      pathContent += `## ${lessons[i].title}\n${lessonContent}\n\n`;
    }
    
    return this.preprocessContent(pathContent);
  }
  
  async extractClassContent(baseClassId: string): Promise<string> {
    const { data: paths, error } = await this.supabase
      .from('paths')
      .select('id, title')
      .eq('base_class_id', baseClassId)
      .order('order_index');

    if (error) {
      console.error(`Failed to fetch paths for base class ${baseClassId}:`, error);
      throw new Error(`Failed to fetch class paths: ${error.message}`);
    }
    if (!paths || paths.length === 0) return '';

    let classContent = '';
    const maxPathsToInclude = Math.min(paths.length, 5); // Limit to 5 paths

    for (let i = 0; i < maxPathsToInclude; i++) {
      const pathContent = await this.extractPathContent(paths[i].id);
      classContent += `# Path: ${paths[i].title}\n\n${pathContent}\n\n`;
    }

    return this.preprocessContent(classContent);
  }
  
  private cleanTextContent(content: string): string {
    if (!content) return '';
    // Remove HTML tags, normalize whitespace, etc.
    return content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  private preprocessContent(content: string): string {
    if (!content) return '';
    // Truncate if too long (for API limits)
    const maxLength = 8000; // A reasonable limit to avoid excessive token usage
    if (content.length > maxLength) {
      return content.substring(0, maxLength) + '...';
    }
    return content;
  }
} 