import fs from "fs";
let sec = fs.readFileSync("src/commands/security.js", "utf8");

sec = sec.replace(
    "const DOT = '<:dark4luvontop:1533860081916182721>';",
    "const DOT = '•';"
);

fs.writeFileSync("src/commands/security.js", sec);
