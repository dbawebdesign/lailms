-- Older private course buckets predate image OCR support. Preserve every existing
-- MIME type, public setting and size limit while adding the supported image types.
-- A NULL allowlist already accepts all types and must remain unrestricted.
UPDATE storage.buckets AS bucket
SET allowed_mime_types = (
  SELECT array_agg(DISTINCT mime ORDER BY mime)
  FROM unnest(bucket.allowed_mime_types || ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
  ]::text[]) AS formats(mime)
)
WHERE bucket.public = false
  AND bucket.id ~ '^org-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-uploads$'
  AND bucket.allowed_mime_types IS NOT NULL
  AND NOT bucket.allowed_mime_types @> ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
  ]::text[];
