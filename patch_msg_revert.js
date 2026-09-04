import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Revert the cv2 payload back to standard
js = js.replace(/await ownerUser\.send\(\{ embeds: \[dmEmbed\] \}\)/g, "await ownerUser.send(dmEmbed)");

fs.writeFileSync("src/events/messageCreate.js", js);
