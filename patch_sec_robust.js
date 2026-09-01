import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");
js = js.replace(/const\s+moduleFlag\s*=\s*config\.antinukeModules\?\.\[k\];\s*const\s+isEnabled\s*=\s*isSecured\s*&&\s*\(moduleFlag\s*===\s*undefined\s*\?\s*\(k\s*===\s*'antiInvite'\s*\?\s*false\s*:\s*true\)\s*:\s*!!moduleFlag\);/g, 
`const moduleFlag = config.antinukeModules?.[k];
      let isEnabled = false;
      if (k === 'antiInvite') {
        isEnabled = isSecured && (config.antiInviteEnabled === true);
      } else {
        isEnabled = isSecured && (moduleFlag === undefined ? true : !!moduleFlag);
      }`);
fs.writeFileSync("src/commands/security.js", js);
