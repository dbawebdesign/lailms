const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

async function fixMissingEmbeddings() {
  console.log('🔍 Finding chunks without embeddings...');
  
  // Get chunks without embeddings for the specific base class
  const { data: chunks, error } = await supabase
    .from('document_chunks')
    .select('id, content, document_id')
    .is('embedding', null)
    .limit(50); // Process in batches
    
  if (error) {
    console.error('Error fetching chunks:', error);
    return;
  }
  
  if (!chunks || chunks.length === 0) {
    console.log('✅ No chunks found without embeddings!');
    return;
  }
  
  console.log(`📝 Found ${chunks.length} chunks without embeddings. Processing...`);
  
  let processed = 0;
  let errors = 0;
  
  for (const chunk of chunks) {
    try {
      console.log(`Processing chunk ${chunk.id} (${processed + 1}/${chunks.length})...`);
      
      // Generate embedding
      const embedding = await generateEmbedding(chunk.content);
      
      // Update chunk with embedding
      const { error: updateError } = await supabase
        .from('document_chunks')
        .update({ embedding })
        .eq('id', chunk.id);
        
      if (updateError) {
        console.error(`❌ Error updating chunk ${chunk.id}:`, updateError.message);
        errors++;
      } else {
        processed++;
        console.log(`✅ Updated chunk ${chunk.id}`);
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error processing chunk ${chunk.id}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n🎉 Processing complete!`);
  console.log(`✅ Successfully processed: ${processed}`);
  console.log(`❌ Errors: ${errors}`);
  
  if (processed > 0) {
    console.log('\n🔍 Testing search functionality...');
    await testSearch();
  }
}

async function testSearch() {
  try {
    // Test with a simple query
    const testEmbedding = await generateEmbedding('theology and doctrine');
    
    const { data, error } = await supabase.rpc('vector_search_with_base_class', {
      query_embedding: testEmbedding,
      organisation_id: '72b7e4c1-8a3f-4b35-b4c8-5e9b3b6a5a5a', // You'll need the real org ID
      base_class_id: '4ed070f8-6933-44ab-b2d3-7067aaf80123',
      match_threshold: 0.3,
      match_count: 5
    });
    
    if (error) {
      console.error('❌ Search test failed:', error.message);
    } else {
      console.log(`✅ Search test successful! Found ${data?.length || 0} results.`);
      if (data && data.length > 0) {
        console.log('📄 Sample result:', data[0].content?.substring(0, 100) + '...');
      }
    }
  } catch (error) {
    console.error('❌ Search test error:', error.message);
  }
}

// Run the script
fixMissingEmbeddings().catch(console.error); 