import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Fix unicode corruption in serverinfo
code = code.replace(/AAA\?sAA,/g, '—');
code = code.replace(/AAA\?sAA,/g, '—');
code = code.replace(/Ã¢â‚¬â€œ/g, '—');
code = code.replace(/AAA\?sAAA\?sAA, Security Status AAA\?sAAA\?sAA,/g, '▬▬ Security Status ▬▬');
code = code.replace(/AAA\?sAAA\?sAA, Security Status AAA\?sAAA\?sAA,/g, '▬▬ Security Status ▬▬');

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed unicode corruption in security.js!");
