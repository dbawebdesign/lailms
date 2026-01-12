# URGENT: Fix OpenAI API Key for Document Processing

## Problem
The course creation is failing because the OpenAI API key configured in Supabase Edge Functions is **invalid or expired**.

### Error Details
```
OpenAI Embedding API error (401): Incorrect API key provided: sk-proj-...S30A
```

### What's Happening
1. ✅ URLs are being uploaded successfully
2. ✅ Text is being extracted from URLs (832, 692, and 7650 characters extracted)
3. ❌ **Embedding generation fails** due to invalid OpenAI API key
4. ❌ Documents are marked as "error" status
5. ❌ Course creation stops and returns user to upload screen

## Solution: Update OpenAI API Key

### Step 1: Get a Valid OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create a new API key or copy an existing valid key
3. Make sure the key has access to the `text-embedding-3-small` model

### Step 2: Update Supabase Edge Function Secrets

You need to update the `OPENAI_API_KEY` secret in your Supabase project. You can do this in two ways:

#### Option A: Via Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/zylyphqfzalidclffugh
2. Navigate to **Edge Functions** → **Secrets**
3. Find `OPENAI_API_KEY` and update it with your new key
4. Click **Save**

#### Option B: Via Supabase CLI
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref zylyphqfzalidclffugh

# Set the OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE
```

### Step 3: Verify the Fix

After updating the key, test by:
1. Going back to the course creation page
2. Adding the same 3 URLs again:
   - https://founders.org/articles/do-not-neglect-your-bible/
   - http://founders.org/articles/a-ubiquitous-antidote-to-anxiety/
   - https://founders.org/articles/revelation-driven-life/
3. Click "Create Course"
4. Wait for processing to complete

### Step 4: Check Document Status

You can verify documents are processing correctly by running this SQL query in Supabase:

```sql
SELECT 
  id, 
  file_name, 
  status, 
  created_at,
  (metadata->>'extracted_text_length')::int as text_length,
  metadata->>'processing_error' as error
FROM documents
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

## Additional Notes

### Why This Happened
- The OpenAI API key was likely rotated or expired
- The edge function uses this key to generate embeddings for document chunks
- Without valid embeddings, documents can't be processed for course generation

### Prevention
- Set up API key rotation reminders
- Monitor edge function logs for authentication errors
- Consider adding API key validation checks during deployment

### Related Files
- Edge Function: `supabase/functions/process-document/index.ts`
- Frontend Error Handling: `src/components/knowledge-base/StreamlinedCourseCreator.tsx` (lines 126-135)
- API Route: `src/app/api/knowledge-base/url/route.ts`

## Need Help?
If you continue to experience issues after updating the API key:
1. Check the Supabase Edge Function logs for new errors
2. Verify the API key has sufficient credits/quota
3. Test the API key directly with a curl command:

```bash
curl https://api.openai.com/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "input": "Test embedding",
    "model": "text-embedding-3-small"
  }'
```

Expected response: JSON with embedding array (should not return 401 error)
