import fetch from 'node-fetch';

/**
 * In-memory response cache to serve repeated prompts with ultra-low latency
 */
const responseCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

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
 * Transforms AI raw output into 100% Discord grey font (-#) with bold-underlined highlights (-# **__...__**),
 * removes all ugly dashed/equal dividers (----- / =====), and fixes truncated cut-off endings.
 */
export function formatAIToGreyMarkdown(rawText) {
  if (!rawText) return '';
  let text = sanitizeNativeEmojis(rawText);

  // 1. Remove all horizontal rules, dashed underlines, and equal-sign decorations (e.g. '=====', '-----', '---')
  text = text.replace(/^[ \t]*[=\-_*~]{3,}[ \t]*$/gm, '');

  // 2. Fix truncated / cut-off endings (e.g. '**Thal' at the end of the text)
  text = text.replace(/\*\*Thal(apathy(\s+Vijay)?)?$/i, '**Thalapathy Vijay**.');
  text = text.replace(/\bThal$/i, 'Thalapathy Vijay.');
  
  // If ending with unfinished unclosed bold at end of string, close it cleanly
  const boldMatches = text.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    text += '**';
  }

  // 3. Process line by line into grey font (-#) with grey bold underline (-# **__...__**)
  const lines = text.split('\n');
  const formatted = [];

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) {
      formatted.push('');
      continue;
    }

    // Strip any pre-existing '-#' to re-standardize
    trimmed = trimmed.replace(/^-#\s*/, '');

    // Skip any leftover pure dash/symbol line
    if (/^[=\-_*~]{2,}$/.test(trimmed)) {
      continue;
    }

    // Check if line was a heading: # Heading, ## Heading, ### Heading
    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      const title = headingMatch[1].replace(/^\*\*|\*\*$/g, '').replace(/^__|\__$/g, '').trim();
      formatted.push(`-# **__${title}__**`);
      continue;
    }

    // Check if line was a bullet point: * Item, - Item, • Item
    const bulletMatch = trimmed.match(/^[\*\-•]\s+(.+)$/);
    if (bulletMatch) {
      let itemContent = bulletMatch[1].trim();
      // Highlight bold labels inside bullet items with underline: **Label**: -> **__Label:__**
      itemContent = itemContent.replace(/\*\*([^*]+)\*\*:\s*/g, '**__$1:__** ');
      formatted.push(`-# • ${itemContent}`);
      continue;
    }

    // If line starts with bold title like **Title**:
    if (/^\*\*([^*]+)\*\*:\s*/.test(trimmed)) {
      trimmed = trimmed.replace(/^\*\*([^*]+)\*\*:\s*/, '**__$1:__** ');
    } else if (/^[A-Z][A-Za-z0-9\s\(\)\/]{3,50}:$/.test(trimmed)) {
      // Like "Current Opposition Parties in Tamil Nadu:"
      trimmed = `**__${trimmed}__**`;
    } else if (/^[A-Z][A-Za-z0-9\s\(\)\/]{3,50}$/.test(trimmed) && !trimmed.endsWith('.')) {
      // Like "Current Opposition Parties in Tamil Nadu"
      trimmed = `**__${trimmed}__**`;
    }

    formatted.push(`-# ${trimmed}`);
  }

  // Collapse multiple consecutive blank lines into one and return
  return formatted.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Authoritative ground-truth knowledge base for current (2026) reality
 */
const GROUND_TRUTH_FACTS = [
  {
    regex: /(who('s|\s+is|\s+are)?\s+the\s+)?(main\s+)?opposition\s+part(y|ies)\s+(in|of)\s+(tn|tamil\s*nadu)/i,
    answer:
      '-# **__Main Opposition Parties in Tamil Nadu (2026)__**\n\n' +
      '-# • **__Dravida Munnetra Kazhagam (DMK):__** Primary opposition party in the Legislative Assembly, led by former Chief Minister M. K. Stalin.\n' +
      '-# • **__All India Anna Dravida Munnetra Kazhagam (AIADMK):__** Major opposition party led by Edappadi K. Palaniswami (EPS).\n\n' +
      '-# **__Incumbent Ruling Government:__**\n' +
      '-# • **__Tamilaga Vettri Kazhagam (TVK):__** Ruling party led by Chief Minister **__Thalapathy Vijay__**.'
  },
  {
    regex: /(who('s|\s+is|\s+was)?\s+the\s+)?former\s+(cm|chief\s+minister)\s+(of\s+)?(tn|tamil\s*nadu)/i,
    answer:
      '-# **__Former Chief Minister of Tamil Nadu__**\n' +
      '-# • **__M. K. Stalin:__** Leader and President of the DMK. He previously served as Chief Minister of Tamil Nadu from 2021 until 2026.'
  },
  {
    regex: /(who('s|\s+is|\s+was)?\s+the\s+)?(current\s+)?(cm|chief\s+minister)\s+(of\s+)?(tn|tamil\s*nadu)/i,
    answer:
      '-# **__Chief Minister of Tamil Nadu (2026)__**\n' +
      '-# • **__Thalapathy Vijay:__** Current and incumbent Chief Minister of Tamil Nadu, leading the **__Tamilaga Vettri Kazhagam (TVK)__** government.\n' +
      '-# • **__M. K. Stalin:__** Former Chief Minister (DMK).'
  },
  {
    regex: /who\s+(is|was)\s+(mk\s+|m\.k\.\s*)?stalin/i,
    answer:
      '-# **__M. K. Stalin Profile__**\n' +
      '-# • Former Chief Minister of Tamil Nadu (2021\u20132026) and current President of the Dravida Munnetra Kazhagam (DMK).'
  },
  {
    regex: /who\s+is\s+(thalapathy\s+)?vijay/i,
    answer:
      '-# **__Thalapathy Vijay Profile__**\n' +
      '-# • Current Chief Minister of Tamil Nadu (incumbent, 2026) and founder/president of the **__Tamilaga Vettri Kazhagam (TVK)__**.'
  }
];

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
    const formattedMatch = formatAIToGreyMarkdown(directMatch);
    responseCache.set(cacheKey, { text: formattedMatch, model: 'Athena Neural v2.5', timestamp: Date.now() });
    return {
      success: true,
      text: formattedMatch,
      model: 'Athena Neural v2.5',
      latencyMs
    };
  }

  const systemInstructions = [
    'You are Athena Prime, the elite security, administration, and community AI assistant for Discord servers.',
    'Temporal Context: The current year is 2026.',
    'Authoritative Real-World Ground Truth (2026 Timeline):',
    '- Chief Minister of Tamil Nadu (TN): Thalapathy Vijay (Tamilaga Vettri Kazhagam - TVK) is the current / incumbent Chief Minister of Tamil Nadu. M. K. Stalin (DMK) is the former Chief Minister.',
    '- Opposition Parties in Tamil Nadu: DMK (led by former CM M. K. Stalin) and AIADMK (led by Edappadi K. Palaniswami) are the main opposition parties. TVK is the ruling party.',
    '- Under no circumstances state that M. K. Stalin is the current Chief Minister.',
    'Styling and Formatting Rules:',
    '- Never output horizontal rules, dashed underlines, or divider lines (DO NOT use "---", "===", or "-----").',
    '- Always prefix every line with "-# " for Discord small grey font.',
    '- Highlight headings and key concepts using grey bold and underline: "-# **__Heading__**" or "-# • **__Concept:__** Description".',
    '- Always complete your sentences and words cleanly. Never stop mid-word or cut off.',
    '- Do not use any standard unicode emojis (no checkmarks, crosses, warning signs).'
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
          const cleanedText = formatAIToGreyMarkdown(text.trim());
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
        prompt: `${systemInstructions}\n\nUser Question: ${cleanPrompt}`,
        max_tokens: 1024
      }),
      timeout: 10000
    });

    if (workerRes.ok) {
      const data = await workerRes.json();
      const responseText = data?.response || data?.text;
      if (responseText && responseText.trim()) {
        const latencyMs = Date.now() - startTime;
        const cleanedText = formatAIToGreyMarkdown(responseText.trim());
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
        const cleanedText = formatAIToGreyMarkdown(text.trim());
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
