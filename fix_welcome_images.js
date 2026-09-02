import fs from "fs";
let js = fs.readFileSync("src/commands/welcome.js", "utf8");
js = js.replace(/if \(avatarPos === 'thumbnail'\) e\.setThumbnail\(userAvatar\);\n  if \(avatarPos === 'image'\) e\.setImage\(userAvatar\);\n\n  if \(cfg\.image\) \{\n    try \{\n      e\.setImage\(resolve\(cfg\.image, member, cfg\)\);\n    \} catch \(err\) \{\}\n  \}/m, 
`  if (cfg.thumbnailUrl) {
    try { e.setThumbnail(resolve(cfg.thumbnailUrl, member, cfg)); } catch(e) {}
  } else if (avatarPos === 'thumbnail') {
    e.setThumbnail(userAvatar);
  }

  if (cfg.image) {
    try { e.setImage(resolve(cfg.image, member, cfg)); } catch(e) {}
  } else if (avatarPos === 'image') {
    e.setImage(userAvatar);
  }`);
fs.writeFileSync("src/commands/welcome.js", js);
