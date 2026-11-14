import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getSpeechLocale, getLanguageMeta } from '../i18n/appTranslations';
import {
  MessageSquare,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sparkles,
  ArrowRight,
  Radio,
  PhoneCall,
  PhoneOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileAudio,
  RotateCcw,
  Globe,
  ExternalLink
} from 'lucide-react';
import type { GroundingSource } from '../types';
import {
  MicrophoneRecorder,
  floatTo16BitPCM,
  pcmToBase64,
  decode24kPCMToAudioBuffer,
  audioFileToBase64,
  createSampleAudioBase64
} from '../utils/audioUtils';
import {
  CHAT_CLIENT_TIMEOUT_MS,
  TRANSCRIBE_CLIENT_TIMEOUT_MS,
  AuthSessionError,
  authenticatedFetchWithTimeout,
  boundConversationHistory,
  extractAiErrorFromResponse,
  formatAiErrorMessage,
} from '../utils/aiClientUtils';

interface GlobalAssistantProps {
  onNavigateToTab?: (tab: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  timestamp: string;
  modelUsed?: string;
  searchGrounded?: boolean;
  groundingSources?: GroundingSource[];
  quickAction?: {
    label: string;
    tab: string;
  };
}

type ModelType = 'gemini-4-hydrogen' | 'gemini-4-argon' | 'gemini-3.1-flash-lite';

export const GlobalAssistant: React.FC<GlobalAssistantProps> = ({ onNavigateToTab }) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Model selection state
  // gemini-4-hydrogen for general tasks, gemini-4-argon for complex legal tasks, gemini-3.1-flash-lite for fast tasks
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-4-hydrogen');
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(true);

  // Audio transcription with gemini-3.5-transcribe
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionNotice, setTranscriptionNotice] = useState<string | null>(null);
  const [micBlocked, setMicBlocked] = useState(false);
  const micRecorderRef = useRef<MicrophoneRecorder | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  // Live Voice Conversation state with gemini-live-2.5-flash-preview
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>('Connecting...');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [liveAgentSpeaking, setLiveAgentSpeaking] = useState(false);

  const liveWsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const currentSessionIdRef = useRef<number>(0);
  const lastServerErrorRef = useRef<string | null>(null);

  // TTS read-aloud state
  const [ttsActive, setTtsActive] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-initial',
      sender: 'assistant',
      text: "Hello! I'm your NivaranSetu assistant. Tell me what happened in your own words. I'll help you understand what to do next.",
      timestamp: 'Just now',
      modelUsed: 'gemini-4-hydrogen',
    },
  ]);

  // Suggested prompts
  const suggestedPrompts = [
    { label: 'UPI unauthorized debit', prompt: 'I had an unauthorized UPI transaction of ₹12,500 debited from my bank. What are my rights under RBI rules?', targetTab: 'builder' },
    { label: 'E-commerce refund refused', prompt: 'A seller on an e-commerce platform delivered a counterfeit product and refused a refund. How can I file on e-Daakhil?', targetTab: 'builder' },
    { label: 'Explain builder notice', prompt: 'My builder sent a notice demanding additional escalation charges after 2 years delay. Can you explain RERA section 18 in plain terms?', targetTab: 'simplifier' },
    { label: 'Insurance claim rejected', prompt: 'My cashless hospital mediclaim was rejected without valid reason. Where should I complain to IRDAI?', targetTab: 'navigator' },
  ];

  // Auto-scroll chat
  useEffect(() => {
    if (isOpen && !isLiveMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLiveMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupLiveSession();
      if (micRecorderRef.current) {
        micRecorderRef.current.cancel();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Browser speech recognition ref
  const browserRecognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      const speechLocale = getSpeechLocale(language);
      const langMeta = getLanguageMeta(language);
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLocale;

      recognition.onstart = () => {
        setIsTranscribing(true);
        setTranscriptionNotice(
          `Listening (${langMeta.nativeLabel} · ${speechLocale}). Speak your question...`
        );
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInputMessage((prev) => (prev ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim()));
        }
      };

      recognition.onerror = (event: any) => {
        setIsTranscribing(false);
        const errCode = event?.error || 'unknown';
        if (errCode === 'language-not-supported') {
          setTranscriptionNotice(
            `Browser speech recognition does not support ${langMeta.label} (${speechLocale}) in this browser. Upload audio or type directly to transcribe via Gemini.`
          );
        } else if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          setMicBlocked(true);
          setTranscriptionNotice(
            'Microphone access is blocked by your browser. You can upload an audio file (.mp3/.wav/.m4a) or type your grievance.'
          );
        } else if (errCode !== 'aborted') {
          setTranscriptionNotice(
            `Voice recognition stopped (${errCode}). Try speaking again or upload audio.`
          );
        }
      };

      recognition.onend = () => {
        setIsTranscribing(false);
      };

      browserRecognitionRef.current = recognition;
    } else {
      browserRecognitionRef.current = null;
    }
  }, [language]);

  const handleToggleVoiceInput = () => {
    const speechLocale = getSpeechLocale(language);
    if (isTranscribing) {
      if (browserRecognitionRef.current) {
        try {
          browserRecognitionRef.current.stop();
        } catch {}
      } else {
        stopTranscriptionRecording();
      }
      setIsTranscribing(false);
      setTranscriptionNotice('Voice captured. You can review and edit your question before sending.');
      setTimeout(() => setTranscriptionNotice(null), 3500);
    } else {
      if (browserRecognitionRef.current) {
        try {
          browserRecognitionRef.current.lang = speechLocale;
          browserRecognitionRef.current.start();
          setIsTranscribing(true);
        } catch {
          startTranscriptionRecording();
        }
      } else {
        startTranscriptionRecording();
      }
    }
  };

  // --------------------------------------------------------------------------
  // FEATURE 1: Audio Transcription with gemini-3.5-transcribe
  // --------------------------------------------------------------------------
  const startTranscriptionRecording = async () => {
    try {
      if (!micRecorderRef.current) {
        micRecorderRef.current = new MicrophoneRecorder();
      }
      await micRecorderRef.current.start();
      setIsTranscribing(true);
      setMicBlocked(false);
      setTranscriptionNotice('Listening... Speak your grievance in Hindi or English.');
    } catch (err: any) {
      // Graceful handling when mic permission is blocked or denied
      console.warn('Microphone permission status:', err?.name || err?.message || 'Access not granted');
      setMicBlocked(true);
      setTranscriptionNotice(
        'Microphone access is blocked by your browser. You can upload an audio file (.mp3/.wav/.m4a) or test a sample recording.'
      );
      setTimeout(() => setTranscriptionNotice(null), 8000);
    }
  };

  const stopTranscriptionRecording = async () => {
    if (!micRecorderRef.current || !isTranscribing) return;
    setIsTranscribing(false);
    setTranscriptionNotice('Transcribing audio with Gemini 2.0 Flash...');

    try {
      const { base64, mimeType } = await micRecorderRef.current.stop();

      const response = await authenticatedFetchWithTimeout(
        '/api/gemini/transcribe',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64,
            mimeType,
            language,
            prompt:
              language === 'hi'
                ? 'इस नागरिक शिकायत रिकॉर्डिंग को सटीक रूप से ट्रांसक्राइब करें।'
                : `Transcribe this citizen grievance recording accurately in ${getLanguageMeta(language).label} (${language}) with all transaction values and dates.`,
          }),
        },
        TRANSCRIBE_CLIENT_TIMEOUT_MS
      );

      if (!response.ok) {
        const errMsg = await extractAiErrorFromResponse(response, 'Failed to transcribe');
        throw new Error(errMsg);
      }

      const data = await response.json();

      if (data.text) {
        setInputMessage((prev) => (prev ? `${prev} ${data.text}` : data.text));
        setTranscriptionNotice('Transcribed successfully via gemini-3.5-transcribe');
        setTimeout(() => setTranscriptionNotice(null), 3000);
      } else {
        throw new Error(data.message || data.error || 'Failed to transcribe');
      }
    } catch (err: any) {
      console.warn('Transcription error:', err?.message || err);
      const errorMsg = formatAiErrorMessage(
        err,
        'Could not transcribe audio. Please try typing or uploading an audio file.'
      );
      setTranscriptionNotice(errorMsg);
      setTimeout(() => setTranscriptionNotice(null), 4000);
    }
  };

  // Upload an audio file (.mp3, .wav, .m4a, .webm) and transcribe with gemini-3.5-transcribe
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTranscriptionNotice(`Transcribing "${file.name}" with gemini-3.5-transcribe...`);
    try {
      const { base64, mimeType } = await audioFileToBase64(file);
      const response = await authenticatedFetchWithTimeout(
        '/api/gemini/transcribe',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64,
            mimeType,
            language,
            prompt:
              language === 'hi'
                ? 'इस नागरिक शिकायत रिकॉर्डिंग को सटीक रूप से ट्रांसक्राइब करें।'
                : `Transcribe this citizen grievance audio accurately in ${getLanguageMeta(language).label} (${language}) with all transaction numbers, dates, and amounts.`,
          }),
        },
        TRANSCRIBE_CLIENT_TIMEOUT_MS
      );

      if (!response.ok) {
        const errMsg = await extractAiErrorFromResponse(response, 'Transcription failed');
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (data.text) {
        setInputMessage((prev) => (prev ? `${prev} ${data.text}` : data.text));
        setTranscriptionNotice('Audio file transcribed successfully with gemini-3.5-transcribe!');
        setTimeout(() => setTranscriptionNotice(null), 3500);
      } else {
        throw new Error(data.message || data.error || 'Transcription failed');
      }
    } catch (err: any) {
      console.warn('Audio file transcription error:', err?.message || err);
      const errorMsg = formatAiErrorMessage(
        err,
        'Could not transcribe audio file. Please try another audio file.'
      );
      setTranscriptionNotice(errorMsg);
      setTimeout(() => setTranscriptionNotice(null), 4000);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Transcribe sample audio grievance directly
  const handleSampleAudioTranscription = async () => {
    setTranscriptionNotice('Transcribing sample grievance recording with gemini-3.5-transcribe...');
    try {
      const sampleBase64 = createSampleAudioBase64();
      const response = await authenticatedFetchWithTimeout(
        '/api/gemini/transcribe',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: sampleBase64,
            mimeType: 'audio/wav',
            prompt: 'Transcribe this citizen grievance recording: "On 28th October, I received an SMS about power bill disconnection. I installed an app to check my bill and immediately three unauthorized UPI transactions totaling ₹42,500 were debited without my consent."',
          }),
        },
        TRANSCRIBE_CLIENT_TIMEOUT_MS
      );

      if (!response.ok) {
        const errMsg = await extractAiErrorFromResponse(
          response,
          `Server responded with HTTP ${response.status}`
        );
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (!data.text) {
        throw new Error('No transcription returned');
      }
      const transcribedText = data.text;
      setInputMessage((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
      setTranscriptionNotice('Sample voice transcribed successfully via gemini-3.5-transcribe!');
      setTimeout(() => setTranscriptionNotice(null), 3500);
    } catch (err: any) {
      console.warn('Sample transcription notice:', err?.message || err);
      const fallbackText = 'On 28th October, I received an SMS regarding electricity disconnection. I was defrauded of ₹42,500 via three unauthorized UPI transactions.';
      setInputMessage((prev) => (prev ? `${prev} ${fallbackText}` : fallbackText));
      const failureReason = err?.name === 'TimeoutError' ? 'request timed out' : (err?.message || 'offline');
      setTranscriptionNotice(
        `Live transcription unavailable (${failureReason}). Loaded offline sample template instead.`
      );
      setTimeout(() => setTranscriptionNotice(null), 5000);
    }
  };

  // --------------------------------------------------------------------------
  // FEATURE 2: Multi-turn Chatbot with Gemini (gemini-3.8-flash / gemini-4-argon / gemini-3.5-flash-lite)
  // --------------------------------------------------------------------------
  const handleSendMessage = async (customText?: string, targetTab?: string) => {
    const text = (customText || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Bound conversation history to at most 40 valid turns (backend limit is 50),
      // filtering out error notification cards so they are never passed to Gemini as model turns
      const chatHistory = boundConversationHistory(updatedMessages, 40);
      if (chatHistory.length === 0) {
        return;
      }

      const effectiveUseSearch = useSearchGrounding && selectedModel === 'gemini-4-hydrogen';

      const res = await authenticatedFetchWithTimeout(
        '/api/gemini/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatHistory,
            requestedModel: selectedModel,
            useSearchGrounding: effectiveUseSearch,
            language,
            taskType:
              selectedModel === 'gemini-4-argon'
                ? 'complex'
                : selectedModel === 'gemini-3.1-flash-lite'
                ? 'fast'
                : 'general',
          }),
        },
        CHAT_CLIENT_TIMEOUT_MS
      );

      if (!res.ok) {
        const errMsg = await extractAiErrorFromResponse(res, 'Failed to generate response');
        throw new Error(errMsg);
      }

      const data = await res.json();

      let quickAction = undefined;
      const lowerReply = (data.text || '').toLowerCase();
      if (targetTab) {
        quickAction = {
          label: `Open ${targetTab === 'builder' ? 'Case Builder' : targetTab === 'simplifier' ? 'Legal Simplifier' : 'Navigator'}`,
          tab: targetTab,
        };
      } else if (lowerReply.includes('builder') || lowerReply.includes('create a case')) {
        quickAction = { label: 'Open Smart Case Builder', tab: 'builder' };
      } else if (lowerReply.includes('simplifier') || lowerReply.includes('notice') || lowerReply.includes('section 18')) {
        quickAction = { label: 'Open Legal Simplifier', tab: 'simplifier' };
      } else if (lowerReply.includes('navigator') || lowerReply.includes('ombudsman') || lowerReply.includes('e-daakhil')) {
        quickAction = { label: 'Explore Resolution Navigator', tab: 'navigator' };
      }

      const groundingSources: GroundingSource[] = Array.isArray(data.groundingSources)
        ? data.groundingSources.filter(
            (s: any): s is GroundingSource => Boolean(s && typeof s.uri === 'string' && s.uri.trim())
          )
        : [];

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.modelUsed || selectedModel,
        searchGrounded: Boolean(data.searchGrounded || groundingSources.length > 0),
        groundingSources,
        quickAction,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('Chat request notice:', err?.message || err);
      const friendlyError = formatAiErrorMessage(err, 'Failed to generate response');
      const errorMsg: ChatMessage = {
        id: `ast-err-${Date.now()}`,
        sender: 'assistant',
        text: `I encountered an issue connecting to Gemini: ${friendlyError}. Please verify your network and retry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // FEATURE 3: Voice Conversations with Gemini Live API (gemini-live-2.5-flash-preview)
  // --------------------------------------------------------------------------
  /**
   * Idempotently tears down audio hardware, microphone media stream tracks,
   * ScriptProcessorNode listeners, and AudioContext instances (DEF-01).
   */
  const teardownAudioHardware = () => {
    // 1. Disconnect ScriptProcessorNode and clear processor listener
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.onaudioprocess = null;
        scriptProcessorRef.current.disconnect();
      } catch (_) {}
      scriptProcessorRef.current = null;
    }

    // 2. Stop all microphone MediaStream tracks
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (_) {}
        });
      } catch (_) {}
      audioStreamRef.current = null;
    }

    // 3. Stop and disconnect all active playback source nodes
    if (activeSourceNodesRef.current.length > 0) {
      activeSourceNodesRef.current.forEach((node) => {
        try {
          node.onended = null;
          node.stop();
          node.disconnect();
        } catch (_) {}
      });
      activeSourceNodesRef.current = [];
    }

    // 4. Safely close AudioContexts if open
    if (inputAudioCtxRef.current) {
      try {
        if (inputAudioCtxRef.current.state !== 'closed') {
          inputAudioCtxRef.current.close().catch(() => {});
        }
      } catch (_) {}
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      try {
        if (outputAudioCtxRef.current.state !== 'closed') {
          outputAudioCtxRef.current.close().catch(() => {});
        }
      } catch (_) {}
      outputAudioCtxRef.current = null;
    }
  };

  const startLiveVoiceSession = async () => {
    // Generate unique session id to guard against stale callbacks from past sessions
    const sessionId = ++currentSessionIdRef.current;
    lastServerErrorRef.current = null;

    // Clean up any existing connection or audio hardware before starting new session
    teardownAudioHardware();
    if (liveWsRef.current) {
      try {
        const prevWs = liveWsRef.current;
        liveWsRef.current = null;
        prevWs.onopen = null;
        prevWs.onmessage = null;
        prevWs.onerror = null;
        prevWs.onclose = null;
        if (prevWs.readyState === WebSocket.OPEN || prevWs.readyState === WebSocket.CONNECTING) {
          prevWs.close();
        }
      } catch (_) {}
    }

    setIsLiveMode(true);
    setLiveStatus('Connecting to Gemini Live Voice API...');
    setLiveTranscript('');
    setLiveAgentSpeaking(false);
    setMicBlocked(false);

    try {
      // 1. Obtain a short-lived, single-use Live Voice connection ticket via authenticated HTTP endpoint
      const ticketRes = await authenticatedFetchWithTimeout(
        '/api/live/ticket',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        10000
      );

      if (currentSessionIdRef.current !== sessionId) return;

      if (!ticketRes.ok) {
        const authErrMsg = await extractAiErrorFromResponse(
          ticketRes,
          'Unable to authorize Live Voice session. Please sign in again.'
        );
        setLiveStatus(authErrMsg);
        setIsLiveConnected(false);
        setLiveAgentSpeaking(false);
        return;
      }

      const ticketData = await ticketRes.json().catch(() => null);
      const ticket = typeof ticketData?.ticket === 'string' ? ticketData.ticket.trim() : '';
      if (!ticket) {
        setLiveStatus('Live Voice authorization ticket missing. Please retry or sign in again.');
        setIsLiveConnected(false);
        setLiveAgentSpeaking(false);
        return;
      }

      // 2. Establish WebSocket connection to backend live bridge using single-use opaque ticket (no JWT in URL)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live?ticket=${encodeURIComponent(ticket)}`;
      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;

      // 2. Setup AudioContexts (16kHz for input capture, 24kHz for model output playback)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });

      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;
      activeSourceNodesRef.current = [];

      // 3. Capture user microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Guard: If session was cancelled while awaiting getUserMedia
      if (currentSessionIdRef.current !== sessionId) {
        stream.getTracks().forEach((track) => track.stop());
        inputCtx.close().catch(() => {});
        outputCtx.close().catch(() => {});
        return;
      }

      audioStreamRef.current = stream;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (currentSessionIdRef.current !== sessionId) return;
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = floatTo16BitPCM(inputData);
          const base64Audio = pcmToBase64(pcm16);
          ws.send(JSON.stringify({ audio: base64Audio }));
        }
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);

      ws.onopen = () => {
        if (currentSessionIdRef.current !== sessionId) return;
        setIsLiveConnected(true);
        setLiveStatus('Connected. Speak freely in Hindi or English.');
      };

      ws.onmessage = (event) => {
        if (currentSessionIdRef.current !== sessionId) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.error) {
            // Preserve server-provided error notice (e.g. 5-min timeout or capacity limit)
            lastServerErrorRef.current = msg.error;
            setLiveStatus(msg.error);
            if (msg.closed) {
              teardownAudioHardware();
            }
            return;
          }

          if (msg.interrupted) {
            activeSourceNodesRef.current.forEach((node) => {
              try { node.stop(); } catch (_) {}
            });
            activeSourceNodesRef.current = [];
            if (outputAudioCtxRef.current) {
              nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
            }
            setLiveAgentSpeaking(false);
          }

          if (msg.text) {
            setLiveTranscript((prev) => (prev ? `${prev} ${msg.text}` : msg.text));
          }

          if (msg.audio && outputAudioCtxRef.current) {
            setLiveAgentSpeaking(true);
            const ctx = outputAudioCtxRef.current;
            const audioBuffer = decode24kPCMToAudioBuffer(ctx, msg.audio);

            const sourceNode = ctx.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(ctx.destination);

            const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
            sourceNode.start(startTime);
            nextStartTimeRef.current = startTime + audioBuffer.duration;

            activeSourceNodesRef.current.push(sourceNode);

            sourceNode.onended = () => {
              activeSourceNodesRef.current = activeSourceNodesRef.current.filter((n) => n !== sourceNode);
              if (activeSourceNodesRef.current.length === 0) {
                setLiveAgentSpeaking(false);
              }
            };
          }
        } catch (parseErr) {
          console.warn('Live message parse warning:', parseErr);
        }
      };

      ws.onerror = (e) => {
        if (currentSessionIdRef.current !== sessionId) return;
        console.warn('Live WebSocket status notice:', e);
        if (!lastServerErrorRef.current) {
          setLiveStatus('Live connection interrupted.');
        }
      };

      ws.onclose = (event) => {
        if (currentSessionIdRef.current !== sessionId) return;

        // Ensure audio hardware is cleanly stopped on disconnect
        teardownAudioHardware();
        setIsLiveConnected(false);
        setLiveAgentSpeaking(false);
        liveWsRef.current = null;

        // Preserve server-sent notice (e.g., 5-min timeout) without overwriting with generic message
        if (lastServerErrorRef.current) {
          setLiveStatus(lastServerErrorRef.current);
        } else if (event.reason) {
          setLiveStatus(`Live conversation ended: ${event.reason}`);
        } else {
          setLiveStatus('Live conversation disconnected.');
        }
      };
    } catch (err: any) {
      if (currentSessionIdRef.current !== sessionId) return;
      console.warn('Live voice session initialization notice:', err?.name || err?.message || 'Access denied');
      teardownAudioHardware();
      const isAuthFailure =
        err instanceof AuthSessionError ||
        err?.code === 'AUTH_REQUIRED' ||
        err?.code === 'SESSION_EXPIRED' ||
        err?.status === 401;
      const isMicPermissionError =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.name === 'NotFoundError' ||
        err?.name === 'NotReadableError' ||
        String(err?.message || '').toLowerCase().includes('microphone') ||
        String(err?.message || '').toLowerCase().includes('permission');

      if (isAuthFailure) {
        setMicBlocked(false);
        setLiveStatus(err?.message || 'Your session has expired. Please sign in again to use Live Voice.');
      } else if (isMicPermissionError) {
        setMicBlocked(true);
        setLiveStatus(
          'Microphone permission is blocked by your browser. Please allow microphone access in your browser settings (click lock icon in address bar) to talk live.'
        );
      } else {
        setMicBlocked(false);
        setLiveStatus(formatAiErrorMessage(err, 'Unable to start Live Voice conversation right now.'));
      }
      if (liveWsRef.current) {
        try { liveWsRef.current.close(); } catch (_) {}
        liveWsRef.current = null;
      }
      setIsLiveConnected(false);
      setLiveAgentSpeaking(false);
    }
  };

  /**
   * Cleans up live voice session idempotently (DEF-01).
   * Safe to call multiple times or when no session is active.
   */
  const cleanupLiveSession = (statusMessage?: string) => {
    // Invalidate session sequence so superseded WebSocket callbacks are dropped
    currentSessionIdRef.current++;

    // 1. Release all audio hardware and AudioContexts idempotently
    teardownAudioHardware();

    // 2. Close WebSocket safely if still active
    if (liveWsRef.current) {
      try {
        const ws = liveWsRef.current;
        liveWsRef.current = null;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'Session ended');
        }
      } catch (_) {}
    }

    // 3. Update React states
    setIsLiveMode(false);
    setIsLiveConnected(false);
    setLiveAgentSpeaking(false);
    if (statusMessage) {
      setLiveStatus(statusMessage);
    }
  };

  // Text to speech playback
  const speakMessage = (text: string, msgId: string) => {
    if (!('speechSynthesis' in window)) return;

    if (ttsActive === msgId) {
      window.speechSynthesis.cancel();
      setTtsActive(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLocale(language);
    utterance.onend = () => setTtsActive(null);
    utterance.onerror = () => setTtsActive(null);

    setTtsActive(msgId);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <>
      {/* Hidden file input for transcribing audio files */}
      <input
        type="file"
        ref={audioFileInputRef}
        onChange={handleAudioFileUpload}
        accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
        className="hidden"
      />

      {/* 1. FLOATING BUTTON AT BOTTOM-RIGHT */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#007FFF] hover:bg-[#0070e0] text-white shadow-xl shadow-[#007FFF]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer font-semibold text-xs tracking-wide group"
          title="Open NivaranSetu AI Assistant"
        >
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
          </div>
          <span>Need help? Ask AI</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
        </button>
      )}

      {/* 2. CHAT PANEL OVERLAY */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'w-[92vw] sm:w-[580px] h-[82vh] max-h-[720px]'
              : 'w-[92vw] sm:w-[420px] h-[580px]'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#007FFF] to-[#0055b3] flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white leading-tight">
                    NivaranSetu Intelligence
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#007FFF]/10 text-[#007FFF] font-medium border border-[#007FFF]/20">
                    Live
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Grievance & Legal Redressal AI
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-zinc-400">
              {/* Live Voice mode toggle */}
              {!isLiveMode ? (
                <button
                  onClick={startLiveVoiceSession}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#007FFF]/10 hover:bg-[#007FFF]/20 text-[#007FFF] font-semibold text-[11px] transition-colors cursor-pointer border border-[#007FFF]/20"
                  title="Start Real-time Voice Call with Gemini Live API (gemini-live-2.5-flash-preview)"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Voice Call</span>
                </button>
              ) : (
                <button
                  onClick={() => cleanupLiveSession('Live conversation ended by user.')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold text-[11px] transition-colors cursor-pointer border border-red-500/20"
                  title="End voice conversation"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>End Call</span>
                </button>
              )}

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  cleanupLiveSession('Live conversation ended.');
                  setIsOpen(false);
                }}
                className="p-1.5 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Model Selection Toolbar */}
          {!isLiveMode && (
            <div className="px-3 py-1.5 bg-zinc-100/60 dark:bg-zinc-900/40 border-b border-zinc-200/60 dark:border-zinc-800/60 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedModel('gemini-4-hydrogen')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    selectedModel === 'gemini-4-hydrogen'
                      ? 'bg-[#007FFF] text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                  title="gemini-4-hydrogen: Primary standard for general grievance analysis"
                >
                  General (4 Hydrogen)
                </button>
                <button
                  onClick={() => {
                    setSelectedModel('gemini-4-argon');
                    setUseSearchGrounding(false);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    selectedModel === 'gemini-4-argon'
                      ? 'bg-[#007FFF] text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                  title="gemini-4-argon: Deep statutory reasoning & complex legal disputes (Paid key)"
                >
                  Complex (4 Argon)
                </button>
                <button
                  onClick={() => {
                    setSelectedModel('gemini-3.1-flash-lite');
                    setUseSearchGrounding(false);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    selectedModel === 'gemini-3.1-flash-lite'
                      ? 'bg-[#007FFF] text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                  title="gemini-3.1-flash-lite: Low-latency fast responses"
                >
                  Fast (3.1 Lite)
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !useSearchGrounding;
                  setUseSearchGrounding(next);
                  if (next) {
                    setSelectedModel('gemini-4-hydrogen');
                  }
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                  useSearchGrounding && selectedModel === 'gemini-4-hydrogen'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
                title="Ground answers with live Google Search via gemini-4-hydrogen"
              >
                <Globe className="w-3 h-3" />
                <span>Search Grounding</span>
              </button>
            </div>
          )}

          {/* VIEW A: REAL-TIME LIVE VOICE MODE (gemini-3.8-live) */}
          {isLiveMode ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-zinc-50 via-white to-zinc-50 dark:from-zinc-900/40 dark:via-[#18181B] dark:to-zinc-900/60">
              {/* Animated Wave / Status Circle */}
              <div className="relative mb-6">
                <div
                  className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
                    liveAgentSpeaking
                      ? 'bg-[#007FFF]/20 border-2 border-[#007FFF] scale-110 shadow-lg shadow-[#007FFF]/30'
                      : isLiveConnected
                      ? 'bg-emerald-500/10 border-2 border-emerald-500/50'
                      : micBlocked
                      ? 'bg-amber-500/10 border-2 border-amber-500/50'
                      : 'bg-zinc-200 dark:bg-zinc-800'
                  }`}
                >
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                      liveAgentSpeaking
                        ? 'bg-[#007FFF] text-white animate-pulse'
                        : isLiveConnected
                        ? 'bg-emerald-500 text-white'
                        : micBlocked
                        ? 'bg-amber-500 text-white'
                        : 'bg-zinc-400 text-white'
                    }`}
                  >
                    <Radio className="w-8 h-8" />
                  </div>
                </div>

                {liveAgentSpeaking && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#007FFF] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-[#007FFF]"></span>
                  </span>
                )}
              </div>

              <div className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
                {liveAgentSpeaking
                  ? 'Gemini 3.8 Live Speaking...'
                  : isLiveConnected
                  ? 'Listening to You...'
                  : micBlocked
                  ? 'Microphone Permission Blocked'
                  : 'Connecting...'}
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mb-4 leading-relaxed">
                {liveStatus}
              </p>

              {/* If microphone permission is blocked in browser */}
              {micBlocked && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-left text-xs text-amber-800 dark:text-amber-300 max-w-sm">
                  <div className="font-semibold mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>How to enable microphone:</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-amber-700 dark:text-amber-300/90">
                    <li>Click the lock or site settings icon in your browser address bar.</li>
                    <li>Toggle <strong>Microphone</strong> to <strong>Allow</strong>.</li>
                    <li>Click Retry or switch to text chat / audio file upload.</li>
                  </ol>
                </div>
              )}

              {/* Live Transcript / Dialogue Feedback */}
              <div className="w-full max-h-36 overflow-y-auto p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-left text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 shadow-inner">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#007FFF] mb-1 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>Real-time Audio Stream</span>
                </div>
                {liveTranscript || (micBlocked ? 'Microphone blocked. You can return to chat and type or upload audio.' : 'Start speaking in Hindi or English. The assistant responds naturally in real time.')}
              </div>

              <div className="mt-5 flex items-center gap-2.5">
                {micBlocked && (
                  <button
                    onClick={startLiveVoiceSession}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Mic</span>
                  </button>
                )}
                <button
                  onClick={() => cleanupLiveSession('Live conversation ended.')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>Return to Chat</span>
                </button>
              </div>

              <div className="mt-3 text-[10px] text-zinc-400 font-mono">
                Powered by gemini-live-2.5-flash-preview • 16kHz PCM duplex stream
              </div>
            </div>
          ) : (
            /* VIEW B: MULTI-TURN CHAT INTERFACE WITH SCROLLABLE THREAD */
            <>
              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3.5 rounded-2xl leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-[#007FFF] text-white rounded-br-xs shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 rounded-bl-xs border border-zinc-200 dark:border-zinc-700/60 shadow-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.text}</div>

                      {/* Grounded Google Search Sources */}
                      {m.sender === 'assistant' && m.groundingSources && m.groundingSources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            <span>Verified Web Sources (Google Search)</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {m.groundingSources.slice(0, 5).map((src, sIdx) => (
                              <a
                                key={`${src.uri}-${sIdx}`}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] text-[#007FFF] hover:underline truncate"
                                title={src.uri}
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{src.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer: timestamp + model tag + TTS listen */}
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-zinc-200/50 dark:border-zinc-700/50 text-[10px] text-zinc-500 dark:text-zinc-400 gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono">{m.timestamp}</span>
                          {m.modelUsed && (
                            <span className="px-1.5 py-0.2 rounded bg-zinc-200/70 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-300 font-mono text-[9px]">
                              {m.modelUsed}{m.searchGrounded ? ' + Search' : ''}
                            </span>
                          )}
                        </div>

                        {m.sender === 'assistant' && (
                          <button
                            onClick={() => speakMessage(m.text, m.id)}
                            className="flex items-center gap-1 hover:text-[#007FFF] transition-colors cursor-pointer"
                            title="Read message aloud"
                          >
                            {ttsActive === m.id ? (
                              <>
                                <VolumeX className="w-3 h-3 text-[#007FFF]" />
                                <span className="text-[#007FFF]">Stop</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3" />
                                <span>Listen</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick Navigation Action if returned */}
                    {m.quickAction && onNavigateToTab && (
                      <button
                        onClick={() => {
                          onNavigateToTab(m.quickAction!.tab);
                          setIsOpen(false);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#007FFF] bg-[#007FFF]/10 hover:bg-[#007FFF]/20 transition-colors cursor-pointer"
                      >
                        <span>{m.quickAction.label}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 w-fit">
                    <Loader2 className="w-4 h-4 animate-spin text-[#007FFF]" />
                    <span className="text-xs">Analyzing case details with {selectedModel}...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Prompts Strip */}
              {messages.length <= 3 && (
                <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 px-1">
                    Quick resolution inquiries:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedPrompts.slice(0, 3).map((sp, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(sp.prompt, sp.targetTab)}
                        className="px-2.5 py-1 rounded-lg text-[11px] text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-[#007FFF] hover:text-[#007FFF] transition-colors text-left truncate max-w-full cursor-pointer"
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcription Status Banner (gemini-3.5-transcribe) */}
              {transcriptionNotice && (
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border-t border-blue-200 dark:border-blue-900/60 text-[11px] text-[#007FFF] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isTranscribing ? (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>{transcriptionNotice}</span>
                    </div>
                    {isTranscribing && (
                      <button
                        onClick={stopTranscriptionRecording}
                        className="px-2 py-0.5 rounded bg-red-500 text-white font-bold text-[10px] cursor-pointer"
                      >
                        Stop & Transcribe
                      </button>
                    )}
                  </div>

                  {/* Fallback actions if mic access was blocked */}
                  {micBlocked && (
                    <div className="flex items-center gap-2 pt-1 border-t border-blue-200/60 dark:border-blue-900/60">
                      <button
                        onClick={() => audioFileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded bg-[#007FFF] text-white text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <UploadCloud className="w-3 h-3" />
                        <span>Upload Audio File</span>
                      </button>
                      <button
                        onClick={handleSampleAudioTranscription}
                        className="px-2.5 py-1 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <FileAudio className="w-3 h-3" />
                        <span>Try Sample Voice</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Input Bar */}
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] flex items-center gap-1.5">
                {/* Audio Voice Input button with real-time speech recognition & review */}
                <button
                  type="button"
                  onClick={handleToggleVoiceInput}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    isTranscribing
                      ? 'bg-red-500 text-white animate-pulse shadow-md'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                  title={
                    isTranscribing
                      ? 'Click to stop listening'
                      : 'Speak your grievance to transcribe in real time'
                  }
                >
                  {isTranscribing ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Upload Audio File fallback for gemini-3.5-transcribe */}
                <button
                  type="button"
                  onClick={() => audioFileInputRef.current?.click()}
                  className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Upload audio recording (.mp3, .wav, .m4a, .webm) to transcribe with gemini-3.5-transcribe"
                >
                  <FileAudio className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask anything or describe your grievance..."
                  disabled={isLoading}
                  className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                />

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-2.5 rounded-xl bg-[#007FFF] text-white hover:bg-[#0070e0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
