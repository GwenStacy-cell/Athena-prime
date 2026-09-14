
> const helpModules = [
    { id: 'security', shortLabel: 'Security', label: 'Security & Firewall', emoji: 
'<:security_and_firewall:1523672289500069940>', commands: ['`!security` **enable all** / **disable all** ΓÇö Toggle 
all shields `[extra owners]`', '`!scanserver` ΓÇö Scan and manage unauthorized bots `[extra owners]`', '`!lockapps` / 
`!unlockapps` ΓÇö Manage slash commands server-wide `[extra owners]`', '`!antinuke` **config** ΓÇö Open the 
interactive configuration panel `[extra owners]`', '`!config` **antinuke** / **antispam** / **antiinvite** / 
**antibot** / **maxwarnings** `on|off` `[extra owners]`', '`!raidmode` **on** / **off** ΓÇö Auto-quarantine every new 
join during a raid `[extra owners]`', '`!emergency` **mode** / **end** ΓÇö Strip dangerous permissions and hide 
channels `[extra owners]`', 'You MUST whitelist friendly bots (`!botwhitelist add <ID>`). Unwhitelisted bots will be 
instantly banned.'] },
    { id: 'np', shortLabel: 'No-Prefix', label: 'No-Prefix (NP) Bypass', emoji: 
'<:whitelist_and_permissions:1523678393269223564>', commands: ['`!np add user` `@user|id` `[duration]` - Grant 
No-Prefix bypass `[bot owner/np manager]`', '`!np add server` `id` `[duration]` - Grant No-Prefix to entire server 
`[bot owner/np manager]`', '`!np reset user` `id` - Revoke user No-Prefix bypass `[bot owner/np manager]`', '`!np 
reset server` `id` - Revoke server No-Prefix bypass `[bot owner/np manager]`', '`!np guide` - View full No-Prefix 
system guide `[np manager]`'] },
      { id: 'whitelist', shortLabel: 'Whitelist', label: 'Whitelist & Permissions', emoji: 
'<:whitelist_and_permissions:1523678393269223564>', commands: ['`!whitelist` - Open the Global Whitelist Manager 
Dashboard `[extra owners]`', '`!auth` - Configure the Role Authorization Tiers Dashboard `[server owner]`', '`!tier` - 
Check your authorization clearance level `[public]`', '`!whitelist` `@user|@role` - Open the direct access panel for a 
user/role `[extra owners]`', '`!botwhitelist` **add** / **remove** `botId|@role` - Grant/revoke Anti-Nuke immunity 
`[server owner]`', '`!botwhitelist list` - View all currently immune bots and roles `[server owner]`', 
'`!userblacklist` **add** / **remove** / **list** `@user` - Blacklist a user from the bot `[extra owners]`', 
'`!extraowner` **add** / **remove** / **list** `@user` - Grant full bot access `[server owner]`'] },
    { id: 'links', shortLabel: 'Filters', label: 'Link & Invite Filters', emoji: 
'<:link_invite_threads:1523770849197428837>', commands: ['`!antilink` - Open the Interactive Anti-Link & Invite 
Dashboard `[extra owners]`', '`!linksallow` **add** / **remove** / **list** `domain` - Whitelist specific domains 
`[extra owners]`', '`!blacklist` **add** / **remove** / **list** `phrase` - Auto-delete matching phrases `[extra 
owners]`'] },
    { id: 'quarantine', shortLabel: 'Quarantine', label: 'Quarantine & Isolation', emoji: 
'<:quarantine_and_isolation:1523717608455667893>', commands: ['`!quarantine` `@user` `[duration]` `[reason]` - Strip 
roles and isolate (alias: `!qr`) `[extra owners]`', '`!unquarantine` `@user` - Restore roles and release from 
isolation `[extra owners]`', '`!massquarantine` `@role` - Quarantine all members of a role at once `[extra owners]`', 
'`!massunquarantine` - Release all currently quarantined members `[extra owners]`', '`!qrmanager` **setup** / 
**setrole** / **setchannel** / **setvc** / **status** `[extra owners]`', '`!lockdown` **on** / **off** - Restrict 
channel to moderators only `[extra owners]`'] },
    { id: 'moderation', shortLabel: 'Moderation', label: 'Moderation & Threads', emoji: 
'<:moderation_and_threads:1523770550638346380>', commands: ['`ur` `@user` `new_name` - Renames a user in the server 
`[extra owners]`', '`!snipe` - Recover the most recently deleted message in the channel `[extra owners]`', '`!warn` 
`@user` `reason` - Issue a warning (auto-quarantine at threshold) `[extra owners]`', '`!warnings` / `!clearwarns` 
`@user` - View or wipe warning history `[extra owners]`', '`/maxwarnings` `amount` - Set the maximum warning threshold 
`[extra owners]`', '`!timeout` `@user` `dur` - Timeout a member (e.g. `5m` `1h` `1d`) `[extra owners]`', '`!kick` / 
`!ban` / `!unban` / `!unbanall` - Standard moderation actions `[extra owners]`', '`!addrole` / `!removerole` `@user` 
`@roles...` - Safely assign/remove multiple roles `[extra owners]`', '`!striproles` `@user` - Instantly strip all 
roles from a member `[extra owners]`', '`!massaddrole` / `!massremoverole` `@role` - Safely add/remove a role to/from 
everyone `[extra owners]`', '`!massstrip` / `!massrestore` `@role` - Mass strip a role and restore it back later 
`[extra owners]`', '`!sync` / `!syncall` - Sync channel permissions with category `[extra owners]`', '`!purge` `1-100` 
- Bulk-delete messages from current channel `[extra owners]`', '`!slowmode` `seconds` - Set channel slowmode (0 = off) 
`[extra owners]`', '`!createchannel` / `!deletechannel` - Create or delete a text channel `[extra owners]`', 
'`!createrole` / `!deleterole` - Create or delete a role `[extra owners]`', '`!hide` / `!unhide` `[channel]` - 
Instantly hide or unhide a text/voice channel from @everyone `[extra owners]`', '`!createthread` / `!archivethread` / 
`!deletethread` - Thread management `[extra owners]`', '`!ignore` **channel / category** - Block commands `[admin 
tier]`', '`!ignoreall` / `!unignoreall` - Mass command lock `[admin tier]`'] },
    { id: 'music', shortLabel: 'Music', label: 'Music Player', emoji: '<:music_player:1523770740476739809>', commands: 
['`/setupmusic` `[image_url]` - Create the Compact Music Player channel `[extra owners]`', '`/play` `query` - Play a 
song in your voice channel via URL or search `[public]`', 'Use the dedicated Music Console channel to control playback 
(Play, Pause, Skip, Queue, Stop).'] },
    { id: 'messaging', shortLabel: 'Messaging', label: 'Announcements & Messaging', emoji: 
'<:announcement_and_message:1523721769205235842>', commands: ['`!say` `#channel` `message` - Send an anonymous bot 
message `[extra owners]`', '`!announce` `#channel` `title | message` - Post a styled announcement embed `[extra 
owners]`', '`!modmode` **on** / **off** - Restrict all channels to moderators instantly `[extra owners]`', '`!sticky` 
**set / footer / remove** - Manage channel sticky messages `[extra owners]`'] },
    { id: 'voice', shortLabel: 'Voice', label: 'Voice & Join-to-Create', emoji: 
'<:voice_join_to_create:1523770607706308658>', commands: [
      '`!vcpanel` - Interactive Server Owner Voice Control Panel (Mute, Deafen, Ban, Lock) `[server owner]`',
      '`!theatermode` **on/off** - Activates Movie Mode (Server mutes/deafens the entire VC) `[extra owners]`', 
      '`!vclock` / `!vcunlock` - Deny or restore Connect permissions for @everyone in your VC `[extra owners]`', 
      '`!mute` / `!unmute` / `!deafen` / `!undeafen` - VC member state control `[extra owners]`', 
      '`!muteall` / `!unmuteall` / `!deafenall` / `!undeafenall` - Mass VC state control `[extra owners]`', 
      '`!vcstatus` **on/off** - Toggle the dynamic VC live status text `[extra owners]`', 
      '',
      '`!moveprotect` **add/remove/list** `@user` - Prevent admins from moving protected users `[server owner]`', 
      '`!vcprotect` **add/remove/list** `@user` - Prevent admins from muting/deafening protected users `[server 
owner]`', 
      '',
      '`!massmove` `dest` / `!massdc` - Move or disconnect everyone in a VC `[extra owners]`', 
      '`!vcdrag` `@user` `[interval]` - Drag a user endlessly through VCs (default: 2s) `[extra owners]`', 
      '`!vcdragstop` `@user` - Stop the drag session for a specific user `[extra owners]`', 
      '`!vcdraglist` - View all currently active drag sessions `[extra owners]`', 
      '',
      '`!jtcsetup` `#voicechannel` - Designate the JTC creator channel `[extra owners]`', 
      '`!jtcdisable` - Remove the JTC system from this server `[extra owners]`', 
      '`!vc` - Manage your personal JTC channel (rename, limit, privacy...) `[public]`', 
      '',
      '`!vcpanel` - Interactive Server Owner Voice Control Panel (Mute, Deafen, Ban, Lock) `[server owner]`',
      '`!theatermode` **on/off** - Activates Movie Mode (Server mutes/deafens the entire VC) `[extra owners]`', 
      '`!vclock` / `!vcunlock` - Deny or restore Connect permissions for @everyone in your VC `[extra owners]`', 
      '`!mute` / `!unmute` / `!deafen` / `!undeafen` - VC member state control `[extra owners]`', 
      '`!muteall` / `!unmuteall` / `!deafenall` / `!undeafenall` - Mass VC state control `[extra owners]`', 
      '`!vcstatus` **on/off** - Toggle the dynamic VC live status text `[extra owners]`', 
      '',
      '`!moveprotect` **add/remove/list** `@user` - Prevent admins from moving protected users `[server owner]`', 
      '`!vcprotect` **add/remove/list** `@user` - Prevent admins from muting/deafening protected users `[server 
owner]`', 
      '',
      '`!massmove` `dest` / `!massdc` - Move or disconnect everyone in a VC `[extra owners]`', 
      '`!vcdrag` `@user` `[interval]` - Drag a user endlessly through VCs (default: 2s) `[extra owners]`', 
      '`!vcdragstop` `@user` - Stop the drag session for a specific user `[extra owners]`', 
      '`!vcdraglist` - View all currently active drag sessions `[extra owners]`', 
      '',
      '`!jtcsetup` `#voicechannel` - Designate the JTC creator channel `[extra owners]`', 
      '`!jtcdisable` - Remove the JTC system from this server `[extra owners]`', 
      '`!vc` - Manage your personal JTC channel (rename, limit, privacy...) `[public]`', 
      '',
      '`!sethomevc` `[channel]` - Set bot\'s Home VC (auto-rejoin if moved) `[extra owners]`', 
      '`!unsethomevc` - Clear Home VC and disconnect the bot `[extra owners]`'
    ] },
    { id: 'tts', shortLabel: 'TTS', label: 'Text to Speech System', emoji: 
'<:voice_join_to_create:1523770607706308658>', commands: ['`!tts` `<message>` / **stop** - Speak in VC `[public]`', 
'`!tts` **lang** `<code|name>` - Set language (e.g., `english`, `uk`, `au`, `es`, `ja`) `[public]`', '`!tts` **auto** 
/ **unauto** `[@user]` - Lock user to Auto-TTS `[public/admin]`', '`!tts` **autovc** - Toggle global Auto-TTS for your 
current VC `[admin]`'] },
      { id: 'welcome', shortLabel: 'Welcome', label: 'Welcome & Leave', emoji: 
'<:welcome_and_leave:1523727386967933071>', commands: ['`!welcome` - Open the Welcome message manager `[extra 
owners]`', '`!leave` - Open the Leave message manager `[extra owners]`', '`/autorole-config` **add/remove/clear** - 
Manage roles auto-assigned to new members `[extra owners]`', 'Supports `{user}` `{server}` `{count}` placeholders in 
custom embeds'] },
    { id: 'verification', shortLabel: 'Tickets', label: 'Verification & Tickets', emoji: 
'<:verification_and_ticket:1523770653528817835>', commands: ['**Zero-Trust Verification Gateway**', '`/verify setup` 
`@role_or_id` - Deploy the interactive verification panel `[extra owners]`', '  - **Auto-Config:** Automatically 
strips `View Channels` from `@everyone` and Discord Onboarding roles.', '  - **Manual Mode:** Deploy the panel and 
manage permissions manually.', '  - **Fallback Input:** If the Discord role picker glitches, you can simply paste a 
Role ID directly.', '`/verify disable` - Disable the gateway and restore global permissions `[extra owners]`', '', 
'**Default Ticket System**', '`!ticket setup` `#category` `@role` - Deploy a simple, single-button ticket system 
`[extra owners]`', '', '**Custom Ticket Panel**', '`!ticketpanel` - Spawns the Interactive Ticket Manager with the 
following options:', 'ΓÇó **Target Channel Dropdown**: Select the channel to deploy the panel to. Automatically 
deletes the old panel.', 'ΓÇó **Closing Roles Dropdown**: Restrict who can close tickets. Leave empty for default 
behavior (anyone).', 'ΓÇó **Edit Title & Desc**: Changes the main text of the Ticket Panel.', 'ΓÇó **Edit Media & 
Placeholder**: Attach images and change the dropdown placeholder.', 'ΓÇó **Add Option**: Adds a new selectable reason 
to the dropdown menu.', '  - **Internal Value**: The secret code word for the bot (no spaces, bot use only).', '  - 
**Display Label**: The bold text the user actually clicks on.', '  - **Description**: The smaller gray text under the 
label.', '  - **Emoji**: An optional Emoji ID or standard emoji.', 'ΓÇó **Clear Options**: Instantly deletes ALL 
dropdown options.', 'ΓÇó **Test Panel**: Shows a temporary, invisible-to-others preview of your panel.', 'ΓÇó **Deploy 
Panel**: Drops the final customized Ticket Panel into the selected target channel.', 'ΓÇó **Save & Close**: Deletes 
the Interactive Manager message.'] },
    { id: 'engagement', shortLabel: 'Tracking', label: 'Engagement & Tracking', emoji: 
'<:engagement_and_tracking:1523729377961967788>', commands: ['**Server Logging System**', '`!serverlogs` - Open the 
Advanced Modular Server Logging dashboard `[extra owners]`', '`!serverlogs` **autosetup** - Instantly builds an 
"Athena Logs" category and #server-logs channel as a fallback.', '`!serverlogs` **bind** `<module>` `<channel>` - 
Route specific events (like bans or kicks) into custom channels.', '`!serverlogs` **toggle** `<module>` - Enable or 
disable tracking for specific modules.', '`!setdeletelog` `#channel` - Quick shortcut to log deleted messages to a 
specific channel `[extra owners]`', '', '**YouTube Notifier**', '`!youtube` **add** `<url>` `<#channel>` `[message]` - 
Add a new YouTube upload tracker `[extra owners]`', '`!youtube` **remove** `<url>` - Remove a YouTube tracker `[extra 
owners]`', '`!youtube` **list** - View all active YouTube trackers `[extra owners]`', '', '**Available Modules:**', 
'`bans`, `kicks`, `leaves`, `joins`, `msgDeletes`, `msgEdits`, `channels`, `roles`', '', '**Examples:**', 
'`!serverlogs bind bans #ban-jail` - Routes all ban logs to a specific channel.', '`!serverlogs toggle msgDeletes` - 
Turns off message deletion logs entirely.', '', '**Statistics & Invites**', '`!serverstats` **setup** / **disable** / 
**config** - Create & configure live Member Count VCs `[extra owners]`', '`!rrsetup` - Launch the interactive Reaction 
Role Menu builder `[extra owners]`', '`!rrdisable` - Wipe all Reaction Role configurations from the server `[extra 
owners]`', '`!invitesetup` `#channel` - Enable the Advanced Invite Tracker to log who invites who `[extra owners]`', 
'`!invitelb` - View the image-based Top Invites Leaderboard `[public]`', '`!syncinvites` - Retroactively sync past 
Discord invites into the database `[extra owners]`', '`!invitedisable` - Disable Invite Tracking `[extra owners]`', 
'`!record` **start / stop** - Start or stop a live VC audio recording `[extra owners]`'] },
    { id: 'autoresponder', shortLabel: 'Triggers', label: 'Auto-Responder', emoji: 
'<:auto_responder:1523770799603847179>', commands: ['`!trigger` **create** `match | response` - Add a custom keyword 
trigger `[extra owners]`', '`!trigger` **remove** `match` - Delete a trigger `[extra owners]`', '`!trigger` **list** - 
View all active triggers in this server `[extra owners]`'] },
    { id: 'news', shortLabel: 'News Feed', label: 'News Feed', emoji: '<:news:1523770698416259172>', commands: 
['`/news setup` `#channel` `[@role]` - Setup the automated news feed `[extra owners]`', '`/news add` `[preset]` 
`[url]` - Add a news source (e.g. BBC, CNN) `[extra owners]`', '`/news remove` `url` - Remove a news source `[extra 
owners]`', '`/news list` - View all active subscriptions `[extra owners]`'] },
    { id: 'customization', shortLabel: 'Config', label: 'Customization', emoji: 
'<:customisation:1523754350160384195>', commands: ['`!prefix` `new_prefix` - Set a custom prefix for the server 
`[server owner]`', '`!accent` - Set the embed accent color (10 pure presets + custom hex) `[extra owners]`', 
'`!autonick` **on/off** / **sync** / **layout** `[format]` - Auto-format nicknames `[extra owners]`', 
'`!setguildavatar` / `!setguildbanner` - Set bot\'s custom per-server avatar/banner `[extra owners]`', '`/steal` 
`:emoji: ...` - Steal multiple emojis into your server `[extra owners]`', '`!stealemoji` - Cross-server Emoji Stealer 
`[bot/server owner]`'] },
    { id: 'leveling', shortLabel: 'Leveling', label: 'Leveling & XP Engine', emoji: 
'<:leveling_and_xp:1523743634866966719>', commands: ['`/xpsetup` - Launch the Interactive XP Control Panel (Milestones 
& Multipliers) `[extra owners]`', '`/rank` `[@user]` - View a graphic of your current level, XP, and progress 
`[public]`', '`/leaderboard` - View the server\'s top active members sorted by XP `[public]`'] },
    { id: 'stats', shortLabel: 'Stats', label: 'Message Statistics', emoji: 
'<:message_statistics:1523744734902878329>', commands: ['`/setstatschannel` `#channel` - Restrict stats usage to a 
specific channel `[extra owners]`', '`!me` or `!stats me` - View your personal server message statistics `[public]`', 
'`!u` or `!stats user` `@user` - View message stats for a specific user `[public]`', '`!server` - View a graphical 
overview of server statistics `[public]`', '`!top` - View the combined server leaderboard `[public]`', '`!chatlb` - 
View the image-based Top Chatters Leaderboard `[public]`', '`!voicelb` - View the image-based Top Voice Activity 
Leaderboard `[public]`', '`!bi` / `!botstats` - View global Athena internal statistics `[bot owner]`', '`!ytstats` - 
Build dynamic Voice Channels tracking YouTube Subs `[extra owners]`'] },
    { id: 'birthdays', shortLabel: 'Giveaways', label: 'Birthdays & Giveaways', emoji: 
'<:birthday_and_giveaway:1523746133523038369>', commands: ['`!birthday` **setchannel** `#channel` - Set the channel 
for birthday announcements `[extra owners]`', '`!birthday` **set** / **remove** `@user` - Manage member birthdays 
`[extra owners]`', '`!birthday` **list** - List all birthdays in the server `[extra owners]`', '`!testbirthday` - Send 
a test birthday announcement `[extra owners]`', '`/giveaway start` (Random, Top Chat, VC Time, Invites) / `end` / 
`reroll` - Interactive button giveaway management `[extra owners]`'] },
    { id: 'utilities', shortLabel: 'Utility', label: 'Utilities', emoji: '<:utilities:1523747124653723838>', commands: 
['`!afk` `[reason]` - Set your AFK status `[public]`', '`/bump` - Set a bump reminder and boost the server 
`[public]`', '`!avatar` / `!banner` `[@user]` - View a member\'s global/server avatar or banner `[public]`', 
'`!status` - Real-time security health overview `[public]`', '`!serverinfo` / `!serveroverview` / `!userinfo` 
`[@user]` - View stats and profile information `[public]`', '`!setmedia` `#channel` / `!unsetmedia` - Bind or unbind 
the auto-media extractor `[extra owners]`', '`!mp3` `link` - Extract audio from any media link `[public]`', '`!rate` 
`[url/attachment]` - Post an edit to be rated `[public]`', '`!rateleaderboard` - View top rated edits globally 
`[public]`', '`!rate` `#channel` - Bind ratings to a specific channel `[extra owners]`', '`!date` `@user` - Go on a 
beautiful, romantic date with someone `[public]`', '`!ping` / `!time` - Check bot latency and Indian Standard Time 
(IST) `[public]`', '`!setup` - Quick-bind log channel, quarantine VC and quarantine role `[extra owners]`', '`!dev` - 
View Lead Architect & Developer details `[public]`', '`!calc` / `!calculator` - Launch an interactive CV2 calculator 
`[public]`', '`!upload` `"name.exe"` - Upload an executable file safely bypassing discord blocks `[public]`', 
'`!quote` `<msg_id|@user>` `[theme]` - Generate an aesthetic canvas quote `[public]`', '`!quotemaker` - Interactive 
canvas quote generator `[public]`', '`!quote setchannel` `#channel` - Bind a dedicated Auto-Quote channel `[admin]`'] }
  ];
  
  const HELP_GIF = 'https://cdn.discordapp.com/attachments/1534869224277807175/1542472732325978234/ATHENA-8-27-2026.png
?ex=6a915b2d&is=6a9009ad&hm=0f55bae0c0bec27649bc03e6d6be23ad16f2eb9337efdb8b5793b2d74cad89ff&';
  
  function buildHelpContainer(client, guildId, moduleId = 'home') {
    const config = db.getGuildConfig(guildId || '0');
    const prefix = config?.prefix || '!';
    const botId = client?.user?.id || '1347071663182676059';
  
    let rawComponents = [];
  
    if (moduleId === 'home') {
      let topText = `# Hey !!! , I am <@${botId}> ,\n\n`;
      topText += `> <a:z_arrow_pink1:1523082728004653138> **Welcome to Athena Prime A bot which is made for 
unbypassable security features and community management! View down and see our srv management modules listed 
below:**\n\n`;
      topText += `> <a:z_arrow_pink1:1523082728004653138> **To set Custom Prefix use <@${botId}> \`${prefix}prefix " 
your custom prefix "\`**\n\n`;
      topText += `> <a:z_arrow_pink1:1523082728004653138> **Hint : To Know more use " Tag the Bot and Type Guide for 
details and usage "**`;
  
      rawComponents.push({ type: 10, content: topText });
      rawComponents.push({ type: 14, divider: true });
  
      let grid = '';
      for (let i = 0; i < helpModules.length; i++) {
        const mod = helpModules[i];
        const col = i % 3;
        let label = mod.shortLabel || mod.label;
        let targetLength = 10; 
        let spaces = targetLength - label.length;
        let padding = '\u00A0'.repeat(spaces > 0 ? spaces : 0);
        let displayLabel = label.replace(/ /g, '\u00A0');
        grid += `${mod.emoji} **\` ${displayLabel}${padding} \`** `;
        if (col === 2) grid += '\n'; 
      }
      
      rawComponents.push({ type: 10, content: grid.trim() });
      rawComponents.push({ type: 14, divider: true });
  
    } else {
      const mod = helpModules.find(m => m.id === moduleId);
      if (mod) {
        let currentChunk = `# ${mod.emoji} ${mod.label.toUpperCase()}`;
        
        for (const cmd of mod.commands) {
          if (cmd === '') {
            if (currentChunk.trim().length > 0) {
              rawComponents.push({ type: 10, content: currentChunk.trim() });
            }
            rawComponents.push({ type: 14, divider: true });
            currentChunk = '';
            continue;
          }
          
          let formatted = cmd.replace(/!/g, prefix);
          let line = '';
          if ((formatted.startsWith('**') && formatted.endsWith('**')) || formatted.startsWith('-┬ó ') || 
formatted.startsWith('  - ') || formatted.startsWith('`bans`,')) {
            line = formatted;
          } else {
            line = `> **${formatted}**`;
          }
  
          if (currentChunk.length + line.length + 4 > 1900) {
            if (currentChunk.trim().length > 0) {
              rawComponents.push({ type: 10, content: currentChunk.trim() });
            }
            currentChunk = line;
          } else {
            currentChunk += (currentChunk ? '\n\n' : '') + line;
          }
        }
  
        if (currentChunk.trim().length > 0) {
          rawComponents.push({ type: 10, content: currentChunk.trim() });
        }
  
        rawComponents.push({ type: 14, divider: true });
      }
    }
  
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_module_select')
      .setPlaceholder('Click to view modules');
  
    selectMenu.addOptions([
      {
        label: 'Home Menu',
        description: 'Return to the main help menu',
        value: 'home',
        emoji: '<:home:1523765738655973589>'
      }
    ]);
  
    for (const mod of helpModules) {
      selectMenu.addOptions([
        {
          label: mod.label,
            value: mod.id
        }
      ]);
    }
  
    const btnPrev = new 
ButtonBuilder().setCustomId('help_prev').setEmoji('<:previous:1523766004839088301>').setStyle(ButtonStyle.Secondary);
    const btnNext = new 
ButtonBuilder().setCustomId('help_next').setEmoji('<:next:1523766065576935475>').setStyle(ButtonStyle.Secondary);
    const btnRefresh = new 
ButtonBuilder().setCustomId('help_home').setEmoji('<:home:1523765738655973589>').setStyle(ButtonStyle.Secondary);
    const btnDelete = new 
ButtonBuilder().setCustomId('help_delete').setEmoji('<:delete:1523766340752642109>').setStyle(ButtonStyle.Danger);
  
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(btnPrev, btnNext, btnRefresh, btnDelete);
  
    const HELP_GIF = 'https://cdn.discordapp.com/attachments/1534869224277807175/1542472732325978234/ATHENA-8-27-2026.p
ng?ex=6a915b2d&is=6a9009ad&hm=0f55bae0c0bec27649bc03e6d6be23ad16f2eb9337efdb8b5793b2d74cad89ff&';
  
    rawComponents.push({ type: 12, items: [{ media: { url: HELP_GIF } }] });
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push(row1.toJSON());
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push(row2.toJSON());
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push({ type: 10, content: '-# **Athena Prime Unbypassable Security !!**' });
  
    // Raw Container JSON - no accent_color so it renders borderless like VC panel
    const rawContainer = {
      type: 17,
      components: rawComponents
    };
  
    return rawContainer;
  }
  
  
  async function handleSetup(guild, channel, role, voiceChannel) {
    const updates = {};
    const fields = [];
  
    if (channel) {
      updates.logChannel = channel.id;
      fields.push({ name: 'Security Logs Channel', value: `${channel} (ID: ${channel.id})` });
    }
  
    if (voiceChannel) {
      updates.quarantineVcId = voiceChannel.id;
      fields.push({ name: 'Quarantine Voice Channel', value: `${voiceChannel} (ID: ${voiceChannel.id})` });
    }
  
    if (role) {
      updates.quarantineRoleId = role.id;
      fields.push({ name: 'Quarantine Role', value: `${role} (ID: ${role.id})` });
    }
  
    db.updateGuildConfig(guild.id, updates);
  
    const resEmbed = cv2.success(
      'Configuration Updated',
      'Successfully saved server adjustments to database cache.',
      fields
    );
  
    return resEmbed;
  }
  
  // ├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├ó
ΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├
óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼
├óΓÇ¥Γé¼├óΓÇ¥Γé¼
  // ADDED NEW COMMANDS BELOW
  // ├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├ó
ΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├
óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼├óΓÇ¥Γé¼
├óΓÇ¥Γé¼├óΓÇ¥Γé¼
  
  commands.push({
    name: 'autorole-config',
    description: 'Add or remove an autorole for new members',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageRoles],
    options: [
      {
        name: 'action',
        description: 'Add or Remove',
        type: 3,
        required: true,
        choices: [
          { name: 'Add Role', value: 'add' },
          { name: 'Remove Role', value: 'remove' },
          { name: 'Clear All', value: 'clear' }
        ]
      },
      {
        name: 'role',
        description: 'The role to configure',
        type: 8,
        required: false
      }
    ],
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      const role = interaction.options.getRole('role');
      const cfg = db.getGuildConfig(interaction.guild.id);


