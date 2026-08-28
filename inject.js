import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const target1 = "const panel = await getSecureDashboardPanel(message.guild);";
const replacement1 = `const tosPanel = await getServerSecurityEnabledPanel();
        await message.channel.send(tosPanel);
        const panel = await getSecureDashboardPanel(message.guild);`;
code = code.replace(target1, replacement1);

const target2 = "const panel = await getSecureDashboardPanel(interaction.guild);";
const replacement2 = `const tosPanel = await getServerSecurityEnabledPanel();
        await interaction.channel.send(tosPanel);
        const panel = await getSecureDashboardPanel(interaction.guild);`;
code = code.replace(target2, replacement2);

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed!");
