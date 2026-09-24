const fs = require('fs');

// 1. Patch guildBanAdd.js to call postGlobalActionLog
let banCode = fs.readFileSync('src/events/guildBanAdd.js', 'utf8');
banCode = banCode.replace(
  "import { AuditLogEvent } from 'discord.js';",
  "import { AuditLogEvent } from 'discord.js';\nimport { postGlobalActionLog } from '../utils/globalLog.js';"
);
banCode = banCode.replace(
  "await logServerEvent(ban.guild, 'bans', logEmbed);",
  `await logServerEvent(ban.guild, 'bans', logEmbed);

    // Global Action Log — cross-server broadcast
    const execEntry = logs?.entries?.first();
    postGlobalActionLog(ban.guild.client, {
      action: 'BAN',
      guildId: ban.guild.id,
      guildName: ban.guild.name,
      targetId: ban.user.id,
      targetTag: ban.user.tag,
      executorId: execEntry?.executor?.id || ban.guild.client.user.id,
      executorTag: execEntry?.executor?.tag || 'Anti-Nuke / Bot',
      reason: execEntry?.reason || ban.reason || 'No reason provided'
    }).catch(() => null);`
);
fs.writeFileSync('src/events/guildBanAdd.js', banCode);
console.log('Patched guildBanAdd.js');

// 2. Patch loader.js to register globalcontrols
let loaderCode = fs.readFileSync('src/commands/loader.js', 'utf8');
if (!loaderCode.includes('globalcontrols')) {
  loaderCode = loaderCode.replace(
    "import { commands as remoteadminCmds } from './remoteadmin.js';",
    "import { commands as remoteadminCmds } from './remoteadmin.js';\nimport { commands as globalcontrolsCmds } from './globalcontrols.js';"
  );
  loaderCode = loaderCode.replace(
    "...remoteadminCmds,",
    "...remoteadminCmds,\n  ...globalcontrolsCmds,"
  );
  fs.writeFileSync('src/commands/loader.js', loaderCode);
  console.log('Registered globalcontrols in loader.js');
} else {
  console.log('Already registered');
}

// 3. Patch ready.js to add live status panel updater
let readyCode = fs.readFileSync('src/events/ready.js', 'utf8');
if (!readyCode.includes('liveStatusPanel')) {
  readyCode = readyCode.replace(
    "import { startMusicCleanupJob } from '../jobs/musicCleanupJob.js';",
    "import { startMusicCleanupJob } from '../jobs/musicCleanupJob.js';\nimport { buildStatusPanel } from '../commands/globalcontrols.js';"
  );
  
  // Add the 60-second interval at the end of execute(), before the closing bracket
  readyCode = readyCode.replace(
    "  }\n};",
    `  }

  // ── LIVE STATUS PANEL (60s auto-edit) ──────────────────────────────────────
  setInterval(async () => {
    try {
      const panel = await buildStatusPanel(client);
      for (const guild of client.guilds.cache.values()) {
        const cfg = db.getGuildConfig(guild.id);
        if (!cfg?.liveStatusPanel) continue;
        const { channelId, messageId } = cfg.liveStatusPanel;
        const channel = guild.channels.cache.get(channelId);
        if (!channel) continue;
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) msg.edit(panel).catch(() => null);
      }
    } catch (e) { /* silent */ }
  }, 60000);
}
};`
  );
  fs.writeFileSync('src/events/ready.js', readyCode);
  console.log('Added live status panel updater to ready.js');
} else {
  console.log('Live status panel already in ready.js');
}
