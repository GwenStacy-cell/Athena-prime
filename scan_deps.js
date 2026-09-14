import fs from "fs";
import path from "path";

function scan(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            if (f === ".cache" || f === ".npm") continue;
            try { scan(full); } catch {}
        } else if (full.endsWith(".js") || full.endsWith(".ts")) {
            try {
                const content = fs.readFileSync(full, "utf8");
                if (content.includes("fetchReply")) {
                    console.log(`Found fetchReply in ${full}`);
                }
            } catch {}
        }
    }
}
scan("node_modules");
