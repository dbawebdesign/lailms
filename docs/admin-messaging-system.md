# Admin Messaging System

## Overview

The Admin Messaging System allows developers and administrators to send mandatory messages to users that must be responded to before the user can continue using the application.

## Features

- **Mandatory Response**: Users cannot interact with the application until they respond to admin messages
- **Real-time Delivery**: Messages appear immediately as blocking modals
- **Admin Interface**: Easy-to-use interface in `/dev-admin` for sending messages
- **Response Tracking**: View all sent messages and user responses
- **User Selection**: Select specific users to send messages to
- **Role-based Access**: Only admins and super_admins can send messages

## Database Schema

### Tables Created

1. **admin_messages**
   - `id`: UUID primary key
   - `from_admin_id`: UUID reference to admin's profile
   - `to_user_id`: UUID reference to recipient's profile
   - `subject`: Text subject line
   - `message`: Text message content
   - `created_at`: Timestamp
   - `updated_at`: Timestamp

2. **admin_message_responses**
   - `id`: UUID primary key
   - `message_id`: UUID reference to admin_messages
   - `response`: Text response content
   - `responded_at`: Timestamp

### Row Level Security (RLS)

- Admins can create and view all messages
- Users can only view their own messages
- Users can only respond to their own messages
- Admins can view all responses

## Usage

### For Administrators

1. Navigate to `/dev-admin`
2. Enter the developer password
3. Click "Access Messaging"
4. Select a user from the dropdown
5. Enter subject and message
6. Click "Send Message"
7. View responses in the Message History panel

### For Users

When a user has a pending message:
1. A blocking modal appears automatically
2. User cannot interact with the app until responding
3. User must provide a response
4. Modal disappears after successful response submission

## Components

### AdminMessageModal
- **Location**: `src/components/messaging/AdminMessageModal.tsx`
- **Purpose**: Blocking modal that appears for users with pending messages
- **Features**: Real-time updates, mandatory response, prevents app interaction

### Messaging Page
- **Location**: `src/app/dev-admin/messaging/page.tsx`
- **Purpose**: Admin interface for sending messages and viewing responses
- **Features**: User selection, message composition, response tracking

## API Routes

### GET /api/admin-messages/check
- Check if current user has pending messages
- Returns: `{ hasPendingMessage: boolean, message: AdminMessage | null }`

### POST /api/admin-messages/respond
- Submit response to admin message
- Body: `{ messageId: string, response: string }`
- Returns: `{ success: boolean }`

## Integration

The system is integrated into the main app layout (`src/app/(app)/layout.tsx`) so the AdminMessageModal appears on all authenticated pages.

## Security

- RLS policies ensure users can only access their own messages
- API routes verify user authentication and authorization
- Responses are validated before submission
- Duplicate responses are prevented

## Real-time Updates

The system uses Supabase real-time subscriptions to:
- Show new messages immediately to users
- Update message history in admin interface
- Provide live status updates

## Customization

### Message Styling
- Modal styling can be customized in `AdminMessageModal.tsx`
- Uses shadcn/ui components for consistent theming

### Response Validation
- Add custom validation in API routes
- Modify response requirements in modal component

### User Filtering
- Modify user selection query in messaging page
- Add role-based filtering as needed

## Troubleshooting

### Messages Not Appearing
1. Check user authentication
2. Verify RLS policies
3. Check browser console for errors
4. Ensure real-time subscriptions are working

### Response Submission Failing
1. Verify API route accessibility
2. Check network requests in browser dev tools
3. Review server logs for errors
4. Confirm database permissions

### Admin Interface Issues
1. Verify admin role permissions
2. Check developer password authentication
3. Review component error boundaries
4. Test database queries directly