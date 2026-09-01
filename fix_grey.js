import fs from "fs";
let mc = fs.readFileSync("src/events/messageCreate.js", "utf8");

mc = mc.replace(
    /> Reason: \. \[/g,
    "-# > Reason: . ["
);

mc = mc.replace(
    /> \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A has been/g,
    "-# > \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A has been"
);

fs.writeFileSync("src/events/messageCreate.js", mc);

let sec = fs.readFileSync("src/commands/security.js", "utf8");

sec = sec.replace(
    /> Successfully restored/g,
    "-# > Successfully restored"
);

sec = sec.replace(
    /> \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A User/g,
    "-# > \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A User"
);

fs.writeFileSync("src/commands/security.js", sec);
