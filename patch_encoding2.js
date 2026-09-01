import fs from "fs";
import path from "path";

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (file.endsWith('.js')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('src');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  if (content.includes(' Failed')) {
    content = content.replace(/'[^']* Failed'/g, "'<:off:1533844858983157851> Failed'");
    changed = true;
  }
  if (content.includes('Failed/Skipped')) {
    content = content.replace(/'[^']*Failed\/Skipped/g, "'<:off:1533844858983157851> Failed/Skipped");
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content);
  }
}
