import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from 'packages/types/db';
import { createClient } from '@supabase/supabase-js';

import { PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  
  // Check environment variables availability (no actual values)
  const environmentCheck = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "not set",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "not set",
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "not set",
    NODE_ENV: process.env.NODE_ENV || "not set"
  };
  
  try {
    // 1. Get the current user
    const { data: userData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userData.user) {
      return NextResponse.json({ 
        status: 'error',
        message: 'Authentication failed', 
        authError,
        hasUser: false,
        environment: environmentCheck
      }, { status: 401 });
    }
    
    const userId = userData.user.id;
    
    // 2. Try to get the user's profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(PROFILE_ROLE_FIELDS + ', user_id, organisation_id, created_at')
      .eq('user_id', userId)
      .single<Tables<'profiles'>>();
    
    // 3. Check organisation from profiles
    let orgId = null;
    if (profileData?.organisation_id) {
      orgId = profileData.organisation_id;
    }
    
    let organization = null;
    let orgError = null;
    let baseClasses = null;
    let baseClassesError = null;
    
    if (orgId) {
      // Try to get organization details
      const orgResult = await supabase
        .from('organisations')
        .select('*')
        .eq('id', orgId)
        .single<Tables<'organisations'>>();
      
      organization = orgResult.data;
      orgError = orgResult.error;
      
      // Try to get base classes
      const baseClassesResult = await supabase
        .from('base_classes')
        .select('*')
        .eq('organisation_id', orgId);
      
      baseClasses = baseClassesResult.data;
      baseClassesError = baseClassesResult.error;
    }
    
    // 5. Check Service Role Access
    let serviceKeyExists = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    let serviceAccessTestResult = null;
    let serviceAccessError = null;
    
    if (serviceKeyExists) {
      try {
        // Create admin client
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        // Try a simple query with admin privileges
        if (orgId) {
          const { data, error } = await adminClient
            .from('base_classes')
            .select('count(*)')
            .eq('organisation_id', orgId);
          
          serviceAccessTestResult = data;
          serviceAccessError = error;
        }
      } catch (e: any) {
        serviceAccessError = {
          message: e.message,
          name: e.name
        };
      }
    }
    
    // 6. Test direct insert with service role (dummy data that will be rolled back)
    let testInsertResult = null;
    let testInsertError = null;
    
    if (serviceKeyExists && orgId) {
      try {
        // Create admin client
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        // Try a test insert
        const testData = {
          organisation_id: orgId,
          name: `TEST_DEBUG_${new Date().toISOString()}`,
          description: 'Debug test class - will be deleted',
          settings: {
            test: true,
            debug: true
          }
        };
        
        // Use a transaction to rollback the test
        const { data, error } = await adminClient.rpc('debug_test_insert', {
          test_data: testData
        });
        
        // Fallback if the RPC doesn't exist: direct attempt (will be visible in logs at least)
        if (error && error.message.includes('function "debug_test_insert" does not exist')) {
          console.log('Warning: debug_test_insert RPC not found, performing direct test (will not be rolled back)');
          const directResult = await adminClient
            .from('base_classes')
            .insert(testData)
            .select()
            .single<Tables<'base_classes'>>();
            
          testInsertResult = directResult.data ? 'Success' : null;
          testInsertError = directResult.error;
        } else {
          testInsertResult = data;
          testInsertError = error;
        }
      } catch (e: any) {
        testInsertError = {
          message: e.message,
          name: e.name
        };
      }
    }
    
    return NextResponse.json({
      status: 'success',
      environment: environmentCheck,
      user: {
        id: userId,
        email: userData.user.email,
        phone: userData.user.phone,
        emailConfirmed: userData.user.email_confirmed_at ? true : false,
        lastSignIn: userData.user.last_sign_in_at
      },
      profile: {
        data: profileData,
        error: profileError
      },
      organization: {
        id: orgId,
        data: organization,
        error: orgError
      },
      baseClasses: {
        count: baseClasses?.length || 0,
        error: baseClassesError
      },
      serviceRoleTest: {
        success: !!serviceAccessTestResult && !serviceAccessError,
        data: serviceAccessTestResult,
        error: serviceAccessError
      },
      testInsert: {
        success: !!testInsertResult && !testInsertError,
        data: testInsertResult,
        error: testInsertError
      },
      recommendedFixes: [
        "Ensure profiles table exists and has user_id, organisation_id, and role columns",
        "Verify service role key is set in environment variables",
        "Check Row-Level Security (RLS) policies on base_classes table",
        "Create a service role-specific API route for direct base class creation",
        "Check access to your organisation record exists and has proper id field"
      ]
    });
    
  } catch (error: any) {
    console.error('Debug API error:', error);
    return NextResponse.json({ 
      status: 'error',
      message: 'Internal server error',
      error: String(error),
      environment: environmentCheck
    }, { status: 500 });
  }
} 