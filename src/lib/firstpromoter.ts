/**
 * FirstPromoter integration utilities
 * Handles referral tracking and API communication
 */

interface FirstPromoterTrackingData {
  email?: string;
  uid?: string;
  tid?: string;
  ref_id?: string;
  ip?: string;
}

interface FirstPromoterResponse {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * Get FirstPromoter tracking ID from cookies (browser-side)
 */
export function getFirstPromoterTrackingId(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === '_fprom_tid') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Get FirstPromoter referral ID from cookies (browser-side)
 */
export function getFirstPromoterReferralId(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === '_fprom_ref') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Parse cookies from request headers (server-side)
 */
export function parseCookiesFromHeaders(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}

/**
 * Get FirstPromoter tracking ID from server request
 */
export function getTrackingIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookiesFromHeaders(cookieHeader);
  return cookies['_fprom_tid'] || null;
}

/**
 * Get FirstPromoter referral ID from server request
 */
export function getReferralIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookiesFromHeaders(cookieHeader);
  return cookies['_fprom_ref'] || null;
}

/**
 * Track signup with FirstPromoter API
 */
export async function trackFirstPromoterSignup(data: FirstPromoterTrackingData): Promise<FirstPromoterResponse> {
  const apiKey = process.env.FIRSTPROMOTER_API_KEY;
  const accountId = process.env.FIRSTPROMOTER_ACCOUNT_ID;

  if (!apiKey || !accountId) {
    console.warn('FirstPromoter API credentials not configured');
    return { success: false, message: 'FirstPromoter not configured' };
  }

  // Validate required fields
  if (!data.email && !data.uid) {
    return { success: false, message: 'Either email or uid is required' };
  }

  if (!data.tid && !data.ref_id) {
    return { success: false, message: 'Either tid or ref_id is required' };
  }

  try {
    const response = await fetch('https://v2.firstpromoter.com/api/v2/track/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Account-ID': accountId,
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('FirstPromoter API error:', responseData);
      return { 
        success: false, 
        message: responseData.message || 'FirstPromoter tracking failed' 
      };
    }

    console.log('FirstPromoter signup tracked successfully:', responseData);
    return { success: true, data: responseData };

  } catch (error) {
    console.error('FirstPromoter tracking error:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string | null {
  // Check various headers for the real IP
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (ip && ip !== 'unknown') {
        return ip;
      }
    }
  }

  return null;
}

/**
 * Prepare tracking data from request and user info
 */
export function prepareTrackingData(
  request: Request,
  userInfo: { email?: string; uid?: string }
): FirstPromoterTrackingData {
  const tid = getTrackingIdFromRequest(request);
  const ref_id = getReferralIdFromRequest(request);
  const ip = getClientIP(request);

  return {
    email: userInfo.email,
    uid: userInfo.uid,
    tid: tid || undefined,
    ref_id: ref_id || undefined,
    ip: ip || undefined,
  };
}

