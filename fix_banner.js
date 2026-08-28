import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

const newBanner = 'https://cdn.discordapp.com/attachments/1534869224277807175/1542472732325978234/ATHENA-8-27-2026.png?ex=6a915b2d&is=6a9009ad&hm=0f55bae0c0bec27649bc03e6d6be23ad16f2eb9337efdb8b5793b2d74cad89ff&';
const oldBannerRegex = /https:\/\/cdn\.discordapp\.com\/attachments\/1516850846984437801\/1541165885664792678\/athena____bg_00000-removebg-preview\.png\?ex=[a-z0-9]+&is=[a-z0-9]+&hm=[a-z0-9]+&/g;

code = code.replace(oldBannerRegex, newBanner);

fs.writeFileSync("src/commands/utility.js", code);
console.log("Replaced HELP_GIF in utility.js!");
