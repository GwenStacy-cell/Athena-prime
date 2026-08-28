import fs from "fs";
let code = fs.readFileSync("src/commands/record.js", "utf8");

const badBlock = `                if (globalVc) vc = globalVc;
                if (member && member.voice.channel) {
                    vc = member.voice.channel;
                }
            }`;

const fixedBlock = `                if (globalVc) vc = globalVc;
            }`;

code = code.replace(badBlock, fixedBlock);
fs.writeFileSync("src/commands/record.js", code);
console.log("Fixed ReferenceError!");
