'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StudioBaseClass } from '@/types/lesson';
import { supabase } from '@/utils/supabase/browser';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { UploadCloud, Link, Mic, FileText, Youtube, Globe, Trash2, AlertCircle, CheckCircle2, Hourglass, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import MinimalSpinner from '@/components/ui/MinimalSpinner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface KnowledgeBaseEditorProps {
  baseClass: StudioBaseClass;
  // onSave: (updatedData: Partial<BaseClass>) => Promise<void>; // If KB settings are saved with BaseClass
}

interface KnowledgeBaseItem {
  id: string;
  name: string;
  type: 'file' | 'url' | 'youtube' | 'text' | 'audio_recording';
  status: 'pending' | 'processing' | 'completed' | 'error' | 'queued';
  createdAt: Date;
  sourceInfo?: string; // e.g., file type, URL, etc.
  errorMessage?: string;
}

export const KnowledgeBaseEditor: React.FC<KnowledgeBaseEditorProps> = ({ baseClass }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('upload');
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null);
  const [pasteInput, setPasteInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [knowledgeBaseItems, setKnowledgeBaseItems] = useState<KnowledgeBaseItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [errorLoadingItems, setErrorLoadingItems] = useState<string | null>(null);

  // Fetch existing knowledge base items and set up realtime listener
  useEffect(() => {
    if (!baseClass.id) return;

    const fetchItems = async () => {
      setIsLoadingItems(true);
      setErrorLoadingItems(null);
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('id, file_name, file_type, status, created_at, metadata, base_class_id')
          .eq('base_class_id', baseClass.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const mappedItems: KnowledgeBaseItem[] = data.map((doc: any) => {
            let itemType: KnowledgeBaseItem['type'] = 'file';
            let sourceInfo = doc.file_type || 'Unknown file type';
            
            // Better type detection based on file_type and metadata
            if (doc.file_type === 'video/youtube' || 
                (doc.file_type === 'application/json' && doc.metadata?.originalUrl?.includes('youtube'))) {
              itemType = 'youtube';
              sourceInfo = doc.metadata?.originalUrl || 'YouTube video';
            } else if (doc.file_type === 'text/html' || 
                       (doc.file_type === 'application/json' && doc.metadata?.originalUrl && !doc.metadata.originalUrl.includes('youtube'))) {
              itemType = 'url';
              sourceInfo = doc.metadata?.originalUrl || 'Web page';
            } else if (doc.file_type?.startsWith('audio/')) {
              itemType = 'audio_recording';
              sourceInfo = 'Audio recording';
            } else if (doc.file_type === 'text/plain' && doc.metadata?.source === 'pasted_text') {
              itemType = 'text';
              sourceInfo = 'Pasted text snippet';
            } else {
              // Regular file upload
              sourceInfo = doc.file_type || 'File upload';
            }

            // Extract error message from metadata with better error handling
            let errorMessage = undefined;
            if (doc.status === 'error') {
              errorMessage = doc.metadata?.processing_error || 
                           doc.metadata?.error_message ||
                           doc.metadata?.error ||
                           'Processing failed - unknown error';
            }

            return {
              id: doc.id,
              name: doc.file_name || 'Untitled',
              type: itemType,
              status: doc.status as KnowledgeBaseItem['status'],
              createdAt: new Date(doc.created_at),
              sourceInfo: sourceInfo,
              errorMessage: errorMessage
            } as KnowledgeBaseItem;
          });
          setKnowledgeBaseItems(mappedItems);
        }
      } catch (err: any) {
        console.error('Error fetching knowledge base items:', err);
        setErrorLoadingItems('Failed to load knowledge base items. ' + err.message);
        toast({
          title: 'Error Loading Items',
          description: 'Could not fetch existing knowledge base items.',
          variant: 'destructive',
        });
      }
      setIsLoadingItems(false);
    };

    fetchItems();

    // Realtime subscription
    const channel = supabase
      .channel(`documents-for-baseclass-${baseClass.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'documents',
          filter: `base_class_id=eq.${baseClass.id}`
        },
        (payload) => {
          console.log('Realtime document change received!', payload);
          const mapPayloadToKnowledgeBaseItem = (doc: any): KnowledgeBaseItem => {
            let itemType: KnowledgeBaseItem['type'] = 'file';
            let sourceInfo = doc.file_type || 'Unknown file type';
            
            // Better type detection based on file_type and metadata
            if (doc.file_type === 'video/youtube' || 
                (doc.file_type === 'application/json' && doc.metadata?.originalUrl?.includes('youtube'))) {
              itemType = 'youtube';
              sourceInfo = doc.metadata?.originalUrl || 'YouTube video';
            } else if (doc.file_type === 'text/html' || 
                       (doc.file_type === 'application/json' && doc.metadata?.originalUrl && !doc.metadata.originalUrl.includes('youtube'))) {
              itemType = 'url';
              sourceInfo = doc.metadata?.originalUrl || 'Web page';
            } else if (doc.file_type?.startsWith('audio/')) {
              itemType = 'audio_recording';
              sourceInfo = 'Audio recording';
            } else if (doc.file_type === 'text/plain' && doc.metadata?.source === 'pasted_text') {
              itemType = 'text';
              sourceInfo = 'Pasted text snippet';
            } else {
              // Regular file upload
              sourceInfo = doc.file_type || 'File upload';
            }

            // Extract error message from metadata with better error handling
            let errorMessage = undefined;
            if (doc.status === 'error') {
              errorMessage = doc.metadata?.processing_error || 
                           doc.metadata?.error_message ||
                           doc.metadata?.error ||
                           'Processing failed - unknown error';
            }

            return {
              id: doc.id,
              name: doc.file_name || 'Untitled',
              type: itemType,
              status: doc.status as KnowledgeBaseItem['status'],
              createdAt: new Date(doc.created_at),
              sourceInfo: sourceInfo,
              errorMessage: errorMessage
            } as KnowledgeBaseItem;
          };

          if (payload.eventType === 'INSERT') {
            const newItem = mapPayloadToKnowledgeBaseItem(payload.new);
            setKnowledgeBaseItems(prevItems => {
              // Add if not already present (handles potential race with initial fetch or rapid inserts)
              if (!prevItems.find(item => item.id === newItem.id)) {
                return [newItem, ...prevItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              }
              return prevItems;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = mapPayloadToKnowledgeBaseItem(payload.new);
            console.log('Realtime UPDATE, mapped updatedItem:', updatedItem);
            setKnowledgeBaseItems(prevItems =>
              prevItems.map(item => (item.id === updatedItem.id ? updatedItem : item))
                     .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            );
          } else if (payload.eventType === 'DELETE') {
            setKnowledgeBaseItems(prevItems => 
              prevItems.filter(item => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to documents updates for base class ${baseClass.id}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime subscription error:', err);
          toast({ title: 'Realtime Error', description: 'Could not connect for live updates.', variant: 'destructive' });
        }
      });

    // Cleanup subscription on component unmount or when baseClass.id changes
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        console.log(`Unsubscribed from documents updates for base class ${baseClass.id}`);
      }
    };
  }, [baseClass.id, toast]); // Ensure toast is in dependency array if used in effect

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFilesToUpload(event.target.files);
    }
  };

  const sanitizeFilename = (filename: string): string => {
    // Replace spaces with underscores
    let sanitized = filename.replace(/\s+/g, '_');
    // Remove characters that are not alphanumeric, dots, hyphens, or underscores
    // Keep directory separators if they were intended, though for a filename part, they shouldn't be there.
    // For this use case, we are sanitizing the file.name part only.
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '');
    // Prevent names that are just dots or hyphens, or excessively long sequences of them.
    sanitized = sanitized.replace(/\.{2,}/g, '.'); // Replace multiple dots with single
    sanitized = sanitized.replace(/[-_]{2,}/g, '_'); // Replace multiple hyphens/underscores with single underscore
    // Ensure it doesn't start/end with a dot if it's not a hidden file (not typical for uploads)
    if (sanitized.startsWith('.') && sanitized.length > 1) {
        sanitized = sanitized.substring(1);
    }
    // Limit length if necessary (e.g., 200 characters for the sanitized part)
    const maxLength = 200;
    if (sanitized.length > maxLength) {
        const extensionMatch = sanitized.match(/(\.[^.]+)$/);
        const extension = extensionMatch ? extensionMatch[0] : '';
        const nameWithoutExtension = extension ? sanitized.substring(0, sanitized.lastIndexOf(extension)) : sanitized;
        sanitized = nameWithoutExtension.substring(0, maxLength - extension.length) + extension;
    }
    return sanitized || 'sanitized_filename'; // Fallback if everything is stripped
  };

  const handleUpload = async () => {
    if (!filesToUpload || filesToUpload.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select one or more files to upload.',
        variant: 'default',
      });
      return;
    }
    if (!baseClass.id || !baseClass.organisation_id) {
      toast({
        title: 'Error',
        description: 'Base class or organisation information is missing.',
        variant: 'destructive',
      });
      return;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to upload files.',
        variant: 'destructive',
      });
      return;
    }

    const itemsToUpload = Array.from(filesToUpload);
    setFilesToUpload(null); // Clear the input immediately

    // Add visual pending items to the list
    const pendingItems: KnowledgeBaseItem[] = itemsToUpload.map(file => ({
      id: uuidv4(), // Temporary client-side ID
      name: file.name,
      type: 'file',
      status: 'pending',
      createdAt: new Date(),
      sourceInfo: file.type || 'unknown',
    }));
    setKnowledgeBaseItems(prev => [...pendingItems, ...prev]);

    for (const file of itemsToUpload) {
      const clientSideId = pendingItems.find(item => item.name === file.name)?.id || uuidv4(); // Find the temp ID
      try {
        const sanitizedOriginalFilename = sanitizeFilename(file.name);
        const uniqueFileName = `${uuidv4()}-${sanitizedOriginalFilename}`;
        const filePath = `base_class_documents/${baseClass.id}/${uniqueFileName}`;
        const bucketName = `org-${baseClass.organisation_id}-uploads`;

        // Update status in UI to processing for this specific item
        setKnowledgeBaseItems(prev => 
          prev.map(item => item.id === clientSideId ? { ...item, status: 'processing' } : item)
        );

        // 1. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file);

        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

        // 2. Create document record in 'documents' table
        const { data: newDocument, error: insertError } = await supabase
          .from('documents')
          .insert({
            base_class_id: baseClass.id,
            organisation_id: baseClass.organisation_id,
            uploaded_by: user.id,
            file_name: file.name,
            storage_path: filePath,
            file_type: file.type,
            file_size: file.size,
            status: 'queued', // Set to queued for backend processing
            metadata: { original_filename: file.name, client_side_id: clientSideId },
          })
          .select()
          .single();

        if (insertError) throw new Error(`Database record creation failed: ${insertError.message}`);
        if (!newDocument) throw new Error('Failed to create document record, no data returned.');
        
        // Replace temporary item with actual data from DB, maintaining processing status
        setKnowledgeBaseItems(prev =>
          prev.map(item =>
            item.id === clientSideId
              ? {
                  id: newDocument.id, // Use the actual DB ID
                  name: newDocument.file_name || 'Untitled',
                  type: item.type, 
                  status: 'queued', 
                  createdAt: new Date(newDocument.created_at),
                  sourceInfo: newDocument.file_type || 'unknown',
                  errorMessage: undefined, 
                } as KnowledgeBaseItem 
              : item
          )
        );

        // 3. Invoke Edge Function - CHOOSE BASED ON FILE TYPE
        let targetFunction = 'process-document'; 
        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          targetFunction = 'kb-process-textfile';
        }

        console.log(`Invoking ${targetFunction} for document ID: ${newDocument.id} (file: ${file.name})`);
        const { error: functionError } = await supabase.functions.invoke(
          targetFunction,
          { body: { documentId: newDocument.id } }
        );

        if (functionError) {
          console.error(`Error invoking ${targetFunction} for ${file.name}:`, functionError);
          setKnowledgeBaseItems(prev =>
            prev.map(item =>
              item.id === newDocument.id ? { ...item, status: 'error', errorMessage: `Function invocation failed: ${functionError.message}` } : item
            )
          );
          await supabase.from('documents').update({ status: 'error', metadata: { ...(newDocument.metadata as object || {}), processing_error: `Function invocation failed: ${functionError.message}` } }).eq('id', newDocument.id);
          toast({
            title: `Error starting processing for ${file.name}`,
            description: functionError.message,
            variant: 'destructive',
          });
          continue; // Continue to next file if one fails here
        }

        toast({
          title: `Processing queued for ${file.name}`,
          description: `The file is in the queue and will be processed shortly.`,
        });

      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        toast({
          title: `Failed to upload ${file.name}`,
          description: error.message,
          variant: 'destructive',
        });
        // Update the specific pending item to error status
        setKnowledgeBaseItems(prev => 
          prev.map(item => item.id === clientSideId ? { ...item, status: 'error', errorMessage: error.message } : item)
        );
      }
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteInput.trim()) {
      toast({
        title: 'Input is empty',
        description: 'Please paste a URL or some text.',
        variant: 'destructive',
      });
      return;
    }
    if (!baseClass.id || !baseClass.organisation_id) {
      toast({ title: 'Error', description: 'Base class or organisation information is missing.', variant: 'destructive' });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive' });
      return;
    }

    const newDocId = uuidv4();
    const isUrl = pasteInput.startsWith('http://') || pasteInput.startsWith('https://');
    let typeForUi: KnowledgeBaseItem['type'] = isUrl ? 'url' : 'text';
    if (isUrl && (pasteInput.includes('youtube.com') || pasteInput.includes('youtu.be'))) {
      typeForUi = 'youtube';
    }

    // Add visual pending item
    const pendingItem: KnowledgeBaseItem = {
      id: newDocId, // Use the generated newDocId for consistency
      name: isUrl ? pasteInput.substring(0, 100) + (pasteInput.length > 100 ? '...' : '') : 'Pasted Text Snippet',
      type: typeForUi,
      status: 'pending',
      createdAt: new Date(),
      sourceInfo: pasteInput.substring(0, 100) + (pasteInput.length > 100 ? '...' : ''),
    };
    setKnowledgeBaseItems(prev => [pendingItem, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    const originalPasteInput = pasteInput;
    setPasteInput(''); // Clear input

    try {
      setKnowledgeBaseItems(prev => 
        prev.map(item => item.id === newDocId ? { ...item, status: 'processing' } : item)
      );

      if (isUrl) {
        // Handle URL
        const { error: insertError } = await supabase
          .from('documents')
          .insert({
            id: newDocId,
            organisation_id: baseClass.organisation_id,
            base_class_id: baseClass.id,
            uploaded_by: user.id,
            file_name: `URL - ${originalPasteInput.substring(0, 50)}${originalPasteInput.length > 50 ? '...' : ''}`,
            file_type: 'application/json', // Special type to indicate URL source for process-document
            storage_path: `URL_SOURCE_${newDocId}`, // Make storage_path unique for URLs
            metadata: { 
              originalUrl: originalPasteInput,
              source: typeForUi === 'youtube' ? 'youtube_url' : 'pasted_url', 
            },
            status: 'queued',
          });

        if (insertError) throw new Error(`Failed to create document record for URL: ${insertError.message}`);

        const { error: invokeError } = await supabase.functions.invoke('process-document', {
          body: { documentId: newDocId },
        });

        if (invokeError) throw new Error(`Failed to invoke process-document for URL: ${invokeError.message}`);
        
        toast({ title: 'URL Processing Started', description: 'The URL has been queued for processing.' });

      } else {
        // Handle Plain Text - similar to file upload but content comes from pasteInput
        const fileName = `pasted-text-${uuidv4()}.txt`;
        const filePath = `base_class_documents/${baseClass.id}/${fileName}`;
        const bucketName = `org-${baseClass.organisation_id}-uploads`;

        const { error: textUploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, new Blob([originalPasteInput], { type: 'text/plain' }));

        if (textUploadError) throw new Error(`Storage upload failed for pasted text: ${textUploadError.message}`);

        const { error: insertError } = await supabase
          .from('documents')
          .insert({
            id: newDocId,
            organisation_id: baseClass.organisation_id,
            base_class_id: baseClass.id,
            uploaded_by: user.id,
            file_name: 'Pasted Text Snippet',
            file_type: 'text/plain',
            storage_path: filePath,
            metadata: { source: 'pasted_text' },
            status: 'queued',
          });

        if (insertError) throw new Error(`Failed to create document record for pasted text: ${insertError.message}`);
        
        // Invoke kb-process-textfile for plain text files
        const { error: invokeError } = await supabase.functions.invoke('kb-process-textfile', {
          body: { documentId: newDocId },
        });

        if (invokeError) throw new Error(`Failed to invoke kb-process-textfile for pasted text: ${invokeError.message}`);

        toast({ title: 'Text Processing Started', description: 'Pasted text has been queued for processing.' });
      }
      // The realtime listener should update the item to 'processing' and then to its final state.
      // We don't need to manually set it to 'completed' here.

    } catch (error: any) {
      console.error('Error in handlePasteSubmit:', error);
      setKnowledgeBaseItems(prev => 
        prev.map(item => item.id === newDocId ? { ...item, status: 'error', errorMessage: error.message } : item)
      );
      toast({
        title: 'Submission Error',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  // New function to handle the actual upload of the recorded audio blob
  const handleAudioUpload = async (blob: Blob) => {
    if (!blob) return;

    if (!baseClass.id || !baseClass.organisation_id) {
      toast({
        title: 'Error',
        description: 'Base class or organisation information is missing for audio upload.',
        variant: 'destructive',
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to upload audio.',
        variant: 'destructive',
      });
      return;
    }

    const clientSideId = uuidv4();
    const fileName = `recorded-audio-${clientSideId}.wav`; // Assuming WAV, adjust if MediaRecorder outputs differently
    const audioFile = new File([blob], fileName, { type: blob.type || 'audio/wav' });
    const itemType: KnowledgeBaseItem['type'] = 'audio_recording';

    const pendingAudioItem: KnowledgeBaseItem = {
      id: clientSideId,
      name: fileName,
      type: itemType,
      status: 'pending',
      createdAt: new Date(),
      sourceInfo: 'Recorded in browser',
    };
    setKnowledgeBaseItems(prev => [pendingAudioItem, ...prev]);
    setAudioBlob(null); // Clear the displayed audio blob info as it's now in the list

    try {
      setKnowledgeBaseItems(prev => 
        prev.map(item => item.id === clientSideId ? { ...item, status: 'processing' } : item)
      );

      const uniqueFileName = `${uuidv4()}-${audioFile.name}`;
      const filePath = `base_class_documents/${baseClass.id}/${uniqueFileName}`;
      const bucketName = `org-${baseClass.organisation_id}-uploads`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, audioFile);

      if (uploadError) throw new Error(`Storage upload for audio failed: ${uploadError.message}`);

      const { data: newDocument, error: insertError } = await supabase
        .from('documents')
        .insert({
          base_class_id: baseClass.id,
          organisation_id: baseClass.organisation_id,
          uploaded_by: user.id,
          file_name: audioFile.name,
          storage_path: filePath,
          file_type: audioFile.type,
          file_size: audioFile.size,
          status: 'queued',
          metadata: { original_filename: audioFile.name, source: 'audio_recording', client_side_id: clientSideId },
        })
        .select()
        .single();

      if (insertError) throw new Error(`DB record creation for audio failed: ${insertError.message}`);
      if (!newDocument) throw new Error('Failed to create document record for audio.');

      setKnowledgeBaseItems(prev =>
        prev.map(item =>
          item.id === clientSideId
            ? {
                id: newDocument.id,
                name: newDocument.file_name || fileName,
                type: itemType,
                status: 'queued',
                createdAt: new Date(newDocument.created_at),
                sourceInfo: 'Recorded in browser',
                errorMessage: undefined,
              } as KnowledgeBaseItem
            : item
        )
      );

      const { error: functionError } = await supabase.functions.invoke(
        'process-document',
        { body: { documentId: newDocument.id } }
      );

      if (functionError) {
        console.error('Error invoking process-document for audio:', functionError);
        setKnowledgeBaseItems(prev =>
          prev.map(item =>
            item.id === newDocument.id ? { ...item, status: 'error', errorMessage: `Processing error: ${functionError.message}` } : item
          )
        );
        await supabase.from('documents').update({ status: 'error', metadata: { ...(newDocument.metadata as object || {}), processing_error: `Function invocation failed: ${functionError.message}` } }).eq('id', newDocument.id);
        toast({ title: `Error processing ${fileName}`, description: functionError.message, variant: 'destructive' });
        return;
      }
      toast({ title: `Processing queued for ${fileName}`, description: 'Audio recording is in the queue and will be processed shortly.' });
    } catch (error: any) {
      console.error(`Error submitting audio ${fileName}:`, error);
      toast({ title: `Failed to submit ${fileName}`, description: error.message, variant: 'destructive' });
      setKnowledgeBaseItems(prev => 
        prev.map(item => item.id === clientSideId ? { ...item, status: 'error', errorMessage: error.message } : item)
      );
    }
  };

  const startRecording = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const completeAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); // Or appropriate type based on browser/encoder
          setAudioBlob(completeAudioBlob); // Keep this to allow potential playback or re-save UI
          handleAudioUpload(completeAudioBlob); // Call the new upload handler
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        setAudioBlob(null);
        toast({ title: 'Recording Started' });
      } catch (err) {
        console.error('Error accessing microphone:', err);
        toast({
          title: 'Microphone Error',
          description: 'Could not access microphone. Please check permissions.',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Unsupported Browser',
        description: 'Audio recording is not supported in your browser.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stream tracks are stopped automatically by MediaRecorder on stop, or do it manually:
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!baseClass.id || !itemId) return;
    
    // Add confirmation dialog
    const confirmed = window.confirm('Are you sure you want to delete this document? This action cannot be undone.');
    if (!confirmed) return;

    try {
      // Optimistically update UI - mark as processing
      setKnowledgeBaseItems(prev => 
        prev.map(item => 
          item.id === itemId 
            ? { ...item, status: 'processing' as KnowledgeBaseItem['status'] }
            : item
        )
      );

      const response = await fetch(`/api/teach/base-classes/${baseClass.id}/documents/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }

      // Remove from UI state immediately
      setKnowledgeBaseItems(prev => prev.filter(item => item.id !== itemId));
      
      toast({ 
        title: 'Document Deleted', 
        description: 'The document has been successfully removed from your knowledge base.',
        variant: 'default' 
      });

    } catch (error: any) {
      console.error('Error deleting document:', error);
      
      // Revert the item status if deletion failed
      setKnowledgeBaseItems(prev => 
        prev.map(item => 
          item.id === itemId 
            ? { ...item, status: 'error' as KnowledgeBaseItem['status'], errorMessage: error.message }
            : item
        )
      );

      toast({
        title: 'Delete Failed',
        description: error.message || 'An unexpected error occurred while deleting the document.',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: KnowledgeBaseItem['status']) => {
    switch (status) {
      case 'pending':
      case 'queued':
      case 'processing':
        return <MinimalSpinner size={16} color="text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Hourglass className="h-4 w-4 text-gray-400" />;
    }
  };

  const getItemIcon = (type: KnowledgeBaseItem['type']) => {
    switch (type) {
      case 'file':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'url':
        return <Globe className="h-4 w-4 text-green-500" />;
      case 'youtube':
        return <Youtube className="h-4 w-4 text-red-500" />;
      case 'text':
        return <FileText className="h-4 w-4 text-gray-500" />;
      case 'audio_recording':
        return <Mic className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: KnowledgeBaseItem['status']) => {
    const variants = {
      'pending': 'secondary',
      'queued': 'secondary', 
      'processing': 'default',
      'completed': 'default',
      'error': 'destructive'
    } as const;
    
    const labels = {
      'pending': 'Pending',
      'queued': 'Queued',
      'processing': 'Processing',
      'completed': 'Completed',
      'error': 'Error'
    };

    return (
      <Badge variant={variants[status]} className="text-xs">
        {labels[status]}
      </Badge>
    );
  };

  // New component for error messages
  const ErrorMessage: React.FC<{ item: KnowledgeBaseItem }> = ({ item }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    if (!item.errorMessage) return null;

    const getErrorSuggestion = (message: string) => {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('transcript')) {
        return 'Try a different video or check if transcripts are enabled.';
      }
      if (lowerMessage.includes('access') || lowerMessage.includes('private')) {
        return 'The video might be private or restricted in your region.';
      }
      if (lowerMessage.includes('storage')) {
        return 'File upload failed. Try uploading again or contact support.';
      }
      return 'Please try again or contact support if the issue persists.';
    };

    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger className="flex items-center space-x-1 text-xs text-red-600 hover:text-red-800 w-full">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span className="font-medium">Processing Failed</span>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-1">
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 space-y-1">
            <div className="break-words">{item.errorMessage}</div>
            <div className="text-blue-600 font-medium">
              💡 {getErrorSuggestion(item.errorMessage)}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl font-semibold">Knowledge Base</h2>
        <p className="text-sm text-muted-foreground">
          Manage documents, links, and recordings for <span className="font-medium">{baseClass.name}</span>
        </p>
      </div>

      {/* Upload Tabs */}
      <div className="w-full">
        <Tabs defaultValue="upload" className="w-full" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="upload" className="text-xs md:text-sm p-2 md:p-3">
              <UploadCloud className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Upload Files</span>
              <span className="sm:hidden">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="paste" className="text-xs md:text-sm p-2 md:p-3">
              <Link className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Paste Link/Text</span>
              <span className="sm:hidden">Paste</span>
            </TabsTrigger>
            <TabsTrigger value="record" className="text-xs md:text-sm p-2 md:p-3">
              <Mic className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Record Audio</span>
              <span className="sm:hidden">Record</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Upload Files</CardTitle>
                <CardDescription className="text-sm">
                  Upload documents, PDFs, audio, or video files.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input 
                  type="file" 
                  multiple 
                  onChange={handleFileChange} 
                  accept=".pdf,.doc,.docx,.txt,.md,.pptx,.xls,.xlsx,.csv,.mp3,.wav,.mp4,.mov,.webm"
                  className="cursor-pointer"
                />
                {filesToUpload && (
                  <div className="text-sm text-muted-foreground">
                    Selected {filesToUpload.length} file(s).
                  </div>
                )}
                <Button 
                  onClick={handleUpload} 
                  disabled={!filesToUpload || filesToUpload.length === 0}
                  className="w-full sm:w-auto"
                >
                  <UploadCloud className="mr-2 h-4 w-4" /> Upload Selected
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paste" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Paste Link or Text</CardTitle>
                <CardDescription className="text-sm">
                  Paste a YouTube URL, website link, or raw text content.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  placeholder="Paste URL (e.g., YouTube, website) or text here..." 
                  value={pasteInput} 
                  onChange={(e) => setPasteInput(e.target.value)} 
                  rows={4}
                  className="resize-none"
                />
                <Button 
                  onClick={handlePasteSubmit} 
                  disabled={!pasteInput.trim()}
                  className="w-full sm:w-auto"
                >
                  <Link className="mr-2 h-4 w-4" /> Process Content
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="record" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Record Audio</CardTitle>
                <CardDescription className="text-sm">
                  Record lectures or voice notes directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isRecording ? (
                  <Button onClick={startRecording} className="w-full sm:w-auto">
                    <Mic className="mr-2 h-4 w-4" /> Start Recording
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="destructive" className="w-full sm:w-auto">
                    <Mic className="mr-2 h-4 w-4" /> Stop Recording
                  </Button>
                )}
                {audioBlob && (
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Recording complete. Ready to process.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Items List */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Items ({knowledgeBaseItems.length})</h3>
        </div>
        
        {isLoadingItems && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2">
              <MinimalSpinner size={20} color="text-muted-foreground" />
              <p className="text-muted-foreground">Loading items...</p>
            </div>
          </div>
        )}
        
        {errorLoadingItems && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
            <p className="font-semibold text-red-600">Error loading items</p>
            <p className="text-sm text-red-500 max-w-md">{errorLoadingItems}</p>
          </div>
        )}
        
        {!isLoadingItems && !errorLoadingItems && knowledgeBaseItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 mb-4 text-muted-foreground" />
            <p className="text-muted-foreground text-lg mb-2">No knowledge base items yet</p>
            <p className="text-sm text-muted-foreground">Add some using the tabs above</p>
          </div>
        )}
        
        {!isLoadingItems && !errorLoadingItems && knowledgeBaseItems.length > 0 && (
          <div className="space-y-3 h-full overflow-y-auto pr-2">
            {knowledgeBaseItems.map(item => (
              <Card key={item.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between space-x-3">
                    {/* Main content */}
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {getItemIcon(item.type)}
                      </div>
                      
                      {/* Content */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-sm leading-tight break-words">{item.name}</h4>
                          <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                            {getStatusIcon(item.status)}
                            {getStatusBadge(item.status)}
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground break-words">
                          {item.sourceInfo || 'N/A'}
                        </p>
                        
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        
                        {/* Error Message */}
                        {item.status === 'error' && <ErrorMessage item={item} />}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex-shrink-0">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)} 
                        disabled={item.status === 'processing'}
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete item</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 