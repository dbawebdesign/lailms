import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { authorizeDocumentProcessing } from './authorize.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { YoutubeTranscript } from 'npm:youtube-transcript';
// @ts-ignore
import { getDocument } from 'https://esm.sh/pdfjs-serverless@1.0.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth, referer, user-agent, accept',
  'Access-Control-Max-Age': '86400',
};

console.log(`Function "process-document" booting up!`);

interface ProcessRequest {
  documentId: string;
}

interface DocumentRecord {
  id: string;
  organisation_id: string;
  storage_path: string;
  file_name: string | null;
  file_type: string | null;
  metadata: Record<string, any> | null;
  base_class_id?: string | null;
}

type DocumentStatus = 'queued' | 'processing' | 'completed' | 'error';
type DocumentType = 'pdf' | 'youtube' | 'url' | 'txt' | 'audio' | 'image';

interface ChunkingOptions {
  chunkSize?: number;
  overlap?: number;
}

interface Chunk {
  content: string;
  metadata: Record<string, any>;
  chunk_index: number;
  section_identifier?: string;
}

async function updateDocumentStatus(supabase: SupabaseClient, documentId: string, status: DocumentStatus, metadataUpdate: Record<string, any> = {}) {
    try {
        const { data: currentDoc, error: fetchErr } = await supabase.from('documents').select('metadata').eq('id', documentId).single();
        if (fetchErr) {
          console.error(`PROCESS-DOCUMENT: Error fetching current metadata for ${documentId}:`, fetchErr);
        }
        const existingMetadata = currentDoc?.metadata || {};
        const sanitizedUpdate = JSON.parse(JSON.stringify(metadataUpdate, (key, value)=>{
          if (typeof value === 'function') return '[Function]';
          if (value instanceof Error) return {
            message: value.message,
            name: value.name
          };
          return value;
        }));
        const newMetadata = {
          ...existingMetadata,
          ...sanitizedUpdate
        };
        newMetadata.last_status_update = new Date().toISOString();
        newMetadata.status_history = newMetadata.status_history || [];
        newMetadata.status_history.push({
          status,
          timestamp: new Date().toISOString(),
          metadata_keys: Object.keys(sanitizedUpdate)
        });
        const updateData = {
          status,
          metadata: newMetadata,
          updated_at: new Date().toISOString()
        };
        console.log(`PROCESS-DOCUMENT: Updating document ${documentId} to status '${status}' with metadata keys: [${Object.keys(metadataUpdate).join(', ')}]`);
        const { error } = await supabase.from('documents').update(updateData).eq('id', documentId);
        if (error) {
          console.error(`PROCESS-DOCUMENT: Failed to update document ${documentId} to status ${status}:`, error);
          console.error('PROCESS-DOCUMENT: Update data that failed:', JSON.stringify(updateData, null, 2));
          throw new Error(`Database update failed: ${error.message}`);
        } else {
          console.log(`PROCESS-DOCUMENT: Successfully updated document ${documentId} to status '${status}'`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`PROCESS-DOCUMENT: updateDocumentStatus failed for ${documentId}:`, errorMessage);
        throw error;
      }
}

function sanitizeTextForDatabase(text: string): string {
    if (!text) return text;
    return text.replace(/\u0000/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

async function extractTextFromPdf(filePath: string, supabase: SupabaseClient, bucketName: string, onProgress?: (pagesProcessed: number, totalPages: number, textLength: number) => void): Promise<string> {
    console.log(`Attempting to extract text from PDF: ${filePath} in bucket ${bucketName}`);
    try {
      const { data: pdfFileData, error: downloadError } = await supabase.storage.from(bucketName).download(filePath);
      if (downloadError || !pdfFileData) {
        throw new Error(`Failed to download PDF file ${filePath} from storage: ${downloadError?.message}`);
      }
      const pdfBuffer = await pdfFileData.arrayBuffer();
      const uint8 = new Uint8Array(pdfBuffer);
      const extractedText = await extractAndValidatePdfText(uint8, filePath, (pagesProcessed, totalPages, currentText)=>{
        if (onProgress && typeof pagesProcessed === 'number' && typeof totalPages === 'number' && currentText !== null && currentText !== undefined) {
          onProgress(pagesProcessed, totalPages, currentText.length);
        }
      });
      console.log(`Successfully extracted ~${extractedText.length} characters from PDF ${filePath}.`);
      return extractedText;
    } catch (error) {
      console.error(`Error extracting text from PDF ${filePath}:`, error instanceof Error ? error.message : String(error));
      throw new Error(`Failed to extract text from PDF ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function extractAndValidatePdfText(uint8: Uint8Array, filePath: string, onProgress?: (pagesProcessed: number, totalPages: number, currentText: string) => void): Promise<string> {
    console.log(`Processing PDF with ultra-robust large file handling`);
    const startTime = Date.now();
    const MAX_PROCESSING_TIME = 6 * 60 * 1000;
    const SAFE_MEMORY_LIMIT = 75 * 1024 * 1024;
    let pdfDoc: any = null;
    try {
      console.log(`Loading PDF document with conservative settings...`);
      const loadingTask = getDocument({
        data: uint8,
        maxImageSize: 256 * 1024,
        disableFontFace: true,
        disableRange: false,
        disableStream: false,
        disableAutoFetch: true,
        verbosity: 0,
        useSystemFonts: false,
        standardFontDataUrl: null,
        ignoreErrors: true,
        stopAtErrors: false
      });
      const loadingTimeout = new Promise((_, reject)=>{
        setTimeout(()=>reject(new Error('PDF loading timed out after 45 seconds')), 45000);
      });
      pdfDoc = await Promise.race([
        loadingTask.promise,
        loadingTimeout
      ]);
      if (!pdfDoc) {
        throw new Error('Failed to load PDF document - pdfDoc is null');
      }
      if (!pdfDoc.numPages || typeof pdfDoc.numPages !== 'number' || pdfDoc.numPages <= 0) {
        throw new Error(`Invalid PDF - numPages is ${pdfDoc.numPages}`);
      }
      let allText = '';
      let readablePages = 0;
      let totalTextLength = 0;
      const totalPages = pdfDoc.numPages;
      console.log(`PDF has ${totalPages} pages`);
      if (onProgress && typeof totalPages === 'number') {
        onProgress(0, totalPages, '');
      }
      let pagesToProcess = [];
      let processingStrategy = 'complete';
      if (totalPages > 250) {
        processingStrategy = 'sampled';
        const sampleSize = Math.min(200, Math.floor(totalPages * 0.7));
        const beginningPages = Math.floor(sampleSize * 0.4);
        const middlePages = Math.floor(sampleSize * 0.3);
        const endPages = Math.floor(sampleSize * 0.2);
        const randomPages = sampleSize - beginningPages - middlePages - endPages;
        for(let i = 1; i <= beginningPages; i++){
          pagesToProcess.push(i);
        }
        const middleStart = Math.floor(totalPages * 0.4);
        const middleEnd = Math.floor(totalPages * 0.7);
        const middleStep = Math.max(1, Math.floor((middleEnd - middleStart) / middlePages));
        for(let i = 0; i < middlePages; i++){
          const pageNum = middleStart + i * middleStep;
          if (pageNum <= totalPages && !pagesToProcess.includes(pageNum)) {
            pagesToProcess.push(pageNum);
          }
        }
        for(let i = totalPages - endPages + 1; i <= totalPages; i++){
          if (i > 0 && !pagesToProcess.includes(i)) {
            pagesToProcess.push(i);
          }
        }
        for(let i = 0; i < randomPages && pagesToProcess.length < sampleSize; i++){
          let randomPage;
          let attempts = 0;
          do {
            randomPage = Math.floor(Math.random() * totalPages) + 1;
            attempts++;
          }while (pagesToProcess.includes(randomPage) && attempts < 20)
          if (!pagesToProcess.includes(randomPage)) {
            pagesToProcess.push(randomPage);
          }
        }
        pagesToProcess.sort((a, b)=>a - b);
        console.log(`LARGE DOCUMENT DETECTED: Processing ${pagesToProcess.length} sampled pages from ${totalPages} total pages`);
        console.log(`Sampling strategy: ${beginningPages} beginning + ${middlePages} middle + ${endPages} end + ${randomPages} random pages`);
        console.log(`Sample pages: ${pagesToProcess.slice(0, 10).join(', ')}${pagesToProcess.length > 10 ? '...' : ''}`);
      } else {
        for(let i = 1; i <= totalPages; i++){
          pagesToProcess.push(i);
        }
        console.log(`STANDARD PROCESSING: Processing all ${totalPages} pages`);
      }
      const BATCH_SIZE = 25;
      const batches = Math.ceil(pagesToProcess.length / BATCH_SIZE);
      console.log(`Starting PDF processing: ${pagesToProcess.length} pages in ${batches} batches of ${BATCH_SIZE} pages each (${processingStrategy} strategy)`);
      for(let batchIndex = 0; batchIndex < batches; batchIndex++){
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min((batchIndex + 1) * BATCH_SIZE, pagesToProcess.length);
        const currentBatch = pagesToProcess.slice(startIdx, endIdx);
        console.log(`Processing batch ${batchIndex + 1}/${batches}: pages [${currentBatch.join(', ')}]`);
        for (const pageNum of currentBatch){
          if (Date.now() - startTime > MAX_PROCESSING_TIME) {
            const processedSoFar = batchIndex * BATCH_SIZE + currentBatch.indexOf(pageNum);
            console.warn(`PDF processing timeout reached after ${MAX_PROCESSING_TIME / 1000}s. Processed ${processedSoFar}/${pagesToProcess.length} sampled pages.`);
            console.warn(`Stopping processing early. Text collected so far: ${allText.length} characters from ${readablePages} pages.`);
            break;
          }
          if (allText.length > SAFE_MEMORY_LIMIT) {
            const processedSoFar = batchIndex * BATCH_SIZE + currentBatch.indexOf(pageNum);
            console.warn(`Memory limit reached (${SAFE_MEMORY_LIMIT / 1024 / 1024}MB). Processed ${processedSoFar}/${pagesToProcess.length} sampled pages.`);
            console.warn(`Stopping processing early to prevent out-of-memory errors.`);
            break;
          }
          let page: any = null;
          let textContent: any = null;
          try {
            try {
              page = await pdfDoc.getPage(pageNum);
            } catch (pageLoadError) {
              console.warn(`Page ${pageNum}: Failed to load page - ${pageLoadError instanceof Error ? pageLoadError.message : String(pageLoadError)}`);
              continue;
            }
            if (!page) {
              console.warn(`Page ${pageNum}: Page object is null`);
              continue;
            }
            try {
              textContent = await page.getTextContent();
            } catch (textContentError) {
              console.warn(`Page ${pageNum}: Failed to get text content - ${textContentError instanceof Error ? textContentError.message : String(textContentError)}`);
              continue;
            }
            let pageText = '';
            try {
              if (textContent && textContent.items && Array.isArray(textContent.items)) {
                for (const item of textContent.items){
                  try {
                    if (item && typeof item === 'object' && 'str' in item && item.str && typeof item.str === 'string') {
                      const cleanedStr = item.str.trim();
                      if (cleanedStr && cleanedStr.length > 0 && isReadableText(cleanedStr)) {
                        pageText += cleanedStr + ' ';
                      }
                    }
                  } catch (itemError) {
                    continue;
                  }
                }
              } else {
                console.warn(`Page ${pageNum}: textContent structure is invalid`);
                continue;
              }
            } catch (processingError) {
              console.warn(`Page ${pageNum}: Error processing text items - ${processingError instanceof Error ? processingError.message : String(processingError)}`);
              continue;
            }
            pageText = pageText.trim();
            if (pageText && pageText.length > 10 && isPageContentValid(pageText)) {
              allText += pageText + '\n\n';
              readablePages++;
              totalTextLength += pageText.length;
              console.log(`Page ${pageNum}: extracted ${pageText.length} chars (readable)`);
            } else {
              console.warn(`Page ${pageNum}: skipped - low quality content (${pageText.length} chars)`);
            }
            const processedSoFar = batchIndex * BATCH_SIZE + currentBatch.indexOf(pageNum) + 1;
            if (processedSoFar % 10 === 0 || processedSoFar === pagesToProcess.length) {
              try {
                if (onProgress && typeof processedSoFar === 'number' && typeof pagesToProcess.length === 'number' && allText) {
                  onProgress(processedSoFar, pagesToProcess.length, allText);
                }
              } catch (progressError) {
                console.warn(`Progress callback error on page ${pageNum} (${processedSoFar}/${pagesToProcess.length}):`, progressError);
              }
            }
          } catch (pageError) {
            console.warn(`Failed to process page ${pageNum}:`, pageError instanceof Error ? pageError.message : String(pageError));
            continue;
          } finally{
            page = null;
            textContent = null;
          }
        }
        if (typeof globalThis.gc === 'function') {
          try {
            globalThis.gc();
            console.log(`Memory cleanup performed after batch ${batchIndex + 1}`);
          } catch (gcError) {
            console.warn(`Memory cleanup failed:`, gcError);
          }
        }
        console.log(`Completed batch ${batchIndex + 1}/${batches}. Total text: ${allText.length} chars from ${readablePages} pages`);
        await new Promise((resolve)=>setTimeout(resolve, 100));
      }
      const processingTime = Date.now() - startTime;
      if (processingStrategy === 'sampled') {
        console.log(`PDF SAMPLING complete: ${readablePages}/${pagesToProcess.length} sampled pages readable (from ${totalPages} total pages), ${totalTextLength} total characters in ${processingTime}ms`);
      } else {
        console.log(`PDF processing complete: ${readablePages}/${pdfDoc.numPages} pages readable, ${totalTextLength} total characters in ${processingTime}ms`);
      }
      if (processingTime > MAX_PROCESSING_TIME * 0.9) {
        console.warn(`PDF processing approached timeout limit. Consider splitting large documents.`);
      }
      if (allText.length < 50) {
        const errorDetails = {
          code: 'PDF_NO_TEXT',
          message: `PDF appears to contain no readable text content. This may be a scanned PDF, password-protected, or contain only images.`,
          userFriendlyMessage: 'This PDF appears to be scanned or contains no readable text',
          suggestedActions: [
            'Use an OCR tool to convert scanned images to text',
            'Remove password protection if the PDF is encrypted',
            'Try uploading a text-based version of the document'
          ]
        };
        throw new Error(JSON.stringify(errorDetails));
      }
      if (readablePages === 0) {
        const errorDetails = {
          code: 'PDF_NO_READABLE_PAGES',
          message: `No readable pages found in PDF. This may be a scanned document or contain only images/graphics.`,
          userFriendlyMessage: 'No readable content found in this PDF',
          suggestedActions: [
            'Check if this is a scanned document that needs OCR processing',
            'Verify the PDF is not corrupted',
            'Try a different PDF viewer to confirm the content is readable'
          ]
        };
        throw new Error(JSON.stringify(errorDetails));
      }
      if (allText.length > 10 * 1024 * 1024) {
        console.warn(`Very large text extracted (${Math.round(allText.length / 1024 / 1024)}MB). Processing may be slower.`);
      }
      if (isPdfStructureText(allText)) {
        throw new Error(`PDF text extraction returned PDF structure data instead of readable content. This PDF may be encrypted, corrupted, or require OCR processing.`);
      }
      const sanitizedText = sanitizeTextForDatabase(allText);
      return sanitizedText;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('{')) {
        try {
          JSON.parse(error.message);
          throw error;
        } catch  {
        }
      }
      console.error(`PDF parsing failed:`, error instanceof Error ? error.message : String(error));
      let errorDetails;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('time')) {
        errorDetails = {
          code: 'PROCESSING_TIMEOUT',
          message: errorMessage,
          userFriendlyMessage: 'Document processing timed out due to file size or complexity',
          suggestedActions: [
            'Try breaking the document into smaller sections',
            'Reduce document complexity by removing images or media',
            'Upload during off-peak hours for better performance'
          ]
        };
      } else if (errorMessage.includes('memory') || errorMessage.includes('Memory')) {
        errorDetails = {
          code: 'MEMORY_EXCEEDED',
          message: errorMessage,
          userFriendlyMessage: 'Document is too large or complex to process in available memory',
          suggestedActions: [
            'Try splitting the document into smaller parts',
            'Remove embedded images or media if possible',
            'Contact support for assistance with large files'
          ]
        };
      } else if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
        errorDetails = {
          code: 'PDF_ENCRYPTED',
          message: errorMessage,
          userFriendlyMessage: 'This PDF is password-protected or encrypted',
          suggestedActions: [
            'Remove password protection from the PDF',
            'Export as an unencrypted version',
            'Try converting to a different format'
          ]
        };
      } else {
        errorDetails = {
          code: 'PDF_PROCESSING_ERROR',
          message: errorMessage,
          userFriendlyMessage: 'Failed to process this PDF document',
          suggestedActions: [
            'Verify the PDF is not corrupted or password-protected',
            'Try converting to a different format',
            'Contact support if the issue persists'
          ]
        };
      }
      throw new Error(JSON.stringify(errorDetails));
    }
}

function isReadableText(text: string): boolean {
    if (!text || text.length < 1) return false;
    if (text.includes('%PDF') || text.includes('obj') || text.includes('endobj') || text.includes('stream') || text.includes('endstream') || text.match(/^\d+\s+\d+\s+obj/) || text.match(/^<</)) {
      return false;
    }
    const printableChars = text.replace(/[^\x20-\x7E\s]/g, '').length;
    const printableRatio = printableChars / text.length;
    if (printableRatio < 0.7) {
      return false;
    }
    const words = text.split(/\s+/).filter((word)=>word.length > 0);
    if (words.length === 0) return false;
    const singleCharWords = words.filter((word)=>word.length === 1).length;
    if (words.length > 5 && singleCharWords / words.length > 0.5) {
      return false;
    }
    return true;
}

function isPageContentValid(pageText: string): boolean {
    if (!pageText || pageText.length < 10) return false;
    const words = pageText.split(/\s+/).filter((word)=>word.length > 0);
    if (words.length < 3) return false;
    const alphanumeric = pageText.replace(/[^a-zA-Z0-9\s]/g, '');
    const alphanumericRatio = alphanumeric.length / pageText.length;
    if (alphanumericRatio < 0.5) {
      return false;
    }
    const sentences = pageText.split(/[.!?]+/).filter((s)=>s.trim().length > 0);
    if (sentences.length === 0) return false;
    const avgWordLength = words.reduce((sum, word)=>sum + word.length, 0) / words.length;
    if (avgWordLength < 1 || avgWordLength > 20) {
      return false;
    }
    return true;
}

function isPdfStructureText(text: string): boolean {
    const structureMarkers = [
      '%PDF-',
      '/Type/Catalog',
      '/Type/Page',
      'obj <<',
      'endobj',
      'stream',
      'endstream',
      '/Filter',
      '/Length',
      '/Contents',
      'xref',
      'trailer'
    ];
    const markerCount = structureMarkers.reduce((count, marker)=>{
      return count + (text.includes(marker) ? 1 : 0);
    }, 0);
    if (markerCount >= 3) {
      return true;
    }
    const hexPatterns = text.match(/[0-9a-fA-F]{8,}/g) || [];
    if (hexPatterns.length > 10) {
      return true;
    }
    const objReferences = text.match(/\d+\s+\d+\s+R/g) || [];
    if (objReferences.length > 5) {
      return true;
    }
    return false;
}

async function extractTextFromUrl(url: string): Promise<string> {
    console.log(`Attempting to scrape main content from URL: ${url}`);
    const strategies = [
      {
        name: 'Standard Browser Headers',
        options: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        }
      },
      {
        name: 'Simplified Headers',
        options: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LearnologyAI/1.0; +https://learnologyai.com)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        }
      },
      {
        name: 'Minimal headers',
        options: {
          headers: {
            'User-Agent': 'LearnologyAI-Bot/1.0'
          }
        }
      }
    ];
    let lastError: Error | null = null;
    for (const strategy of strategies){
      try {
        console.log(`Trying strategy: ${strategy.name} for URL: ${url}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(()=>controller.abort(), 30000);
        const response = await fetch(url, {
          ...strategy.options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const contentType = response.headers.get('content-type');
        console.log(`Content-Type: ${contentType}`);
        if (!contentType || !contentType.includes('text/html')) {
          console.warn(`URL ${url} did not return HTML. Content-Type: ${contentType}. Attempting to read as text anyway.`);
        }
        const html = await response.text();
        console.log(`Successfully fetched ${html.length} characters of HTML from ${url}`);
        const mainContent = extractMainContentFromHtml(html, url);
        if (!mainContent || mainContent.length < 50) {
          console.warn(`Extracted very little main content from URL: ${url}. Content length: ${mainContent.length}. HTML length was ${html.length}.`);
          if (mainContent.length === 0) {
            throw new Error('No readable main content found on the page');
          }
        }
        console.log(`Successfully extracted ~${mainContent.length} characters of main content from ${url} using strategy: ${strategy.name}`);
        console.log(`First 200 characters: ${mainContent.substring(0, 200)}...`);
        const sanitizedContent = sanitizeTextForDatabase(mainContent);
        return sanitizedContent;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Strategy "${strategy.name}" failed for ${url}:`, lastError.message);
        if (lastError.name === 'AbortError') {
          console.warn(`Request timed out after 30 seconds for ${url}`);
        }
        continue;
      }
    }
    const errorMessage = `Failed to extract text from URL ${url} after trying ${strategies.length} different approaches. Last error: ${lastError?.message || 'Unknown error'}`;
    console.error(errorMessage);
    let userFriendlyMessage = `Unable to access the website at ${url}. `;
    if (lastError?.message.includes('timeout') || lastError?.name === 'AbortError') {
      userFriendlyMessage += 'The website took too long to respond (timeout after 30 seconds).';
    } else if (lastError?.message.includes('HTTP 403') || lastError?.message.includes('HTTP 401')) {
      userFriendlyMessage += 'The website is blocking automated access (403/401 error).';
    } else if (lastError?.message.includes('HTTP 404')) {
      userFriendlyMessage += 'The page was not found (404 error). Please check the URL.';
    } else if (lastError?.message.includes('HTTP 500') || lastError?.message.includes('HTTP 502') || lastError?.message.includes('HTTP 503')) {
      userFriendlyMessage += 'The website is experiencing server issues. Please try again later.';
    } else if (lastError?.message.includes('SSL') || lastError?.message.includes('TLS') || lastError?.message.includes('certificate')) {
      userFriendlyMessage += 'There was an SSL/security certificate issue with the website.';
    } else if (lastError?.message.includes('network') || lastError?.message.includes('connection')) {
      userFriendlyMessage += 'There was a network connectivity issue.';
    } else {
      userFriendlyMessage += 'The website may be blocking automated access or experiencing technical issues.';
    }
    userFriendlyMessage += '\n\nSuggestions:\n• Verify the URL is correct and publicly accessible\n• Try again in a few minutes\n• Contact the website owner if the issue persists\n• Consider copying and pasting the content manually as a text file';
    throw new Error(userFriendlyMessage);
}

function extractMainContentFromHtml(html: string, url: string): string {
    console.log(`Extracting main content from HTML (${html.length} chars) for URL: ${url}`);
    let structuredContent = extractStructuredData(html);
    let mainContent = extractSemanticContent(html);
    if (!mainContent || mainContent.length < 200) {
      mainContent = extractContentByScoring(html);
    }
    if (!mainContent || mainContent.length < 100) {
      mainContent = extractBasicContent(html);
    }
    let finalContent = '';
    if (structuredContent && structuredContent.length > 50) {
      finalContent += structuredContent + '\n\n';
    }
    if (mainContent && mainContent.length > 50) {
      finalContent += mainContent;
    } else {
      finalContent = mainContent || structuredContent || '';
    }
    console.log(`Final content extraction result: ${finalContent.length} characters`);
    return finalContent;
}

function extractStructuredData(html: string): string {
    let structuredContent = '';
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches){
        try {
          const jsonContent = match.replace(/<script[^>]*>/gi, '').replace(/<\/script>/gi, '');
          const data = JSON.parse(jsonContent);
          if (data['@type'] === 'Article' || data['@type'] === 'BlogPosting' || data['@type'] === 'NewsArticle') {
            if (data.articleBody) {
              structuredContent += data.articleBody + '\n';
            }
            if (data.description) {
              structuredContent += data.description + '\n';
            }
          }
        } catch (e) {
        }
      }
    }
    const ogDescriptionMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*?)["']/i);
    if (ogDescriptionMatch && ogDescriptionMatch[1]) {
      structuredContent += ogDescriptionMatch[1] + '\n';
    }
    const metaDescriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*?)["']/i);
    if (metaDescriptionMatch && metaDescriptionMatch[1]) {
      structuredContent += metaDescriptionMatch[1] + '\n';
    }
    return structuredContent.trim();
}

function extractSemanticContent(html: string): string {
    let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const contentSelectors = [
      'article[role="main"]',
      'article',
      '[role="article"]',
      'main article',
      '.article-content',
      '.article-body',
      '.post-content',
      '.entry-content',
      '.content-body',
      'main',
      '[role="main"]',
      '#main-content',
      '#content',
      '.main-content',
      '.content',
      '.post',
      '.entry',
      '#article',
      '.article',
      '#post',
      '.story-body',
      '.text-content',
      '#story',
      '.story'
    ];
    for (const selector of contentSelectors){
      const contentMatch = extractBySelector(cleanHtml, selector);
      if (contentMatch && contentMatch.length > 200) {
        console.log(`Found content using selector: ${selector} (${contentMatch.length} chars)`);
        return contentMatch;
      }
    }
    return '';
}

function extractBySelector(html: string, selector: string): string {
    let pattern: RegExp;
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      pattern = new RegExp(`<[^>]*id=["']${id}["'][^>]*>(.*?)<\/[^>]*>`, 'gis');
    } else if (selector.startsWith('.')) {
      const className = selector.slice(1);
      pattern = new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>(.*?)<\/[^>]*>`, 'gis');
    } else if (selector === 'article') {
      pattern = new RegExp(`<article[^>]*>(.*?)<\/article>`, 'gis');
    } else if (selector === 'main') {
      pattern = new RegExp(`<main[^>]*>(.*?)<\/main>`, 'gis');
    } else if (selector.includes('[role=')) {
      const role = selector.match(/\[role=["']([^"']*?)["']\]/)?.[1];
      if (role) {
        pattern = new RegExp(`<[^>]*role=["']${role}["'][^>]*>(.*?)<\/[^>]*>`, 'gis');
      } else {
        return '';
      }
    } else {
      return '';
    }
    const match = pattern.exec(html);
    if (match && match[1]) {
      return htmlToText(match[1]);
    }
    return '';
}

function extractContentByScoring(html: string): string {
    let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const paragraphMatches = cleanHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
    const divMatches = cleanHtml.match(/<div[^>]*>[\s\S]*?<\/div>/gi) || [];
    const allBlocks = [
      ...paragraphMatches,
      ...divMatches
    ];
    const scoredBlocks: Array<{content: string, score: number}> = [];
    for (const block of allBlocks){
      const text = htmlToText(block);
      if (text.length < 30) continue;
      let score = 0;
      score += text.length * 0.1;
      score += (text.match(/\./g) || []).length * 5;
      score += (text.match(/[A-Z][a-z]+/g) || []).length * 0.5;
      if (block.toLowerCase().includes('menu') || block.toLowerCase().includes('navigation') || block.toLowerCase().includes('sidebar') || block.toLowerCase().includes('footer') || block.toLowerCase().includes('header') || block.toLowerCase().includes('advertisement') || block.toLowerCase().includes('cookie') || block.toLowerCase().includes('subscribe') || block.toLowerCase().includes('login') || block.toLowerCase().includes('signup')) {
        score -= 20;
      }
      const linkCount = (block.match(/<a[^>]*>/gi) || []).length;
      const textLength = text.length;
      if (linkCount > 0 && linkCount / textLength > 0.02) {
        score -= 15;
      }
      if (score > 0) {
        scoredBlocks.push({
          content: text,
          score
        });
      }
    }
    scoredBlocks.sort((a, b)=>b.score - a.score);
    let result = '';
    let totalScore = 0;
    for (const block of scoredBlocks.slice(0, 10)){
      if (totalScore + block.score > 100 || result.length > 5000) break;
      result += block.content + '\n\n';
      totalScore += block.score;
    }
    return result.trim();
}

function extractBasicContent(html: string): string {
    let text = html;
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
    text = text.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '');
    text = text.replace(/<[^>]*(?:class|id)=["'][^"']*(?:nav|menu|sidebar|widget|advertisement|ad-|banner|social|share|comment|related|footer|header)[^"']*["'][^>]*>[\s\S]*?<\/[^>]*>/gi, '');
    return htmlToText(text);
}

function htmlToText(html: string): string {
    let text = html;
    text = text.replace(/<\/?(div|p|h[1-6]|li|article|section|br)[^>]*>/gi, '\n');
    text = text.replace(/<\/?(ul|ol|blockquote)[^>]*>/gi, '\n\n');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&hellip;/g, '...');
    text = text.replace(/&mdash;/g, '—');
    text = text.replace(/&ndash;/g, '–');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n /g, '\n');
    text = text.trim();
    return text;
}

async function extractTranscriptFromYouTube(url: string): Promise<{ transcript?: string; videoMetadata?: any; error?: boolean; message?: string }> {
    console.log(`Attempting to fetch transcript for YouTube URL using youtube-transcript: ${url}`);
    try {
      const transcriptResponse = await YoutubeTranscript.fetchTranscript(url);
      if (!transcriptResponse || transcriptResponse.length === 0) {
        throw new Error('No transcript available for this video or an empty transcript was returned.');
      }
      const transcript = transcriptResponse.map((line: any)=>line.text).join(' ');
      console.log(`Successfully extracted transcript using youtube-transcript from ${url}: ${transcript.length} characters`);
      return {
        transcript,
        videoMetadata: {}
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`youtube-transcript processing failed for ${url}:`, errorMessage);
      let userFriendlyMessage = `Unable to process this YouTube video: ${errorMessage}`;
      if (errorMessage.includes('Could not find a transcript for this video')) {
        userFriendlyMessage = `This YouTube video does not have captions/transcripts available. This can happen when:
  • The video creator has disabled captions
  • The video is too new and auto-generated captions haven't been created yet
  • The video is in a language that doesn't support auto-captions`;
      } else if (errorMessage.includes('private') || errorMessage.includes('unavailable')) {
        userFriendlyMessage = `This YouTube video cannot be accessed. It may be:
  • Private or unlisted
  • Restricted in your region
  • Deleted or made unavailable`;
      }
      return {
        error: true,
        message: `${userFriendlyMessage}\n\nURL: ${url}`
      };
    }
}

async function extractTextFromImage(filePath: string, supabase: SupabaseClient, bucketName: string, openaiApiKey: string): Promise<string> {
  console.log(`Attempting to extract text from image: ${filePath} in bucket ${bucketName}`);
  try {
    const { data: imageFileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (downloadError || !imageFileData) {
      throw new Error(`Failed to download image file ${filePath} from storage: ${downloadError?.message}`);
    }

    const arrayBuffer = await imageFileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64String = btoa(String.fromCharCode(...uint8Array));
    
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    let mimeType = 'image/jpeg';
    
    switch (fileExtension) {
      case 'png':
        mimeType = 'image/png';
        break;
      case 'gif':
        mimeType = 'image/gif';
        break;
      case 'webp':
        mimeType = 'image/webp';
        break;
      case 'jpg':
      case 'jpeg':
      default:
        mimeType = 'image/jpeg';
        break;
    }

    console.log(`Processing image with GPT-4o-mini vision API, type: ${mimeType}, size: ${uint8Array.length} bytes`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all visible text from this image. Include any text from documents, signs, handwriting, captions, or any other readable content. Preserve the structure and formatting as much as possible. If there are multiple columns or sections, maintain their organization. If no text is visible, respond with "No readable text found in this image."'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64String}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('GPT-4o-mini vision API error response:', errorBody);
      throw new Error(`GPT-4o-mini vision API request failed with status ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message || !result.choices[0].message.content) {
      console.error('GPT-4o-mini vision API returned invalid response:', result);
      throw new Error('GPT-4o-mini vision API did not return valid text content.');
    }

    const extractedText = result.choices[0].message.content.trim();
    
    if (extractedText.toLowerCase().includes('no readable text found') || 
        extractedText.toLowerCase().includes('no text visible') ||
        extractedText.length < 10) {
      console.warn(`No readable text found in image ${filePath}`);
      throw new Error('No readable text content found in this image. The image may contain only graphics, be too blurry, or have text that is not clearly visible.');
    }

    console.log(`Successfully extracted text from image ${filePath}. Text length: ${extractedText.length}`);
    return extractedText;
    
  } catch (error) {
    console.error(`Error extracting text from image ${filePath}:`, error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to extract text from image ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function transcribeAudio(filePath: string, supabase: SupabaseClient, bucketName: string, openaiApiKey: string): Promise<string> {
    console.log(`Attempting to transcribe audio: ${filePath} in bucket ${bucketName}`);
    try {
      const { data: audioFileData, error: downloadError } = await supabase.storage.from(bucketName).download(filePath);
      if (downloadError || !audioFileData) {
        throw new Error(`Failed to download audio file ${filePath} from storage: ${downloadError?.message}`);
      }
      const formData = new FormData();
      const fileName = filePath.split('/').pop() || 'audio.mp3';
      formData.append('file', audioFileData, fileName);
      formData.append('model', 'whisper-1');
      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: formData
      });
      if (!whisperResponse.ok) {
        const errorBody = await whisperResponse.text();
        console.error('Whisper API error response:', errorBody);
        throw new Error(`Whisper API request failed with status ${whisperResponse.status}: ${errorBody}`);
      }
      const { text: transcript } = await whisperResponse.json();
      if (typeof transcript !== 'string') {
        console.error('Whisper API did not return a string transcript:', transcript);
        throw new Error('Whisper API did not return a valid text transcript.');
      }
      console.log(`Successfully transcribed audio ${filePath}. Transcript length: ${transcript.length}.`);
      return transcript;
    } catch (error) {
      console.error(`Error transcribing audio ${filePath}:`, error instanceof Error ? error.message : String(error));
      throw new Error(`Failed to transcribe audio ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

const getSectionIdentifier = (documentType: DocumentType, content: string, charOffset: number, chunkIndex: number, pageNumber?: number, timestamp?: string): string | undefined => {
    try {
        if (typeof documentType !== 'string') {
          console.warn(`getSectionIdentifier: invalid documentType ${typeof documentType}`);
          return `Part ${chunkIndex + 1}`;
        }
        if (typeof chunkIndex !== 'number' || isNaN(chunkIndex)) {
          console.warn(`getSectionIdentifier: invalid chunkIndex ${chunkIndex}`);
          return `Part 1`;
        }
        if (documentType === 'pdf' && pageNumber && typeof pageNumber === 'number' && !isNaN(pageNumber)) {
          return `Page ${pageNumber}`;
        }
        if (documentType === 'youtube' && timestamp && typeof timestamp === 'string') {
          return `Time ${timestamp}`;
        }
        return `Part ${chunkIndex + 1}`;
      } catch (error) {
        console.error('Error in getSectionIdentifier:', error);
        return `Part 1`;
      }
};

const generateCitationKey = (docId: string, sectionIdentifier: string | undefined, chunkIndex: number): string => {
    const docIdShort = docId.substring(0, 8);
    const sectionPart = sectionIdentifier ? sectionIdentifier.replace(/\s+/g, '_') : 'SUnknown';
    return `${docIdShort}_${sectionPart}_C${chunkIndex}`;
};

const chunkText = async (fullText: string, documentType: DocumentType, options: ChunkingOptions = {}, onProgress?: (chunksCreated: number, estimatedTotal: number) => void): Promise<Chunk[]> => {
    const { chunkSize = 1500, overlap = 200 } = options;
    const chunks: Chunk[] = [];
    let chunkIndex = 0;
    const effectiveChunkStep = Math.max(chunkSize - overlap, 1);
    const estimatedTotalChunks = fullText && fullText.length > 0 ? Math.ceil(fullText.length / effectiveChunkStep) : 0;
    if (documentType === 'pdf') {
      if (!fullText || typeof fullText !== 'string') {
        throw new Error('Invalid fullText for PDF chunking - text is null or not a string');
      }
      console.log(`Starting PDF chunking for text of length: ${fullText.length}`);
      try {
        const pages = fullText.split('\f');
        console.log(`Split PDF text into ${pages.length} pages`);
        let charOffset = 0;
        for(let i = 0; i < pages.length; i++){
          try {
            const pageText = pages[i];
            if (!pageText || typeof pageText !== 'string') {
              console.warn(`Skipping invalid page ${i + 1} - pageText is ${pageText === null ? 'null' : typeof pageText}`);
              continue;
            }
            const pageNumber = i + 1;
            for(let j = 0; j < pageText.length; j += chunkSize - overlap){
              try {
                const content = pageText.substring(j, j + chunkSize);
                if (content && typeof content === 'string' && content.trim() && content.trim().length > 0) {
                  const trimmedContent = content.trim();
                  try {
                    const sectionId = getSectionIdentifier(documentType, trimmedContent, charOffset + j, chunkIndex, pageNumber);
                    chunks.push({
                      content: trimmedContent,
                      metadata: {
                        documentType,
                        sourceCharOffset: charOffset + j,
                        pageNumber: pageNumber
                      },
                      chunk_index: chunkIndex,
                      section_identifier: sectionId || `Page_${pageNumber}_Chunk_${chunkIndex}`
                    });
                    chunkIndex++;
                    if (chunkIndex % 50 === 0) {
                      if (onProgress && typeof chunkIndex === 'number' && typeof estimatedTotalChunks === 'number' && !isNaN(estimatedTotalChunks)) {
                        try {
                          onProgress(chunkIndex, estimatedTotalChunks);
                        } catch (progressError) {
                          console.error('Error in chunking progress callback:', progressError);
                        }
                      }
                    }
                  } catch (sectionError) {
                    console.error(`Error generating section identifier for chunk ${chunkIndex}:`, sectionError);
                    chunks.push({
                      content: trimmedContent,
                      metadata: {
                        documentType,
                        sourceCharOffset: charOffset + j,
                        pageNumber: pageNumber
                      },
                      chunk_index: chunkIndex,
                      section_identifier: `Page_${pageNumber}_Chunk_${chunkIndex}`
                    });
                    chunkIndex++;
                  }
                }
              } catch (chunkError) {
                console.error(`Error processing chunk ${chunkIndex} from page ${pageNumber}:`, chunkError);
              }
            }
            charOffset += (pageText?.length || 0) + 1;
          } catch (pageError) {
            console.error(`Error processing page ${i + 1}:`, pageError);
          }
        }
        console.log(`PDF chunking completed. Created ${chunks.length} chunks.`);
      } catch (splittingError) {
        console.error('Error during PDF text splitting:', splittingError);
        throw new Error(`PDF text splitting failed: ${splittingError instanceof Error ? splittingError.message : String(splittingError)}`);
      }
    } else if (documentType === 'youtube') {
      const segments = fullText.split(/\n\n(?=\d{1,2}:\d{2}:\d{2}\.\d{3})|\n(\d{1,2}:\d{2}(?:\.\d{1,3})?(?: -)?\s)/);
      let charOffset = 0;
      for (const segment of segments){
        if (!segment.trim()) continue;
        let timestamp: string | undefined = undefined;
        let textContent = segment;
        const vttTimestampMatch = segment.match(/^(\d{1,2}:\d{2}:\d{2}\.\d{3}) -->/);
        const simpleTimestampMatch = segment.match(/^(\d{1,2}:\d{2}(?:\.\d{1,3})?)(?: -)?\s/);
        if (vttTimestampMatch) {
          timestamp = vttTimestampMatch[1];
          textContent = segment.substring(segment.indexOf('\n') + 1).trim();
        } else if (simpleTimestampMatch) {
          timestamp = simpleTimestampMatch[1];
          textContent = segment.substring(simpleTimestampMatch[0].length).trim();
        }
        if (!textContent) continue;
        for(let j = 0; j < textContent.length; j += chunkSize - overlap){
          const content = textContent.substring(j, j + chunkSize).trim();
          if (content) {
            chunks.push({
              content,
              metadata: {
                documentType,
                sourceCharOffset: charOffset + j,
                originalTimestamp: timestamp
              },
              chunk_index: chunkIndex,
              section_identifier: getSectionIdentifier(documentType, content, charOffset + j, chunkIndex, undefined, timestamp)
            });
            chunkIndex++;
          }
        }
        charOffset += segment.length + 2;
      }
    } else {
      for(let i = 0; i < fullText.length; i += chunkSize - overlap){
        const content = fullText.substring(i, i + chunkSize).trim();
        if (content) {
          chunks.push({
            content,
            metadata: {
              documentType,
              sourceCharOffset: i
            },
            chunk_index: chunkIndex,
            section_identifier: getSectionIdentifier(documentType, content, i, chunkIndex)
          });
          chunkIndex++;
        }
      }
    }
    console.log(`Chunked text into ${chunks.length} chunks for document type ${documentType}.`);
    return chunks;
};

async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
    console.log(`Generating embedding for text snippet: ${text.substring(0, 30)}...`);
    const maxRetries = 3;
    const baseDelay = 1000;
    for(let attempt = 0; attempt <= maxRetries; attempt++){
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            input: text,
            model: 'text-embedding-3-small'
          })
        });
        if (response.ok) {
          const { data } = await response.json();
          if (!data || !data[0] || !data[0].embedding) {
            throw new Error('Invalid response structure from OpenAI Embedding API');
          }
          return data[0].embedding;
        }
        if (response.status === 429) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
            console.warn(`OpenAI rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
            await new Promise((resolve)=>setTimeout(resolve, delay));
            continue;
          }
          const errorBody = await response.text();
          throw new Error(`OpenAI embedding failed: 429 Too Many Requests (after ${maxRetries} retries): ${errorBody}`);
        }
        const errorBody = await response.text();
        throw new Error(`OpenAI Embedding API error (${response.status}): ${errorBody}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (attempt < maxRetries && (errorMessage.includes('fetch') || errorMessage.includes('network'))) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, errorMessage);
          await new Promise((resolve)=>setTimeout(resolve, delay));
          continue;
        }
        console.error('Error generating embedding:', error);
        throw error;
      }
    }
    throw new Error('Max retries exceeded for embedding generation');
}

serve(async (req: Request)=>{
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: corsHeaders
      });
    }
    let documentId: string | null = null;
    let supabaseClient: SupabaseClient | null = null;
    try {
      const { documentId: reqDocumentId } = await req.json() as ProcessRequest;
      documentId = reqDocumentId;
      if (!documentId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Missing documentId in request payload'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }
      console.log(`PROCESS-DOCUMENT: Received request for document ID: ${documentId}`);
      const getEnvVar = (key: string): string | undefined =>{
        if (typeof globalThis.Deno !== 'undefined' && globalThis.Deno?.env) {
          return globalThis.Deno.env.get(key);
        }
        if (typeof process !== 'undefined' && process.env) {
          return process.env[key];
        }
        return undefined;
      };
      const supabaseUrl = getEnvVar('SUPABASE_URL');
      const supabaseServiceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
      const openaiApiKey = getEnvVar('OPENAI_API_KEY');
      if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
        console.error('PROCESS-DOCUMENT: Missing one or more environment variables.');
        return new Response(JSON.stringify({
          success: false,
          error: 'Server configuration error: Missing environment variables.'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 500
        });
      }
      const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
      const denied = await authorizeDocumentProcessing(adminClient, documentId,
        req.headers.get('Authorization'), supabaseServiceRoleKey);
      if (denied) {
        return new Response(JSON.stringify({ success: false, error: 'Document processing access denied' }), {
          status: denied, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Only assign the client used by the catch/failure handler after authorization.
      supabaseClient = adminClient;
      await updateDocumentStatus(supabaseClient, documentId, 'processing', {
        processing_attempted_at: new Date().toISOString(),
        processed_by_function: 'process-document'
      });
      const { data: document, error: fetchError } = await supabaseClient.from('documents').select('id, organisation_id, storage_path, file_name, file_type, metadata, base_class_id').eq('id', documentId).single<DocumentRecord>();
      if (fetchError) throw new Error(`DB fetch error for ${documentId}: ${fetchError.message}`);
      if (!document) throw new Error(`Document not found: ${documentId}`);
      console.log(`🔍 DOCUMENT DEBUG: Fetched document data:`, JSON.stringify(document, null, 2));
      if (!document.organisation_id) {
        console.error(`PROCESS-DOCUMENT: Document ${documentId} has null/undefined organisation_id:`, JSON.stringify(document, null, 2));
        throw new Error(`Document ${documentId} is missing required organisation_id. This document may be corrupted or improperly created.`);
      }
      console.log(`PROCESS-DOCUMENT: Processing document ${documentId} for organisation ${document.organisation_id}`);
      let extractedText = "";
      const docMetadata = document.metadata || {};
      const fileType = document.file_type || '';
      const sourceUrl = docMetadata.originalUrl || '';
      const storagePath = document.storage_path;
      const bucketName = `org-${document.organisation_id}-uploads`;
      console.log(`🔍 STORAGE DEBUG: storagePath = '${storagePath}', type: ${typeof storagePath}`);
      console.log(`Processing document: ${document.file_name || documentId}, Type: ${fileType}, URL: ${sourceUrl}, Path: ${storagePath}`);
      if (sourceUrl && (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be'))) {
        console.log(`PROCESS-DOCUMENT: Starting YouTube processing for ${documentId}, URL: ${sourceUrl}`);
        const videoIdMatch = sourceUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;
        let videoInfo: any = null;
        try {
          const videoInfoResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl)}&format=json`);
          if (videoInfoResponse.ok) {
            videoInfo = await videoInfoResponse.json();
            console.log(`Video info retrieved: ${videoInfo.title}`);
          }
        } catch (error) {
          console.warn(`Could not fetch video info for ${sourceUrl}:`, error);
        }
        const videoMetadata = {
          video_id: videoId,
          video_title: videoInfo?.title || 'Unknown',
          video_duration: videoInfo?.duration || null,
          channel_name: videoInfo?.author_name || null,
          processing_attempts: 1,
          strategies_tried: [],
          processing_start_time: new Date().toISOString()
        };
        await updateDocumentStatus(supabaseClient, documentId, 'processing', {
          ...videoMetadata,
          processing_stage: 'transcript_extraction'
        });
        const transcriptResult = await extractTranscriptFromYouTube(sourceUrl);
        if (transcriptResult.error) {
          console.error(`PROCESS-DOCUMENT: YouTube transcript error for doc ${documentId}: ${transcriptResult.message}`);
          let errorType = 'unknown_error';
          const errorMsg = transcriptResult.message || '';
          if (errorMsg.includes('transcripts/captions disabled') || errorMsg.includes('Transcript is disabled')) {
            errorType = 'transcript_disabled';
          } else if (errorMsg.includes('private') || errorMsg.includes('restricted') || errorMsg.includes('deleted')) {
            errorType = 'access_denied';
          } else if (errorMsg.includes('not found')) {
            errorType = 'video_not_found';
          } else if (errorMsg.includes('Regional restrictions')) {
            errorType = 'regional_restriction';
          }
          const errorMetadata = {
            ...videoMetadata,
            error_type: errorType,
            error_message: transcriptResult.message,
            processing_completed_at: new Date().toISOString(),
            user_guidance: transcriptResult.message,
            final_strategy_used: 'none',
            processing_outcome: 'error'
          };
          await updateDocumentStatus(supabaseClient, documentId, 'error', errorMetadata);
          return new Response(JSON.stringify({
            success: false,
            errorType: 'youtube_processing_failed',
            errorDetail: transcriptResult.message,
            userGuidance: "This video cannot be processed. Please try a different video or check that captions are enabled.",
            documentId
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 200
          });
        } else {
          extractedText = transcriptResult.transcript || '';
          extractedText = sanitizeTextForDatabase(extractedText);
          const newVideoMetadata = transcriptResult.videoMetadata || {};
          const mergedVideoMetadata = {
            ...videoMetadata,
            ...newVideoMetadata,
            video_id: videoId,
            processed_with: 'youtube-transcript'
          };
          const successMetadata = {
            ...mergedVideoMetadata,
            final_strategy_used: 'youtube-transcript',
            processing_outcome: 'success',
            transcript_length: extractedText.length,
            processing_stage: 'chunking'
          };
          await updateDocumentStatus(supabaseClient, documentId, 'processing', successMetadata);
          docMetadata.source_type = 'youtube_transcript';
          console.log(`PROCESS-DOCUMENT: Successfully extracted ${extractedText.length} characters from YouTube video ${documentId}`);
        }
      } else if (sourceUrl || fileType === 'text/html') {
        let urlToProcess = sourceUrl;
        if (!urlToProcess && fileType === 'text/html') {
          console.log(`PROCESS-DOCUMENT: No sourceUrl found but file_type is text/html. Checking file_name and storage_path...`);
          if (document.file_name && document.file_name.startsWith('URL - ')) {
            const extractedUrl = document.file_name.substring(6);
            if (extractedUrl.startsWith('http://') || extractedUrl.startsWith('https://')) {
              urlToProcess = extractedUrl;
            } else {
              urlToProcess = `https://${extractedUrl}`;
            }
            console.log(`PROCESS-DOCUMENT: Extracted URL from file_name: ${urlToProcess}`);
          }
          if (!urlToProcess) {
            try {
              const { data: urlFileData, error: downloadError } = await supabaseClient.storage.from(bucketName).download(storagePath);
              if (!downloadError && urlFileData) {
                const urlContent = await urlFileData.text();
                const lines = urlContent.split('\n');
                for (const line of lines){
                  if (line.trim().startsWith('URL=') || line.trim().startsWith('http')) {
                    urlToProcess = line.replace('URL=', '').trim();
                    console.log(`PROCESS-DOCUMENT: Extracted URL from storage file: ${urlToProcess}`);
                    break;
                  }
                }
              }
            } catch (error) {
              console.warn(`PROCESS-DOCUMENT: Failed to read URL from storage file: ${error}`);
            }
          }
        }
        if (!urlToProcess) {
          throw new Error(`No URL found for text/html document ${documentId}. sourceUrl: ${sourceUrl}, file_name: ${document.file_name}`);
        }
        console.log(`PROCESS-DOCUMENT: Processing URL: ${urlToProcess}`);
        extractedText = await extractTextFromUrl(urlToProcess);
        docMetadata.source_type = 'url_scrape';
        docMetadata.originalUrl = urlToProcess;
      } else if (fileType.startsWith('audio/')) {
        extractedText = await transcribeAudio(storagePath, supabaseClient, bucketName, openaiApiKey);
        extractedText = sanitizeTextForDatabase(extractedText);
        docMetadata.source_type = 'audio_transcript';
      } else if (fileType.startsWith('image/')) {
        console.log(`PROCESS-DOCUMENT: Processing image: ${document.file_name}`);
        extractedText = await extractTextFromImage(storagePath, supabaseClient, bucketName, openaiApiKey);
        extractedText = sanitizeTextForDatabase(extractedText);
        docMetadata.source_type = 'image_text_extraction';
        console.log(`PROCESS-DOCUMENT: Successfully extracted ${extractedText.length} characters from image ${documentId}`);
      } else if (fileType === 'application/pdf') {
        try {
          console.log(`Starting PDF extraction for document: ${documentId}, file: ${storagePath}`);
          extractedText = await extractTextFromPdf(storagePath, supabaseClient, bucketName, (pagesProcessed, totalPages, textLength)=>{
            try {
              const percentage = Math.floor(pagesProcessed / totalPages * 100);
              console.log(`PDF extraction progress: ${pagesProcessed}/${totalPages} pages (${percentage}%)`);
              if (supabaseClient && documentId) {
                updateDocumentStatus(supabaseClient, documentId, 'processing', {
                  processing_stage: 'extracting_text',
                  processing_progress: {
                    stage: 'extracting_text',
                    substage: 'parsing_pdf',
                    percentage: Math.floor(10 + percentage * 0.2),
                    pagesProcessed,
                    totalPages,
                    textLength
                  }
                }).catch((err)=>console.error('Failed to update PDF extraction progress:', err));
              }
            } catch (progressError) {
              console.error('Error in PDF extraction progress callback:', progressError);
            }
          });
          console.log(`PDF extraction completed. Result type: ${typeof extractedText}, length: ${extractedText?.length || 'null'}`);
          if (!extractedText || typeof extractedText !== 'string') {
            throw new Error('PDF text extraction returned null or invalid text');
          }
          docMetadata.source_type = 'pdf_extract';
        } catch (pdfError) {
          console.error('Error during PDF extraction:', pdfError);
          throw new Error(`PDF extraction failed: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`);
        }
      } else if (fileType === 'text/plain') {
        const { data: fileData, error: downloadError } = await supabaseClient.storage.from(bucketName).download(storagePath);
        if (downloadError || !fileData) throw new Error(`Storage download failed for ${storagePath}: ${downloadError?.message}`);
        extractedText = await fileData.text();
        extractedText = sanitizeTextForDatabase(extractedText);
        docMetadata.source_type = 'text_file';
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileType === 'application/msword') {
        console.log(`PROCESS-DOCUMENT: Processing Word document: ${document.file_name}`);
        const { data: fileData, error: downloadError } = await supabaseClient.storage.from(bucketName).download(storagePath);
        if (downloadError || !fileData) {
          throw new Error(`Storage download failed for Word document ${storagePath}: ${downloadError?.message}`);
        }
        try {
          const arrayBuffer = await fileData.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const decoder = new TextDecoder('utf-8', {
            fatal: false
          });
          let rawText = decoder.decode(uint8Array);
          extractedText = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          .replace(/[^\x20-\x7E\s\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim();
          if (extractedText.length < 50 || !/[a-zA-Z]/.test(extractedText)) {
            throw new Error('Extracted text appears to be invalid or too short');
          }
          extractedText = sanitizeTextForDatabase(extractedText);
          docMetadata.source_type = 'word_document';
          console.log(`PROCESS-DOCUMENT: Successfully extracted ${extractedText.length} characters from Word document ${documentId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`PROCESS-DOCUMENT: Failed to extract text from Word document ${documentId}:`, errorMessage);
          throw new Error(`Unable to extract text from Word document "${document.file_name}". ${errorMessage.includes('invalid') ? 'The document may be corrupted or password-protected.' : 'Please try converting to PDF or plain text format for better compatibility.'}`);
        }
      } else {
        throw new Error(`Unsupported file type: ${fileType} or missing source URL for document ${documentId}`);
      }
      if (!extractedText || typeof extractedText !== 'string') {
        throw new Error(`Text extraction failed - extracted text is null or invalid. Type: ${typeof extractedText}, Length: ${extractedText?.length || 'undefined'}`);
      }
      if (extractedText.length === 0) {
        throw new Error('Text extraction resulted in empty content');
      }
      await updateDocumentStatus(supabaseClient, documentId, 'processing', {
        extracted_text_length: extractedText.length,
        source_type: docMetadata.source_type,
        processing_stage: 'chunking'
      });
      console.log(`✅ TEXT EXTRACTION COMPLETE: ${extractedText.length} characters extracted successfully`);
      console.log(`📊 Starting chunking process for ${extractedText.length} characters of text...`);
      let documentType: DocumentType;
      if (fileType === 'application/pdf') {
        documentType = 'pdf';
      } else if (sourceUrl && (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be'))) {
        documentType = 'youtube';
      } else if (sourceUrl && !sourceUrl.includes('youtube.com') && !sourceUrl.includes('youtu.be')) {
        documentType = 'url';
      } else if (fileType === 'text/plain') {
        documentType = 'txt';
      } else if (fileType?.startsWith('audio/')) {
        documentType = 'audio';
      } else if (fileType?.startsWith('image/')) {
        documentType = 'txt';
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileType === 'application/msword') {
        documentType = 'txt';
      } else {
        documentType = 'txt';
      }
      console.log(`📋 File type: ${fileType}, Document type for chunking: ${documentType}`);
      let processedChunks: Chunk[] = [];
      try {
        console.log(`🔄 CHUNKING PHASE: About to start chunking with text length: ${extractedText?.length || 'null'}, type: ${typeof extractedText}`);
        processedChunks = await chunkText(extractedText, documentType, {
          chunkSize: 1500,
          overlap: 200
        }, (chunksCreated, estimatedTotal)=>{
          try {
            const percentage = estimatedTotal > 0 ? Math.floor(chunksCreated / estimatedTotal * 100) : 0;
            console.log(`📝 Chunking progress: ${chunksCreated}/${estimatedTotal} chunks created (${percentage}%)`);
            if (supabaseClient && documentId && typeof chunksCreated === 'number' && typeof estimatedTotal === 'number' && !isNaN(percentage)) {
              updateDocumentStatus(supabaseClient, documentId, 'processing', {
                processing_stage: 'chunking_text',
                processing_progress: {
                  stage: 'chunking_text',
                  substage: 'creating_chunks',
                  percentage: Math.floor(30 + percentage * 0.3),
                  chunksCreated,
                  estimatedTotal
                }
              }).catch((err)=>console.error('❌ Failed to update chunking progress:', err));
            }
          } catch (callbackError) {
            console.error('❌ Error in chunking progress callback:', callbackError);
          }
        });
        console.log(`✅ CHUNKING COMPLETE: Successfully created ${processedChunks?.length || 0} chunks.`);
      } catch (chunkingError) {
        console.error('❌ CHUNKING ERROR:', chunkingError);
        throw new Error(`Chunking failed: ${chunkingError instanceof Error ? chunkingError.message : String(chunkingError)}`);
      }
      console.log(`🔢 CHUNK COUNT: Created ${processedChunks.length} chunks from the text.`);
      if (!processedChunks || !Array.isArray(processedChunks) || processedChunks.length === 0) {
        throw new Error('No chunks were created from the extracted text');
      }
      console.log(`🔍 CHUNK VALIDATION: Starting validation of ${processedChunks.length} chunks...`);
      const validChunks = processedChunks.filter((chunk, index)=>{
        if (!chunk || typeof chunk !== 'object') {
          console.warn(`❌ Removing invalid chunk at index ${index}: not an object`);
          return false;
        }
        if (!chunk.content || typeof chunk.content !== 'string' || chunk.content.trim().length === 0) {
          console.warn(`❌ Removing invalid chunk at index ${index}: invalid content`);
          return false;
        }
        return true;
      });
      console.log(`✅ CHUNK VALIDATION COMPLETE: ${validChunks.length} valid chunks out of ${processedChunks.length} created.`);
      if (validChunks.length === 0) {
        throw new Error('No valid chunks remained after validation');
      }
      processedChunks = validChunks;
      console.log('Sample chunk:', {
        index: processedChunks[0]?.chunk_index,
        contentLength: processedChunks[0]?.content?.length,
        contentPreview: processedChunks[0]?.content?.substring(0, 100) + '...'
      });
      console.log(`🧠 EMBEDDING GENERATION: Starting embeddings for ${processedChunks.length} chunks...`);
      const embeddings: number[][] = [];
      const concurrentLimit = 5;
      const delayBetweenBatches = 1000;
      for(let i = 0; i < processedChunks.length; i += concurrentLimit){
        const batch = processedChunks.slice(i, i + concurrentLimit);
        console.log(`🔄 Processing embedding batch ${Math.floor(i / concurrentLimit) + 1}/${Math.ceil(processedChunks.length / concurrentLimit)} (${batch.length} chunks)...`);
        try {
          const batchEmbeddings = await Promise.all(batch.map((chunk)=>getEmbedding(chunk.content, openaiApiKey)));
          embeddings.push(...batchEmbeddings);
          console.log(`✅ Batch complete: ${embeddings.length}/${processedChunks.length} embeddings generated`);
          if (i + concurrentLimit < processedChunks.length) {
            console.log(`⏳ Waiting ${delayBetweenBatches}ms before next embedding batch...`);
            await new Promise((resolve)=>setTimeout(resolve, delayBetweenBatches));
          }
        } catch (error) {
          console.error(`❌ EMBEDDING BATCH ERROR: Failed to generate embeddings for batch starting at index ${i}:`, error);
          throw error;
        }
      }
      console.log(`✅ EMBEDDING GENERATION COMPLETE: Generated ${embeddings.length} embeddings.`);
      if (!document.organisation_id) {
        console.error(`PROCESS-DOCUMENT: Critical error - organisation_id is null/undefined at chunk insertion stage for document ${documentId}`);
        console.error('Document object at this stage:', JSON.stringify(document, null, 2));
        throw new Error(`Document ${documentId} organisation_id became null during processing. This is a critical error.`);
      }
      const chunkUpserts = processedChunks.map((chunk, index)=>{
        const citationKey = generateCitationKey(document.id, chunk.section_identifier, chunk.chunk_index);
        if (!document.organisation_id) {
          throw new Error(`organisation_id is null for chunk ${index} of document ${documentId}`);
        }
        const sanitizedContent = chunk.content.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/\uFEFF/g, '').replace(/[\u2000-\u206F]/g, ' ').replace(/\s+/g, ' ').trim();
        return {
          document_id: document.id,
          organisation_id: document.organisation_id,
          chunk_index: chunk.chunk_index,
          content: sanitizedContent,
          token_count: sanitizedContent.split(/\s+/).length,
          embedding: embeddings && embeddings[index] ? embeddings[index] : null,
          metadata: chunk.metadata,
          section_identifier: chunk.section_identifier,
          citation_key: citationKey,
          base_class_id: document.base_class_id || null
        };
      });
      console.log(`PROCESS-DOCUMENT: Created ${chunkUpserts.length} chunk upserts for document ${documentId} with organisation_id ${document.organisation_id}`);
      console.log(`💾 DATABASE INSERTION: Attempting to insert ${chunkUpserts.length} chunks for document ${documentId}...`);
      const batchSize = 50;
      const batches = [];
      for(let i = 0; i < chunkUpserts.length; i += batchSize){
        batches.push(chunkUpserts.slice(i, i + batchSize));
      }
      console.log(`📊 BATCH PROCESSING: Processing ${batches.length} batches of chunks for document ${documentId}...`);
      for(let batchIndex = 0; batchIndex < batches.length; batchIndex++){
        const batch = batches[batchIndex];
        const maxRetries = 3;
        let success = false;
        for(let attempt = 0; attempt <= maxRetries && !success; attempt++){
          try {
            console.log(`Inserting batch ${batchIndex + 1}/${batches.length} (${batch.length} chunks) for document ${documentId}...`);
            const { error: insertChunkError } = await supabaseClient.from('document_chunks').insert(batch);
            if (insertChunkError) {
              throw insertChunkError;
            }
            success = true;
            console.log(`Successfully inserted batch ${batchIndex + 1}/${batches.length} for document ${documentId}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (attempt < maxRetries) {
              const delay = 2000 * Math.pow(2, attempt);
              console.warn(`Batch ${batchIndex + 1} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, errorMessage);
              await new Promise((resolve)=>setTimeout(resolve, delay));
            } else {
              console.error(`PROCESS-DOCUMENT: Failed to insert batch ${batchIndex + 1} for document ${documentId} after ${maxRetries} retries:`, error);
              console.error('Batch insertion error details:', JSON.stringify(error, null, 2));
              if (batch.length > 0) {
                console.error('Sample chunk data from failed batch (first chunk):');
                console.error(`- document_id: ${batch[0].document_id}`);
                console.error(`- organisation_id: ${batch[0].organisation_id}`);
                console.error(`- chunk_index: ${batch[0].chunk_index}`);
                console.error(`- content length: ${batch[0].content?.length || 'undefined'}`);
                console.error(`- token_count: ${batch[0].token_count}`);
                console.error(`- embedding present: ${!!batch[0].embedding}`);
                console.error('Full chunk object:', JSON.stringify(batch[0], null, 2));
              }
              if (errorMessage.includes('organisation_id') && errorMessage.includes('not-null constraint')) {
                console.error(`PROCESS-DOCUMENT: organisation_id constraint violation detected!`);
                console.error(`Document organisation_id at time of error: ${document.organisation_id}`);
                console.error(`Batch contains ${batch.length} chunks`);
                batch.forEach((chunk, idx)=>{
                  if (!chunk.organisation_id) {
                    console.error(`PROCESS-DOCUMENT: Chunk ${idx} in failed batch has null organisation_id!`);
                  }
                });
              }
              throw new Error(`Failed to insert chunk batch after ${maxRetries} attempts: ${errorMessage}`);
            }
          }
        }
      }
      console.log(`✅ DATABASE INSERTION COMPLETE: Successfully inserted all ${chunkUpserts.length} chunks for document ${documentId} in ${batches.length} batches.`);
      console.log(`🎯 CHUNK PROCESSING COMPLETE: Successfully chunked and embedded ${processedChunks.length} chunks for document ${documentId}.`);
      console.log(`📝 SUMMARIZATION TRIGGER: Starting chunk summarization phase...`);
      await updateDocumentStatus(supabaseClient, documentId, 'processing', {
        chunks_created: processedChunks.length,
        processing_stage: 'summarizing_chunks'
      });
      const maxSummarizeRetries = 2;
      let summarizeSuccess = false;
      for(let attempt = 0; attempt <= maxSummarizeRetries && !summarizeSuccess; attempt++){
        try {
          console.log(`Invoking summarize-chunks for ${documentId} (attempt ${attempt + 1}/${maxSummarizeRetries + 1})...`);
          const { error: summarizeChunksError } = await supabaseClient.functions.invoke('summarize-chunks', {
            body: {
              documentId: document.id,
              summarizeLevel: 'chunk'
            }
          });
          if (summarizeChunksError) {
            throw summarizeChunksError;
          }
          summarizeSuccess = true;
          console.log(`Successfully invoked summarize-chunks for ${documentId}.`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (attempt < maxSummarizeRetries) {
            const delay = 5000 * (attempt + 1);
            console.warn(`Summarize-chunks failed (attempt ${attempt + 1}/${maxSummarizeRetries + 1}), retrying in ${delay}ms:`, errorMessage);
            await new Promise((resolve)=>setTimeout(resolve, delay));
          } else {
            console.error(`Error invoking summarize-chunks (chunk level) for ${documentId} after ${maxSummarizeRetries} retries:`, error);
            await updateDocumentStatus(supabaseClient, documentId, 'processing', {
              chunks_created: processedChunks.length,
              processing_stage: 'completed_with_summarization_error',
              summarization_error: errorMessage
            });
          }
        }
      }
      console.log(`🏁 FINAL COMPLETION: Marking document as completed...`);
      const finalStatus = summarizeSuccess ? 'completed' : 'completed';
      try {
        console.log(`🔄 FINAL STATUS: Attempting to update document ${documentId} to status: ${finalStatus}`);
        await updateDocumentStatus(supabaseClient, documentId, finalStatus, {
          processing_completed_at: new Date().toISOString(),
          processing_stage: summarizeSuccess ? 'completed' : 'completed_with_summarization_error',
          total_chunks_created: processedChunks.length,
          processing_duration_seconds: Math.round((Date.now() - Date.now()) / 1000)
        });
        console.log(`✅ FINAL STATUS UPDATE SUCCESS: Document ${documentId} marked as ${finalStatus}`);
        const { data: verifyDoc, error: verifyError } = await supabaseClient.from('documents').select('status').eq('id', documentId).single();
        if (verifyError) {
          console.error(`⚠️ VERIFY ERROR: Could not verify status update for ${documentId}:`, verifyError);
        } else {
          console.log(`✅ STATUS VERIFIED: Document ${documentId} status is now: ${verifyDoc.status}`);
        }
      } catch (statusError) {
        console.error(`❌ FINAL STATUS UPDATE ERROR for document ${documentId}:`, statusError);
        console.error(`❌ STATUS ERROR DETAILS:`, JSON.stringify(statusError, null, 2));
        console.log(`🔄 FALLBACK: Attempting simpler status update...`);
        try {
          const { error: fallbackError } = await supabaseClient.from('documents').update({
            status: 'completed'
          }).eq('id', documentId);
          if (fallbackError) {
            console.error(`❌ FALLBACK STATUS UPDATE FAILED:`, fallbackError);
          } else {
            console.log(`✅ FALLBACK STATUS UPDATE SUCCESS: Document ${documentId} marked as completed`);
          }
        } catch (fallbackErr) {
          console.error(`❌ FALLBACK ERROR:`, fallbackErr);
        }
        console.log(`⚠️ CONTINUING: Processing completed successfully despite status update issues`);
      }
      console.log(`🎉 PROCESS-DOCUMENT SUCCESS: Document ID ${documentId} processed successfully!`);
      return new Response(JSON.stringify({
        success: true,
        documentId,
        message: 'Document processing initiated.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      let structuredError = null;
      console.error(`PROCESS-DOCUMENT: Main error for doc ID ${documentId}:`, errorMessage);
      if (errorStack) {
        console.error(`PROCESS-DOCUMENT: Error stack:`, errorStack);
      }
      try {
        if (errorMessage.startsWith('{')) {
          structuredError = JSON.parse(errorMessage);
          console.log(`PROCESS-DOCUMENT: Parsed structured error:`, structuredError);
        }
      } catch  {
        console.log(`PROCESS-DOCUMENT: Using raw error message (not structured)`);
      }
      if (documentId && supabaseClient) {
        try {
          console.log(`PROCESS-DOCUMENT: Attempting to mark document ${documentId} as error...`);
          const errorMetadata = {
            processing_error: structuredError || {
              code: 'PROCESSING_ERROR',
              message: errorMessage,
              userFriendlyMessage: 'An error occurred while processing your document',
              suggestedActions: [
                'Try uploading the document again',
                'Check that the document is not corrupted or password-protected',
                'Contact support if the issue persists'
              ],
              retryable: true,
              timestamp: new Date().toISOString()
            },
            error_timestamp: new Date().toISOString(),
            processing_stage: 'error',
            error_stack_trace: errorStack ? errorStack.substring(0, 2000) : undefined
          };
          await updateDocumentStatus(supabaseClient, documentId, 'error', errorMetadata);
        } catch (dbUpdateError) {
          const dbErrorMessage = dbUpdateError instanceof Error ? dbUpdateError.message : String(dbUpdateError);
          console.error(`PROCESS-DOCUMENT: Failed to update document status to error:`, dbErrorMessage);
        }
      }
      return new Response(JSON.stringify({
        success: false,
        error: structuredError?.userFriendlyMessage || errorMessage,
        errorDetails: structuredError,
        documentId: documentId || 'unknown'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
});