import fs from "fs";

let utilityStr = fs.readFileSync("src/commands/utility.js", "utf8");
let helpModulesStr = utilityStr.split("const helpModules = [")[1].split("];")[0];

let allFiles = fs.readdirSync("src/commands").filter(f => f.endsWith(".js"));

console.log("Checking undocumented files...");
allFiles.forEach(f => {
  let name = f.replace(".js", "");
  // Simplistic check: if the name isn't anywhere in the helpModules string
  if (!helpModulesStr.includes(name) && !helpModulesStr.includes(name.toLowerCase())) {
    console.log("- " + name);
  }
});

