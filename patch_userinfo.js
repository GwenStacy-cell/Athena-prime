import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

js = js.replace(/User Info .*? \$\{member\.user\.tag\}/g, "User Info \u2014 ${member.user.tag}");

fs.writeFileSync("src/commands/security.js", js);
console.log("Fixed userinfo header!");
