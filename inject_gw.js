import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

const injectionTarget = "if (interaction.isButton() || interaction.isAnySelectMenu()) {";
const injectionCode = `
      // GIVEAWAY MANAGER HANDLERS
      if (interaction.customId.startsWith('gw_mode_') || interaction.customId.startsWith('gw_setup_') || interaction.customId.startsWith('gw_start_') || interaction.customId === 'gw_join') {
        const { gwManagers, buildManagerContainer } = await import('../commands/giveaway.js');
        const ms = (await import('ms')).default;
        
        if (interaction.customId === 'gw_join') {
          const messageId = interaction.message.id;
          const gwData = db.getGiveaway(messageId);
          if (!gwData || gwData.ended) return interaction.reply({ content: 'This giveaway is over or invalid!', ephemeral: true });
          
          if (!gwData.participants.includes(interaction.user.id)) {
            gwData.participants.push(interaction.user.id);
            db.saveGiveaway(messageId, gwData);
            
            const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
            originalEmbed.setFooter({ text: \`\${gwData.participants.length} Entries\` });
            await interaction.update({ embeds: [originalEmbed] });
          } else {
            return interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
          }
          return;
        }

        const managerId = interaction.customId.split('_').slice(2).join('_');
        const cfg = gwManagers.get(managerId);

        if (!cfg) {
          return interaction.reply({ content: 'This giveaway manager session has expired.', ephemeral: true });
        }

        if (interaction.user.id !== cfg.hostId) {
          return interaction.reply({ content: 'You are not the host of this manager.', ephemeral: true });
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('gw_mode_')) {
          cfg.mode = interaction.values[0];
          gwManagers.set(managerId, cfg);
          return interaction.update({ components: [buildManagerContainer(managerId)], flags: 1 << 14 });
        }

        if (interaction.customId.startsWith('gw_setup_')) {
          const modal = new ModalBuilder()
            .setCustomId(\`gw_setup_modal_\${managerId}\`)
            .setTitle('Giveaway Setup');

          const prizeInput = new TextInputBuilder()
            .setCustomId('prize')
            .setLabel('Prize')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.prize === 'Not Set' ? '' : cfg.prize)
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration (e.g. 10m, 1h, 1d)')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.duration === 'Not Set' ? '' : cfg.duration)
            .setRequired(true);

          const winnersInput = new TextInputBuilder()
            .setCustomId('winners')
            .setLabel('Number of Winners')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.winners.toString())
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(prizeInput),
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(winnersInput)
          );

          return interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('gw_start_')) {
          if (cfg.prize === 'Not Set' || cfg.durationMs < 10000) {
            return interaction.reply({ content: 'Please configure the prize and duration first! Minimum duration is 10s.', ephemeral: true });
          }

          const endsAt = Date.now() + cfg.durationMs;
          const endsAtTimestamp = Math.floor(endsAt / 1000);

          const guildConfig = db.getGuildConfig(interaction.guild.id) || {};
          const accentColor = guildConfig.accentColor || '#5865F2';
          
          const EMOJI_HEADER = '<a:emoji_11:1533024044075454464>';
          const EMOJI_JOIN = '<a:emoji_56:1533024028451672257>';

          const gwEmbed = new EmbedBuilder()
            .setDescription(\`## \${EMOJI_HEADER} GIVEAWAY \${EMOJI_HEADER}\\n\\n**Prize:** \${cfg.prize}\\n**Ends:** <t:\${endsAtTimestamp}:R> (<t:\${endsAtTimestamp}:f> IST)\\n**Hosted By:** <@\${cfg.hostId}>\\n**Winners:** \${cfg.winners}\\n\\nClick the button below to enter!\`)
            .setColor(accentColor)
            .setFooter({ text: '0 Entries' })
            .setTimestamp(new Date(endsAt));

          const joinButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('gw_join')
              .setLabel('Join')
              .setStyle(ButtonStyle.Primary)
              .setEmoji(EMOJI_JOIN)
          );

          await interaction.message.delete().catch(() => null);

          const message = await interaction.channel.send({ embeds: [gwEmbed], components: [joinButton] });

          db.saveGiveaway(message.id, {
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
            hostId: cfg.hostId,
            prize: cfg.prize,
            winnersCount: cfg.winners,
            endsAt: endsAt,
            mode: cfg.mode,
            participants: []
          });

          gwManagers.delete(managerId);
          return;
        }
      }
`;

code = code.replace(injectionTarget, injectionTarget + "\n" + injectionCode);

const modalTarget = "if (interaction.isModalSubmit()) {";
const modalCode = `
      if (interaction.customId.startsWith('gw_setup_modal_')) {
        const { gwManagers, buildManagerContainer } = await import('../commands/giveaway.js');
        const ms = (await import('ms')).default;

        const managerId = interaction.customId.replace('gw_setup_modal_', '');
        const cfg = gwManagers.get(managerId);
        
        if (!cfg) return interaction.reply({ content: 'Session expired.', ephemeral: true });

        const prize = interaction.fields.getTextInputValue('prize');
        const duration = interaction.fields.getTextInputValue('duration');
        const winners = parseInt(interaction.fields.getTextInputValue('winners')) || 1;

        const durationMs = ms(duration);
        if (!durationMs || durationMs < 10000) {
          return interaction.reply({ content: 'Invalid duration. Examples: 10m, 1h, 1d.', ephemeral: true });
        }

        cfg.prize = prize;
        cfg.duration = duration;
        cfg.durationMs = durationMs;
        cfg.winners = Math.max(1, winners);

        gwManagers.set(managerId, cfg);
        return interaction.update({ components: [buildManagerContainer(managerId)], flags: 1 << 14 });
      }
`;

code = code.replace(modalTarget, modalTarget + "\n" + modalCode);

fs.writeFileSync('src/events/interactionCreate.js', code);
console.log("interactionCreate.js successfully injected!");
