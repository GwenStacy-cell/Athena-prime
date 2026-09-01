import fs from "fs";
let ezal = fs.readFileSync("src/commands/ezal.js", "utf8");

const replacement = `{
        name: 'Spam Access Control',
        value:
          '\`ezal spampermit <userId>\` - Grant a user spam command access\\n' +
          '\`ezal spamrevoke <userId>\` - Revoke spam command access\\n' +
          '\`ezal spamlist\` - List all permitted spammers'
      },
      {
        name: 'Global Voice Control',
        value:
          '\`!botvoice <action> [all]\` - Control bot mute/deaf state (mute, unmute, deafen, undeafen, active, idle, music)\\n' +
          '\`!botvoice save\` - Memorizes current voice states across ALL servers globally\\n' +
          '\`!botvoice restore\` - Reverts all servers globally back to their memorized states'
      },`;

// The original text in ezal.js has a weird unicode character `?"` instead of `-` for spampermit
ezal = ezal.replace(
      /\{\s*name:\s*'Spam Access Control'[\s\S]*?'\`ezal spamlist\`[^']*'\s*\}/,
      replacement
);

fs.writeFileSync("src/commands/ezal.js", ezal);
