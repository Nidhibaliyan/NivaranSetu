# Legal RAG setup and ingestion

Legal RAG is an authenticated retrieval feature. It does not replace the deterministic legal-analysis engine.

## 1. Configure server secrets

Set these variables in the server/deployment environment. Do not use a `VITE_` prefix and never expose the service-role key or ingestion token in browser code.

- `GEMINI_API_KEY`: server-side Gemini key (also used by existing AI features).
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`: existing Supabase configuration.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key, server only. Required only for ingestion.
- `LEGAL_RAG_INGEST_TOKEN`: long random secret used by the protected ingestion endpoint.
- `LEGAL_RAG_EMBEDDING_MODEL`: defaults to `gemini-embedding-001`.
- `LEGAL_RAG_GENERATION_MODEL`: defaults to `gemini-2.5-flash`.

Generate a strong ingestion token locally (do not paste it into GitHub):
```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 2. Apply the database migration

Apply `supabase/migrations/20261114_legal_rag.sql` to the same Supabase project used by the app. It enables pgvector, creates document/chunk tables, adds row-level security, and defines `match_legal_chunks`.

The migration is not applied merely because the SQL file exists in GitHub. Confirm it succeeded in the Supabase SQL Editor before querying.

## 3. Ingest official legal text

The endpoint is server-to-server only:

`POST /api/legal-rag/ingest`

Required header: `x-legal-rag-token: <LEGAL_RAG_INGEST_TOKEN>`

Example:
```bash
curl -X POST "$APP_URL/api/legal-rag/ingest" \
  -H "Content-Type: application/json" \
  -H "x-legal-rag-token: $LEGAL_RAG_INGEST_TOKEN" \
  --data-binary @legal-document.json
```

Example JSON file:
```json
{
  "title": "Consumer Protection Act, 2019 — Section 2",
  "sourceUrl": "https://www.indiacode.nic.in/",
  "authority": "Government of India — India Code",
  "actTitle": "Consumer Protection Act, 2019",
  "sectionRef": "Section 2",
  "language": "en",
  "effectiveDate": "2020-07-20",
  "verifiedBy": "Admin reviewer",
  "verificationNote": "Compared section text and amendment status against the official India Code publication.",
  "text": "Paste the exact, checked text of the relevant provision here."
}
```

The ingestion request must include the reviewer identity and a verification note. The server stores a SHA-256 hash of the submitted source text and records the reviewer and timestamp after successful embedding. The supplied URL must use HTTPS and an approved Indian government/regulator domain (`.gov.in`, `.nic.in`, or the explicit regulator allowlist in the router). The text must be taken from that exact official source. Keep one document/section per ingestion request and preserve section references. The server creates embeddings, stores chunks, and marks the document verified only after every chunk is stored successfully. Failed ingestion is rolled back.

**Important:** domain validation does not prove that the pasted text matches the linked page. A human administrator must verify the document text, title, effective date, amendment status and section before ingestion. Never ingest blogs, summaries, generated text, or unverified translations as authoritative law.

The ingestion endpoint accepts up to 5 MB per request. Split larger acts into separate section-level documents.

## 4. Test the citizen query flow

1. Sign in to NivaranSetu.
2. Open **Legal Knowledge Assistant**.
3. Ask a question about a section that has actually been ingested.
4. Confirm the answer is in the selected app language.
5. Open each source link and verify that the quoted excerpt and section reference match the official source.
6. Ask an unrelated question. The assistant should abstain when no sufficiently relevant verified passage is retrieved.

The query endpoint is `POST /api/legal-rag/query` and requires the existing Supabase bearer session. Retrieval is scoped through the caller's RLS-protected Supabase client.

## 5. Multilingual behavior

The panel uses the app's existing 12-language selector: English, Hindi, Bengali, Marathi, Tamil, Telugu, Kannada, Malayalam, Gujarati, Punjabi, Odia and Urdu. Query embeddings support cross-language semantic retrieval; the answer prompt requests the selected language. The UI and insufficient-evidence response are localized. The retrieved legal text remains in its source language and source links always point to the original authority.

Translations must not be treated as official statutory text unless the cited authority itself publishes that translation. Preserve official act names and section numbers in answers.

## 6. Operational limitations

- No legal corpus is bundled or automatically scraped. The database must be populated with verified official text before meaningful answers can be returned.
- Keep the service-role key and ingestion token server-side.
- Re-ingest amended provisions as new, reviewed versions; deactivate superseded documents through an admin-only maintenance process.
- This feature provides legal information, not legal advice or a guarantee that a provision applies to a particular case.
