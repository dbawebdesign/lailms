/**
 * Utility to convert markdown text to Tiptap JSON format
 * This preserves formatting like headings, bold, italic, lists, etc.
 */

interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  attrs?: Record<string, any>;
  text?: string;
  marks?: Array<{
    type: string;
    attrs?: Record<string, any>;
  }>;
}

interface TiptapDocument {
  type: 'doc';
  content: TiptapNode[];
}

export function markdownToTiptap(markdown: string): TiptapDocument {
  const lines = markdown.split('\n');
  const content: TiptapNode[] = [];
  let currentParagraphContent: TiptapNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLanguage = '';

  const flushParagraph = () => {
    if (currentParagraphContent.length > 0) {
      content.push({
        type: 'paragraph',
        content: currentParagraphContent
      });
      currentParagraphContent = [];
    }
  };

  const flushCodeBlock = () => {
    if (codeBlockContent.length > 0) {
      content.push({
        type: 'codeBlock',
        attrs: codeBlockLanguage ? { language: codeBlockLanguage } : undefined,
        content: [{
          type: 'text',
          text: codeBlockContent.join('\n')
        }]
      });
      codeBlockContent = [];
      codeBlockLanguage = '';
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        // Start of code block
        flushParagraph();
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Handle headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineText(text)
      });
      continue;
    }

    // Handle bullet lists
    const bulletMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      const text = bulletMatch[1];
      
      // Check if we need to start a new list or continue existing one
      const lastItem = content[content.length - 1];
      if (lastItem && lastItem.type === 'bulletList') {
        lastItem.content!.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: parseInlineText(text)
          }]
        });
      } else {
        content.push({
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: parseInlineText(text)
            }]
          }]
        });
      }
      continue;
    }

    // Handle numbered lists
    const numberedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      const text = numberedMatch[1];
      
      // Check if we need to start a new list or continue existing one
      const lastItem = content[content.length - 1];
      if (lastItem && lastItem.type === 'orderedList') {
        lastItem.content!.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: parseInlineText(text)
          }]
        });
      } else {
        content.push({
          type: 'orderedList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: parseInlineText(text)
            }]
          }]
        });
      }
      continue;
    }

    // Handle blockquotes
    if (line.startsWith('> ')) {
      flushParagraph();
      const text = line.slice(2);
      content.push({
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: parseInlineText(text)
        }]
      });
      continue;
    }

    // Handle horizontal rules
    if (line.match(/^[-*_]{3,}$/)) {
      flushParagraph();
      content.push({
        type: 'horizontalRule'
      });
      continue;
    }

    // Handle empty lines
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    // Regular paragraph text
    if (line.trim()) {
      currentParagraphContent.push(...parseInlineText(line));
      if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
        // Add a space if next line is not empty
        currentParagraphContent.push({ type: 'text', text: ' ' });
      }
    }
  }

  // Flush any remaining content
  flushParagraph();
  if (inCodeBlock) {
    flushCodeBlock();
  }

  // Ensure we have at least one paragraph
  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: []
    });
  }

  return {
    type: 'doc',
    content
  };
}

function parseInlineText(text: string): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  let currentText = '';
  let i = 0;

  const flushText = () => {
    if (currentText) {
      nodes.push({ type: 'text', text: currentText });
      currentText = '';
    }
  };

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];
    const remaining = text.slice(i);

    // Handle code spans
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      flushText();
      nodes.push({
        type: 'text',
        text: codeMatch[1],
        marks: [{ type: 'code' }]
      });
      i += codeMatch[0].length;
      continue;
    }

    // Handle bold (**text** or __text__)
    const boldMatch = remaining.match(/^(\*\*|__)([^*_]+)\1/);
    if (boldMatch) {
      flushText();
      nodes.push({
        type: 'text',
        text: boldMatch[2],
        marks: [{ type: 'bold' }]
      });
      i += boldMatch[0].length;
      continue;
    }

    // Handle italic (*text* or _text_)
    const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/);
    if (italicMatch) {
      flushText();
      nodes.push({
        type: 'text',
        text: italicMatch[2],
        marks: [{ type: 'italic' }]
      });
      i += italicMatch[0].length;
      continue;
    }

    // Handle links [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      flushText();
      nodes.push({
        type: 'text',
        text: linkMatch[1],
        marks: [{ 
          type: 'link', 
          attrs: { href: linkMatch[2] }
        }]
      });
      i += linkMatch[0].length;
      continue;
    }

    // Regular character
    currentText += char;
    i++;
  }

  flushText();

  // If no nodes were created, add empty text node
  if (nodes.length === 0) {
    nodes.push({ type: 'text', text: '' });
  }

  return nodes;
}