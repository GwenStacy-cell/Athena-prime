import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } from '@discordjs/voice';
import fetch from 'node-fetch';
import db from '../database.js';
import cv2 from '../cv2.js';
import { isBotOwnerOrServerOwnerStrict } from '../utils/helpers.js';
import { generateVoiceAudio, resolveVoice, buildVoiceListContainer } from '../utils/ttsVoiceEngine.js';

// Queue system for guilds: guildId -> { queue: [], player: AudioPlayer, connection: VoiceConnection, isPlaying: boolean, timeout: NodeJS.Timeout }
const ttsSessions = new Map();

async function playNext(guildId) {
  const session = ttsSessions.get(guildId);
  if (!session) return;

  if (session.queue.length === 0) {
    session.isPlaying = false;
    // Set a timeout to disconnect after 60 seconds of inactivity
    session.timeout = setTimeout(() => {
      if (session.connection && session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        session.connection.destroy();
      }
      ttsSessions.delete(guildId);
    }, 60000);
    return;
  }

  session.isPlaying = true;
  if (session.timeout) {
    clearTimeout(session.timeout);
    session.timeout = null;
  }

  const { text, lang, voice } = session.queue.shift();

  try {
    const buffer = await generateVoiceAudio(text, voice, lang);
    
    // Convert buffer to Readable stream using a simple trick
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);

    const resource = createAudioResource(stream);
    session.player.play(resource);
  } catch (err) {
    console.error('TTS Playback Error:', err);
    // Skip to next if this one fails
    playNext(guildId);
  }
}

export async function queueTtsMessage(member, text, overrideVoice = null) {
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) return false;

  const guildId = member.guild.id;
  const prefs = db.getTtsPrefs(member.id);
  const activeVoice = overrideVoice || prefs.voice || null;
  
  if (!ttsSessions.has(guildId)) {
    const player = createAudioPlayer();
    
    player.on(AudioPlayerStatus.Idle, () => {
      playNext(guildId);
    });
    
    player.on('error', error => {
      console.error('Audio Player Error:', error);
      playNext(guildId);
    });

    ttsSessions.set(guildId, {
      queue: [],
      player: player,
      connection: null,
      isPlaying: false,
      timeout: null
    });
  }

  const session = ttsSessions.get(guildId);

  // If not connected to this specific channel, connect
  if (!session.connection || session.connection.joinConfig.channelId !== voiceChannel.id) {
    session.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true
    });
    session.connection.subscribe(session.player);
  }

  // Chunk text if it's too long (Google TTS limit is 200 chars)
  const chunks = text.match(/.{1,200}(\s|$)/g) || [text.substring(0, 200)];
  for (const chunk of chunks) {
    if (chunk.trim()) {
      session.queue.push({ text: chunk.trim(), lang: prefs.lang, voice: activeVoice });
    }
  }

  if (!session.isPlaying) {
    playNext(guildId);
  }
  return true;
}

export const commands = [
  {
    name: 'tts',
    description: 'Broadcast spoken text into your voice channel with AI & celebrity voices.',
    category: 'utilities',
    options: [],
    async executePrefix(message, args) {
      if (args.length === 0) {
        return message.reply(cv2.warn('TTS System Usage', `\`!tts <message>\` - Speak in voice channel\n\`!tts voices\` - Browse all Celebrity & AI voices\n\`!tts voice <name>\` - Set your default voice (e.g. \`trump\`, \`mj\`, \`modi\`, \`taylor\`, \`ariana\`, \`sabrina\`, \`bieber\`)\n\`!tts <voice> <msg>\` - Speak with on-the-fly voice\n\`!tts stop\` - Stop current speech\n\`!tts lang <code>\` - Set language (e.g. \`en\`, \`uk\`, \`au\`, \`es\`, \`ja\`)\n\`!tts auto [@user]\` - Lock a user to Auto-TTS\n\`!tts autovc\` - Toggle global Auto-TTS for your VC`));
      }

      const subcommand = args[0]?.toLowerCase();

      if (subcommand === 'voices' || subcommand === 'celebrities' || subcommand === 'listvoices') {
        const prefix = db.getGuildConfig(message.guild.id)?.prefix || '!';
        const container = buildVoiceListContainer(prefix);
        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'voice' || subcommand === 'setvoice') {
        const voiceArg = args[1]?.toLowerCase();
        if (!voiceArg) {
          const prefix = db.getGuildConfig(message.guild.id)?.prefix || '!';
          const container = buildVoiceListContainer(prefix);
          return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        if (voiceArg === 'default' || voiceArg === 'none' || voiceArg === 'reset') {
          db.updateTtsPrefs(message.author.id, { voice: null });
          return message.reply(cv2.success('TTS Voice Reset | <a:atheNATICK:1557841381630681106>', 'Your speech voice has been reset to standard default delivery.'));
        }

        const resolved = resolveVoice(voiceArg);
        if (!resolved) {
          return message.reply(cv2.warn('Voice Not Found', `Unknown celebrity voice: \`${voiceArg}\`.\nType \`!tts voices\` to explore all available celebrity and character voices!`));
        }

        db.updateTtsPrefs(message.author.id, { voice: resolved.id, lang: resolved.baseLang });
        return message.reply(cv2.success('TTS Voice Updated | <a:atheNATICK:1557841381630681106>', `Your voice preference has been locked to **${resolved.emoji} ${resolved.name}**!\nAll future TTS speech will speak in this voice.`));
      }

      if (subcommand === 'stop') {
        if (!message.member.voice.channel) return message.reply(cv2.warn('Error', 'You must be in a voice channel to stop TTS.'));
        const session = ttsSessions.get(message.guild.id);
        if (session) {
          session.queue = [];
          session.player.stop();
          return message.reply(cv2.success('TTS Stopped', 'Cleared the speech queue and halted playback.'));
        }
        return message.reply(cv2.info('TTS', 'Nothing is currently playing.'));
      }

      if (subcommand === 'auto') {
        const target = message.mentions.users.first();
        if (target) {
          const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
          if (!hasAdmin) return message.reply(cv2.danger('Access Denied', 'Only Admins can enable Auto-TTS for other users.'));
          db.addAutoTtsUser(message.guild.id, target.id);
          return message.reply(cv2.success('Auto-TTS Enabled', `${target} will now have all their messages read aloud.`));
        } else {
          db.addAutoTtsUser(message.guild.id, message.author.id);
          return message.reply(cv2.success('Auto-TTS Enabled', `Your messages will now be read aloud automatically.`));
        }
      }

      if (subcommand === 'unauto') {
        const target = message.mentions.users.first();
        if (target) {
          const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
          if (!hasAdmin) return message.reply(cv2.danger('Access Denied', 'Only Admins can disable Auto-TTS for other users.'));
          db.removeAutoTtsUser(message.guild.id, target.id);
          return message.reply(cv2.success('Auto-TTS Disabled', `${target} will no longer have their messages read aloud.`));
        } else {
          db.removeAutoTtsUser(message.guild.id, message.author.id);
          return message.reply(cv2.success('Auto-TTS Disabled', `Your messages will no longer be read aloud automatically.`));
        }
      }

      if (subcommand === 'autovc') {
        const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
        if (!hasAdmin) return message.reply(cv2.danger('Access Denied', 'Only Admins can toggle global Auto-TTS for a Voice Channel.'));
        
        const currentVc = db.getAutoTtsVc(message.guild.id);
        const userVc = message.member.voice.channelId;
        
        if (currentVc) {
          db.setAutoTtsVc(message.guild.id, null);
          return message.reply(cv2.success('Auto-TTS VC Disabled', `The global Auto-TTS Voice Channel has been disabled.`));
        }
        
        if (!userVc) return message.reply(cv2.warn('Error', 'You must be in a Voice Channel to enable Auto-TTS for it.'));
        
        db.setAutoTtsVc(message.guild.id, userVc);
        return message.reply(cv2.success('Auto-TTS VC Enabled', `Anyone who types in chat while inside <#${userVc}> will now have their messages read aloud!`));
      }

      if (subcommand === 'lang') {
        let code = args[1]?.toLowerCase();
        if (!code) return message.reply(cv2.warn('Usage', '`!tts lang <language_code>` (e.g. en, es, fr, ja, uk, au)'));
        
        // Custom accent mappings for English
        if (code === 'uk') code = 'en-GB';
        if (code === 'au') code = 'en-AU';
        if (code === 'us') code = 'en-US';
        if (code === 'in') code = 'en-IN';
        if (code === 'english') code = 'en';

        db.updateTtsPrefs(message.author.id, { lang: code, voice: null });
        return message.reply(cv2.success('TTS Language Set', `Your speech language has been updated to \`${code}\`.`));
      }

      // Check for on-the-fly voice shortcut (e.g. !tts trump Hello or !tts mj Shamone)
      const inlineVoice = resolveVoice(args[0]);
      let textToSpeak = '';
      let activeVoiceOverride = null;

      if (inlineVoice && args.length > 1) {
        activeVoiceOverride = inlineVoice.id;
        textToSpeak = args.slice(1).join(' ');
      } else {
        textToSpeak = args.join(' ');
      }

      if (textToSpeak.length > 800) return message.reply(cv2.warn('Error', 'Message is too long. Please keep it under 800 characters.'));
      
      const success = await queueTtsMessage(message.member, textToSpeak, activeVoiceOverride);
      if (!success) {
        return message.reply(cv2.warn('Error', 'You must be in a Voice Channel to use this.'));
      }
      
      message.react('<:emoji_16:1533860111704002665>').catch(() => null);
    }
  }
];
