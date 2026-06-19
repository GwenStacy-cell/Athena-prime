import { commands as moderationCmds } from './moderation.js';
import { commands as securityCmds } from './security.js';
import { commands as utilityCmds } from './utility.js';
import { commands as enukeCmds } from './enuke.js';
import { commands as spamCmds } from './spam.js';
import { commands as modmodeCmds } from './modmode.js';
import { commands as vcdragCmds } from './vcdrag.js';
import { commands as triggerCmds } from './trigger.js';
import { commands as jtcCmds } from './jtc.js';
import { commands as welcomeCmds } from './welcome.js';
import { commands as accentCmds } from './accent.js';
import { commands as invitesCmds } from './invites.js';
import { commands as rrCmds } from './rr.js';
import { commands as serverstatsCmds } from './serverstats.js';
import { commands as birthdayCmds } from './birthday.js';
import { commands as giveawayCmds } from './giveaway.js';
import { commands as statsCmds } from './stats.js';
import { commands as newsCmds } from './news.js';

export const allCommands = [
  ...moderationCmds,
  ...securityCmds,
  ...utilityCmds,
  ...enukeCmds,
  ...spamCmds,
  ...modmodeCmds,
  ...vcdragCmds,
  ...triggerCmds,
  ...jtcCmds,
  ...welcomeCmds,
  ...accentCmds,
  ...invitesCmds,
  ...rrCmds,
  ...serverstatsCmds,
  ...birthdayCmds,
  ...giveawayCmds,
  ...statsCmds,
  ...newsCmds
];

export const commandMap = new Map();
allCommands.forEach(cmd => {
  commandMap.set(cmd.name, cmd);
  if (cmd.aliases) {
    cmd.aliases.forEach(alias => commandMap.set(alias, cmd));
  }
});

export default commandMap;
