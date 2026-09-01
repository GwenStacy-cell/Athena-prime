import fs from "fs";

let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `    await runStep("Establishing Gmail Connectors", async () => { return ""; });`;

const newCode = `    await runStep("Setting Up Athena's Dashboard", async () => { 
        const existing = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
        const { setupDashboardChannel } = await import("../utils/dashboardManager.js");
        await setupDashboardChannel(guild, guild.client);
        if (existing) {
           return \`\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Previous athena's dashboard found !!!\`;
        } else {
           return \`\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Athena's Dashboard created !!!\`;
        }
    });
    await runStep("Establishing Gmail Connectors", async () => { return ""; });`;

js = js.replace(oldCode, newCode);

fs.writeFileSync("src/commands/security.js", js);
