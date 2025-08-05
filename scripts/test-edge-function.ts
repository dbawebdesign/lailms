// Environment variables are automatically loaded by Next.js
// No need to manually load dotenv in Next.js projects

async function testEdgeFunction() {
  console.log('🧪 Testing Supabase Edge Function for V3 Course Generation\n');

  // Check required environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Test job data (minimal for testing)
  const testJobData = {
    jobId: `test-job-${Date.now()}`,
    outline: {
      title: 'Test Course for Edge Function',
      description: 'Testing edge function deployment',
      modules: []
    },
    request: {
      baseClassId: 'test-base-class',
      userId: 'test-user',
      organisationId: 'test-org',
      title: 'Test Course'
    }
  };

  console.log('📤 Calling edge function with test data...');
  console.log(`Job ID: ${testJobData.jobId}\n`);

  try {
    // Call the edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-course-v3`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testJobData)
    });

    console.log(`📥 Response Status: ${response.status} ${response.statusText}`);
    
    const responseData = await response.json();
    console.log('\n📋 Response Data:');
    console.log(JSON.stringify(responseData, null, 2));

    if (response.ok && responseData.success) {
      console.log('\n✅ Edge function is working correctly!');
      console.log('\nNext steps:');
      console.log('1. Check the job status in your database');
      console.log('2. Monitor edge function logs: supabase functions logs generate-course-v3');
      console.log('3. Test with a real course generation from the UI');
    } else {
      console.error('\n❌ Edge function returned an error');
      console.error('Please check the edge function logs for more details');
    }

  } catch (error) {
    console.error('\n❌ Failed to call edge function:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure the edge function is deployed: supabase functions list');
    console.error('2. Check your Supabase URL and anon key are correct');
    console.error('3. Verify CORS settings in the edge function');
  }
}

// Run the test
testEdgeFunction().catch(console.error);