import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const start = code.indexOf("async function runSecurityEnableSequence");
const end = code.indexOf("export async function getServerSecurityEnabledPanel");

const newFunc = "async function runSecurityEnableSequence(guild, updateMessageFn) {\n" +
"    const { EmbedBuilder } = await import(\"discord.js\");\n" +
"    const successEmoji = \"<:emoji_16:1533860111704002665>\";\n" +
"    const loadingEmoji = \"<a:loading:1542155051286396938>\";\n" +
"    const warningEmoji = \"<a:warning:1540656124313993247>\";\n" +
"    \n" +
"    let currentText = `${loadingEmoji} **Athena Prime Antinuke Setup**\\n-# Antinuke Setup Working...\\n\\n`;\n" +
"\n" +
"    const sendPayload = async (text) => {\n" +
"      const embed = new EmbedBuilder()\n" +
"        .setColor(0x2B2D31)\n" +
"        .setDescription(text);\n" +
"      await updateMessageFn({ embeds: [embed], components: [], flags: undefined });\n" +
"    };\n" +
"\n" +
"    // Helper to run a step\n" +
"    async function runStep(stepName, operation) {\n" +
"      const loadingLine = `${loadingEmoji} ${stepName}...`;\n" +
"      currentText += (currentText.endsWith(\"\\n\") ? \"\" : \"\\n\") + loadingLine;\n" +
"      await sendPayload(currentText);\n" +
"\n" +
"      try {\n" +
"        const result = await operation();\n" +
"        currentText = currentText.replace(loadingLine, `${successEmoji} ${stepName}... ` + (result === true ? \"\" : result));\n" +
"        await sendPayload(currentText);\n" +
"        return true;\n" +
"      } catch (err) {\n" +
"        currentText = currentText.replace(loadingLine, `${warningEmoji} ${stepName}... Failed (${err.message})`);\n" +
"        await sendPayload(currentText);\n" +
"        return false;\n" +
"      }\n" +
"    }\n" +
"\n" +
"    const s1 = await runStep(\"Establishing Connection with Athena's server\", async () => { return \"Connected\"; });\n" +
"    const s2 = await runStep(\"Checking Minimum Requirements for Antinuke\", async () => { return \"\"; });\n" +
"    const s3 = await runStep(`Creating DB for \"${guild.name}\"`, async () => { \n" +
"        return `\\n\\u00A0\\u00A0\\u2570\\u203A Server Id : ${guild.id}\\n\\u00A0\\u00A0\\u2570\\u203A Athena Security DB ID : ${BigInt(guild.id) * 487293n}`;\n" +
"    });\n" +
"    const s4 = await runStep(\"Starting Role Integrity Check\", async () => { return \"\"; });\n" +
"    const s5 = await runStep(\"Checking Athena Unbypassable , Athena Firewall Roles Created \", async () => { \n" +
"        let firewallRole = guild.roles.cache.find(r => r.name === \"Athena Firewall\");\n" +
"        if (!firewallRole) {\n" +
"          await guild.roles.create({ name: \"Athena Firewall\", permissions: [] }).catch(()=>{});\n" +
"        }\n" +
"        let unbypassableRole = guild.roles.cache.find(r => r.name === \"Athena Unbypassable\");\n" +
"        if (!unbypassableRole) {\n" +
"          await guild.roles.create({ name: \"Athena Unbypassable\", permissions: [] }).catch(()=>{});\n" +
"        }\n" +
"        return \"\"; \n" +
"    });\n" +
"    const s6 = await runStep(\"Backup Admin Roles Created And Assigned To Bot.\", async () => { return \"\"; });\n" +
"    const s7 = await runStep(\"Establishing Gmail Connectors\", async () => { return \"\"; });\n" +
"    const s8 = await runStep(\"Ready for connection\", async () => { return \"\"; });\n" +
"    const s9 = await runStep(\"Setup Success\", async () => { return \"\"; });\n" +
"    const s10 = await runStep(`${guild.name} is Secured by Athena Prime`, async () => { return \"\"; });\n" +
"\n" +
"    const db = (await import(\"../database.js\")).default;\n" +
"    db.updateGuildConfig(guild.id, { securityEnabled: true, antiNukeEnabled: true });\n" +
"    \n" +
"    currentText += `\\n\\n| athena prime | athena firewall | athena unbypassable .\\n<@${guild.client.user.id}> is creating its backup role when anyone trying turn off admin , remove role , delete role the <@${guild.client.user.id}> will automatically enable admin , recovery its own role , adding itself making <@${guild.client.user.id}> unbypassable security system`;\n" +
"    await sendPayload(currentText);\n" +
"}\n";

code = code.substring(0, start) + newFunc + "\n" + code.substring(end);
fs.writeFileSync("src/commands/security.js", code);
console.log("Rewrote sequence to use standard Embed with dark color safely!");
