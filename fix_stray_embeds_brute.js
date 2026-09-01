import fs from "fs";
let text = fs.readFileSync("src/commands/rr.js", "utf8");

text = text.replace(/embeds: \[cv2\.info\('Reaction Role Manager \[1\/3\]', 'Please tag the channel where you want to post this menu \(e\.g\. <#123456789> or ID\)\.'\)\]/g, "...cv2.info('Reaction Role Manager [1/3]', 'Please tag the channel where you want to post this menu (e.g. <#123456789> or ID).')");

text = text.replace(/embeds: \[cv2\.info\('Reaction Role Manager \[2\/3\]', 'What should be the title of this menu\? \(e\.g\. `React to Your Hobbies`\)'\)\]/g, "...cv2.info('Reaction Role Manager [2/3]', 'What should be the title of this menu? (e.g. `React to Your Hobbies`)')");

text = text.replace(/embeds: \[cv2\.info\('Reaction Role Manager \[3\/5\]', 'What should be the description of this menu\? \(Optional\)\\nType `skip` if you do not want a description\.'\)\]/g, "...cv2.info('Reaction Role Manager [3/5]', 'What should be the description of this menu? (Optional)\\nType `skip` if you do not want a description.')");

text = text.replace(/embeds: \[cv2\.info\('Reaction Role Manager \[4\/5\]', 'Now, add your roles one by one\.\\n\\nFormat: `\[emoji\] \[\@role OR Role ID\] \[description\]`\\nExample: ` 123456789 The Singer Role`\\n\\nType `done` when you are finished\.'\)\]/g, "...cv2.info('Reaction Role Manager [4/5]', 'Now, add your roles one by one.\\n\\nFormat: `[emoji] [@role OR Role ID] [description]`\\nExample: ` 123456789 The Singer Role`\\n\\nType `done` when you are finished.')");

text = text.replace(/embeds: \[cv2\.info\('Reaction Role Manager \[5\/5\]', 'Would you like to attach an image to this menu\? \(Optional\)\\n\\nPaste a valid image URL \(e\.g\., ending in `\.png`, `\.gif`, `\.jpg`\) to add it as a large banner\.\\nOr type `thumb <url>` to add it as a small top-right thumbnail\.\\n\\nType `skip` if you do not want an image\.'\)\]/g, "...cv2.info('Reaction Role Manager [5/5]', 'Would you like to attach an image to this menu? (Optional)\\n\\nPaste a valid image URL (e.g., ending in `.png`, `.gif`, `.jpg`) to add it as a large banner.\\nOr type `thumb <url>` to add it as a small top-right thumbnail.\\n\\nType `skip` if you do not want an image.')");

text = text.replace(/embeds: \[cv2\.info\('Reaction Role Manager \[Extra\]', 'What should be the footer text\? \(Optional\)\\n\\nType `default` to keep the standard Athena Prime Killer footer\.\\nType `none` or `remove` to have no footer\.\\nOr just type your custom footer text\.'\)\]/g, "...cv2.info('Reaction Role Manager [Extra]', 'What should be the footer text? (Optional)\\n\\nType `default` to keep the standard Athena Prime Killer footer.\\nType `none` or `remove` to have no footer.\\nOr just type your custom footer text.')");

fs.writeFileSync("src/commands/rr.js", text);

let text2 = fs.readFileSync("src/commands/vcdrag.js", "utf8");
text2 = text2.replace(/embeds: \[cv2\.warn/g, "...cv2.warn");
text2 = text2.replace(/\)'\)\]\n/g, ")')\n");
fs.writeFileSync("src/commands/vcdrag.js", text2);
