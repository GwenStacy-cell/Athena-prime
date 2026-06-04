import { commands as moderationCmds } from './moderation.js';
import { commands as securityCmds } from './security.js';
import { commands as utilityCmds } from './utility.js';
import { commands as enukeCmds } from './enuke.js';
import { commands as spamCmds } from './spam.js';
import { commands as modmodeCmds } from './modmode.js';
import { commands as vcdragCmds } from './vcdrag.js';

export const allCommands = [
  ...moderationCmds,
  ...securityCmds,
  ...utilityCmds,
  ...enukeCmds,
  ...spamCmds,
  ...modmodeCmds,
  ...vcdragCmds
];

export const commandMap = new Map();
allCommands.forEach(cmd => {
  commandMap.set(cmd.name, cmd);
});

export default commandMap;
