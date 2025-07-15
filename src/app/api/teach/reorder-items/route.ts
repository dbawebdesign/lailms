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
          // Update paths order_index
          for (let i = 0; i < orderedIds.length; i++) {
            const { error: updateError } = await supabase
              .from('paths')
              .update({ order_index: i })
              .eq('id', orderedIds[i])
              .eq('base_class_id', parentId);
            
            if (updateError) {
              throw new Error(`Failed to update path ${orderedIds[i]}: ${updateError.message}`);
            }
          }
          break;
          
        case 'lesson':
          // Update lessons order_index
          for (let i = 0; i < orderedIds.length; i++) {
            const { error: updateError } = await supabase
              .from('lessons')
              .update({ order_index: i })
              .eq('id', orderedIds[i])
              .eq('path_id', parentId);
            
            if (updateError) {
              throw new Error(`Failed to update lesson ${orderedIds[i]}: ${updateError.message}`);
            }
          }
          break;
          
        case 'section':
          // Update lesson_sections order_index
          for (let i = 0; i < orderedIds.length; i++) {
            const { error: updateError } = await supabase
              .from('lesson_sections')
              .update({ order_index: i })
              .eq('id', orderedIds[i])
              .eq('lesson_id', parentId);
            
            if (updateError) {
              throw new Error(`Failed to update section ${orderedIds[i]}: ${updateError.message}`);
            }
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