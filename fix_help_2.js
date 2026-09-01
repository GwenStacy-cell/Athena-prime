import fs from "fs";
let ezal = fs.readFileSync("src/commands/ezal.js", "utf8");

const replacement = `{
        name: 'Global Voice Control',
        value:
          '\`!botvoice save\` - Memorizes current voice states across ALL servers globally\\n' +
          '\`!botvoice restore\` - Reverts all servers globally back to their memorized states\\n' +
          '\`!botvoice mute [all]\` - **Server Mutes** the bot only\\n' +
          '\`!botvoice unmute [all]\` - **Server Unmutes** the bot only\\n' +
          '\`!botvoice deafen [all]\` - **Server Deafens** the bot only\\n' +
          '\`!botvoice undeafen [all]\` - **Server Undeafens** the bot only\\n' +
          '\`!botvoice active [all]\` - **Server Unmutes & Undeafens** the bot (Recording Mode)\\n' +
          '\`!botvoice idle [all]\` - **Server Mutes & Deafens** the bot (Quiet Mode)\\n' +
          '\`!botvoice music [all]\` - **Unmutes & Deafens** the bot (Music Mode)\\n' +
          '> Add \`all\` to apply globally, or run \`botvoice <ServerID> <action>\` in DMs to target one server.'
        },`;

ezal = ezal.replace(
      /\{\s*name:\s*'Global Voice Control'[\s\S]*?'\`!botvoice music \[all\]\`[^']*'\s*\+\s*'> Add \`all\`[^']*'\s*\},/,
      replacement
);

fs.writeFileSync("src/commands/ezal.js", ezal);
