import fs from 'fs';
let code = fs.readFileSync('src/commands/utility.js', 'utf8');

// The current text is: '`!record` - Start a live VC audio recording session or setup a voice-records log channel `[extra owners]`'
code = code.replace(
  "'`!record` - Start a live VC audio recording session or setup a voice-records log channel `[extra owners]`'",
  "'`!record` **start / stop** - Start or stop a live VC audio recording `[extra owners]`'"
);

fs.writeFileSync('src/commands/utility.js', code);
