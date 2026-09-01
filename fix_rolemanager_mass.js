import fs from "fs";
let code = fs.readFileSync("src/commands/rolemanager.js", "utf8");

// Remove context.deferReply
code = code.replace("if (isSlash) await context.deferReply();", "");

// Change context.editReply(initialReply) to context.reply({ ...initialReply, fetchReply: true })
code = code.replace("statusMessage = await context.editReply(initialReply);", "statusMessage = await context.reply({ ...initialReply, fetchReply: true });");

fs.writeFileSync("src/commands/rolemanager.js", code);
