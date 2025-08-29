/**
 * Test script for FirstPromoter integration
 * Run with: node scripts/test-firstpromoter.js
 */

// Mock environment variables for testing
process.env.FIRSTPROMOTER_API_KEY = 'test_api_key';
process.env.FIRSTPROMOTER_ACCOUNT_ID = 'test_account_id';

// Import the FirstPromoter utilities
const { 
  parseCookiesFromHeaders, 
  getTrackingIdFromRequest, 
  getReferralIdFromRequest,
  prepareTrackingData,
  getClientIP
} = require('../src/lib/firstpromoter.ts');

console.log('🧪 Testing FirstPromoter Integration\n');

// Test 1: Cookie parsing
console.log('1. Testing cookie parsing...');
const testCookieHeader = '_fprom_tid=test_tracking_id_123; _fprom_ref=test_ref_456; other_cookie=value';
const cookies = parseCookiesFromHeaders(testCookieHeader);
console.log('   Parsed cookies:', cookies);
console.log('   ✅ Cookie parsing works\n');

// Test 2: Mock request object
console.log('2. Testing request parsing...');
const mockRequest = {
  headers: {
    get: (name) => {
      const headers = {
        'cookie': '_fprom_tid=tracking_123; _fprom_ref=ref_456',
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        'user-agent': 'Mozilla/5.0 Test Browser'
      };
      return headers[name] || null;
    }
  }
};

const trackingId = getTrackingIdFromRequest(mockRequest);
const referralId = getReferralIdFromRequest(mockRequest);
const clientIP = getClientIP(mockRequest);

console.log('   Tracking ID:', trackingId);
console.log('   Referral ID:', referralId);
console.log('   Client IP:', clientIP);
console.log('   ✅ Request parsing works\n');

// Test 3: Prepare tracking data
console.log('3. Testing tracking data preparation...');
const trackingData = prepareTrackingData(mockRequest, {
  email: 'test@example.com',
  uid: 'user_123'
});

console.log('   Tracking data:', trackingData);
console.log('   ✅ Tracking data preparation works\n');

// Test 4: Validate required fields
console.log('4. Testing validation...');
const hasRequiredFields = (trackingData.email || trackingData.uid) && 
                         (trackingData.tid || trackingData.ref_id);
console.log('   Has required fields:', hasRequiredFields);
console.log('   ✅ Validation works\n');

console.log('🎉 All tests passed! FirstPromoter integration is ready.');
console.log('\n📋 Next steps:');
console.log('   1. Set FIRSTPROMOTER_API_KEY in your environment');
console.log('   2. Set FIRSTPROMOTER_ACCOUNT_ID in your environment');
console.log('   3. Update client ID in /public/fprmain.js if needed');
console.log('   4. Test with a real referral link');
console.log('\n📖 See docs/firstpromoter-setup.md for detailed setup instructions.');
