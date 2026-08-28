import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Change currentText initialization
code = code.replace(/let currentText = `<a:loading:1542155051286396938> \*\*Athena Prime Antinuke Setup\*\*\\n-# Antinuke Setup Working\.\.\.\\n\\n`;/g, 
  "let currentText = `-# <a:loading:1542155051286396938> **Athena Prime Antinuke Setup**\\n-# **Antinuke Setup Working...**\\n\\n`;");

// Change loadingLine creation
code = code.replace(/const loadingLine = `\$\{loadingEmoji\} \$\{stepName\}\.\.\.`;/g,
  "const loadingLine = `-# **${loadingEmoji} ${stepName}...**`;");

// Change success/failed replacement logic
code = code.replace(/currentText = currentText\.replace\(loadingLine, `\$\{successEmoji\} \$\{stepName\}\.\.\. ` \+ \(result === true \? "" : result\)\);/g,
  "currentText = currentText.replace(loadingLine, `-# **${successEmoji} ${stepName}...** ` + (result === true ? \"\" : `-# **${result}**`));");

code = code.replace(/currentText = currentText\.replace\(loadingLine, `\$\{warningEmoji\} \$\{stepName\}\.\.\. Failed \(\$\{err\.message\}\)`\);/g,
  "currentText = currentText.replace(loadingLine, `-# **${warningEmoji} ${stepName}... Failed (${err.message})**`);");

// Update the pointer strings inside the DB block to also be grey/bold
code = code.replace(/\\n\\u00A0\\u00A0\\u2570\\u203A Server Id : /g, "\\n-# **\\u00A0\\u00A0\\u2570\\u203A Server Id : ");
code = code.replace(/\\n\\u00A0\\u00A0\\u2570\\u203A Secure Security DB ID : /g, "**\\n-# **\\u00A0\\u00A0\\u2570\\u203A Athena Security DB ID : ");
code = code.replace(/\*\*\*\*/g, "**"); // Fix any double bolds

// Update the final block
code = code.replace(/currentText \+= `\\n\\n\| athena prime \| athena firewall \| athena unbypassable \.\\n<@\$\{guild\.client\.user\.id\}> is creating its backup role when anyone trying turn off admin , remove role , delete role the <@\$\{guild\.client\.user\.id\}> will automatically enable admin , recovery its own role , adding itself making <@\$\{guild\.client\.user\.id\}> unbypassable security system`;/g,
  "currentText += `\\n\\n-# **| athena prime | athena firewall | athena unbypassable .**\\n-# **<@${guild.client.user.id}> is creating its backup role when anyone trying turn off admin , remove role , delete role the <@${guild.client.user.id}> will automatically enable admin , recovery its own role , adding itself making <@${guild.client.user.id}> unbypassable security system**`;");

// Fix ephemeral deprecation warning
code = code.replace(/ephemeral: true/g, "flags: MessageFlags.Ephemeral");

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed sequence styles and ephemeral!");
