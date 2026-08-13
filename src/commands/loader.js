import { commands as moderationCmds } from './moderation.js';
import { commands as securityCmds } from './security.js';
import { commands as utilityCmds } from './utility.js';
import { commands as enukeCmds } from './enuke.js';
import { commands as ezalCmds } from './ezal.js';
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
import { commands as serverlogsCmds } from './serverlogs.js';
import { commands as birthdayCmds } from './birthday.js';
import { commands as giveawayCmds } from './giveaway.js';
import { commands as statsCmds } from './stats.js';
import { commands as newsCmds } from './news.js';
import { commands as announceCmds } from './announce.js';
import { commands as verifyCmds } from './verify.js';
import { commands as ticketCmds } from './ticket.js';
import { commands as ticketPanelCmds } from './ticketpanel.js';
import { commands as levelingCmds } from './leveling.js';
import { commands as moveprotectCmds } from './moveprotect.js';
import { commands as vcprotectCmds } from './vcprotect.js';
import { commands as serveroverviewCmds } from './serveroverview.js';
import { commands as vcCmds } from './vc.js';
import { commands as hideCmds } from './hide.js';
import { commands as userinfoCmds } from './userinfo.js';
import { commands as rolemanagerCmds } from './rolemanager.js';
import { commands as theaterCmds } from './theater.js';
import { commands as bumpCmds } from './bump.js';
import { commands as musicCmds } from './music.js';
import { commands as rateCmds } from './rate.js';
import { commands as rateLeaderboardCmds } from './rateleaderboard.js';
import { commands as recordCmds } from './record.js';
import { commands as dateCmds } from './date.js';
import { commands as topCmds } from './top.js';
import { commands as stickyCmds } from './sticky.js';
import { commands as fckCmds } from './fck.js';
import { commands as afkCmds } from './afk.js';
import { commands as emojiStealerCmds } from './emojistealer.js';
import { commands as setDeleteLogCmds } from './setdeletelog.js';
import { commands as channelAdminCmds } from './channeladmin.js';
import { commands as youtubeCmds } from './youtube.js';
import { commands as snipeCmds } from './snipe.js';
import { commands as vcpanelCmds } from './vcpanel.js';

export const allCommands = [
  ...youtubeCmds,
  ...snipeCmds,
  ...vcpanelCmds,
  ...channelAdminCmds,
  ...moderationCmds,
  ...securityCmds,
  ...utilityCmds,
  ...enukeCmds,
  ...ezalCmds,
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
  ...serverlogsCmds,
  ...birthdayCmds,
  ...giveawayCmds,
  ...statsCmds,
  ...newsCmds,
  ...announceCmds,
  ...verifyCmds,
  ...ticketCmds,
  ...ticketPanelCmds,
  ...levelingCmds,
  ...moveprotectCmds,
  ...vcprotectCmds,
  ...serveroverviewCmds,
  ...vcCmds,
  ...hideCmds,
  ...userinfoCmds,
  ...rolemanagerCmds,
  ...theaterCmds,
  ...bumpCmds,
  ...musicCmds,
  ...rateCmds,
  ...recordCmds,
  ...dateCmds,
  ...topCmds,
  ...stickyCmds,
  ...fckCmds,
  ...afkCmds,
  ...emojiStealerCmds,
  ...setDeleteLogCmds,
  ...rateLeaderboardCmds
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
