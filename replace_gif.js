import fs from 'fs';
let code = fs.readFileSync('src/commands/utility.js', 'utf8');

const oldUrl = "'https://cdn.discordapp.com/attachments/1516850846984437801/1523436364387975298/banner_gif_1-ezgif.com-crop.gif?ex=6a4cc2ed&is=6a4b716d&hm=a2b3e22c3ee7e1a91545669546a5550644eaba3508e179a3c0d38c889515525d&'";
const newUrl = "'https://cdn.discordapp.com/attachments/1516850846984437801/1541165885664792678/athena____bg_00000-removebg-preview.png?ex=6a8d42d4&is=6a8bf154&hm=840729aa7829fc99408092eb61b8e479588f76d26b72bf2befff992a2bf7186e&'";

code = code.replace(oldUrl, newUrl);
fs.writeFileSync('src/commands/utility.js', code);
console.log("GIF replaced successfully.");
