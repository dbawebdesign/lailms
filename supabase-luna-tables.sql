-- Enhanced Luna Chat Tables for Supabase
-- Run this in your Supabase SQL editor to create the required tables

-- Create luna_conversations table
CREATE TABLE IF NOT EXISTS public.luna_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New Conversation',
    persona TEXT NOT NULL DEFAULT 'lunaChat',
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_pinned BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    message_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    summary TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Create luna_messages table
CREATE TABLE IF NOT EXISTS public.luna_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.luna_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    persona TEXT NOT NULL DEFAULT 'lunaChat',
    is_outline BOOLEAN DEFAULT FALSE,
    outline_data JSONB,
    citations JSONB DEFAULT '[]',
    action_buttons JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    parent_message_id UUID REFERENCES public.luna_messages(id),
    edit_history JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_luna_conversations_user_id ON public.luna_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_luna_conversations_updated_at ON public.luna_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_luna_conversations_persona ON public.luna_conversations(persona);
CREATE INDEX IF NOT EXISTS idx_luna_conversations_pinned ON public.luna_conversations(is_pinned) WHERE is_pinned = true;

CREATE INDEX IF NOT EXISTS idx_luna_messages_conversation_id ON public.luna_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_luna_messages_created_at ON public.luna_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_luna_messages_role ON public.luna_messages(role);

-- Enable Row Level Security (RLS)
ALTER TABLE public.luna_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.luna_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies to ensure users can only access their own data
CREATE POLICY "Users can only access their own conversations" ON public.luna_conversations
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access messages from their own conversations" ON public.luna_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.luna_conversations 
            WHERE id = conversation_id AND user_id = auth.uid()
        )
    );

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_luna_conversations_updated_at 
    BEFORE UPDATE ON public.luna_conversations 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_luna_messages_updated_at 
    BEFORE UPDATE ON public.luna_messages 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically update conversation message count
CREATE OR REPLACE FUNCTION public.update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.luna_conversations 
        SET message_count = message_count + 1, updated_at = now()
        WHERE id = NEW.conversation_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.luna_conversations 
        SET message_count = GREATEST(message_count - 1, 0), updated_at = now()
        WHERE id = OLD.conversation_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update message count
CREATE TRIGGER update_conversation_message_count_trigger
    AFTER INSERT OR DELETE ON public.luna_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_conversation_message_count();

-- Add new columns to existing tables (safe migrations)
DO $$ 
BEGIN 
    -- Add is_outline column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'luna_messages' 
        AND column_name = 'is_outline'
    ) THEN
        ALTER TABLE public.luna_messages ADD COLUMN is_outline BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add outline_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'luna_messages' 
        AND column_name = 'outline_data'
    ) THEN
        ALTER TABLE public.luna_messages ADD COLUMN outline_data JSONB;
    END IF;

    -- Add citations column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'luna_messages' 
        AND column_name = 'citations'
    ) THEN
        ALTER TABLE public.luna_messages ADD COLUMN citations JSONB DEFAULT '[]';
    END IF;

    -- Add action_buttons column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'luna_messages' 
        AND column_name = 'action_buttons'
    ) THEN
        ALTER TABLE public.luna_messages ADD COLUMN action_buttons JSONB DEFAULT '[]';
    END IF;
END $$;

-- Grant necessary permissions to authenticated users
GRANT ALL ON public.luna_conversations TO authenticated;
GRANT ALL ON public.luna_messages TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated; 