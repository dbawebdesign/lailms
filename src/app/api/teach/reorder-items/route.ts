import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface ReorderRequestBody {
  itemType: 'path' | 'lesson' | 'section';
  orderedIds: string[];
  parentId: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { itemType, orderedIds, parentId }: ReorderRequestBody = await request.json();

    if (!itemType || !orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0 || !parentId) {
      return NextResponse.json({ error: 'Invalid request body: itemType, orderedIds, and parentId are required.' }, { status: 400 });
    }

    // Validate UUIDs
    if (orderedIds.some(id => !id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) || 
        !parentId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
        return NextResponse.json({ error: 'Invalid UUID format in orderedIds or parentId' }, { status: 400 });
    }

    // TODO: Add comprehensive permission checks here. 
    // The user must have rights to edit the parent (BaseClass, Path, or Lesson) to reorder its children.
    // This might involve fetching the parent entity based on one of the orderedIds and verifying ownership.
    // For now, we assume the client-side logic only allows reordering of authorized items.

    // Reorder items by updating their order_index based on their position in the orderedIds array
    try {
      switch (itemType) {
        case 'path':
          // Use dedicated reorder function for paths
          const { error: pathError } = await supabase.rpc('reorder_paths', {
            _base_class_id: parentId,
            _ordered_ids: orderedIds
          });
          
          if (pathError) {
            throw new Error(`Failed to reorder paths: ${pathError.message}`);
          }
          break;
          
        case 'lesson':
          // Use dedicated reorder function for lessons
          const { error: lessonError } = await supabase.rpc('reorder_lessons', {
            _path_id: parentId,
            _ordered_ids: orderedIds
          });
          
          if (lessonError) {
            throw new Error(`Failed to reorder lessons: ${lessonError.message}`);
          }
          break;
          
        case 'section':
          // Use dedicated reorder function for lesson sections
          const { error: sectionError } = await supabase.rpc('reorder_lesson_sections', {
            _lesson_id: parentId,
            _ordered_ids: orderedIds
          });
          
          if (sectionError) {
            throw new Error(`Failed to reorder sections: ${sectionError.message}`);
          }
          break;
          
        default:
          return NextResponse.json({ error: 'Invalid item type for reordering' }, { status: 400 });
      }

      return NextResponse.json({ message: `${itemType} items reordered successfully.` });
      
    } catch (updateError: any) {
      console.error(`Error updating ${itemType} order:`, updateError);
      return NextResponse.json({ error: `Failed to update order for ${itemType}: ${updateError.message}` }, { status: 500 });
    }

  } catch (e: any) {
    console.error('Error in reorder-items endpoint:', e);
    if (e instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: `An unexpected error occurred: ${e.message}` }, { status: 500 });
  }
} 