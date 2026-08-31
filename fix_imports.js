import fs from "fs";

let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Add top-level imports
text = text.replace(
    "import { PermissionFlagsBits, EmbedBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags , ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';",
    "import { PermissionFlagsBits, EmbedBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, SectionBuilder, ThumbnailBuilder } from 'discord.js';"
);

// Remove local dynamic imports
text = text.replace(
    /const \{ ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags \} = await import\('discord.js'\);\n/g,
    ""
);

fs.writeFileSync("src/events/messageCreate.js", text);

let text2 = fs.readFileSync("src/commands/security.js", "utf8");
text2 = text2.replace(
    /const \{ ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags \} = await import\('discord.js'\);\n/g,
    ""
);

fs.writeFileSync("src/commands/security.js", text2);
