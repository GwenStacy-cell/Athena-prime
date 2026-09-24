const fs = require('fs');
let js = fs.readFileSync('src/cv2.js', 'utf8');

const oldStr =   // Bottom divider
  comps.push(SEP);
    let footerText = customFooter ? customFooter : 'Athena Bulletproof Security !!!';
  if (footerText === 'success') footerText = 'System Operation Successfully Completed.';
  else if (footerText === 'warning') footerText = 'Security Protocol Advisory Issued.';
  else if (footerText === 'danger') footerText = 'Critical Security Protocol Engaged.';
  else if (footerText === 'error') footerText = 'System Fault Encountered.';
  
  comps.push({ type: 10, content: \-# **\**\ });

  return { type: 17, components: comps };;

const newStr =   // Bottom divider
  comps.push(SEP);
  
  let footerText = customFooter ? customFooter : 'Athena Bulletproof Security System \\u00b7 V1.0.0';
  
  const footers = {
      'success': 'System Operation Successfully Completed.',
      'warning': 'Security Protocol Advisory Issued.',
      'danger': 'Critical Security Protocol Engaged.',
      'error': 'System Fault Encountered.',
      'shield': 'Active Threat Neutralization and Firewall Defense Matrix Engaged.',
      'raid': 'Anti-Nuke Raid Protection Protocols Fully Enforced.',
      'info': 'System Data Retrieval and Analysis Complete.',
      'log': 'Secure Audit Log Entry Processed.',
      'moderation': 'Administrative Moderation Action Executed.',
      'security': 'Athena Core Security System Active.',
      'owner': 'Executive Override Command Authorized.'
  };

  if (footers[footerText]) footerText = footers[footerText];

  comps.push({ type: 10, content: \-# **\**\ });

  return { type: 17, components: comps };;

js = js.replace(oldStr, newStr);
fs.writeFileSync('src/cv2.js', js);
console.log('Fixed footers!');
