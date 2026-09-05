import fs from "fs";
let js = fs.readFileSync("src/utils/antinuke.js", "utf8");

js = js.replace(
  /case AuditLogEvent\.InviteCreate:\s*case AuditLogEvent\.InviteDelete:\s*if \(config\.antiInviteEnabled !== true\) return;\s*eventType = 'Unauthorized Invite Tampering';\s*break;/g,
  `// Invite Tampering punishment removed per user request: "should not ban or punish anyone who generates server link"`
);

fs.writeFileSync("src/utils/antinuke.js", js);
