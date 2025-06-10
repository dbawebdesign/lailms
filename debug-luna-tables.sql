-- Debug script to check Luna tables and permissions
-- Run this in your Supabase SQL editor to verify setup

-- Check if luna_conversations table exists
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'luna_conversations'
ORDER BY ordinal_position;

-- Check if luna_messages table exists  
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'luna_messages'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('luna_conversations', 'luna_messages');

-- Test basic insert (this will help identify permission issues)
-- Replace 'your-user-id-here' with your actual user ID
DO $$
DECLARE
    test_user_id UUID := 'your-user-id-here'; -- REPLACE THIS WITH YOUR ACTUAL USER ID
    test_conv_id UUID;
BEGIN
    -- Test conversation insert
    INSERT INTO public.luna_conversations (
        id, title, persona, user_id, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), 
        'Test Conversation', 
        'lunaChat', 
        test_user_id, 
        now(), 
        now()
    ) RETURNING id INTO test_conv_id;
    
    RAISE NOTICE 'Successfully created test conversation: %', test_conv_id;
    
    -- Test message insert
    INSERT INTO public.luna_messages (
        id, conversation_id, role, content, persona, created_at
    ) VALUES (
        gen_random_uuid(),
        test_conv_id,
        'user',
        'Test message',
        'lunaChat',
        now()
    );
    
    RAISE NOTICE 'Successfully created test message';
    
    -- Clean up test data
    DELETE FROM public.luna_messages WHERE conversation_id = test_conv_id;
    DELETE FROM public.luna_conversations WHERE id = test_conv_id;
    
    RAISE NOTICE 'Test completed successfully - tables and permissions are working';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Test failed with error: %', SQLERRM;
END $$; 