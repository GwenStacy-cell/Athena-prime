import fs from "fs";
let si = fs.readFileSync("src/commands/si.js", "utf8");

si = si.replace("import { PermissionFlagsBits } from 'discord.js';", "import { PermissionFlagsBits, MessageFlags } from 'discord.js';");
si = si.replace("flags: 1 << 14", "flags: MessageFlags.IsComponentsV2");
si = si.replace("flags: 1 << 14", "flags: MessageFlags.IsComponentsV2");

fs.writeFileSync("src/commands/si.js", si);
