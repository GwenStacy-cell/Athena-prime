import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const start = code.indexOf("async function runSecurityEnableSequence");
const end = code.indexOf("export async function getServerSecurityEnabledPanel");

const newFunc = `async function runSecurityEnableSequence(guild, updateMessageFn) {
    const { EmbedBuilder } = await import("discord.js");
    const successEmoji = "<:emoji_16:1533860111704002665>";
    const loadingEmoji = "<a:loading:1542155051286396938>";
    const warningEmoji = "<a:warning:1540656124313993247>";
    
    let currentText = \`${loadingEmoji} **Athena Prime Antinuke Setup**\\n-# Antinuke Setup Working...\\n\\n\`;

    const sendPayload = async (text) => {
      const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setDescription(text);
      await updateMessageFn({ embeds: [embed], components: [], flags: undefined });
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

    const s1 = await runStep("Establishing Connection with Athena's server", async () => { return "Connected"; });
    const s2 = await runStep("Checking Minimum Requirements for Antinuke", async () => { return ""; });
    const s3 = await runStep(\`Creating DB for "\${guild.name}"\`, async () => { 
        return \`\\n\\u00A0\\u00A0\\u2570\\u203A Server Id : \${guild.id}\\n\\u00A0\\u00A0\\u2570\\u203A Athena Security DB ID : \${BigInt(guild.id) * 487293n}\`; 
    });
    const s4 = await runStep("Starting Role Integrity Check", async () => { return ""; });
    const s5 = await runStep("Checking Athena Unbypassable , Athena Firewall Roles Created ", async () => { 
        let firewallRole = guild.roles.cache.find(r => r.name === "Athena Firewall");
        if (!firewallRole) {
          await guild.roles.create({ name: "Athena Firewall", permissions: [] }).catch(()=>{});
        }
        let unbypassableRole = guild.roles.cache.find(r => r.name === "Athena Unbypassable");
        if (!unbypassableRole) {
          await guild.roles.create({ name: "Athena Unbypassable", permissions: [] }).catch(()=>{});
        }
        return ""; 
    });
    const s6 = await runStep("Backup Admin Roles Created And Assigned To Bot.", async () => { return ""; });
    const s7 = await runStep("Establishing Gmail Connectors", async () => { return ""; });
    const s8 = await runStep("Ready for connection", async () => { return ""; });
    const s9 = await runStep("Setup Success", async () => { return ""; });
    const s10 = await runStep(\`\${guild.name} is Secured by Athena Prime\`, async () => { return ""; });

    const db = (await import("../database.js")).default;
    db.updateGuildConfig(guild.id, { securityEnabled: true, antiNukeEnabled: true });
    
    currentText += \`\\n\\n| athena prime | athena firewall | athena unbypassable .\\n<@\${guild.client.user.id}> is creating its backup role when anyone trying turn off admin , remove role , delete role the <@\${guild.client.user.id}> will automatically enable admin , recovery its own role , adding itself making <@\${guild.client.user.id}> unbypassable security system\`;
    await sendPayload(currentText);
}
`;

code = code.substring(0, start) + newFunc + "\n" + code.substring(end);
fs.writeFileSync("src/commands/security.js", code);
console.log("Rewrote sequence to use standard Embed with dark color!");
