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
- **Google GenAI SDK + Hugging Face + Cloudinary**: Uses Gemini for content generation, Hugging Face for AI image generation, and Cloudinary for durable image storage.

## Quick Start

1. Provide the following inside `.env.local`:

```bash
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
HUGGINGFACE_API_KEY="YOUR_HUGGINGFACE_API_KEY"

CLOUDINARY_CLOUD_NAME="YOUR_CLOUDINARY_CLOUD_NAME"
CLOUDINARY_API_KEY="YOUR_CLOUDINARY_API_KEY"
CLOUDINARY_API_SECRET="YOUR_CLOUDINARY_API_SECRET"

NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_FIREBASE_WEB_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_FIREBASE_PROJECT.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_PROJECT.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_FIREBASE_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_FIREBASE_APP_ID"
NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID="(default)"

FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@YOUR_FIREBASE_PROJECT_ID.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_FIRESTORE_DATABASE_ID="(default)"

AI_DAILY_LIMIT_GENERATE_CONTENT="25"
AI_DAILY_LIMIT_ASSISTANT_CHAT="80"
AI_DAILY_LIMIT_GENERATE_IMAGE="40"

AI_RATE_LIMIT_GENERATE_CONTENT_PER_MINUTE="12"
AI_RATE_LIMIT_ASSISTANT_CHAT_PER_MINUTE="20"
AI_RATE_LIMIT_GENERATE_IMAGE_PER_MINUTE="16"

AI_USAGE_IP_HASH_SALT="replace-with-a-random-long-string"

ENFORCE_AUTH="true"
ENFORCE_QUOTAS="true"
ENABLE_IMAGE_MIGRATION="false"
ENFORCE_ADMIN_AUTH="true"
ADMIN_SECRET="replace-with-a-long-random-secret"

APP_URL="http://localhost:3000"
```

1. Enable **Google Sign-In** within your Firebase Console `Authentication` menu.
2. Set up Firestore rules so project writes are user-scoped and AI usage collections are read-only for clients.
3. AI routes require Firebase ID token bearer auth, and daily/per-minute limits are enforced server-side.
4. Cloudinary credentials are required for durable image persistence and legacy base64 migration.
5. `ADMIN_SECRET` + `ENFORCE_ADMIN_AUTH` protect the admin usage endpoint.
6. Run `npm run dev` and navigate to `http://localhost:3000`.
