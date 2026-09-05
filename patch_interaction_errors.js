import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

js = js.replace(
  /console\.error\('Interaction Error:', error\);/g,
  `if (error.code !== 10062 && !error.message?.includes('Unknown interaction')) console.error('Interaction Error:', error);`
);

fs.writeFileSync("src/events/interactionCreate.js", js);
