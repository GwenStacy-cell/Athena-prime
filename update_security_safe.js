import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

const old1 = `const modLabels = {
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
    antiBan: 'Anti Ban / Kick',
    antiKick: 'Anti Ban / Kick',
    antiUnban: 'Anti Unban Members',
    antiInvite: 'Anti Invite (Danger)'
  };`;

const new1 = `const modLabels = {
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
    antiBan: 'Anti Ban / Kick [0ms API]',
    antiKick: 'Anti Ban / Kick [0ms API]',
    antiUnban: 'Anti Unban Members [0ms WSS]',
    antiInvite: 'Anti Invite (Danger) [0ms WSS]'
  };`;

const old2 = `const modLabels = {
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
  };`;

const new2 = `const modLabels = {
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
  };`;

sec = sec.replace(old1, new1);
sec = sec.replace(old2, new2);

fs.writeFileSync("src/commands/security.js", sec);
