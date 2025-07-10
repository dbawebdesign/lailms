# Assessment System JSON Structures Documentation

This document defines the exact JSON structures for the 4-table assessment system, covering all 5 question types with special focus on AI grading capabilities.

## Database Schema Overview

The assessment system uses 4 main tables:
- `assessments` - Assessment definitions
- `assessment_questions` - Individual questions with JSON structures
- `student_attempts` - Attempt tracking and AI grading workflow
- `student_responses` - Individual responses with AI scoring

## Question Type JSON Structures

### 1. Multiple Choice Questions

**Question Definition:**
```json
{
  "type": "multiple_choice",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": "Option A",
  "answer_key": {
    "Option A": "This is correct because...",
    "Option B": "This is incorrect because...",
    "Option C": "This is incorrect because...",
    "Option D": "This is incorrect because..."
  }
}
```

**Student Response:**
```json
{
  "selected": "Option B",
  "time_spent": 45
}
```

**AI Grading Result:**
```json
{
  "score": 0,
  "max_score": 1,
  "is_correct": false,
  "feedback": "Incorrect. This is incorrect because...",
  "confidence": 1.0
}
```

### 2. True/False Questions

**Question Definition:**
```json
{
  "type": "true_false",
  "options": ["True", "False"],
  "correct_answer": "True",
  "answer_key": {
    "explanation": "This statement is true because...",
    "reasoning": "Detailed explanation of why this is the correct answer"
  }
}
```

**Student Response:**
```json
{
  "selected": "False",
  "time_spent": 30
}
```

**AI Grading Result:**
```json
{
  "score": 0,
  "max_score": 1,
  "is_correct": false,
  "feedback": "Incorrect. This statement is true because...",
  "confidence": 1.0
}
```

### 3. Short Answer Questions

**Question Definition:**
```json
{
  "type": "short_answer",
  "options": null,
  "correct_answer": "The expected key concepts or answer",
  "sample_response": "A model correct answer that demonstrates the expected response quality and content",
  "answer_key": {
    "keywords": ["keyword1", "keyword2", "concept3"],
    "explanation": "Detailed explanation of what makes a good answer",
    "grading_criteria": "Specific criteria for scoring this question",
    "min_score_threshold": 0.7,
    "semantic_weight": 0.6,
    "keyword_weight": 0.4,
    "rubric": {
      "excellent": "Demonstrates complete understanding with all key concepts",
      "good": "Shows good understanding with most key concepts",
      "fair": "Basic understanding with some key concepts",
      "poor": "Limited understanding with few or no key concepts"
    }
  }
}
```

**Student Response:**
```json
{
  "text": "Student's written answer goes here",
  "time_spent": 180
}
```

**AI Grading Result:**
```json
{
  "score": 0.75,
  "max_score": 1.0,
  "is_correct": true,
  "feedback": "Good answer! You covered most key concepts. Consider expanding on...",
  "confidence": 0.85,
  "keyword_matches": ["keyword1", "concept3"],
  "semantic_similarity": 0.78,
  "rubric_level": "good",
  "suggestions": "To improve, consider mentioning..."
}
```

### 4. Essay Questions

**Question Definition:**
```json
{
  "type": "essay",
  "options": null,
  "correct_answer": null,
  "sample_response": "A comprehensive model essay that demonstrates excellent analysis, structure, and depth of understanding. This should be a full example of what an A-level response looks like.",
  "answer_key": {
    "rubric": {
      "content_knowledge": {
        "description": "Demonstrates understanding of key concepts",
        "points": 25,
        "excellent": "Shows deep understanding with accurate details",
        "good": "Shows solid understanding with mostly accurate details",
        "fair": "Shows basic understanding with some inaccuracies",
        "poor": "Shows limited understanding with significant gaps"
      },
      "analysis_depth": {
        "description": "Quality of analysis and critical thinking",
        "points": 25,
        "excellent": "Provides insightful analysis with multiple perspectives",
        "good": "Provides good analysis with some depth",
        "fair": "Provides basic analysis with limited depth",
        "poor": "Provides superficial or unclear analysis"
      },
      "organization": {
        "description": "Structure and flow of the essay",
        "points": 25,
        "excellent": "Clear, logical structure with smooth transitions",
        "good": "Generally well-organized with adequate transitions",
        "fair": "Basic organization with some unclear transitions",
        "poor": "Poor organization that impedes understanding"
      },
      "evidence_support": {
        "description": "Use of examples and supporting evidence",
        "points": 25,
        "excellent": "Strong, relevant examples that clearly support arguments",
        "good": "Good examples that generally support arguments",
        "fair": "Some examples but may lack relevance or clarity",
        "poor": "Few or irrelevant examples"
      }
    },
    "grading_guidelines": "Evaluate based on content knowledge, analysis depth, organization, and use of evidence. Look for critical thinking and original insights.",
    "semantic_weight": 0.4,
    "rubric_weight": 0.6,
    "min_word_count": 250,
    "max_word_count": 1000
  }
}
```

**Student Response:**
```json
{
  "text": "Student's full essay response goes here...",
  "word_count": 456,
  "time_spent": 1800,
  "instructor_notes": "Optional instructor feedback or notes"
}
```

**AI Grading Result:**
```json
{
  "score": 0.82,
  "max_score": 1.0,
  "is_correct": null,
  "feedback": "Strong essay with good analysis. Your understanding of the concepts is evident...",
  "confidence": 0.75,
  "rubric_scores": {
    "content_knowledge": {"score": 22, "max": 25, "level": "good"},
    "analysis_depth": {"score": 20, "max": 25, "level": "good"},
    "organization": {"score": 18, "max": 25, "level": "fair"},
    "evidence_support": {"score": 21, "max": 25, "level": "good"}
  },
  "semantic_similarity": 0.73,
  "word_count_status": "appropriate",
  "strengths": ["Clear understanding of concepts", "Good use of examples"],
  "areas_for_improvement": ["Could improve organization", "Consider adding more analysis"],
  "suggestions": "Try using topic sentences to improve organization..."
}
```

### 5. Matching Questions

**Question Definition:**
```json
{
  "type": "matching",
  "options": {
    "left": ["Term 1", "Term 2", "Term 3", "Term 4"],
    "right": ["Definition A", "Definition B", "Definition C", "Definition D"]
  },
  "correct_answer": {
    "Term 1": "Definition B",
    "Term 2": "Definition A",
    "Term 3": "Definition D",
    "Term 4": "Definition C"
  },
  "answer_key": {
    "explanations": {
      "Term 1": "Term 1 matches Definition B because...",
      "Term 2": "Term 2 matches Definition A because...",
      "Term 3": "Term 3 matches Definition D because...",
      "Term 4": "Term 4 matches Definition C because..."
    },
    "partial_credit": true
  }
}
```

**Student Response:**
```json
{
  "matches": {
    "Term 1": "Definition A",
    "Term 2": "Definition B",
    "Term 3": "Definition D",
    "Term 4": "Definition C"
  },
  "time_spent": 120
}
```

**AI Grading Result:**
```json
{
  "score": 0.5,
  "max_score": 1.0,
  "is_correct": false,
  "feedback": "You got 2 out of 4 matches correct. Term 1 should match Definition B because...",
  "confidence": 1.0,
  "correct_matches": ["Term 3", "Term 4"],
  "incorrect_matches": ["Term 1", "Term 2"],
  "detailed_feedback": {
    "Term 1": "Incorrect. Term 1 matches Definition B because...",
    "Term 2": "Incorrect. Term 2 matches Definition A because...",
    "Term 3": "Correct!",
    "Term 4": "Correct!"
  }
}
```

## AI Grading Workflow

### Grading Process Fields

Each `student_attempts` record tracks the AI grading workflow:

```json
{
  "ai_grading_status": "pending|processing|completed|failed|manual_review",
  "ai_grading_started_at": "2024-01-15T10:30:00Z",
  "ai_grading_completed_at": "2024-01-15T10:32:00Z",
  "requires_manual_review": false,
  "manual_review_reason": null,
  "ai_confidence_avg": 0.85,
  "total_ai_score": 8.5,
  "total_manual_score": null,
  "final_score": 8.5,
  "is_final_score_manual": false
}
```

### Confidence Thresholds

- **High Confidence (≥0.9)**: Auto-grade, no manual review needed
- **Medium Confidence (0.7-0.89)**: Auto-grade, flag for spot-check
- **Low Confidence (<0.7)**: Require manual review
- **Essay Questions**: Always require manual review if score affects final grade

### Manual Override System

Instructors can override AI grades:

```json
{
  "manual_score": 0.9,
  "manual_feedback": "Instructor's additional feedback",
  "manual_graded_at": "2024-01-15T14:30:00Z",
  "manual_graded_by": "instructor_user_id",
  "override_reason": "AI missed key insight in student's analysis"
}
```

## Time Tracking

All question types track time spent:

```json
{
  "time_spent": 180,  // seconds
  "started_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T10:33:00Z"
}
```

## Error Handling

Invalid responses are handled gracefully:

```json
{
  "error": "invalid_format",
  "error_message": "Response does not match expected format for question type",
  "raw_response": "student's original response",
  "fallback_score": 0
}
```

## Integration Points

### With Assessment Generation Service
- Questions generated with proper JSON structures
- Sample responses created for AI grading training
- Answer keys optimized for AI evaluation

### With AI Grading Service
- Structured input for consistent grading
- Confidence scoring for manual review triggers
- Detailed feedback generation

### With Course Generator
- Assessment questions integrated into lesson sections
- Proper JSON validation during generation
- Consistent question type handling

## Validation Rules

1. **Multiple Choice**: Must have 2-6 options, exactly one correct answer
2. **True/False**: Must have exactly 2 options ("True", "False")
3. **Short Answer**: Must have sample_response and grading criteria
4. **Essay**: Must have comprehensive rubric and sample_response
5. **Matching**: Left and right arrays must have same length, all items must have matches

## Performance Considerations

- JSON fields are indexed for efficient queries
- Large sample_response texts are compressed
- AI grading results cached to avoid re-processing
- Bulk operations supported for batch grading

---

*This documentation should be updated as the assessment system evolves and new question types or grading capabilities are added.* 