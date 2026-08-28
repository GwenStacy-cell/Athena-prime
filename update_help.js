import fs from 'fs';
let code = fs.readFileSync('src/commands/utility.js', 'utf8');

const targetStr = "'`!antilink` **on** / **off** - Block all external links from non-moderators `[extra owners]`',";
const newStr = "'`!antilink` - Open the Interactive Anti-Link & Invite Dashboard `[extra owners]`',";

code = code.replace(targetStr, newStr);

fs.writeFileSync('src/commands/utility.js', code);
console.log("Updated help menu!");
