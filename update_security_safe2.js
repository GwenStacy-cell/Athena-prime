import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

// We'll replace the values in the modLabels objects directly
const replacements = {
  antiRoleCreate: 'Anti Role Create [0ms WSS]',
  antiRoleDelete: 'Anti Role Delete [0ms API]',
  antiRoleUpdate: 'Anti Role Update [0ms WSS]',
  antiRolePermUpdate: 'Anti Role Perm Update [0ms WSS]',
  antiMemberRoleUpdate: 'Anti Member Role Update [0ms WSS]',
  antiRoleReorder: 'Anti Role Reorder [0ms WSS]',
  antiChannelCreate: 'Anti Channel Create [0ms API]',
  antiChannelDelete: 'Anti Channel Delete [0ms API]',
  antiChannelUpdate: 'Anti Channel Update [0ms WSS]',
  antiChannelPermUpdate: 'Anti Channel Perm Update [0ms WSS]',
  antiChannelReorder: 'Anti Channel Reorder [0ms WSS]',
  antiChannelNameMod: 'Anti Channel Name Mod [0ms WSS]',
  antiEmojiCreate: 'Anti Emoji Create [0ms API]',
  antiEmojiDelete: 'Anti Emoji Delete [0ms API]',
  antiEmojiUpdate: 'Anti Emoji Update [0ms WSS]',
  antiWebhooks: 'Anti Webhooks [0ms API]',
  antiBotAdd: 'Anti Bot Add [0ms API]',
  antiServerUpdate: 'Anti Server Update [0ms WSS]',
  antiBan: 'Anti Ban [0ms API]',
  antiKick: 'Anti Kick [0ms API]',
  antiUnban: 'Anti Unban [0ms WSS]',
  antiInvite: 'Anti Invite [0ms WSS]',
  antiScheduledEvents: 'Anti Scheduled Events [0ms WSS]',
  antiMemberPurge: 'Anti Member Purge [0ms WSS]',
  antiMassBan: 'Anti Mass Ban [0ms WSS]',
  antiAutomodUpdate: 'Anti Automod Update [0ms WSS]',
  antiAppCommands: 'Anti App Commands [0ms WSS]'
};

for (const [key, value] of Object.entries(replacements)) {
  const regex1 = new RegExp(`${key}: 'Anti [^']+'`, 'g');
  const regex2 = new RegExp(`${key}: 'Anti [^']+\\\(Danger\\\)'`, 'g');
  sec = sec.replace(regex1, `${key}: '${value}'`);
  sec = sec.replace(regex2, `${key}: '${value}'`);
}

fs.writeFileSync("src/commands/security.js", sec);
