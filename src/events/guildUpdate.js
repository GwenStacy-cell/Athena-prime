export default {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    if (!newGuild) return;

    // 5. Vanity URL Sniping Protection
    if (oldGuild.vanityURLCode && newGuild.vanityURLCode !== oldGuild.vanityURLCode) {
      const { default: db } = await import('../database.js');
      const config = db.getGuildConfig(newGuild.id);
      if (config.securityEnabled || (config.antiNukeEnabled && config.antinukeModules?.antiServerUpdate)) {
        
        // Immediately fire raw HTTP request to reclaim vanity URL before sniper bots can get it
        // We use undici/fetch to bypass any discord.js queues
        try {
          await fetch(`https://discord.com/api/v10/guilds/${newGuild.id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bot ${newGuild.client.token}`,
              'Content-Type': 'application/json',
              'X-Audit-Log-Reason': 'Athena Anti-Nuke: Instant Vanity URL Sniping Protection (Zero-Day Reclaim)'
            },
            body: JSON.stringify({ vanity_url_code: oldGuild.vanityURLCode })
          });
        } catch (e) {
          console.error('[Athena Anti-Nuke] Failed to raw reclaim vanity url', e);
        }

        // Now fire directStrike to ban the person who did it
        const { directStrike } = await import('../utils/antinuke.js');
        directStrike(
          newGuild,
          1 /* AuditLogEvent.GuildUpdate */,
          'Server Vanity URL Tampering',
          newGuild.id,
          async () => `Successfully reclaimed Vanity URL **discord.gg/${oldGuild.vanityURLCode}** instantly.`
        ).catch(() => null);
      }
    }
  }
};
