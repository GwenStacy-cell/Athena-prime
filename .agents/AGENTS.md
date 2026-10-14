# Bot Emoji Rules
- Avoid using Discord native emojis (like ✅, ❌, ⚠️, etc.) anywhere in the bot's responses or embeds.
- For command success / actions completed / granted / executed: ALWAYS use the custom tick emoji `<a:atheNATICK:1557841381630681106>` placed after the heading in the format: `Heading | <a:atheNATICK:1557841381630681106>`.
- For uptime/status indicator ticks, use: `<a:uptime:1552608831060844575>`.

# Database ID Detection & Fetching Rules
- ALWAYS fetch and detect channels, categories, roles, and other Discord entities from the bot's database (`database.js` / guildConfig / specific database methods) using their IDs.
- NEVER rely on or fall back to matching hardcoded names, strings, or display emojis to detect or identify existing roles, channels, or categories when they can or should be tracked in the database.
- Whenever a setup command or feature creates or binds a channel, category, role, or resource, ALWAYS store its ID in the database immediately.
- In all present and future commands, handlers, and event listeners, ALWAYS fetch by ID (`guild.channels.cache.get(id) || await guild.channels.fetch(id)` / `guild.roles.cache.get(id) || await guild.roles.fetch(id)`) using the database configuration.
