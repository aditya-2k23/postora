# Social Media Studio -- Project Context & Finalized Plan

## Project Goal

Build an AI-powered social media creation studio for an
education-focused brand.

The app helps a user turn a rough idea into a polished, editable,
ready-to-post social media creative.

Example prompt:

> "Carousel for parents about why kids forget what they learn. Explain
> the forgetting curve and how spaced repetition fixes it."

The output should be: - Structured social media content - Multi-card
carousel content - Matching AI-generated visual prompts or images -
Editable layouts - Export-ready assets for different social media
platforms

This is NOT a presentation or PowerPoint builder. It is specifically a
social media post and carousel generator.

## Finalized Tech Stack

### Frontend

- Next.js 15+ with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui

### State & UI

- Zustand
- Framer Motion
- dnd-kit
- React Hook Form
- Zod

### Export

- html-to-image
- jsPDF

### Authentication & Database

- Firebase Authentication
- Firebase Firestore

### AI

Primary: - Gemini API for all text and image-related generation

Fallback: - Hugging Face API only if Gemini fails, rate limits, or
returns errors

### Deployment

- Vercel

## Why Gemini Was Chosen

Gemini was chosen instead of Hugging Face free inference because:

- Hugging Face free endpoints often have cold starts
- Hugging Face can take 20--60 seconds for image generation
- Hugging Face frequently returns 503 or rate limit errors
- Gemini free tier is more reliable and faster for demos
- Gemini handles both text generation and image prompt generation well

Hugging Face should still remain as a backup system if Gemini fails.

## Core Product Features

### Main User Flow

1. User enters a prompt
2. AI generates a structured set of social media cards
3. User edits the cards
4. User changes format/platform if needed
5. User exports the result

## Supported Platforms

The app must support:

- Instagram Post
- Instagram Carousel
- Instagram Story
- LinkedIn Post
- X / Twitter Graphic
- TikTok / Reel Cover

Supported aspect ratios: - 1:1 - 4:5 - 9:16 - 16:9

Users must be able to switch formats after generation and the layout
should adapt automatically.

## Carousel Rules

- Default number of cards: 5
- Maximum cards for MVP: 12
- Future premium plan can support unlimited cards

Typical structure: 1. Hook card 2. Supporting cards 3. Final CTA card

Example: - Card 1: "Why do kids forget what they learn?" - Card 2--4:
Explain the forgetting curve - Card 5: Introduce spaced repetition and
CTA

## Studio Page Layout

The main studio page should have 3 sections.

### Left Sidebar

Contains: - Prompt textarea - Tone selector - Platform selector - Aspect
ratio selector - Number of cards selector - Generate button

Tone options: - Professional - Friendly - Bold - Parent-Focused - Data-Driven

### Center Area

Contains: - Preview of one social media card at a time - Previous / Next
controls - Inline editable text - Drag-and-drop card ordering -
Regenerate a single card - Regenerate only the image/background of a
card

Must use: - dnd-kit - Framer Motion for smooth interactions and polished feel

### Right Sidebar

Contains: - Theme customization - Color picker - Font size slider -
Minimal vs Bold theme toggle - Export buttons

Export options: - Export PNG - Export PDF

### Authentication & User Data

Use Firebase Authentication with: - Google Sign In - Email / Password
Sign In

Use Firebase Firestore to store user projects.

Firestore structure:

users/{userId}/projects/{projectId}

Each project should store: - Prompt - Platform - Aspect Ratio - Theme
Settings - Generated Cards - Created At

Only the logged-in user should see their own projects.

Add a "Recent Projects" page that shows previously saved work.

### Saving Strategy

Use both:

localStorage

- Auto-save current draft instantly
- Prevent data loss if user refreshes

Firestore

- Save projects permanently for logged-in users
- Sync across devices

## Finalized Design System

Visual style should be: - Minimal - Professional - Trustworthy - Clean
and modern

Inspired by: - Canva - Gamma - Notion

Default design values:

- Font: Inter
- Primary Color: #2563EB
- Secondary Color: #0F172A
- Accent Color: #E0F2FE
- White background
- Soft gray sections
- Rounded-xl cards
- Soft shadows
- Spacious layout

The UI should feel premium without being flashy.

## Important MVP Features

These are the most important features and must be built first:

1. Prompt → AI generated content
2. Editable social media cards
3. Platform / aspect ratio switching
4. Save projects
5. Export PNG and PDF

## Standout Features

These features make the project stronger than most internship
submissions:

- Auto Reformat button that instantly converts one format into another
- Tone selector
- Example prompts users can click
- Recent Projects page
- Editable individual cards
- Regenerate only one card instead of the whole set
- Regenerate only the image of a card
- Beautiful empty state and onboarding hints
- Smooth motion and polished interactions

## Smart Tradeoffs

The project must be realistic to finish in 3 days.

Good tradeoffs:

- Use Next.js API routes instead of a separate backend
- Use Firestore instead of building a custom database server
- Use Gemini instead of complicated multi-model pipelines
- Keep collaboration and premium billing as future features
- Keep the MVP focused and stable

Avoid: - Over-engineering - Complex microservices - Realtime
collaboration - Large animation systems - Too many premium-only features

## API Route Responsibilities

### /api/generate-content

Should: - Receive prompt, tone, platform, card count - Call Gemini -
Return structured card data

Each card should contain: - title - subtitle/body - imagePrompt

### /api/generate-image

Should: - Receive image prompt - Call Gemini or Hugging Face fallback -
Return image URL or base64 image

API keys must always stay server-side.

## Environment Variables

``` env
GEMINI_API_KEY=
HUGGINGFACE_API_KEY=

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Final Vision

The final app should feel like a lightweight AI-powered version of Canva
built specifically for educational social media content.

It should be fast, polished, editable, visually clean, and reliable
enough for a strong internship demo.
