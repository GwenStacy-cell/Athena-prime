import fs from "fs";
let sec = fs.readFileSync("src/commands/security.js", "utf8");
let dash = fs.readFileSync("src/utils/dashboardManager.js", "utf8");

sec = sec.replace(/<:emoji_16:1521464002046328944>/g, "<:emoji_16:1533860111704002665>");
sec = sec.replace(/await guild\.members\.fetch\(\);\s*/g, "await guild.members.fetch().catch(() => null);\n");
dash = dash.replace(/await guild\.members\.fetch\(\);\s*/g, "await guild.members.fetch().catch(() => null);\n");

const oldStep6 = `// Step 6: Dashboard Channel
    await runStep('Security Dashboard Deployment', async () => {
      const existingDashboard = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
      if (!existingDashboard) {
        await setupDashboardChannel(guild, guild.client);
      }
      const verifyDash = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
      if (!verifyDash) throw new Error("Channel creation failed");
      return true;
    });`;

const newStep6 = `// Step 6: Dashboard Channel
    await runStep('Security Dashboard Deployment', async () => {
      let dash = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
      if (!dash) {
        try {
          await setupDashboardChannel(guild, guild.client);
        } catch (e) {
          throw new Error("Missing MANAGE_CHANNELS permission");
        }
        dash = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
      }
      if (!dash) {
         const cfg = (await import("../database.js")).default.getGuildConfig(guild.id);
         if (cfg.dashboardChannelId && guild.channels.cache.has(cfg.dashboardChannelId)) {
             return true;
         }
         throw new Error("Missing MANAGE_CHANNELS permission (or Rate Limit)");
      }
      return true;
    });`;

sec = sec.replace(oldStep6, newStep6);

fs.writeFileSync("src/commands/security.js", sec);
fs.writeFileSync("src/utils/dashboardManager.js", dash);
console.log("Fixed securely");
