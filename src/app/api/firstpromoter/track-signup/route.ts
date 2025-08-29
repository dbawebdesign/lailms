import { NextRequest, NextResponse } from 'next/server';
import { trackFirstPromoterSignup, prepareTrackingData } from '@/lib/firstpromoter';

interface TrackSignupRequest {
  email?: string;
  uid?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TrackSignupRequest = await request.json();
    
    // Validate required fields
    if (!body.email && !body.uid) {
      return NextResponse.json(
        { error: 'Either email or uid is required' },
        { status: 400 }
      );
    }

    // Prepare tracking data from request and user info
    const trackingData = prepareTrackingData(request, {
      email: body.email,
      uid: body.uid,
    });

    // Check if we have tracking information
    if (!trackingData.tid && !trackingData.ref_id) {
      // No referral tracking data found - this is normal for direct signups
      return NextResponse.json({ 
        success: true, 
        message: 'No referral data found - direct signup' 
      });
    }

    // Track the signup with FirstPromoter
    const result = await trackFirstPromoterSignup(trackingData);

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Referral tracked successfully',
        data: result.data 
      });
    } else {
      // Log the error but don't fail the signup process
      console.error('FirstPromoter tracking failed:', result.message);
      return NextResponse.json({ 
        success: false, 
        message: result.message 
      }, { status: 200 }); // Return 200 to not break signup flow
    }

  } catch (error) {
    console.error('FirstPromoter tracking API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 200 } // Return 200 to not break signup flow
    );
  }
}
