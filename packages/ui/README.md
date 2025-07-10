# @learnologyai/ui

This package contains the shared UI components and design system for the LearnologyAI application.

## Design System

The design tokens (colors, typography, spacing, etc.) are defined in `styleGuide.ts`. These tokens are intended to be used throughout the application to ensure consistency.

Use the CSS variables defined in `src/app/globals.css` (managed by `shadcn/ui`) or import tokens directly from `styleGuide.ts` where appropriate.

An ESLint rule (`custom-rules/no-literal-style`) is configured to help enforce the use of tokens over literal style values.

## Components

- **Button:** A standard button component. See `src/Button.tsx`.

*(Add more components as they are developed)*

## Usage

Import components directly from the package:

```typescript
import { Button } from '@learnologyai/ui';
``` 