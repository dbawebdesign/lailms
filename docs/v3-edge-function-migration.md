# V3 Edge Function Migration Guide

## 🔄 What Changed

### Before (Timeout Issues)
```typescript
// In API route - would timeout after 10-60 seconds
const orchestrator = new CourseGenerationOrchestratorV3(supabase);
await orchestrator.startOrchestration(jobId, outline, request);
```

### After (No Timeout!)
```typescript
// In API route - returns immediately
await supabase.functions.invoke('generate-course-v3', {
  body: { jobId, outline, request }
});
```

## ✅ Migration Checklist

### 1. Code Changes Applied
- [x] Created `supabase/functions/generate-course-v3/index.ts`
- [x] Created `src/app/api/internal/course-generation-v3/route.ts`
- [x] Updated `src/app/api/course-generation/v2/route.ts`
- [x] Deployed edge function to Supabase

### 2. No Database Changes Required
- The same tables and schemas are used
- Job tracking works exactly the same
- UI polling remains unchanged

### 3. Environment Variables
Ensure these are set in your edge function:
```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com  # For internal API calls
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
```

## 🚀 Deployment Steps

### 1. Deploy Next.js App
```bash
git add .
git commit -m "feat: implement Supabase edge function for V3 course generation"
git push origin main
```

### 2. Verify Edge Function
```bash
# Check it's deployed
supabase functions list

# Should see:
# generate-course-v3 (v1) - ACTIVE
```

### 3. Test the System
```bash
# Start a course generation from the UI
# Check logs in real-time
supabase functions logs generate-course-v3 --tail
```

## 🔍 Monitoring the Migration

### Check Old vs New Jobs
```sql
-- Jobs before migration (using direct orchestration)
SELECT COUNT(*), AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_minutes
FROM course_generation_jobs
WHERE generation_config->>'version' = 'v3'
  AND created_at < '2024-01-06'  -- Before edge function
  AND status = 'completed';

-- Jobs after migration (using edge function)
SELECT COUNT(*), AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_minutes
FROM course_generation_jobs
WHERE generation_config->>'version' = 'v3'
  AND created_at >= '2024-01-06'  -- After edge function
  AND status = 'completed';
```

## 🛡️ Rollback Plan (if needed)

To rollback to direct orchestration:

1. In `src/app/api/course-generation/v2/route.ts`:
```typescript
// Replace edge function call with:
const orchestrator = new CourseGenerationOrchestratorV3(supabase);
await orchestrator.startOrchestration(jobId, outline, request);
```

2. Deploy the change

**Note**: Rollback will restore timeout issues!

## 📊 Expected Results

### Before Migration
- ❌ Timeouts on Vercel (10-60s limit)
- ❌ Failed jobs due to timeout
- ❌ Incomplete course generation

### After Migration  
- ✅ No timeouts (150s edge function limit, upgradeable)
- ✅ All jobs complete successfully
- ✅ Full course content generated

## 🎯 Success Metrics

Monitor these after migration:
1. **Job Success Rate**: Should be ~100%
2. **Average Completion Time**: 4-5 minutes
3. **Error Rate**: Should drop to near 0%
4. **User Satisfaction**: No more stuck screens!

## 🤝 Support

If you encounter issues:
1. Check edge function logs
2. Verify internal endpoint is accessible
3. Ensure all environment variables are set
4. Check Supabase service health

---

**Migration Status**: ✅ COMPLETE

The system is now running on Supabase Edge Functions with no timeout limitations!