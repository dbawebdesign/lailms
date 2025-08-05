# Quick Fix: Deploy V3 to Production

## 🚀 Fastest Solution: Supabase Edge Functions

Since you already have Supabase, this is the quickest way to get V3 working in production.

### Step 1: Deploy Edge Function

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Initialize (if not done)
supabase init

# Deploy the edge function
supabase functions deploy generate-course-v3
```

### Step 2: Update API Route

Replace the current `processV2GenerationJob` call in `/api/course-generation/v2/route.ts`:

```typescript
// OLD (Won't work on Vercel):
processV2GenerationJob(jobId, generationRequest, supabase).catch(error => {
  console.error('V2 Course generation failed:', error);
});

// NEW (Works on Vercel):
// Call Supabase Edge Function instead
const { error: functionError } = await supabase.functions.invoke('generate-course-v3', {
  body: { 
    jobId, 
    outline: courseOutline, 
    request: generationRequest 
  }
});

if (functionError) {
  console.error('Failed to start edge function:', functionError);
  await updateJobStatus(jobId, 'failed', 0, supabase, functionError.message);
}
```

### Step 3: Set Environment Variables

In Supabase Dashboard > Edge Functions > generate-course-v3 > Settings:

```env
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
PERPLEXITY_API_KEY=your-key-here
```

### Step 4: Bundle V3 Orchestrator for Deno

Since Edge Functions use Deno, you'll need to bundle your TypeScript code:

```bash
# Install deno if not already
curl -fsSL https://deno.land/x/install/install.sh | sh

# Create a bundled version
deno bundle src/lib/services/course-generation-orchestrator-v3.ts supabase/functions/generate-course-v3/orchestrator.bundle.js
```

## Alternative: Use Vercel Cron (Free but Limited)

If you want to stay entirely on Vercel:

### 1. Create Cron Route

`app/api/cron/process-courses/route.ts`:
```typescript
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  
  // Get next queued job
  const { data: job } = await supabase
    .from('course_generation_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
    
  if (!job) {
    return Response.json({ message: 'No jobs to process' });
  }
  
  // Process for 9 seconds (leaving 1 second buffer)
  const timeout = setTimeout(() => {
    // Will be interrupted but job continues in next cron
  }, 9000);
  
  try {
    // Start processing
    await processV2GenerationJob(job.id, job.generation_config, supabase);
    clearTimeout(timeout);
  } catch (error) {
    clearTimeout(timeout);
    // Job will retry in next cron run
  }
  
  return Response.json({ processed: job.id });
}
```

### 2. Add to vercel.json

```json
{
  "crons": [{
    "path": "/api/cron/process-courses",
    "schedule": "* * * * *"  // Every minute
  }]
}
```

## 🎯 Which Option to Choose?

### Supabase Edge Functions (Recommended)
✅ No timeout issues  
✅ Runs to completion  
✅ Same infrastructure  
✅ Free tier available  
❌ Requires bundling code for Deno

### Vercel Cron
✅ No additional services  
✅ Stays on Vercel  
❌ Only 10-second execution  
❌ Will take many cron runs to complete  
❌ Limited to 1 job per minute

## Testing in Production

1. Deploy your chosen solution
2. Create a test course generation
3. Monitor logs:
   - Vercel Functions logs
   - Supabase Edge Function logs
   - Database job status

## Monitoring

Add this to track job duration:

```sql
SELECT 
  id,
  status,
  created_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - created_at))/60 as duration_minutes
FROM course_generation_jobs
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

---

**Remember:** The current code will timeout on Vercel. You MUST implement one of these solutions before deploying to production!