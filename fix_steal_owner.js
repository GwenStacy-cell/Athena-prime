import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

code = code.replace(
    "const isOwner = isBotOwnerSync(context.user ? context.user.id : context.author.id);",
    "const { isBotOwnerSync } = await import('../utils/helpers.js');\n        const isOwner = isBotOwnerSync(context.user ? context.user.id : context.author.id);"
);

fs.writeFileSync("src/commands/utility.js", code);
