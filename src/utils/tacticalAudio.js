import { AttachmentBuilder } from 'discord.js';
import { generateVoiceAudio } from './ttsVoiceEngine.js';

export const TACTICAL_DISPATCH_SCRIPTS = {
  defcon1: 'Attention. DEFCON 1 engaged. Emergency server blackout initiated. Perimeter channels locked and security shield deployed.',
  panic: 'Attention. Emergency blackout protocol engaged. All public channels have been isolated and verification shields elevated. Server under active defense.',
  unpanic: 'Emergency blackout resolved. Operations restored to normal parameters.',
  lockdown_tier1: 'Athena Prime Defense Matrix. Tier 1 soft lockdown engaged. Public messaging and voice speaking channels restricted.',
  lockdown_tier2: 'Athena Prime Defense Matrix. Tier 2 lockdown engaged. Media attachments and reactions disabled. Server raid mode armed.',
  lockdown_tier3: 'Athena Prime Defense Matrix. Tier 3 nuclear blackout engaged. All public channels hidden and isolated.',
  unlockdown: 'Athena Prime Defense Matrix. Perimeter security restored. Channel bitmasks synchronized and operations normal.',
  raidmode_on: 'Warning. Server raid mode armed. Join velocity thresholds active and incoming accounts quarantined.',
  security_enable_all: 'Athena Prime Defense Matrix online. All 28 perimeter shields locked and entities secured.'
};

/**
 * Synthesizes a high-tech tactical military audio dispatch buffer.
 * @param {string} text - Dispatch text
 * @param {string} voiceKey - Voice profile (defaults to 'tactical')
 * @returns {Promise<Buffer|null>}
 */
export async function generateTacticalDispatchBuffer(text, voiceKey = 'tactical') {
  try {
    const buffer = await generateVoiceAudio(text, voiceKey, 'en');
    return buffer || null;
  } catch (err) {
    console.error('[TacticalAudio] Synthesis error:', err.message);
    return null;
  }
}

/**
 * Creates an MP3 AttachmentBuilder for embedding in text channels or embeds.
 * @param {string} text - Dispatch text
 * @param {string} filename - Attachment filename
 * @param {string} voiceKey - Voice profile
 * @returns {Promise<AttachmentBuilder|null>}
 */
export async function createTacticalDispatchAttachment(text, filename = 'tactical_dispatch.mp3', voiceKey = 'tactical') {
  try {
    const buffer = await generateTacticalDispatchBuffer(text, voiceKey);
    if (!buffer || buffer.length === 0) return null;
    return new AttachmentBuilder(buffer, { name: filename, description: text.slice(0, 100) });
  } catch (err) {
    console.error('[TacticalAudio] Attachment error:', err.message);
    return null;
  }
}

/**
 * Connects and plays a tactical voice briefing in VC if the executor is connected to a Voice Channel.
 * @param {GuildMember} member - Moderator or executor member
 * @param {string} text - Briefing script
 * @param {string} voiceKey - Voice profile
 * @returns {Promise<{ spokenInVc: boolean, channelId: string|null }>}
 */
export async function dispatchTacticalAudioToVc(member, text, voiceKey = 'tactical') {
  if (!member || !member.voice?.channel) {
    return { spokenInVc: false, channelId: null };
  }

  try {
    const { queueTtsMessage } = await import('../commands/tts.js');
    const success = await queueTtsMessage(member, text, voiceKey);
    return { spokenInVc: Boolean(success), channelId: member.voice.channel.id };
  } catch (err) {
    console.error('[TacticalAudio] VC dispatch error:', err.message);
    return { spokenInVc: false, channelId: null };
  }
}
