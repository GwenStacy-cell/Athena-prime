import fs from "fs";

let code = fs.readFileSync("src/utils/antinuke.js", "utf8");

const switchStart = code.indexOf("switch (action) {");
const switchEnd = code.indexOf("  if (!eventType) return;", switchStart);

if (switchStart === -1 || switchEnd === -1) {
    console.error("Could not find switch block");
    process.exit(1);
}

const newSwitch = `switch (action) {
    case AuditLogEvent.BotAdd:
      if (!mods.antiBotAdd) return;
      if (!isAuthorized(guild, executor, 'antibot')) {
        if (targetId !== guild.client.user.id) {
          guild.members.ban(targetId, { reason: 'Athena Anti-Nuke: Unauthorized bot addition' }).catch(() => null);
        }
        eventType = 'Unauthorized Bot Addition';
        forceBan = true;
      } else return;
      break;

    case AuditLogEvent.MemberUnban:
      if (!mods.antiUnban) return;
      const recentBan = recentBans.get(\`\${guild.id}:\${targetId}\`);
      if (recentBan) {
        guild.members.ban(targetId, { reason: 'Athena Anti-Nuke: Re-applying removed ban' }).catch(() => null);
        eventType = 'Unauthorized Ban Removal';
        forceBan = true;
      } else return;
      break;

    case AuditLogEvent.RoleUpdate:
      const pChange = entry.changes?.find(c => c.key === 'permissions');
      const nChange = entry.changes?.find(c => c.key === 'name');
      const posChange = entry.changes?.find(c => c.key === 'position');
      
      if (pChange && (mods.antiRolePermUpdate || mods.antiRoleUpdate)) {
        const oldPerms = new PermissionsBitField(BigInt(pChange.old || 0));
        const newPerms = new PermissionsBitField(BigInt(pChange.new || 0));
        if (DANGEROUS_PERMS.some(p => !oldPerms.has(p) && newPerms.has(p))) {
          eventType = 'Role Permission Escalation';
          forceBan = true;
        }
      } else if (nChange && mods.antiRoleUpdate) {
        eventType = 'Role Name Modification';
      } else if (posChange && mods.antiRoleReorder) {
        eventType = 'Role Reorder / Hierarchy Tampering';
      }
      break;

    case AuditLogEvent.MemberRoleUpdate:
      if (!mods.antiMemberRoleUpdate) return;
      const rolesChange = entry.changes?.find(c => c.key === '$add');
      if (rolesChange?.new?.length) {
        const dangerous = rolesChange.new.some(rObj => {
          const r = guild.roles.cache.get(rObj.id);
          return r && hasDangerousPerms(r.permissions);
        });
        if (dangerous) {
          eventType = 'Unauthorized Dangerous Role Grant';
          forceBan = true;
        }
      }
      break;

    case AuditLogEvent.GuildUpdate:
      if (!mods.antiServerUpdate) return;
      eventType = 'Server Settings Tampering';
      forceBan = true;
      break;

    case AuditLogEvent.ChannelUpdate:
      const cpChange = entry.changes?.find(c => c.key === 'permission_overwrites');
      const cnChange = entry.changes?.find(c => c.key === 'name');
      const cposChange = entry.changes?.find(c => c.key === 'position');
      
      if (cpChange && (mods.antiChannelPermUpdate || mods.antiChannelUpdate)) {
        eventType = 'Channel Permission Tampering';
      } else if (cnChange && (mods.antiChannelNameMod || mods.antiChannelUpdate)) {
        eventType = 'Channel Name Modification';
      } else if (cposChange && (mods.antiChannelReorder || mods.antiChannelUpdate)) {
        eventType = 'Channel Reorder / Tampering';
      } else if (mods.antiChannelUpdate) {
        eventType = 'Channel Settings Tampering';
      }
      break;

    case AuditLogEvent.EmojiUpdate:
      if (!mods.antiEmojiUpdate) return;
      eventType = 'Emoji Modification';
      break;

    case AuditLogEvent.InviteCreate:
    case AuditLogEvent.InviteDelete:
      if (!mods.antiInvite) return;
      eventType = 'Unauthorized Invite Tampering';
      break;

    case AuditLogEvent.GuildScheduledEventCreate:
    case AuditLogEvent.GuildScheduledEventUpdate:
    case AuditLogEvent.GuildScheduledEventDelete:
      if (!mods.antiScheduledEvents) return;
      eventType = 'Scheduled Event Tampering';
      break;

    case AuditLogEvent.AutoModerationRuleCreate:
    case AuditLogEvent.AutoModerationRuleUpdate:
    case AuditLogEvent.AutoModerationRuleDelete:
      if (!mods.antiAutomodUpdate) return;
      eventType = 'AutoMod Rule Tampering';
      forceBan = true;
      break;

    case AuditLogEvent.IntegrationCreate:
    case AuditLogEvent.IntegrationUpdate:
    case AuditLogEvent.IntegrationDelete:
      if (!mods.antiAppCommands) return;
      eventType = 'Integration / App Command Tampering';
      forceBan = true;
      break;

    // Purge / Mass Ban are typically high velocity triggers. We'll add them here just to catch explicit single events if enabled, though directStrike handles velocity.
    case AuditLogEvent.MemberKick:
      if (!mods.antiMemberPurge && !mods.antiKick) return;
      eventType = 'Unauthorized Kick (Purge Module)';
      break;

    case AuditLogEvent.MemberBanAdd:
      if (!mods.antiMassBan && !mods.antiBan) return;
      eventType = 'Unauthorized Ban (Mass Ban Module)';
      break;

    default: return;
  }
`;

code = code.substring(0, switchStart) + newSwitch + "\n" + code.substring(switchEnd);

fs.writeFileSync("src/utils/antinuke.js", code);
