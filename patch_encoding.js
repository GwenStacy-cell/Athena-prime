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
  if (content.includes('Failed/Not in VC')) {
    // We replace anything before 'Failed/Not in VC' up to the quote, to clean the corrupted emoji
    content = content.replace(/'[^']*Failed\/Not in VC'/g, "'<:off:1533844858983157851> Failed/Not in VC'");
    fs.writeFileSync(file, content);
  }
}
