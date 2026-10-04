import { PermissionFlagsBits, ChannelType } from 'discord.js';
import cv2 from '../cv2.js';
import db from '../database.js';

const DEFAULT_STATUSES = [
  "🌙 quiet corner under the moon",
  "🌸 Stay awhile, stay cozy",
  "🦋 Within {guild}'s dreamy garden",
  "☁️ lost in the clouds",
  "✨ making memories",
  "🎧 vibing to the rhythm",
  "☕ late night thoughts",
  "🤍 safe space",
  "🦢 Chasing Cherry blossom dreams"
];

function getRandomStatus(guild, customStatuses) {
  const pool = (customStatuses && customStatuses.length > 0) ? customStatuses : DEFAULT_STATUSES;
  const raw = pool[Math.floor(Math.random() * pool.length)];
  return raw.replace(/{guild}/g, guild.name);
}

export const commands = [
  {
    name: 'autovcstatus',
    description: 'Manage random aesthetic VC statuses [Admin]',
    aliases: ['vcstatusauto', 'randomvc'],
    category: 'voice',
    permissions: [PermissionFlagsBits.Administrator],
    async executePrefix(message, args) {
      const guildId = message.guild.id;
      const cfg = db.getGuildConfig(guildId) || {};
      const action = args[0]?.toLowerCase();

      if (!action) {
        return message.reply(cv2.warn('Auto VC Status', [
          '**Usage:**',
          '`!autovcstatus on` - Enable and shuffle all VCs',
          '`!autovcstatus off` - Disable auto statuses',
          '`!autovcstatus shuffle` - Manually reshuffle all VCs',
          '`!autovcstatus add <status>` - Add a custom status (supports custom emojis)',
          '`!autovcstatus remove <index>` - Remove a custom status',
          '`!autovcstatus list` - View custom statuses',
          '',
          `**Current State:** ${cfg.autoVcStatus ? '<:on:1533844867191406672> Enabled' : '<:off:1533844858983157851> Disabled'}`
        ].join('\n')));
      }

      const customStatuses = cfg.customVcStatuses || [];

      if (action === 'on') {
        db.updateGuildConfig(guildId, { autoVcStatus: true });
        
        const m = await message.reply(cv2.success('Enabled', 'Auto VC Status enabled! Sweeping voice channels now...'));
        
        // Sweep all VCs
        await message.guild.channels.fetch();
        const vcs = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);
        let updated = 0;
        
        for (const vc of vcs.values()) {
          try {
            const newStatus = getRandomStatus(message.guild, customStatuses);
            if (typeof vc.setVoiceStatus === 'function') {
              await vc.setVoiceStatus(newStatus);
            } else {
              await message.client.rest.put(`/channels/${vc.id}/voice-status`, { body: { status: newStatus } });
            }
            updated++;
            await new Promise(r => setTimeout(r, 800)); // Rate limit protection
          } catch (e) {
            console.error(`Failed to set VC status for ${vc.id}:`, e.message);
          }
        }
        
        return m.edit(cv2.success('Enabled', `Auto VC Status enabled! Set statuses for **${updated}** voice channels.`)).catch(()=>null);
      }

      if (action === 'off') {
        db.updateGuildConfig(guildId, { autoVcStatus: false });
        return message.reply(cv2.success('Disabled', 'Auto VC Status disabled. New VCs will no longer get random statuses.'));
      }

      if (action === 'shuffle') {
        if (!cfg.autoVcStatus) return message.reply(cv2.warn('Disabled', 'Enable the feature first with `!autovcstatus on`.'));
        
        const m = await message.reply(cv2.success('Shuffling', 'Assigning new random statuses to all VCs...'));
        const vcs = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);
        let updated = 0;
        
        for (const vc of vcs.values()) {
          try {
            await vc.setVoiceStatus(getRandomStatus(message.guild, customStatuses));
            updated++;
            await new Promise(r => setTimeout(r, 600));
          } catch (e) {}
        }
        
        return m.edit(cv2.success('Shuffled', `Successfully shuffled statuses for **${updated}** voice channels.`)).catch(()=>null);
      }

      if (action === 'add') {
        const text = args.slice(1).join(' ');
        if (!text) return message.reply(cv2.warn('Usage', 'Provide the status text/emojis. Example: `!autovcstatus add <:myemoji:123> chill zone`'));
        if (text.length > 500) return message.reply(cv2.danger('Error', 'Status too long (max 500 chars).'));
        
        customStatuses.push(text);
        db.updateGuildConfig(guildId, { customVcStatuses: customStatuses });
        return message.reply(cv2.success('Added', `Added to rotation:\n> ${text}`));
      }

      if (action === 'remove' || action === 'delete') {
        const idx = parseInt(args[1]) - 1;
        if (isNaN(idx) || idx < 0 || idx >= customStatuses.length) {
          return message.reply(cv2.warn('Error', 'Invalid index. Check `!autovcstatus list`.'));
        }
        
        const removed = customStatuses.splice(idx, 1);
        db.updateGuildConfig(guildId, { customVcStatuses: customStatuses });
        return message.reply(cv2.success('Removed', `Removed from rotation:\n> ${removed[0]}`));
      }

      if (action === 'list') {
        if (customStatuses.length === 0) {
          return message.reply(cv2.info('Status Pool', 'You are currently using the default aesthetic status pool. Add your own with `!autovcstatus add`.'));
        }
        
        const list = customStatuses.map((s, i) => `**${i + 1}.** ${s}`).join('\n');
        return message.reply(cv2.info('Custom Status Pool', list));
      }
      
      return message.reply(cv2.warn('Unknown Action', 'Valid actions: `on`, `off`, `shuffle`, `add`, `remove`, `list`'));
    }
  }
];

export { getRandomStatus };
