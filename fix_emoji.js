import fs from 'fs';
import path from 'path';

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            // The corrupted string is \xc3\xaf\xc2\xb8\xc2\x8f (or similar depending on encoding)
            // Let's just remove anything that matches 'ï¸ '
            let changed = false;
            if (content.includes('ï¸ ')) {
                content = content.replaceAll('ï¸ ', '');
                changed = true;
            }
            if (content.includes('ï¸')) {
                content = content.replaceAll('ï¸', '');
                changed = true;
            }
            if (content.includes(',? ')) { // fallback
                content = content.replaceAll(',? ', '');
                changed = true;
            }
            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed', fullPath);
            }
        }
    }
}
walk('src');
