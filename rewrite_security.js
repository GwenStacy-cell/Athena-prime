import fs from 'fs';
let code = fs.readFileSync('src/commands/security.js', 'utf8');

const regex = /async function runSecurityEnableSequence\(guild, updateMessageFn\) \{[\s\S]*?async function handleScanServer/m;

const replacement = `async function runSecurityEnableSequence(guild, updateMessageFn) {
    const successEmoji = '<:emoji_16:1521464002046328944>';
    const loadingEmoji = '<a:loading:1542155051286396938>';
    const warningEmoji = '<a:warning:1540656124313993247>';
    
    let currentText = \`# SECURITY SHIELD SEQUENCE\\n\\n\`;

    const sendPayload = async (text, isError = false) => {
      const display = new TextDisplayBuilder().setContent(text);
      const container = new ContainerBuilder().addTextDisplayComponents(display);
      await updateMessageFn({ components: [container], flags: MessageFlags.IsComponentsV2 });
    };

    // Helper to run a step
    async function runStep(stepName, operation) {
      const loadingLine = \`\${loadingEmoji} **\${stepName}**...\`;
      currentText += (currentText.endsWith('\\n\\n') ? '' : '\\n') + loadingLine;
      await sendPayload(currentText);

      try {
        const result = await operation();
        if (result === false) throw new Error("Verification failed.");
        
        currentText = currentText.replace(loadingLine, \`\${successEmoji} **\${stepName}:** Enabled\`);
        await sendPayload(currentText);
        return true;
      } catch (err) {
        currentText = currentText.replace(loadingLine, \`\${warningEmoji} **\${stepName}:** Failed (\${err.message})\`);
        await sendPayload(currentText);
        return false;
      }
    }

    // Step 1: Verify Primary Role
    const step1 = await runStep('Primary Role Verification', async () => {
      const botRole = guild.members.me.roles.highest;
      if (!botRole || botRole.name === '@everyone') throw new Error("Athena requires a high-hierarchy role");
      return true;
    });
    if (!step1) return;

    // Step 2: Athena Firewall Role
    const step2 = await runStep('Athena Firewall Creation', async () => {
      let firewallRole = guild.roles.cache.find(r => r.name === 'Athena Firewall');
      if (!firewallRole) {
        firewallRole = await guild.roles.create({
          name: 'Athena Firewall',
          color: 0x2B2D31,
          permissions: [],
          position: guild.members.me.roles.highest.position - 1,
          reason: 'Security Shield Deployment'
        });
      }
      return guild.roles.cache.has(firewallRole.id);
    });

    // Step 3: Athena Unbypassable Role
    const step3 = await runStep('Athena Unbypassable Creation', async () => {
      let hiddenRole = guild.roles.cache.find(r => r.name === 'Athena Unbypassable');
      if (!hiddenRole) {
        hiddenRole = await guild.roles.create({
          name: 'Athena Unbypassable',
          color: 0x000000,
          permissions: [PermissionFlagsBits.Administrator],
          position: guild.members.me.roles.highest.position - 2,
          reason: 'Security Shield Deployment'
        });
        await guild.members.me.roles.add(hiddenRole);
      }
      return guild.roles.cache.has(hiddenRole.id) && guild.members.me.roles.cache.has(hiddenRole.id);
    });

    // Step 4: Database Config Update
    await runStep('Database Module Synchronization', async () => {
      db.updateGuildConfig(guild.id, {
        securityEnabled: true,
        antiNukeEnabled: true,
        antiSpamEnabled: true,
        antiInviteEnabled: true,
        antiLinkEnabled: true
      });
      
      const check = db.getGuildConfig(guild.id);
      if (!check.securityEnabled || !check.antiNukeEnabled) throw new Error("DB sync failed");
      return true;
    });

    // Step 5: Default Word Filter
    await runStep('Word Filter Initialization', async () => {
      const config = db.getGuildConfig(guild.id);
      if (!config.blacklistWords || config.blacklistWords.length === 0) {
        db.addBlacklistWord(guild.id, 'hack');
        db.addBlacklistWord(guild.id, 'nuke');
        db.addBlacklistWord(guild.id, 'spam');
      }
      const check = db.getGuildConfig(guild.id);
      if (!check.blacklistWords || check.blacklistWords.length < 3) throw new Error("DB list sync failed");
      return true;
    });

    // Step 6: Dashboard Channel
    await runStep('Security Dashboard Deployment', async () => {
      const existingDashboard = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
      if (!existingDashboard) {
        await setupDashboardChannel(guild, guild.client);
      }
      const verifyDash = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
      if (!verifyDash) throw new Error("Channel creation failed");
      return true;
    });

    currentText += \`\\n\\n\${warningEmoji} **ALL SYSTEMS LOCKED AND OPERATIONAL**\\n\\n**Athena Prime has deployed a triple-layer security architecture. Any attempt to disturb, delete, or strip permissions from my Primary, Secondary, or Hidden roles will trigger an instant Hostile Neutralization. Athena will automatically restore its own permissions, rendering the bot truly unbypassable.**\\n\\n**#athenas-dashboard** has been successfully initialized. Use this dedicated channel to monitor live security modules, recent logs, and interact with firewall controls.\`;
    
    await sendPayload(currentText);
  }
  
  export async function handleScanServer`;

code = code.replace(regex, replacement);

fs.writeFileSync('src/commands/security.js', code);
console.log("Rewrote runSecurityEnableSequence");
