import fs from "fs";
import path from "path";

function walk(dir) {
    let results = [];
    let list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        let stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.js')) results.push(file);
        }
    });
    return results;
}

const files = walk('src');
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let updated = content;
    
    // Pattern: { embeds: [cv2.method(...)] }
    // We will find "{ embeds: [" and then trace the brackets.
    let startIdx = 0;
    while ((startIdx = updated.indexOf('{ embeds: [cv2.', startIdx)) !== -1) {
        // Find the matching closing bracket ] and brace }
        let bracketCount = 1; // for [
        let i = startIdx + '{ embeds: ['.length;
        let foundEnd = -1;
        while (i < updated.length) {
            if (updated[i] === '[') bracketCount++;
            else if (updated[i] === ']') {
                bracketCount--;
                if (bracketCount === 0) {
                    foundEnd = i;
                    break;
                }
            }
            i++;
        }
        
        if (foundEnd !== -1) {
            let inner = updated.substring(startIdx + '{ embeds: ['.length, foundEnd).trim();
            // Check if there is a closing brace immediately after
            let braceEnd = updated.indexOf('}', foundEnd);
            if (braceEnd !== -1 && updated.substring(foundEnd+1, braceEnd).trim() === '') {
                // Replace everything from startIdx to braceEnd with inner
                updated = updated.substring(0, startIdx) + inner + updated.substring(braceEnd + 1);
                continue; // retry from startIdx since string shifted
            }
        }
        startIdx += 10;
    }
    
    // Also handle { embeds: [ cv2. (with spaces)
    let startIdx2 = 0;
    while ((startIdx2 = updated.indexOf('{ embeds: [ cv2.', startIdx2)) !== -1) {
         let bracketCount = 1; // for [
        let i = startIdx2 + '{ embeds: ['.length;
        let foundEnd = -1;
        while (i < updated.length) {
            if (updated[i] === '[') bracketCount++;
            else if (updated[i] === ']') {
                bracketCount--;
                if (bracketCount === 0) {
                    foundEnd = i;
                    break;
                }
            }
            i++;
        }
        
        if (foundEnd !== -1) {
            let inner = updated.substring(startIdx2 + '{ embeds: ['.length, foundEnd).trim();
            let braceEnd = updated.indexOf('}', foundEnd);
            if (braceEnd !== -1 && updated.substring(foundEnd+1, braceEnd).trim() === '') {
                updated = updated.substring(0, startIdx2) + inner + updated.substring(braceEnd + 1);
                continue;
            }
        }
        startIdx2 += 10;
    }

    if (content !== updated) {
        fs.writeFileSync(file, updated);
        console.log(`Fixed ${file}`);
    }
}
