import fs from "fs";

let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

text = text.replace(
    />        ↳/g,
    "> \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A"
);
text = text.replace(
    />        ╰›/g,
    "> \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A"
);
fs.writeFileSync("src/events/messageCreate.js", text);

let text2 = fs.readFileSync("src/commands/security.js", "utf8");
text2 = text2.replace(
    />        ↳/g,
    "> \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A"
);
text2 = text2.replace(
    />        ╰›/g,
    "> \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A"
);
fs.writeFileSync("src/commands/security.js", text2);
