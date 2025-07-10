-- Create base_class_media_assets table for storing media assets associated with base classes
CREATE TABLE IF NOT EXISTS public.base_class_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_class_id UUID NOT NULL REFERENCES public.base_classes(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL, -- 'mind_map', 'podcast', 'video', etc.
    title TEXT NOT NULL,
    content JSONB, -- Store structured data about the asset
    svg_content TEXT, -- For HTML/SVG content like mind maps
    file_url TEXT, -- For file-based assets
    file_size BIGINT, -- File size in bytes
    duration INTEGER, -- Duration in seconds for audio/video
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT, -- Store error details if generation fails
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_base_class_media_assets_base_class_id ON public.base_class_media_assets(base_class_id);
CREATE INDEX IF NOT EXISTS idx_base_class_media_assets_asset_type ON public.base_class_media_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_base_class_media_assets_status ON public.base_class_media_assets(status);
CREATE INDEX IF NOT EXISTS idx_base_class_media_assets_created_by ON public.base_class_media_assets(created_by);

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_base_class_media_assets
    BEFORE UPDATE ON public.base_class_media_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_timestamp();

-- Add RLS policies
ALTER TABLE public.base_class_media_assets ENABLE ROW LEVEL SECURITY;

-- Users can view media assets for base classes they have access to
CREATE POLICY "Users can view base class media assets they have access to"
    ON public.base_class_media_assets
    FOR SELECT
    USING (
        base_class_id IN (
            SELECT bc.id 
            FROM public.base_classes bc
            WHERE bc.organisation_id IN (
                SELECT organisation_id 
                FROM public.members 
                WHERE id = auth.uid()
            )
        )
    );

-- Users can create media assets for base classes they have access to
CREATE POLICY "Users can create base class media assets for accessible base classes"
    ON public.base_class_media_assets
    FOR INSERT
    WITH CHECK (
        base_class_id IN (
            SELECT bc.id 
            FROM public.base_classes bc
            WHERE bc.organisation_id IN (
                SELECT organisation_id 
                FROM public.members 
                WHERE id = auth.uid()
            )
        )
        AND created_by = auth.uid()
    );

-- Users can update their own media assets
CREATE POLICY "Users can update their own base class media assets"
    ON public.base_class_media_assets
    FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Users can delete their own media assets
CREATE POLICY "Users can delete their own base class media assets"
    ON public.base_class_media_assets
    FOR DELETE
    USING (created_by = auth.uid());

-- Add comments
COMMENT ON TABLE public.base_class_media_assets IS 'Media assets (mind maps, podcasts, etc.) associated with base classes';
COMMENT ON COLUMN public.base_class_media_assets.base_class_id IS 'Reference to the base class this asset belongs to';
COMMENT ON COLUMN public.base_class_media_assets.asset_type IS 'Type of media asset (mind_map, podcast, video, etc.)';
COMMENT ON COLUMN public.base_class_media_assets.content IS 'Structured data about the asset (JSON)';
COMMENT ON COLUMN public.base_class_media_assets.svg_content IS 'HTML/SVG content for interactive assets like mind maps';
COMMENT ON COLUMN public.base_class_media_assets.status IS 'Generation status: pending, processing, completed, failed';
COMMENT ON COLUMN public.base_class_media_assets.created_by IS 'User who created/generated this asset'; 