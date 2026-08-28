import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `    await runStep("Checking Athena Unbypassable , Athena Firewall Roles Created ", async () => { 
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
    await runStep("Backup Admin Roles Created And Assigned To Bot.", async () => { return ""; });`;

const newCode = `    await runStep("Checking Athena Unbypassable , Athena Firewall Roles Created ", async () => { 
        const { ensureUnbypassableRole } = await import("../utils/antiStrip.js");
        await ensureUnbypassableRole(guild);
        return ""; 
    });
    await runStep("Backup Admin Roles Created And Assigned To Bot.", async () => { 
        const me = guild.members.me;
        const hasFW = me.roles.cache.some(r => r.name === "Athena Firewall");
        const hasUNB = me.roles.cache.some(r => r.name === "Athena Unbypassable");
        if (!hasFW || !hasUNB) {
           const { ensureUnbypassableRole } = await import("../utils/antiStrip.js");
           await ensureUnbypassableRole(guild);
        }
        return ""; 
    });`;

code = code.replace(oldCode, newCode);

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed setup sequence to actually create and assign the unbypassable roles!");
