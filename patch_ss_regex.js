import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const regex = /let listText = '';[\s\S]*?listText \+= `> \$\{isEnabled \? emojiOn : emojiOff\} \$\{modLabels\[k\]\}\\n`;\s*\}/;

const newCode = `let listText = '';
    if (isSecured) {
      for (const k of Object.keys(modLabels)) {
        const moduleFlag = config.antinukeModules?.[k];
          let isEnabled = false;
          if (k === 'antiInvite') {
            isEnabled = isSecured && (config.antiInviteEnabled === true);
          } else {
            isEnabled = isSecured && (moduleFlag === undefined ? true : !!moduleFlag);
          }
        listText += \`> \${isEnabled ? emojiOn : emojiOff} \${modLabels[k]}\\n\`;
      }
    } else {
      listText = "> -# \u26A0\uFE0F **Security is currently DISABLED on this server.**\\n> -# **Modules cannot be viewed or configured until \`!security enable all\` is executed.**";
    }`;

js = js.replace(regex, newCode);
fs.writeFileSync("src/commands/security.js", js);
