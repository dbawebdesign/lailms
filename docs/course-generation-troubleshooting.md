# Course Generation Troubleshooting Guide

## Overview

This guide covers troubleshooting stuck or failed course generation jobs in your Vercel deployment, including using the new monitoring and recovery features.

## Recent Improvements (Fixed in Latest Update)

### ✅ Timeout Handling
- **OpenAI API Timeout**: Added 2-minute timeout with 2 retries
- **Task Timeout**: 10-minute maximum per individual task
- **Content Generation Timeout**: 4-minute timeout for section content generation
- **Custom Timeout Wrapper**: Race conditions between API calls and timeouts

### ✅ Error Handling & Logging
- **Comprehensive Error Logging**: All failures now logged with context
- **Retry Logic**: Failed tasks automatically retry once with 5-second delay
- **Fallback Content**: Automatic fallback content generation if AI fails
- **Database Error Tracking**: Failed jobs marked in database with error details

### ✅ Serverless Reliability
- **Improved Task Scheduling**: Promise-based delays instead of setTimeout
- **Concurrent Task Limiting**: Maximum 3 concurrent tasks to avoid overwhelming OpenAI
- **Progress Persistence**: Real-time progress updates saved to database
- **State Monitoring**: Periodic health checks and cleanup

### ✅ Monitoring & Recovery
- **Health Check Endpoint**: Monitor stuck jobs and get recovery recommendations
- **Progress Tracking**: Detailed task status and timing information
- **Automatic Cleanup**: Memory state cleanup after completion or timeout

## Troubleshooting Steps

### 1. Check Job Status
First, check if your job is actually stuck or just taking time:

```bash
# Check the health of all your generation jobs
GET /api/knowledge-base/generation-jobs/health-check
```

This will return:
- **Stuck jobs**: Jobs running for 30+ minutes without progress
- **Healthy jobs**: Jobs making normal progress
- **Recommendations**: Specific actions to take

### 2. Monitor Job Progress
Check detailed progress for a specific job:

```bash
# Get detailed status for a specific job
GET /api/knowledge-base/generation-status/{jobId}
```

Look for:
- **isLive**: Whether the job has active orchestration state
- **tasks**: Array of individual tasks with status and timing
- **running_tasks**: Number of currently executing tasks
- **failed_tasks**: Number of failed tasks

### 3. Recover Stuck Jobs
If a job is confirmed stuck, you can recover it:

```bash
# Recover a stuck job
POST /api/knowledge-base/generation-jobs/health-check
{
  "action": "recover",
  "jobId": "your-job-id"
}
```

This will:
- Mark the job as failed in the database
- Allow you to restart the generation process
- Clean up any hanging state

## Common Issues & Solutions

### Issue: "Job started but no progress after 30+ minutes"

**Symptoms:**
- Status shows "running" but progress stays at 0%
- No new log entries in the generation status
- Frontend keeps polling but nothing changes

**Likely Causes:**
1. **OpenAI API Key Issues**: Invalid or missing API key
2. **Rate Limiting**: Too many concurrent requests to OpenAI
3. **Network Timeouts**: API calls timing out without proper error handling
4. **Memory State Loss**: Serverless environment lost orchestration state

**Solutions:**
1. **Check Environment Variables**:
   ```bash
   # Verify in Vercel dashboard that OPENAI_API_KEY is set
   ```

2. **Use Health Check Endpoint**:
   ```bash
   GET /api/knowledge-base/generation-jobs/health-check
   ```

3. **Recover the Job**:
   ```bash
   POST /api/knowledge-base/generation-jobs/health-check
   {
     "action": "recover",
     "jobId": "stuck-job-id"
   }
   ```

4. **Restart Generation**: Try generating the course again

### Issue: "Tasks failing with timeout errors"

**Symptoms:**
- Tasks marked as "failed" with timeout error messages
- Generation progresses slowly or stops
- OpenAI API timeout errors in logs

**Solutions:**
- **Automatic Retry**: The system now automatically retries failed tasks once
- **Extended Timeouts**: Increased timeouts for complex content generation
- **Rate Limiting**: Reduced concurrent tasks to avoid overwhelming OpenAI API

### Issue: "Generation works locally but fails on Vercel"

**Symptoms:**
- Course generation works in development
- Fails or gets stuck in production
- Different behavior between environments

**Likely Causes:**
1. **Environment Variables**: Missing or different API keys
2. **Serverless Timeouts**: Vercel function timeouts
3. **Memory Limits**: Serverless memory constraints

**Solutions:**
1. **Check Vercel Environment Variables**: Ensure `OPENAI_API_KEY` is properly set
2. **Monitor Function Logs**: Check Vercel function logs for timeout errors
3. **Use Health Check**: The health check endpoint works in production

## Monitoring Best Practices

### 1. Regular Health Checks
Run health checks periodically to catch issues early:

```javascript
// Example monitoring script
async function monitorGenerationJobs() {
  const response = await fetch('/api/knowledge-base/generation-jobs/health-check');
  const data = await response.json();
  
  if (data.stuck_jobs.length > 0) {
    console.warn(`Found ${data.stuck_jobs.length} stuck jobs:`, data.stuck_jobs);
    // Consider automated recovery or alerts
  }
}

// Run every 10 minutes
setInterval(monitorGenerationJobs, 10 * 60 * 1000);
```

### 2. Log Analysis
Key log messages to watch for:

```bash
# Good progress indicators
"🚀 Starting task: lesson_section"
"✅ Completed task: lesson_section"
"📊 Progress updated: X/Y completed"

# Warning signs
"❌ OpenAI operation failed"
"⚠️ Task failed, retrying"
"Task timeout: lesson_section exceeded 600000ms"

# Critical errors
"❌ Failed task after retry"
"OpenAI API timeout after 180000ms"
```

### 3. Performance Monitoring
Track these metrics:
- **Average task completion time**: Should be 1-3 minutes per section
- **Failure rate**: Should be less than 5% with retries
- **Stuck job frequency**: Should be rare with new timeout handling

## Prevention Tips

1. **Verify API Keys**: Ensure `OPENAI_API_KEY` is valid and has sufficient quota
2. **Monitor Usage**: Check OpenAI usage dashboard for rate limits
3. **Test Smaller Courses**: Start with shorter courses to verify system health
4. **Use Health Checks**: Regular monitoring prevents issues from going unnoticed

## Getting Help

If issues persist after following this guide:

1. **Check Health Status**: Use the health check endpoint first
2. **Collect Job ID**: Note the specific job ID that's having issues
3. **Check Logs**: Look for specific error messages in Vercel function logs
4. **Recovery Action**: Try the recovery endpoint before restarting

The new monitoring and recovery features should resolve most timeout and stuck job issues automatically. 