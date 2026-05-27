# 🛡️ Sentinel Security - Advanced Discord Moderation & Expanded Security Bot

Welcome to **Sentinel Security**, a powerful, state-of-the-art moderation, Anti-Nuke, and anti-raid bot built with modern **Node.js** and **discord.js v14**. This bot combines rich visual layouts (advanced themed embeds) with highly robust security mechanics to isolate threats, mitigate spammers, block rogue administrators, and protect your server's integrity.

---

## ✨ Features

### 🛡️ Real-Time Anti-Nuke Protection
- **Mutations Checked**: Detects rapid channel deletions, role deletions, bans, and kicks.
- **Whitelist Immune System**: The **Server Owner** is always immune. You can whitelist other administrators using `!whitelist add <@user>`. If a whitelisted admin makes changes, they are permitted.
- **Instant Revocation & Quarantine**: If an unauthorized admin attempts **even 1** deletion, ban, or kick:
  1. The bot strips **all** their roles instantly (removing admin privileges).
  2. The bot assigns them the restricted `Quarantined` role.
  3. The bot sends a purple High-Priority Critical Threat alert to `#security-logs`.
  4. The bot DMs the rogue admin notifying them of the restriction.

### 🛡️ Isolation Quarantine System
- **Stateful Role Preservation**: Strips a user of all roles, locks them in a private `#quarantine-zone` channel, and DMs them explaining why. The bot remembers their original role configuration in `data/db.json` and **fully restores** it on `/unquarantine`.
- **Bypass Containment**: If a quarantined member leaves and rejoins the server, the bot immediately detects it, alerts logs, and re-applies isolation roles.

### ⚡ Sliding Window AutoMod Filters
- **Anti-Spam Filter**: Real-time sliding window frequency analyzer. Exceeding message limits deletes spam, issues alerts, and automatically quarantines persistent offenders.
- **Word Blacklist Scanner**: Automatically deletes and logs messages containing blacklisted phrases. Increments warnings count and quarantines members when they exceed limits.
- **Anti-Invite Blocker**: Automatically deletes and logs unauthorized external Discord invite links (`discord.gg/...`).

### ⚙️ Server Automation
- **Auto-Nickname Formatting**: Automatically formats nicknames for new members (e.g. `[Prefix] Username [Suffix]`). It automatically handles Discord's 32-character limit to prevent runtime crashes.
- **Dynamic Config Manager**: Easily enable/disable features or change warnings limits on the fly using `!config`.

---

## 🛠️ Step-by-Step Installation Guide

Follow these simple steps to set up and run the bot on your computer:

### Step 1: Install Node.js
1. Download and install **Node.js** (LTS version recommended) from the official website:
   👉 [https://nodejs.org](https://nodejs.org)
2. Verify the installation by opening your command prompt and typing:
   ```bash
   node -v
   npm -v
   ```

### Step 2: Set Up the Discord Developer Portal
1. Go to the **[Discord Developer Portal](https://discord.com/developers/applications)**.
2. Click **New Application** on the top right, name your bot, and click create.
3. On the left menu, click **Bot**.
4. Scroll down to the **Privileged Gateway Intents** section and turn **ON** these three toggles:
   - ✅ **Presence Intent**
   - ✅ **Server Members Intent** *(Crucial for managing roles/quarantine)*
   - ✅ **Message Content Intent** *(Crucial for commands and anti-spam detection)*
5. Scroll up and click **Reset Token**, copy the token, and keep it safe!

### Step 3: Configure Environment Settings
1. Open the project folder `c:\Users\hathi\OneDrive\Desktop\new bot`
2. Open the file `.env` in any text editor.
3. Replace `YOUR_BOT_TOKEN_HERE` with the token you copied from the Developer Portal:
   ```env
   DISCORD_TOKEN=MTE5OTU...YOUR_REAL_TOKEN_HERE...
   DEFAULT_PREFIX=!
   ```
4. Save the file.

### Step 4: Install Dependencies
Open your terminal (PowerShell, Command Prompt, or VS Code terminal) in the project directory and run:
```bash
npm install
```
*This installs `discord.js`, `dotenv`, and `chalk` for terminal logs.*

### Step 5: Start the Bot!
To run the bot in production mode:
```bash
npm start
```

For development (bot will auto-restart whenever you edit files):
```bash
npm run dev
```

---

## 🔗 How to Invite Your Bot to Your Server
1. In the **Discord Developer Portal**, go to **OAuth2** -> **URL Generator** on the left menu.
2. Select the `bot` scope and the `applications.commands` scope (critical for slash commands!).
3. Under **Bot Permissions**, select `Administrator` (Recommended for total security overrides and role modifications).
4. Copy the generated URL at the bottom and open it in your browser to invite the bot.

---

## 🎛️ Command Manual Reference

All commands are fully supported as **both** prefix commands and modern Slash Commands!

### 🔨 Moderation & Administration

| Command | Syntax | Description | Required Permissions |
| :--- | :--- | :--- | :--- |
| **`help`** | `!help` or `/help` | Displays the graphical help interface. | None |
| **`ping`** | `!ping` or `/ping` | Latency and gateway connection status check. | None |
| **`say`** | `!say <#channel> <message>` | Let the bot send a raw text message. | Manage Messages |
| **`announce`** | `!announce <#ch> <title> \| <msg>`| Sends a highly styled announcement card embed. | Manage Messages |
| **`warn`** | `!warn <user> <reason>` | Issues a warning. DMs user. At limit -> Auto Quarantine. | Moderate Members |
| **`warnings`**| `!warnings <user>` | Lists user warning history. | Moderate Members |
| **`clearwarns`**| `!clearwarns <user>` | Clears warning database records. | Moderate Members |
| **`timeout`** | `!timeout <user> <dur> [reason]`| Places native Discord timeout (e.g. `10m`, `1d`). | Moderate Members |
| **`kick`** | `!kick <user> [reason]` | Kicks user from guild. | Kick Members |
| **`ban`** | `!ban <user> [reason]` | Bans user permanently. | Ban Members |
| **`createrole`**| `!createrole <name> [color]` | Creates a server role with specified name and color. | Manage Roles |
| **`deleterole`**| `!deleterole <@role>` | Safely deletes a role. | Manage Roles |

### 🛡️ Server Security & Configuration

| Command | Syntax | Description | Required Permissions |
| :--- | :--- | :--- | :--- |
| **`quarantine`**| `!quarantine <user> [reason]`| Strips roles, isolates user, DMs alerts. | Moderate Members |
| **`unquarantine`**| `!unquarantine <user>` | Restores original user roles perfectly. | Moderate Members |
| **`muteall`** | `!muteall [text\|voice]` | Locks writing or mutes voice members. | Mute/Manage Channels |
| **`unmuteall`**| `!unmuteall [text\|voice]` | Unlocks writing or restores voice channels. | Mute/Manage Channels |
| **`lockdown`** | `!lockdown [on\|off]` | Restricts channel writing for `@everyone`. | Manage Channels |
| **`raidmode`** | `!raidmode [on\|off]` | Quarantines all newly joining accounts. | Administrator |
| **`whitelist`**| `!whitelist <add\|remove\|list> [user]`| Manages immune users (immune to anti-nuke, anti-spam, etc.) | Administrator |
| **`blacklist`**| `!blacklist <add\|remove\|list> [phrase]`| Manages filtered words (deletes and warns instantly). | Moderate Members |
| **`autonick`** | `!autonick <on\|off> [prefix] [suffix]`| Manages join nickname rules. | Manage Nicknames |
| **`config`** | `!config <setting> <value>` | Toggle: `antinuke`, `antispam`, `antiinvite`, `maxwarnings`. | Administrator |
| **`setup`** | `!setup [logchannel] [quarantinerole]`| Configures bot channels manually. | Administrator |

---

## 📁 Technical Architecture
The bot saves data locally in `data/db.json`. Here is how database files are structured:
- `guilds`: Saves customized text channel logging targets, prefixes, autonick rules, word blacklists, whitelists, and toggles.
- `warnings`: Stores warning reasons, warner IDs, and timestamps.
- `quarantines`: Caches isolated users' original roles to prevent data loss.

*All system configurations are self-healing. If `#security-logs` or the `#quarantine-zone` channels are missing, the bot creates them automatically when needed!*
