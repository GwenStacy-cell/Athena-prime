import fs from "fs";
let js = fs.readFileSync("src/commands/quote.js", "utf8");

js = js.replace(
  "targetUser.displayHexColor",
  "targetUser.displayHexColor,\n          targetUser.user.username"
);

js = js.replace(
  "member ? member.displayHexColor : '#FFFFFF'",
  "member ? member.displayHexColor : '#FFFFFF',\n        targetMsg.author.username"
);

fs.writeFileSync("src/commands/quote.js", js);

let msgJs = fs.readFileSync("src/events/messageCreate.js", "utf8");

msgJs = msgJs.replace(
  "message.member ? message.member.displayHexColor : '#FFFFFF'",
  "message.member ? message.member.displayHexColor : '#FFFFFF',\n              message.author.username"
);

fs.writeFileSync("src/events/messageCreate.js", msgJs);
