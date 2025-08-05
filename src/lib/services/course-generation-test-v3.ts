/**
 * Test file to verify V3 optimizations
 * 
 * This demonstrates how to use the new CourseGenerationOrchestratorV3
 * with structured outputs, rate limiting, and logging
 */

import { CourseGenerationOrchestratorV3 } from './course-generation-orchestrator-v3';
import { CourseGenerationRateLimiter } from './course-generation-rate-limiter';

export async function testV3Optimizations() {
  console.log('🚀 Testing Course Generation V3 Optimizations...\n');

  // Test 1: Rate Limiting
  console.log('📋 Test 1: Rate Limiting');
  const rateLimiter = new CourseGenerationRateLimiter();
  
  // Simulate a student user
  const testUserId = 'test-user-123';
  const testUserRole = 'student';
  
  const rateLimitCheck = await rateLimiter.checkRateLimit(testUserId, testUserRole);
  console.log('Rate limit check result:', rateLimitCheck);
  
  if (rateLimitCheck.allowed) {
    console.log('✅ User allowed to generate course');
    console.log('Current usage:', rateLimitCheck.current_usage);
  } else {
    console.log('❌ User rate limited');
    console.log('Reason:', rateLimitCheck.reason);
    console.log('Retry after:', rateLimitCheck.retry_after, 'seconds');
  }

  // Test 2: Get Usage Statistics
  console.log('\n📊 Test 2: Usage Statistics');
  const usageStats = await rateLimiter.getUserUsageStats(testUserId);
  if (usageStats) {
    console.log('Current usage:', usageStats.current);
    console.log('Limits:', usageStats.limits);
    console.log('Usage percentages:', usageStats.percentages);
  }

  // Test 3: Structured Output Validation
  console.log('\n🏗️ Test 3: Structured Output Validation');
  
  // Example of validating lesson content
  const { validateWithDetails, LessonSectionContentSchema } = await import('@/lib/schemas/course-generation-schemas');
  
  const sampleContent = {
    introduction: "Welcome to this comprehensive lesson on React Hooks. In this section, we'll explore one of the most powerful features of modern React development.",
    detailed_explanation: "React Hooks revolutionized how we write React components by allowing us to use state and other React features without writing a class. Introduced in React 16.8, Hooks provide a more direct API to the React concepts you already know: props, state, context, refs, and lifecycle. They enable you to organize the logic inside a component into reusable isolated units.",
    key_concepts: [
      {
        concept: "useState Hook",
        explanation: "The useState Hook allows you to add state to functional components, replacing the need for class components in many cases.",
        importance: "critical"
      },
      {
        concept: "useEffect Hook",
        explanation: "The useEffect Hook lets you perform side effects in function components, serving the same purpose as lifecycle methods.",
        importance: "critical"
      },
      {
        concept: "Rules of Hooks",
        explanation: "Hooks must be called at the top level of your React functions and cannot be called inside loops, conditions, or nested functions.",
        importance: "important"
      }
    ],
    examples: [
      {
        title: "Basic useState Example",
        description: "This example demonstrates how to use the useState Hook to manage a simple counter state.",
        code: "const [count, setCount] = useState(0);\n\nreturn (\n  <div>\n    <p>You clicked {count} times</p>\n    <button onClick={() => setCount(count + 1)}>\n      Click me\n    </button>\n  </div>\n);",
        language: "javascript"
      },
      {
        title: "useEffect with Cleanup",
        description: "This example shows how to use useEffect for subscribing to external data and cleaning up when the component unmounts.",
        code: "useEffect(() => {\n  const subscription = subscribeToData();\n  \n  return () => {\n    subscription.unsubscribe();\n  };\n}, []);"
      }
    ],
    summary: "React Hooks provide a powerful way to use state and other React features in functional components, making code more reusable and easier to understand."
  };

  const validation = validateWithDetails(LessonSectionContentSchema, sampleContent);
  
  if (validation.success) {
    console.log('✅ Content validation passed!');
    console.log('Validated data keys:', Object.keys(validation.data));
  } else {
    console.log('❌ Content validation failed!');
    console.log('Errors:', validation.errors);
  }

  // Test 4: Model Selection
  console.log('\n🤖 Test 4: Model Selection Strategy');
  const modelSelectionExamples = {
    'lesson_section': 'gpt-4.1-mini',      // Complex content
    'assessment': 'gpt-4.1-mini',          // Question generation
    'mind_map': 'gpt-4.1-nano',            // Simple structured data
    'summary': 'gpt-4.1-nano',             // Simple summaries
    'title_generation': 'gpt-4.1-nano'     // Simple generation
  };
  
  console.log('Model selection by task type:');
  Object.entries(modelSelectionExamples).forEach(([taskType, model]) => {
    console.log(`  ${taskType}: ${model}`);
  });

  console.log('\n✨ V3 Optimization tests completed!');
  
  return {
    rateLimitCheck,
    usageStats,
    validationResult: validation.success,
    modelSelection: modelSelectionExamples
  };
}

// Export for testing
export { testV3Optimizations as default };