import fs from 'fs';
let code = fs.readFileSync('src/commands/giveaway.js', 'utf8');

if (!code.includes('import statsDB')) {
  code = code.replace("import db from '../database.js';", "import db from '../database.js';\nimport statsDB from '../statsDB.js';");
}

const targetPick = `    // Pick winners
    const participants = gwData.participants || [];
    let winners = [];
    
    if (participants.length > 0) {
      const shuffled = [...participants].sort(() => 0.5 - Math.random());
      winners = shuffled.slice(0, gwData.winnersCount);
    }`;

const replacePick = `    // Pick winners
    const participants = gwData.participants || [];
    let winners = [];
    const mode = gwData.mode || 'random';
    
    if (participants.length > 0) {
      if (mode === 'random') {
        const shuffled = [...participants].sort(() => 0.5 - Math.random());
        winners = shuffled.slice(0, gwData.winnersCount);
      } else {
        // Deterministic mode based on statsDB
        let eligible = [];
        if (mode === 'messages') {
          const topMsg = statsDB.getTopMembers(guild.id, 500) || [];
          eligible = topMsg.filter(r => participants.includes(r.user_id));
        } else if (mode === 'vc') {
          const topVc = statsDB.getTopVoiceMembers(guild.id, 500) || [];
          eligible = topVc.filter(r => participants.includes(r.user_id));
        } else if (mode === 'invites') {
          const topInv = statsDB.getTopInvites(guild.id, 500) || [];
          eligible = topInv.filter(r => participants.includes(r.user_id));
        }
        
        // Take the absolute top winners from the filtered list
        if (eligible.length > 0) {
           winners = eligible.slice(0, gwData.winnersCount).map(r => r.user_id);
        }
        
        // If there aren't enough winners from the leaderboard, fill the rest randomly
        if (winners.length < gwData.winnersCount) {
          const remainingParticipants = participants.filter(id => !winners.includes(id));
          const shuffled = [...remainingParticipants].sort(() => 0.5 - Math.random());
          const needed = gwData.winnersCount - winners.length;
          winners = [...winners, ...shuffled.slice(0, needed)];
        }
      }
    }`;

code = code.replace(targetPick, replacePick);
fs.writeFileSync('src/commands/giveaway.js', code);
