# Social Media Studio

An AI-powered social media post and carousel creator using Next.js 15, Tailwind, Shadcn UI, Zustand, Firebase, and Gemini API.

## Core Features

- **Text-to-Carousel**: Translates prompts into highly engaging, multi-card formats.
- **Auto-Formatting**: Instantly formats your post for Square (1:1), Portrait (4:5), Landscape (16:9), or Reel/Story (9:16).
- **Drag & Drop**: Rapidly re-order the slides utilizing `dnd-kit`.
- **Full Client-side Exports**: Highly optimized SVG to PNG/PDF export natively supported via `html-to-image` and `jsPDF`.
- **Cloud Saving**: All generated states persist reliably into Firebase Firestore, enabling multi-device synchronization based on your authenticated session.

## Tech Stack & Architecture

- **Next.js 15 (App Router)**: Orchestrates server API routes preserving backend secrets away from the client browser.
- **Zustand (`store/useStudioStore.ts`)**: Powers the intricate canvas state. Implements `persist` middleware for local caching.
- **Tailwind CSS & Shadcn UI**: Flexible design system.
- **Firebase Firestore & Auth**: Secure cloud storage mapping records against authenticated user scopes.
- **Google GenAI SDK**: Uses `gemini-3-flash-preview` and `gemini-3.1-flash-image-preview` for content and graphics.

## Quick Start

1. Provide the following inside `.env.local`:

```bash
NEXT_PUBLIC_GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
APP_URL="http://localhost:3000"
```

2. Initialize your `firebase-applet-config.json` with your Firebase project properties:

```json
{
  "projectId": "your-firebase-projectId",
  "appId": "your-app-id",
  "apiKey": "your-firebase-web-api-key",
  "authDomain": "your-firebase-projectId.firebaseapp.com",
  "firestoreDatabaseId": "(default)"
}
```

3. Enable **Google Sign-In** within your Firebase Console `Authentication` menu.
4. Set up standard Firestore security rules enforcing read/write mapping per `userId`.

5. Run `npm run dev` and navigate to `http://localhost:3000`.
