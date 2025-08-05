/**
 * Test the V3 course generation through the API endpoint
 * Run with: npx tsx scripts/test-v3-api-endpoint.ts
 */

// Environment variables are automatically loaded by Next.js
// No need to manually load dotenv in Next.js projects

async function testV3APIEndpoint() {
  console.log('🧪 Testing V3 Course Generation API Endpoint\n');
  
  const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // You'll need to set a valid auth token here
  // This can be obtained from your browser's dev tools when logged in
  const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';
  
  if (!AUTH_TOKEN) {
    console.error('❌ Please set TEST_AUTH_TOKEN environment variable');
    console.log('\nTo get an auth token:');
    console.log('1. Log into your app in the browser');
    console.log('2. Open browser dev tools (F12)');
    console.log('3. Go to Application/Storage > Local Storage');
    console.log('4. Find the supabase auth token');
    console.log('5. Set TEST_AUTH_TOKEN in your .env.local file');
    return;
  }
  
  try {
    console.log('📋 Sending test course generation request...');
    
    const requestBody = {
      baseClassId: 'test-base-class-v3',
      title: 'V3 Test Course: Introduction to Web Development',
      description: 'A comprehensive course testing the V3 optimization features including structured outputs, rate limiting, and logging.',
      generationMode: 'kb_supplemented',
      estimatedDurationWeeks: 2,
      academicLevel: 'intermediate',
      lessonDetailLevel: 'detailed',
      targetAudience: 'Adult learners interested in web development',
      prerequisites: 'Basic computer skills',
      lessonsPerWeek: 2,
      learningObjectives: [
        'Understand HTML basics',
        'Learn CSS styling',
        'Introduction to JavaScript',
        'Build a simple webpage'
      ],
      assessmentSettings: {
        includeAssessments: true,
        quizFrequency: 'per_lesson',
        assessmentTypes: ['multiple_choice', 'short_answer']
      }
    };
    
    const response = await fetch(`${API_URL}/api/course-generation/v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API request failed:', response.status, data);
      return;
    }
    
    console.log('✅ Course generation started successfully!');
    console.log('\n📊 Response:', JSON.stringify(data, null, 2));
    
    if (data.jobId) {
      console.log(`\n🔍 Job ID: ${data.jobId}`);
      console.log('\n📝 Next steps:');
      console.log('1. Check the course generation progress in your UI');
      console.log('2. Monitor the database tables:');
      console.log('   - course_generation_jobs (for job status)');
      console.log('   - course_generation_tasks (for task progress)');
      console.log('   - course_generation_logs (for detailed logs)');
      console.log('   - course_generation_rate_limits (for rate limit tracking)');
      console.log('\n💡 SQL queries to monitor progress:');
      console.log(`
-- Check job status
SELECT * FROM course_generation_jobs WHERE id = '${data.jobId}';

-- Check task progress
SELECT task_type, status, COUNT(*) 
FROM course_generation_tasks 
WHERE job_id = '${data.jobId}'
GROUP BY task_type, status;

-- Check logs
SELECT * FROM course_generation_logs 
WHERE job_id = '${data.jobId}'
ORDER BY timestamp DESC
LIMIT 20;

-- Check rate limits
SELECT * FROM course_generation_rate_limits 
WHERE user_id = (
  SELECT user_id FROM course_generation_jobs WHERE id = '${data.jobId}'
);
      `);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testV3APIEndpoint().catch(console.error);