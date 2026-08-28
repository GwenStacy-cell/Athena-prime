import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Revert the init message back to CV2 component
code = code.replace(/const msg = await message\.reply\(\{ embeds: \[new EmbedBuilder\(\)\.setColor\(0x2B2D31\)\.setDescription\('# SECURITY SHIELD SEQUENCE\\n\\n<a:alert1:1533860044154732704> __\*\*INITIALIZING SECURITY PROTOCOLS\.\.\.\*\*__'\)\] \}\);/g, 
  "const initDisplay = new TextDisplayBuilder().setContent('> -# **SECURITY SHIELD SEQUENCE**\\n> \\n> -# <a:alert1:1533860044154732704> **INITIALIZING SECURITY PROTOCOLS...**');\n          const initContainer = new ContainerBuilder().addTextDisplayComponents(initDisplay);\n          const msg = await message.reply({ components: [initContainer], flags: MessageFlags.IsComponentsV2 });");

code = code.replace(/await interaction\.reply\(\{ embeds: \[new EmbedBuilder\(\)\.setColor\(0x2B2D31\)\.setDescription\('# SECURITY SHIELD SEQUENCE\\n\\n<a:alert1:1533860044154732704> __\*\*INITIALIZING SECURITY PROTOCOLS\.\.\.\*\*__'\)\] \}\);/g, 
  "const initDisplay2 = new TextDisplayBuilder().setContent('> -# **SECURITY SHIELD SEQUENCE**\\n> \\n> -# <a:alert1:1533860044154732704> **INITIALIZING SECURITY PROTOCOLS...**');\n          const initContainer2 = new ContainerBuilder().addTextDisplayComponents(initDisplay2);\n          await interaction.reply({ components: [initContainer2], flags: MessageFlags.IsComponentsV2 });");

// Fix the updateMessageFn to pass the CV2 flag and clear embeds
code = code.replace(/await updateMessageFn\(\{ components: \[container\] \}\);/g, 
  "await updateMessageFn({ components: [container], embeds: [], flags: MessageFlags.IsComponentsV2 });");

fs.writeFileSync("src/commands/security.js", code);
console.log("Reverted init messages to CV2 with blockquotes!");
