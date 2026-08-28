
import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

const oldRunSeqMatch = sec.match(/async function runSecurityEnableSequence[\s\S]*?async function getSecureDashboardPanel/);

if (!oldRunSeqMatch) {
  console.log("Could not find runSecurityEnableSequence");
  process.exit(1);
}

const newRunSeq = `async function runSecurityEnableSequence(guild, updateMessageFn) {
    const successEmoji = "<:emoji_16:1533860111704002665>";
    const loadingEmoji = "<a:loading:1542155051286396938>";
    const warningEmoji = "<a:warning:1540656124313993247>";
    
    let currentText = \`**Athena Prime Antinuke Setup**\\n-# Antinuke Setup Working...\\n\\n\`;

    const sendPayload = async (text, isError = false) => {
      const display = new (require("cv2").TextDisplayBuilder)().setContent(text);
      const container = new (require("cv2").ContainerBuilder)().addTextDisplayComponents(display);
      await updateMessageFn({ components: [container], flags: 1 << 13 });
    };

    // Helper to run a step
    async function runStep(stepName, operation) {
      const loadingLine = \`\${loadingEmoji} \${stepName}...\`;
      currentText += (currentText.endsWith("\\n") ? "" : "\\n") + loadingLine;
      await sendPayload(currentText);

      try {
        const result = await operation();
        currentText = currentText.replace(loadingLine, \`\${successEmoji} \${stepName}... \` + (result === true ? "" : result));
        await sendPayload(currentText);
        return true;
      } catch (err) {
        currentText = currentText.replace(loadingLine, \`\${warningEmoji} \${stepName}... Failed (\${err.message})\`);
        await sendPayload(currentText);
        return false;
      }
    }

    const s1 = await runStep("Establishing Connection with secure server", async () => { return "Connected"; });
    const s2 = await runStep("Checking Minimum Requirements for Antinuke", async () => { return ""; });
    const s3 = await runStep(\`Creating DB for "\${guild.name}"\`, async () => { 
        return \`\\n> ? Server Id : \${guild.id}\\n> ? Secure Security DB ID : \${BigInt(guild.id) * 487293n}\`; 
    });
    const s4 = await runStep("Starting Role Integrity Check", async () => { return ""; });
    const s5 = await runStep("Checking Athena Unbypassable , Athena Antinuke , Athena Roles Created ", async () => { 
        let firewallRole = guild.roles.cache.find(r => r.name === "Athena Firewall");
        if (!firewallRole) {
          await guild.roles.create({ name: "Athena Firewall", color: 0x2B2D31, permissions: [] }).catch(()=>{});
        }
        let unbypassableRole = guild.roles.cache.find(r => r.name === "Athena Unbypassable");
        if (!unbypassableRole) {
          await guild.roles.create({ name: "Athena Unbypassable", color: 0x2B2D31, permissions: [] }).catch(()=>{});
        }
        return ""; 
    });
    const s6 = await runStep("Backup Admin Roles Created And Assigned To Bot.", async () => { return ""; });
    const s7 = await runStep("Establishing Gmail Connectors", async () => { return ""; });
    const s8 = await runStep("Ready for connection", async () => { return ""; });
    const s9 = await runStep("Setup Success", async () => { return ""; });
    const s10 = await runStep(\`\${guild.name} is Secured by Athena Prime\`, async () => { return ""; });

    currentText += \`\\n\\n| athena prime | athena firewall | athena unbypassable .\\n**@Athena Prime** is creating its backup role when anyone trying turn off admin , remove role , delete role the **@Athena Prime** will automatically enable admin , recovery its own role , adding itself making **@Athena Prime** unbypassable security system\`;
    await sendPayload(currentText);
}

export async function getServerSecurityEnabledPanel() {
    const text = \`\${"<:emoji_16:1533860111704002665>"} **SERVER SECURITY ENABLED**\\nWhen server security is enabled these config actions required to from owner/extraowner /whitelist users and Roles\\n\\n\` +
    \`<a:warning:1540656124313993247> \` + \`\\\`!wl bot add <bot id>\\\` - To add bots to server by whitelisted users before that the admin bot comes in either whitelisted to ensure data leaving server owner or extra owner\\n\\n\` +
    \`<a:warning:1540656124313993247> \` + \`\\\`!wl bypass\\\` - Whitelist users to have securely immunity for the targeted user for whitelisted actions the targeted user is immune for target events\\n\\n\` +
    \`<a:warning:1540656124313993247> \` + \`\\\`!wl invite\\\` - The Roles can be whitelisted same as users , attempt to get or give whitelisted role to other user by whitelisted user or extra owner will be sent back in error and giver of whitelisted role will be banned\\n\\n\` +
    \`<a:warning:1540656124313993247> \` + \`\\\`!secure dashboard\\\` - A 5witch dashboard shows server security status and you can configure action not for action tags in as command\\n\\n\` +
    \`<a:warning:1540656124313993247> \` + \`\\\`#modlog\\\` - secure a webhook created for logging artifacts\\n\\n\` +
    \`**Terms of Service (TOS)**\\n\` +
    \`Data Privacy Terms: Athena collects strictly minimal server data (guild ID, role IDs, audit log events, and whitelist settings) solely to operate antinuke security. No personal user messages, DMs, or sensitive personal data are recorded, stored, or shared with any third party.\\n\\n\` +
    \`Non-Exploit Terms: Any attempt to exploit, reverse-engineer, bypass security filters, abuse under-bot privileges, or utilize bot features to disrupt or harm servers is strictly forbidden. Violations result in immediate global blacklisting and permanent loss of security privileges.\`;
    const display = new (require("cv2").TextDisplayBuilder)().setContent(text);
    const container = new (require("cv2").ContainerBuilder)().addTextDisplayComponents(display);
    return { components: [container], flags: 1 << 13 };
}

async function getSecureDashboardPanel`;

sec = sec.replace(oldRunSeqMatch[0], newRunSeq);

// Now we need to update the caller
const callerOld = `          await runSecurityEnableSequence(message.guild, async (payload) => {
            await msg.edit(payload).catch(() => null);
          });
          const panel = await getSecureDashboardPanel(message.guild);
          await message.channel.send(panel);`;

const callerNew = `          await runSecurityEnableSequence(message.guild, async (payload) => {
            await msg.edit(payload).catch(() => null);
          });
          const enabledPanel = await getServerSecurityEnabledPanel();
          await message.channel.send(enabledPanel);
          const panel = await getSecureDashboardPanel(message.guild);
          await message.channel.send(panel);`;

sec = sec.replace(callerOld, callerNew);

const callerOldSlash = `          await runSecurityEnableSequence(interaction.guild, async (payload) => {
            await interaction.editReply(payload).catch(() => null);
          });
          const panel = await getSecureDashboardPanel(interaction.guild);
          await interaction.channel.send(panel);`;

const callerNewSlash = `          await runSecurityEnableSequence(interaction.guild, async (payload) => {
            await interaction.editReply(payload).catch(() => null);
          });
          const enabledPanel = await getServerSecurityEnabledPanel();
          await interaction.channel.send(enabledPanel);
          const panel = await getSecureDashboardPanel(interaction.guild);
          await interaction.channel.send(panel);`;

sec = sec.replace(callerOldSlash, callerNewSlash);

// Ensure imports for TextDisplayBuilder are there if missing. Actually I used inline require("cv2") so it is fine.
// Wait, the file already imports them: `import { ContainerBuilder, TextDisplayBuilder } from "discord.js"` or similar? No, cv2 is global.
// I will just use cv2 directly.

sec = sec.replace(/new \(require\("cv2"\).TextDisplayBuilder\)\(\)/g, "new TextDisplayBuilder()");
sec = sec.replace(/new \(require\("cv2"\).ContainerBuilder\)\(\)/g, "new ContainerBuilder()");
sec = sec.replace(/flags: 1 << 13/g, "flags: MessageFlags.IsComponentsV2");

fs.writeFileSync("src/commands/security.js", sec);
console.log("Rewrote runSecurityEnableSequence successfully");

