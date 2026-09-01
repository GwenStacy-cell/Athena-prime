import fs from "fs";
let code = fs.readFileSync("src/commands/np.js", "utf8");

// We need to keep the exact emoji and characters in the string.
const page1Original = "> `np reset server <id>` \u2014 Remove No-Prefix from server\\n\\n## **Command Ban Controls**";
const page1New = "> `np reset server <id>` \u2014 Remove No-Prefix from server\\n> `np list` / `np active` \u2014 View global active NP users & servers\\n\\n## **Command Ban Controls**";
code = code.replace(page1Original, page1New);

const page2Original = "> `np show` / `np check <@user>` \u2014 View active NP users & servers\\n\\n";
const page2New = "> `np check <@user | id>` \u2014 Check a specific user\\'s NP status\\n\\n";
code = code.replace(page2Original, page2New);

fs.writeFileSync("src/commands/np.js", code);
