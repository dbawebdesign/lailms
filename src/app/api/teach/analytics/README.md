# Assessment Analytics API Documentation

This directory contains the API endpoints for accessing assessment analytics and insights. All endpoints require authentication and proper authorization.

## Base URL
`/api/teach/analytics`

## Authentication
All endpoints require a valid user session. Users must be authenticated and have appropriate permissions to access the requested data.

## Endpoints Overview

### 1. General Analytics (`/api/teach/analytics`)
**Method:** `GET`

A multipurpose endpoint that provides various analytics based on the `type` parameter.

**Query Parameters:**
- `type` (required): Type of analytics to retrieve
  - `student-results`: Get student assessment results
  - `user-progress`: Get individual user progress
  - `trends`: Get performance trends over time
  - `insights`: Get AI-generated insights
  - `difficulty-analysis`: Get assessment difficulty analysis

**Type-Specific Parameters:**

#### `student-results`
- `user_id` (optional): User ID to get results for (defaults to current user)
- `assessment_id` (optional): Filter by specific assessment
- `assessment_type` (optional): Filter by assessment type

#### `user-progress`
- `user_id` (optional): User ID (defaults to current user)
- `assessment_id` (required): Assessment ID

#### `trends`
- `user_id` (optional): User ID (defaults to current user)
- `assessment_type` (optional): Filter by assessment type
- `days_period` (optional): Number of days to analyze (default: 30)

#### `insights`
- `user_id` (optional): User ID (defaults to current user)
- `assessment_id` (optional): Specific assessment to analyze

#### `difficulty-analysis`
- `assessment_ids` (required): Comma-separated list of assessment IDs

**Example Requests:**
```
GET /api/teach/analytics?type=student-results&assessment_id=123
GET /api/teach/analytics?type=trends&days_period=60
GET /api/teach/analytics?type=difficulty-analysis&assessment_ids=123,456,789
```

### 2. Assessment-Specific Analytics (`/api/teach/analytics/assessments/[assessmentId]`)

#### GET - Get Assessment Analytics
Retrieves comprehensive analytics for a specific assessment.

**Path Parameters:**
- `assessmentId`: The ID of the assessment

**Response:**
```json
{
  "assessment_id": "string",
  "total_attempts": "number",
  "unique_users": "number",
  "average_score": "number",
  "highest_score": "number",
  "lowest_score": "number",
  "pass_rate": "number",
  "average_completion_time": "number",
  "question_stats": [
    {
      "question_id": "string",
      "question_text": "string",
      "total_responses": "number",
      "correct_responses": "number",
      "correct_percentage": "number",
      "average_time_spent": "number",
      "difficulty_score": "number"
    }
  ]
}
```

#### POST - Update Cached Analytics
Refreshes the cached analytics data for a specific assessment.

**Path Parameters:**
- `assessmentId`: The ID of the assessment

**Response:**
```json
{
  "message": "Analytics cache updated successfully"
}
```

### 3. Comparison Analytics (`/api/teach/analytics/compare`)
**Method:** `POST`

Compare performance across multiple users.

**Request Body:**
```json
{
  "userIds": ["string"],
  "assessmentId": "string",
  "type": "performance" | "topic-analysis"
}
```

**Performance Comparison Response:**
```json
{
  "comparison": [
    {
      "user_id": "string",
      "best_score": "number",
      "attempts_count": "number",
      "average_score": "number",
      "completion_time_avg": "number",
      "rank": "number"
    }
  ],
  "assessment_average": "number"
}
```

### 4. Batch Operations (`/api/teach/analytics/batch`)
**Method:** `POST`

Perform bulk analytics operations.

**Request Body:**
```json
{
  "operation": "update-cache" | "get-class-analytics",
  "assessmentIds": ["string"],
  "baseClassId": "string"
}
```

## Access Control

- **Students**: Can access their own analytics data
- **Teachers/Creators**: Can access analytics for assessments in their base classes
- **Future**: Role-based access control will be implemented for more granular permissions

## Examples

### Get Student Results
```javascript
const response = await fetch('/api/teach/analytics?type=student-results&assessment_id=123');
const results = await response.json();
```

### Get Assessment Analytics
```javascript
const response = await fetch('/api/teach/analytics/assessments/123');
const analytics = await response.json();
```

### Compare User Performance
```javascript
const response = await fetch('/api/teach/analytics/compare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userIds: ['user1', 'user2', 'user3'],
    assessmentId: '123',
    type: 'performance'
  })
});
const comparison = await response.json();
```
