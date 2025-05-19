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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
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

    let rpcName = '';
    let rpcParams: any = {}; // Use 'any' for flexibility, or define a more specific type

    switch (itemType) {
      case 'path':
        rpcName = 'reorder_paths';
        rpcParams = { _base_class_id: parentId, _ordered_ids: orderedIds };
        break;
      case 'lesson':
        rpcName = 'reorder_lessons';
        rpcParams = { _path_id: parentId, _ordered_ids: orderedIds };
        break;
      case 'section':
        rpcName = 'reorder_lesson_sections'; // Ensure this matches our DB function name
        rpcParams = { _lesson_id: parentId, _ordered_ids: orderedIds };
        break;
      default:
        return NextResponse.json({ error: 'Invalid item type for reordering' }, { status: 400 });
    }

    const { data, error: rpcError } = await supabase.rpc(rpcName, rpcParams);

    if (rpcError) {
      console.error(`Error calling RPC ${rpcName} with params ${JSON.stringify(rpcParams)}:`, rpcError);
      return NextResponse.json({ error: `Failed to update order for ${itemType}: ${rpcError.message}` }, { status: 500 });
    }

    return NextResponse.json({ message: `${itemType} items reordered successfully.` });

  } catch (e: any) {
    console.error('Error in reorder-items endpoint:', e);
    if (e instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: `An unexpected error occurred: ${e.message}` }, { status: 500 });
  }
} 