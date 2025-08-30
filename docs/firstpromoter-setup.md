# FirstPromoter Integration Setup

This document explains how to set up FirstPromoter referral tracking for Learnology AI.

## Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# FirstPromoter Configuration
# Get these from your FirstPromoter dashboard: Settings > Integrations
FIRSTPROMOTER_API_KEY=your_firstpromoter_api_key
FIRSTPROMOTER_ACCOUNT_ID=your_firstpromoter_account_id
```

## Getting Your FirstPromoter Credentials

1. **API Key**: 
   - Go to your FirstPromoter dashboard
   - Navigate to Settings > Integrations
   - Click "Manage API Keys"
   - Create a new key or use an existing one

2. **Account ID**:
   - Found in the same Settings > Integrations section
   - Copy the Account ID displayed there

## How It Works

### 1. Click Tracking
- The tracking script (`/public/fprmain.js`) is loaded on all pages
- It automatically tracks clicks on referral links
- Sets cookies `_fprom_tid` and `_fprom_ref` when users visit via referral links

### 2. Signup Tracking
- When users sign up, the system checks for FirstPromoter cookies
- If found, it sends a tracking request to FirstPromoter's API
- This happens in multiple signup flows:
  - Homeschool signup (NewSignupForm)
  - Regular invite-based signup
  - Co-op family signup

### 3. API Integration
- Uses FirstPromoter's v2 API endpoint: `https://v2.firstpromoter.com/api/v2/track/signup`
- Sends user email, user ID, tracking ID, and IP address
- Handles errors gracefully - signup process continues even if tracking fails

## Testing

To test the integration:

1. Create a referral link in your FirstPromoter dashboard
2. Visit your site using that referral link
3. Complete the signup process
4. Check your FirstPromoter dashboard for the tracked conversion

## Files Modified

- `/public/fprmain.js` - FirstPromoter tracking script
- `/src/app/layout.tsx` - Added script tags to head
- `/src/lib/firstpromoter.ts` - Utility functions for tracking
- `/src/app/api/firstpromoter/track-signup/route.ts` - API endpoint for frontend tracking
- `/src/components/auth/NewSignupForm.tsx` - Added tracking to homeschool signup
- `/src/app/api/auth/signup/route.ts` - Added tracking to invite-based signup
- `/src/app/api/auth/coop-family-signup/route.ts` - Added tracking to co-op family signup

## Configuration

The FirstPromoter client ID is currently set to `"z8op3lgw"` in `/public/fprmain.js`. 
Update this with your actual FirstPromoter client ID if different.

## Error Handling

The integration is designed to be non-blocking:
- If FirstPromoter tracking fails, the signup process continues normally
- Errors are logged to the console for debugging
- The API returns success even if tracking fails to prevent signup interruption

