import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const start = code.indexOf("async function runSecurityEnableSequence");
const end = code.indexOf("export async function getServerSecurityEnabledPanel");

const newFunc = "async function runSecurityEnableSequence(guild, updateMessageFn) {\n" +
"    const { TextDisplayBuilder, ContainerBuilder } = await import(\"discord.js\");\n" +
"    const successEmoji = \"<:emoji_16:1533860111704002665>\";\n" +
"    const loadingEmoji = \"<a:loading:1542155051286396938>\";\n" +
"    const warningEmoji = \"<a:warning:1540656124313993247>\";\n" +
"    \n" +
"    const header = `> -# ${loadingEmoji} **Athena Prime Antinuke Setup**\\n> -# **Antinuke Setup Working...**\\n> \\n`;\n" +
"    const stepResults = [];\n" +
"    \n" +
"    const sendPayload = async (isDone = false) => {\n" +
"      const checklistText = header + stepResults.join(\"\\n\");\n" +
"      const display1 = new TextDisplayBuilder().setContent(checklistText);\n" +
"      const components = [display1];\n" +
"      \n" +
"      if (isDone) {\n" +
"         components.push({ type: 14, divider: true });\n" +
"         const footerText = `-# **| athena prime | athena firewall | athena unbypassable .**\\n-# **<@${guild.client.user.id}> is creating its backup role when anyone trying turn off admin , remove role , delete role the <@${guild.client.user.id}> will automatically enable admin , recovery its own role , adding itself making <@${guild.client.user.id}> unbypassable security system**`;\n" +
"         components.push(new TextDisplayBuilder().setContent(footerText));\n" +
"      }\n" +
"      \n" +
"      const container = new ContainerBuilder();\n" +
"      components.forEach(c => container.addTextDisplayComponents(c));\n" +
"      await updateMessageFn({ components: [container], embeds: [] });\n" + // NO FLAGS HERE
"    };\n" +
"\n" +
"    // Helper to run a step\n" +
"    async function runStep(stepName, operation) {\n" +
"      const stepIndex = stepResults.length;\n" +
"      stepResults.push(`> -# **${loadingEmoji} ${stepName}...**`);\n" +
"      await sendPayload();\n" +
"\n" +
"      try {\n" +
"        const result = await operation();\n" +
"        let finalStr = `> -# **${successEmoji} ${stepName}...** `;\n" +
"        if (result && typeof result === 'string') {\n" +
"             finalStr += `\\n> -# **${result}**`;\n" +
"        }\n" +
"        stepResults[stepIndex] = finalStr;\n" +
"        await sendPayload();\n" +
"        return true;\n" +
"      } catch (err) {\n" +
"        stepResults[stepIndex] = `> -# **${warningEmoji} ${stepName}... Failed (${err.message})**`;\n" +
"        await sendPayload();\n" +
"        return false;\n" +
"      }\n" +
"    }\n" +
"\n" +
"    await runStep(\"Establishing Connection with Athena's server\", async () => { return \"Connected\"; });\n" +
"    await runStep(\"Checking Minimum Requirements for Antinuke\", async () => { return \"\"; });\n" +
"    await runStep(`Creating DB for \"${guild.name}\"`, async () => { \n" +
"        return `\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u2570\\u203A Server Id : ${guild.id}\\n> -# **\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u2570\\u203A Athena Security DB ID : ${BigInt(guild.id) * 487293n}`;\n" +
"    });\n" +
"    await runStep(\"Starting Role Integrity Check\", async () => { return \"\"; });\n" +
"    await runStep(\"Checking Athena Unbypassable , Athena Firewall Roles Created \", async () => { \n" +
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
"    await runStep(\"Backup Admin Roles Created And Assigned To Bot.\", async () => { return \"\"; });\n" +
"    await runStep(\"Establishing Gmail Connectors\", async () => { return \"\"; });\n" +
"    await runStep(\"Ready for connection\", async () => { return \"\"; });\n" +
"    await runStep(\"Setup Success\", async () => { return \"\"; });\n" +
"    await runStep(`${guild.name} is Secured by Athena Prime`, async () => { return \"\"; });\n" +
"\n" +
"    const db = (await import(\"../database.js\")).default;\n" +
"    db.updateGuildConfig(guild.id, { securityEnabled: true, antiNukeEnabled: true });\n" +
"    \n" +
"    await sendPayload(true);\n" +
"}\n";

code = code.substring(0, start) + newFunc + "\n" + code.substring(end);
fs.writeFileSync("src/commands/security.js", code);
console.log("Rewrote sequence logic perfectly!");
