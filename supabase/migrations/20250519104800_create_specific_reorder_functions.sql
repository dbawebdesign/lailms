-- Forcefully drop the functions to ensure a clean slate
DROP FUNCTION IF EXISTS public.reorder_paths(UUID, UUID[]);
DROP FUNCTION IF EXISTS public.reorder_lessons(UUID, UUID[]);
DROP FUNCTION IF EXISTS public.reorder_lesson_sections(UUID, UUID[]);

-- Also drop any older signatures with just one UUID array argument
DROP FUNCTION IF EXISTS public.reorder_paths(UUID[]);
DROP FUNCTION IF EXISTS public.reorder_lessons(UUID[]);
DROP FUNCTION IF EXISTS public.reorder_lesson_sections(UUID[]);

-- And the very old generic one
DROP FUNCTION IF EXISTS public.reorder_items_in_table(TEXT, UUID[]);

-- ① PATHS ---------------------------------------------------------------
CREATE FUNCTION public.reorder_paths( -- Note: CREATE, not CREATE OR REPLACE
  _base_class_id UUID,
  _ordered_ids UUID[]
) RETURNS VOID LANGUAGE sql AS
$$
  UPDATE public.paths p
     SET order_index = s.seq
    FROM (
           SELECT id_val, row_number() OVER () - 1 AS seq
           FROM unnest(_ordered_ids) AS id_val
         ) AS s
   WHERE p.id = s.id_val AND p.base_class_id = _base_class_id;
$$;

-- ② LESSONS -------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reorder_lessons(UUID, UUID[]);
CREATE FUNCTION public.reorder_lessons( -- Note: CREATE, not CREATE OR REPLACE
  _path_id UUID,
  _ordered_ids UUID[]
) RETURNS VOID LANGUAGE sql AS
$$
  UPDATE public.lessons l
     SET order_index = u.ord - 1 -- WITH ORDINALITY is 1-based, our index is 0-based
    FROM unnest(_ordered_ids) WITH ORDINALITY AS u(id_val, ord)
   WHERE l.id = u.id_val AND l.path_id = _path_id;
$$;

-- ③ SECTIONS ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reorder_lesson_sections(UUID, UUID[]);
CREATE FUNCTION public.reorder_lesson_sections( -- Note: CREATE, not CREATE OR REPLACE
  _lesson_id UUID,
  _ordered_ids UUID[]
) RETURNS VOID LANGUAGE sql AS
$$
  UPDATE public.lesson_sections ls
     SET order_index = s.seq
    FROM (
           SELECT id_val, row_number() OVER () - 1 AS seq
           FROM unnest(_ordered_ids) AS id_val
         ) AS s
   WHERE ls.id = s.id_val AND ls.lesson_id = _lesson_id;
$$;

COMMENT ON FUNCTION public.reorder_paths(UUID, UUID[]) IS 'Sets order_index for paths. DROPPED AND RECREATED.';
COMMENT ON FUNCTION public.reorder_lessons(UUID, UUID[]) IS 'Sets order_index for lessons. DROPPED AND RECREATED.';
COMMENT ON FUNCTION public.reorder_lesson_sections(UUID, UUID[]) IS 'Sets order_index for lesson_sections. DROPPED AND RECREATED.'; 