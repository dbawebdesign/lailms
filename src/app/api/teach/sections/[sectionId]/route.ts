import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server'; // Adjusted import path

interface SectionParams {
  params: Promise<{ // Changed to Promise
    sectionId: string;
  }>;
}

// GET a specific section by ID
export async function GET(request: NextRequest, { params }: SectionParams) {
  const supabase = createSupabaseServerClient();
  const { sectionId } = await params; // Await params

  if (!sectionId) {
    return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
  }

  try {
    const { data: section, error } = await supabase
      .from('sections')
      .select('*')
      .eq('id', sectionId)
      .single();

    if (error) {
      console.error('Error fetching section:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json(section);
  } catch (err) {
    console.error('Unexpected error fetching section:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

// UPDATE a specific section by ID
export async function PUT(request: NextRequest, { params }: SectionParams) {
  const supabase = createSupabaseServerClient();
  const { sectionId } = await params; // Await params
  let updatedData;

  try {
    updatedData = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!sectionId) {
    return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('sections')
      .update(updatedData)
      .eq('id', sectionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating section:', error);
      if (error.code === 'PGRST116') { // Not found
        return NextResponse.json({ error: 'Section not found to update' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('Unexpected error updating section:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

// DELETE a specific section by ID
export async function DELETE(request: NextRequest, { params }: SectionParams) {
  const supabase = createSupabaseServerClient();
  const { sectionId } = await params; // Await params

  if (!sectionId) {
    return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
  }

  try {
    const { error } = await supabase.from('sections').delete().eq('id', sectionId);

    if (error) {
      console.error('Error deleting section:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check if any rows were actually deleted, though DELETE doesn't return data directly in the same way as select/update.
    // For simplicity, we'll assume success if no error. A more robust check might query before/after or check affectedRows if available.
    return NextResponse.json({ message: 'Section deleted successfully' }, { status: 200 }); // Or 204 No Content
  } catch (err) {
    console.error('Unexpected error deleting section:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
} 