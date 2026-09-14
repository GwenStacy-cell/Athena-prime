import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `             await new Promise(r => setTimeout(r, 1000));
             const meCheck = guild.members.me;
             const checkFW = meCheck.roles.cache.some(r => r.name === "Athena Firewall");
             const checkUNB = meCheck.roles.cache.some(r => r.name === "Athena Unbypassable");
             if (!checkFW || !checkUNB) {
                 throw new Error("Roles deleted by another bot!");
             }`;

const newCode = `             await new Promise(r => setTimeout(r, 2000));
             const rolesFresh = await guild.roles.fetch(undefined, { force: true });
             const checkFW = rolesFresh.some(r => r.name === "Athena Firewall");
             const checkUNB = rolesFresh.some(r => r.name === "Athena Unbypassable");
             if (!checkFW || !checkUNB) {
                 throw new Error("Roles deleted by another bot!");
             }`;

if (js.includes(oldCode)) {
    js = js.replace(oldCode, newCode);
    fs.writeFileSync("src/commands/security.js", js);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find code");
}
