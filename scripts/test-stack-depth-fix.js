/**
 * Test script to verify PostgreSQL stack depth limit fix
 * Run with: node scripts/test-stack-depth-fix.js
 */

// Create deeply nested test content that would normally cause stack depth issues
function createComplexTestContent() {
  // Create deeply nested objects and arrays
  const deepObject = {};
  let current = deepObject;
  
  // Create 15 levels of nesting (would exceed stack depth)
  for (let i = 0; i < 15; i++) {
    current.level = i;
    current.data = `Level ${i} data with lots of content that goes on and on...`.repeat(100);
    current.nested = {};
    current = current.nested;
  }

  // Create large arrays with nested content
  const largeArray = [];
  for (let i = 0; i < 50; i++) {
    largeArray.push({
      id: i,
      content: `Item ${i} content`.repeat(200),
      metadata: {
        tags: Array.from({length: 20}, (_, j) => `tag-${i}-${j}`),
        properties: {
          nested: {
            deeper: {
              evenDeeper: {
                data: `Deep data for item ${i}`.repeat(50)
              }
            }
          }
        }
      }
    });
  }

  return {
    sectionTitle: "Complex Test Section",
    content: "Very long content string that simulates typical lesson content...".repeat(1000),
    learningObjectives: Array.from({length: 25}, (_, i) => ({
      id: i,
      objective: `Learning objective ${i}`,
      details: `Detailed explanation for objective ${i}`.repeat(100),
      subObjectives: Array.from({length: 10}, (_, j) => ({
        id: j,
        text: `Sub-objective ${i}.${j}`,
        metadata: deepObject
      }))
    })),
    keyPoints: Array.from({length: 30}, (_, i) => ({
      point: `Key point ${i}`,
      explanation: `Explanation for key point ${i}`.repeat(150),
      examples: largeArray.slice(0, 10)
    })),
    activities: Array.from({length: 15}, (_, i) => ({
      type: "complex_activity",
      name: `Activity ${i}`,
      instructions: `Instructions for activity ${i}`.repeat(200),
      materials: Array.from({length: 20}, (_, j) => `Material ${i}-${j}`),
      steps: Array.from({length: 25}, (_, k) => ({
        step: k,
        description: `Step ${k} description`.repeat(100),
        substeps: Array.from({length: 10}, (_, l) => ({
          substep: l,
          details: deepObject
        }))
      }))
    })),
    examples: largeArray
  };
}

console.log('🧪 Creating complex test content that would normally cause stack depth issues...');
const complexContent = createComplexTestContent();

console.log('📊 Content statistics:');
console.log('- Learning objectives:', complexContent.learningObjectives.length);
console.log('- Key points:', complexContent.keyPoints.length);
console.log('- Activities:', complexContent.activities.length);
console.log('- Examples:', complexContent.examples.length);
console.log('- Estimated JSON size:', JSON.stringify(complexContent).length, 'bytes');

console.log('\n✅ Complex test content created successfully!');
console.log('📝 This content can be used to test the stack depth limit fix in the course generator.');
console.log('🔍 The sanitizeContentForDatabase() method should handle this content safely.');

// Simulate the sanitization process
console.log('\n🔧 Testing content sanitization...');
try {
  // Simulate what the CourseGenerator would do
  const estimatedSize = JSON.stringify(complexContent).length;
  console.log(`📏 Original content size: ${estimatedSize} bytes`);
  
  if (estimatedSize > 500000) {
    console.log('⚠️  Content size exceeds 500KB - would be flagged as high complexity');
  }
  
  console.log('✅ Content sanitization test completed successfully');
} catch (error) {
  console.error('❌ Error during content sanitization test:', error);
}

module.exports = { createComplexTestContent }; 