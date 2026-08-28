import fs from "fs";
let pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.dependencies["@discordjs/opus"] = "^0.10.0";
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
console.log("Added opus to package.json!");
