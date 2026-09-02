import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const oldVerifyButtonLogic = `      if (interaction.customId === 'verify_button') {
        const verifyData = db.getVerification(interaction.guild.id);
        if (!verifyData || !verifyData.roleId) {
          return await interaction.reply({ content: '-# **Verification system is not properly configured.**', flags: MessageFlags.Ephemeral }).catch(() => null);
        }
        
        try {
          const role = interaction.guild.roles.cache.get(verifyData.roleId);
          if (!role) {
             return await interaction.reply({ content: '-# **The verification role no longer exists.**', flags: MessageFlags.Ephemeral }).catch(() => null);
          }
          if (interaction.member.roles.cache.has(verifyData.roleId)) {
             return await interaction.reply({ content: '-# **You are already verified.**', flags: MessageFlags.Ephemeral }).catch(() => null);
          }
          await interaction.member.roles.add(role);
          return await interaction.reply({ content: '-# <:emoji_16:1521464002046328944> **Identity Authenticated! You have been granted access to the server.**', flags: MessageFlags.Ephemeral }).catch(() => null);
        } catch (err) {
          return await interaction.reply({ content: '-# **Failed to assign the verification role. Ensure my role is higher than the verification role.**', flags: MessageFlags.Ephemeral }).catch(() => null);
        }
      }`;

const newVerifyButtonLogic = `      if (interaction.customId === 'verify_button') {
        const verifyData = db.getVerification(interaction.guild.id);
        if (!verifyData || !verifyData.roleId) {
          return await interaction.reply({ content: '-# **Verification system is not properly configured.**', flags: 64 }).catch(() => null);
        }
        
        try {
          const role = interaction.guild.roles.cache.get(verifyData.roleId);
          if (!role) {
             return await interaction.reply({ content: '-# **The verification role no longer exists.**', flags: 64 }).catch(() => null);
          }
          if (interaction.member.roles.cache.has(verifyData.roleId)) {
             return await interaction.reply({ content: '-# **You are already verified.**', flags: 64 }).catch(() => null);
          }

          const mode = verifyData.mode || 'button';
          
          if (mode === 'math') {
            const { generateMathCaptcha } = await import('../utils/captchaEngine.js');
            const question = generateMathCaptcha(interaction.guild.id, interaction.user.id);
            const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
            const modal = new ModalBuilder().setCustomId('verify_math_modal').setTitle('Math Challenge');
            modal.addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('math_answer')
                  .setLabel(question)
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
                  .setMaxLength(3)
              )
            );
            return await interaction.showModal(modal).catch(()=>null);
          } 
          else if (mode === 'captcha') {
            await interaction.deferReply({ flags: 64 }).catch(()=>null);
            const { generateImageCaptcha } = await import('../utils/captchaEngine.js');
            const buffer = generateImageCaptcha(interaction.guild.id, interaction.user.id);
            const { AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = await import('discord.js');
            const attachment = new AttachmentBuilder(buffer, { name: 'captcha.png' });
            
            const btn = new ButtonBuilder()
              .setCustomId('verify_captcha_btn')
              .setLabel('Enter Captcha')
              .setStyle(ButtonStyle.Primary);
              
            const row = new ActionRowBuilder().addComponents(btn);
            
            return await interaction.editReply({
              content: '-# **Please solve the captcha below to gain access to the server.**',
              files: [attachment],
              components: [row]
            }).catch(()=>null);
          }
          else {
            // Button mode (instant)
            await interaction.member.roles.add(role);
            return await interaction.reply({ content: '-# <:emoji_16:1521464002046328944> **Identity Authenticated! You have been granted access to the server.**', flags: 64 }).catch(() => null);
          }
        } catch (err) {
          return await interaction.reply({ content: '-# **Failed to process verification.**', flags: 64 }).catch(() => null);
        }
      }

      if (interaction.customId === 'verify_captcha_btn') {
        const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
        const modal = new ModalBuilder().setCustomId('verify_captcha_modal').setTitle('Image Captcha');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('captcha_answer')
              .setLabel('Enter the characters from the image')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(6)
          )
        );
        return await interaction.showModal(modal).catch(()=>null);
      }`;

js = js.replace(oldVerifyButtonLogic, newVerifyButtonLogic);

// Add Modal Submits
const oldModalSubmitStart = "if (interaction.isModalSubmit()) {";
const newModalSubmitStart = `if (interaction.isModalSubmit()) {
      if (interaction.customId === 'verify_math_modal' || interaction.customId === 'verify_captcha_modal') {
        const answer = interaction.customId === 'verify_math_modal' 
          ? interaction.fields.getTextInputValue('math_answer') 
          : interaction.fields.getTextInputValue('captcha_answer');
          
        const { validateAnswer } = await import('../utils/captchaEngine.js');
        const isValid = validateAnswer(interaction.guild.id, interaction.user.id, answer);
        
        if (!isValid) {
          return await interaction.reply({ content: '-# **Authentication Failed.** Incorrect answer or the challenge expired.', flags: 64 }).catch(()=>null);
        }
        
        const verifyData = db.getVerification(interaction.guild.id);
        if (verifyData && verifyData.roleId) {
          try {
             await interaction.member.roles.add(verifyData.roleId);
             return await interaction.reply({ content: '-# <:emoji_16:1521464002046328944> **Identity Authenticated! You have been granted access to the server.**', flags: 64 }).catch(()=>null);
          } catch(e) {
             return await interaction.reply({ content: '-# **Failed to assign the verification role.**', flags: 64 }).catch(()=>null);
          }
        }
      }`;
      
js = js.replace(oldModalSubmitStart, newModalSubmitStart);

fs.writeFileSync("src/events/interactionCreate.js", js);
