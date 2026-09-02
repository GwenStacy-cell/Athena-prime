import fs from "fs";
let lines = fs.readFileSync("src/commands/welcome.js", "utf8").split(/\r?\n/);
let startIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("if (avatarPos === 'thumbnail') e.setThumbnail(userAvatar);")) {
    startIndex = i;
    break;
  }
}

if (startIndex !== -1) {
  lines.splice(startIndex, 8, 
    "  if (cfg.thumbnailUrl) {",
    "    try { e.setThumbnail(resolve(cfg.thumbnailUrl, member, cfg)); } catch(e) {}",
    "  } else if (avatarPos === 'thumbnail') {",
    "    e.setThumbnail(userAvatar);",
    "  }",
    "",
    "  if (cfg.image) {",
    "    try { e.setImage(resolve(cfg.image, member, cfg)); } catch(e) {}",
    "  } else if (avatarPos === 'image') {",
    "    e.setImage(userAvatar);",
    "  }"
  );
  fs.writeFileSync("src/commands/welcome.js", lines.join("\n"));
}
