import fs from "fs";
let js = fs.readFileSync("src/utils/antinuke.js", "utf8");
js = js.replace(/case\s*AuditLogEvent\.InviteCreate:\s*case\s*AuditLogEvent\.InviteDelete:\s*if\s*\(!mods\.antiInvite\)\s*return;\s*eventType\s*=\s*'Unauthorized Invite Tampering';/g, 
`case AuditLogEvent.InviteCreate:
      case AuditLogEvent.InviteDelete:
        if (config.antiInviteEnabled !== true) return;
        eventType = 'Unauthorized Invite Tampering';`);
fs.writeFileSync("src/utils/antinuke.js", js);
