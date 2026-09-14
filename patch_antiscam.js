import fs from "fs";

let js = fs.readFileSync("src/utils/antiScam.js", "utf8");

// Remove all incorrect injections
js = js.replace(/if \(img\.width < 50[^]*?const canvas = createCanvas\(img\.width, img\.height\);/g, "const canvas = createCanvas(img.width, img.height);");

// Inject properly
let parts = js.split("const canvas = createCanvas(img.width, img.height);");
if (parts.length === 3) {
    js = parts[0] + 
         "if (img.width < 50 || img.height < 50) return false;\n    const canvas = createCanvas(img.width, img.height);" + 
         parts[1] + 
         "if (img.width < 50 || img.height < 50) return 'Error: Image too small for OCR';\n    const canvas = createCanvas(img.width, img.height);" + 
         parts[2];
}

fs.writeFileSync("src/utils/antiScam.js", js);
console.log("Fixed antiScam.js for real");
