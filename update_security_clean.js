import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

// We'll strip out anything in brackets from the modLabels
// It looks like: 'Anti Role Create [5-10ms WSS] [Reactive Strike]'
// We want to turn it back into: 'Anti Role Create'

const replacements = {
  antiRoleCreate: 'Anti Role Create',
  antiRoleDelete: 'Anti Role Delete',
  antiRoleUpdate: 'Anti Role Update',
  antiRolePermUpdate: 'Anti Role Perm Update',
  antiMemberRoleUpdate: 'Anti Member Role Update',
  antiRoleReorder: 'Anti Role Reorder',
  antiChannelCreate: 'Anti Channel Create',
  antiChannelDelete: 'Anti Channel Delete',
  antiChannelUpdate: 'Anti Channel Update',
  antiChannelPermUpdate: 'Anti Channel Perm Update',
  antiChannelReorder: 'Anti Channel Reorder',
  antiChannelNameMod: 'Anti Channel Name Mod',
  antiEmojiCreate: 'Anti Emoji Create',
  antiEmojiDelete: 'Anti Emoji Delete',
  antiEmojiUpdate: 'Anti Emoji Update',
  antiWebhooks: 'Anti Webhooks',
  antiBotAdd: 'Anti Bot Add',
  antiServerUpdate: 'Anti Server Update',
  antiBan: 'Anti Ban',
  antiKick: 'Anti Kick',
  antiUnban: 'Anti Unban',
  antiInvite: 'Anti Invite',
  antiScheduledEvents: 'Anti Scheduled Events',
  antiMemberPurge: 'Anti Member Purge',
  antiMassBan: 'Anti Mass Ban',
  antiAutomodUpdate: 'Anti Automod Update',
  antiAppCommands: 'Anti App Commands'
};

for (const [key, value] of Object.entries(replacements)) {
  const regex = new RegExp(`${key}: 'Anti [^']+'`, 'g');
  sec = sec.replace(regex, `${key}: '${value}'`);
}

fs.writeFileSync("src/commands/security.js", sec);
