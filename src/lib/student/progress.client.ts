import { createClient } from '@/lib/supabase/client';

/**
 * Updates the progress for a specific item.
 * This should be called from the client.
 * @param itemId - The ID of the lesson or assessment.
 * @param itemType - The type of the item ('lesson' or 'assessment').
 * @param userId - The ID of the user.
 * @param status - The new status of the item.
 */
export async function updateItemProgress(
    itemId: string, 
    itemType: 'lesson' | 'assessment', 
    userId: string, 
    status: 'in_progress' | 'completed' | 'passed' | 'failed'
) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('progress')
        .upsert(
            {
                user_id: userId,
                item_id: itemId,
                item_type: itemType,
                status: status,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'user_id, item_id, item_type' }
        )
        .select();

    if (error) {
        console.error(`Failed to update ${itemType} progress:`, error);
        throw error;
    }

    return data;
} 