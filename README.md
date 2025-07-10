This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Learnology AI

## Unified Mind Map System

The mind map generation system has been unified to handle both lesson and base class mind maps through a single API endpoint. This reduces code duplication and provides a consistent interface.

### API Endpoints

#### Generate Mind Map
- **Endpoint**: `POST /api/teach/media/generate/mind-map`
- **Body Parameters**:
  - `lessonId` (string, optional): Generate mind map for a specific lesson
  - `baseClassId` (string, optional): Generate mind map for an entire base class
- **Query Parameters**:
  - `regenerate=true` (optional): Force regenerate existing mind map
- **Response**: 
  ```json
  {
    "success": true,
    "asset": {
      "id": "asset_id",
      "url": "/api/teach/media/mind-map/asset_id",
      "title": "Mind Map Title"
    }
  }
  ```

#### Check Existing Mind Map
- **Endpoint**: `GET /api/teach/media/generate/mind-map`
- **Query Parameters**:
  - `lessonId` (string, optional): Check for lesson mind map
  - `baseClassId` (string, optional): Check for base class mind map
- **Response**: 
  ```json
  {
    "exists": true,
    "asset": {
      "id": "asset_id",
      "url": "/api/teach/media/mind-map/asset_id",
      "title": "Mind Map Title"
    }
  }
  ```

#### View Mind Map
- **Endpoint**: `GET /api/teach/media/mind-map/{id}`
- **Response**: Interactive HTML mind map display
- **Note**: Automatically detects whether the mind map is for a lesson or base class

### Features

- **Unified Generation**: Single endpoint handles both lesson and base class mind maps
- **Unified Display**: Single viewer endpoint serves both types of mind maps
- **Consistent Interface**: Same API patterns for both lesson and base class workflows
- **Automatic Detection**: System automatically determines content type and fetches appropriate data
- **Interactive Visualization**: Rich SVG-based mind maps with zoom, pan, and expand/collapse functionality

### Content Differences

**Lesson Mind Maps:**
- Center: Lesson title
- Branches: Lesson sections
- Hierarchy: Sections → Concepts → Points → Details

**Base Class Mind Maps:**
- Center: Course title  
- Branches: Course modules/paths
- Hierarchy: Modules → Lessons → Concepts → Details

### Usage Examples

```javascript
// Generate lesson mind map
const response = await fetch('/api/teach/media/generate/mind-map', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ lessonId: 'lesson_123' })
});

// Generate base class mind map
const response = await fetch('/api/teach/media/generate/mind-map', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ baseClassId: 'class_456' })
});

// Check for existing mind map
const checkResponse = await fetch('/api/teach/media/generate/mind-map?lessonId=lesson_123');
const { exists, asset } = await checkResponse.json();
```
