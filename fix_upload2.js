import fs from "fs";
let js = fs.readFileSync("src/commands/upload.js", "utf8");
js = js.replace(/'Please provide a direct URL, or \*\*reply\*\* to a message containing a file!\n\n\*\*Usage:\*\*\n`!upload <url> \[optional_filename\.exe\]`\n`!upload \[new_filename\.exe\]` \(While replying to a file\)'/,
  "`Please provide a direct URL, or **reply** to a message containing a file!\\n\\n**Usage:**\\n\\`!upload <url> [optional_filename.exe]\\`\\n\\`!upload [new_filename.exe]\\` (While replying to a file)`");
fs.writeFileSync("src/commands/upload.js", js);
