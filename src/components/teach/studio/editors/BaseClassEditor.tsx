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
// NEW: Import for the Mind Map Modal
import MindMapViewModal from './MindMapViewModal';

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

// REMOVED: Type for the active tab (no longer needed)
// type ActiveTab = 'details' | 'knowledgeBase';

const BaseClassEditor: React.FC<BaseClassEditorProps> = ({ baseClass, onSave }) => {
  const [name, setName] = useState(baseClass.name);
  const [description, setDescription] = useState(baseClass.description || '');
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState(false);
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);
  const [isCheckingContent, setIsCheckingContent] = useState(true);
  const [existingMindMap, setExistingMindMap] = useState<{ id: string; url: string } | null>(null);
  const [isCheckingMindMap, setIsCheckingMindMap] = useState(false);
  
  // NEW: State for mind map modal
  const [mindMapModalOpen, setMindMapModalOpen] = useState(false);
  const [selectedMindMap, setSelectedMindMap] = useState<{ id: string; title: string; url: string } | null>(null);
  
  // State for streaming progress
  const [generationProgress, setGenerationProgress] = useState(0); // Percentage 0-100
  const [totalToProcessForStream, setTotalToProcessForStream] = useState(0);
  const [processedSoFarForStream, setProcessedSoFarForStream] = useState(0);
  const [progressDetailsForStream, setProgressDetailsForStream] = useState<LessonProgressDetail[]>([]);
  const [currentGeneratingMessage, setCurrentGeneratingMessage] = useState<string | null>(null);
  
  // Updated state for final summary to include its type
  const [finalSummary, setFinalSummary] = useState<{ message: string; type: SummaryMessageType } | null>(null);

  // REMOVED: State for active tab
  // const [activeTab, setActiveTab] = useState<ActiveTab>('details');

  // Check for existing base class mind map
  const checkForExistingMindMap = useCallback(async () => {
    if (!baseClass?.id) {
      setIsCheckingMindMap(false);
      return;
    }

    try {
      setIsCheckingMindMap(true);
      
      const response = await fetch(`/api/teach/base-classes/${baseClass.id}/mind-map`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.asset) {
          setExistingMindMap({
            id: result.asset.id,
            url: result.asset.url
          });
        } else {
          setExistingMindMap(null);
        }
      } else {
        setExistingMindMap(null);
      }
    } catch (error) {
      console.error('Error checking for existing mind map:', error);
      setExistingMindMap(null);
    } finally {
      setIsCheckingMindMap(false);
    }
  }, [baseClass?.id]);

  // Check for lesson section content on component mount
  const checkForGeneratedContent = useCallback(async () => {
    if (!baseClass?.id) {
      setIsCheckingContent(false);
      return;
    }

    try {
      setIsCheckingContent(true);
      
      // First, check if the baseClass prop already has the data we need
      const hasContentFromProps = baseClass.paths?.some((path: any) => 
        path.lessons?.some((lesson: any) => 
          lesson.lesson_sections && lesson.lesson_sections.length > 0
        )
      );

      if (hasContentFromProps) {
        setHasGeneratedContent(true);
        setIsCheckingContent(false);
        return;
      }

      // Add a small delay to avoid flickering for very fast responses
      const [response] = await Promise.all([
        fetch(`/api/teach/base-classes/${baseClass.id}/generate-all-lessons-content?check=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        new Promise(resolve => setTimeout(resolve, 300)) // Minimum 300ms delay
      ]);
      
      if (response.ok) {
        const result = await response.json();
        // If the check returns that there are lessons to process, it means no content exists
        // If it returns that all lessons are skipped, it means content already exists
        setHasGeneratedContent(result.hasExistingContent || false);
      } else {
        // Fallback to checking the prop data if the API call fails
        setHasGeneratedContent(hasContentFromProps || false);
      }
    } catch (error) {
      console.error('Error checking for generated content:', error);
      // Fallback to checking the prop data
      const hasContentFromProps = baseClass.paths?.some((path: any) => 
        path.lessons?.some((lesson: any) => 
          lesson.lesson_sections && lesson.lesson_sections.length > 0
        )
      );
      setHasGeneratedContent(hasContentFromProps || false);
    } finally {
      setIsCheckingContent(false);
    }
  }, [baseClass?.id, baseClass.paths]);

  useEffect(() => {
    setName(baseClass.name);
    setDescription(baseClass.description || '');
    // Check for content when component mounts or baseClass changes
    checkForGeneratedContent();
    checkForExistingMindMap();
  }, [baseClass, checkForGeneratedContent, checkForExistingMindMap]);

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
                
                // Refresh content check to update button state
                if (messageType === 'success' || (eventData.successfulCount && eventData.successfulCount > 0)) {
                  checkForGeneratedContent();
                }
                
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

  const handleGenerateBaseClassMindMap = async () => {
    if (!baseClass || !baseClass.id) {
      setFinalSummary({ message: 'Error: Base class ID is missing.', type: 'error' });
      return;
    }

    setIsGeneratingMindMap(true);
    setFinalSummary(null);

    try {
      const response = await fetch(`/api/teach/base-classes/${baseClass.id}/mind-map`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ error: 'Failed to generate mind map.' }));
        throw new Error(errorResult.error || `Failed to generate mind map (status: ${response.status})`);
      }

      const result = await response.json();
      
      if (result.success && result.asset) {
        setFinalSummary({ 
          message: `Mind map generated successfully!`, 
          type: 'success' 
        });
        
        // Update the existing mind map state
        setExistingMindMap({
          id: result.asset.id,
          url: result.asset.url
        });
        
        // Open the mind map in the modal instead of new tab
        setSelectedMindMap({
          id: result.asset.id,
          title: result.asset.title || 'Base Class Mind Map',
          url: result.asset.url
        });
        setMindMapModalOpen(true);
      } else {
        throw new Error('Failed to generate mind map');
      }

    } catch (error: any) {
      console.error('Error generating base class mind map:', error);
      setFinalSummary({ message: `Error: ${error.message}`, type: 'error' });
    } finally {
      setIsGeneratingMindMap(false);
    }
  };

  const handleViewBaseClassMindMap = () => {
    if (existingMindMap) {
      setSelectedMindMap({
        id: existingMindMap.id,
        title: 'Base Class Mind Map',
        url: existingMindMap.url
      });
      setMindMapModalOpen(true);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{baseClass.name}</CardTitle>
        {/* REMOVED: Tab Navigation for Details/KnowledgeBase */}
      </CardHeader>
      <CardContent className="space-y-4 mt-4">
        {/* Content is now always details */}
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
              <Button onClick={handleSave} disabled={isGeneratingContent || isGeneratingMindMap || isCheckingContent || isCheckingMindMap}>Save Changes</Button>
              {isCheckingContent || isCheckingMindMap ? (
                <Button disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isCheckingContent ? 'Checking content...' : 'Checking mind map...'}
                </Button>
              ) : hasGeneratedContent ? (
                existingMindMap ? (
                  <Button onClick={handleViewBaseClassMindMap} disabled={isGeneratingContent || isGeneratingMindMap}>
                    View Base Class Mind Map
                  </Button>
                ) : (
                  <Button onClick={handleGenerateBaseClassMindMap} disabled={isGeneratingContent || isGeneratingMindMap}>
                    {isGeneratingMindMap ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Mind Map...
                      </>
                    ) : (
                      'Generate Base Class Mind Map'
                    )}
                  </Button>
                )
              ) : (
                <Button onClick={handleCreateAllLessonContent} disabled={isGeneratingContent || isGeneratingMindMap}>
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
              )}
            </div>

          {/* Final summary message */}
                {finalSummary && (
            <div className={`p-3 rounded-md text-sm ${getSummaryMessageStyle(finalSummary.type)}`}>
                    {finalSummary.message}
              </div>
            )}
          </>
        {/* REMOVED: Conditional rendering for knowledgeBase tab */}
      </CardContent>
      
      {/* Mind Map View Modal */}
      {selectedMindMap && (
        <MindMapViewModal
          isOpen={mindMapModalOpen}
          onClose={() => {
            setMindMapModalOpen(false);
            setSelectedMindMap(null);
          }}
          mindMapId={selectedMindMap.id}
          title={selectedMindMap.title}
          urlPath={selectedMindMap.url}
        />
      )}
    </Card>
  );
};

// Helper function to get Tailwind classes based on summary type
const getSummaryMessageStyle = (type: SummaryMessageType): string => {
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