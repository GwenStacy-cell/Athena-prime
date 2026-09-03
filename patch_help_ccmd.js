import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const t = `  const categories = [`;
const r = `  const categories = [
    { id: 'app_builder', shortLabel: 'App Builder', label: 'Staff Application Builder', emoji: '<:emoji_16:1521464002046328944>', commands: ['\`!app setup\` - Interactive CV2 Staff App Manager \`[admin]\`', '\`!app setlog\` \`#channel\` - Bind where applications are sent \`[admin]\`', '\`!app deploy\` \`#channel\` - Drop the Apply button \`[admin]\`'] },
    { id: 'custom_commands', shortLabel: 'Custom Cmds', label: 'Custom Command Shortcuts', emoji: '<:utilities:1523747124653723838>', commands: ['\`!ccmd create\` \`<short> <command>\` - Create a shortcut for any command \`[admin]\`', '\`!ccmd delete\` \`<short>\` - Remove a shortcut \`[admin]\`', '\`!ccmd list\` - View all custom shortcuts \`[public]\`'] },`;

// Remove the old ones from utility
js = js.replace(t, r);
js = js.replace(/, '`!app setup` - Interactive CV2 Staff App Manager `\[admin\]`', '`!app setlog` `#channel` - Bind where applications are sent `\[admin\]`', '`!app deploy` `#channel` - Drop the Apply button `\[admin\]`'/g, "");

fs.writeFileSync("src/commands/utility.js", js);
