import fs from "fs";
let mc = fs.readFileSync("src/events/messageCreate.js", "utf8");

const target = "if (isBotOwner && cmd) {";

const replacement = `if (isBotOwner && cmdName === 'ezal') {
          await handleEzal(message);
          return;
      }
      
      if (isBotOwner && cmd) {`;

mc = mc.replace(target, replacement);

fs.writeFileSync("src/events/messageCreate.js", mc);
