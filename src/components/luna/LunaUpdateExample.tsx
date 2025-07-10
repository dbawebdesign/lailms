import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LunaUpdateWrapper, 
  useLunaUpdateTrigger, 
  LUNA_UPDATE_TYPES 
} from '@/components/luna/LunaUpdateWrapper';

/**
 * Example component showing how to add Luna UI updates to any form or component
 * This can be used as a template for other pages that need Luna integration
 */
export const LunaUpdateExample: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  
  const { triggerLunaUpdate } = useLunaUpdateTrigger();

  // Simulate data refresh function
  const handleDataRefresh = async (elementType: string, elementId?: string, data?: any) => {
    console.log('🔄 Refreshing data for:', elementType, elementId, data);
    
    // Here you would typically:
    // 1. Make API calls to fetch fresh data
    // 2. Update component state
    // 3. Show success/error messages
    
    // Example API call:
    // const response = await fetch('/api/your-endpoint');
    // const newData = await response.json();
    // setTitle(newData.title);
    // setDescription(newData.description);
  };

  // Manual trigger example
  const handleManualUpdate = () => {
    triggerLunaUpdate(LUNA_UPDATE_TYPES.FORM_FIELD, 'manual-example');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Luna UI Updates Example</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Method 1: Using LunaUpdateWrapper (Recommended) */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Title (with Luna Updates)
          </label>
          <LunaUpdateWrapper 
            updateType={LUNA_UPDATE_TYPES.LESSON_TITLE}
            onDataRefresh={handleDataRefresh}
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title..."
            />
          </LunaUpdateWrapper>
        </div>

        {/* Method 2: Using LunaUpdateWrapper with custom refresh logic */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Description (with custom refresh)
          </label>
          <LunaUpdateWrapper 
            updateType={LUNA_UPDATE_TYPES.LESSON_DESCRIPTION}
            onDataRefresh={async (elementType) => {
              if (elementType === LUNA_UPDATE_TYPES.LESSON_DESCRIPTION) {
                // Custom refresh logic for this specific field
                setDescription('Updated by Luna!');
              }
            }}
          >
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description..."
              rows={3}
            />
          </LunaUpdateWrapper>
        </div>

        {/* Method 3: Multiple update types for complex components */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Content Area (multiple update types)
          </label>
          <LunaUpdateWrapper 
            updateType={LUNA_UPDATE_TYPES.LESSON_CONTENT}
            onDataRefresh={handleDataRefresh}
          >
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter content..."
              rows={5}
            />
          </LunaUpdateWrapper>
        </div>

        {/* Manual trigger example */}
        <div className="pt-4 border-t">
          <Button onClick={handleManualUpdate}>
            Trigger Manual Update (for testing)
          </Button>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">How to use Luna Updates:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Import <code>LunaUpdateWrapper</code> and <code>LUNA_UPDATE_TYPES</code></li>
            <li>Wrap your input/display components with <code>LunaUpdateWrapper</code></li>
            <li>Specify the appropriate <code>updateType</code> from <code>LUNA_UPDATE_TYPES</code></li>
            <li>Provide an <code>onDataRefresh</code> function to handle data updates</li>
            <li>When Luna updates something, the component will glow blue and refresh automatically!</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}; 