import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");

js = js.replace(
  /antiNukeEnabled: true,/g,
  `antiNukeEnabled: false,`
);

js = js.replace(
  /cfg\.antiNukeEnabled = true;/g,
  `cfg.antiNukeEnabled = false;`
);

fs.writeFileSync("src/database.js", js);
