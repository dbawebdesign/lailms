# Class Instance Status Automation

This document describes the automatic status management system for class instances based on their start and end dates.

## Overview

The system automatically updates class instance statuses based on the current date:

- **`upcoming`**: start_date is in the future
- **`active`**: start_date is today or in the past, but end_date hasn't passed
- **`completed`**: end_date is in the past

## Database Components

### Functions

1. **`update_class_instance_status()`**
   - Updates all class instance statuses based on current date
   - Called manually or by scheduled processes

2. **`update_single_class_instance_status()`**
   - Trigger function that runs automatically when dates are modified
   - Updates status and timestamp for individual records

3. **`daily_class_instance_status_update()`**
   - Returns JSON summary of updates performed
   - Useful for monitoring and reporting

### Trigger

**`class_instance_status_trigger`**
- Automatically fires when `start_date` or `end_date` is updated
- Ensures status is immediately corrected when dates change
- Also updates the `updated_at` timestamp

## Automated Daily Updates

### Cron Job
A PostgreSQL cron job runs daily at 1:00 AM UTC to automatically update all class instance statuses:

```sql
-- View the scheduled job
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'daily-class-status-update';
```

### Direct Database Function
```sql
SELECT daily_class_status_update_direct();
```

This function:
- Calls `update_class_instance_status()` to update all statuses
- Returns a JSON summary of the operation
- Logs results for monitoring
- Handles errors gracefully

## API Endpoints

### Manual Status Update
```http
POST /api/dev-admin/class-instance-status-update
```

Manually triggers status updates for all class instances.

**Response:**
```json
{
  "success": true,
  "data": {
    "updated_count": 2,
    "timestamp": "2025-01-21T18:00:00.000Z",
    "message": "Class instance statuses updated successfully",
    "details": {
      "activated": 1,
      "completed": 1
    }
  }
}
```

### Status Analysis
```http
GET /api/dev-admin/class-instance-status-update
```

Shows current status analysis without making changes.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Class Name",
      "start_date": "2025-08-29",
      "end_date": "2025-10-03",
      "status": "active",
      "shouldBe": "active",
      "needsUpdate": false
    }
  ],
  "summary": {
    "total": 25,
    "needingUpdate": 0,
    "byStatus": {
      "active": 15,
      "upcoming": 0,
      "completed": 10
    }
  }
}
```

## Monitoring & Troubleshooting

### Check Cron Job Status
```sql
-- View all cron jobs
SELECT * FROM cron.job;

-- View cron job execution history
SELECT * FROM cron.job_run_details 
WHERE jobname = 'daily-class-status-update' 
ORDER BY start_time DESC 
LIMIT 10;
```

### Manual Execution
If you need to manually trigger the status update:

```sql
-- Direct database function (recommended)
SELECT daily_class_status_update_direct();

-- Or use the original function
SELECT update_class_instance_status();
```

### Edge Function Alternative
A Supabase Edge Function `daily-class-status-update` is also available as a backup method, though the direct database approach is more reliable.

## Implementation Notes

- **Automatic**: Runs daily at 1:00 AM UTC via PostgreSQL cron
- **Reliable**: Uses direct database functions instead of HTTP calls
- **Monitored**: Returns detailed JSON logs for tracking
- **Fallback**: Multiple methods available (cron, manual, API, Edge Function)
- **Safe**: Only updates statuses that actually need changing
    {
      "id": "uuid",
      "name": "Class Name",
      "start_date": "2025-07-15",
      "end_date": "2025-08-15",
      "status": "active",
      "shouldBe": "active",
      "needsUpdate": false
    }
  ],
  "summary": {
    "total": 8,
    "needingUpdate": 0,
    "byStatus": {
      "active": 6,
      "upcoming": 1,
      "completed": 1
    }
  }
}
```

## Automation Setup

### Option 1: Cron Job (Recommended)
Set up a daily cron job to call the API endpoint:

```bash
# Add to crontab (runs daily at 6 AM)
0 6 * * * curl -X POST https://yourdomain.com/api/dev-admin/class-instance-status-update
```

### Option 2: Database Cron (if available)
If your database supports cron jobs:

```sql
-- Example for PostgreSQL with pg_cron extension
SELECT cron.schedule('update-class-statuses', '0 6 * * *', 'SELECT update_class_instance_status();');
```

### Option 3: Scheduled Task (Vercel/Netlify)
Use platform-specific scheduled functions:

```javascript
// Vercel cron job
export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Call the status update logic
    const response = await fetch(`${process.env.BASE_URL}/api/dev-admin/class-instance-status-update`, {
      method: 'POST'
    });
    
    const result = await response.json();
    res.status(200).json(result);
  }
}
```

## Testing

### Test Trigger Functionality
```sql
-- Test automatic activation
UPDATE class_instances 
SET start_date = CURRENT_DATE
WHERE name = 'Test Class';

-- Test automatic completion
UPDATE class_instances 
SET end_date = CURRENT_DATE - INTERVAL '1 day'
WHERE name = 'Test Class';
```

### Test Manual Updates
```bash
# Test the API endpoint
curl -X POST http://localhost:3000/api/dev-admin/class-instance-status-update

# Check current status
curl -X GET http://localhost:3000/api/dev-admin/class-instance-status-update
```

## Monitoring

Monitor the system by:

1. Checking API endpoint responses for update counts
2. Reviewing class instance `updated_at` timestamps
3. Setting up alerts for failed status updates
4. Periodic manual verification of status accuracy

## Troubleshooting

### Common Issues

1. **Status not updating automatically**
   - Check if trigger is enabled: `SELECT * FROM pg_trigger WHERE tgname = 'class_instance_status_trigger';`
   - Verify dates are in correct format (YYYY-MM-DD)

2. **API endpoint errors**
   - Check database connection
   - Verify Supabase permissions
   - Review server logs for detailed error messages

3. **Inconsistent statuses**
   - Run the GET endpoint to identify mismatches
   - Use the POST endpoint to fix all statuses at once
   - Check for manual status overrides that might conflict

### Manual Fix for All Statuses
```sql
-- Emergency fix for all class instances
SELECT update_class_instance_status();

-- Verify results
SELECT name, start_date, end_date, status,
       CASE 
         WHEN end_date < CURRENT_DATE THEN 'completed'
         WHEN start_date <= CURRENT_DATE THEN 'active'
         ELSE 'upcoming'
       END as should_be
FROM class_instances
WHERE status != CASE 
  WHEN end_date < CURRENT_DATE THEN 'completed'
  WHEN start_date <= CURRENT_DATE THEN 'active'
  ELSE 'upcoming'
END;
```

## Migration History

- **2025-01-21**: Initial implementation with trigger-based automation
- Functions created: `update_class_instance_status`, `update_single_class_instance_status`, `daily_class_instance_status_update`
- Trigger created: `class_instance_status_trigger`
- API endpoints added: `/api/dev-admin/class-instance-status-update` 