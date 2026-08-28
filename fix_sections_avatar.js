import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Change calls to pass guild
code = code.replace(/await getServerSecurityEnabledPanel\(\)/g, "await getServerSecurityEnabledPanel(message.guild || interaction.guild)");

// Change function definition and use avatar
const targetFunc = "export async function getServerSecurityEnabledPanel() {";
const newFunc = `export async function getServerSecurityEnabledPanel(guild) {
    const avatar = guild ? guild.client.user.displayAvatarURL({ extension: "png" }) : "https://cdn.discordapp.com/embed/avatars/0.png";`;

code = code.replace(targetFunc, newFunc);
code = code.replace(/"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/c\/ce\/Transparent\.gif"/g, "avatar");

fs.writeFileSync("src/commands/security.js", code);
console.log("Injected valid avatar into SectionBuilders to force grey line rendering!");
