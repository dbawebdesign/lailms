import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Username validation regex: 3-20 characters, alphanumeric, underscore, hyphen
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { firstName, lastName, username } = body;

    // Get current profile
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('username, is_sub_account')
      .eq('user_id', user.id)
      .single();

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user is a sub-account
    if ((currentProfile as any).is_sub_account) {
      return NextResponse.json({ error: 'Sub-accounts cannot update profile settings' }, { status: 403 });
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Validate and add first name
    if (firstName !== undefined) {
      if (typeof firstName !== 'string') {
        return NextResponse.json({ error: 'First name must be a string' }, { status: 400 });
      }
      const trimmedFirstName = firstName.trim();
      if (trimmedFirstName.length > 50) {
        return NextResponse.json({ error: 'First name must be 50 characters or less' }, { status: 400 });
      }
      updateData.first_name = trimmedFirstName || null;
    }

    // Validate and add last name
    if (lastName !== undefined) {
      if (typeof lastName !== 'string') {
        return NextResponse.json({ error: 'Last name must be a string' }, { status: 400 });
      }
      const trimmedLastName = lastName.trim();
      if (trimmedLastName.length > 50) {
        return NextResponse.json({ error: 'Last name must be 50 characters or less' }, { status: 400 });
      }
      updateData.last_name = trimmedLastName || null;
    }

    // Validate and add username if provided
    if (username !== undefined && username !== (currentProfile as any).username) {
      if (username === null || username === '') {
        // Allow clearing username for homeschool accounts
        updateData.username = null;
      } else {
        const trimmedUsername = username.trim().toLowerCase();
        
        if (!USERNAME_REGEX.test(trimmedUsername)) {
          return NextResponse.json({ 
            error: 'Username must be 3-20 characters and can only contain letters, numbers, underscores, and hyphens' 
          }, { status: 400 });
        }

        // Check if username is available
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('username', trimmedUsername)
          .neq('user_id', user.id)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking username:', checkError);
          return NextResponse.json({ error: 'Error checking username availability' }, { status: 500 });
        }

        if (existingUser) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
        }

        updateData.username = trimmedUsername;
      }
    }

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select('user_id, username, first_name, last_name')
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        userId: (updatedProfile as any).user_id,
        username: (updatedProfile as any).username,
        firstName: (updatedProfile as any).first_name,
        lastName: (updatedProfile as any).last_name,
      },
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
