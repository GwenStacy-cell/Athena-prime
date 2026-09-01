import fs from "fs";

function patchFile(file) {
  let text = fs.readFileSync(file, "utf8");
  // Replace leaderboard and display usernames with globalName
  text = text.replace(/user\.username/g, "user.globalName || user.username");
  text = text.replace(/author\.username/g, "author.globalName || author.username");
  text = text.replace(/executor\.username/g, "executor.globalName || executor.username");
  text = text.replace(/target\.username/g, "target.globalName || target.username");
  fs.writeFileSync(file, text);
}

["src/commands/top.js", "src/commands/voicelb.js", "src/commands/chatlb.js", "src/commands/invitelb.js", "src/commands/enuke.js", "src/commands/roleplay.js", "src/commands/rate.js", "src/commands/security.js"].forEach(f => {
  if(fs.existsSync(f)) patchFile(f);
});

