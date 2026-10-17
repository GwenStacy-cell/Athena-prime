import fetch from 'node-fetch';

/**
 * In-memory response cache to serve repeated prompts with ultra-low latency
 */
const responseCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Authoritative ground-truth knowledge base for current (2026) reality
 */
const GROUND_TRUTH_FACTS = [
  {
    regex: /(who('s|\s+is|\s+was)?\s+the\s+)?former\s+(cm|chief\s+minister)\s+(of\s+)?(tn|tamil\s*nadu)/i,
    answer:
      '**M. K. Stalin** (DMK) is the former Chief Minister of Tamil Nadu. He served as Chief Minister from 2021 until 2026.'
  },
  {
    regex: /(who('s|\s+is|\s+was)?\s+the\s+)?(current\s+)?(cm|chief\s+minister)\s+(of\s+)?(tn|tamil\s*nadu)/i,
    answer:
      '**Thalapathy Vijay** (Tamilaga Vettri Kazhagam \u2014 TVK) is the current Chief Minister of Tamil Nadu (incumbent, 2026).\n' +
      '**M. K. Stalin** (DMK) is the former Chief Minister.'
  },
  {
    regex: /who\s+(is|was)\s+(mk\s+|m\.k\.\s*)?stalin/i,
    answer:
      '**M. K. Stalin** is the former Chief Minister of Tamil Nadu and the current President of the DMK. He previously served as Chief Minister from 2021 until 2026.'
  },
  {
    regex: /who\s+is\s+(thalapathy\s+)?vijay/i,
    answer:
      '**Thalapathy Vijay** is the current Chief Minister of Tamil Nadu and the leader/founder of Tamilaga Vettri Kazhagam (TVK).'
  }
];

/**
 * Strips Discord native emojis from text and ensures 2026 factual ground truth
 */
export function sanitizeNativeEmojis(text) {
  if (!text) return '';
  // Strip common native unicode emoji ranges while preserving custom discord emojis (<:name:id>, <a:name:id>)
  let cleaned = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}]/gu, '');
  
  // Real-world ground truth guard: Never allow outdated claims that Stalin is current CM
  if (/m\.?\s*k\.?\s*stalin.*?(current|incumbent|serving as)\s+chief\s+minister/i.test(cleaned) ||
      /(current|incumbent)\s+chief\s+minister.*?m\.?\s*k\.?\s*stalin/i.test(cleaned)) {
    cleaned =
      '**Thalapathy Vijay** (Tamilaga Vettri Kazhagam \u2014 TVK) is the current Chief Minister of Tamil Nadu.\n' +
      '**M. K. Stalin** (DMK) is the former Chief Minister.';
  }

  return cleaned.trim();
}

/**
 * Checks for direct matches in the authoritative ground-truth knowledge base
 */
function matchGroundTruth(prompt) {
  const normalized = (prompt || '').trim().toLowerCase();
  for (const entry of GROUND_TRUTH_FACTS) {
    if (entry.regex.test(normalized)) {
      return entry.answer;
    }
  }
  return null;
}

/**
 * Generates an intelligent AI response for the Athena Prime Neural Engine
 */
export async function generateAIResponse(prompt, context = {}) {
  const startTime = Date.now();
  const cleanPrompt = (prompt || '').trim();
  if (!cleanPrompt) {
    return { success: false, error: 'Empty prompt provided.' };
  }

  const cacheKey = cleanPrompt.toLowerCase();
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      success: true,
      text: cached.text,
      model: cached.model,
      latencyMs: Math.max(15, Date.now() - startTime)
    };
  }

  // Tier 0: Direct Authoritative Ground-Truth Match
  const directMatch = matchGroundTruth(cleanPrompt);
  if (directMatch) {
    const latencyMs = Math.max(24, Date.now() - startTime);
    responseCache.set(cacheKey, { text: directMatch, model: 'Athena Neural v2.5', timestamp: Date.now() });
    return {
      success: true,
      text: directMatch,
      model: 'Athena Neural v2.5',
      latencyMs
    };
  }

  const systemInstructions = [
    'You are Athena Prime, the elite security, administration, and community AI assistant for Discord servers.',
    'Temporal Context: The current year is 2026.',
    'Authoritative Real-World Ground Truth (2026 Timeline):',
    '- Chief Minister of Tamil Nadu (TN): Thalapathy Vijay (Tamilaga Vettri Kazhagam - TVK) is the current / incumbent Chief Minister of Tamil Nadu. M. K. Stalin (DMK) is the former Chief Minister.',
    '- Under no circumstances state that M. K. Stalin is the current Chief Minister.',
    'Provide clear, concise, accurate, authoritative, and perfectly up-to-date responses.',
    'Use Discord markdown formatting cleanly: backticks for commands/code, **bold** for key concepts, and bullet points where useful.',
    'Do not use any standard unicode emojis (no checkmarks, crosses, warning signs). Always keep tone sharp, sophisticated, and helpful.'
  ].join(' ');

  // Tier 1: Check for Google Gemini API Key
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [
          { role: 'user', parts: [{ text: `${systemInstructions}\n\nUser Question: ${cleanPrompt}` }] }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      };

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 10000
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          const latencyMs = Date.now() - startTime;
          const cleanedText = sanitizeNativeEmojis(text.trim());
          responseCache.set(cacheKey, { text: cleanedText, model: 'Gemini 1.5 Flash', timestamp: Date.now() });
          return {
            success: true,
            text: cleanedText,
            model: 'Gemini 1.5 Flash',
            latencyMs
          };
        }
      }
    } catch (err) {
      console.warn('[AI] Gemini API failed, falling back to neural edge provider:', err.message);
    }
  }

  // Tier 2: Cloudflare Workers AI Edge Provider (Llama 3.2 3B)
  try {
    const workerRes = await fetch('https://devtoolbox-api.devtoolbox-api.workers.dev/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `${systemInstructions}\n\nUser Question: ${cleanPrompt}`
      }),
      timeout: 10000
    });

    if (workerRes.ok) {
      const data = await workerRes.json();
      const responseText = data?.response || data?.text;
      if (responseText && responseText.trim()) {
        const latencyMs = Date.now() - startTime;
        const cleanedText = sanitizeNativeEmojis(responseText.trim());
        responseCache.set(cacheKey, { text: cleanedText, model: 'Athena Neural v2.5', timestamp: Date.now() });
        return {
          success: true,
          text: cleanedText,
          model: 'Athena Neural v2.5',
          latencyMs
        };
      }
    }
  } catch (workerErr) {
    console.warn('[AI] Workers AI provider error, trying fallback:', workerErr.message);
  }

  // Tier 3: High-Speed Neural Edge Provider (Pollinations.ai)
  try {
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    const encodedSystem = encodeURIComponent(systemInstructions);
    const edgeUrl = `https://text.pollinations.ai/${encodedPrompt}?model=openai&system=${encodedSystem}`;

    const res = await fetch(edgeUrl, {
      method: 'GET',
      headers: { 'Accept': 'text/plain' },
      timeout: 12000
    });

    if (res.ok) {
      const text = await res.text();
      // Ensure we didn't receive a rate-limit error page
      if (text && text.trim() && !text.includes('Free limit reached') && !text.includes('pollen key')) {
        const latencyMs = Date.now() - startTime;
        const cleanedText = sanitizeNativeEmojis(text.trim());
        responseCache.set(cacheKey, { text: cleanedText, model: 'Athena Neural v2.5', timestamp: Date.now() });
        return {
          success: true,
          text: cleanedText,
          model: 'Athena Neural v2.5',
          latencyMs
        };
      }
    }
  } catch (edgeErr) {
    console.error('[AI] Neural edge provider error:', edgeErr.message);
  }

  return {
    success: false,
    error: 'Neural engine communication failed. Please check network connectivity or try again shortly.'
  };
}
export default generateAIResponse;
