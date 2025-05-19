import React, { useState, useEffect, useCallback } from 'react';
import { StudioBaseClass } from '@/types/lesson'; // Assuming this is the correct path
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress'; // Import Progress component

// NEW: Import for the Knowledge Base Manager
import BaseClassKnowledgeBaseManager from './BaseClassKnowledgeBaseManager';

interface BaseClassEditorProps {
  baseClass: StudioBaseClass;
  onSave: (updatedBaseClass: Partial<StudioBaseClass>) => Promise<void>;
  // onRefreshData?: () => void; // Optional callback to refresh studio data after generation
}

interface LessonProgressDetail {
  lessonId: string;
  lessonTitle: string;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

// Define a type for the summary message style
type SummaryMessageType = 'success' | 'warning' | 'error' | 'info';

// NEW: Type for the active tab
type ActiveTab = 'details' | 'knowledgeBase';

const BaseClassEditor: React.FC<BaseClassEditorProps> = ({ baseClass, onSave }) => {
  const [name, setName] = useState(baseClass.name);
  const [description, setDescription] = useState(baseClass.description || '');
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  
  // State for streaming progress
  const [generationProgress, setGenerationProgress] = useState(0); // Percentage 0-100
  const [totalToProcessForStream, setTotalToProcessForStream] = useState(0);
  const [processedSoFarForStream, setProcessedSoFarForStream] = useState(0);
  const [progressDetailsForStream, setProgressDetailsForStream] = useState<LessonProgressDetail[]>([]);
  const [currentGeneratingMessage, setCurrentGeneratingMessage] = useState<string | null>(null);
  
  // Updated state for final summary to include its type
  const [finalSummary, setFinalSummary] = useState<{ message: string; type: SummaryMessageType } | null>(null);

  // NEW: State for active tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('details');

  useEffect(() => {
    setName(baseClass.name);
    setDescription(baseClass.description || '');
    // Update other fields when baseClass prop changes
  }, [baseClass]);

  const handleSave = async () => {
    const updatedData: Partial<StudioBaseClass> = {
      id: baseClass.id,
      name,
      description,
      // Include other updated fields
    };
    await onSave(updatedData);
  };

  const resetGenerationState = () => {
    // Keep isGeneratingContent true if process is ongoing, only reset if it's a fresh start
    // setIsGeneratingContent(false); 
    setGenerationProgress(0);
    setTotalToProcessForStream(0);
    setProcessedSoFarForStream(0);
    setProgressDetailsForStream([]);
    setCurrentGeneratingMessage(null);
    setFinalSummary(null); // Reset final summary as well
  };

  const handleCreateAllLessonContent = async () => {
    if (!baseClass || !baseClass.id) {
      setFinalSummary({ message: 'Error: Base class ID is missing.', type: 'error' });
      return;
    }
    
    // Reset parts of state for a new generation attempt
    resetGenerationState(); 
    setIsGeneratingContent(true); // Set loading true explicitly here
    setFinalSummary(null); 
    setCurrentGeneratingMessage('Initializing content generation process...');

    try {
      const response = await fetch(`/api/teach/base-classes/${baseClass.id}/generate-all-lessons-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ error: 'Failed to start generation process and parse error.' }));
        throw new Error(errorResult.error || `Failed to start content generation (status: ${response.status})`);
      }

      if (!response.body) {
        throw new Error('Response body is null, cannot read stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamLoopActive = true;

      while (streamLoopActive) {
        const { done, value } = await reader.read();
        if (done) {
          setCurrentGeneratingMessage('Stream finished by server.');
          // If 'complete' event wasn't received but stream ended, set a generic completion/error.
          if (!finalSummary) { 
             setFinalSummary({ message: 'Generation process ended. Check details.', type: 'info' });
          }
          setIsGeneratingContent(false); // Generation process is fully done
          streamLoopActive = false;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (part.startsWith('data: ')) {
            const jsonData = part.substring(6);
            try {
              const eventData = JSON.parse(jsonData);

              if (eventData.type === 'start') {
                setTotalToProcessForStream(eventData.totalToProcess);
                setCurrentGeneratingMessage(`Preparing to process ${eventData.totalToProcess} lessons (skipped ${eventData.skipped} already existing).`);
                if (eventData.totalToProcess === 0 && eventData.skipped > 0) {
                    setFinalSummary({ 
                        message: `No new lessons to process. ${eventData.skipped} lessons already have content.`,
                        type: 'info' 
                    });
                    setIsGeneratingContent(false);
                } else if (eventData.totalToProcess === 0) {
                     setFinalSummary({ message: 'No lessons found to process or all were skipped.', type: 'info' });
                     setIsGeneratingContent(false);
                }
              } else if (eventData.type === 'progress') {
                // The backend now sends processedCount directly, which is what we should use.
                // The client should not try to infer processedSoFarForStream from currentLessonIndex for concurrent ops.
                const currentProcessedCount = eventData.processedCount || (eventData.currentLessonIndex ? eventData.currentLessonIndex + 1 : processedSoFarForStream +1 ) ;
                setProcessedSoFarForStream(currentProcessedCount);
                setGenerationProgress(totalToProcessForStream > 0 ? (currentProcessedCount / totalToProcessForStream) * 100 : 0);
                
                // setCurrentGeneratingMessage(`Processing lesson ${currentProcessedCount} of ${totalToProcessForStream}: ${eventData.lessonTitle}`);
                // For concurrent, a general message is better or a list of active ones. For now, just update progress bar.
                // The individual items in progressDetailsForStream will show status.
                setCurrentGeneratingMessage(`Processed ${currentProcessedCount} of ${totalToProcessForStream} lessons...`);
                
                setProgressDetailsForStream(prevDetails => {
                    const existingDetailIndex = prevDetails.findIndex(d => d.lessonId === eventData.lessonId);
                    const newDetailEntry: LessonProgressDetail = {
                        lessonId: eventData.lessonId,
                        lessonTitle: eventData.lessonTitle,
                        status: eventData.status,
                        error: eventData.error
                    };
                    if (existingDetailIndex !== -1) {
                        const updatedDetails = [...prevDetails];
                        updatedDetails[existingDetailIndex] = newDetailEntry;
                        return updatedDetails;
                    } else {
                        // If no existing entry, add. Could pre-populate from a 'start' event list if API sent it.
                        return [...prevDetails, newDetailEntry];
                    }
                });

              } else if (eventData.type === 'complete') {
                setCurrentGeneratingMessage('Generation process completed.');
                
                let messageType: SummaryMessageType = 'info';
                if (eventData.overallStatus === 'All successful' || eventData.overallStatus === 'All processed tasks successful') {
                  messageType = 'success';
                } else if (eventData.overallStatus === 'Completed with some failures') {
                  messageType = 'warning';
                } else if (eventData.overallStatus === 'All failed') {
                  messageType = 'error';
                }

                setFinalSummary({
                    message: `Status: ${eventData.overallStatus}. Successful: ${eventData.successfulCount}, Failed: ${eventData.failedCount}, Skipped: ${eventData.skippedCount}.`,
                    type: messageType
                });
                setGenerationProgress(100);
                setIsGeneratingContent(false); // Generation process is fully done
                reader.releaseLock(); 
                streamLoopActive = false; // Signal to exit outer while loop
                break; // Exit for...loop over parts
              }
            } catch (e) {
              console.error('Error parsing streamed JSON:', e, jsonData);
              setCurrentGeneratingMessage('Error processing generation updates from stream.');
            }
          }
        }
        buffer = parts[parts.length - 1];
      }

    } catch (error: any) {
      console.error('Error in handleCreateAllLessonContent (fetch setup or initial response error):', error);
      setFinalSummary({ message: `Error: ${error.message}`, type: 'error' });
      setIsGeneratingContent(false); 
    } 
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{baseClass.name}</CardTitle>
        {/* NEW: Tab Navigation */}
        <div className="mt-2 border-b border-border">
          <nav className="-mb-px flex space-x-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('details')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm 
                ${activeTab === 'details' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'}`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('knowledgeBase')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm 
                ${activeTab === 'knowledgeBase' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'}`}
            >
              Knowledge Base
            </button>
          </nav>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 mt-4">
        {/* NEW: Conditional rendering based on activeTab */}
        {activeTab === 'details' && (
          <>
            <div>
              <label htmlFor="baseClassName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name
              </label>
              <Input
                id="baseClassName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Base Class Name"
              />
            </div>
            <div>
              <label htmlFor="baseClassDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <Textarea
                id="baseClassDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Base Class Description"
                rows={4}
              />
            </div>
            {/* Add more form fields for other properties of StudioBaseClass */}
            {/* Example for subject:
            <div>
              <label htmlFor="baseClassSubject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Subject
              </label>
              <Input
                id="baseClassSubject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
              />
            </div>
            */}
            <div className="flex space-x-2">
              <Button onClick={handleSave} disabled={isGeneratingContent}>Save Changes</Button>
              <Button onClick={handleCreateAllLessonContent} disabled={isGeneratingContent}>
                {isGeneratingContent && totalToProcessForStream > 0 && processedSoFarForStream < totalToProcessForStream ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {`Generating (${processedSoFarForStream}/${totalToProcessForStream})`}
                  </>
                ) : isGeneratingContent ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {currentGeneratingMessage || 'Initializing...'}
                  </>
                ) : (
                  'Create all lesson content'
                )}
              </Button>
            </div>

            {(isGeneratingContent || finalSummary) && (
              <div className="mt-4 space-y-2">
                {currentGeneratingMessage && isGeneratingContent && <p className="text-sm text-muted-foreground">{currentGeneratingMessage}</p>}
                {isGeneratingContent && totalToProcessForStream > 0 && (
                  <Progress value={generationProgress} className="w-full" />
                )}
                {finalSummary && (
                  <p className={_getSummaryMessageStyle(finalSummary.type)}>
                    {finalSummary.message}
                  </p>
                )}
                {progressDetailsForStream.length > 0 && (
                  <div className="mt-2 p-2 border rounded-md max-h-60 overflow-y-auto text-xs">
                    <p className="font-medium mb-1">Progress Details:</p>
                    <ul>
                      {progressDetailsForStream.map((detail) => (
                        <li key={detail.lessonId} className={`mb-0.5 p-1 rounded-sm ${detail.status === 'success' ? 'bg-green-100 text-green-800' : detail.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                          {detail.lessonTitle}: <span className="font-semibold">{detail.status}</span>
                          {detail.status === 'failed' && detail.error && <span className="block text-xs italic">Error: {detail.error}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'knowledgeBase' && (
          <div>
            <h3 className="text-lg font-medium mb-2">Manage Knowledge Base</h3>
            <p className="text-sm text-muted-foreground mb-4">
              View, upload, and delete documents associated with this base class.
            </p>
            <BaseClassKnowledgeBaseManager baseClassId={baseClass.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Helper function to get Tailwind classes based on summary type
const _getSummaryMessageStyle = (type: SummaryMessageType): string => {
  switch (type) {
    case 'success':
      return 'text-sm font-medium text-green-600 dark:text-green-500';
    case 'warning':
      return 'text-sm font-medium text-yellow-600 dark:text-yellow-500';
    case 'error':
      return 'text-sm font-medium text-red-600 dark:text-red-500';
    case 'info':
    default:
      return 'text-sm font-medium text-gray-700 dark:text-gray-300'; // Or use text-muted-foreground
  }
};

export default BaseClassEditor; 