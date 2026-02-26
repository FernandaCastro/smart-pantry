<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Smart Pantry

Smart Pantry is an AI-assisted pantry management application designed to help users organize household inventory, track item quantities, and improve replenishment decisions with a modern, responsive web interface.

The project combines a React + Vite frontend with Supabase (database/auth/serverless) and Gemini-powered features.

## Project origin and collaboration model

The initial version of this application was generated in **Google AI Studio**.

All subsequent iterations, refinements, and ongoing development interactions are being carried out through **Codex**.

## Architecture direction (Quick and pragmatic approach: Supabase + a serverless layer)

This repository now follows a **Quick and pragmatic approach** for backend evolution:
- Keep Supabase as the backend platform (Auth + Postgres).
- Move AI calls to a secure server-side layer using **Supabase Edge Functions**.
- Keep the frontend focused on UI and interaction logic.

Implemented in this iteration:
- `supabase/functions/ai-suggestions/index.ts`: Edge Function to call Gemini securely with server-side `GEMINI_API_KEY`.
- `supabase/functions/voice-assistant/index.ts`: Edge Function for voice assistant AI calls with token quota enforcement.
- `services/gemini.ts`: frontend calls only the `ai-suggestions` Edge Function using Supabase session auth.
- `services/voiceAssistant.ts`: frontend calls only the `voice-assistant` Edge Function for voice AI responses.
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
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Start the development server:
   `npm run dev`

## Supabase Edge Function (AI)

Function path:
- `supabase/functions/ai-suggestions/index.ts`

Expected server secret in Supabase environment:
- `GEMINI_API_KEY`

Suggested deployment command (Supabase CLI):
- `supabase functions deploy ai-suggestions`
- `supabase functions deploy voice-assistant`



## AI usage & limits

- The frontend calls AI **only** through Supabase Edge Function `ai-suggestions`; there is no direct Gemini call or AI API key in client code.
- Set `GEMINI_API_KEY` as a Supabase Function Secret (for example: `supabase secrets set GEMINI_API_KEY=...`).
- Current MVP limit: **12,000 tokens per user in a rolling 24h window** for `ai-suggestions`.
- To adjust the limit, edit `DAILY_TOKEN_LIMIT` in `supabase/functions/ai-suggestions/index.ts` and redeploy the function.


## Voice AI token governance

For voice-driven AI usage control, see the implementation guide at:
- `docs/token-control-voice.md`

## Supabase RLS hardening (next step)

For production, do not keep permissive `ALLOW ALL` policies.

A secure starter policy set is available at:
- `supabase/rls_policies.sql`

It enforces access by authenticated user (`auth.uid()`) and pantry ownership/collaboration boundaries.
