import { getValidAccessToken } from './authSession';

export interface LegalRagSource {
  marker: string;
  title: string;
  authority: string;
  actTitle?: string | null;
  sectionRef?: string | null;
  sourceUrl: string;
  language: string;
  similarity: number;
  excerpt: string;
}

export interface LegalRagResponse {
  success: true;
  answer: string;
  sources: LegalRagSource[];
  insufficientEvidence: boolean;
  language: string;
  modelUsed?: string;
}

export async function askLegalRag(question: string, language: string): Promise<LegalRagResponse> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) throw new Error('Enter a question first.');
  if (cleanQuestion.length > 3000) throw new Error('Question must be 3,000 characters or fewer.');

  const token = await getValidAccessToken();
  if (!token) throw new Error('Please sign in before using the legal knowledge assistant.');

  const response = await fetch('/api/legal-rag/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question: cleanQuestion, language }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Legal knowledge search failed.');
  }
  return payload as LegalRagResponse;
}
