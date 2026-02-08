<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Smart Pantry

Smart Pantry is an AI-assisted pantry management application designed to help users organize household inventory, track item quantities, and improve replenishment decisions with a modern, responsive web interface.

The project combines a React + Vite frontend with Supabase (database/auth) and Gemini-powered features.

## Project origin and collaboration model

The initial version of this application was generated in **Google AI Studio**.

All subsequent iterations, refinements, and ongoing development interactions are being carried out through **Codex**.

## Architecture direction (Option A)

This repository now follows **Option A** for backend evolution:
- Keep Supabase as the backend platform (Auth + Postgres).
- Move AI calls to a secure server-side layer using **Supabase Edge Functions**.
- Keep the frontend focused on UI and interaction logic.

Implemented in this iteration:
- `supabase/functions/ai-suggestions/index.ts`: Edge Function to call Gemini securely with server-side `GEMINI_API_KEY`.
- `services/gemini.ts`: frontend now tries the Edge Function first, and only falls back to direct client call when needed.
- UI refactor with reusable components in `components/` for easier maintenance.

## Frontend code organization

To improve maintainability, parts of the monolithic UI were extracted into dedicated components:
- `components/BottomNav.tsx`
- `components/VoiceAssistantOverlay.tsx`
- `components/ProductFormModal.tsx`

This is the first step toward a fuller feature-based modular structure.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create a `.env` file (you can copy `.env.example`) and set:
   - `VITE_API_KEY` or `VITE_GEMINI_API_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_CLIENT_ID`
3. Start the development server:
   `npm run dev`

## Supabase Edge Function (AI)

Function path:
- `supabase/functions/ai-suggestions/index.ts`

Expected server secret in Supabase environment:
- `GEMINI_API_KEY`

Suggested deployment command (Supabase CLI):
- `supabase functions deploy ai-suggestions`


## Supabase RLS hardening (next step)

For production, do not keep permissive `ALLOW ALL` policies.

A secure starter policy set is available at:
- `supabase/rls_policies.sql`

It enforces access by authenticated user (`auth.uid()`) and pantry ownership/collaboration boundaries.
