# Course Creation Fix - Complete Summary

## Problem Identified

When you uploaded 3 URLs and clicked "Create Course", the page loaded briefly then returned to the upload screen without any error message or course being created.

### Root Cause Analysis

After investigating the Supabase edge function logs and database records, I found:

1. **URLs were successfully uploaded** ✅
   - All 3 URLs were scraped successfully
   - Text was extracted: 832, 692, and 7650 characters respectively

2. **Processing failed at embedding generation** ❌
   - The `process-document` edge function returned 500 errors
   - Error: `"Incorrect API key provided: sk-proj-...S30A"`
   - The OpenAI API key configured in Supabase is **invalid or expired**

3. **Error wasn't surfaced to user** ❌
   - The frontend does "fire-and-forget" invocation of the edge function
   - Documents were marked as "error" in the database
   - User was returned to upload screen without clear error messaging

### Technical Details

**Failed Documents (from database):**
```
Document ID: 65a1e580-6ac3-461e-af4a-9e6853efcb2e
File: URL - founders.org/articles/do-not-neglect-your-bible/
Status: error
Extracted: 7650 characters
Error: OpenAI Embedding API error (401)

Document ID: 3a149069-02d4-4f35-b118-187793e59a10
File: URL - founders.org/articles/a-ubiquitous-antidote-to-anxiety/
Status: error
Extracted: 692 characters
Error: OpenAI Embedding API error (401)

Document ID: c85db245-d9c5-40c8-b427-8fd2175e370e
File: URL - founders.org/articles/revelation-driven-life/
Status: error
Extracted: 832 characters
Error: OpenAI Embedding API error (401)
```

## Immediate Fix Required

### **URGENT: Update OpenAI API Key**

See `URGENT_FIX_OPENAI_KEY.md` for detailed instructions.

**Quick Steps:**
1. Go to https://platform.openai.com/api-keys
2. Get a valid API key
3. Update in Supabase Dashboard:
   - Project: https://supabase.com/dashboard/project/zylyphqfzalidclffugh
   - Navigate to Edge Functions → Secrets
   - Update `OPENAI_API_KEY`
4. Test by re-uploading the same URLs

## Improvements Implemented

To prevent this issue from happening again and improve user experience, I've implemented the following:

### 1. Enhanced Error Messaging

**File:** `src/components/knowledge-base/StreamlinedCourseCreator.tsx`

- Improved error detection for OpenAI API key issues
- Better error messages that guide users to contact support
- Multi-line error display for multiple failed documents

**Changes:**
```typescript
// Now detects OpenAI API key errors specifically
if (errorMsg.includes('Incorrect API key') || errorMsg.includes('invalid_api_key')) {
  return `${doc.file_name}: OpenAI API configuration error. Please contact support.`;
}
```

### 2. Document Processing Utilities

**New File:** `src/lib/document-processing-utils.ts`

Created utility functions for:
- `retryFailedDocuments()` - Retry processing for failed documents
- `isRetryableError()` - Determine if an error can be retried
- `getDocumentErrorMessage()` - Get user-friendly error messages
- `getErrorSuggestedActions()` - Get actionable suggestions for users

### 3. Document Error Display Component

**New File:** `src/components/knowledge-base/DocumentProcessingError.tsx`

A new React component that:
- Shows detailed error information for each failed document
- Displays user-friendly error messages
- Provides suggested actions
- Allows retrying documents with retryable errors
- Distinguishes between retryable and non-retryable errors

**Features:**
- Visual error cards with file names
- Suggested actions for each error type
- Retry button for retryable errors
- Loading states during retry

### 4. Document Retry API Endpoint

**New File:** `src/app/api/knowledge-base/retry-documents/route.ts`

A new API endpoint that:
- Accepts an array of document IDs to retry
- Verifies user ownership of documents
- Resets document status from 'error' to 'queued'
- Re-invokes the `process-document` edge function
- Returns detailed results for each retry attempt

**Endpoint:** `POST /api/knowledge-base/retry-documents`

**Request Body:**
```json
{
  "documentIds": ["doc-id-1", "doc-id-2"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Retry initiated for 2 document(s)",
  "results": [
    { "documentId": "doc-id-1", "success": true },
    { "documentId": "doc-id-2", "success": true }
  ]
}
```

## Testing After Fix

### Test Plan

1. **Update OpenAI API Key** (see URGENT_FIX_OPENAI_KEY.md)

2. **Test with Same URLs:**
   ```
   https://founders.org/articles/do-not-neglect-your-bible/
   http://founders.org/articles/a-ubiquitous-antidote-to-anxiety/
   https://founders.org/articles/revelation-driven-life/
   ```

3. **Verify Success:**
   - Documents should process successfully
   - Course creation should complete
   - You should see the course review screen

4. **Test Error Handling (Optional):**
   - Temporarily set an invalid API key
   - Try creating a course
   - Verify error message is clear and helpful
   - Verify retry functionality works after fixing the key

### Verification Queries

**Check document status:**
```sql
SELECT 
  id, 
  file_name, 
  status, 
  created_at,
  (metadata->>'extracted_text_length')::int as text_length
FROM documents
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

**Check for errors:**
```sql
SELECT 
  id, 
  file_name, 
  status,
  metadata->>'processing_error' as error
FROM documents
WHERE status = 'error'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Check document chunks (should exist after successful processing):**
```sql
SELECT 
  d.file_name,
  COUNT(dc.id) as chunk_count
FROM documents d
LEFT JOIN document_chunks dc ON dc.document_id = d.id
WHERE d.created_at > NOW() - INTERVAL '10 minutes'
GROUP BY d.id, d.file_name
ORDER BY d.created_at DESC;
```

## Architecture Overview

### Document Processing Flow

```
User Uploads URL
    ↓
Frontend: /api/knowledge-base/url
    ↓
Create document record (status: 'queued')
    ↓
Invoke edge function (fire-and-forget)
    ↓
Edge Function: process-document
    ├─ Extract text from URL ✅
    ├─ Chunk text ✅
    ├─ Generate embeddings (FAILED - Invalid API Key) ❌
    └─ Update document status to 'error'
    ↓
Frontend: waitForDocumentProcessing()
    ├─ Polls document status every 3 seconds
    ├─ Detects 'error' status
    └─ Throws error with message
    ↓
User sees error toast
User returned to upload screen
```

### With Retry Flow (New)

```
User sees error with details
    ↓
User clicks "Retry Documents"
    ↓
Frontend: /api/knowledge-base/retry-documents
    ↓
Reset document status to 'queued'
    ↓
Re-invoke process-document edge function
    ↓
Processing continues...
```

## Files Modified/Created

### Created Files
1. `URGENT_FIX_OPENAI_KEY.md` - Detailed instructions for fixing the API key
2. `COURSE_CREATION_FIX_SUMMARY.md` - This file
3. `src/lib/document-processing-utils.ts` - Utility functions for document processing
4. `src/components/knowledge-base/DocumentProcessingError.tsx` - Error display component
5. `src/app/api/knowledge-base/retry-documents/route.ts` - Retry API endpoint

### Modified Files
1. `src/components/knowledge-base/StreamlinedCourseCreator.tsx` - Enhanced error messaging

## Next Steps

### Immediate (Required)
1. ✅ **Update OpenAI API Key** in Supabase (see URGENT_FIX_OPENAI_KEY.md)
2. ✅ Test course creation with the same 3 URLs
3. ✅ Verify documents process successfully

### Short-term (Recommended)
1. Integrate the new `DocumentProcessingError` component into the course creator
2. Add monitoring/alerts for OpenAI API key failures
3. Set up API key rotation reminders
4. Add API key validation during deployment

### Long-term (Optional)
1. Implement automatic retry logic for transient errors
2. Add progress indicators for individual document processing
3. Create admin dashboard for monitoring document processing
4. Add API key health checks in admin panel

## Related Documentation

- **Edge Function Code:** `supabase/functions/process-document/index.ts`
- **Frontend Error Handling:** `src/components/knowledge-base/StreamlinedCourseCreator.tsx`
- **URL Upload API:** `src/app/api/knowledge-base/url/route.ts`
- **Supabase Docs:** https://supabase.com/docs/guides/functions/secrets

## Support

If issues persist after updating the API key:

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Edge Functions → Logs
   - Look for `process-document` function errors

2. **Verify API Key:**
   ```bash
   curl https://api.openai.com/v1/embeddings \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"input": "test", "model": "text-embedding-3-small"}'
   ```

3. **Check Database:**
   - Run the verification queries above
   - Look for documents stuck in 'processing' status

4. **Contact Support:**
   - Provide document IDs that failed
   - Include error messages from database
   - Share edge function logs

---

**Last Updated:** January 12, 2026
**Status:** Awaiting OpenAI API key update
