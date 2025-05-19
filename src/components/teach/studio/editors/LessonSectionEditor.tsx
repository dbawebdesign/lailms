import React, { useState, useEffect } from 'react';
import { LessonSection } from '@/types/lesson';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LessonSectionEditorProps {
  section: LessonSection;
  onSave: (updatedSection: Partial<LessonSection>) => Promise<void>;
}

const LessonSectionEditor: React.FC<LessonSectionEditorProps> = ({ section, onSave }) => {
  const [title, setTitle] = useState(section.title);
  // Assuming content is stored as JSON, but for this placeholder, we'll treat it as string
  const [content, setContent] = useState(typeof section.content === 'string' ? section.content : JSON.stringify(section.content, null, 2));
  const [sectionType, setSectionType] = useState(section.section_type || 'text');

  useEffect(() => {
    setTitle(section.title);
    setContent(typeof section.content === 'string' ? section.content : JSON.stringify(section.content, null, 2));
    setSectionType(section.section_type || 'text');
  }, [section]);

  const handleSave = async () => {
    let parsedContent = content;
    if (sectionType !== 'video_url') { // Or other types that are not JSON
        try {
            parsedContent = JSON.parse(content); // Try to parse if it's meant to be JSON
        } catch (error) {
            // If parsing fails, and it's not a plain text type, perhaps it should remain a string or handle error
            console.warn("Content is not valid JSON for type:", sectionType, error);
            // For now, we'll save it as a string if it's not valid JSON, 
            // but a more robust solution is needed based on section_type
        }
    }

    const updatedData: Partial<LessonSection> = {
      id: section.id,
      title,
      content: parsedContent,
      section_type: sectionType,
    };
    await onSave(updatedData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="sectionTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Section Title
          </label>
          <Input
            id="sectionTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Section Title"
          />
        </div>
        <div>
            <label htmlFor="sectionType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Section Type
            </label>
            <Select value={sectionType} onValueChange={setSectionType}>
                <SelectTrigger id="sectionType">
                    <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="text">Text Content (JSON)</SelectItem>
                    <SelectItem value="video_url">Video URL</SelectItem>
                    <SelectItem value="quiz">Quiz (JSON)</SelectItem>
                    <SelectItem value="document_embed">Document Embed</SelectItem>
                    {/* Add other section types as needed */}
                </SelectContent>
            </Select>
        </div>
        <div>
          <label htmlFor="sectionContent" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Content (JSON or Text based on Type)
          </label>
          <Textarea
            id="sectionContent"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter content (e.g., JSON for rich text, URL for video)"
            rows={10}
            className="font-mono text-sm"
          />
          {/* This will be replaced by Tiptap or another rich text editor later */}
        </div>
        <Button onClick={handleSave}>Save Section</Button>
      </CardContent>
    </Card>
  );
};

export default LessonSectionEditor; 