import fs from "fs";
import path from "path";

const dir = "src";
const oldOn = "1514996865030946847";
const oldOff = "1514996861474177109";
const newOn = "1533844867191406672";
const newOff = "1533844858983157851";

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith(".js")) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(dir);
files.forEach(file => {
    let content = fs.readFileSync(file, "utf8");
    let changed = false;

    // 1. Replace IDs
    if (content.includes(oldOn)) {
        content = content.replace(new RegExp(oldOn, 'g'), newOn);
        changed = true;
    }
    if (content.includes(oldOff)) {
        content = content.replace(new RegExp(oldOff, 'g'), newOff);
        changed = true;
    }
    
    // 2. Replace any <a:on:NEW_ID> with <:on:NEW_ID>
    if (content.includes(`<a:on:${newOn}>`)) {
        content = content.replace(new RegExp(`<a:on:${newOn}>`, 'g'), `<:on:${newOn}>`);
        changed = true;
    }
    
    // Also replace `<a:off:` just in case
    if (content.includes(`<a:off:${newOff}>`)) {
        content = content.replace(new RegExp(`<a:off:${newOff}>`, 'g'), `<:off:${newOff}>`);
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, "utf8");
        console.log(`Updated ${file}`);
    }
});
