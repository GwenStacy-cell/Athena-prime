import fs from "fs";
let js = fs.readFileSync("src/commands/verify.js", "utf8");

// Inject 'mode' option into the Slash Command Builder
const oldOptions = `        options: [
          {
            name: 'role',
            description: 'The role ID or mention to grant upon verification',
            type: 3, // STRING
            required: true
          }
        ]`;

const newOptions = `        options: [
          {
            name: 'role',
            description: 'The role ID or mention to grant upon verification',
            type: 3, // STRING
            required: true
          },
          {
            name: 'mode',
            description: 'Challenge mode for the verification panel',
            type: 3, // STRING
            required: false,
            choices: [
              { name: 'Button (Instant)', value: 'button' },
              { name: 'Math Challenge', value: 'math' },
              { name: 'Image Captcha', value: 'captcha' }
            ]
          }
        ]`;

js = js.replace(oldOptions, newOptions);

// Extract 'mode' from interaction and pass it to the DB and panel
const oldRoleLogic = `        const roleOption = interaction.options.get('role');
        let role = null;`;

const newRoleLogic = `        const roleOption = interaction.options.get('role');
        const mode = interaction.options.getString('mode') || 'button';
        let role = null;`;

js = js.replace(oldRoleLogic, newRoleLogic);

// Update DB call
const oldDbCall = `db.updateVerification(guildId, { messageId: promptMsg.id, channelId: interaction.channel.id, roleId: role.id });`;
const newDbCall = `db.updateVerification(guildId, { messageId: promptMsg.id, channelId: interaction.channel.id, roleId: role.id, mode });`;

js = js.replace(oldDbCall, newDbCall);

// Update Verify Panel text
const oldPanelContent = "description: `-# **Click the button below to verify your account and gain access to the server.**`";
const newPanelContent = "description: `-# **Click the button below to verify your account and gain access to the server.**\\n-# **Mode:** \` + (mode === 'button' ? 'Instant' : mode === 'math' ? 'Math Challenge' : 'Image Captcha') + \``";

js = js.replace(oldPanelContent, newPanelContent);

fs.writeFileSync("src/commands/verify.js", js);
