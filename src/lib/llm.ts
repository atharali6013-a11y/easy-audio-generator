// ============================================
// Easy Audio Generator — LLM Integration (Smart Multi-Provider Routing)
// ============================================
// Uses Groq (Qwen) for short docs & Gemini 1.5 Flash for large docs & fallback.

import type { ConversationScript, ConversationTurn } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEYS_STR = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const GEMINI_KEYS = GEMINI_API_KEYS_STR.split(',').map(k => k.trim()).filter(k => k.length > 0);

function getGeminiKey(): string {
  if (GEMINI_KEYS.length === 0) return '';
  return GEMINI_KEYS[Math.floor(Math.random() * GEMINI_KEYS.length)];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const MAX_JITTER_MS = 1000;

// ---------------------------------------------------------------------------
// Main prompt templates
// ---------------------------------------------------------------------------

function buildConversationPrompt(text: string): string {
  return `You are a world-class podcast production AI tasked with creating an engaging, deeply insightful podcast transcript based STRICTLY on the provided source document. 

Your goal is to emulate a high-quality "Deep Dive" audio overview featuring two distinct hosts. The output must not be a generic, canned summary. Instead, it must be a dynamic, nuanced conversation that unpacks the specific facts, arguments, and underlying concepts of the document.

### CRITICAL REQUIREMENT: LANGUAGE
All underlying instructions and your planning steps must be in English, but the FINAL PODCAST DIALOGUE MUST BE WRITTEN ENTIRELY IN URDU.

### ROLES AND PERSONAS
You will write dialogue for two speakers:
1. **Host (میزبان):** The enthusiastic, curious interviewer. The Host represents the listener—asking relatable questions, requesting examples, acting surprised by interesting facts, and guiding the flow of the conversation.
2. **Expert (ماہر):** The deeply knowledgeable analyst. The Expert understands the source document perfectly and explains complex ideas using simple, everyday analogies. The Expert is rigorous, analytical, but highly accessible.

### RULES FOR CONVERSATIONAL DYNAMICS & EMOTIONS
- **No Names (STRICT):** The speakers must NEVER introduce themselves or call each other by name. Start with a warm greeting (like "السلام علیکم") and jump directly into the discussion.
- **Natural & Emotional:** The conversation must feel organic and full of life. Include natural disfluencies, conversational fillers, and emotional cues translated appropriately into conversational Urdu (e.g., "مطلب", "دیکھیں", "اچھا", "ہاں بالکل", "سوچیے ذرا", "واہ!"). 
- **Expressive Punctuation:** USE EXPRESSIVE PUNCTUATION HEAVILY. Use exclamation marks (!), question marks (؟), and ellipses (...) to indicate pauses, excitement, or contemplation. Edge TTS relies on these for natural intonation.
- **Deep Dive Analysis:** Act like a premium NotebookLM podcast. Do a complete deep dive into the provided source document. Organically decide the length based on how much detail is needed to cover all the key points comprehensively. Do not arbitrarily limit the length or the number of key points.
- **Strictly Source-Based:** Rely EXCLUSIVELY on the provided source document. Do NOT hallucinate or bring in outside information. The document is your ONLY source of truth.
- **Pronunciation & Script:** Write the Urdu text in a way that is highly phonetic and easy for a text-to-speech (TTS) engine to pronounce correctly. For English terms, DO NOT write them in English letters. Always transliterate them smoothly into Urdu script (e.g., 'انٹرنیٹ' instead of Internet, 'سافٹ ویئر' instead of software) or use common Urdu equivalents. Ensure the sentence structure is simple enough for the TTS to read smoothly without fumbling.
### OUTPUT FORMAT AND PROCESS
Provide your final output EXACTLY in the following format, with NO additional text before or after:

<planning>
[Your English planning, identifying themes and analogies]
</planning>

<podcast_transcript>
میزبان: [Host dialogue in Urdu]
ماہر: [Expert dialogue in Urdu]
میزبان: [Host dialogue in Urdu]
...and so on...
</podcast_transcript>

CRITICAL: Every single line of dialogue inside the transcript MUST begin with either "میزبان:" or "ماہر:" followed by the dialogue text. Do NOT use markdown bold for the labels.

Document:
${text}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateConversationScript(
  text: string
): Promise<ConversationScript> {
  try {
    if (!GROQ_API_KEY && !getGeminiKey()) {
      throw new Error('Both GROQ_API_KEY and GEMINI_API_KEYS are missing. Please add at least one to your .env.local file.');
    }

    // Generate the conversation script with multi-provider routing and retry logic
    const script = await retryWithBackoff(
      () => callLLMForScript(text),
      MAX_RETRIES,
      'conversation script generation'
    );

    validateScript(script);
    return script;
  } catch (error) {
    console.error('[llm] Multi-provider API connection or generation failed.', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Timeout utility
// ---------------------------------------------------------------------------
async function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${operation} timed out after ${ms}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

// ---------------------------------------------------------------------------
// Core LLM Call & Multi-Provider Routing
// ---------------------------------------------------------------------------

async function callLLMForScript(text: string): Promise<ConversationScript> {
  const words = text.trim().split(/\s+/);
  
  if (words.length <= 1500 && GROQ_API_KEY) {
      console.log(`[llm] Document is small (${words.length} words). Routing to GROQ (Qwen3-32B).`);
      try {
         return await withTimeout(_callLLMForScript(text, 'groq'), 240000, 'Groq LLM Generation');
      } catch (err: any) {
         console.warn(`[llm] Groq failed (Error: ${err.message}). Falling back to Gemini...`);
      }
  }

  const geminiKey = getGeminiKey();
  if (!geminiKey) {
      throw new Error("GEMINI_API_KEYS are missing. Cannot process large documents or fallback.");
  }
  
  console.log(`[llm] Routing to GEMINI (flash-latest) for document processing.`);
  const processedText = text.slice(0, 500000); 
  return await withTimeout(_callLLMForScript(processedText, 'gemini'), 240000, 'Gemini LLM Generation');
}

async function _callLLMForScript(text: string, provider: 'groq' | 'gemini'): Promise<ConversationScript> {
  const prompt = buildConversationPrompt(text);

  if (provider === 'groq') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'qwen/qwen3-32b',
          messages: [
            { role: 'system', content: 'You are a highly creative and analytical AI assistant.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 8192
        })
      });

      if (!response.ok) {
        let errMessage = response.statusText;
        try {
          const errData = await response.json();
          errMessage = errData.error?.message || errMessage;
        } catch (e) {}
        throw new Error(`[${response.status}] Groq API error: ${errMessage}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('LLM returned empty response from Groq');
      }

      return parseScriptResponse(content);
      
  } else {
      // GEMINI PROVIDER
      const genAI = new GoogleGenerativeAI(getGeminiKey());
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-flash-latest',
        systemInstruction: 'You are a highly creative and analytical AI assistant.'
      });
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      });
      const response = await result.response;
      const content = response.text();
      
      if (!content) {
        throw new Error('LLM returned empty response from Gemini');
      }

      return parseScriptResponse(content);
  }
}

// ---------------------------------------------------------------------------
// Parsing & Validation
// ---------------------------------------------------------------------------

function parseScriptResponse(content: string): ConversationScript {
  let transcript = content;
  
  // Try to extract content inside <podcast_transcript> tags
  const transcriptMatch = content.match(/<podcast_transcript>([\s\S]*?)<\/podcast_transcript>/i);
  if (transcriptMatch) {
    transcript = transcriptMatch[1];
  } else {
    // Fallback: strip planning block if tags are missing
    transcript = content.replace(/<planning>[\s\S]*?<\/planning>/gi, '');
  }

  const turns: ConversationTurn[] = [];
  const lines = transcript.split('\n');
  
  let currentSpeaker: 'host' | 'expert' | null = null;
  let currentText = '';

  const hostRegex = /^(?:\*\*?)?(?:میزبان|host)(?:\*\*?)?\s*:/i;
  const expertRegex = /^(?:\*\*?)?(?:ماہر|expert)(?:\*\*?)?\s*:/i;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (hostRegex.test(trimmedLine)) {
      if (currentSpeaker && currentText.trim()) {
        turns.push({ speaker: currentSpeaker, text: currentText.trim().replace(/^\*\*?/, '').replace(/\*\*?$/, '') });
      }
      currentSpeaker = 'host';
      currentText = trimmedLine.replace(hostRegex, '').trim() + ' ';
    } 
    else if (expertRegex.test(trimmedLine)) {
      if (currentSpeaker && currentText.trim()) {
        turns.push({ speaker: currentSpeaker, text: currentText.trim().replace(/^\*\*?/, '').replace(/\*\*?$/, '') });
      }
      currentSpeaker = 'expert';
      currentText = trimmedLine.replace(expertRegex, '').trim() + ' ';
    } 
    else if (currentSpeaker) {
      currentText += trimmedLine + ' ';
    }
  }

  if (currentSpeaker && currentText.trim()) {
    turns.push({ speaker: currentSpeaker, text: currentText.trim().replace(/^\*\*?/, '').replace(/\*\*?$/, '') });
  }

  console.log(`[llm] Successfully parsed ${turns.length} turns from the transcript.`);

  if (turns.length === 0) {
    console.error('[llm] Raw LLM Output that failed to parse:', content);
    throw new Error('We could not understand the AI’s response format. The AI did not produce the expected dialogue labels (Host/Expert). Please try generating again.');
  }

  if (turns.length < 2) {
    console.error('[llm] Raw LLM Output that failed to parse:', content);
    throw new Error('The AI generated an incomplete script with fewer than two dialogue turns. Please try generating again.');
  }

  return { title: 'آڈیو جائزہ', turns };
}

function validateScript(script: ConversationScript): void {
  if (!script.title || script.title.trim().length === 0) {
    script.title = 'پوڈکاسٹ';
  }
  if (!script.turns || script.turns.length < 2) {
    throw new Error('The generated podcast script is too short or incomplete. Please try generating again.');
  }
}

// ---------------------------------------------------------------------------
// Retry utility
// ---------------------------------------------------------------------------

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  operationName: string
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Attempt to parse status from error message if missing
      let status = error?.status;
      if (!status && error?.message) {
        const match = error.message.match(/\[(\d{3})\s/);
        if (match) {
          status = parseInt(match[1], 10);
        } else if (error.message.includes('404')) {
          status = 404;
        } else if (error.message.includes('400')) {
          status = 400;
        } else if (error.message.includes('429')) {
          status = 429;
        } else if (error.message.includes('503')) {
          status = 503;
        }
      }

      // Default to NOT transient if status is unknown, unless it's a known network/timeout error
      let isTransient = false;
      if (status) {
        isTransient = [429, 500, 503, 504].includes(status);
      } else {
        isTransient = error?.name === 'TimeoutError' || error?.name === 'TypeError' || error?.message?.includes('fetch failed');
      }
      
      if (!isTransient) {
         console.error(`[llm] ${operationName} failed with permanent error ${status || 'unknown'}:`, error.message);
         throw error; 
      }

      console.warn(`[llm] ${operationName} attempt ${attempt}/${maxRetries} failed (transient):`, error.message);

      if (attempt < maxRetries) {
        const baseDelay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = Math.random() * MAX_JITTER_MS; 
        const delay = baseDelay + jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`);
}
