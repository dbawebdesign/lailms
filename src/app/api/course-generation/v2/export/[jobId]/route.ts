import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CourseGenerationAnalytics } from '@/lib/services/course-generation-analytics';
import { ExportReportOptions, CourseGenerationReport } from '@/types/course-generation';

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse export options
    const options: ExportReportOptions = await request.json();
    const { format = 'json', includeAnalytics = true, includeTasks = true, includeErrors = true, includePerformance = true } = options;

    // Verify job ownership
    const { data: job } = await supabase
      .from('course_generation_jobs')
      .select('*')
      .eq('id', params.jobId)
      .eq('user_id', user.id)
      .single();

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' }, 
        { status: 404 }
      );
    }

    // Generate comprehensive report
    const report = await generateComprehensiveReport(params.jobId, options);

    // Format based on requested format
    switch (format) {
      case 'json':
        return NextResponse.json(report, {
          headers: {
            'Content-Disposition': `attachment; filename="course-generation-report-${params.jobId}.json"`,
            'Content-Type': 'application/json'
          }
        });

      case 'csv':
        const csvContent = await generateCSVReport(report);
        return new NextResponse(csvContent, {
          headers: {
            'Content-Disposition': `attachment; filename="course-generation-report-${params.jobId}.csv"`,
            'Content-Type': 'text/csv'
          }
        });

      case 'pdf':
        const pdfBuffer = await generatePDFReport(report);
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Disposition': `attachment; filename="course-generation-report-${params.jobId}.pdf"`,
            'Content-Type': 'application/pdf'
          }
        });

      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }

  } catch (error) {
    console.error('Failed to export report:', error);
    return NextResponse.json(
      { error: 'Failed to export report' }, 
      { status: 500 }
    );
  }
}

async function generateComprehensiveReport(
  jobId: string,
  options: ExportReportOptions
): Promise<CourseGenerationReport> {
  const supabase = createSupabaseServerClient();
  const analytics = new CourseGenerationAnalytics();

  // Fetch job data
  const { data: job } = await supabase
    .from('course_generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  // Fetch tasks if requested
  let tasks = [];
  if (options.includeTasks) {
    const { data: taskData } = await supabase
      .from('course_generation_tasks')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    tasks = taskData || [];
  }

  // Fetch errors if requested
  let errors = [];
  if (options.includeErrors) {
    const { data: errorData } = await supabase
      .from('course_generation_errors')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    errors = errorData || [];
  }

  // Fetch analytics if requested
  let analyticsData = null;
  if (options.includeAnalytics) {
    const { data: analyticsResult } = await supabase
      .from('course_generation_analytics')
      .select('*')
      .eq('job_id', jobId)
      .single();
    analyticsData = analyticsResult;
  }

  // Fetch user actions
  const { data: userActions } = await supabase
    .from('course_generation_user_actions')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  // Calculate summary metrics
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
  const totalDuration = job?.actual_completion_time && job?.started_at
    ? (new Date(job.actual_completion_time).getTime() - new Date(job.started_at).getTime()) / 1000
    : 0;

  const successRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
  const totalCost = analyticsData?.estimated_cost_usd || 0;

  // Generate recommendations
  const recommendations = generateRecommendations(job, tasks, errors);

  const report: CourseGenerationReport = {
    job,
    tasks,
    errors,
    analytics: analyticsData,
    userActions: userActions || [],
    summary: {
      duration: totalDuration,
      successRate,
      totalCost,
      recommendations
    }
  };

  return report;
}

async function generateCSVReport(report: CourseGenerationReport): Promise<string> {
  const lines = [];
  
  // Header
  lines.push('Course Generation Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Job ID: ${report.job.id}`);
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push(`Duration (seconds),${report.summary.duration}`);
  lines.push(`Success Rate (%),${report.summary.successRate.toFixed(2)}`);
  lines.push(`Total Cost (USD),${report.summary.totalCost.toFixed(4)}`);
  lines.push('');

  // Tasks
  if (report.tasks.length > 0) {
    lines.push('TASKS');
    lines.push('Task ID,Type,Status,Duration (s),Error Message');
    
    report.tasks.forEach(task => {
      lines.push([
        task.id,
        task.task_type,
        task.status,
        task.actual_duration_seconds || 0,
        (task.error_message || '').replace(/,/g, ';')
      ].join(','));
    });
    lines.push('');
  }

  // Errors
  if (report.errors.length > 0) {
    lines.push('ERRORS');
    lines.push('Error ID,Category,Severity,Message,Task ID');
    
    report.errors.forEach(error => {
      lines.push([
        error.id,
        error.error_category,
        error.error_severity,
        (error.error_message || '').replace(/,/g, ';'),
        error.task_id || ''
      ].join(','));
    });
    lines.push('');
  }

  // Recommendations
  if (report.summary.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS');
    report.summary.recommendations.forEach((rec, index) => {
      lines.push(`${index + 1}. ${rec}`);
    });
  }

  return lines.join('\n');
}

async function generatePDFReport(report: CourseGenerationReport): Promise<Buffer> {
  // For a real implementation, you'd use a PDF generation library like puppeteer or jsPDF
  // This is a placeholder that returns a simple text-based "PDF"
  
  const content = `
COURSE GENERATION REPORT
========================

Job ID: ${report.job.id}
Generated: ${new Date().toISOString()}

SUMMARY
-------
Duration: ${report.summary.duration} seconds
Success Rate: ${report.summary.successRate.toFixed(2)}%
Total Cost: $${report.summary.totalCost.toFixed(4)}

TASK BREAKDOWN
--------------
Total Tasks: ${report.tasks.length}
Completed: ${report.tasks.filter(t => t.status === 'completed').length}
Failed: ${report.tasks.filter(t => t.status === 'failed').length}
Skipped: ${report.tasks.filter(t => t.status === 'skipped').length}

ERROR ANALYSIS
--------------
Total Errors: ${report.errors.length}
Critical: ${report.errors.filter(e => e.error_severity === 'critical').length}
High: ${report.errors.filter(e => e.error_severity === 'high').length}
Medium: ${report.errors.filter(e => e.error_severity === 'medium').length}
Low: ${report.errors.filter(e => e.error_severity === 'low').length}

RECOMMENDATIONS
---------------
${report.summary.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

PERFORMANCE METRICS
-------------------
${report.analytics ? `
API Calls: ${report.analytics.api_calls_made}
Tokens Consumed: ${report.analytics.tokens_consumed}
Cache Hit Rate: ${report.analytics.cache_hit_rate}%
Peak Memory: ${report.analytics.peak_memory_usage_mb} MB
` : 'Analytics not available'}
`;

  return Buffer.from(content, 'utf-8');
}

function generateRecommendations(
  job: any,
  tasks: any[],
  errors: any[]
): string[] {
  const recommendations = [];
  
  const successRate = tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0;
  const criticalErrors = errors.filter(e => e.error_severity === 'critical').length;
  const apiErrors = errors.filter(e => e.error_category?.includes('api')).length;
  
  if (successRate < 90) {
    recommendations.push('Success rate is below 90% - review error patterns and consider improving retry strategies');
  }
  
  if (criticalErrors > 0) {
    recommendations.push(`${criticalErrors} critical errors detected - these require immediate attention`);
  }
  
  if (apiErrors > errors.length * 0.5) {
    recommendations.push('High number of API-related errors - consider implementing rate limiting or upgrading API plan');
  }
  
  if (tasks.filter(t => t.status === 'skipped').length > 0) {
    recommendations.push('Some tasks were skipped - verify if this affects course completeness');
  }
  
  const avgTaskTime = tasks.reduce((sum, t) => sum + (t.actual_duration_seconds || 0), 0) / tasks.length;
  if (avgTaskTime > 30) {
    recommendations.push('Average task time is high - consider optimizing prompts or reducing complexity');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Generation completed successfully with no major issues detected');
  }
  
  return recommendations;
} 