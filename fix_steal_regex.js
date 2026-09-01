import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

code = code.replace(
    "const EMOJI_RE = /<(a?):([a-z-Z0-9_]+):(\\d+)>/g;",
    "const EMOJI_RE = /<(a?):([a-zA-Z0-9_]+):(\\d+)>/g;"
);

fs.writeFileSync("src/commands/utility.js", code);
