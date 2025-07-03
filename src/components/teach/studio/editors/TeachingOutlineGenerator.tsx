import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Loader2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

interface TeachingOutlineGeneratorProps {
  lessonId: string;
  lessonTitle: string;
  lessonDescription?: string;
  gradeLevel?: string;
  estimatedTime?: number;
  hasExistingOutline?: boolean;
  outlineGeneratedAt?: string;
}

const TeachingOutlineGenerator: React.FC<TeachingOutlineGeneratorProps> = ({
  lessonId,
  lessonTitle,
  lessonDescription,
  gradeLevel,
  estimatedTime,
  hasExistingOutline = false,
  outlineGeneratedAt
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasOutline, setHasOutline] = useState(hasExistingOutline);
  const [generatedAt, setGeneratedAt] = useState(outlineGeneratedAt);

  const refreshOutlineStatus = async () => {
    try {
      const response = await fetch(`/api/teach/lessons/${lessonId}/teaching-outline-status`);
      if (response.ok) {
        const data = await response.json();
        setHasOutline(data.hasOutline);
        setGeneratedAt(data.generatedAt);
      }
    } catch (error) {
      console.error('Error checking outline status:', error);
    }
  };

  const handleGenerateOutline = async () => {
    setIsGenerating(true);
    
    try {
      const response = await fetch(`/api/teach/lessons/${lessonId}/generate-teaching-outline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate teaching outline');
      }

      // Create a blob from the response and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `teaching-outline-${lessonTitle.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Teaching outline generated and downloaded successfully!');
      
      // Update the component state to reflect the new outline
      await refreshOutlineStatus();
    } catch (error) {
      console.error('Error generating teaching outline:', error);
      toast.error('Failed to generate teaching outline. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (hasOutline) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Teaching Outline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="bg-green-100 rounded-full p-2">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-green-800 mb-1">
                  Teaching Outline Ready
                </h4>
                <p className="text-sm text-green-700 mb-3">
                  A comprehensive teaching outline has been generated for this lesson and is ready for download.
                  {generatedAt && (
                    <span className="block mt-1 text-xs">
                      Generated on {new Date(generatedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
                <Button 
                  onClick={handleGenerateOutline}
                  disabled={isGenerating}
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Teaching Outline
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-medium">Lesson Information:</h4>
            <div className="text-sm space-y-1">
              <p><strong>Title:</strong> {lessonTitle}</p>
              {lessonDescription && (
                <p><strong>Description:</strong> {lessonDescription}</p>
              )}
              {gradeLevel && (
                <p><strong>Grade Level:</strong> {gradeLevel}</p>
              )}
              {estimatedTime && (
                <p><strong>Estimated Time:</strong> {estimatedTime} minutes</p>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2 text-sm">Your Teaching Outline Includes:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Content-focused lecture notes</span>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Logical teaching sequence</span>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Key talking points</span>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Timing and pacing guides</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Teaching Outline Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>
            Generate a practical teaching outline for in-person classroom instruction.
            This AI-powered tool creates lecture notes based on your lesson content, including:
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Content-focused talking points from your lesson sections</li>
            <li>Logical teaching sequence and flow</li>
            <li>Key concepts and examples to present</li>
            <li>Timing guides and teaching reminders</li>
            <li>Student practice activities</li>
            <li>Assessment checkpoints</li>
          </ul>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h4 className="font-medium">Lesson Information:</h4>
          <div className="text-sm space-y-1">
            <p><strong>Title:</strong> {lessonTitle}</p>
            {lessonDescription && (
              <p><strong>Description:</strong> {lessonDescription}</p>
            )}
            {gradeLevel && (
              <p><strong>Grade Level:</strong> {gradeLevel}</p>
            )}
            {estimatedTime && (
              <p><strong>Estimated Time:</strong> {estimatedTime} minutes</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button 
            onClick={handleGenerateOutline}
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Outline...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate & Download Teaching Outline
              </>
            )}
          </Button>

          <div className="text-xs text-muted-foreground text-center">
            <p>
              The outline will be generated as a downloadable PDF with practical lecture notes
              based on your lesson content that you can use while teaching in person.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeachingOutlineGenerator; 