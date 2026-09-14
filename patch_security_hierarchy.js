import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `             await new Promise(r => setTimeout(r, 2000));
             const rolesFresh = await guild.roles.fetch(undefined, { force: true });
             const checkFW = rolesFresh.some(r => r.name === "Athena Firewall");
             const checkUNB = rolesFresh.some(r => r.name === "Athena Unbypassable");
             if (!checkFW || !checkUNB) {
                 throw new Error("Roles deleted by another bot!");
             }`;

const newCode = `             await new Promise(r => setTimeout(r, 2000));
             const rolesFresh = await guild.roles.fetch(undefined, { force: true });
             const existFW = rolesFresh.some(r => r.name === "Athena Firewall");
             const existUNB = rolesFresh.some(r => r.name === "Athena Unbypassable");
             
             if (!existFW || !existUNB) {
                 throw new Error("Roles deleted by another bot!");
             }
             
             const meFresh = await guild.members.fetch({ user: guild.client.user.id, force: true });
             const hasFWNew = meFresh.roles.cache.some(r => r.name === "Athena Firewall");
             const hasUNBNew = meFresh.roles.cache.some(r => r.name === "Athena Unbypassable");
             
             if (!hasFWNew || !hasUNBNew) {
                 throw new Error("Secondary roles found! Please place Athena's role above them in Server Settings so she can assign them.");
             }`;

if (js.includes(oldCode)) {
    js = js.replace(oldCode, newCode);
    fs.writeFileSync("src/commands/security.js", js);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find code to replace!");
}
