import fs from "fs";
let code = fs.readFileSync("src/commands/np.js", "utf8");

code = code.replace("if (sub === 'list') {", "if (sub === 'list' || sub === 'active' || sub === 'users') {");

code = code.replace(/np reset server <id>` [^\n]+/, "$&\n> `np list` / `np active` $&".replace("np reset server <id>`", "np list` / `np active`").replace("Remove No-Prefix from server", "View global active NP users & servers"));

code = code.replace(/np show` \/ `np check <@user>` [^\n]+/, "`np check <@user | id>` " + code.match(/np show` \/ `np check <@user>` ([^\n]+)/)[1].replace("View active NP users & servers", "Check a specific user's NP status"));

fs.writeFileSync("src/commands/np.js", code);
