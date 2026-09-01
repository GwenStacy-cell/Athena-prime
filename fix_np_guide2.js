import fs from "fs";
let code = fs.readFileSync("src/commands/np.js", "utf8");

// We'll just replace the specific sections
const find1 = "> `np reset server <id>`";
const replace1 = "> `np reset server <id>` ?\" Remove No-Prefix from server\\n> `np list` / `np active` ?\" View global active NP users & servers";

code = code.replace(find1 + " ?\" Remove No-Prefix from server", replace1);

const find2 = "> `np show` / `np check <@user>` ?\" View active NP users & servers";
const replace2 = "> `np check <@user | id>` ?\" Check a specific user's NP status";

code = code.replace(find2, replace2);

fs.writeFileSync("src/commands/np.js", code);
