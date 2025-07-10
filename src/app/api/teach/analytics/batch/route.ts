import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AssessmentAnalyticsService } from '@/lib/services/assessment-analytics-service';

// POST /api/teach/analytics/batch - Batch analytics operations
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const analyticsService = new AssessmentAnalyticsService();
    
    const { operations } = await request.json();
    
    if (!operations || !Array.isArray(operations)) {
      return NextResponse.json(
        { error: 'Invalid operations array' },
        { status: 400 }
      );
    }
    
    const results = [];
    
    for (const operation of operations) {
      try {
        let result;
        
        switch (operation.type) {
          case 'student-results':
            result = await analyticsService.getStudentResults(
              operation.userId,
              operation.baseClassId,
              operation.assessmentId
            );
            break;
            
          case 'user-progress':
            result = await analyticsService.getUserProgress(
              operation.userId,
              operation.baseClassId
            );
            break;
            
          case 'assessment-analytics':
            result = await analyticsService.getAssessmentAnalytics(
              operation.assessmentId
            );
            break;
            
          case 'generate-insights':
            result = await analyticsService.generateInsights(
              operation.userId,
              operation.assessmentId
            );
            break;
            
          default:
            result = { error: `Unknown operation type: ${operation.type}` };
        }
        
        results.push({
          id: operation.id,
          type: operation.type,
          success: true,
          data: result
        });
        
      } catch (error) {
        results.push({
          id: operation.id,
          type: operation.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        results,
        processed: operations.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    console.error('Batch analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch analytics' },
      { status: 500 }
    );
  }
}
