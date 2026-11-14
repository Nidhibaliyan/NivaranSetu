// Add imports near the top of your existing server.ts:
import { createClient } from '@supabase/supabase-js';
import { createLegalRagRouter } from './src/server/legalRagRouter';

// After the existing app, Gemini client, and verifySupabaseAuth middleware are initialized:
const legalRagAdminSupabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.LEGAL_RAG_INGEST_TOKEN) {
  console.warn('Legal RAG ingestion is disabled until server-only credentials are configured.');
}

// `ai` should be the existing GoogleGenAI instance initialized with GEMINI_API_KEY.
app.use('/api/legal-rag', createLegalRagRouter({
  ai,
  adminSupabase: legalRagAdminSupabase,
  verifySupabaseAuth,
  ingestToken: process.env.LEGAL_RAG_INGEST_TOKEN || '',
}));

// IMPORTANT:
// - Do not mount this before express.json() middleware.
// - Do not expose service-role or ingestion secrets to Vite/client variables.
// - Your verifySupabaseAuth middleware must attach a JWT-scoped Supabase client
//   to req.userSupabase (the existing repository's AuthenticatedRequest contract).
