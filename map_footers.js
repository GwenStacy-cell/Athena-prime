import fs from "fs";
let text = fs.readFileSync("src/cv2.js", "utf8");

text = text.replace(/comps\.push\(\{ type: 10, content: customFooter \? \`-# \*\*\$\{customFooter\}\*\*\` : \'-# \*\*Athena Bulletproof Security !!!\*\*\' \}\);/g, 
`  let footerText = customFooter ? customFooter : 'Athena Bulletproof Security !!!';
  if (footerText === 'success') footerText = 'System Operation Successfully Completed.';
  else if (footerText === 'warning') footerText = 'Security Protocol Advisory Issued.';
  else if (footerText === 'danger') footerText = 'Critical Security Protocol Engaged.';
  else if (footerText === 'error') footerText = 'System Fault Encountered.';
  
  comps.push({ type: 10, content: \`-# **\${footerText}**\` });`);

fs.writeFileSync("src/cv2.js", text);
