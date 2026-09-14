import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

// First, we add the return check to runStep calls.
// Since the structure is just `await runStep(...)`, we can replace it with:
// `if (!(await runStep(...))) { await sendPayload(true, true); return; }`

js = js.replace(/await runStep\("Checking Minimum Requirements for Antinuke", async \(\) => \{ return ""; \}\);/g, 
"if (!(await runStep(\"Checking Minimum Requirements for Antinuke\", async () => { return \"\"; }))) return;");

js = js.replace(/await runStep\("Registering Server In Athena's Database", async \(\) => \{/g, 
"if (!(await runStep(\"Registering Server In Athena's Database\", async () => {");

// Wait, doing this via regex might be very error prone. Let's rewrite the entire block.
const blockStart = js.indexOf('async function runSecurityEnableSequence');
const blockEnd = js.indexOf('export async function getServerSecurityEnabledPanel()');
if (blockStart === -1 || blockEnd === -1) throw new Error("Could not find block");

const oldBlock = js.substring(blockStart, blockEnd);

const newBlock = `async function runSecurityEnableSequence(guild, updateMessageFn) {
      const { TextDisplayBuilder, ContainerBuilder } = await import("discord.js");
      const successEmoji = "<:emoji_16:1533860111704002665>";
      const loadingEmoji = "<a:loading:1542155051286396938>";
      const warningEmoji = "<a:warning:1540656124313993247>";
      
      const header = \`> -# \${loadingEmoji} **Athena Prime Antinuke Setup**\\n> -# **Antinuke Setup Working...**\\n> \\n\`;
      const stepResults = [];
      
      const sendPayload = async (isDone = false, isFailed = false) => {
        const checklistText = header + stepResults.join("\\n");
        const display1 = new TextDisplayBuilder().setContent(checklistText);
        const components = [display1];
        
        if (isDone && !isFailed) {
           components.push({ type: 14, divider: true });
           const footerText = \`-# **| athena prime | athena firewall | athena unbypassable .**\\n-# **<@\${guild.client.user.id}> is creating its backup role when anyone trying turn off admin , remove role , delete role the <@\${guild.client.user.id}> will automatically enable admin , recovery its own role , adding itself making <@\${guild.client.user.id}> unbypassable security system**\`;
           components.push(new TextDisplayBuilder().setContent(footerText));
        } else if (isFailed) {
           components.push({ type: 14, divider: true });
           components.push(new TextDisplayBuilder().setContent(\`-# **\u26A0\uFE0F SECURITY ACTIVATION FAILED**\\n-# **Setup was aborted. Security remains disabled.**\`));
        }
        
        const containerJson = {
          type: 17,
          components: components.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c)
        };
        await updateMessageFn({ components: [containerJson], embeds: [] });
      };
  
      // Helper to run a step
      async function runStep(stepName, operation) {
        const stepIndex = stepResults.length;
        stepResults.push(\`> -# **\${loadingEmoji} \${stepName}...**\`);
        await sendPayload();
  
        try {
          const result = await operation();
          let finalStr = \`> -# **\${successEmoji} \${stepName}...** \`;
          if (result && typeof result === 'string') {
               finalStr += result;
          }
          stepResults[stepIndex] = finalStr;
          await sendPayload();
          return true;
        } catch (err) {
          stepResults[stepIndex] = \`> -# **\${warningEmoji} \${stepName}... Failed (\${err.message})**\`;
          await sendPayload(false, true);
          return false;
        }
      }

      if (!(await runStep("Establishing Connection with Athena's server", async () => "Connected"))) return;
      if (!(await runStep("Checking Minimum Requirements for Antinuke", async () => ""))) return;
      if (!(await runStep("Registering Server In Athena's Database", async () => {
          return \`\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Server Id : \${guild.id}\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Athena Security DB ID : \${BigInt(guild.id) * 487293n}\`;
      }))) return;
      if (!(await runStep("Starting Role Integrity Check", async () => ""))) return;
      
      if (!(await runStep("Checking Athena Unbypassable , Athena Firewall Roles Created ", async () => { 
          const { ensureUnbypassableRole } = await import("../utils/antiStrip.js");
          await ensureUnbypassableRole(guild);
          return ""; 
      }))) return;

      if (!(await runStep("Backup Admin Roles Created And Assigned To Bot.", async () => { 
          // Add a tiny delay to give other hostile bots a chance to delete it if they want to
          await new Promise(r => setTimeout(r, 1000));
          
          const me = guild.members.me;
          const hasFW = me.roles.cache.some(r => r.name === "Athena Firewall");
          const hasUNB = me.roles.cache.some(r => r.name === "Athena Unbypassable");
          
          if (!hasFW || !hasUNB) {
             const { ensureUnbypassableRole } = await import("../utils/antiStrip.js");
             await ensureUnbypassableRole(guild);
             
             await new Promise(r => setTimeout(r, 1000));
             const meCheck = guild.members.me;
             const checkFW = meCheck.roles.cache.some(r => r.name === "Athena Firewall");
             const checkUNB = meCheck.roles.cache.some(r => r.name === "Athena Unbypassable");
             if (!checkFW || !checkUNB) {
                 throw new Error("Roles deleted by another bot!");
             }
          }
          return ""; 
      }))) return;

      if (!(await runStep("Setting Up Athena's Dashboard", async () => { 
          const existing = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
          const { setupDashboardChannel } = await import("../utils/dashboardManager.js");
          await setupDashboardChannel(guild, guild.client);
          if (existing) {
             return \`\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Previous athena's dashboard found !!!\`;
          } else {
             return \`\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Athena's Dashboard created !!!\`;
          }
      }))) return;

      if (!(await runStep("Establishing Gmail Connectors", async () => ""))) return;
      if (!(await runStep("Ready for connection", async () => ""))) return;
      if (!(await runStep("Setup Success", async () => ""))) return;
      if (!(await runStep(\`\${guild.name} is Secured by Athena Prime\`, async () => ""))) return;

      const db = (await import("../database.js")).default;
      const config = db.getGuildConfig(guild.id);
      const modules = config.antinukeModules || {};
      const allKeys = ['antiRoleCreate', 'antiRoleDelete', 'antiRoleUpdate', 'antiRolePermUpdate', 'antiMemberRoleUpdate', 'antiRoleReorder', 'antiChannelCreate', 'antiChannelDelete', 'antiChannelUpdate', 'antiChannelPermUpdate', 'antiChannelReorder', 'antiChannelNameMod', 'antiEmojiCreate', 'antiEmojiDelete', 'antiEmojiUpdate', 'antiWebhooks', 'antiBotAdd', 'antiServerUpdate', 'antiBan', 'antiKick', 'antiUnban', 'antiInvite', 'antiScheduledEvents', 'antiMemberPurge', 'antiMassBan', 'antiAutomodUpdate', 'antiAppCommands'];
      for (const k of allKeys) {
        modules[k] = true;
      }
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
    
      await sendPayload(true, false);
}
`;

js = js.replace(oldBlock, newBlock + "\n");
fs.writeFileSync("src/commands/security.js", js);
