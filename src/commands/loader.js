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
import { commands as announceCmds } from './announce.js';
import { commands as verifyCmds } from './verify.js';
import { commands as ticketCmds } from './ticket.js';
import { commands as levelingCmds } from './leveling.js';
import { commands as moveprotectCmds } from './moveprotect.js';
import { commands as serveroverviewCmds } from './serveroverview.js';
import { commands as vcCmds } from './vc.js';
import { commands as userinfoCmds } from './userinfo.js';
import { commands as rolemanagerCmds } from './rolemanager.js';
import { commands as theaterCmds } from './theater.js';

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
  ...newsCmds,
  ...announceCmds,
  ...verifyCmds,
  ...ticketCmds,
  ...levelingCmds,
  ...moveprotectCmds,
  ...serveroverviewCmds,
  ...vcCmds,
  ...userinfoCmds,
  ...rolemanagerCmds,
  ...theaterCmds
];

export const commandMap = new Map();

for (const cmd of allCommands) {
  commandMap.set(cmd.name, cmd);
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      commandMap.set(alias, cmd);
    }
  }
}

export default commandMap;
