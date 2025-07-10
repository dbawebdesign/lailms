const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// The lesson section IDs to fix
const LESSON_SECTION_IDS = [
  '75d97703-8523-4361-815b-a7eb2a07e440',
  '59f2c0b4-da76-48d6-a789-91a3dafcdb7f'
];

/**
 * Convert plain text content to proper TipTap JSON format
 */
function convertToTipTapJSON(content) {
  // If content is already a proper TipTap JSON object, return it
  if (typeof content === 'object' && content.type === 'doc') {
    return content;
  }
  
  // If content is a string, convert to TipTap format
  if (typeof content === 'string') {
    // Split into paragraphs and create TipTap structure
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    
    const tipTapContent = {
      type: 'doc',
      content: paragraphs.map(paragraph => ({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: paragraph.trim()
          }
        ]
      }))
    };
    
    return tipTapContent;
  }
  
  // If content is an object with a 'text' field (old format), extract and convert
  if (typeof content === 'object' && content.text) {
    return convertToTipTapJSON(content.text);
  }
  
  // If content is some other object format, try to extract meaningful text
  if (typeof content === 'object') {
    // Look for common text fields
    const textFields = ['content', 'description', 'body', 'text'];
    for (const field of textFields) {
      if (content[field] && typeof content[field] === 'string') {
        return convertToTipTapJSON(content[field]);
      }
    }
    
    // If it's a complex object, convert to JSON string and then to TipTap
    const jsonString = JSON.stringify(content, null, 2);
    return convertToTipTapJSON(jsonString);
  }
  
  // Fallback: create empty TipTap document
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Content could not be converted to TipTap format'
          }
        ]
      }
    ]
  };
}

/**
 * Examine a lesson section and show its current content structure
 */
async function examineLessonSection(sectionId) {
  console.log(`\n=== Examining Lesson Section: ${sectionId} ===`);
  
  try {
    const { data: section, error } = await supabase
      .from('lesson_sections')
      .select('id, title, content, section_type, created_at, updated_at')
      .eq('id', sectionId)
      .single();
    
    if (error) {
      console.error(`Error fetching section ${sectionId}:`, error);
      return null;
    }
    
    if (!section) {
      console.log(`Section ${sectionId} not found`);
      return null;
    }
    
    console.log(`Title: ${section.title}`);
    console.log(`Section Type: ${section.section_type}`);
    console.log(`Created: ${section.created_at}`);
    console.log(`Updated: ${section.updated_at}`);
    console.log(`Content Type: ${typeof section.content}`);
    
    if (typeof section.content === 'string') {
      console.log(`Content (String): ${section.content.substring(0, 200)}...`);
      console.log('❌ ISSUE: Content is stored as string instead of TipTap JSON');
    } else if (typeof section.content === 'object') {
      if (section.content && section.content.type === 'doc') {
        console.log('✅ Content appears to be in TipTap JSON format');
        console.log(`TipTap Content Preview:`, JSON.stringify(section.content, null, 2).substring(0, 300) + '...');
      } else {
        console.log('⚠️  Content is object but not TipTap format');
        console.log(`Content Preview:`, JSON.stringify(section.content, null, 2).substring(0, 300) + '...');
      }
    } else {
      console.log(`Content: ${section.content}`);
    }
    
    return section;
  } catch (error) {
    console.error(`Error examining section ${sectionId}:`, error);
    return null;
  }
}

/**
 * Fix a lesson section's content to proper TipTap JSON format
 */
async function fixLessonSection(sectionId) {
  console.log(`\n=== Fixing Lesson Section: ${sectionId} ===`);
  
  try {
    // First get the current section
    const section = await examineLessonSection(sectionId);
    if (!section) {
      return false;
    }
    
    // Check if it needs fixing
    if (typeof section.content === 'object' && section.content && section.content.type === 'doc') {
      console.log('✅ Section already has proper TipTap JSON format - no fix needed');
      return true;
    }
    
    // Convert to proper TipTap format
    console.log('🔧 Converting content to TipTap JSON format...');
    const tipTapContent = convertToTipTapJSON(section.content);
    
    console.log('Converted TipTap JSON:', JSON.stringify(tipTapContent, null, 2));
    
    // Update the section
    const { error } = await supabase
      .from('lesson_sections')
      .update({
        content: tipTapContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', sectionId);
    
    if (error) {
      console.error(`Error updating section ${sectionId}:`, error);
      return false;
    }
    
    console.log('✅ Successfully updated section with TipTap JSON format');
    
    // Verify the fix
    console.log('\n--- Verification ---');
    await examineLessonSection(sectionId);
    
    return true;
  } catch (error) {
    console.error(`Error fixing section ${sectionId}:`, error);
    return false;
  }
}

/**
 * Main function to examine and fix all specified lesson sections
 */
async function main() {
  console.log('🔍 Examining and fixing lesson section content formats...\n');
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  console.log(`Processing ${LESSON_SECTION_IDS.length} lesson sections...`);
  
  // First, examine all sections
  console.log('\n📋 EXAMINATION PHASE');
  console.log('='.repeat(50));
  
  const sections = [];
  for (const sectionId of LESSON_SECTION_IDS) {
    const section = await examineLessonSection(sectionId);
    if (section) {
      sections.push(section);
    }
  }
  
  // Then fix any that need fixing
  console.log('\n🔧 FIXING PHASE');
  console.log('='.repeat(50));
  
  let fixedCount = 0;
  let skippedCount = 0;
  
  for (const sectionId of LESSON_SECTION_IDS) {
    const success = await fixLessonSection(sectionId);
    if (success) {
      const section = sections.find(s => s.id === sectionId);
      if (section && (typeof section.content !== 'object' || !section.content.type)) {
        fixedCount++;
      } else {
        skippedCount++;
      }
    }
  }
  
  console.log('\n📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total sections processed: ${LESSON_SECTION_IDS.length}`);
  console.log(`Sections fixed: ${fixedCount}`);
  console.log(`Sections skipped (already correct): ${skippedCount}`);
  console.log(`Sections with errors: ${LESSON_SECTION_IDS.length - fixedCount - skippedCount}`);
  
  console.log('\n✅ Script completed!');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  examineLessonSection,
  fixLessonSection,
  convertToTipTapJSON
}; 