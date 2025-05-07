import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface JoinByCodeRequest {
  enrollment_code: string;
}

// This structure should match the TABLE returned by the RPC function
interface JoinByCodeResponse {
  success: boolean;
  message: string;
  class_instance_id?: string; // uuid is string in JS/TS
  class_instance_name?: string;
  enrollment_id?: string; // uuid is string in JS/TS
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  let requestBody: JoinByCodeRequest;

  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body. JSON expected.' }, { status: 400 });
  }

  const { enrollment_code } = requestBody;

  if (!enrollment_code || typeof enrollment_code !== 'string' || enrollment_code.trim() === '') {
    return NextResponse.json({ error: 'enrollment_code is required and must be a non-empty string.' }, { status: 400 });
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      // This check is important, as the RPC relies on auth.uid()
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // Call the RPC function
    // The type casting `as JoinByCodeResponse` assumes the RPC returns a single row matching this structure.
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('join_class_by_code', { p_enrollment_code: enrollment_code })
      .single<JoinByCodeResponse>(); // .single() is appropriate as RPC returns one row

    if (rpcError) {
      console.error('Error calling join_class_by_code RPC:', rpcError);
      return NextResponse.json({ 
        error: 'Failed to process enrollment code.', 
        details: rpcError.message 
      }, { status: 500 });
    }

    if (!rpcResult) {
        // This case might occur if the RPC somehow doesn't return a row, though it should always return one.
        return NextResponse.json({ error: 'No response from enrollment process.'}, { status: 500 });
    }

    // The RPC result contains { success, message, class_instance_id, ... }
    // We can return this directly, or tailor the response.
    if (rpcResult.success) {
      return NextResponse.json(rpcResult, { status: 200 }); // Or 201 if a new enrollment was created
    } else {
      // Determine appropriate status code based on the message if possible, else default to 400 or 404
      let statusCode = 400;
      if (rpcResult.message?.includes('Invalid enrollment code')) statusCode = 404;
      if (rpcResult.message?.includes('maximum capacity')) statusCode = 409; // Conflict
      if (rpcResult.message?.includes('already enrolled')) statusCode = 200; // Still a success in a way, or 409 if preferred
      
      return NextResponse.json(rpcResult, { status: statusCode });
    }

  } catch (error: any) {
    console.error('Unexpected error in POST /enrollments/join-by-code:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
} 