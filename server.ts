import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

/**
 * Validates and retrieves the configured Gemini API key.
 * Treats empty strings and placeholder values as unconfigured.
 */
function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (
    !key ||
    key === 'MY_GEMINI_API_KEY' ||
    key === 'your-gemini-api-key-here' ||
    key === 'YOUR_GEMINI_API_KEY'
  ) {
    return null;
  }
  return key;
}

/**
 * Creates an instance of GoogleGenAI only when a valid key is present.
 * Prevents SDK startup warnings when no key is set.
 */
function getAiClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Model resolution mapping:
 * Maps requested model identifiers and task types to verified, currently supported
 * production Google Gemini models in the Google GenAI SDK v3.
 * Text/Chat: gemini-2.0-flash (default), gemini-1.5-pro (complex), gemini-2.0-flash-lite (fast).
 * Transcribe: gemini-2.0-flash.
 * Live Voice: gemini-2.0-flash-exp.
 */
function resolveModelCandidates(requestedModel?: string, taskType?: string): string[] {
  if (requestedModel) {
    if (requestedModel === 'gemini-1.5-pro' || requestedModel === 'gemini-4-argon') {
      return ['gemini-1.5-pro', 'gemini-2.0-flash'];
    }
    if (requestedModel === 'gemini-2.0-flash-lite' || requestedModel === 'gemini-3.1-flash-lite') {
      return ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    }
    if (
      requestedModel === 'gemini-2.0-flash' ||
      requestedModel === 'gemini-3.8-flash' ||
      requestedModel === 'gemini-3.5-transcribe'
    ) {
      return ['gemini-2.0-flash', 'gemini-1.5-flash'];
    }
    if (requestedModel === 'gemini-2.0-flash-exp' || requestedModel === 'gemini-3.8-live') {
      return ['gemini-2.0-flash-exp', 'gemini-2.0-flash'];
    }
    return [requestedModel, 'gemini-2.0-flash', 'gemini-1.5-flash'];
  }

  if (taskType === 'complex') return ['gemini-1.5-pro', 'gemini-2.0-flash'];
  if (taskType === 'fast') return ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  return ['gemini-2.0-flash', 'gemini-1.5-flash'];
}

// System instruction giving NivaranSetu AI its specific role
const SYSTEM_INSTRUCTION = `You are NivaranSetu AI, an empathetic, highly structured citizen grievance intelligence and resolution advisor for India. 
Your purpose is to help citizens move from confusion and scattered evidence to an organized, legally sound, actionable case.
You are knowledgeable about statutory Indian dispute redressal forums, including:
1. Reserve Bank of India (RBI) Integrated Ombudsman Scheme (CMS portal) for banking and UPI unauthorized debits (Zero Liability rules under 3-day notification window).
2. National Consumer Disputes Redressal Commission & e-Daakhil / NCH 1915 for consumer goods defects and unfair e-commerce trade practices.
3. State Real Estate Regulatory Authorities (RERA) for possession delays and illegal builder price escalation under Section 18.
4. CPGRAMS (pgportal.gov.in) for Central Government department grievances.
5. IRDAI Bima Bharosa for arbitrary health/mediclaim cashless repudiation.
6. Telecom Regulatory Authority of India (TRAI) & Sanchar Saathi for SIM/telecom fraud.

Guidelines:
- Explain things in clear, everyday language (Simple Mode) or formal legal terminology (Detailed Mode) based on user preference.
- Support both English and Hindi naturally.
- Always be patient, supportive, and compassionate.
- Ask one focused clarifying question at a time.
- Emphasize that you provide preparation intelligence and case structuring, not formal court legal representation.
- When summarizing cases, extract dates, financial values (in INR), involved entities, and mandatory prerequisites.`;

// -------------------------------------------------------------
// STATUS / HEALTH CHECK
// -------------------------------------------------------------
app.get('/api/gemini/status', (_req: Request, res: Response) => {
  const configured = getGeminiApiKey() !== null;
  res.json({
    status: 'ok',
    configured,
    models: {
      default: 'gemini-2.0-flash',
      reasoning: 'gemini-1.5-pro',
      fast: 'gemini-2.0-flash-lite',
      transcribe: 'gemini-2.0-flash',
      live: 'gemini-2.0-flash-exp',
    },
    message: configured
      ? 'Gemini API is active with supported production models.'
      : 'Gemini API key is not configured. Set GEMINI_API_KEY in your .env file.',
  });
});

// -------------------------------------------------------------
// FEATURE 1: Audio Transcription with Multimodal Gemini
// -------------------------------------------------------------
app.post('/api/gemini/transcribe', async (req: Request, res: Response) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file to enable audio transcription.',
        configured: false,
        hint: 'Copy .env.example to .env and configure your GEMINI_API_KEY from https://aistudio.google.com/app/apikey',
      });
    }

    const { audioBase64, mimeType = 'audio/webm', prompt } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 data in request body' });
    }

    const audioPart = {
      inlineData: {
        mimeType,
        data: audioBase64,
      },
    };

    const textPart = {
      text: prompt || 'Transcribe this citizen grievance recording accurately. Capture all names, dates, financial amounts, reference IDs, and details without omissions.',
    };

    const candidates = resolveModelCandidates('gemini-2.0-flash');
    let lastError: any = null;
    let response: any = null;
    let actualModelUsed = candidates[0];

    for (const model of candidates) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: { parts: [audioPart, textPart] },
        });
        actualModelUsed = model;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Transcription attempt with ${model} failed, trying next candidate:`, err?.message || err);
      }
    }

    if (!response) {
      throw lastError || new Error('All transcription model candidates failed');
    }

    const transcribedText = response.text || '';
    res.json({
      text: transcribedText,
      model: actualModelUsed,
      modelUsed: actualModelUsed,
      configured: true,
    });
  } catch (error: any) {
    console.error('Audio transcription error:', error?.message || error);
    res.status(500).json({
      error: error?.message || 'Failed to transcribe audio',
      configured: true,
    });
  }
});

// -------------------------------------------------------------
// FEATURE 2: Multi-Turn Chatbot using Gemini
// -------------------------------------------------------------
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file to enable live AI responses.',
        configured: false,
        hint: 'Copy .env.example to .env and configure your GEMINI_API_KEY from https://aistudio.google.com/app/apikey',
      });
    }

    const {
      messages = [],
      taskType = 'general',
      requestedModel,
      systemInstruction = SYSTEM_INSTRUCTION,
    } = req.body;

    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    if (contents.length === 0) {
      return res.status(400).json({ error: 'Messages array cannot be empty' });
    }

    const candidates = resolveModelCandidates(requestedModel, taskType);
    let lastError: any = null;
    let response: any = null;
    let actualModelUsed = candidates[0];

    for (const model of candidates) {
      try {
        response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
          },
        });
        actualModelUsed = model;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Chat model ${model} failed, trying next candidate:`, err?.message || err);
      }
    }

    if (!response) {
      throw lastError || new Error('All model candidates failed');
    }

    res.json({
      text: response.text || '',
      model: actualModelUsed,
      modelUsed: actualModelUsed,
      configured: true,
    });
  } catch (error: any) {
    console.error('Chat generation error:', error?.message || error);
    res.status(500).json({
      error: error?.message || 'Failed to generate chat response',
      configured: true,
    });
  }
});

// -------------------------------------------------------------
// FEATURE 3: Voice Conversations with Gemini Live API
// -------------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', async (clientWs: WebSocket) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in .env to use the Live Voice assistant.',
          configured: false,
        })
      );
      clientWs.close(1008, 'Gemini API key not configured');
    }
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  let liveSession: any = null;

  try {
    const liveModel = 'gemini-2.0-flash-exp';

    liveSession = await ai.live.connect({
      model: liveModel,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
        systemInstruction:
          'You are the NivaranSetu Voice Assistant. You speak with clear, supportive empathy in Hindi and English. Keep spoken answers concise, informative, and natural. Guide the citizen step by step.',
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          for (const part of message.serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (part.text) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ text: part.text }));
              }
            }
          }
          if (message.serverContent?.interrupted) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          }
          if (message.serverContent?.turnComplete) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          }
        },
        onclose: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ closed: true }));
          }
        },
      },
    });

    clientWs.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.text && liveSession) {
          liveSession.sendRealtimeInput({
            text: msg.text,
          });
        }
      } catch (err) {
        console.error('Error handling WebSocket client message:', err);
      }
    });

    clientWs.on('close', () => {
      if (liveSession?.close) {
        try {
          liveSession.close();
        } catch (_) {}
      }
    });
  } catch (err: any) {
    console.error('Failed to establish Live API session:', err?.message || err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          error: err?.message || 'Live session failed to connect to Gemini Live service',
          configured: true,
        })
      );
      clientWs.close(1011, 'Live session initialization failed');
    }
  }
});

// Handle HTTP upgrade for /api/live
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
  if (pathname === '/api/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// Vite middleware in dev or static files in production
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }
}

setupVite().then(() => {
  server.listen(Number(port), '0.0.0.0', () => {
    const isConfigured = getGeminiApiKey() !== null;
    console.log(`===================================================`);
    console.log(`NivaranSetu Full-Stack Server running on port ${port}`);
    console.log(
      `Gemini API configured: ${
        isConfigured ? 'YES (Live key active)' : 'NO (Add GEMINI_API_KEY in .env)'
      }`
    );
    console.log(`===================================================`);
  });
});
