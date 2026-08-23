import fs from 'fs';
let code = fs.readFileSync('index.js', 'utf8');

code = code.replace(
  "process.on('unhandledRejection', (error) => {\n  console.error(chalk.red.bold('Unhandled Promise Rejection:'), error);\n});",
  "process.on('unhandledRejection', (error) => {\n  if (error?.message?.includes('Cannot perform IP discovery - socket closed')) return;\n  console.error(chalk.red.bold('Unhandled Promise Rejection:'), error);\n});"
);

fs.writeFileSync('index.js', code);
