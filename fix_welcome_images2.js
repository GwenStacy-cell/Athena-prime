import fs from "fs";
let js = fs.readFileSync("src/commands/welcome.js", "utf8");

const oldCode = `  if (avatarPos === 'thumbnail') e.setThumbnail(userAvatar);
  if (avatarPos === 'image') e.setImage(userAvatar);

  if (cfg.image) {
    try {
      e.setImage(resolve(cfg.image, member, cfg));
    } catch (err) {}
  }`;

const newCode = `  if (cfg.thumbnailUrl) {
    try { e.setThumbnail(resolve(cfg.thumbnailUrl, member, cfg)); } catch(e) {}
  } else if (avatarPos === 'thumbnail') {
    e.setThumbnail(userAvatar);
  }

  if (cfg.image) {
    try { e.setImage(resolve(cfg.image, member, cfg)); } catch(e) {}
  } else if (avatarPos === 'image') {
    e.setImage(userAvatar);
  }`;

js = js.replace(oldCode, newCode);
fs.writeFileSync("src/commands/welcome.js", js);
