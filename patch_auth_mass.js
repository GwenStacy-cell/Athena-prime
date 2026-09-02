import fs from "fs";
let js = fs.readFileSync("src/commands/auth.js", "utf8");

js = js.replace("\`!security\`, \`!massrole\`, \`!syncall\`", "\`!security\`, \`!massaddrole\`, \`!syncall\`");

fs.writeFileSync("src/commands/auth.js", js);
