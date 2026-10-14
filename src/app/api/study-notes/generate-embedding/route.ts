import { AI_MODELS } from '@/lib/ai/model-policy';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const supabase: SupabaseClient = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { noteId } = await request.json();

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    // Get the note content
    const { data: note, error: noteError } = await supabase
      .from('study_notes')
      .select('title, content')
      .eq('id', noteId)
      .eq('user_id', user.id)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Combine title and content for embedding
    const textToEmbed = `${note.title}\n\n${note.content}`;

    // Generate embedding using OpenAI's text-embedding-3-small model
    const embeddingResponse = await openai.embeddings.create({
      model: AI_MODELS.embedding,
      input: textToEmbed,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Update the note with the embedding
    const { error: updateError } = await supabase
      .from('study_notes')
      .update({
        content_embedding: JSON.stringify(embedding),
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId)
      .eq('user_id', user.id);

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
