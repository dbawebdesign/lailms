/**
 * Verification script to ensure V3 course generation system is properly set up
 * Run with: npm run verify:v3
 */

// Environment variables are automatically loaded by Next.js
// No need to manually load dotenv in Next.js projects

async function verifySetup() {
  console.log('🔍 Verifying Course Generation V3 Setup\n');
  
  const checks = {
    environment: false,
    imports: false,
    database: false,
    tables: false,
    api: false
  };
  
  try {
    // 1. Check Environment Variables
    console.log('📋 1. Checking Environment Variables');
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY'
    ];
    
    let envOk = true;
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(`❌ Missing: ${envVar}`);
        envOk = false;
      } else {
        console.log(`✅ Found: ${envVar} (${process.env[envVar]?.substring(0, 10)}...)`);
      }
    }
    checks.environment = envOk;
    
    // 2. Check Module Imports
    console.log('\n📋 2. Checking Module Imports');
    try {
      const v3Module = await import('../src/lib/services/course-generation-orchestrator-v3');
      const rateLimiterModule = await import('../src/lib/services/course-generation-rate-limiter');
      const loggerModule = await import('../src/lib/services/course-generation-logger');
      const schemasModule = await import('../src/lib/schemas/course-generation-schemas');
      
      console.log('✅ CourseGenerationOrchestratorV3 imported');
      console.log('✅ CourseGenerationRateLimiter imported');
      console.log('✅ CourseGenerationLogger imported');
      console.log('✅ Course generation schemas imported');
      
      // Verify class instantiation
      const orchestrator = new v3Module.CourseGenerationOrchestratorV3();
      console.log('✅ V3 Orchestrator instantiated successfully');
      
      checks.imports = true;
    } catch (error) {
      console.error('❌ Import error:', error);
    }
    
    // 3. Check Database Connection
    console.log('\n📋 3. Checking Database Connection');
    try {
      const { createSupabaseServiceClient } = await import('../src/lib/supabase/server');
      const supabase = createSupabaseServiceClient();
      
      const { data, error } = await supabase
        .from('course_generation_jobs')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('❌ Database connection error:', error);
      } else {
        console.log('✅ Database connection successful');
        checks.database = true;
      }
    } catch (error) {
      console.error('❌ Supabase client error:', error);
    }
    
    // 4. Check Required Tables
    console.log('\n📋 4. Checking Required Tables');
    if (checks.database) {
      const { createSupabaseServiceClient } = await import('../src/lib/supabase/server');
      const supabase = createSupabaseServiceClient();
      
      const requiredTables = [
        'course_generation_queue',
        'course_generation_rate_limits',
        'course_generation_logs',
        'course_generation_alerts',
        'course_generation_cache'
      ];
      
      let tablesOk = true;
      for (const table of requiredTables) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.error(`❌ Table ${table}: ${error.message}`);
          tablesOk = false;
        } else {
          console.log(`✅ Table ${table} exists`);
        }
      }
      checks.tables = tablesOk;
    }
    
    // 5. Check API Route
    console.log('\n📋 5. Checking API Route Configuration');
    try {
      const apiRouteModule = await import('../src/app/api/course-generation/v2/route');
      console.log('✅ API route module loaded');
      
      // Read the route file to verify V3 usage
      const fs = await import('fs/promises');
      const routeContent = await fs.readFile(
        path.join(__dirname, '..', 'src/app/api/course-generation/v2/route.ts'),
        'utf-8'
      );
      
      if (routeContent.includes('CourseGenerationOrchestratorV3')) {
        console.log('✅ API route uses V3 orchestrator');
        checks.api = true;
      } else {
        console.error('❌ API route not using V3 orchestrator');
      }
    } catch (error) {
      console.error('❌ API route check error:', error);
    }
    
    // Summary
    console.log('\n📊 VERIFICATION SUMMARY:');
    console.log('━'.repeat(40));
    console.log(`Environment Variables: ${checks.environment ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Module Imports:        ${checks.imports ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Database Connection:   ${checks.database ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Required Tables:       ${checks.tables ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`API Configuration:     ${checks.api ? '✅ PASS' : '❌ FAIL'}`);
    console.log('━'.repeat(40));
    
    const allPassed = Object.values(checks).every(check => check);
    if (allPassed) {
      console.log('\n✅ All checks passed! The V3 system is ready for single-user testing.');
      console.log('\n🚀 Next steps:');
      console.log('1. Test the course generation through the UI');
      console.log('2. Monitor the database logs table for entries');
      console.log('3. Check rate limiting behavior');
      console.log('4. Verify structured output validation');
    } else {
      console.log('\n❌ Some checks failed. Please fix the issues above before testing.');
    }
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run verification
verifySetup().catch(console.error);