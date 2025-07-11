# Feedback & Support System

This document describes the feedback and support system implemented in the application.

## Overview

The feedback system allows users to:
- Submit general feedback about the application
- Request support for issues they're experiencing
- Report bugs with detailed information

## Database Schema

The system uses a `feedback_support` table in Supabase with the following structure:

```sql
CREATE TABLE feedback_support (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    organisation_id UUID REFERENCES organisations(id),
    category TEXT NOT NULL CHECK (category IN ('feedback', 'support', 'bug_report')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    contact_email TEXT,
    wants_followup BOOLEAN DEFAULT false,
    current_page TEXT,
    user_agent TEXT,
    browser_info JSONB,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

## Usage

### Opening the Feedback Modal

The feedback modal can be opened in several ways:

#### 1. Using the Navigation
- Click the "Feedback" item in the left navigation
- Click the "Feedback" item in the mobile bottom navigation

#### 2. Using the Command Palette
- Open command palette (Ctrl/Cmd + K)
- Type "feedback", "support", or "bug" and select the appropriate option

#### 3. Programmatically with the Hook
```typescript
import { useFeedback } from '@/hooks/useFeedback';

function MyComponent() {
  const { openFeedback, openSupport, openBugReport } = useFeedback();

  return (
    <div>
      <button onClick={openFeedback}>Send Feedback</button>
      <button onClick={openSupport}>Get Support</button>
      <button onClick={openBugReport}>Report Bug</button>
    </div>
  );
}
```

#### 4. Using the UI Context Directly
```typescript
import { useUIContext } from '@/context/UIContext';

function MyComponent() {
  const { openFeedbackModal } = useUIContext();

  const handleCustomFeedback = () => {
    openFeedbackModal({
      category: 'support',
      priority: 'high'
    });
  };

  return <button onClick={handleCustomFeedback}>Priority Support</button>;
}
```

## Modal Features

### Multi-Step Form
1. **Category Selection**: Choose between Feedback, Support, or Bug Report
2. **Form Details**: Fill in subject, message, priority, and contact preferences
3. **Submission**: Submit with loading state and success/error handling

### Form Fields
- **Category**: feedback, support, bug_report
- **Priority**: low, medium, high, critical
- **Subject**: Brief description (5-100 characters)
- **Message**: Detailed description (10-2000 characters)
- **Contact Email**: Optional email for follow-up
- **Follow-up Preference**: Checkbox for email notifications

### Automatic Context Capture
The system automatically captures:
- Current page URL
- User agent information
- Browser details (language, platform, screen resolution)
- User ID and organization ID (if authenticated)

## API Endpoint

The system uses a POST endpoint at `/api/feedback-support` that:
- Validates the request data using Zod schema
- Checks user authentication
- Stores the feedback in Supabase
- Returns appropriate success/error responses

## Components

### Main Components
- `FeedbackSupportModal`: The main modal component
- `useFeedback`: Hook for easy access to feedback functions
- UI Context integration for global state management

### Styling
- Uses the application's design system components
- Responsive design for mobile and desktop
- Accessible with proper ARIA labels and keyboard navigation
- Consistent with the app's theme (light/dark mode)

## Error Handling

The system includes comprehensive error handling:
- Form validation with user-friendly error messages
- API error handling with toast notifications
- Loading states during submission
- Network error recovery

## Security

- User authentication required
- Input validation and sanitization
- SQL injection prevention through Supabase client
- Rate limiting can be added at the API level if needed

## Future Enhancements

Potential improvements:
- File attachment support for screenshots
- Admin dashboard for managing feedback
- Email notifications for new submissions
- Integration with support ticketing systems
- Analytics and reporting features 