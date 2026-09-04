import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace("`!qr <text/url>` - Generate a high-resolution QR code `[public]`", "`!qrcode <text/url>` - Generate a high-resolution QR code `[public]`");
fs.writeFileSync("src/commands/utility.js", js);
