import { commands as moderationCmds } from './moderation.js';
import { commands as securityCmds } from './security.js';
import { commands as utilityCmds } from './utility.js';
import { commands as enukeCmds } from './enuke.js';
import { commands as spamCmds } from './spam.js';

export const allCommands = [
  ...moderationCmds,
  ...securityCmds,
  ...utilityCmds,
  ...enukeCmds,
  ...spamCmds
];

export const commandMap = new Map();
allCommands.forEach(cmd => {
  commandMap.set(cmd.name, cmd);
});

export default commandMap;
