import db from '../database.js';
import embed from '../embed.js';
import { executeQuarantine } from '../commands/security.js';
import { logToSecurityChannel, getOrCreateQuarantineRole, getOrCreateQuarantineChannel } from '../utils/helpers.js';
import { sendWelcomeMessage } from '../commands/welcome.js';
import { checkBotAdd } from '../utils/antinuke.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    const guild = member.guild;
    const userId = member.id;
    const config = db.getGuildConfig(guild.id);

    // ==========================================
    // 0. BOT ADD GUARD — unauthorized bot detection
    // ==========================================
    if (member.user.bot) {
      await checkBotAdd(member);
      return; // do not run welcome/quarantine logic on bots
    }

    // ==========================================
    // 1. QUARANTINE BYPASS PROTECTION
    // ==========================================
    const quarantineRecord = db.getQuarantine(guild.id, userId);

    if (quarantineRecord) {
      try {
        const role = await getOrCreateQuarantineRole(guild);
        const channel = await getOrCreateQuarantineChannel(guild, role);

        if (role) {
          // Immediately re-apply quarantine isolation
          await member.roles.set([role.id], 'Bypass containment: Member re-joined while under active quarantine.');

          // DM alert
          const bypassDM = embed.danger(
            'Quarantine Bypass Containment',
            `⚠️ You tried to rejoin **${guild.name}** while your quarantine isolation was still active. Access has been re-restricted.`,
            [{ name: 'Reason', value: 'Quarantine bypass attempt detected.' }]
          );
          await member.send({ embeds: [bypassDM] }).catch(() => null);

          // Alert channel
          if (channel) {
            await channel.send({
              content: `${member}`,
              embeds: [embed.danger('Bypass Contained', `User **${member.user.tag}** has re-joined the server. Active quarantine has been re-applied instantly.`)]
            }).catch(() => null);
          }

          // Log security
          logToSecurityChannel(guild, embed.log(
            'Quarantine Bypass Contained',
            `User tried to leave and rejoin to escape quarantine.`,
            [
              { name: 'Target', value: `${member.user.tag} (${userId})`, inline: true },
              { name: 'Original Reason', value: quarantineRecord.reason }
            ],
            'danger'
          ));
        }
      } catch (error) {
        console.error('Failed to contain quarantine bypass:', error);
      }
      return; // Stop processing further checks
    }

    // ==========================================
    // 2. RAIDMODE ACTIVE ENFORCEMENT
    // ==========================================
    if (config.raidMode) {
      const reason = 'Automated Anti-Raid: Guild is currently under Lockdown / Raid Mode.';
      await executeQuarantine(guild, member, guild.members.me, reason);
      
      logToSecurityChannel(guild, embed.log(
        'Anti-Raid Quarantine Applied',
        `Account quarantined automatically during active Raid Mode.`,
        [{ name: 'Member Join', value: `${member.user.tag} (${userId})` }],
        'raid'
      ));
      return; // Stop further checks if quarantined
    }

    // ==========================================
    // 3. AUTOMATED NICKNAME ON JOIN
    // ==========================================
    if (config.autonick && config.autonick.enabled) {
      const prefix = config.autonick.prefix || '';
      const suffix = config.autonick.suffix || '';
      
      if (prefix || suffix) {
        let nick = member.user.username;
        const maxLen = 32 - prefix.length - suffix.length;
        if (nick.length > maxLen) {
          nick = nick.slice(0, maxLen);
        }
        const finalNick = `${prefix}${nick}${suffix}`;
        await member.setNickname(finalNick, 'Automated Auto-Nickname on Join').catch(() => null);
      }
    }

    // ==========================================
    // 4. WELCOME MESSAGE
    // ==========================================
    await sendWelcomeMessage(member);
  }
};
