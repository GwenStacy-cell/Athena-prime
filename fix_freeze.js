import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// 1. Remove stray blockquotes in TOS panel
code = code.replace(/\\n> \\n/g, "\\n\\n");

// 2. Fix the initialization message to be an embed so it can be safely edited into the sequence embed
code = code.replace(/const initDisplay = new TextDisplayBuilder\(\)\.setContent\('# SECURITY SHIELD SEQUENCE\\n\\n<a:alert1:1533860044154732704> __\*\*INITIALIZING SECURITY PROTOCOLS\.\.\.\*\*__'\);\s*const initContainer = new ContainerBuilder\(\)\.addTextDisplayComponents\(initDisplay\);\s*const msg = await message\.reply\(\{ components: \[initContainer\], flags: MessageFlags\.IsComponentsV2 \}\);/g, 
  "const msg = await message.reply({ embeds: [new EmbedBuilder().setColor(0x2B2D31).setDescription('# SECURITY SHIELD SEQUENCE\\n\\n<a:alert1:1533860044154732704> __**INITIALIZING SECURITY PROTOCOLS...**__')] });");

code = code.replace(/const initDisplay2 = new TextDisplayBuilder\(\)\.setContent\('# SECURITY SHIELD SEQUENCE\\n\\n<a:alert1:1533860044154732704> __\*\*INITIALIZING SECURITY PROTOCOLS\.\.\.\*\*__'\);\s*const initContainer2 = new ContainerBuilder\(\)\.addTextDisplayComponents\(initDisplay2\);\s*await interaction\.reply\(\{ components: \[initContainer2\], flags: MessageFlags\.IsComponentsV2 \}\);/g, 
  "await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2B2D31).setDescription('# SECURITY SHIELD SEQUENCE\\n\\n<a:alert1:1533860044154732704> __**INITIALIZING SECURITY PROTOCOLS...**__')] });");

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed sequence freeze and stray TOS lines!");
