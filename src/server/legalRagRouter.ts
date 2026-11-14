/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Router, type Request, type Response, type RequestHandler } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ThinkingLevel, type GoogleGenAI } from '@google/genai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LanguageCode } from '../types.ts';
import { VALID_LANGUAGE_CODES } from '../i18n/appTranslations.ts';

type AuthRequest = Request & { userSupabase?: SupabaseClient };

export type LegalRagDependencies = {
  ai?: GoogleGenAI | null;
  getAi?: () => GoogleGenAI | null;
  adminSupabase: SupabaseClient | null;
  verifySupabaseAuth: RequestHandler;
  ingestToken?: string;
  embeddingModel?: string;
  generationModel?: string;
  storageBucket?: string;
};

export interface ExtractedPdfResult {
  pages: string[];
  totalPages: number;
  sha256: string;
  buffer: Buffer;
}

export interface LegalChunkDraft {
  chunkIndex: number;
  pageNumber: number;
  content: string;
  sectionRef: string | null;
}

const LANGUAGES: Record<LanguageCode, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  mr: 'Marathi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  gu: 'Gujarati',
  pa: 'Punjabi',
  or: 'Odia',
  ur: 'Urdu',
};

const INSUFFICIENT_EVIDENCE_MESSAGES: Record<LanguageCode, string> = {
  en: 'I could not find a sufficiently relevant passage in the verified legal-source collection. Please try a more specific question or consult the official government or regulator source.',
  hi: 'मुझे सत्यापित कानूनी स्रोतों के संग्रह में पर्याप्त प्रासंगिक अंश नहीं मिला। कृपया अधिक स्पष्ट प्रश्न पूछें या आधिकारिक सरकारी/नियामक स्रोत देखें।',
  bn: 'যাচাইকৃত আইনি উৎসের সংগ্রহে যথেষ্ট প্রাসঙ্গিক অংশ পাওয়া যায়নি। অনুগ্রহ করে আরও নির্দিষ্ট প্রশ্ন করুন অথবা সরকারি/নিয়ামক উৎস দেখুন।',
  mr: 'सत्यापित कायदेशीर स्रोतांच्या संग्रहात पुरेसा संबंधित मजकूर सापडला नाही. कृपया अधिक नेमका प्रश्न विचारा किंवा अधिकृत सरकारी स्रोत पहा.',
  ta: 'சரிபார்க்கப்பட்ட சட்ட ஆதாரங்களின் தொகுப்பில் போதுமான தொடர்புடைய பகுதி கிடைக்கவில்லை. மேலும் குறிப்பிட்ட கேள்வியைக் கேட்கவும் அல்லது அதிகாரப்பூர்வ மூலத்தைப் பார்க்கவும்.',
  te: 'ధృవీకరించిన చట్టపరమైన మూలాల సేకరణలో తగినంత సంబంధిత భాగం కనుగొనబడలేదు. దయచేసి మరింత నిర్దిష్టమైన ప్రశ్న అడగండి లేదా అధికారిక మూలాన్ని చూడండి.',
  kn: 'ಪರಿಶೀಲಿತ ಕಾನೂನು ಮೂಲಗಳ ಸಂಗ್ರಹದಲ್ಲಿ ಸಾಕಷ್ಟು ಸಂಬಂಧಿತ ಭಾಗ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಹೆಚ್ಚು ನಿರ್ದಿಷ್ಟ ಪ್ರಶ್ನೆ ಕೇಳಿ ಅಥವಾ ಅಧಿಕೃತ ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ.',
  ml: 'പരിശോധിച്ച നിയമ സ്രോതസ്സുകളുടെ ശേഖരത്തിൽ പ്രസക്തമായ ഭാഗം കണ്ടെത്താനായില്ല. ദയവായി കൂടുതൽ വ്യക്തമായ ചോദ്യം ചോദിക്കുക അല്ലെങ്കിൽ ഔദ്യോഗിക സ്രോതസ്സ് പരിശോധിക്കുക.',
  gu: 'ચકાસેલા કાનૂની સ્ત્રોતોના સંગ્રહમાં પૂરતો સુસંગત ભાગ મળ્યો નથી. કૃપા કરીને વધુ ચોક્કસ પ્રશ્ન પૂછો અથવા સત્તાવાર સ્ત્રોત જુઓ.',
  pa: 'ਪ੍ਰਮਾਣਿਤ ਕਾਨੂੰਨੀ ਸਰੋਤਾਂ ਦੇ ਸੰਗ੍ਰਹਿ ਵਿੱਚ ਢੁਕਵਾਂ ਹਿੱਸਾ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਹੋਰ ਸਪੱਸ਼ਟ ਸਵਾਲ ਪੁੱਛੋ ਜਾਂ ਅਧਿਕਾਰਤ ਸਰੋਤ ਵੇਖੋ।',
  or: 'ଯାଞ୍ଚିତ ଆଇନ ଉତ୍ସ ସଂଗ୍ରହରେ ପର୍ଯ୍ୟାପ୍ତ ପ୍ରାସଙ୍ଗିକ ଅଂଶ ମିଳିଲା ନାହିଁ। ଦୟାକରି ଅଧିକ ନିର୍ଦ୍ଦିଷ୍ଟ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ କିମ୍ବା ସରକାରୀ ଉତ୍ସ ଦେଖନ୍ତୁ।',
  ur: 'تصدیق شدہ قانونی ذرائع کے مجموعے میں کوئی موزوں اقتباس نہیں ملا۔ براہِ کرم مزید واضح سوال پوچھیں یا سرکاری ذریعہ دیکھیں۔',
};

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MiB

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function detectSectionReference(text: string): string | null {
  if (!text || typeof text !== 'string') return null;

  const patterns: RegExp[] = [
    /\b(?:Section|Sec\.|Clause|Article|Rule|Regulation|Paragraph|Para)\s+\d+(?:\.\d+)*(?:\([0-9a-zA-Z]+\))*/i,
    /(?:धारा|अनुच्छेद|नियम|विनियम|खंड)\s+\d+(?:\.\d+)*(?:\([0-9a-zA-Z]+\))*/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      return match[0].replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

function splitSingleTextIntoChunks(text: string, maxChars = 1400, overlap = 180): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf('\n', end),
        normalized.lastIndexOf('. ', end),
        normalized.lastIndexOf('।', end),
        normalized.lastIndexOf('; ', end)
      );
      if (boundary > start + Math.floor(maxChars * 0.55)) end = boundary + 1;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export function splitPagesIntoChunks(
  pages: string[],
  maxChars = 1400,
  overlap = 180,
  defaultSectionRef: string | null = null
): LegalChunkDraft[] {
  const drafts: LegalChunkDraft[] = [];
  let chunkIndex = 0;

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageNumber = pageIdx + 1;
    const pageText = typeof pages[pageIdx] === 'string' ? pages[pageIdx] : '';
    const pageChunks = splitSingleTextIntoChunks(pageText, maxChars, overlap);
    for (const chunk of pageChunks) {
      drafts.push({
        chunkIndex: chunkIndex++,
        pageNumber,
        content: chunk,
        sectionRef: detectSectionReference(chunk) || defaultSectionRef,
      });
    }
  }

  return drafts;
}

export async function extractPdfPagesFromBase64(pdfBase64: string): Promise<ExtractedPdfResult> {
  if (typeof pdfBase64 !== 'string' || !pdfBase64.trim()) {
    throw new Error('INVALID_PDF_FORMAT: Empty PDF payload.');
  }

  const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/i, '').trim();
  const buffer = Buffer.from(cleanBase64, 'base64');

  if (buffer.length < 8 || buffer.length > MAX_PDF_BYTES) {
    throw new Error('INVALID_PDF_FORMAT: PDF file size is invalid or exceeds 20 MiB limit.');
  }

  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('INVALID_PDF_FORMAT: Uploaded payload does not carry a valid %PDF- header.');
  }

  const sha256 = createHash('sha256').update(buffer).digest('hex');

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    verbosity: 0,
  });

  let pdfDoc: any = null;
  try {
    pdfDoc = await loadingTask.promise;
    const totalPages = Number(pdfDoc.numPages || 0);
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings: string[] = [];
      for (const item of textContent.items || []) {
        if (item && typeof (item as any).str === 'string') {
          pageStrings.push((item as any).str);
          if ((item as any).hasEOL) {
            pageStrings.push('\n');
          } else {
            pageStrings.push(' ');
          }
        }
      }
      const cleaned = pageStrings.join('').replace(/\s+/g, ' ').trim();
      pages.push(cleaned);
    }

    const totalNonEmptyChars = pages.reduce((sum, p) => sum + p.trim().length, 0);
    if (totalPages === 0 || totalNonEmptyChars === 0) {
      throw new Error(
        'PDF_NO_EXTRACTABLE_TEXT: No selectable text could be extracted from this PDF. Scanned/image-only PDFs require OCR before ingestion.'
      );
    }

    return {
      pages,
      totalPages,
      sha256,
      buffer,
    };
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // Ignore cleanup failures
    }
  }
}

async function embed(ai: GoogleGenAI, model: string, text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model,
    contents: text,
    config: { outputDimensionality: 3072 },
  });
  const vector = response.embeddings?.[0]?.values;
  if (!vector || vector.length !== 3072) {
    throw new Error(
      `Embedding model returned an unexpected vector dimension (${vector?.length ?? 0}); expected 3072.`
    );
  }
  return vector;
}

function sanitizeCitations(answer: string, sourceCount: number): string {
  // Strip any [S<n>] markers where n < 1 or n > sourceCount so fabricated markers never reach the UI
  return answer
    .replace(/\[S(\d+)(?:\s*,\s*p\.?\s*\d+)?\]/gi, (full, numStr) => {
      const idx = Number(numStr);
      if (!Number.isInteger(idx) || idx < 1 || idx > sourceCount) {
        return '';
      }
      return full;
    })
    .replace(/\s+([।.,;!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function sanitizeStorageFileName(rawName: string): string {
  const base = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+/, '');
  if (!base) return 'official-source.pdf';
  return base.toLowerCase().endsWith('.pdf') ? base.slice(0, 120) : `${base.slice(0, 115)}.pdf`;
}

export function createLegalRagRouter(deps: LegalRagDependencies): Router {
  const router = Router();
  router.use(express.json({ limit: '25mb' }));
  const embeddingModel =
    deps.embeddingModel || process.env.LEGAL_RAG_EMBEDDING_MODEL || 'gemini-embedding-2';
  const generationModel =
    deps.generationModel || process.env.LEGAL_RAG_GENERATION_MODEL || 'gemini-4-hydrogen';
  const storageBucket =
    deps.storageBucket || process.env.LEGAL_RAG_STORAGE_BUCKET || 'legal-sources';

  const resolveAi = (): GoogleGenAI | null => {
    if (deps.getAi) return deps.getAi();
    return deps.ai ?? null;
  };

  router.get('/status', (_req: Request, res: Response) => {
    const activeAi = resolveAi();
    return res.status(200).json({
      status: 'ok',
      configured: Boolean(activeAi),
      ingestConfigured: Boolean(deps.adminSupabase && deps.ingestToken),
      embeddingModel,
      generationModel,
      embeddingDimension: 3072,
      storageBucket,
    });
  });

  // Ingestion is server-to-server only. It is deliberately not exposed through the citizen UI.
  router.post('/ingest', async (req: Request, res: Response) => {
    const supplied = String(req.header('x-legal-rag-token') || '');
    if (!deps.ingestToken || !supplied || !safeEqual(supplied, deps.ingestToken)) {
      return res.status(401).json({ success: false, error: 'INGEST_UNAUTHORIZED' });
    }

    if (!deps.adminSupabase) {
      return res.status(503).json({
        success: false,
        error: 'INGEST_UNCONFIGURED',
        message: 'Server-side Supabase service-role client is not configured.',
      });
    }

    const activeAi = resolveAi();
    if (!activeAi) {
      return res.status(503).json({
        success: false,
        error: 'AI_UNAVAILABLE',
        message: 'Gemini API key is not configured for embedding generation.',
      });
    }

    const body = req.body || {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
    const authority = typeof body.authority === 'string' ? body.authority.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64.trim() : '';
    const language = (typeof body.language === 'string' ? body.language : 'en') as LanguageCode;
    const defaultSectionRef =
      typeof body.sectionRef === 'string' && body.sectionRef.trim() ? body.sectionRef.trim() : null;

    if (!title || !sourceUrl || !authority || !(language in LANGUAGES)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DOCUMENT',
        message: 'title, official sourceUrl, authority, and a supported language are required.',
      });
    }

    if (!pdfBase64 && text.length < 100) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DOCUMENT',
        message: 'Provide either a valid PDF (pdfBase64) or at least 100 characters of verified official source text.',
      });
    }

    try {
      const url = new URL(sourceUrl);
      if (url.protocol !== 'https:') throw new Error('Only HTTPS source URLs are accepted.');
    } catch {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SOURCE_URL',
        message: 'Use a valid HTTPS official-source URL.',
      });
    }

    let extractedPdf: ExtractedPdfResult | null = null;
    if (pdfBase64) {
      try {
        extractedPdf = await extractPdfPagesFromBase64(pdfBase64);
      } catch (pdfErr: any) {
        const msg = String(pdfErr?.message || pdfErr);
        if (msg.includes('PDF_NO_EXTRACTABLE_TEXT')) {
          return res.status(422).json({
            success: false,
            error: 'PDF_NO_EXTRACTABLE_TEXT',
            message:
              'The uploaded PDF contains no extractable text. Scanned or image-only PDFs must undergo OCR verification before ingestion.',
          });
        }
        return res.status(400).json({
          success: false,
          error: 'INVALID_PDF_FORMAT',
          message: msg,
        });
      }
    }

    const totalPages = extractedPdf ? extractedPdf.totalPages : 1;
    const fileName = extractedPdf
      ? sanitizeStorageFileName(typeof body.fileName === 'string' ? body.fileName : `${title}.pdf`)
      : null;
    const storagePath = extractedPdf && fileName
      ? `official/${Date.now()}-${extractedPdf.sha256.slice(0, 12)}-${fileName}`
      : null;

    let storageUploaded = false;
    if (extractedPdf && storagePath && deps.adminSupabase.storage?.from) {
      const { error: uploadErr } = await deps.adminSupabase.storage
        .from(storageBucket)
        .upload(storagePath, extractedPdf.buffer, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (uploadErr) {
        return res.status(500).json({
          success: false,
          error: 'STORAGE_UPLOAD_FAILED',
          message: uploadErr.message || 'Failed to persist official PDF in private Supabase Storage.',
        });
      }
      storageUploaded = true;
    }

    const { data: doc, error: docError } = await deps.adminSupabase
      .from('legal_documents')
      .insert({
        title,
        source_url: sourceUrl,
        authority,
        act_title: typeof body.actTitle === 'string' ? body.actTitle : null,
        section_ref: defaultSectionRef,
        language,
        effective_date: typeof body.effectiveDate === 'string' ? body.effectiveDate : null,
        total_pages: totalPages,
        storage_bucket: storagePath ? storageBucket : null,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: extractedPdf ? 'application/pdf' : 'text/plain',
        file_size_bytes: extractedPdf ? extractedPdf.buffer.length : Buffer.byteLength(text, 'utf8'),
        file_sha256: extractedPdf ? extractedPdf.sha256 : null,
        source_verified: body.sourceVerified === true,
        is_active: true,
      })
      .select('id')
      .single();

    if (docError || !doc) {
      if (storageUploaded && storagePath && deps.adminSupabase.storage?.from) {
        await deps.adminSupabase.storage.from(storageBucket).remove([storagePath]).catch(() => {});
      }
      return res.status(500).json({
        success: false,
        error: 'DOCUMENT_INSERT_FAILED',
        message: docError?.message,
      });
    }

    try {
      const chunks = extractedPdf
        ? splitPagesIntoChunks(extractedPdf.pages, 1400, 180, defaultSectionRef)
        : splitPagesIntoChunks([text], 1400, 180, defaultSectionRef);

      const rows = [];
      for (const chunk of chunks) {
        const vector = await embed(activeAi, embeddingModel, chunk.content);
        rows.push({
          document_id: doc.id,
          chunk_index: chunk.chunkIndex,
          page_number: chunk.pageNumber,
          section_ref: chunk.sectionRef,
          content: chunk.content,
          language,
          embedding: JSON.stringify(vector),
        });
      }

      const { error: chunkError } = await deps.adminSupabase
        .from('legal_document_chunks')
        .insert(rows);
      if (chunkError) throw chunkError;

      return res.status(201).json({
        success: true,
        documentId: doc.id,
        chunksCreated: rows.length,
        totalPages,
        embeddingModel,
        storagePath,
        verified: body.sourceVerified === true,
      });
    } catch (error: any) {
      // Avoid leaving a visible, partially ingested document.
      await deps.adminSupabase.from('legal_documents').update({ is_active: false }).eq('id', doc.id);
      if (storageUploaded && storagePath && deps.adminSupabase.storage?.from) {
        await deps.adminSupabase.storage.from(storageBucket).remove([storagePath]).catch(() => {});
      }
      return res.status(500).json({
        success: false,
        error: 'INGESTION_FAILED',
        message: error?.message || 'Unable to create document embeddings.',
      });
    }
  });

  router.post('/query', deps.verifySupabaseAuth, async (req: AuthRequest, res: Response) => {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const rawLang = typeof req.body?.language === 'string' ? req.body.language.trim().toLowerCase() : 'en';
    if (!question || question.length > 3000 || !VALID_LANGUAGE_CODES.has(rawLang as LanguageCode)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_QUERY',
        message: 'Provide a question (max 3000 characters) and a supported language.',
      });
    }
    const language = rawLang as LanguageCode;

    if (!req.userSupabase) {
      return res.status(503).json({ success: false, error: 'USER_DATABASE_UNAVAILABLE' });
    }

    const activeAi = resolveAi();
    if (!activeAi) {
      return res.status(503).json({
        success: false,
        error: 'AI_UNAVAILABLE',
        message: 'Gemini API key is not configured for legal retrieval.',
      });
    }

    try {
      // Cross-lingual query distillation for non-English / non-ASCII questions so regional queries match English statutes accurately
      let retrievalQuery = question;
      if (language !== 'en' || /[^\x00-\x7F]/.test(question)) {
        try {
          const distilled = await activeAi.models.generateContent({
            model: generationModel,
            contents: `Translate and distill this Indian legal query into concise English legal search keywords for cross-lingual retrieval (return keywords only):\n${question}`,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });
          if (distilled?.text && distilled.text.trim()) {
            retrievalQuery = `${distilled.text.trim()} ${question}`.slice(0, 2000);
          }
        } catch {
          // Proceed with original multilingual query via multilingual embedding model
        }
      }

      const queryVector = await embed(activeAi, embeddingModel, retrievalQuery);
      const { data: matches, error: searchError } = await req.userSupabase.rpc('match_legal_chunks', {
        query_embedding: JSON.stringify(queryVector),
        match_threshold: 0.36,
        match_count: 7,
      });

      if (searchError) {
        return res.status(503).json({
          success: false,
          error: 'LEGAL_RAG_DB_ERROR',
          message: searchError.message || 'Legal vector search RPC is unavailable.',
        });
      }

      // Defense-in-depth: strictly exclude any row where source_verified is false or is_active is false
      const verifiedMatches = (matches || []).filter(
        (row: any) => row && row.source_verified !== false && row.is_active !== false
      );

      const sources = verifiedMatches.map((row: any, index: number) => ({
        marker: `S${index + 1}`,
        title: row.title,
        authority: row.authority,
        actTitle: row.act_title ?? null,
        sectionRef: row.section_ref ?? null,
        pageNumber: typeof row.page_number === 'number' ? row.page_number : 1,
        storagePath: row.storage_path ?? null,
        effectiveDate: row.effective_date ?? null,
        sourceUrl: row.source_url,
        language: row.language,
        similarity: Number(row.similarity),
        excerpt: String(row.content).slice(0, 900),
      }));

      if (!sources.length) {
        return res.json({
          success: true,
          answer: INSUFFICIENT_EVIDENCE_MESSAGES[language] || INSUFFICIENT_EVIDENCE_MESSAGES.en,
          sources: [],
          insufficientEvidence: true,
          verifiedRetrievalCount: 0,
          language,
        });
      }

      const context = sources
        .map(
          (s: any) =>
            `[${s.marker}] ${s.title} | ${s.authority} | ${s.actTitle || ''} ${s.sectionRef || ''} | Page ${s.pageNumber}\nSource: ${s.sourceUrl}\nPassage:\n${s.excerpt}`
        )
        .join('\n\n');

      const prompt = [
        `You are NivaranSetu's legal information retrieval assistant.`,
        `Answer in ${LANGUAGES[language]}. The user may ask in any language.`,
        `Use ONLY the retrieved passages below. Do not rely on unstated legal knowledge.`,
        `Cite every material legal or procedural claim using exact source markers such as [S1] (and page number where helpful, e.g. [S1, p. ${sources[0]?.pageNumber ?? 1}]).`,
        `Never invent section numbers, deadlines, rights, case outcomes, citations or URLs.`,
        `If the passages do not answer the question, clearly say what is missing and do not guess.`,
        `Distinguish the text of a provision from whether it applies to this user's facts.`,
        `Preserve official act names, section numbers and legal terms; explain them in the requested language.`,
        `Keep the answer structured and concise. End with a reminder that the output is informational, not legal advice.`,
        `\nUSER QUESTION:\n${question}\n\nRETRIEVED PASSAGES:\n${context}`,
      ].join('\n');

      const generated = await activeAi.models.generateContent({
        model: generationModel,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawAnswer = generated.text?.trim();
      if (!rawAnswer) throw new Error('The language model returned an empty answer.');

      const answer = sanitizeCitations(rawAnswer, sources.length);

      return res.json({
        success: true,
        answer,
        sources,
        insufficientEvidence: false,
        verifiedRetrievalCount: sources.length,
        language,
        modelUsed: generationModel,
      });
    } catch (error: any) {
      console.error('Legal RAG query failed:', error?.message || error);
      return res.status(502).json({
        success: false,
        error: 'LEGAL_RAG_FAILED',
        message: 'The legal knowledge assistant is temporarily unavailable. Please retry.',
      });
    }
  });

  return router;
}
