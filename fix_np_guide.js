import fs from "fs";
let code = fs.readFileSync("src/commands/np.js", "utf8");

// Map 'active' and 'users' to 'list'
code = code.replace("if (sub === 'list') {", "if (sub === 'list' || sub === 'active' || sub === 'users') {");

// Update Guide Text Page 1
code = code.replace(
  "> `np reset server <id>` ?\" Remove No-Prefix from server\\n\\n##",
  "> `np reset server <id>` ?\" Remove No-Prefix from server\\n> `np list` / `np active` ?\" View global active NP users & servers\\n\\n##"
);

// Update Guide Text Page 2
code = code.replace(
  "> `np show` / `np check <@user>` ?\" View active NP users & servers",
  "> `np check <@user | id>` ?\" Check a specific user's NP status"
);

fs.writeFileSync("src/commands/np.js", code);
