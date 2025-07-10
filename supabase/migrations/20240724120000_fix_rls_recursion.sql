-- Dropping the existing policies on rosters and class_instances to redefine them
DROP POLICY IF EXISTS "Allow roster members read access" ON public.rosters;
DROP POLICY IF EXISTS "Allow class admin/teacher management of rosters" ON public.rosters;
DROP POLICY IF EXISTS "Allow enrolled members read access to class instances" ON public.class_instances;
DROP POLICY IF EXISTS "Allow org admin/teacher management of class instances" ON public.class_instances;

-- Redefined policy for class_instances read access
-- This policy allows access if the user is an admin/teacher OR is listed in the roster.
-- It no longer recursively checks rosters from within the class_instances policy.
CREATE POLICY "Allow enrolled members read access to class instances" ON public.class_instances
FOR SELECT
USING (
    (
        EXISTS (
            SELECT 1 FROM public.base_classes bc
            WHERE bc.id = public.class_instances.base_class_id
            AND bc.organisation_id = public.get_my_org_id()
        ) AND public.get_my_role() IN ('ADMIN', 'TEACHER')
    ) OR
    (
        EXISTS (
            SELECT 1
            FROM public.rosters r
            WHERE r.class_instance_id = public.class_instances.id
            AND r.member_id = (SELECT auth.uid())
        )
    )
);

-- Redefined policy for class_instances management
-- Allows admins and teachers to manage class instances within their organization.
CREATE POLICY "Allow org admin/teacher management of class instances" ON public.class_instances
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.base_classes bc
        WHERE bc.id = public.class_instances.base_class_id
        AND bc.organisation_id = public.get_my_org_id()
    ) AND public.get_my_role() IN ('ADMIN', 'TEACHER')
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.base_classes bc
        WHERE bc.id = public.class_instances.base_class_id
        AND bc.organisation_id = public.get_my_org_id()
    ) AND public.get_my_role() IN ('ADMIN', 'TEACHER')
);

-- Redefined policy for rosters read access
-- This avoids the recursive check by separating the logic for members and teachers/admins.
CREATE POLICY "Allow roster members read access" ON public.rosters
FOR SELECT
USING (
    (member_id = (SELECT auth.uid())) OR
    (
        EXISTS (
            SELECT 1 FROM public.class_instances ci
            JOIN public.base_classes bc ON ci.base_class_id = bc.id
            WHERE ci.id = public.rosters.class_instance_id
            AND bc.organisation_id = public.get_my_org_id()
            AND public.get_my_role() IN ('ADMIN', 'TEACHER')
        )
    )
);

-- Redefined policy for rosters management
-- Allows admins and teachers to manage rosters for classes in their organization.
CREATE POLICY "Allow class admin/teacher management of rosters" ON public.rosters
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.class_instances ci
        JOIN public.base_classes bc ON ci.base_class_id = bc.id
        WHERE ci.id = public.rosters.class_instance_id
        AND bc.organisation_id = public.get_my_org_id()
        AND public.get_my_role() IN ('ADMIN', 'TEACHER')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.class_instances ci
        JOIN public.base_classes bc ON ci.base_class_id = bc.id
        WHERE ci.id = public.rosters.class_instance_id
        AND bc.organisation_id = public.get_my_org_id()
        AND public.get_my_role() IN ('ADMIN', 'TEACHER')
    )
); 