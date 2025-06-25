-- Monitor content complexity in lesson_sections to prevent stack depth issues
-- Run these queries periodically to identify potential problems

-- 1. Check sections with potentially complex content
SELECT 
    id,
    title,
    section_type,
    created_at,
    LENGTH(content::text) as content_size_bytes,
    CASE 
        WHEN LENGTH(content::text) > 1000000 THEN 'HIGH'
        WHEN LENGTH(content::text) > 500000 THEN 'MEDIUM'
        ELSE 'LOW'
    END as risk_level
FROM lesson_sections 
WHERE LENGTH(content::text) > 100000
ORDER BY LENGTH(content::text) DESC
LIMIT 20;

-- 2. Identify sections with deep JSON nesting (potential stack depth issues)
SELECT 
    id,
    title,
    section_type,
    created_at,
    LENGTH(content::text) as content_size_bytes
FROM lesson_sections 
WHERE content::text LIKE '%"nested"%nested"%nested"%nested"%nested"%' -- Rough check for deep nesting
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check for recently failed section creations (might indicate stack depth issues)
-- This would need to be combined with application logs
SELECT 
    COUNT(*) as total_sections,
    DATE_TRUNC('hour', created_at) as hour_created,
    AVG(LENGTH(content::text)) as avg_content_size
FROM lesson_sections 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour_created DESC;

-- 4. Find sections with large arrays that might cause issues
SELECT 
    id,
    title,
    section_type,
    created_at,
    LENGTH(content::text) as content_size_bytes,
    (content->>'learningObjectives')::jsonb ? '10' as has_many_objectives,
    (content->>'keyPoints')::jsonb ? '15' as has_many_keypoints,
    (content->>'activities')::jsonb ? '8' as has_many_activities
FROM lesson_sections 
WHERE 
    jsonb_array_length(content->'learningObjectives') > 10 OR
    jsonb_array_length(content->'keyPoints') > 15 OR
    jsonb_array_length(content->'activities') > 8 OR
    jsonb_array_length(content->'examples') > 10
ORDER BY LENGTH(content::text) DESC
LIMIT 10;

-- 5. Monitor content created in the last 24 hours for size distribution
SELECT 
    section_type,
    COUNT(*) as section_count,
    MIN(LENGTH(content::text)) as min_size,
    AVG(LENGTH(content::text))::integer as avg_size,
    MAX(LENGTH(content::text)) as max_size,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY LENGTH(content::text))::integer as p95_size
FROM lesson_sections 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY section_type
ORDER BY avg_size DESC;

-- 6. Check for sections with truncated content (indicates sanitization occurred)
SELECT 
    id,
    title,
    section_type,
    created_at,
    LENGTH(content::text) as content_size_bytes
FROM lesson_sections 
WHERE 
    content::text LIKE '%[Content too deep - truncated]%' OR
    content::text LIKE '%[truncated]%' OR
    content::text LIKE '%[Item truncated]%' OR
    content::text LIKE '%__truncated__%'
ORDER BY created_at DESC
LIMIT 10;

-- 7. Performance monitoring - sections that might be slow to query
SELECT 
    section_type,
    COUNT(*) as count,
    AVG(LENGTH(content::text))::integer as avg_content_size,
    COUNT(*) FILTER (WHERE LENGTH(content::text) > 500000) as large_content_count
FROM lesson_sections 
GROUP BY section_type
ORDER BY avg_content_size DESC; 