import fs from "fs";
let js = fs.readFileSync("src/commands/ezal.js", "utf8");

if (!js.includes("case 'security':")) {
  js = js.replace(
    /case 'restoresetup': return handleRestoreSetup\(message, args\);/,
    "case 'restoresetup': return handleRestoreSetup(message, args);\n    case 'security': return handleSecurityGlobal(message, args);"
  );
}

// Now append the function definition at the bottom before module.exports
const func = `
async function handleSecurityGlobal(message, args) {
  const action = args.join(' ').toLowerCase();
  
  if (action === 'enable all') {
    const msg = await message.reply('<a:loading:1542155051286396938> **Forcibly ENABLING security across ALL servers...** This may take a minute.');
    
    let count = 0;
    for (const guild of message.client.guilds.cache.values()) {
      try {
        const config = db.getGuildConfig(guild.id);
        const modules = config.antinukeModules || {};
        const allKeys = ['antiRoleCreate', 'antiRoleDelete', 'antiRoleUpdate', 'antiRolePermUpdate', 'antiMemberRoleUpdate', 'antiRoleReorder', 'antiChannelCreate', 'antiChannelDelete', 'antiChannelUpdate', 'antiChannelPermUpdate', 'antiChannelReorder', 'antiChannelNameMod', 'antiEmojiCreate', 'antiEmojiDelete', 'antiEmojiUpdate', 'antiWebhooks', 'antiBotAdd', 'antiServerUpdate', 'antiBan', 'antiKick', 'antiUnban', 'antiInvite', 'antiScheduledEvents', 'antiMemberPurge', 'antiMassBan', 'antiAutomodUpdate', 'antiAppCommands'];
        for (const k of allKeys) modules[k] = true;
        
        db.updateGuildConfig(guild.id, {
          securityEnabled: true,
          antiNukeEnabled: true,
          antiInviteEnabled: true,
          antiSpamMentionEnabled: true,
          antiLinkEnabled: true,
          antiFloodEnabled: true,
          wordFilterEnabled: true,
          antinukeModules: modules
        });

        // Initialize dashboard and backup roles silently
        const { ensureUnbypassableRole } = await import('../utils/antiStrip.js');
        await ensureUnbypassableRole(guild).catch(() => null);
        
        const { setupDashboardChannel } = await import('../utils/dashboardManager.js');
        await setupDashboardChannel(guild, message.client).catch(() => null);
        count++;
      } catch (err) {
        console.error(\`Failed to enable security globally in \${guild.name}: \`, err);
      }
    }
    
    return msg.edit(\`<:emoji_16:1521464002046328944> **Global Security Enabled.** Successfully forced all modules to ON for \` + count + \` servers.\`);
  } 
  
  if (action === 'disable all') {
    const msg = await message.reply('<a:loading:1542155051286396938> **Forcibly DISABLING security across ALL servers...** This will delete firewall roles and dashboards globally.');
    
    let count = 0;
    for (const guild of message.client.guilds.cache.values()) {
      try {
        db.updateGuildConfig(guild.id, {
          securityEnabled: false,
          antiNukeEnabled: false,
          antiSpamEnabled: false,
          antiInviteEnabled: false,
          antiLinkEnabled: false,
          blacklistWords: []
        });
        
        const rolesToDelete = ['Athena Firewall', 'Athena Unbypassable'];
        for (const roleName of rolesToDelete) {
          const r = guild.roles.cache.find(role => role.name === roleName);
          if (r) await r.delete('Global Security Disabled').catch(() => null);
        }
        
        const dashboard = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
        if (dashboard) await dashboard.delete('Global Security Disabled').catch(() => null);
        count++;
      } catch (err) {
        console.error(\`Failed to disable security globally in \${guild.name}: \`, err);
      }
    }
    
    return msg.edit(\`<:emoji_16:1521464002046328944> **Global Security Disabled.** Successfully scrubbed firewalls and dashboards from \` + count + \` servers.\`);
  }

  return message.reply('<:cross_red:1533860128015519895> Invalid action. Please use \`ezal security enable all\` or \`ezal security disable all\`');
}

`;

js += "\n" + func;
fs.writeFileSync("src/commands/ezal.js", js);
