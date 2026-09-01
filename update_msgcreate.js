import fs from "fs";

let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

text = text.replace(
    "const hasLinkBypassRole = dbConfig.linkBypassRole && message.member.roles.cache.has(dbConfig.linkBypassRole);",
    "const hasLinkBypassRole = dbConfig.linkBypassRoles && dbConfig.linkBypassRoles.length > 0 && message.member.roles.cache.hasAny(...dbConfig.linkBypassRoles);"
);

text = text.replace(
    "const hasInviteBypassRole = dbConfig.inviteBypassRole && message.member.roles.cache.has(dbConfig.inviteBypassRole);",
    "const hasInviteBypassRole = dbConfig.inviteBypassRoles && dbConfig.inviteBypassRoles.length > 0 && message.member.roles.cache.hasAny(...dbConfig.linkBypassRoles);"
);

// Wait, I put linkBypassRoles in the inviteBypassRole check! Let me fix that.
text = text.replace(
    "const hasInviteBypassRole = dbConfig.inviteBypassRoles && dbConfig.inviteBypassRoles.length > 0 && message.member.roles.cache.hasAny(...dbConfig.linkBypassRoles);",
    "const hasInviteBypassRole = dbConfig.inviteBypassRoles && dbConfig.inviteBypassRoles.length > 0 && message.member.roles.cache.hasAny(...dbConfig.inviteBypassRoles);"
);

fs.writeFileSync("src/events/messageCreate.js", text);
