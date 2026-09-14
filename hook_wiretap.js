import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");

const importStr = "import { attachWiretap } from './src/utils/fastWiretap.js';\n";
js = importStr + js;

const hookStr = "attachWiretap(client);\nclient.login(token)";
js = js.replace("client.login(token)", hookStr);

fs.writeFileSync("index.js", js);
console.log("Hooked Wiretap into index.js");
