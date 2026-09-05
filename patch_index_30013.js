import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");

js = js.replace(
  /code === 10062 \|\| error\?\.code === 50035/g,
  `code === 10062 || error?.code === 50035 || error?.code === 30013`
);

js = js.replace(
  /code === 10062 \|\|\\n        code === 50035/g,
  `code === 10062 ||\n        code === 50035 ||\n        code === 30013`
);

fs.writeFileSync("index.js", js);
