import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Fix log channel embed emoji
js = js.replace(
  /\`### Result: \$\{action === 'accept' \? '<:emoji_16:1521464002046328944> Accepted' : '<:cross_red:1533860128015519895> Denied'\} by <@\$\{interaction\.user\.id\}>\`/g,
  "\`### Result: ${action === 'accept' ? '<a:emoji_106:1533844832395595838> Accepted' : '<:cross_red:1533860128015519895> Denied'} by <@${interaction.user.id}>\`"
);

// Fix DM embed emoji
js = js.replace(
  /const emoji = action === 'accept' \? '<:emoji_16:1521464002046328944>' : '<:cross_red:1533860128015519895>';/g,
  "const emoji = action === 'accept' ? '<a:emoji_106:1533844832395595838>' : '<:cross_red:1533860128015519895>';"
);

fs.writeFileSync("src/events/interactionCreate.js", js);
