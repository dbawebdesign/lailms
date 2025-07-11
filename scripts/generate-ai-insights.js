#!/usr/bin/env node

/**
 * Script to generate AI insights for current users
 * Usage: node scripts/generate-ai-insights.js [user_id]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateInsightsForUser(userId) {
  try {
    console.log(`🔄 Generating insights for user: ${userId}`);
    
    // Call the API endpoint
    const response = await fetch(`http://localhost:3000/api/ai-insights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generate',
        userId: userId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Insights generated successfully:');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('❌ Error generating insights:', error.message);
    throw error;
  }
}

async function generateInsightsForAllUsers() {
  try {
    console.log('🔄 Fetching all users...');
    
    // Get all users with profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, role')
      .limit(10); // Limit to 10 users for testing

    if (error) {
      throw error;
    }

    console.log(`📊 Found ${profiles.length} users`);

    for (const profile of profiles) {
      try {
        console.log(`\n👤 Processing: ${profile.first_name} ${profile.last_name} (${profile.role})`);
        await generateInsightsForUser(profile.user_id);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Failed for user ${profile.user_id}:`, error.message);
        continue;
      }
    }

    console.log('\n🎉 Bulk generation completed!');
  } catch (error) {
    console.error('❌ Error in bulk generation:', error.message);
    throw error;
  }
}

async function testWithMockCall() {
  try {
    console.log('🧪 Testing AI insights generation with mock call...');
    
    // First, let's get a user to test with
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, role')
      .limit(1)
      .single();

    if (error || !profiles) {
      throw new Error('No users found to test with');
    }

    console.log(`👤 Testing with user: ${profiles.first_name} ${profiles.last_name} (${profiles.role})`);
    
    // Generate insights
    await generateInsightsForUser(profiles.user_id);
    
    // Check if insights were stored
    const { data: insights, error: insightsError } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', profiles.user_id)
      .order('generated_at', { ascending: false })
      .limit(1);

    if (insightsError) {
      throw insightsError;
    }

    if (insights && insights.length > 0) {
      console.log('✅ Insights successfully stored in database:');
      console.log('📝 Generated insights:');
      console.log(JSON.stringify(insights[0].insights, null, 2));
    } else {
      console.log('⚠️ No insights found in database');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const userId = args[1];

  try {
    if (command === 'test') {
      await testWithMockCall();
    } else if (command === 'user' && userId) {
      await generateInsightsForUser(userId);
    } else if (command === 'all') {
      await generateInsightsForAllUsers();
    } else {
      console.log(`
🤖 AI Insights Generator

Usage:
  node scripts/generate-ai-insights.js test           # Test with one user
  node scripts/generate-ai-insights.js user <id>     # Generate for specific user
  node scripts/generate-ai-insights.js all           # Generate for all users (limited to 10)

Examples:
  node scripts/generate-ai-insights.js test
  node scripts/generate-ai-insights.js user 123e4567-e89b-12d3-a456-426614174000
  node scripts/generate-ai-insights.js all
      `);
    }
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

main(); 