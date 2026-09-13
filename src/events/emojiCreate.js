import { AuditLogEvent } from 'discord.js';
import { directStrike } from '../utils/antinuke.js';

export default {
  name: 'emojiCreate',
  async execute(emoji) {
    if (!emoji.guild) return;

    directStrike(
      emoji.guild,
      AuditLogEvent.EmojiCreate,
      'Emoji Creation',
      emoji.id,
      async () => {
        await emoji.delete('Athena Anti-Nuke: Unauthorized Emoji Creation').catch(() => null);
      }
    ).catch(() => null);
  }
};