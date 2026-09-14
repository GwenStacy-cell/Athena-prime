import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

js = js.replace(/await runSecurityEnableSequence\(message\.guild, async \(payload\) => \{\s+await msg\.edit\(payload\)\.catch\(\(\) => null\);\s+\}\);/g, `const success = await runSecurityEnableSequence(message.guild, async (payload) => { await msg.edit(payload).catch(() => null); }); if (!success) return;`);

js = js.replace(/await runSecurityEnableSequence\(interaction\.guild, async \(payload\) => \{\s+await interaction\.editReply\(payload\)\.catch\(\(\) => null\);\s+\}\);/g, `const success = await runSecurityEnableSequence(interaction.guild, async (payload) => { await interaction.editReply(payload).catch(() => null); }); if (!success) return;`);

fs.writeFileSync("src/commands/security.js", js);
