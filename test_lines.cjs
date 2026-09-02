const fs = require('fs');
const lines = fs.readFileSync('src/utils/dashboardManager.js', 'utf8').split('\n');
for(let i=270; i<295; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
