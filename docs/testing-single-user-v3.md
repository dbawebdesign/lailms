# Testing Course Generation V3 for Single User

This guide explains how to test the optimized V3 course generation system for a single user before scaling to multiple users.

## Prerequisites

1. **Environment Variables**: Ensure all required environment variables are set in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   ```

2. **Database Setup**: All migration tables should be created (already done if you followed the setup).

## Step 1: Verify System Setup

Run the verification script to ensure everything is properly configured:

```bash
npm run verify:v3
```

This will check:
- ✅ Environment variables
- ✅ Module imports and dependencies
- ✅ Database connection
- ✅ Required tables (queue, rate limits, logs, alerts, cache)
- ✅ API route configuration

All checks should pass before proceeding.

## Step 2: Test Through the UI (Recommended)

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Log into your application** as a teacher or admin user

3. **Navigate to course generation** and create a new course with these test parameters:
   - Title: "Test Course V3"
   - Description: "Testing V3 optimizations"
   - Duration: 2 weeks
   - 2 lessons per week
   - Include assessments

4. **Monitor the generation process**:
   - Check the UI progress indicators
   - Open browser dev tools to see console logs
   - Watch for any errors

## Step 3: Monitor Database Activity

While the course is generating, monitor the database to verify all V3 features are working:

### Check Rate Limiting
```sql
-- View current rate limits for your user
SELECT * FROM course_generation_rate_limits 
WHERE user_id = 'your-user-id';
```

### Monitor Logs
```sql
-- View generation logs in real-time
SELECT * FROM course_generation_logs 
WHERE job_id = 'current-job-id'
ORDER BY timestamp DESC;
```

### Check Task Progress
```sql
-- See task distribution and status
SELECT task_type, status, COUNT(*) as count
FROM course_generation_tasks 
WHERE job_id = 'current-job-id'
GROUP BY task_type, status
ORDER BY task_type;
```

### Verify Cache Usage
```sql
-- Check if content is being cached
SELECT * FROM course_generation_cache 
ORDER BY created_at DESC
LIMIT 10;
```

## Step 4: Verify V3 Features

### 1. **Structured Outputs**
- Check that all generated content follows the defined schemas
- Look for validation logs in `course_generation_logs`
- Verify no malformed JSON errors

### 2. **Rate Limiting**
- Confirm rate limit counters increment properly
- Test hitting rate limits by generating multiple courses quickly
- Verify proper error messages when rate limited

### 3. **Database Logging**
- All major operations should create log entries
- Error logs should include stack traces and recovery suggestions
- Info logs should track progress milestones

### 4. **Model Optimization**
- Verify that `gpt-4.1-mini` is being used (check logs for model selection)
- Confirm faster generation times compared to previous versions

## Step 5: Test Error Recovery

1. **Simulate Network Issues**:
   - Temporarily disable internet during generation
   - Verify circuit breaker activates
   - Check that job can resume when connection restored

2. **Test Invalid Content**:
   - Monitor how the system handles and retries failed validations
   - Check that proper error messages are logged

## Expected Results for Single User

✅ **Performance Metrics**:
- Course outline: ~5-10 seconds
- Per lesson content: ~15-30 seconds  
- Total 4-lesson course: ~2-3 minutes

✅ **Database Activity**:
- ~50-100 log entries per course
- 1 rate limit record tracking usage
- 4-8 cache entries for similar content
- All tasks should complete with 'completed' status

✅ **Quality Checks**:
- All content validates against schemas
- No JSON parsing errors
- Consistent formatting across lessons
- Proper error handling and recovery

## Troubleshooting

### Issue: Rate limit hit immediately
**Solution**: Check the rate limits table and reset if needed:
```sql
DELETE FROM course_generation_rate_limits WHERE user_id = 'your-user-id';
```

### Issue: No logs appearing
**Solution**: Verify the logger is initialized in V3 orchestrator and database logging is enabled.

### Issue: Slow performance
**Solution**: Check if caching is working and verify `gpt-4.1-mini` model is being used.

### Issue: Validation errors
**Solution**: Check the course_generation_logs table for detailed validation error messages.

## Next Steps

Once single-user testing is successful:
1. Test with 2-3 concurrent users
2. Gradually increase load
3. Monitor system metrics
4. Proceed to Phase 2 optimizations (queue system, dynamic concurrency)

## Monitoring Commands

```bash
# Watch logs in real-time (requires database client)
watch -n 2 "psql -c \"SELECT * FROM course_generation_logs ORDER BY timestamp DESC LIMIT 10\""

# Monitor task progress
watch -n 5 "psql -c \"SELECT task_type, status, COUNT(*) FROM course_generation_tasks GROUP BY task_type, status\""
```

Remember: The goal is to ensure **perfect operation for one user** before scaling. Take time to verify each component works correctly!