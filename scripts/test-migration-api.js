// Test script to verify migration API works
// Run with: node scripts/test-migration-api.js

const fetch = require('node-fetch');

async function testMigrationAPI() {
  try {
    console.log('Testing migration API...');
    
    const response = await fetch('http://localhost:3000/api/auth/migrate-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'Learnologyteach',
        password: 'your-test-password-here'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);

    if (data.needsMigration) {
      console.log('✅ Migration detection working correctly');
      console.log('Migration token:', data.token);
      console.log('Profile:', data.profile);
    } else if (data.migrated) {
      console.log('ℹ️ User already migrated');
    } else {
      console.log('❌ Unexpected response');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMigrationAPI();
