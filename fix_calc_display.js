import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

// Change the initial calculator display to remove codeblocks
js = js.replace(/const embed = cv2\.info\('Athena Prime Calculator', '\\`\\`\\`\\\\n0\\\\n\\`\\`\\`'\);/g, 
  "const embed = cv2.info('Athena Prime Calculator', '0');");

// Change the dynamic equation update to remove codeblocks
js = js.replace(/const embed = cv2\.info\('Athena Prime Calculator', \\`\\\\`\\\\`\\\\`\\\\\\\\n\\\$\{eq\}\\\\\\\\n\\\\`\\\\`\\\\`\\`\);/g, 
  "const embed = cv2.info('Athena Prime Calculator', eq);");

fs.writeFileSync("src/commands/utility.js", js);
