import fs from "fs";
let js = fs.readFileSync("src/commands/welcome.js", "utf8");

// Fix test message resolver
js = js.replace(/const content = cfg\.message \? resolve\(cfg\.message, interaction\.member\) : undefined;/,
  "const content = cfg.message ? resolve(cfg.message, interaction.member, cfg) : undefined;");

js = js.replace(/export function buildWelcomeEmbed\(member, cfg\) \{[\s\S]*?if \(cfg\.image\) \{/m, 
`export function buildWelcomeEmbed(member, cfg) {
  if (!cfg) return null;
  const e = new EmbedBuilder();

  if (cfg.color) {
    try { e.setColor(cfg.color); } catch { e.setColor(0x5865F2); }
  } else {
    e.setColor(0x5865F2);
  }

  const userAvatar = member.user.displayAvatarURL({ dynamic: true, size: 256 });
  const avatarPos = cfg.avatarPos || 'thumbnail';

  if (cfg.from || avatarPos === 'author') {
    try {
      e.setAuthor({
        name: cfg.from ? resolve(cfg.from, member, cfg) : resolve('{user}', member, cfg).replace(/<@\\d+>/g, member.user.username),
        iconURL: (avatarPos === 'author') ? userAvatar : (cfg.fromIcon ? resolve(cfg.fromIcon, member, cfg) : member.guild.iconURL({ dynamic: true }) || undefined)
      });
    } catch (err) {}
  }

  if (cfg.title) e.setTitle(resolve(cfg.title, member, cfg));

  if (cfg.description) e.setDescription(resolve(cfg.description, member, cfg));
  else if (!cfg.title && !cfg.from) e.setDescription(\`**Welcome to \${member.guild.name}!**\`);

  if (avatarPos === 'thumbnail') e.setThumbnail(userAvatar);
  if (avatarPos === 'image') e.setImage(userAvatar);

  if (cfg.image) {`);

js = js.replace(/if \(cfg\.footer\) \{[\s\S]*?e\.setFooter\(\{[\s\S]*?text: resolve\(cfg\.footer, member, cfg\),[\s\S]*?\}\);[\s\S]*?\} catch \(err\) \{\}[\s\S]*?\}/m,
`if (cfg.footer || avatarPos === 'footer') {
    try {
      e.setFooter({
        text: cfg.footer ? resolve(cfg.footer, member, cfg) : 'Welcome!',
        iconURL: (avatarPos === 'footer') ? userAvatar : undefined
      });
    } catch (err) {}
  }`);

fs.writeFileSync("src/commands/welcome.js", js);
