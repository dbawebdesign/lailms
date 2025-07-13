# First-Time User Onboarding System

A premium, intuitive onboarding system that shows contextual tooltips only on the first interaction with any UI element. Designed to feel natural and unobtrusive while providing comprehensive coverage of your application.

## Features

- **First-Click Only**: Tooltips appear only the first time a user interacts with an element
- **Persistent Tracking**: Uses Supabase profiles.settings for authenticated users, localStorage for guests
- **Premium Design**: Smooth animations, proper positioning, and accessible interactions
- **Comprehensive Coverage**: Can be applied to any clickable element in your app
- **Smart Positioning**: Automatically positions tooltips to avoid viewport edges
- **Keyboard Accessible**: Full keyboard navigation support

## Quick Start

### 1. Add the Provider to Your App

```tsx
// In your app layout or root component
import { OnboardingProvider } from '@/context/OnboardingContext';

export default function RootLayout({ children }) {
  return (
    <OnboardingProvider totalSteps={50}>
      {children}
    </OnboardingProvider>
  );
}
```

### 2. Add Onboarding to Any Component

```tsx
import { useOnboardingStep } from '@/context/OnboardingContext';
import { OnboardingTooltip } from '@/components/onboarding/OnboardingTooltip';

function MyComponent() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const step = useOnboardingStep('my-unique-step-id');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (step.shouldShow) {
      setTargetElement(buttonRef.current);
      setShowTooltip(true);
    }
    // Your normal click logic here
  };

  return (
    <>
      <button ref={buttonRef} onClick={handleClick}>
        My Button
      </button>
      
      <OnboardingTooltip
        isOpen={showTooltip}
        onClose={() => setShowTooltip(false)}
        onComplete={(stepId) => {
          step.markComplete();
          setShowTooltip(false);
        }}
        step={{
          id: 'my-unique-step-id',
          title: 'Welcome!',
          description: 'This button does something amazing...',
          placement: 'bottom',
          actionType: 'action'
        }}
        targetElement={targetElement}
      />
    </>
  );
}
```

### 3. Define Your Onboarding Steps

Create a centralized configuration for all your onboarding steps:

```tsx
// onboarding-config.ts
export const ONBOARDING_STEPS = {
  navigation: {
    id: 'navigation',
    title: 'Navigate Your Dashboard',
    description: 'Use this navigation to move between different sections...',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'navigation'
  },
  search: {
    id: 'search',
    title: 'Search Everything',
    description: 'Quickly find any content, course, or resource...',
    placement: 'bottom',
    actionType: 'action',
    category: 'tools'
  },
  // ... more steps
} as const;
```

## API Reference

### OnboardingStep Interface

```tsx
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  showArrow?: boolean;
  actionType?: 'info' | 'action' | 'feature-highlight';
  nextSteps?: string[];
  category?: string;
}
```

### useOnboardingStep Hook

```tsx
const { shouldShow, markComplete } = useOnboardingStep('step-id');
```

Returns:
- `shouldShow`: Boolean indicating if onboarding should be shown
- `markComplete`: Function to mark the step as completed

### OnboardingTooltip Props

```tsx
interface OnboardingTooltipProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (stepId: string) => void;
  step: OnboardingStep;
  targetElement?: HTMLElement | null;
  showEntrance?: boolean;
  autoCloseDelay?: number;
}
```

## Implementation Patterns

### Pattern 1: Simple Button Onboarding

```tsx
function SimpleButton() {
  const [showTooltip, setShowTooltip] = useState(false);
  const step = useOnboardingStep('simple-button');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (step.shouldShow) {
      setShowTooltip(true);
    }
    // Normal click logic
  };

  return (
    <>
      <Button ref={buttonRef} onClick={handleClick}>
        Click me
      </Button>
      
      {showTooltip && (
        <OnboardingTooltip
          isOpen={true}
          onClose={() => setShowTooltip(false)}
          onComplete={() => {
            step.markComplete();
            setShowTooltip(false);
          }}
          step={ONBOARDING_STEPS.simpleButton}
          targetElement={buttonRef.current}
        />
      )}
    </>
  );
}
```

### Pattern 2: Navigation Menu Onboarding

```tsx
function NavigationMenu() {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  
  const navStep = useOnboardingStep('navigation');
  const profileStep = useOnboardingStep('profile');

  const handleMenuClick = (stepId: string, element: HTMLElement, stepHook: any) => {
    if (stepHook.shouldShow) {
      setTargetElement(element);
      setActiveTooltip(stepId);
    }
    // Navigation logic
  };

  return (
    <nav>
      <button 
        ref={navRef}
        onClick={(e) => handleMenuClick('navigation', e.currentTarget, navStep)}
      >
        Dashboard
      </button>
      
      <button 
        ref={profileRef}
        onClick={(e) => handleMenuClick('profile', e.currentTarget, profileStep)}
      >
        Profile
      </button>

      {activeTooltip && (
        <OnboardingTooltip
          isOpen={true}
          onClose={() => setActiveTooltip(null)}
          onComplete={(stepId) => {
            // Mark completed and close
            const stepHook = stepId === 'navigation' ? navStep : profileStep;
            stepHook.markComplete();
            setActiveTooltip(null);
          }}
          step={ONBOARDING_STEPS[activeTooltip]}
          targetElement={targetElement}
        />
      )}
    </nav>
  );
}
```

### Pattern 3: Hover-Based Onboarding

```tsx
function HoverOnboarding() {
  const [showTooltip, setShowTooltip] = useState(false);
  const step = useOnboardingStep('hover-feature');
  const elementRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (step.shouldShow) {
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    if (step.shouldShow) {
      setTimeout(() => setShowTooltip(false), 200);
    }
  };

  return (
    <>
      <div 
        ref={elementRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="hover:bg-gray-100 p-4 rounded-lg cursor-pointer"
      >
        Hover over me
      </div>
      
      {showTooltip && (
        <OnboardingTooltip
          isOpen={true}
          onClose={() => setShowTooltip(false)}
          onComplete={() => {
            step.markComplete();
            setShowTooltip(false);
          }}
          step={ONBOARDING_STEPS.hoverFeature}
          targetElement={elementRef.current}
          autoCloseDelay={3}
        />
      )}
    </>
  );
}
```

## Best Practices

### 1. Step IDs
- Use kebab-case for consistency: `'main-navigation'`, `'create-course'`
- Be descriptive: `'search-global'` instead of just `'search'`
- Group related steps: `'nav-dashboard'`, `'nav-courses'`, `'nav-settings'`

### 2. Tooltip Content
- Keep titles concise (2-4 words)
- Make descriptions actionable and specific
- Use consistent tone and voice
- Include what happens when they click

### 3. Positioning
- Prefer `'bottom'` and `'right'` for most elements
- Use `'center'` for important introductory tooltips
- Test on different screen sizes

### 4. Performance
- Only render `OnboardingTooltip` when needed
- Use `useCallback` for event handlers
- Debounce rapid interactions

## Troubleshooting

### Tooltip Not Showing
1. Check if user has already completed the step
2. Verify `shouldShow` is true
3. Ensure `targetElement` is set correctly
4. Check console for errors

### Positioning Issues
1. Verify target element is rendered and visible
2. Check CSS z-index conflicts
3. Test on different viewport sizes
4. Use browser dev tools to inspect positioning

### Performance Issues
1. Minimize tooltip re-renders
2. Use `useCallback` for handlers
3. Consider virtualizing long lists with onboarding
4. Monitor bundle size impact

## Demo

See `OnboardingDemo.tsx` for a complete working example showing multiple interaction patterns and use cases.

## Integration with Existing Code

The onboarding system is designed to integrate seamlessly with your existing components:

1. **Minimal Code Changes**: Just add a ref and conditional tooltip rendering
2. **Preserves Existing Behavior**: All original click handlers and logic remain unchanged
3. **Graceful Degradation**: If onboarding is disabled, components work normally
4. **Type Safety**: Full TypeScript support with proper typing

This system scales with your application and provides a premium user experience that feels natural and helpful rather than intrusive. 