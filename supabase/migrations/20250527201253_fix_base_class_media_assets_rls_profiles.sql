-- Fix RLS policies for base_class_media_assets table to use profiles instead of members
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view base class media assets they have access to" ON public.base_class_media_assets;
DROP POLICY IF EXISTS "Users can create base class media assets for accessible base classes" ON public.base_class_media_assets;
DROP POLICY IF EXISTS "Users can update base class media assets they have access to" ON public.base_class_media_assets;
DROP POLICY IF EXISTS "Users can delete base class media assets they have access to" ON public.base_class_media_assets;

-- Create correct policies using profiles table
-- Users can view media assets for base classes they have access to
CREATE POLICY "Users can view base class media assets they have access to"
    ON public.base_class_media_assets
    FOR SELECT
    USING (
        -- Check if user has access to the base class through organization membership via profiles
        EXISTS (
            SELECT 1 
            FROM public.base_classes bc
            JOIN public.profiles p ON bc.organisation_id = p.organisation_id
            WHERE bc.id = base_class_media_assets.base_class_id
            AND p.user_id = auth.uid()
        )
        OR
        -- Or if the user created the asset
        created_by = auth.uid()
    );

-- Users can create media assets for base classes they have access to
CREATE POLICY "Users can create base class media assets for accessible base classes"
    ON public.base_class_media_assets
    FOR INSERT
    WITH CHECK (
        -- Check if user has access to the base class through organization membership via profiles
        EXISTS (
            SELECT 1 
            FROM public.base_classes bc
            JOIN public.profiles p ON bc.organisation_id = p.organisation_id
            WHERE bc.id = base_class_media_assets.base_class_id
            AND p.user_id = auth.uid()
        )
        AND created_by = auth.uid()
    );

-- Users can update media assets for base classes they have access to
CREATE POLICY "Users can update base class media assets they have access to"
    ON public.base_class_media_assets
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 
            FROM public.base_classes bc
            JOIN public.profiles p ON bc.organisation_id = p.organisation_id
            WHERE bc.id = base_class_media_assets.base_class_id
            AND p.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.base_classes bc
            JOIN public.profiles p ON bc.organisation_id = p.organisation_id
            WHERE bc.id = base_class_media_assets.base_class_id
            AND p.user_id = auth.uid()
        )
    );

-- Users can delete media assets for base classes they have access to
CREATE POLICY "Users can delete base class media assets they have access to"
    ON public.base_class_media_assets
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 
            FROM public.base_classes bc
            JOIN public.profiles p ON bc.organisation_id = p.organisation_id
            WHERE bc.id = base_class_media_assets.base_class_id
            AND p.user_id = auth.uid()
        )
        OR created_by = auth.uid()
    );
