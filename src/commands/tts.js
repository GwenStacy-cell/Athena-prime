import { PermissionFlagsBits } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } from '@discordjs/voice';
import fetch from 'node-fetch';
import db from '../database.js';
import cv2 from '../cv2.js';
import { isBotOwnerOrServerOwnerStrict } from '../utils/helpers.js';

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

  const { text, lang } = session.queue.shift();

  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google API returned ${response.status}`);
    
    // We need to buffer the response for Discord.js voice to read it reliably
    const buffer = await response.buffer();
    
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

export async function queueTtsMessage(member, text) {
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) return false;

  const guildId = member.guild.id;
  const prefs = db.getTtsPrefs(member.id);
  
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
      session.queue.push({ text: chunk.trim(), lang: prefs.lang });
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
    description: 'Broadcast spoken text into your voice channel.',
    category: 'utilities',
    options: [],
    async executePrefix(message, args) {
      if (args.length === 0) {
        return message.reply(cv2.warn('TTS System Usage', `\`!tts <message>\` - Speak in voice channel\n\`!tts stop\` - Stop current speech\n\`!tts lang <code|name>\` - Set your default language\n\`!tts auto @user\` - Enable auto-TTS for a user\n\`!tts unauto @user\` - Disable auto-TTS`));
      }

      const subcommand = args[0]?.toLowerCase();

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
        const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
        if (!hasAdmin) return message.reply(cv2.danger('Access Denied', 'Only Admins can enable Auto-TTS.'));
        const target = message.mentions.users.first();
        if (!target) return message.reply(cv2.warn('Usage', '`!tts auto @user`'));
        db.addAutoTtsUser(message.guild.id, target.id);
        return message.reply(cv2.success('Auto-TTS Enabled', `${target} will now have all their messages in this channel read aloud.`));
      }

      if (subcommand === 'unauto') {
        const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
        if (!hasAdmin) return message.reply(cv2.danger('Access Denied', 'Only Admins can disable Auto-TTS.'));
        const target = message.mentions.users.first();
        if (!target) return message.reply(cv2.warn('Usage', '`!tts unauto @user`'));
        db.removeAutoTtsUser(message.guild.id, target.id);
        return message.reply(cv2.success('Auto-TTS Disabled', `${target} will no longer have their messages read aloud.`));
      }

      if (subcommand === 'lang' || subcommand === 'voice') {
        let code = args[1]?.toLowerCase();
        if (!code) return message.reply(cv2.warn('Usage', '`!tts lang <language_code>` (e.g. en, es, fr, ja, uk, au)'));
        
        // Custom accent mappings for English
        if (code === 'uk') code = 'en-GB';
        if (code === 'au') code = 'en-AU';
        if (code === 'us') code = 'en-US';
        if (code === 'in') code = 'en-IN';
        if (code === 'english') code = 'en';

        db.updateTtsPrefs(message.author.id, { lang: code });
        return message.reply(cv2.success('TTS Language Set', `Your speech language has been updated to \`${code}\`.`));
      }

      // Default behavior: Speak the message
      const text = args.join(' ');
      if (text.length > 800) return message.reply(cv2.warn('Error', 'Message is too long. Please keep it under 800 characters.'));
      
      const success = await queueTtsMessage(message.member, text);
      if (!success) {
        return message.reply(cv2.warn('Error', 'You must be in a Voice Channel to use this.'));
      }
      
      message.react('<:emoji_16:1521464002046328944>').catch(() => null);
    }
  }
];
