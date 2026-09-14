import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `  let listText = '';
    for (const k of Object.keys(modLabels)) {
      const moduleFlag = config.antinukeModules?.[k];
        let isEnabled = false;
        if (k === 'antiInvite') {
          isEnabled = isSecured && (config.antiInviteEnabled === true);
        } else {
          isEnabled = isSecured && (moduleFlag === undefined ? true : !!moduleFlag);
        }
      listText += \`> \${isEnabled ? emojiOn : emojiOff} \${modLabels[k]}\\n\`;
    }`;

const newCode = `  let listText = '';
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

if (js.includes(oldCode)) {
    js = js.replace(oldCode, newCode);
    fs.writeFileSync("src/commands/security.js", js);
    console.log("Success");
} else {
    console.log("Could not find the target code to replace");
}
