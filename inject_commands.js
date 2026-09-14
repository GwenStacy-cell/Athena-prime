const newCommands = {
  security: ['`!security enable all` - Activate the God-Tier Firewall `[extra owners]`', '`!security disable all` - Disable all shields `[extra owners]`', '`!ss` / `!security status` - View live Security Firewall Status `[extra owners]`', '`!antinuke config` - Interactive panel to toggle modules `[extra owners]`', '`!emergency mode` / `end` - Strip dangerous perms and hide channels `[extra owners]`', '`!scanserver` - Scan and manage unauthorized bots `[extra owners]`', '`!lockapps` / `!unlockapps` - Manage slash commands server-wide `[extra owners]`', '`!raidmode on|off` - Auto-quarantine every new join `[extra owners]`', '`!config antinuke|antispam|antiinvite|antibot on|off` - Quick toggles `[extra owners]`'],
  filters: ['`!automod config` - Open Interactive Automod configuration `[extra owners]`', '`!automod advanced` - Global link & invite toggles `[extra owners]`', '`!automod bypass add @role` - Bypass specific modules `[extra owners]`', '`!automod bypass list` - View bypassed roles `[extra owners]`', '`!wordfilter` - Manage the banned word list `[extra owners]`', '`!antilink` - Open Interactive Anti-Link & Invite Dashboard `[extra owners]`', '`!linksallow add|remove|list domain` - Whitelist specific domains `[extra owners]`', '`!blacklist add|remove|list phrase` - Auto-delete phrases `[extra owners]`'],
  quarantine: ['`!qrmanager setup|setrole|setchannel|setvc|status` - Manage system `[extra owners]`', '`!quarantine @user [reason]` - Strip roles and isolate (alias: `!qr`) `[extra owners]`', '`!unquarantine @user` - Lift quarantine status `[extra owners]`', '`!massquarantine @role` - Quarantine all members of a role `[extra owners]`', '`!massunquarantine` - Release all currently quarantined members `[extra owners]`', '`!lockdown on|off` - Restrict channel to moderators only `[extra owners]`'],
  whitelist: ['`!whitelist` - Open Global Whitelist Manager Dashboard `[extra owners]`', '`!whitelist @user|@role` - Direct access panel `[extra owners]`', '`!auth` - Configure Role Authorization Tiers `[server owner]`', '`!tier` - Check your authorization level `[public]`', '`!botwhitelist add|remove <id>` - Allow specific bots to join `[server owner]`', '`!botwhitelist list` - View immune bots `[server owner]`', '`!userblacklist add|remove|list @user` - Blacklist user from bot `[extra owners]`', '`!extraowner add|remove|list @user` - Grant full bot access `[server owner]`'],
  verification: ['`!verify setup` - Initialize Captcha Verification system `[extra owners]`', '`!verify config` - Change verification difficulty and role `[extra owners]`'],
  
  moderation: ['`!ban / !kick / !mute / !warn` - Standard moderation tools `[extra owners]`', '`!timeout @user dur` - Timeout a member `[extra owners]`', '`!warnings / !clearwarns @user` - View or wipe history `[extra owners]`', '`/maxwarnings amount` - Set maximum warning threshold `[extra owners]`', '`!addrole / !removerole @user @roles` - Safely assign multiple roles `[extra owners]`', '`!striproles @user` - Instantly strip all roles `[extra owners]`', '`!massaddrole / !massremoverole @role` - Mass role assignment `[extra owners]`', '`!massstrip / !massrestore @role` - Mass strip/restore a role `[extra owners]`', '`!sync / !syncall` - Sync channel permissions `[extra owners]`', '`!purge 1-100` - Bulk-delete messages `[extra owners]`', '`!slowmode seconds` - Set channel slowmode `[extra owners]`', '`!createchannel / !deletechannel` - Channel management `[extra owners]`', '`!createrole / !deleterole` - Role management `[extra owners]`', '`!hide / !unhide` - Hide text/voice channel `[extra owners]`', '`!createthread / !archivethread / !deletethread` - Thread management `[extra owners]`', '`!ignore channel|category` / `!ignoreall` - Block commands `[admin]`', '`ur @user new_name` - Rename user `[extra owners]`', '`!snipe` - Recover deleted message `[extra owners]`'],
  tracking: ['`!serverlogs autosetup` - Setup Advanced Logging `[extra owners]`', '`!invitesetup #channel` - Advanced Invite Tracker `[extra owners]`', '`!record start` - Live VC audio recording `[extra owners]`', '`!audit` / `!logs` - Server logging toggles `[extra owners]`'],
  config: ['`!prefix <new>` - Change bot prefix `[extra owners]`', '`!accent` - Modify embed colors `[extra owners]`', '`!autonick on` - Standardize member nicknames `[extra owners]`'],
  welcome: ['`!welcome setup` - Build interactive welcome messages `[extra owners]`', '`!autorole add @role` - Automatically assign roles on join `[extra owners]`'],
  noprefix: ['`!np add user @user|id [duration]` - Grant NP bypass `[bot owner/np manager]`', '`!np add server id [duration]` - Grant NP to server `[bot owner/np manager]`', '`!np reset user|server id` - Revoke bypass `[bot owner/np manager]`', '`!np guide` - Full NP guide `[np manager]`'],
  
  leveling: ['`!xpsetup` - Launch interactive XP panel `[extra owners]`', '`!rank [@user]` - View level graphic `[public]`', '`!leaderboard` - View top active members `[public]`', '`!givexp / !removexp` - Modify user XP `[extra owners]`'],
  stats: ['`!me` - View personal message stats `[public]`', '`!top` - Combined server leaderboard `[public]`', '`!server` / `!serveroverview` - Graphical stats overview `[public]`', '`!userinfo @user` - View profile information `[public]`'],
  giveaways: ['`!giveaway start` / `end` / `reroll` - Giveaway management `[extra owners]`', '`!birthday setchannel #channel` - Set birthday announcements `[extra owners]`', '`!birthday set / remove @user` - Manage birthdays `[extra owners]`', '`!birthday list` - List birthdays `[extra owners]`'],
  triggers: ['`!trigger create <match> | <resp>` - Create auto-response `[extra owners]`', '`!trigger list` - View triggers `[public]`', '`!trigger delete` - Remove trigger `[extra owners]`'],
  autoreact: ['`!autoreact add <word> <emoji>` - Automatically react to keywords `[extra owners]`', '`!autoreact list` - View active reactions `[public]`', '`!autoreact delete` - Remove reaction `[extra owners]`'],
  actions: ['`!hug / !kiss / !slap / !pat` - Interact with users `[public]`', '`!date @user` - Go on a date `[public]`'],
  
  voice: ['`!vcsetup` - Setup Join-to-Create (JTC) channels `[extra owners]`', '`!vclist` - View active JTC channels `[public]`', '`!vcpanel` - Server Owner Voice Control Panel `[server owner]`', '`!theatermode on/off` - Movie Mode (mutes entire VC) `[extra owners]`', '`!vclock / !vcunlock` - Deny connect perms `[extra owners]`', '`!mute / !unmute / !deafen / !undeafen` - VC state control `[extra owners]`', '`!muteall / !unmuteall / !deafenall / !undeafenall` - Mass state control `[extra owners]`', '`!vcstatus on/off` - Toggle live VC status text `[extra owners]`', '`!moveprotect / !vcprotect add|remove` - Prevent admins from moving/muting protected users `[server owner]`', '`!massmove dest / !massdc` - Move/disconnect everyone `[extra owners]`'],
  music: ['`/setupmusic [image]` - Create Compact Music Player channel `[extra owners]`', '`/play query` - Play a song via URL or search `[public]`', '`!skip / !stop / !queue / !pause / !resume` - Queue management `[public]`'],
  tts: ['`!tts <message>` - Speak text in VC `[public]`', '`!tts config` - Change TTS voice and speed `[public]`'],
  messaging: ['`!say #channel msg` - Anonymous bot message `[extra owners]`', '`!announce #channel title|msg` - Styled announcement embed `[extra owners]`', '`!modmode on/off` - Restrict channels to moderators `[extra owners]`', '`!sticky set / footer / remove` - Manage sticky messages `[extra owners]`'],
  
  utilities: ['`!afk [reason]` - Set AFK status `[public]`', '`/bump` - Set bump reminder `[public]`', '`!avatar / !banner [@user]` - View avatars `[public]`', '`!status` - Security health overview `[public]`', '`!setmedia #channel` / `!unsetmedia` - Bind auto-media extractor `[extra owners]`', '`!mp3 link` - Extract audio from links `[public]`', '`!rate [url]` - Post edit to be rated `[public]`', '`!rateleaderboard` - Top rated edits `[public]`', '`!ping / !time` - Latency and IST `[public]`', '`!setup` - Quick-bind logs, qr VC, qr role `[extra owners]`', '`!dev` - View Developer details `[public]`', '`!calc / !calculator` - Interactive calculator `[public]`', '`!upload "name.exe"` - Upload executable file safely `[public]`', '`!quote <msg_id>` - Canvas quote `[public]`', '`!quotemaker` - Quote generator `[public]`', '`!quote setchannel` - Auto-quote channel `[admin]`'],
  customcmds: ['`!ccmd add <name> <cmd>` - Create custom server command `[admin]`', '`!ccmd list` - View custom commands `[public]`', '`!ccmd grant @user` - Grant access `[admin]`', '`!ccmd revoke @user` - Revoke access `[admin]`', '`!ccmd access` - View granted list `[public]`'],
  tickets: ['`!ticket` - Launch Ticket Panel Builder `[extra owners]`', '`!close` - Close active ticket thread `[public]`'],
  newsfeed: ['`!news setup #channel` - Setup automated news feeds `[extra owners]`', '`!news add <source>` - Subscribe to feeds `[extra owners]`']
};

import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

// Regex to find and replace the helpModules array
const regex = /const helpModules = \[\s*\{[\s\S]*?\];/;
const match = js.match(regex);

if (match) {
    let rawArray = match[0];
    
    // We will parse it simply by replacing the commands array inside each module string
    for (const [id, cmds] of Object.entries(newCommands)) {
        // Find the module line matching id: 'id'
        const modRegex = new RegExp(`\\{ id: '${id}',.*?\\] \\}`, 'g');
        rawArray = rawArray.replace(modRegex, (fullMatch) => {
            // Replace the commands: [...] part
            const newCmdStr = `commands: ` + JSON.stringify(cmds);
            return fullMatch.replace(/commands: \[.*?\]/, newCmdStr);
        });
    }
    
    js = js.replace(regex, rawArray);
    fs.writeFileSync("src/commands/utility.js", js);
    console.log("Injected all missing commands!");
} else {
    console.log("Could not find helpModules array.");
}
