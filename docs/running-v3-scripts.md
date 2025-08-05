# Running V3 Scripts - Quick Fix Guide

## What Happened?

When you tried to run `npx tsx scripts/verify-v3-setup.ts`, you encountered an error:
```
Error: Cannot find module 'dotenv'
```

This happened because:
1. `npx tsx` runs in an isolated environment
2. It doesn't have access to your project's node_modules
3. The script imports project dependencies like `dotenv` and your project modules

## The Solution

I've added proper npm scripts to your package.json and installed `tsx` as a dev dependency.

### Install the missing dependency:
```bash
npm install
```

### Now run the scripts using npm:

**Verify V3 Setup:**
```bash
npm run verify:v3
```

**Test V3 API Endpoint:**
```bash
npm run test:v3-api
```

## Why This Works

- Running through `npm run` executes within your project context
- Has access to all your dependencies
- Can import your project modules properly
- Environment variables are loaded correctly

## Available V3 Scripts

| Command | Description |
|---------|-------------|
| `npm run verify:v3` | Verifies all V3 components are properly set up |
| `npm run test:v3-api` | Tests the V3 API endpoint (requires auth token) |

## Next Steps

1. Run `npm install` to ensure tsx is installed
2. Run `npm run verify:v3` to check your setup
3. Follow the testing guide in `docs/testing-single-user-v3.md`

That's it! The scripts will now run properly with access to all your project dependencies.