import fs from "fs";
let js = fs.readFileSync("src/commands/quote.js", "utf8");

// Fix modals
js = js.replace(/member \? member\.displayHexColor : '#FFFFFF'\s*\)/g, "member ? member.displayHexColor : '#FFFFFF', targetMsg.author.username)");
js = js.replace(/targetUser\.displayHexColor\s*\)/g, "targetUser.displayHexColor, targetUser.user.username)");

fs.writeFileSync("src/commands/quote.js", js);
