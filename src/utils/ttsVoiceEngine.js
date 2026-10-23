import fetch from 'node-fetch';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const CELEBRITY_VOICES = {
  // --- WORLD LEADERS ---
  trump: {
    id: 'trump',
    aliases: ['donaldtrump', 'donald', 'potus45'],
    name: 'Donald Trump',
    category: 'World Leaders',
    emoji: '🦅',
    baseLang: 'en-US',
    description: '45th U.S. President confident, low-mid resonant speech delivery',
    filter: 'asetrate=44100*0.88,atempo=1.12,equalizer=f=1200:t=q:w=1.5:g=6,acompressor=threshold=-12dB:ratio=4:attack=20:release=100'
  },
  modi: {
    id: 'modi',
    aliases: ['narendramodi', 'pmmodi', 'namo'],
    name: 'Narendra Modi',
    category: 'World Leaders',
    emoji: '🇮🇳',
    baseLang: 'en-IN',
    description: 'Prime Minister authoritative orator voice with deep resonant cadence',
    filter: 'asetrate=44100*0.92,atempo=0.88,equalizer=f=150:t=q:w=2:g=7,equalizer=f=2500:t=q:w=1.5:g=4'
  },
  obama: {
    id: 'obama',
    aliases: ['barackobama', 'barack', 'potus44'],
    name: 'Barack Obama',
    category: 'World Leaders',
    emoji: '🏛️',
    baseLang: 'en-US',
    description: '44th U.S. President measured, resonant speech cadence',
    filter: 'asetrate=44100*0.86,atempo=0.88,equalizer=f=200:t=q:w=1.5:g=6'
  },

  // --- POP ICONS & SINGERS ---
  mj: {
    id: 'mj',
    aliases: ['michaeljackson', 'jackson', 'kingofpop'],
    name: 'Michael Jackson',
    category: 'Pop Icons',
    emoji: '🎤',
    baseLang: 'en',
    description: 'King of Pop energetic tenor voice with signature vocal vibrato',
    filter: 'asetrate=44100*1.28,atempo=0.80,vibrato=f=6.5:d=0.35,equalizer=f=3500:t=q:w=1:g=7,highpass=f=200'
  },
  taylor: {
    id: 'taylor',
    aliases: ['taylorswift', 'swift'],
    name: 'Taylor Swift',
    category: 'Pop Icons',
    emoji: '✨',
    baseLang: 'en-US',
    description: 'Pop superstar warm acoustic vocal with airy melodic brightness',
    filter: 'asetrate=44100*1.12,atempo=0.90,equalizer=f=2500:t=q:w=1.2:g=4,aecho=0.8:0.88:20:0.2'
  },
  ariana: {
    id: 'ariana',
    aliases: ['arianagrande', 'grande'],
    name: 'Ariana Grande',
    category: 'Pop Icons',
    emoji: '☁️',
    baseLang: 'en-US',
    description: 'Whistle-register pop soprano voice with airy treble shimmer',
    filter: 'asetrate=44100*1.30,atempo=0.78,equalizer=f=8000:t=q:w=1.5:g=6,aecho=0.8:0.9:30:0.3'
  },
  sabrina: {
    id: 'sabrina',
    aliases: ['sabrinacarpenter', 'carpenter'],
    name: 'Sabrina Carpenter',
    category: 'Pop Icons',
    emoji: '💋',
    baseLang: 'en-US',
    description: 'Modern smooth acoustic pop vocal with crisp intimate tone',
    filter: 'asetrate=44100*1.16,atempo=0.87,equalizer=f=4000:t=q:w=1:g=5'
  },
  bieber: {
    id: 'bieber',
    aliases: ['justinbieber', 'justin'],
    name: 'Justin Bieber',
    category: 'Pop Icons',
    emoji: '🧢',
    baseLang: 'en-CA',
    description: 'Chart-topping pop tenor voice with smooth vocal compression',
    filter: 'asetrate=44100*1.08,atempo=0.93,equalizer=f=3000:t=q:w=1.2:g=4,acompressor=threshold=-15dB:ratio=3'
  },

  // --- VISIONARIES & CHARACTERS ---
  musk: {
    id: 'musk',
    aliases: ['elonmusk', 'elon'],
    name: 'Elon Musk',
    category: 'Visionaries',
    emoji: '🚀',
    baseLang: 'en-US',
    description: 'Tech innovator rapid analytical speech delivery',
    filter: 'asetrate=44100*0.95,atempo=1.02,equalizer=f=1800:t=q:w=1:g=3'
  },
  vader: {
    id: 'vader',
    aliases: ['darthvader', 'darth'],
    name: 'Darth Vader',
    category: 'Iconic Characters',
    emoji: '⚔️',
    baseLang: 'en-GB',
    description: 'Galactic Empire dark lord mechanical deep resonance',
    filter: 'asetrate=44100*0.62,atempo=1.55,flanger,equalizer=f=100:t=q:w=2:g=8'
  },
  chipmunk: {
    id: 'chipmunk',
    aliases: ['alvin', 'squeaky'],
    name: 'Chipmunk',
    category: 'Iconic Characters',
    emoji: '🐿️',
    baseLang: 'en',
    description: 'High-speed squeaky animated cartoon voice',
    filter: 'asetrate=44100*1.65,atempo=0.62'
  },
  demon: {
    id: 'demon',
    aliases: ['monster', 'devil'],
    name: 'Demon / Monster',
    category: 'Iconic Characters',
    emoji: '👹',
    baseLang: 'en',
    description: 'Deep underworld terrifying monster roar with distortion',
    filter: 'asetrate=44100*0.52,atempo=1.85,volume=1.8'
  },
  robot: {
    id: 'robot',
    aliases: ['cyber', 'cyborg', 'mech'],
    name: 'Robot / Cyber',
    category: 'Iconic Characters',
    emoji: '🤖',
    baseLang: 'en',
    description: 'Futuristic synthetic cybernetic vocoder',
    filter: 'tremolo=f=25:d=0.8,flanger'
  },
  ghost: {
    id: 'ghost',
    aliases: ['spirit', 'spooky'],
    name: 'Ghost / Spectral',
    category: 'Iconic Characters',
    emoji: '👻',
    baseLang: 'en',
    description: 'Eerie supernatural spectral echo and reverberation',
    filter: 'vibrato=f=4:d=0.6,aecho=0.8:0.9:50:0.4'
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
 * Applies audio DSP filters to raw TTS audio buffer using ffmpeg.
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
      }, 5000);

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
 * Generates speech audio buffer for specified text and voice profile.
 */
export async function generateVoiceAudio(text, voiceOrCode, customLang = 'en') {
  const voice = typeof voiceOrCode === 'object' ? voiceOrCode : resolveVoice(voiceOrCode);
  const lang = voice?.baseLang || customLang || 'en';

  const cleanText = text.slice(0, 200).trim();
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`TTS API returned ${response.status}`);
  }

  const rawBuffer = Buffer.from(await response.arrayBuffer());

  if (voice && voice.filter) {
    return await applyAudioFilter(rawBuffer, voice.filter);
  }

  return rawBuffer;
}

/**
 * Builds a structured Components V2 container listing all celebrity and character voices.
 */
export function buildVoiceListContainer(prefix = '!') {
  const categories = {};
  for (const v of Object.values(CELEBRITY_VOICES)) {
    if (!categories[v.category]) categories[v.category] = [];
    categories[v.category].push(v);
  }

  const sections = [];
  for (const [catName, voices] of Object.entries(categories)) {
    let catContent = `### **${catName}**\n`;
    for (const v of voices) {
      catContent += `-# • **${v.emoji} ${v.name}** (\`${v.id}\`): ${v.description}\n`;
    }
    sections.push(catContent.trim());
  }

  return {
    type: 17,
    components: [
      {
        type: 10,
        content:
          `# Athena Voice Studio // Celebrity & Character Voices | <a:atheNATICK:1557841381630681106>\n` +
          `-# High-fidelity AI speech synthesis with custom acoustic DSP modeling across famous voices.\n\n` +
          `> -# **__How to Set Your Voice:__** \`${prefix}tts voice <name>\` (e.g. \`${prefix}tts voice trump\`)\n` +
          `> -# **__On-The-Fly Voice Speech:__** \`${prefix}tts <name> <message>\` (e.g. \`${prefix}tts mj Shamone! Hee hee!\`)\n` +
          `> -# **__Reset to Default:__** \`${prefix}tts voice default\` or \`${prefix}tts lang en\``
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: sections.join('\n\n')
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `-# Athena Prime Audio Engine • Low-Latency Real-Time Voice Broadcast`
      }
    ]
  };
}
