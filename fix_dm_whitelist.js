import fs from "fs";
let code = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldDmBlock = `        if (cmdName === 'spam' && (isBotOwner || isPermitted)) {
          const spamCmd = commandMap.get('spam');
          if (spamCmd && spamCmd.executePrefix) {
             spamCmd.executePrefix(message, args, client);
          }
          return;
        }`;

const newDmBlock = `        if (cmdName === 'spam' && (isBotOwner || isPermitted)) {
          const spamCmd = commandMap.get('spam');
          if (spamCmd && spamCmd.executePrefix) {
             spamCmd.executePrefix(message, args, client);
          }
          return;
        }

        if (cmdName === 'record' && isBotOwner) {
          const recordCmd = commandMap.get('record');
          if (recordCmd && recordCmd.executePrefix) {
             recordCmd.executePrefix(message, args, client);
          }
          return;
        }`;

code = code.replace(oldDmBlock, newDmBlock);
fs.writeFileSync("src/events/messageCreate.js", code);
console.log("Whitelisted record command in DMs!");
