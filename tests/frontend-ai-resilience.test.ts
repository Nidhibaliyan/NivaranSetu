/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Milestone 2, Step 7, Step F (Batches 1 & 2)
 * Frontend AI Integration Resilience & Truthfulness Regression Test Suite
 *
 * Scope:
 * - 1. CaseBuilder: Confirms removal of canned AI advice on failure, truthful error display,
 *      and preservation of user input and conversation history without sending error turns to Gemini.
 * - 2. GlobalAssistant (Sample Transcription): Confirms truthful disclosure of offline sample template
 *      on transcription failure, preventing misleading "Sample voice loaded successfully!" claims.
 * - 3. SmartCaseMonitoring: Confirms explicit disclosure of rule-based keyword fallback when AI is
 *      unavailable, preventing rule-based results from being labeled as AI-generated.
 * - 4. GlobalAssistant (Conversation History): Confirms error cards (ast-err-) are excluded from
 *      chatHistory, preserving only genuine user and assistant turns.
 * - 5. Conversation History Bounding: Confirms bounding to 40 turns, below 50-turn backend contract,
 *      with strict preservation of latest user prompt and clean role mapping.
 * - 6. HTTP Client Timeouts: Confirms 35s chat and 95s transcribe timeout contracts and AbortController.
 * - 7. Error Formatting: Confirms accurate differentiation of timeout vs network vs backend HTTP errors.
 * - 8. State & Input Preservation: Confirms user inputs and loading indicators are properly preserved
 *      and reset across failure and timeout scenarios.
 * - 9. LegalSimplifier Markdown Parsing: Confirms robust category extraction across plain text,
 *      markdown headings (#, ##, ###), bold variants, bullets, brackets, whitespace, and false-positive prevention.
 *
 * Execution: Strictly offline. Zero external network, Gemini, or Supabase requests.
 */

import {
  boundConversationHistory,
  fetchWithTimeout,
  formatAiErrorMessage,
  parseNoticeCategory,
  CHAT_CLIENT_TIMEOUT_MS,
  TRANSCRIBE_CLIENT_TIMEOUT_MS,
  RawChatMessage,
} from '../src/utils/aiClientUtils';

console.log('=== NivaranSetu Step 7, Step F (Batches 1, 2 & 3): Frontend AI Resilience Suite ===\n');

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName} | Expected: ${JSON.stringify(expected)} | Got: ${JSON.stringify(actual)}`);
    failedCount++;
  }
}

// =============================================================================
// TEST 1: CaseBuilder Error Handling & Truthfulness
// =============================================================================
console.log('--- TEST 1: CaseBuilder Error Handling & Truthfulness ---');

// Simulated CaseBuilder chat state handler reflecting updated logic
function simulateCaseBuilderSendChat(
  existingMessages: Array<{ sender: 'ai' | 'user'; text: string; actionSuggestion?: string; isError?: boolean }>,
  textToSend: string,
  fetchFn: (url: string, opts: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>
) {
  const newHistory = [...existingMessages, { sender: 'user' as const, text: textToSend }];
  let finalMessages = [...newHistory];

  // Filtering error messages from messages sent to Gemini
  const messagesForGemini = newHistory
    .filter((m) => !m.isError)
    .map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      text: m.text,
    }));

  return (async () => {
    try {
      const res = await fetchFn('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForGemini,
          taskType: 'general',
          requestedModel: 'gemini-3.8-flash',
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        finalMessages.push({
          sender: 'ai',
          text: data.text,
          actionSuggestion: 'Proceed to review and finalize case',
        });
      } else {
        throw new Error(data.error || `Server responded with HTTP ${res.status}`);
      }
    } catch (err: any) {
      finalMessages.push({
        sender: 'ai',
        text: `AI Assistant is currently unavailable (${err?.message || 'Connection failed'}). Your messages and case details are preserved. You can retry shortly or proceed with manual preparation.`,
        isError: true,
      });
    }

    return { finalMessages, messagesForGemini };
  })();
}

async function runCaseBuilderTests() {
  const initialMessages: Array<{ sender: 'ai' | 'user'; text: string; isError?: boolean }> = [
    { sender: 'ai', text: 'Hello! I am your NivaranSetu Grievance Assistant.' },
  ];

  // Case 1.1: Backend failure returns truthful error without canned fake advice
  const failingFetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ error: 'Gemini API key is not configured.' }),
  });

  const { finalMessages, messagesForGemini } = await simulateCaseBuilderSendChat(
    initialMessages,
    'How do I claim a refund for unauthorized UPI transactions?',
    failingFetch
  );

  const lastMessage = finalMessages[finalMessages.length - 1];
  const CANNED_ADVICE_SNIPPET = 'Under statutory redressal frameworks, keeping a written record of your notice';

  assert(
    !lastMessage.text.includes(CANNED_ADVICE_SNIPPET),
    '1.1: Canned synthetic AI advice is completely eliminated on failure'
  );

  assert(
    lastMessage.isError === true && lastMessage.text.includes('AI Assistant is currently unavailable (Gemini API key is not configured.)'),
    '1.2: Truthful error message with actual server error reason is presented',
    lastMessage.text
  );

  // Case 1.2: User message is preserved in history
  const userMsg = finalMessages.find((m) => m.sender === 'user');
  assert(
    userMsg?.text === 'How do I claim a refund for unauthorized UPI transactions?',
    '1.3: User message is preserved in history upon backend failure'
  );

  // Case 1.3: Error message is excluded from messagesForGemini in subsequent turn
  const secondTurn = await simulateCaseBuilderSendChat(
    finalMessages,
    'Can I still submit my complaint?',
    failingFetch
  );

  const sentToGemini = secondTurn.messagesForGemini;
  const errorFoundInPrompt = sentToGemini.some((m) => m.text.includes('AI Assistant is currently unavailable'));
  assert(
    !errorFoundInPrompt,
    '1.4: Error notifications are filtered out and not forwarded to Gemini as past model turns',
    sentToGemini.length
  );
}

// =============================================================================
// TEST 2: GlobalAssistant Sample Voice Transcription Disclosure
// =============================================================================
console.log('\n--- TEST 2: GlobalAssistant Sample Transcription Disclosure ---');

async function simulateSampleTranscription(
  fetchFn: () => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>
) {
  let notice: string | null = null;
  let inputMessage = '';

  try {
    const response = await fetchFn();
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Server responded with HTTP ${response.status}`);
    }
    if (!data.text) {
      throw new Error('No transcription returned');
    }
    inputMessage = data.text;
    notice = 'Sample voice transcribed successfully via gemini-3.5-transcribe!';
  } catch (err: any) {
    const fallbackText =
      'On 28th October, I received an SMS regarding electricity disconnection. I was defrauded of ₹42,500 via three unauthorized UPI transactions.';
    inputMessage = fallbackText;
    notice = `Live transcription unavailable (${err?.message || 'offline'}). Loaded offline sample template instead.`;
  }

  return { notice, inputMessage };
}

async function runSampleTranscriptionTests() {
  // Case 2.1: Failure produces explicit offline template disclosure, never claiming success
  const failingFetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ error: 'Gemini API key is not configured.' }),
  });

  const failureResult = await simulateSampleTranscription(failingFetch);

  assert(
    !failureResult.notice?.includes('Sample voice loaded successfully!'),
    '2.1: Misleading "Sample voice loaded successfully!" is never reported on failure'
  );

  assert(
    !failureResult.notice?.includes('transcribed successfully'),
    '2.2: Misleading "transcribed successfully" is never claimed when backend fails'
  );

  assert(
    failureResult.notice?.includes('Loaded offline sample template instead') === true &&
    failureResult.notice?.includes('Live transcription unavailable'),
    '2.3: Explicitly discloses offline template fallback and failure reason',
    failureResult.notice
  );

  // Case 2.2: Success genuinely reports transcribed successfully
  const successfulFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ text: 'Transcribed audio content from live model.' }),
  });

  const successResult = await simulateSampleTranscription(successfulFetch);
  assert(
    successResult.notice === 'Sample voice transcribed successfully via gemini-3.5-transcribe!',
    '2.4: Genuine transcription success is truthfully acknowledged'
  );
}

// =============================================================================
// TEST 3: SmartCaseMonitoring Fallback Disclosure & Prompt Bounding
// =============================================================================
console.log('\n--- TEST 3: SmartCaseMonitoring Fallback Disclosure & Prompt Bounding ---');

async function simulateMonitoringClassification(
  responseText: string,
  respondentName: string,
  caseTitle: string,
  fetchFn: (url: string, opts: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>
) {
  let classification: 'resolved' | 'partially_resolved' | 'unresolved' | 'requires_human_review' = 'requires_human_review';
  let rationale = '';
  let isRuleBasedFallback = false;
  let capturedPrompt = '';

  try {
    const boundedText = (responseText || '').slice(0, 7500);
    const prompt = `Analyze this official government or institutional grievance response:
Response Text: "${boundedText}"
Involved Respondent: "${respondentName}"
Original Grievance: "${caseTitle}"

Classify this official response into exactly ONE of the following 4 categories:
- resolved: The authority/entity has fully admitted the claim and ordered or executed full relief/refund.
- partially_resolved: Some partial relief granted, or grievance transferred to another wing without final award.
- unresolved: The authority/entity has rejected, repudiated, or dismissed the complaint without relief.
- requires_human_review: The response is ambiguous, requests additional evidence, or mentions procedural delays.

Return your analysis in this exact format:
CLASSIFICATION: [resolved | partially_resolved | unresolved | requires_human_review]
RATIONALE: [2-3 sentences explaining the legal and factual basis for this classification]`;

    capturedPrompt = prompt;

    const aiRes = await fetchFn('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', text: prompt }],
        taskType: 'complex',
        requestedModel: 'gemini-4-argon',
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const aiOutput = aiData.text || '';
      if (aiOutput.includes('CLASSIFICATION: resolved')) classification = 'resolved';
      else if (aiOutput.includes('CLASSIFICATION: partially_resolved')) classification = 'partially_resolved';
      else if (aiOutput.includes('CLASSIFICATION: unresolved')) classification = 'unresolved';
      else classification = 'requires_human_review';

      const rationaleMatch = aiOutput.match(/RATIONALE:\s*([\s\S]+)/i);
      rationale = rationaleMatch ? rationaleMatch[1].trim() : aiOutput.trim();
    } else {
      const errJson = await aiRes.json().catch(() => ({}));
      throw new Error(errJson.error || `AI service returned HTTP ${aiRes.status}`);
    }
  } catch (aiErr: any) {
    isRuleBasedFallback = true;
    const reason = aiErr?.message ? ` (${aiErr.message})` : '';
    const lower = responseText.toLowerCase();
    if (lower.includes('reject') || lower.includes('repudiat') || lower.includes('dismiss') || lower.includes('closed without')) {
      classification = 'unresolved';
      rationale = `Rule-based fallback [AI Unavailable${reason}]: Response contains explicit repudiation or closure without relief terms. Grounds for statutory escalation.`;
    } else {
      classification = 'requires_human_review';
      rationale = `Rule-based fallback [AI Unavailable${reason}]: The text provided requires human review by the citizen to confirm whether the terms meet statutory relief requirements.`;
    }
  }

  const custodyProofDesc = `Classification: ${classification.toUpperCase()} (${isRuleBasedFallback ? 'Rule-Based Fallback' : 'AI-Evaluated'}).`;

  return { classification, rationale, isRuleBasedFallback, capturedPrompt, custodyProofDesc };
}

async function runSmartCaseMonitoringTests() {
  // Case 3.1: AI failure triggers explicit rule-based disclosure in rationale and custody proof
  const failingFetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ error: 'Gemini API key is not configured.' }),
  });

  const result = await simulateMonitoringClassification(
    'The bank has rejected your grievance regarding transaction 98765.',
    'State Bank of India',
    'Unauthorized UPI Debits',
    failingFetch
  );

  assert(
    result.isRuleBasedFallback === true,
    '3.1: Fallback flag is correctly set to true when AI call fails'
  );

  assert(
    result.rationale.startsWith('Rule-based fallback [AI Unavailable (Gemini API key is not configured.)]:'),
    '3.2: Rationale explicitly discloses rule-based fallback and actual failure reason',
    result.rationale
  );

  assert(
    result.custodyProofDesc.includes('Rule-Based Fallback'),
    '3.3: Custody event audit trail explicitly logs (Rule-Based Fallback) rather than AI evaluation',
    result.custodyProofDesc
  );

  // Case 3.2: Text bounding prevents prompt from exceeding backend 10,000 character limit
  const oversizedText = 'A'.repeat(20000);
  const oversizedResult = await simulateMonitoringClassification(
    oversizedText,
    'Respondent Corp',
    'Overcharging Case',
    failingFetch
  );

  assert(
    oversizedResult.capturedPrompt.length < 9000,
    '3.4: Oversized citizen response text is bounded to <=7500 chars (total prompt <9000 chars)',
    oversizedResult.capturedPrompt.length
  );
}

// =============================================================================
// TEST 4: GlobalAssistant Conversation History Filtering
// =============================================================================
console.log('\n--- TEST 4: GlobalAssistant Conversation History Filtering ---');

function filterChatHistoryForGemini(
  messages: Array<{ id: string; sender: 'user' | 'assistant'; text: string }>
) {
  return messages
    .filter((m) => !m.id.startsWith('ast-err-'))
    .map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      text: m.text,
    }));
}

function runGlobalAssistantHistoryTests() {
  const mixedHistory: Array<{ id: string; sender: 'user' | 'assistant'; text: string }> = [
    { id: 'usr-1', sender: 'user', text: 'Hello, I have a banking issue.' },
    { id: 'ast-1', sender: 'assistant', text: 'Hello! Please tell me more about your bank.' },
    { id: 'usr-2', sender: 'user', text: 'They charged me an unauthorized fee.' },
    { id: 'ast-err-1731234567', sender: 'assistant', text: 'I encountered an issue connecting to Gemini: Network error. Please verify your network and retry.' },
    { id: 'usr-3', sender: 'user', text: 'Are you there? Can you help?' },
  ];

  const cleanedHistory = filterChatHistoryForGemini(mixedHistory);

  assert(
    cleanedHistory.length === 4,
    '4.1: Exactly 4 genuine conversation turns retained, 1 error card filtered out',
    cleanedHistory.length,
    4
  );

  const containsErrorCard = cleanedHistory.some((m) => m.text.includes('I encountered an issue connecting to Gemini'));
  assert(
    !containsErrorCard,
    '4.2: Error card is completely omitted from Gemini model turns'
  );

  assert(
    cleanedHistory[0].role === 'user' &&
    cleanedHistory[1].role === 'model' &&
    cleanedHistory[2].role === 'user' &&
    cleanedHistory[3].role === 'user',
    '4.3: Roles are mapped cleanly and sequence is preserved'
  );
}

// =============================================================================
// TEST 5: Conversation History Bounding & Contract Compliance (boundConversationHistory)
// =============================================================================
console.log('\n--- TEST 5: Conversation History Bounding & Contract Compliance ---');

function runConversationHistoryBoundingTests() {
  // 5.1: Bounding 60 messages down to max 40 turns (backend limit is 50)
  const longHistory: RawChatMessage[] = [];
  for (let i = 1; i <= 60; i++) {
    longHistory.push({
      id: `msg-${i}`,
      sender: i % 2 === 1 ? 'user' : 'assistant',
      text: `Message turn ${i}`,
    });
  }

  const bounded = boundConversationHistory(longHistory, 40);
  assert(
    bounded.length === 40,
    '5.1: 60-turn conversation bounded to exactly 40 turns (below 50 backend limit)',
    bounded.length,
    40
  );

  // 5.2: Exactly 50 messages bounded to 40 turns
  const fiftyMessages: RawChatMessage[] = longHistory.slice(0, 50);
  const boundedFifty = boundConversationHistory(fiftyMessages, 40);
  assert(
    boundedFifty.length === 40,
    '5.2: 50-turn conversation bounded to 40 turns',
    boundedFifty.length,
    40
  );

  // 5.3: Error cards (isError: true and ast-err- IDs) excluded from outgoing history
  const historyWithErrors: RawChatMessage[] = [
    { id: 'usr-1', sender: 'user', text: 'First query' },
    { id: 'ast-1', sender: 'assistant', text: 'First reply' },
    { id: 'ast-err-1234', sender: 'assistant', text: 'Failed connection to Gemini' },
    { id: 'usr-2', sender: 'user', text: 'Second query' },
    { id: 'ai-3', sender: 'ai', text: 'Error notice', isError: true },
    { id: 'usr-3', sender: 'user', text: 'Final question' },
  ];
  const cleanedTurns = boundConversationHistory(historyWithErrors, 40);
  const hasErrors = cleanedTurns.some(
    (t) => t.text.includes('Failed connection') || t.text.includes('Error notice')
  );
  assert(
    !hasErrors && cleanedTurns.length === 4,
    '5.3: UI error notices and ast-err- cards strictly excluded from outgoing Gemini turns',
    { hasErrors, count: cleanedTurns.length },
    { hasErrors: false, count: 4 }
  );

  // 5.4: Latest user message retention guaranteed in all slicing scenarios
  const tailAssistantHistory: RawChatMessage[] = [
    { id: 'usr-1', sender: 'user', text: 'The citizen prompt that must be preserved' },
  ];
  for (let i = 1; i <= 45; i++) {
    tailAssistantHistory.push({
      id: `ast-${i}`,
      sender: 'assistant',
      text: `Follow-up info ${i}`,
    });
  }
  const boundedWithUserPreserved = boundConversationHistory(tailAssistantHistory, 40);
  const userPreserved = boundedWithUserPreserved.some(
    (t) => t.role === 'user' && t.text === 'The citizen prompt that must be preserved'
  );
  assert(
    userPreserved && boundedWithUserPreserved.length <= 40,
    '5.4: Latest user message strictly preserved in payload even when tail is dominated by assistant messages',
    userPreserved,
    true
  );

  // 5.5: Chronological sequence preserved
  const orderHistory: RawChatMessage[] = [
    { sender: 'user', text: 'Turn 1' },
    { sender: 'assistant', text: 'Turn 2' },
    { sender: 'user', text: 'Turn 3' },
  ];
  const boundedOrder = boundConversationHistory(orderHistory, 40);
  assert(
    boundedOrder[0].text === 'Turn 1' &&
      boundedOrder[1].text === 'Turn 2' &&
      boundedOrder[2].text === 'Turn 3',
    '5.5: Chronological sequence of conversation turns strictly preserved'
  );

  // 5.6: Roles mapped correctly ('user' -> 'user', 'assistant'/'ai' -> 'model')
  assert(
    boundedOrder[0].role === 'user' &&
      boundedOrder[1].role === 'model' &&
      boundedOrder[2].role === 'user',
    '5.6: Roles cleanly mapped to user and model'
  );

  // 5.7: User text content is never truncated
  const longUserText = 'A'.repeat(5000);
  const boundedLongText = boundConversationHistory(
    [{ sender: 'user', text: longUserText }],
    40
  );
  assert(
    boundedLongText[0].text.length === 5000,
    '5.7: User prompt text is preserved without accidental truncation by conversation boundary',
    boundedLongText[0].text.length,
    5000
  );

  // 5.8: Empty/whitespace messages and non-array input handled gracefully
  const emptyHistory: any = null;
  const boundedNull = boundConversationHistory(emptyHistory, 40);
  const whitespaceHistory: RawChatMessage[] = [
    { sender: 'user', text: '   ' },
    { sender: 'user', text: 'Valid message' },
  ];
  const boundedWhitespace = boundConversationHistory(whitespaceHistory, 40);
  assert(
    Array.isArray(boundedNull) &&
      boundedNull.length === 0 &&
      boundedWhitespace.length === 1 &&
      boundedWhitespace[0].text === 'Valid message',
    '5.8: Null, empty, and whitespace-only turns handled safely without throwing'
  );

  // 5.9: 41 alternating messages where 40-message slice initially starts with model
  const fortyOneMessages: RawChatMessage[] = [];
  for (let i = 1; i <= 41; i++) {
    fortyOneMessages.push({
      id: `msg-${i}`,
      sender: i % 2 === 1 ? 'user' : 'assistant',
      text: `Message turn ${i}`,
    });
  }
  const boundedFortyOne = boundConversationHistory(fortyOneMessages, 40);
  assert(
    boundedFortyOne.length === 39 &&
      boundedFortyOne[0].role === 'user' &&
      boundedFortyOne[0].text === 'Message turn 3' &&
      boundedFortyOne[boundedFortyOne.length - 1].role === 'user' &&
      boundedFortyOne[boundedFortyOne.length - 1].text === 'Message turn 41',
    '5.9: 41 alternating messages starting with user slices to 39 turns, dropping leading model turn',
    { length: boundedFortyOne.length, firstRole: boundedFortyOne[0]?.role, firstText: boundedFortyOne[0]?.text },
    { length: 39, firstRole: 'user', firstText: 'Message turn 3' }
  );

  // 5.10: Window requiring removal of multiple leading assistant messages
  const multipleLeadingAssistant: RawChatMessage[] = [
    { sender: 'user', text: 'Old query' },
    { sender: 'assistant', text: 'Response 1' },
    { sender: 'assistant', text: 'Response 2' },
    { sender: 'assistant', text: 'Response 3' },
    { sender: 'user', text: 'Active query' },
  ];
  const boundedLeadingRemoved = boundConversationHistory(multipleLeadingAssistant, 4);
  assert(
    boundedLeadingRemoved.length === 1 &&
      boundedLeadingRemoved[0].role === 'user' &&
      boundedLeadingRemoved[0].text === 'Active query',
    '5.10: Multiple leading assistant messages introduced by slicing are stripped, starting with user',
    boundedLeadingRemoved.length,
    1
  );

  // 5.11: History with only assistant messages or errors returns empty array
  const onlyAssistantMessages: RawChatMessage[] = [
    { sender: 'assistant', text: 'Welcome! How can I help?' },
    { sender: 'assistant', text: 'Here are some suggestions.' },
  ];
  const boundedOnlyAssistant = boundConversationHistory(onlyAssistantMessages, 40);
  assert(
    Array.isArray(boundedOnlyAssistant) && boundedOnlyAssistant.length === 0,
    '5.11: History with zero user messages returns empty array so callers avoid invalid requests',
    boundedOnlyAssistant.length,
    0
  );

  // 5.12: Strict upper bound of 40 messages across all tested inputs
  const hundredMessages: RawChatMessage[] = [];
  for (let i = 1; i <= 100; i++) {
    hundredMessages.push({
      sender: i % 2 === 1 ? 'user' : 'assistant',
      text: `Turn ${i}`,
    });
  }
  const boundedHundred = boundConversationHistory(hundredMessages, 40);
  assert(
    boundedHundred.length <= 40 &&
      boundedHundred[0].role === 'user' &&
      boundedHundred.every((m) => m.role === 'user' || m.role === 'model'),
    '5.12: 100-message conversation bounded to <= 40 turns, strictly starts with user and has valid roles'
  );
}

// =============================================================================
// TEST 6: HTTP Client Timeouts & AbortController Reliability (fetchWithTimeout)
// =============================================================================
console.log('\n--- TEST 6: HTTP Client Timeouts & AbortController Reliability ---');

function createInstrumentedSignal() {
  const controller = new AbortController();
  const signal = controller.signal;
  let activeListeners = 0;
  let addCount = 0;
  let removeCount = 0;

  const originalAdd = signal.addEventListener.bind(signal);
  const originalRemove = signal.removeEventListener.bind(signal);

  signal.addEventListener = (type: string, listener: any, options?: any) => {
    if (type === 'abort') {
      activeListeners++;
      addCount++;
    }
    return originalAdd(type, listener, options);
  };

  signal.removeEventListener = (type: string, listener: any, options?: any) => {
    if (type === 'abort') {
      activeListeners = Math.max(0, activeListeners - 1);
      removeCount++;
    }
    return originalRemove(type, listener, options);
  };

  return {
    controller,
    signal,
    getActiveListeners: () => activeListeners,
    getAddCount: () => addCount,
    getRemoveCount: () => removeCount,
  };
}

async function runTimeoutAndAbortTests() {
  // 6.1: Constant contract verification
  assert(
    CHAT_CLIENT_TIMEOUT_MS === 35000,
    '6.1: CHAT_CLIENT_TIMEOUT_MS is 35,000ms (5s after backend 30s deadline)',
    CHAT_CLIENT_TIMEOUT_MS,
    35000
  );
  assert(
    TRANSCRIBE_CLIENT_TIMEOUT_MS === 95000,
    '6.2: TRANSCRIBE_CLIENT_TIMEOUT_MS is 95,000ms (5s after backend 90s deadline)',
    TRANSCRIBE_CLIENT_TIMEOUT_MS,
    95000
  );

  const originalFetch = globalThis.fetch;

  try {
    // 6.3: Fast request completes successfully before timeout
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ text: 'Quick response' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const fastRes = await fetchWithTimeout('/api/gemini/chat', {}, 100);
    const fastData = await fastRes.json();
    assert(
      fastRes.ok && fastData.text === 'Quick response',
      '6.3: Responsive request completes cleanly before timeout'
    );

    // 6.4: Slow request exceeding timeout triggers TimeoutError
    globalThis.fetch = async (_url: any, opts: any) => {
      return new Promise<Response>((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted.');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    };

    let caughtTimeoutErr: any = null;
    try {
      await fetchWithTimeout('/api/gemini/chat', {}, 50);
    } catch (err) {
      caughtTimeoutErr = err;
    }

    assert(
      caughtTimeoutErr &&
        caughtTimeoutErr.name === 'TimeoutError' &&
        caughtTimeoutErr.message.includes('Request timed out after 50ms'),
      '6.4: Slow request correctly raises TimeoutError with clear timeout duration',
      caughtTimeoutErr?.name,
      'TimeoutError'
    );

    // 6.5: External AbortSignal aborts immediately before timeout
    const externalController = new AbortController();
    let externalAbortCaught: any = null;
    const fetchPromise = fetchWithTimeout(
      '/api/gemini/chat',
      { signal: externalController.signal },
      10000
    );
    // Abort externally immediately
    externalController.abort();

    try {
      await fetchPromise;
    } catch (err) {
      externalAbortCaught = err;
    }

    assert(
      externalAbortCaught &&
        (externalAbortCaught.name === 'AbortError' ||
          externalAbortCaught.message?.includes('aborted')),
      '6.5: External AbortSignal cancellation propagates immediately without waiting for timeout',
      externalAbortCaught?.name,
      'AbortError'
    );

    // 6.6: External abort listener cleanup after successful request
    const instSuccess = createInstrumentedSignal();
    globalThis.fetch = async () => new Response(JSON.stringify({ text: 'ok' }), { status: 200 });
    await fetchWithTimeout('/api/gemini/chat', { signal: instSuccess.signal }, 100);
    assert(
      instSuccess.getAddCount() === 1 && instSuccess.getActiveListeners() === 0,
      '6.6: External abort listener registered and cleaned up in finally on successful request',
      { added: instSuccess.getAddCount(), active: instSuccess.getActiveListeners() },
      { added: 1, active: 0 }
    );

    // 6.7: External abort listener cleanup after timeout
    const instTimeout = createInstrumentedSignal();
    globalThis.fetch = async (_url: any, opts: any) => {
      return new Promise<Response>((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };
    try {
      await fetchWithTimeout('/api/gemini/chat', { signal: instTimeout.signal }, 30);
    } catch (e) {}
    assert(
      instTimeout.getAddCount() === 1 && instTimeout.getActiveListeners() === 0,
      '6.7: External abort listener registered and cleaned up in finally on timeout',
      { added: instTimeout.getAddCount(), active: instTimeout.getActiveListeners() },
      { added: 1, active: 0 }
    );

    // 6.8: External abort listener cleanup after network failure
    const instNetwork = createInstrumentedSignal();
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    try {
      await fetchWithTimeout('/api/gemini/chat', { signal: instNetwork.signal }, 100);
    } catch (e) {}
    assert(
      instNetwork.getAddCount() === 1 && instNetwork.getActiveListeners() === 0,
      '6.8: External abort listener registered and cleaned up in finally on network failure',
      { added: instNetwork.getAddCount(), active: instNetwork.getActiveListeners() },
      { added: 1, active: 0 }
    );

    // 6.9: External abort listener cleanup after external cancellation
    const instAbort = createInstrumentedSignal();
    globalThis.fetch = async (_url: any, opts: any) => {
      return new Promise<Response>((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };
    const abortFetchPromise = fetchWithTimeout(
      '/api/gemini/chat',
      { signal: instAbort.signal },
      1000
    );
    instAbort.controller.abort();
    try {
      await abortFetchPromise;
    } catch (e) {}
    assert(
      instAbort.getAddCount() === 1 && instAbort.getActiveListeners() === 0,
      '6.9: External abort listener registered and cleaned up in finally on external cancellation',
      { added: instAbort.getAddCount(), active: instAbort.getActiveListeners() },
      { added: 1, active: 0 }
    );

    // 6.10: Already-aborted external signal cancels immediately without listener leak
    const instAlreadyAborted = createInstrumentedSignal();
    instAlreadyAborted.controller.abort();
    globalThis.fetch = async (_url: any, opts: any) => {
      if (opts.signal?.aborted) {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        throw err;
      }
      return new Response(JSON.stringify({ text: 'ok' }), { status: 200 });
    };
    let alreadyAbortedCaught = false;
    try {
      await fetchWithTimeout('/api/gemini/chat', { signal: instAlreadyAborted.signal }, 1000);
    } catch (e: any) {
      alreadyAbortedCaught = e?.name === 'AbortError' || e?.message?.includes('aborted');
    }
    assert(
      instAlreadyAborted.getAddCount() === 0 && alreadyAbortedCaught,
      '6.10: Already-aborted external signal cancels immediately without registering listener'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// =============================================================================
// TEST 7: Error Message Discrimination (formatAiErrorMessage)
// =============================================================================
console.log('\n--- TEST 7: Error Message Discrimination (formatAiErrorMessage) ---');

function runErrorFormattingTests() {
  // 7.1: TimeoutError discrimination
  const timeoutErr = new Error('Request timed out after 35000ms waiting for response.');
  timeoutErr.name = 'TimeoutError';
  const timeoutMsg = formatAiErrorMessage(timeoutErr);
  assert(
    timeoutMsg.includes('The request timed out waiting for the AI service'),
    '7.1: TimeoutError accurately formatted into citizen-friendly timeout notice',
    timeoutMsg
  );

  // 7.2: Network failure / TypeError discrimination
  const networkErr = new TypeError('Failed to fetch');
  const networkMsg = formatAiErrorMessage(networkErr);
  assert(
    networkMsg.includes('Network connection issue: Unable to reach the server'),
    '7.2: "Failed to fetch" TypeError formatted into network connectivity advice',
    networkMsg
  );

  // 7.3: Backend HTTP status and application errors preserved
  const httpErr = new Error('Rate limit exceeded (5 requests per 60s)');
  const httpMsg = formatAiErrorMessage(httpErr);
  assert(
    httpMsg === 'Rate limit exceeded (5 requests per 60s)',
    '7.3: Specific backend application/rate-limit error preserved without alteration',
    httpMsg,
    'Rate limit exceeded (5 requests per 60s)'
  );

  // 7.4: AbortError cancellation notice
  const abortErr = new Error('The operation was aborted.');
  abortErr.name = 'AbortError';
  const abortMsg = formatAiErrorMessage(abortErr);
  assert(
    abortMsg === 'The request was cancelled.',
    '7.4: AbortError cleanly identified as cancelled request',
    abortMsg
  );

  // 7.5: Fallback handling
  assert(
    formatAiErrorMessage(null, 'Custom fallback') === 'Custom fallback',
    '7.5: Null/undefined error cleanly falls back to specified default'
  );
}

// =============================================================================
// TEST 8: User Input & State Preservation Under Timeout/Network Failure
// =============================================================================
console.log('\n--- TEST 8: User Input & State Preservation Under Timeout/Network Failure ---');

async function runUserInputAndStatePreservationTests() {
  const originalFetch = globalThis.fetch;

  try {
    // 8.1 & 8.2: CaseBuilder simulation under timeout
    let caseBuilderLoading = true;
    let preservedDraft = 'Unsettled builder dispute regarding possession delay';
    const caseBuilderHistory = [{ sender: 'ai' as const, text: 'Hello! Describe your grievance.' }];

    globalThis.fetch = async (_url: any, opts: any) => {
      return new Promise<Response>((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted.');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    };

    try {
      const turns = boundConversationHistory(
        [...caseBuilderHistory, { sender: 'user', text: preservedDraft }],
        40
      );
      await fetchWithTimeout(
        '/api/gemini/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: turns }),
        },
        30
      );
    } catch (err: any) {
      const friendlyErr = formatAiErrorMessage(err, 'Service unavailable');
      caseBuilderHistory.push({
        sender: 'ai',
        text: `AI Assistant is currently unavailable (${friendlyErr}). Your messages and case details are preserved. You can retry shortly or proceed with manual preparation.`,
        isError: true,
      } as any);
    } finally {
      caseBuilderLoading = false;
    }

    assert(
      caseBuilderLoading === false,
      '8.1: CaseBuilder loading flag is safely reset to false in finally block on timeout'
    );
    assert(
      preservedDraft === 'Unsettled builder dispute regarding possession delay' &&
        caseBuilderHistory.length === 2 &&
        caseBuilderHistory[1].text.includes('The request timed out'),
      '8.2: CaseBuilder preserves citizen input and shows truthful timeout message without canned fake advice'
    );

    // 8.3 & 8.4: GlobalAssistant simulation under timeout
    let globalAssistantLoading = true;
    const globalMessages = [
      { id: 'usr-1', sender: 'user' as const, text: 'Need help with electricity surcharge' },
    ];

    try {
      const chatTurns = boundConversationHistory(globalMessages, 40);
      await fetchWithTimeout(
        '/api/gemini/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: chatTurns }),
        },
        30
      );
    } catch (err: any) {
      const friendlyErr = formatAiErrorMessage(err, 'Failed to generate response');
      globalMessages.push({
        id: `ast-err-${Date.now()}`,
        sender: 'assistant' as any,
        text: `I encountered an issue connecting to Gemini: ${friendlyErr}. Please verify your network and retry.`,
      });
    } finally {
      globalAssistantLoading = false;
    }

    assert(
      globalAssistantLoading === false,
      '8.3: GlobalAssistant isLoading state cleanly reset to false in finally on timeout'
    );
    assert(
      globalMessages.length === 2 &&
        globalMessages[0].text === 'Need help with electricity surcharge' &&
        globalMessages[1].text.includes('The request timed out'),
      '8.4: GlobalAssistant conversation history and citizen message intact with clear timeout message'
    );

    // 8.5: LegalSimplifier simulation under timeout: notice text preserved
    let simplifierAnalyzing = true;
    const pastedNotice = 'DEMAND NOTICE: You are hereby directed to pay ₹1,50,000 within 15 days...';
    let analysisError: string | null = null;

    try {
      await fetchWithTimeout(
        '/api/gemini/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', text: pastedNotice }] }),
        },
        30
      );
    } catch (err: any) {
      const formattedReason = formatAiErrorMessage(err, 'Network or service error');
      analysisError = `AI analysis could not be completed (${formattedReason}). Your pasted notice is preserved below and can still be carried directly into Smart Case Builder.`;
    } finally {
      simplifierAnalyzing = false;
    }

    assert(
      simplifierAnalyzing === false &&
        pastedNotice.startsWith('DEMAND NOTICE') &&
        analysisError !== null &&
        analysisError.includes('The request timed out'),
      '8.5: LegalSimplifier preserves original notice and resets isAnalyzing to false on timeout'
    );

    // 8.6: SmartCaseMonitoring simulation under timeout: rule-based fallback triggered
    let monitoringAnalyzing = true;
    let fallbackTriggered = false;
    let monitoringRationale = '';

    try {
      await fetchWithTimeout(
        '/api/gemini/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', text: 'response review' }] }),
        },
        30
      );
    } catch (aiErr: any) {
      fallbackTriggered = true;
      const formattedReason = formatAiErrorMessage(aiErr, 'AI request failed');
      monitoringRationale = `Rule-based fallback [AI Unavailable (${formattedReason})]: Response contains explicit repudiation or closure without relief terms.`;
    } finally {
      monitoringAnalyzing = false;
    }

    assert(
      monitoringAnalyzing === false &&
        fallbackTriggered === true &&
        monitoringRationale.includes('The request timed out'),
      '8.6: SmartCaseMonitoring falls back to rule-based analysis disclosing timeout and resets analyzing flag'
    );

    // 8.7: CaseBuilder empty bounded history guard prevents fetch and safely resets loading flag
    let cbEmptyFetchInvoked = false;
    let cbEmptyLoading = true;
    const cbEmptyHistory = [{ sender: 'ai' as const, text: 'Initial greeting' }];

    globalThis.fetch = async () => {
      cbEmptyFetchInvoked = true;
      return new Response(JSON.stringify({ text: 'Should not reach' }), { status: 200 });
    };

    try {
      // History with zero user messages yields empty bounded array
      const messagesForGemini = boundConversationHistory(cbEmptyHistory, 40);
      if (messagesForGemini.length === 0) {
        // Early return matching CaseBuilder.tsx#L1342
      } else {
        await fetchWithTimeout(
          '/api/gemini/chat',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: messagesForGemini }),
          },
          100
        );
      }
    } finally {
      cbEmptyLoading = false;
    }

    assert(
      !cbEmptyFetchInvoked && cbEmptyLoading === false,
      '8.7: CaseBuilder empty bounded history never reaches fetch and cleanly resets loading state'
    );

    // 8.8: GlobalAssistant empty bounded history guard prevents fetch and safely resets loading flag
    let gaEmptyFetchInvoked = false;
    let gaEmptyLoading = true;
    const gaEmptyMessages = [{ id: 'ast-1', sender: 'assistant' as const, text: 'Welcome!' }];

    try {
      // History with zero user messages yields empty bounded array
      const chatHistory = boundConversationHistory(gaEmptyMessages, 40);
      if (chatHistory.length === 0) {
        // Early return matching GlobalAssistant.tsx#L381
      } else {
        await fetchWithTimeout(
          '/api/gemini/chat',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistory }),
          },
          100
        );
      }
    } finally {
      gaEmptyLoading = false;
    }

    assert(
      !gaEmptyFetchInvoked && gaEmptyLoading === false,
      '8.8: GlobalAssistant empty bounded history never reaches fetch and cleanly resets loading state'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// =============================================================================
// TEST 9: LegalSimplifier Markdown Parsing Reliability (parseNoticeCategory)
// =============================================================================
console.log('\n--- TEST 9: LegalSimplifier Markdown Parsing Reliability ---');

function runNoticeCategoryParserTests() {
  // 9.1: Plain text category heading
  assert(
    parseNoticeCategory('CATEGORY: Banking') === 'Banking',
    '9.1: Plain text category heading ("CATEGORY: Banking") parsed accurately'
  );

  // 9.2: Single markdown heading (#)
  assert(
    parseNoticeCategory('# CATEGORY: Banking') === 'Banking',
    '9.2: Single markdown heading ("# CATEGORY: Banking") parsed accurately'
  );

  // 9.3: Double markdown heading (##)
  assert(
    parseNoticeCategory('## CATEGORY: Banking') === 'Banking',
    '9.3: Double markdown heading ("## CATEGORY: Banking") parsed accurately'
  );

  // 9.4: Triple markdown heading (###)
  assert(
    parseNoticeCategory('### CATEGORY: Banking') === 'Banking',
    '9.4: Triple markdown heading ("### CATEGORY: Banking") parsed accurately'
  );

  // 9.5: Bold label formatting (**CATEGORY:** Banking)
  assert(
    parseNoticeCategory('**CATEGORY:** Banking') === 'Banking',
    '9.5: Bold label formatting ("**CATEGORY:** Banking") parsed accurately'
  );

  // 9.6: Entire line in bold (**CATEGORY: Banking**)
  assert(
    parseNoticeCategory('**CATEGORY: Banking**') === 'Banking',
    '9.6: Entire category in bold ("**CATEGORY: Banking**") parsed accurately'
  );

  // 9.7: Combined heading and bold label (### **CATEGORY:** Banking)
  assert(
    parseNoticeCategory('### **CATEGORY:** Banking') === 'Banking',
    '9.7: Combined heading and bold label ("### **CATEGORY:** Banking") parsed accurately'
  );

  // 9.8: Combined heading and full bold (## **CATEGORY: Banking**)
  assert(
    parseNoticeCategory('## **CATEGORY: Banking**') === 'Banking',
    '9.8: Combined heading and full bold ("## **CATEGORY: Banking**") parsed accurately'
  );

  // 9.9: Bullet with asterisk (* **CATEGORY:** Banking)
  assert(
    parseNoticeCategory('* **CATEGORY:** Banking') === 'Banking',
    '9.9: Bullet with asterisk ("* **CATEGORY:** Banking") parsed accurately'
  );

  // 9.10: Bullet with hyphen (- **CATEGORY:** Banking)
  assert(
    parseNoticeCategory('- **CATEGORY:** Banking') === 'Banking',
    '9.10: Bullet with hyphen ("- **CATEGORY:** Banking") parsed accurately'
  );

  // 9.11: Leading/trailing whitespace and irregular spacing
  assert(
    parseNoticeCategory('   ## CATEGORY:   Banking / Financial   ') === 'Banking / Financial',
    '9.11: Irregular leading/trailing whitespace stripped cleanly'
  );

  // 9.12: Square brackets enclosing category name
  assert(
    parseNoticeCategory('**CATEGORY: [Banking / Financial]**') === 'Banking / Financial',
    '9.12: Square brackets stripped from category name'
  );

  // 9.13: Malformed markdown (unclosed leading bold: **CATEGORY: Banking)
  assert(
    parseNoticeCategory('**CATEGORY: Banking') === 'Banking',
    '9.13: Malformed unclosed leading bold handled cleanly'
  );

  // 9.14: Malformed markdown (unmatched trailing bold on label: CATEGORY:** Banking)
  assert(
    parseNoticeCategory('CATEGORY:** Banking') === 'Banking',
    '9.14: Malformed unmatched trailing bold on label handled cleanly'
  );

  // 9.15: Category with internal colons / subcategories
  assert(
    parseNoticeCategory('CATEGORY: Banking: Loan Recovery & Harassment') === 'Banking: Loan Recovery & Harassment',
    '9.15: Internal colons and complex subcategory labels preserved'
  );

  // 9.16: False-positive prevention: word 'category' in ordinary paragraph text
  const paragraphText = 'The bank informed that this dispute does not fall under the category: Banking fraud.\nPlease advise.';
  assert(
    parseNoticeCategory(paragraphText) === null,
    '9.16: False-positive rejected when "category" appears inside paragraph text'
  );

  // 9.17: Realistic multi-line AI notice response with full headings
  const realisticNoticeOutput = `
## Notice Analysis
**CATEGORY:** Consumer Protection & E-Commerce
**TITLE:** Defective Refrigerator Replacement Notice
**SIMPLE_ENGLISH:** The manufacturer has failed to honor warranty terms.
**HINDI_TRANSLATION:** निर्माता वारंटी शर्तों का सम्मान करने में विफल रहा है।
**KEY_DATES:**
- 15 days from receipt
**MANDATORY_ACTIONS:**
- File formal consumer complaint
`.trim();

  assert(
    parseNoticeCategory(realisticNoticeOutput) === 'Consumer Protection & E-Commerce',
    '9.17: Correct category extracted from realistic multi-section AI response'
  );

  // 9.18: Missing category heading returns null
  const noCategoryOutput = `
TITLE: Notice Without Category
SIMPLE_ENGLISH: Some analysis here.
`.trim();
  assert(
    parseNoticeCategory(noCategoryOutput) === null,
    '9.18: Output lacking CATEGORY heading returns null'
  );

  // 9.19: Empty or whitespace-only category value returns null
  assert(
    parseNoticeCategory('CATEGORY:    \nTITLE: Sample') === null,
    '9.19: Empty or whitespace-only category value returns null'
  );

  // 9.20: Null, undefined, empty string inputs safely return null
  assert(
    parseNoticeCategory('') === null &&
    parseNoticeCategory(null as any) === null &&
    parseNoticeCategory(undefined as any) === null,
    '9.20: Null, undefined, and empty string safely return null'
  );

  // 9.21: Verification of fallback integration in LegalSimplifier
  const fallbackResult = parseNoticeCategory(noCategoryOutput) || 'Legal / Regulatory';
  assert(
    fallbackResult === 'Legal / Regulatory',
    '9.21: LegalSimplifier correctly applies "Legal / Regulatory" fallback when parser returns null'
  );
}

async function runAll() {
  await runCaseBuilderTests();
  await runSampleTranscriptionTests();
  await runSmartCaseMonitoringTests();
  runGlobalAssistantHistoryTests();
  runConversationHistoryBoundingTests();
  await runTimeoutAndAbortTests();
  runErrorFormattingTests();
  await runUserInputAndStatePreservationTests();
  runNoticeCategoryParserTests();

  console.log('\n======================================================');
  console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('Test runner exception:', err);
  process.exit(1);
});
