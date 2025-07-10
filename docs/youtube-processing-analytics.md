# YouTube Processing Analytics & Monitoring

This document provides SQL queries and insights for monitoring the enhanced YouTube URL processing system.

## Database Schema Updates

The enhanced system includes:
- New status values: `failed_transcript`, `failed_access`
- Rich metadata tracking in JSONB format
- Analytics view: `youtube_processing_analytics`
- Helper functions for consistent logging

## Key Analytics Queries

### 1. Processing Success Rate Overview
```sql
SELECT 
    processing_outcome,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage,
    AVG(processing_duration_seconds) as avg_duration_seconds
FROM youtube_processing_analytics 
GROUP BY processing_outcome
ORDER BY count DESC;
```

### 2. Strategy Effectiveness Analysis
```sql
SELECT 
    final_strategy_used,
    COUNT(*) as success_count,
    AVG(processing_duration_seconds) as avg_duration
FROM youtube_processing_analytics 
WHERE processing_outcome = 'success'
GROUP BY final_strategy_used
ORDER BY success_count DESC;
```

### 3. Common Error Patterns
```sql
SELECT 
    error_type,
    COUNT(*) as error_count,
    array_agg(DISTINCT strategies_tried) as strategies_attempted
FROM youtube_processing_analytics 
WHERE processing_outcome != 'success'
GROUP BY error_type
ORDER BY error_count DESC;
```

### 4. Processing Attempts Distribution
```sql
SELECT 
    processing_attempts,
    COUNT(*) as documents_count,
    processing_outcome
FROM youtube_processing_analytics 
GROUP BY processing_attempts, processing_outcome
ORDER BY processing_attempts, processing_outcome;
```

### 5. Recent Failures for Investigation
```sql
SELECT 
    file_name,
    video_id,
    error_type,
    error_message,
    strategies_tried,
    created_at
FROM youtube_processing_analytics 
WHERE processing_outcome != 'success'
ORDER BY created_at DESC
LIMIT 10;
```

### 6. Processing Performance Trends
```sql
SELECT 
    DATE(created_at) as processing_date,
    COUNT(*) as total_attempts,
    COUNT(CASE WHEN processing_outcome = 'success' THEN 1 END) as successes,
    ROUND(
        COUNT(CASE WHEN processing_outcome = 'success' THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as success_rate_percent
FROM youtube_processing_analytics 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY processing_date DESC;
```

## Helper Functions Usage

### Log Processing Attempts
```sql
-- Log when starting a new strategy
SELECT log_youtube_processing_attempt(
    'doc-uuid-here',
    'transcript_fetch_multilang', 
    'in_progress',
    '{"languages_trying": ["en", "es", "fr"]}'::jsonb
);
```

### Update Final Status
```sql
-- Update when processing completes
SELECT update_document_processing_metadata(
    'doc-uuid-here',
    'completed',
    '{
        "final_strategy_used": "transcript_fetch_multilang",
        "transcript_language": "en",
        "video_title": "Sample Video",
        "processing_notes": "Successfully extracted transcript on 2nd language attempt"
    }'::jsonb
);
```

### Get Processing Summary
```sql
-- Get detailed summary for a specific document
SELECT * FROM get_youtube_processing_summary('doc-uuid-here');
```

## Metadata Structure

The `metadata` JSONB field should contain:

```json
{
  "video_id": "ABC123",
  "video_title": "Sample YouTube Video",
  "video_duration": "PT10M30S",
  "channel_name": "Sample Channel",
  "processing_attempts": 3,
  "strategies_tried": ["transcript_fetch_default", "transcript_fetch_multilang", "html_parsing"],
  "final_strategy_used": "transcript_fetch_multilang",
  "transcript_languages_attempted": ["auto", "en", "es", "fr"],
  "error_type": "transcript_unavailable",
  "error_message": "All transcript extraction methods failed",
  "user_guidance": "This video has transcripts/captions disabled by the creator..."
}
```

## Monitoring Alerts

### High Failure Rate Alert
```sql
-- Alert if failure rate exceeds 50% in last 24 hours
SELECT 
    CASE 
        WHEN failure_rate > 50 THEN 'ALERT: High YouTube processing failure rate'
        ELSE 'OK'
    END as status,
    failure_rate,
    total_attempts
FROM (
    SELECT 
        COUNT(*) as total_attempts,
        ROUND(
            COUNT(CASE WHEN processing_outcome != 'success' THEN 1 END) * 100.0 / COUNT(*), 
            2
        ) as failure_rate
    FROM youtube_processing_analytics 
    WHERE created_at >= NOW() - INTERVAL '24 hours'
) stats;
```

### Stuck Processing Documents
```sql
-- Find documents that have been processing for too long
SELECT 
    id,
    file_name,
    status,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_since_created
FROM documents 
WHERE status = 'processing' 
AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at;
```

## Troubleshooting Guide

### Common Issues

1. **High `failed_transcript` Rate**: Videos with disabled captions
   - Monitor `transcript_languages_attempted` to ensure all languages are being tried
   - Check if HTML parsing fallback is working

2. **High `failed_access` Rate**: Private/restricted videos
   - Review video URLs for access patterns
   - Check if oEmbed API validation is working

3. **High `processing_error` Rate**: System/code issues
   - Review error messages for patterns
   - Check edge function logs

### Performance Optimization

- Monitor `processing_duration_seconds` for outliers
- Analyze which strategies are most effective
- Consider adjusting strategy order based on success rates 