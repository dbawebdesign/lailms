export type ToolCategory = 
  | 'content-creation' 
  | 'assessment' 
  | 'planning' 
  | 'communication' 
  | 'differentiation'
  | 'visual-aids';

export type ToolComplexity = 'simple' | 'intermediate' | 'advanced';

export type ToolOutputFormat = 'pdf' | 'docx' | 'html' | 'json' | 'csv' | 'image' | 'text';

export interface ToolInputField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'range';
  placeholder?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: any;
  description?: string;
}

export interface TeachingTool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string; // Icon name from lucide-react
  complexity: ToolComplexity;
  estimatedTime: string; // e.g., "2-3 minutes"
  outputFormats: ToolOutputFormat[];
  keywords?: string[];
  inputFields: ToolInputField[];
  examples?: string[];
  tips?: string[];
  apiEndpoint: string;
  isPopular?: boolean;
  isNew?: boolean;
} 