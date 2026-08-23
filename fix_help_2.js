import fs from 'fs';
let code = fs.readFileSync('src/commands/utility.js', 'utf8');

// Update !record in voice module
code = code.replace(
  "'`!record` - Create a private #voice-records channel for VC join/leave logs `[extra owners]`'",
  "'`!record` - Start a live VC audio recording session or setup a voice-records log channel `[extra owners]`'"
);

// Update setmedia and add unsetmedia in utilities module
code = code.replace(
  "'`!setmedia` `#channel` - Bind auto-media extractor to a channel `[extra owners]`'",
  "'`!setmedia` `#channel` / `!unsetmedia` - Bind or unbind the auto-media extractor `[extra owners]`'"
);

// Add !bi to stats module
code = code.replace(
  "'`!top` `[messages|vc]` - View the server leaderboard `[public]`'] }",
  "'`!top` `[messages|vc]` - View the server leaderboard `[public]`', '`!bi` / `!botstats` - View global Athena internal statistics `[bot owner]`'] }"
);

fs.writeFileSync('src/commands/utility.js', code);
