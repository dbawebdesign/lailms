# Course Generation V3 Optimizations

## Overview

The Course Generation V3 system has been optimized for **quality, efficiency, consistency, and scalability**. This document outlines the improvements made to handle everything from a single user to hundreds of concurrent users.

## Phase 1: Immediate Improvements ✅

### 1. Structured Outputs with Validation

- **Zod Schemas**: All content generation now uses strict schemas with validation
- **Response Format**: OpenAI's `response_format: { type: "json_object" }` ensures valid JSON
- **Validation & Retry**: Content that fails validation is automatically retried with specific feedback
- **Error Handling**: Detailed validation errors are logged for debugging

#### Example Schema (Lesson Content):
```typescript
const LessonSectionContentSchema = z.object({
  introduction: z.string().min(100),
  detailed_explanation: z.string().min(500),
  key_concepts: z.array(KeyConceptSchema).min(1),
  examples: z.array(ExampleSchema).min(1),
  summary: z.string().min(50)
});
```

### 2. Rate Limiting System

- **Per-User Limits**: Different limits based on user role
  - Student: 2/min, 10/hour, 50/day, 1 concurrent job
  - Teacher: 5/min, 30/hour, 200/day, 3 concurrent jobs
  - Admin: 10/min, 100/hour, 1000/day, 10 concurrent jobs
- **Global Limits**: System-wide protection (100 concurrent jobs max)
- **Automatic Resets**: Time-based window resets
- **Usage Tracking**: Real-time usage statistics available

### 3. Database Logging

- **Persistent Logs**: All events stored in `course_generation_logs` table
- **Alert System**: Critical errors automatically create alerts
- **Structured Logging**: Consistent format with correlation IDs
- **Performance Metrics**: Track API calls, duration, and success rates

## Model Selection Strategy

### Primary Models
- **gpt-4.1-mini**: Used for complex content generation
  - Lesson sections
  - Assessment questions
  - Brain bytes scripts
  - Complex explanations

### Optimization Models
- **gpt-4.1-nano**: Used for simpler tasks
  - Mind map generation
  - Simple summaries
  - Title generation
  - Metadata creation
  - Categorization

### Cost Reduction
- Current: ~$0.15-0.30 per course
- Optimized: ~$0.08-0.15 per course (40-50% reduction)

## Database Schema Updates

### New Tables Created:

1. **course_generation_queue**
   - Queue management for scalable processing
   - Priority-based execution
   - Worker assignment tracking

2. **course_generation_rate_limits**
   - Per-user rate limit tracking
   - Time window management
   - Active job counting

3. **course_generation_cache**
   - Content caching for similar lessons
   - Embedding-based similarity search
   - Automatic expiration

4. **course_generation_evaluations**
   - Quality scoring system
   - Evaluation criteria tracking
   - Improvement feedback

## Usage Example

```typescript
import { CourseGenerationOrchestratorV3 } from '@/lib/services/course-generation-orchestrator-v3';

const orchestrator = new CourseGenerationOrchestratorV3();

// Generate a course with automatic:
// - Rate limiting check
// - Structured output validation
// - Database logging
// - Content caching
const result = await orchestrator.generate({
  userId: 'user-123',
  userRole: 'teacher',
  baseClassId: 'class-456',
  organisationId: 'org-789',
  // ... other parameters
});
```

## Monitoring & Observability

### Real-time Tracking
- Job progress percentage
- Task completion status
- Error rates and types
- Performance metrics

### Alerts
- Critical errors
- Rate limit violations
- System capacity warnings
- Quality score thresholds

### Logs
```sql
-- View recent errors
SELECT * FROM course_generation_logs 
WHERE level IN ('error', 'critical')
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check user rate limits
SELECT * FROM course_generation_rate_limits
WHERE user_id = 'user-id-here';

-- Monitor active jobs
SELECT status, COUNT(*) 
FROM course_generation_jobs
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY status;
```

## Resilience Features

1. **Circuit Breaker**: Prevents cascading failures
2. **Automatic Retries**: With exponential backoff
3. **Task-level Recovery**: Failed tasks can be retried individually
4. **Progress Persistence**: Jobs can be resumed from last successful task
5. **Validation Feedback**: Failed validations trigger targeted regeneration

## Next Phases (Planned)

### Phase 2: Scalability Infrastructure
- Full queue-based architecture with workers
- Dynamic concurrency control
- Advanced caching with semantic search

### Phase 3: Quality & Optimization
- Automated quality evaluation
- A/B testing framework
- Batch API integration for non-urgent tasks
- Continuous improvement loop

## Performance Expectations

### Single User
- Course generation: 2-5 minutes
- Consistent quality with validation
- Automatic retry on failures

### 100 Concurrent Users
- Rate limiting prevents overload
- Queue system manages priority
- ~100 courses per hour capacity
- Graceful degradation under load

### 1000+ Users
- Horizontal scaling ready
- Worker pool expansion
- Cache hit rates improve performance
- Cost optimizations reduce expenses

## Migration Notes

The system is backward compatible with V2. To use V3 features:

1. Import `CourseGenerationOrchestratorV3` instead of V2
2. Ensure database migrations are applied
3. Configure rate limits for your user roles
4. Monitor logs and alerts for optimization opportunities

## Support & Monitoring

- Check `/api/health/course-generation` for system status
- View rate limits at `/api/user/rate-limits`
- Access logs via Supabase dashboard or queries
- Set up alerts for critical events