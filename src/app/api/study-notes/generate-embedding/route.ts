import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { noteId } = await request.json();

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    // Get the note content
    const { data: note, error: noteError } = await supabase
      .from('study_notes')
      .select('title, content')
      .eq('id', noteId)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Combine title and content for embedding
    const textToEmbed = `${note.title}\n\n${note.content}`;

    // Generate embedding using OpenAI's text-embedding-3-small model
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textToEmbed,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Update the note with the embedding
    const { error: updateError } = await supabase
      .from('study_notes')
      .update({
        embedding: embedding,
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId);

    if (updateError) {
      console.error('Error updating note with embedding:', updateError);
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }

    return NextResponse.json({ success: true, embeddingGenerated: true });

  } catch (error) {
    console.error('Error generating embedding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 