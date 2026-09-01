import fs from "fs";

let js = fs.readFileSync("src/utils/antinuke.js", "utf8");

const oldCode3 = `case AuditLogEvent.InviteCreate:
      case AuditLogEvent.InviteDelete:
        if (!mods.antiInvite) return;
        eventType = 'Unauthorized Invite Tampering';`;

const newCode3 = `case AuditLogEvent.InviteCreate:
      case AuditLogEvent.InviteDelete:
        if (config.antiInviteEnabled !== true) return;
        eventType = 'Unauthorized Invite Tampering';`;

js = js.replace(oldCode3, newCode3);

fs.writeFileSync("src/utils/antinuke.js", js);
