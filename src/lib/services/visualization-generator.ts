import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// Initialize OpenAI client for o3 model
const openaiO3 = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Initialize Supabase client for storage
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export interface VisualizationRequest {
  visualizationType: 'chart' | 'infographic' | 'interactive' | 'presentation' | 'social-media'
  dataFocus: string
  outputFormat: 'html' | 'powerpoint' | 'google-slides' | 'social' | 'embed'
  userRequest: string
  specificMetrics?: string[]
}

export interface VisualizationResult {
  type: string
  description: string
  htmlFile: string
  downloadUrl: string
  embedCode: string
  previewUrl: string
  dataPointsUsed: number
  metadata: {
    generatedAt: string
    fileSize: number
    visualizationType: string
    dataSource: string
    outputFormat?: string
  }
}

export class VisualizationGenerator {
  
  /**
   * Generate interactive visualization using o3 model with GPT-4.1 optimized prompts
   */
  async generateVisualization(
    request: VisualizationRequest,
    surveyData: any
  ): Promise<VisualizationResult> {
    
    // GPT-4.1 optimized prompt structure for o3 model
    const o3SystemPrompt = `# Role and Objective
You are an expert data visualization specialist and interactive media designer with advanced expertise in survey data analysis, statistical visualization, and user experience design. Your objective is to create compelling, interactive visualizations that effectively communicate survey insights.

# Instructions

## Data Analysis Requirements
1. **Statistical Analysis**: Perform comprehensive analysis of survey data patterns, correlations, and significance
2. **Insight Extraction**: Identify key findings, trends, and actionable insights from the data
3. **Visualization Strategy**: Determine the most effective visual representation for the specific data and audience
4. **Interactivity Design**: Plan interactive elements that enhance understanding and engagement

## Visualization Creation Standards
- **Professional Quality**: Create publication-ready visualizations suitable for business presentations
- **Interactive Elements**: Include hover effects, filtering, and dynamic data exploration
- **Responsive Design**: Ensure visualizations work across devices and screen sizes
- **Accessibility**: Include proper contrast, alt text, and keyboard navigation support
- **Brand Integration**: Apply consistent styling and professional appearance

## Technical Implementation
- **Single File Output**: Generate complete HTML file with embedded CSS, JavaScript, and data
- **Library Integration**: Use D3.js, Chart.js, or similar for robust visualization capabilities
- **Performance Optimization**: Ensure smooth animations and fast loading times
- **Cross-browser Compatibility**: Support modern browsers with fallbacks where needed
- **Presentation Formats**: For PowerPoint/Google Slides, use 16:9 aspect ratio (1920x1080px) with large fonts and high contrast
- **Slide Optimization**: When outputFormat is 'powerpoint' or 'google-slides', create slide-friendly layouts with:
  - Large, readable fonts (minimum 24px for body text, 36px+ for titles)
  - High contrast colors for projector visibility
  - Minimal text, maximum visual impact
  - Clear section divisions suitable for slide breaks
  - Export-friendly styling that works when copied to presentation software

# Reasoning Steps
1. **Data Pattern Analysis**: Examine survey data for key insights and relationships
2. **Visualization Type Selection**: Choose optimal chart/graph types for the data story
3. **Interactive Feature Planning**: Design user interactions that enhance understanding
4. **Code Architecture**: Structure HTML/CSS/JavaScript for maintainability and performance
5. **Quality Validation**: Ensure accuracy, accessibility, and professional presentation

# Output Format
Provide comprehensive visualization package as JSON:
{
  "analysis": {
    "keyInsights": ["insight1", "insight2", "insight3"],
    "dataPatterns": ["pattern1", "pattern2"],
    "recommendations": ["rec1", "rec2"]
  },
  "visualization": {
    "type": "chosen visualization type",
    "description": "explanation of visual approach and features",
    "interactiveFeatures": ["feature1", "feature2"]
  },
  "htmlCode": "complete HTML file with embedded CSS, JavaScript, and data",
  "implementation": {
    "libraries": ["D3.js", "Chart.js"],
    "features": ["responsive", "interactive", "accessible"],
    "browserSupport": "modern browsers"
  },
  "usage": {
    "instructions": "how to use and customize",
    "embedOptions": "embedding instructions",
    "sharingOptions": "sharing guidelines"
  }
}

# Content to Analyze
User Request: ${request.userRequest}
Visualization Type: ${request.visualizationType}
Data Focus: ${request.dataFocus}
Output Format: ${request.outputFormat}
Specific Metrics: ${request.specificMetrics?.join(', ') || 'Not specified'}

Survey Data Context: ${JSON.stringify(surveyData, null, 2)}

# Final Instructions
Think step by step through the data analysis and visualization design process. Create a professional, interactive visualization that effectively communicates the survey insights while meeting the user's specific requirements. Ensure the output is immediately usable and professionally presented.`

    try {
      console.log('🎨 Generating visualization with o3 model...')
      
      // Call o3 model for advanced visualization generation
      const completion = await openaiO3.chat.completions.create({
        model: 'o3', // Use o3 for advanced reasoning
        messages: [
          {
            role: 'system',
            content: o3SystemPrompt
          },
          {
            role: 'user',
            content: `Create a comprehensive ${request.visualizationType} visualization focusing on ${request.dataFocus} in ${request.outputFormat} format.

${request.outputFormat === 'powerpoint' || request.outputFormat === 'google-slides' ? `
PRESENTATION FORMAT REQUIREMENTS:
- Use 16:9 aspect ratio (1920x1080px viewport)
- Large, bold fonts (minimum 24px body, 36px+ titles)
- High contrast colors suitable for projectors
- Minimal text, maximum visual impact
- Clean, professional styling that works when copied to presentation software
- Include slide-friendly section breaks and clear visual hierarchy
- Ensure charts and graphs are large enough to be visible from a distance
- Use presentation-appropriate color schemes (avoid pure white backgrounds)
` : ''}

Survey Data to Analyze:
${JSON.stringify(surveyData, null, 2)}`
          }
        ],
        temperature: 0.3, // Lower temperature for consistent, professional output
        max_completion_tokens: 8000 // o3 model uses max_completion_tokens instead of max_tokens
      })

      const result = completion.choices[0]?.message?.content
      if (!result) {
        throw new Error('No response from o3 model')
      }

      // Parse the JSON response
      let visualizationData
      try {
        // Remove markdown code blocks if present
        const cleanedResult = result.replace(/```json\s*|\s*```/g, '').trim()
        visualizationData = JSON.parse(cleanedResult)
      } catch (parseError) {
        console.error('Failed to parse o3 response:', parseError)
        throw new Error('Invalid visualization data format')
      }

      // Process and enhance the HTML code
      const enhancedHtml = await this.enhanceVisualizationHtml(
        visualizationData.htmlCode,
        request,
        visualizationData
      )

      // Upload to Supabase Storage
      const storageResult = await this.uploadToSupabaseStorage(
        enhancedHtml,
        request.visualizationType,
        request.outputFormat
      )

      // Generate embed code
      const embedCode = this.generateEmbedCode(storageResult.publicUrl)

      return {
        type: visualizationData.visualization.type,
        description: visualizationData.visualization.description,
        htmlFile: enhancedHtml,
        downloadUrl: storageResult.publicUrl,
        embedCode,
        previewUrl: storageResult.publicUrl,
        dataPointsUsed: this.countDataPoints(surveyData),
        metadata: {
          generatedAt: new Date().toISOString(),
          fileSize: new Blob([enhancedHtml]).size,
          visualizationType: request.visualizationType,
          dataSource: 'survey_analytics',
          outputFormat: request.outputFormat
        }
      }

    } catch (error) {
      console.error('Visualization generation error:', error)
      throw new Error(`Failed to generate visualization: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Enhance HTML code with additional features and optimizations
   */
  private async enhanceVisualizationHtml(
    htmlCode: string,
    request: VisualizationRequest,
    visualizationData: any
  ): Promise<string> {
    // Add meta tags and format-specific styling
    const isPresentationFormat = request.outputFormat === 'powerpoint' || request.outputFormat === 'google-slides'
    
    const enhancedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Survey Data Visualization - ${request.visualizationType}</title>
    <meta name="description" content="Interactive survey data visualization generated by Learnology AI">
    <meta name="generator" content="Learnology AI Visualization Engine">
    ${isPresentationFormat ? '<meta name="presentation-format" content="true">' : ''}
    <style>
        /* Base responsive styles */
        * { box-sizing: border-box; }
        body { 
            margin: 0; 
            padding: ${isPresentationFormat ? '40px' : '20px'}; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${isPresentationFormat ? '#f0f4f8' : '#f8fafc'};
            ${isPresentationFormat ? 'width: 1920px; height: 1080px; overflow: hidden;' : ''}
        }
        .visualization-container {
            ${isPresentationFormat ? 'width: 100%; height: 100%;' : 'max-width: 1200px;'}
            margin: 0 auto;
            background: white;
            border-radius: ${isPresentationFormat ? '8px' : '12px'};
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            padding: ${isPresentationFormat ? '48px' : '24px'};
            ${isPresentationFormat ? 'display: flex; flex-direction: column;' : ''}
        }
        .visualization-header {
            margin-bottom: ${isPresentationFormat ? '40px' : '24px'};
            text-align: center;
        }
        .visualization-title {
            font-size: ${isPresentationFormat ? '48px' : '24px'};
            font-weight: ${isPresentationFormat ? '700' : '600'};
            color: #1f2937;
            margin-bottom: ${isPresentationFormat ? '16px' : '8px'};
            ${isPresentationFormat ? 'line-height: 1.2;' : ''}
        }
        .visualization-description {
            color: #6b7280;
            font-size: ${isPresentationFormat ? '24px' : '14px'};
            ${isPresentationFormat ? 'font-weight: 500;' : ''}
        }
        ${isPresentationFormat ? `
        .chart-container, .visualization-content {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .chart-container svg, .chart-container canvas {
            max-width: 100%;
            max-height: 100%;
        }
        /* Presentation-specific chart styling */
        .chart-text { font-size: 18px !important; font-weight: 600 !important; }
        .chart-title { font-size: 32px !important; font-weight: 700 !important; }
        .chart-legend { font-size: 20px !important; font-weight: 500 !important; }
        .axis-label { font-size: 22px !important; font-weight: 600 !important; }
        ` : ''}
        .powered-by {
            margin-top: 24px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
        }
        @media (max-width: 768px) {
            body { padding: 10px; }
            .visualization-container { padding: 16px; }
            .visualization-title { font-size: 20px; }
        }
    </style>
</head>
<body>
    <div class="visualization-container">
        <div class="visualization-header">
            <h1 class="visualization-title">Survey Data Insights</h1>
            <p class="visualization-description">${visualizationData.visualization.description}</p>
        </div>
        
        ${htmlCode}
        
        <div class="powered-by">
            Generated by Learnology AI • ${new Date().toLocaleDateString()}
        </div>
    </div>
</body>
</html>`

    return enhancedHtml
  }

  /**
   * Upload visualization to Supabase Storage
   */
  private async uploadToSupabaseStorage(
    htmlContent: string,
    visualizationType: string,
    outputFormat?: string
  ): Promise<{ publicUrl: string; filePath: string }> {
    const formatSuffix = outputFormat === 'powerpoint' || outputFormat === 'google-slides' ? `-${outputFormat}` : ''
    const fileName = `visualization-${visualizationType}${formatSuffix}-${uuidv4()}.html`
    const filePath = `visualizations/${fileName}`

    try {
      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('visualizations')
        .upload(filePath, htmlContent, {
          contentType: 'text/html',
          upsert: false
        })

      if (error) {
        console.error('Supabase upload error:', error)
        throw new Error(`Failed to upload visualization: ${error.message}`)
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('visualizations')
        .getPublicUrl(filePath)

      return { publicUrl, filePath }

    } catch (error) {
      console.error('Storage upload error:', error)
      throw new Error(`Failed to upload to storage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate embed code for the visualization
   */
  private generateEmbedCode(publicUrl: string): string {
    return `<iframe 
  src="${publicUrl}" 
  width="100%" 
  height="600" 
  frameborder="0" 
  style="border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"
  title="Survey Data Visualization">
</iframe>`
  }

  /**
   * Count data points used in visualization
   */
  private countDataPoints(surveyData: any): number {
    if (!surveyData || !surveyData.responses) return 0
    return surveyData.responses.length
  }
}

// Export singleton instance
export const visualizationGenerator = new VisualizationGenerator() 