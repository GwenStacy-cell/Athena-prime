import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(/const embed = cv2\.info\('Athena Prime Calculator', '0'\);/g, 
  "const embed = cv2.info('Athena Prime Calculator', `> # **\\` 0 \\`**`);");

js = js.replace(/const embed = cv2\.info\('Athena Prime Calculator', String\(eq\)\);/g, 
  "const embed = cv2.info('Athena Prime Calculator', `> # **\\` ${eq} \\`**`);");

fs.writeFileSync("src/commands/utility.js", js);
