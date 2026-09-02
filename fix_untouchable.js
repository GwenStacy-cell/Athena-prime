import fs from "fs";

function fixFile(file) {
  let js = fs.readFileSync(file, "utf8");
  
  // Replace the corrupted untouchable messages and add the bypass check
  // Moderation commands (handleTimeout, handleKick, handleBan, handleForceBan)
  js = js.replace(/if \(isBotOwnerSync\(target\.id\) \|\| isExtraOwner\(guild\.id, target\.id\)\) \{\s+return cv2\.danger\(' Untouchable', '.*?This user is protected by \*\*Athena Prime\*\* and cannot be (moderated|banned)\.'\);\s+\}/g, 
    "if (!isBotOwnerSync(moderator.id) && (isBotOwnerSync(target.id) || isExtraOwner(guild.id, target.id))) {\n    return cv2.danger('Untouchable', 'This user is protected by **Athena Prime** and cannot be $1.');\n  }");

  // Moderation warning
  js = js.replace(/if \(!force && \(isBotOwnerSync\(target\.id\) \|\| guild\.ownerId === target\.id\)\) \{\s+return cv2\.danger\('Untouchable', `You cannot take action against \*\*.*?\*\*\.\\n\\nThey are protected by \*\*Athena Prime's\*\* highest security clearance.`\);\s+\}/g,
    "if (!force && !isBotOwnerSync(moderator.id) && (isBotOwnerSync(target.id) || guild.ownerId === target.id)) {\n    return cv2.danger('Untouchable', `You cannot take action against **${target.user.tag}**.\\n\\nThey are protected by **Athena Prime's** highest security clearance.`);\n  }");

  fs.writeFileSync(file, js);
}

fixFile("src/commands/moderation.js");

// vcdrag has moderator as executor
let vc = fs.readFileSync("src/commands/vcdrag.js", "utf8");
vc = vc.replace(/if \(isBotOwnerSync\(target\.id\) \|\| isExtraOwner\(guild\.id, target\.id\)\) \{\s+return cv2\.danger\(\s*' Untouchable',\s*` \*\*.*\*\* is protected by Athena Prime and cannot be dragged.`\s*\);\s+\}/g, 
  "if (!isBotOwnerSync(message.author.id) && (isBotOwnerSync(target.id) || isExtraOwner(guild.id, target.id))) {\n    return cv2.danger('Untouchable', `**${target.user.tag}** is protected by Athena Prime and cannot be dragged.`);\n  }");
fs.writeFileSync("src/commands/vcdrag.js", vc);

