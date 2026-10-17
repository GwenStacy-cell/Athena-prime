import fetch from 'node-fetch';

/**
 * Strips Discord native emojis from text according to bot rules
 */
export function sanitizeNativeEmojis(text) {
  if (!text) return '';
  // Strip common native unicode emoji ranges while preserving custom discord emojis (<:name:id>, <a:name:id>)
  return text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}]/gu, '');
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

  const systemInstructions = [
    'You are Athena Prime, the elite security, administration, and community AI assistant for Discord servers.',
    'Provide clear, concise, accurate, and authoritative responses.',
    'Use Discord markdown formatting cleanly: backticks for commands/code, **bold** for key concepts, and bullet points where useful.',
    'Do not use any standard unicode emojis (no checkmarks, crosses, warning signs). Always keep tone sharp, sophisticated, and helpful.'
  ].join(' ');

  // 1. Check for Google Gemini API Key
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
          return {
            success: true,
            text: sanitizeNativeEmojis(text.trim()),
            model: 'Gemini 1.5 Flash',
            latencyMs
          };
        }
      }
    } catch (err) {
      console.warn('[AI] Gemini API failed, falling back to neural edge provider:', err.message);
    }
  }

  // 2. High-Speed Neural Edge Provider (Pollinations.ai)
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
      if (text && text.trim()) {
        const latencyMs = Date.now() - startTime;
        return {
          success: true,
          text: sanitizeNativeEmojis(text.trim()),
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
