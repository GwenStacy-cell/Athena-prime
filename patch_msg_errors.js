import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

js = js.replace(
  /console\.error\(error\);\s*const errEmbed = cv2\.danger\('Execution Error'/g,
  `if (error.code !== 10008 && error.code !== 50035 && !error.message?.includes('Unknown message')) console.error(error);\n      const errEmbed = cv2.danger('Execution Error'`
);

fs.writeFileSync("src/events/messageCreate.js", js);
