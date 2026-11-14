# Integration steps

## 1. Apply the database migration

Run `supabase/migrations/20261114_legal_rag.sql` in the Supabase SQL Editor.
Confirm that `vector` is enabled and both tables plus `match_legal_chunks` exist.

## 2. Copy the source files

Copy these package paths into the matching paths in the repository:
- `src/server/legalRagRouter.ts`
- `src/utils/legalRagClient.ts`
- `src/components/LegalRagPanel.tsx`
- `src/i18n/legalRagTranslations.ts`

Do not replace `legalAnalysisEngine.ts`, `statutoryCatalogue.ts`, or the existing `LanguageContext`.

## 3. Mount the backend router

Use `server.integration.example.ts` as a guide. In the existing `server.ts`:
- Reuse the already-created `GoogleGenAI` instance (`ai`).
- Reuse the existing `verifySupabaseAuth`.
- Create a separate server-only Supabase client using `SUPABASE_SERVICE_ROLE_KEY` for ingestion only.
- Ensure `express.json()` is registered before the router.
- Ensure `verifySupabaseAuth` attaches the caller's JWT-scoped client as `req.userSupabase`.

Your existing repository already defines `AuthenticatedRequest` with `userSupabase`; if the middleware uses a different property name in the current branch, align the router's `AuthRequest` type and lookup to that exact property.

## 4. Add environment variables

Merge `.env.legal-rag.example` into your server environment. Do not commit real values.
`GEMINI_API_KEY` and Supabase URL can reuse existing server configuration.
Create a long random ingestion token, e.g. with a password manager. Keep it server-side.

## 5. Add the UI

Import `LegalRagPanel` into the component that renders workspace views (likely `src/App.tsx`) and add a route/tab, for example `legal_rag`.
Add a navigation item in `AppLayout.tsx`.
Use the existing `useLanguage()` provider; the panel automatically reads the selected `LanguageCode`.

## 6. Multilingual scope

The new RAG interface has static labels for all 12 languages already enumerated in `src/sampleData.ts`. The answer itself is generated in the selected language. Cross-language retrieval uses the multilingual embedding model.

This does not automatically translate every existing hard-coded label throughout the entire application. Your existing `LanguageContext` currently has English/Hindi dictionary entries and the Settings UI describes English/Hindi as the fully implemented UI languages. A true full-app 12-language UI requires migrating the remaining hard-coded strings in each component into locale dictionaries. This package does not falsely mark the entire legacy UI as translated.

## 7. Build and test

Run:
```bash
npm install
npm run lint
npm run build
```

Then test:
- English question → English answer.
- Hindi question → Hindi answer.
- Hindi question → select Bengali and verify Bengali answer.
- English question → select Tamil and verify Tamil answer.
- Unknown legal topic → no fabricated answer; insufficient-evidence response.
- Unauthenticated query → 401.
- Ingestion without correct secret → 401.
- Unverified source document → never appears in citizen retrieval.
