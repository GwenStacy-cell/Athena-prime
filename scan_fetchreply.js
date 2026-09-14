import fs from "fs";
import path from "path";

function scan(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            scan(full);
        } else if (full.endsWith(".js")) {
            const content = fs.readFileSync(full, "utf8");
            if (content.includes("fetchReply")) {
                console.log(`Found fetchReply in ${full}`);
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes("fetchReply")) {
                        console.log(`  Line ${i+1}: ${lines[i].trim()}`);
                    }
                }
            }
        }
    }
}
scan("src");
