# Supabase Password Reset Setup

This document outlines the proper password reset implementation using Supabase Auth according to the official documentation.

## Overview

We've implemented the standard Supabase Auth password reset flow which provides better security and follows best practices compared to custom reset code systems.

## Implementation Details

### 1. Configuration Changes

**File: `supabase/config.toml`**
- Enabled `secure_password_change = true` for enhanced security
- Set `max_frequency = "60s"` to prevent spam
- Added redirect URLs for password reset flow
- Configured custom email template for password reset

### 2. API Routes

**New Route: `/api/auth/reset-password-email`**
- Handles password reset requests using `supabase.auth.resetPasswordForEmail()`
- Converts usernames to pseudo-emails for compatibility with existing system
- Follows security best practices (no user enumeration)

### 3. UI Components

**Updated: `PasswordResetForm.tsx`**
- Simplified to single-step email/username input
- Uses new Supabase Auth API route
- Shows proper success/error states

**New: `ChangePasswordForm.tsx`**
- Secure password change form for authenticated users
- Validates session before allowing password change
- Uses `supabase.auth.updateUser()` for password updates

**New Page: `/change-password`**
- Dedicated page for password changes after email verification
- Only accessible to authenticated users with valid reset tokens

### 4. Auth Callback Handler

**Updated: `/auth/callback/route.ts`**
- Added support for PKCE flow with `token_hash` parameter
- Handles password reset tokens (`type=recovery`)
- Redirects to appropriate pages based on token type

### 5. Email Templates

**New: `supabase/templates/recovery.html`**
- Professional-looking password reset email
- Uses proper Supabase template variables
- Includes security notices and branding

## Flow Diagram

```
1. User enters username/email on /reset-password
2. System converts username to pseudo-email if needed
3. Supabase sends password reset email with secure token
4. User clicks link in email
5. Token is verified via /auth/callback
6. User is redirected to /change-password
7. User enters new password
8. Password is updated via supabase.auth.updateUser()
9. User is redirected to login with success message
```

## Security Features

- **No User Enumeration**: API doesn't reveal if user exists
- **Secure Tokens**: Uses Supabase's built-in token system
- **Time-Limited**: Reset links expire after 1 hour
- **Rate Limited**: Prevents spam with 60-second cooldown
- **Session Validation**: Change password page requires valid session
- **HTTPS Only**: All reset flows use secure connections

## Testing

### Local Development
1. Start Supabase: `supabase start`
2. Check Mailpit for emails: `supabase status` (get Mailpit URL)
3. Test reset flow with any username from your profiles table

### Production
- Configure custom SMTP in Supabase dashboard
- Update redirect URLs in Auth settings
- Upload email template via dashboard

## Migration from Old System

The old system using `password_reset_requests` table and admin-generated codes has been replaced. The old API routes (`/api/auth/request-reset` and `/api/auth/reset-password`) are no longer used but can be kept for backward compatibility if needed.

## Environment Variables

No additional environment variables are required. The system uses existing Supabase configuration.

## Troubleshooting

### Common Issues

1. **"Invalid or expired reset link"**
   - Check that redirect URLs are properly configured
   - Ensure token hasn't expired (1 hour limit)
   - Verify auth callback handler is working

2. **Emails not sending**
   - Check Mailpit in local development
   - Verify SMTP configuration in production
   - Check rate limits (2 emails per hour by default)

3. **Username not found**
   - Ensure profiles table has correct username/organization mapping
   - Check that organization abbreviations are set correctly

### Debug Steps

1. Check Supabase logs: `supabase logs`
2. Verify configuration: `supabase status`
3. Test auth flow: Check browser network tab for API calls
4. Check email delivery: Use Mailpit in development

## References

- [Supabase Password Reset Documentation](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Auth Configuration](https://supabase.com/docs/guides/cli/config#auth-config)
