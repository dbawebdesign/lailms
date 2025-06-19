import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/utils/supabase/server';
import { Database } from '@learnologyai/types';

export async function GET(request: NextRequest, { params }: { params: Promise<{ baseClassId: string }> }) {
  const { baseClassId } = await params;
  
  if (!baseClassId) {
    return NextResponse.json({ error: 'Invalid base class ID' }, { status: 400 });
  }
  
  const supabase = await createSupabaseServerClient();
  
  // Get assessment configuration
  const { data, error } = await supabase
    .from('base_classes')
    .select('assessment_config')
    .eq('id', baseClassId)
    .single();
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
  
  // Return default config if not set
  const config = data.assessment_config || {
    default_assessment_type: 'quiz',
    default_passing_score: 75,
    default_max_attempts: 3,
    default_time_limit_minutes: 60,
    allow_late_submissions: {
      enabled: true,
      penalty_percentage: 10
    }
  };
  
  return NextResponse.json(config);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ baseClassId: string }> }) {
  const { baseClassId } = await params;
  
  if (!baseClassId) {
    return NextResponse.json({ error: 'Invalid base class ID' }, { status: 400 });
  }
  
  const supabase = await createSupabaseServerClient();
  
  // Get the request body
  const body = await request.json();
  
  // Validate configuration
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid configuration format' }, { status: 400 });
  }
  
  // Optional: Add more specific validation for config fields
  if (body.default_passing_score !== undefined && 
      (typeof body.default_passing_score !== 'number' || 
       body.default_passing_score < 0 || 
       body.default_passing_score > 100)) {
    return NextResponse.json({ error: 'Invalid passing score (must be 0-100)' }, { status: 400 });
  }
  
  // Get current config to merge with updates
  const { data: currentData, error: fetchError } = await supabase
    .from('base_classes')
    .select('assessment_config')
    .eq('id', baseClassId)
    .single();
  
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!currentData) return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
  
  // Merge existing config with updates
  const updatedConfig = { 
    ...((currentData.assessment_config as object) || {}),
    ...body 
  };
  
  // Update the configuration
  const { data, error } = await supabase
    .from('base_classes')
    .update({ assessment_config: updatedConfig })
    .eq('id', baseClassId)
    .select();
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
  
  return NextResponse.json(updatedConfig);
} 