import fs from "fs";

let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `const moduleFlag = config.antinukeModules?.[k];
      const isEnabled = isSecured && (moduleFlag === undefined ? (k === 'antiInvite' ? false : true) : !!moduleFlag);`;

const newCode = `const moduleFlag = config.antinukeModules?.[k];
      let isEnabled = false;
      if (k === 'antiInvite') {
        isEnabled = isSecured && (config.antiInviteEnabled === true);
      } else {
        isEnabled = isSecured && (moduleFlag === undefined ? true : !!moduleFlag);
      }`;

js = js.replace(oldCode, newCode);

fs.writeFileSync("src/commands/security.js", js);
