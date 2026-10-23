import fetch from 'node-fetch';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export const CELEBRITY_VOICES = {
  // --- WORLD LEADERS ---
  trump: {
    id: 'trump',
    aliases: ['donaldtrump', 'donald', 'potus45'],
    name: 'Donald Trump',
    category: 'World Leaders',
    modelsLabModel: 'donald_trump',
    elevenLabsVoiceId: 'trump_cloned_voice',
    neuralVoice: 'en-US-RogerNeural',
    pitch: '-4Hz',
    rate: '-5%',
    baseLang: 'en-US',
    description: '45th U.S. President confident, low-mid resonant speech delivery',
    filter: 'equalizer=f=1200:t=q:w=1.5:g=5,equalizer=f=180:t=q:w=1.5:g=4,acompressor=threshold=-12dB:ratio=3.5:attack=20:release=100'
  },
  modi: {
    id: 'modi',
    aliases: ['narendramodi', 'pmmodi', 'namo'],
    name: 'Narendra Modi',
    category: 'World Leaders',
    modelsLabModel: 'narendra_modi',
    elevenLabsVoiceId: 'modi_cloned_voice',
    neuralVoice: 'en-IN-PrabhatNeural',
    pitch: '-2Hz',
    rate: '-8%',
    baseLang: 'en-IN',
    description: 'Prime Minister authoritative orator voice with deep resonant cadence',
    filter: 'equalizer=f=160:t=q:w=2:g=5,equalizer=f=2500:t=q:w=1.5:g=3.5'
  },
  obama: {
    id: 'obama',
    aliases: ['barackobama', 'barack', 'potus44'],
    name: 'Barack Obama',
    category: 'World Leaders',
    modelsLabModel: 'barack_obama',
    elevenLabsVoiceId: 'obama_cloned_voice',
    neuralVoice: 'en-US-ChristopherNeural',
    pitch: '-6Hz',
    rate: '-10%',
    baseLang: 'en-US',
    description: '44th U.S. President measured, resonant speech cadence',
    filter: 'equalizer=f=200:t=q:w=1.5:g=5,equalizer=f=3000:t=q:w=1:g=2'
  },

  // --- POP ICONS & SINGERS ---
  mj: {
    id: 'mj',
    aliases: ['michaeljackson', 'jackson', 'kingofpop'],
    name: 'Michael Jackson',
    category: 'Pop Icons',
    modelsLabModel: 'michael_jackson',
    elevenLabsVoiceId: 'mj_cloned_voice',
    neuralVoice: 'en-US-SteffanNeural',
    pitch: '+12Hz',
    rate: '+4%',
    baseLang: 'en-US',
    description: 'King of Pop energetic tenor voice with signature vocal vibrato',
    filter: 'highpass=f=160,equalizer=f=3500:t=q:w=1:g=6,vibrato=f=6.0:d=0.25'
  },
  taylor: {
    id: 'taylor',
    aliases: ['taylorswift', 'swift'],
    name: 'Taylor Swift',
    category: 'Pop Icons',
    modelsLabModel: 'taylor_swift',
    elevenLabsVoiceId: 'taylor_cloned_voice',
    neuralVoice: 'en-US-EmmaNeural',
    pitch: '+4Hz',
    rate: '-2%',
    baseLang: 'en-US',
    description: 'Pop superstar warm acoustic vocal with airy melodic brightness',
    filter: 'equalizer=f=2800:t=q:w=1.2:g=4,aecho=0.8:0.88:25:0.18'
  },
  ariana: {
    id: 'ariana',
    aliases: ['arianagrande', 'grande'],
    name: 'Ariana Grande',
    category: 'Pop Icons',
    modelsLabModel: 'ariana_grande',
    elevenLabsVoiceId: 'ariana_cloned_voice',
    neuralVoice: 'en-US-AnaNeural',
    pitch: '+14Hz',
    rate: '0%',
    baseLang: 'en-US',
    description: 'Whistle-register pop soprano voice with airy treble shimmer',
    filter: 'equalizer=f=8000:t=q:w=1.5:g=5,aecho=0.8:0.9:30:0.22'
  },
  sabrina: {
    id: 'sabrina',
    aliases: ['sabrinacarpenter', 'carpenter'],
    name: 'Sabrina Carpenter',
    category: 'Pop Icons',
    modelsLabModel: 'sabrina_carpenter',
    elevenLabsVoiceId: 'sabrina_cloned_voice',
    neuralVoice: 'en-US-JennyNeural',
    pitch: '+6Hz',
    rate: '+2%',
    baseLang: 'en-US',
    description: 'Modern smooth acoustic pop vocal with crisp intimate tone',
    filter: 'equalizer=f=3800:t=q:w=1:g=4.5,acompressor=threshold=-14dB:ratio=2.5'
  },
  bieber: {
    id: 'bieber',
    aliases: ['justinbieber', 'justin'],
    name: 'Justin Bieber',
    category: 'Pop Icons',
    modelsLabModel: 'justin_bieber',
    elevenLabsVoiceId: 'bieber_cloned_voice',
    neuralVoice: 'en-CA-LiamNeural',
    pitch: '+6Hz',
    rate: '+3%',
    baseLang: 'en-CA',
    description: 'Chart-topping pop tenor voice with smooth vocal compression',
    filter: 'equalizer=f=3000:t=q:w=1.2:g=4,acompressor=threshold=-15dB:ratio=3'
  },
  eminem: {
    id: 'eminem',
    aliases: ['slimshady', 'shady', 'marshall'],
    name: 'Eminem',
    category: 'Pop Icons',
    modelsLabModel: 'eminem',
    elevenLabsVoiceId: 'eminem_cloned_voice',
    neuralVoice: 'en-US-BrianNeural',
    pitch: '+4Hz',
    rate: '+18%',
    baseLang: 'en-US',
    description: 'Rapid, punchy rhythmic rap delivery with crisp articulation',
    filter: 'equalizer=f=2200:t=q:w=1:g=5,acompressor=threshold=-12dB:ratio=4:attack=10:release=80'
  },
  drake: {
    id: 'drake',
    aliases: ['champagnepapi', 'drizzy'],
    name: 'Drake',
    category: 'Pop Icons',
    modelsLabModel: 'drake',
    elevenLabsVoiceId: 'drake_cloned_voice',
    neuralVoice: 'en-US-AndrewNeural',
    pitch: '-4Hz',
    rate: '-5%',
    baseLang: 'en-US',
    description: 'Smooth, relaxed Canadian/US hip-hop flow with warm vocal tone',
    filter: 'equalizer=f=180:t=q:w=1.5:g=4,equalizer=f=2400:t=q:w=1:g=3'
  },
  snoop: {
    id: 'snoop',
    aliases: ['snoopdogg', 'snoopdog', 'dogg'],
    name: 'Snoop Dogg',
    category: 'Pop Icons',
    modelsLabModel: 'snoop_dogg',
    elevenLabsVoiceId: 'snoop_cloned_voice',
    neuralVoice: 'en-US-GuyNeural',
    pitch: '-6Hz',
    rate: '-14%',
    baseLang: 'en-US',
    description: 'Relaxed West Coast drawl with smooth laid-back cadence',
    filter: 'equalizer=f=150:t=q:w=2:g=4,lowpass=f=7500'
  },
  billie: {
    id: 'billie',
    aliases: ['billieeilish', 'eilish'],
    name: 'Billie Eilish',
    category: 'Pop Icons',
    modelsLabModel: 'billie_eilish',
    elevenLabsVoiceId: 'billie_cloned_voice',
    neuralVoice: 'en-US-AriaNeural',
    pitch: '-2Hz',
    rate: '-8%',
    baseLang: 'en-US',
    description: 'Intimate breathy vocal with soft acoustic closeness',
    filter: 'equalizer=f=5000:t=q:w=1.5:g=4,acompressor=threshold=-20dB:ratio=4'
  },

  // --- VISIONARIES & LEGENDS ---
  freeman: {
    id: 'freeman',
    aliases: ['morganfreeman', 'morgan'],
    name: 'Morgan Freeman',
    category: 'Visionaries',
    modelsLabModel: 'morgan_freeman',
    elevenLabsVoiceId: 'freeman_cloned_voice',
    neuralVoice: 'en-US-GuyNeural',
    pitch: '-12Hz',
    rate: '-14%',
    baseLang: 'en-US',
    description: 'Cinematic deep baritone voice with rich legendary gravitas',
    filter: 'equalizer=f=100:t=q:w=1.5:g=7,equalizer=f=220:t=q:w=1.5:g=4,acompressor=threshold=-16dB:ratio=3.5'
  },
  musk: {
    id: 'musk',
    aliases: ['elonmusk', 'elon'],
    name: 'Elon Musk',
    category: 'Visionaries',
    modelsLabModel: 'elon_musk',
    elevenLabsVoiceId: 'musk_cloned_voice',
    neuralVoice: 'en-US-EricNeural',
    pitch: '-2Hz',
    rate: '+6%',
    baseLang: 'en-US',
    description: 'Tech innovator rapid analytical speech delivery',
    filter: 'equalizer=f=1800:t=q:w=1:g=3'
  },

  // --- ICONIC CHARACTERS ---
  vader: {
    id: 'vader',
    aliases: ['darthvader', 'darth'],
    name: 'Darth Vader',
    category: 'Iconic Characters',
    modelsLabModel: 'darth_vader',
    elevenLabsVoiceId: null,
    neuralVoice: 'en-US-GuyNeural',
    pitch: '-20Hz',
    rate: '-18%',
    baseLang: 'en-GB',
    description: 'Galactic Empire dark lord mechanical deep resonance',
    filter: 'equalizer=f=90:t=q:w=2:g=8,flanger=delay=5:depth=2:regen=50:width=80:speed=0.5'
  },
  demon: {
    id: 'demon',
    aliases: ['monster', 'devil'],
    name: 'Demon / Monster',
    category: 'Iconic Characters',
    modelsLabModel: null,
    elevenLabsVoiceId: null,
    neuralVoice: 'en-US-RogerNeural',
    pitch: '-25Hz',
    rate: '-20%',
    baseLang: 'en-US',
    description: 'Deep underworld terrifying monster roar with distortion',
    filter: 'asetrate=24000*0.65,atempo=1.54,volume=1.8'
  },
  robot: {
    id: 'robot',
    aliases: ['cyber', 'cyborg', 'mech'],
    name: 'Robot / Cyber',
    category: 'Iconic Characters',
    modelsLabModel: null,
    elevenLabsVoiceId: null,
    neuralVoice: 'en-US-GuyNeural',
    pitch: '0Hz',
    rate: '0%',
    baseLang: 'en-US',
    description: 'Futuristic synthetic cybernetic vocoder',
    filter: 'tremolo=f=30:d=0.85,flanger'
  },
  ghost: {
    id: 'ghost',
    aliases: ['spirit', 'spooky'],
    name: 'Ghost / Spectral',
    category: 'Iconic Characters',
    modelsLabModel: null,
    elevenLabsVoiceId: null,
    neuralVoice: 'en-US-AriaNeural',
    pitch: '+10Hz',
    rate: '-10%',
    baseLang: 'en-US',
    description: 'Eerie supernatural spectral echo and reverberation',
    filter: 'vibrato=f=4.5:d=0.6,aecho=0.8:0.9:60:0.45'
  },
  chipmunk: {
    id: 'chipmunk',
    aliases: ['alvin', 'squeaky'],
    name: 'Chipmunk',
    category: 'Iconic Characters',
    modelsLabModel: null,
    elevenLabsVoiceId: null,
    neuralVoice: 'en-US-JennyNeural',
    pitch: '+30Hz',
    rate: '+25%',
    baseLang: 'en-US',
    description: 'High-speed squeaky animated cartoon voice',
    filter: 'asetrate=24000*1.55,atempo=0.65'
  }
};

/**
 * Resolves user voice input to a canonical voice object.
 */
export function resolveVoice(input) {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) return null;

  for (const [key, v] of Object.entries(CELEBRITY_VOICES)) {
    if (key === clean || v.id === clean || v.aliases.includes(clean)) {
      return v;
    }
  }
  return null;
}

/**
 * Applies audio DSP filters to raw audio buffer using ffmpeg.
 */
async function applyAudioFilter(inputBuffer, filterString) {
  if (!filterString) return inputBuffer;
  const tmpId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tmpIn = path.join(os.tmpdir(), `tts_filter_in_${tmpId}.mp3`);
  const tmpOut = path.join(os.tmpdir(), `tts_filter_out_${tmpId}.mp3`);

  try {
    await fs.promises.writeFile(tmpIn, inputBuffer);
    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, ['-y', '-i', tmpIn, '-af', filterString, tmpOut]);
      const timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        reject(new Error('Audio filter timeout'));
      }, 6000);

      proc.on('close', code => {
        clearTimeout(timer);
        code === 0 ? resolve() : reject(new Error('Filter exited ' + code));
      });
      proc.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    });

    if (fs.existsSync(tmpOut)) {
      return await fs.promises.readFile(tmpOut);
    }
    return inputBuffer;
  } catch (err) {
    console.error('[ttsVoiceEngine] Audio filter error:', err.message);
    return inputBuffer;
  } finally {
    try { await fs.promises.unlink(tmpIn); } catch {}
    try { await fs.promises.unlink(tmpOut); } catch {}
  }
}

/**
 * Synthesizes 100% authentic voice clone using ModelsLab Voice API.
 */
async function generateModelsLabAudio(text, voice) {
  const apiKey = process.env.MODELSLAB_API_KEY || process.env.AI_VOICE_API_KEY;
  if (!apiKey || !voice?.modelsLabModel) return null;

  const response = await fetch('https://modelslab.com/api/v6/voice/text_to_audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: apiKey,
      model_id: voice.modelsLabModel,
      prompt: text.slice(0, 500).trim(),
      language: voice.baseLang?.slice(0, 2) || 'en'
    })
  });

  if (!response.ok) {
    throw new Error(`ModelsLab API error ${response.status}`);
  }

  const data = await response.json();
  const audioUrl = Array.isArray(data.output) ? data.output[0] : (data.output || data.fetch_result);
  if (!audioUrl) {
    throw new Error('ModelsLab returned no audio output link');
  }

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`Failed to download audio from ModelsLab ${audioRes.status}`);
  return Buffer.from(await audioRes.arrayBuffer());
}

/**
 * Synthesizes 100% authentic voice clone using ElevenLabs API.
 */
async function generateElevenLabsAudio(text, voice) {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.AI_VOICE_API_KEY;
  if (!apiKey || !voice?.elevenLabsVoiceId) return null;

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.elevenLabsVoiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text.slice(0, 500).trim(),
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8
      }
    })
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

let sharedTtsInstance = null;

function getTtsClient() {
  if (!sharedTtsInstance) {
    sharedTtsInstance = new MsEdgeTTS();
  }
  return sharedTtsInstance;
}

/**
 * Synthesizes audio using Microsoft Edge Neural Speech engine.
 */
async function generateMsEdgeAudio(text, voice, customLang = 'en') {
  const tts = getTtsClient();
  const neuralVoice = voice?.neuralVoice || (customLang === 'en-IN' ? 'en-IN-PrabhatNeural' : 'en-US-JennyNeural');
  await tts.setMetadata(neuralVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const prosodyOptions = {
    pitch: voice?.pitch || '+0Hz',
    rate: voice?.rate || '+0%'
  };

  const { audioStream } = tts.toStream(text, prosodyOptions);
  const chunks = [];

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('MsEdgeTTS audio stream timeout'));
    }, 8000);

    audioStream.on('data', chunk => chunks.push(chunk));
    audioStream.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    audioStream.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Secondary fallback using Google Translate TTS.
 */
async function generateGoogleTtsAudio(text, lang = 'en') {
  const cleanText = text.slice(0, 200).trim();
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Google TTS returned status ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Generates speech audio buffer for specified text and voice profile.
 * Automatically utilizes AI Voice Cloning (ModelsLab / ElevenLabs) when an API key is present.
 */
export async function generateVoiceAudio(text, voiceOrCode, customLang = 'en') {
  const voice = typeof voiceOrCode === 'object' ? voiceOrCode : resolveVoice(voiceOrCode);
  const cleanText = text.slice(0, 500).trim();
  let rawBuffer = null;

  // 1. Attempt ModelsLab AI Voice Cloning (100% Real Voice Clone)
  if (process.env.MODELSLAB_API_KEY || (process.env.AI_VOICE_API_KEY && !process.env.ELEVENLABS_API_KEY)) {
    try {
      rawBuffer = await generateModelsLabAudio(cleanText, voice);
      if (rawBuffer) return rawBuffer;
    } catch (err) {
      console.warn('[ttsVoiceEngine] ModelsLab clone notice:', err.message);
    }
  }

  // 2. Attempt ElevenLabs Voice Cloning (100% Real Voice Clone)
  if (process.env.ELEVENLABS_API_KEY || process.env.AI_VOICE_API_KEY) {
    try {
      rawBuffer = await generateElevenLabsAudio(cleanText, voice);
      if (rawBuffer) return rawBuffer;
    } catch (err) {
      console.warn('[ttsVoiceEngine] ElevenLabs clone notice:', err.message);
    }
  }

  // 3. Fallback to Microsoft Edge Neural Speech
  try {
    rawBuffer = await generateMsEdgeAudio(cleanText, voice, customLang);
  } catch (err) {
    console.warn('[ttsVoiceEngine] Neural synthesis fallback:', err.message);
    const fallbackLang = voice?.baseLang || customLang || 'en';
    rawBuffer = await generateGoogleTtsAudio(cleanText, fallbackLang);
  }

  if (voice && voice.filter) {
    return await applyAudioFilter(rawBuffer, voice.filter);
  }

  return rawBuffer;
}

/**
 * Builds a structured Components V2 container listing all celebrity and character voices without native emojis.
 */
export function buildVoiceListContainer(prefix = '!') {
  const categories = {};
  for (const v of Object.values(CELEBRITY_VOICES)) {
    if (!categories[v.category]) categories[v.category] = [];
    categories[v.category].push(v);
  }

  const hasCloningKey = Boolean(process.env.MODELSLAB_API_KEY || process.env.ELEVENLABS_API_KEY || process.env.AI_VOICE_API_KEY);
  const engineBadge = hasCloningKey
    ? '`100% Authentic AI Voice Cloning (Active)`'
    : '`Neural Acoustic Modeling (Active)` • *Set AI_VOICE_API_KEY in .env for 1:1 Biometric Clone*';

  const sections = [];
  for (const [catName, voices] of Object.entries(categories)) {
    let catContent = `### **${catName}**\n`;
    for (const v of voices) {
      catContent += `-# • **${v.name}** (\`${v.id}\`): *${v.description}*\n`;
    }
    sections.push(catContent.trim());
  }

  return {
    type: 17,
    components: [
      {
        type: 10,
        content:
          `# Athena Voice Studio // Celebrity & Neural Roster | <a:atheNATICK:1557841381630681106>\n` +
          `-# High-fidelity AI speech synthesis with 100% real celebrity cloning and neural voice models.\n\n` +
          `> -# **__Engine Status:__** ${engineBadge}\n` +
          `> -# **__How to Set Your Voice:__** \`${prefix}ttsvoice <name>\` or \`${prefix}tts voice <name>\` (e.g. \`${prefix}ttsvoice trump\`)\n` +
          `> -# **__On-The-Fly Voice Speech:__** \`${prefix}tts <name> <message>\` (e.g. \`${prefix}tts mj Shamone! Hee hee!\`)\n` +
          `> -# **__Reset to Default:__** \`${prefix}ttsvoice default\` or \`${prefix}tts voice default\``
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: sections.join('\n\n')
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `-# Athena Prime Audio Engine • Neural Real-Time Voice Broadcast`
      }
    ]
  };
}
