import { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';

export function buildAutoReplyPreview(guild, trigger) {
  const config = db.getGuildConfig(guild.id);
  const accentHex = config.accentColor || '#5865F2';
  const accentInt = parseInt(accentHex.replace('#', ''), 16);

  const comps = [];

  // 1. Heading (Title) - 100% Optional
  if (trigger.heading && trigger.heading.trim()) {
    comps.push({ type: 10, content: `## **${trigger.heading.trim()}**` });
  }

  // 2. Content / Description (grey bold markdown) - 100% Optional
  const bodyText = (trigger.content || trigger.response || '').trim();
  if (bodyText) {
    if (comps.length > 0) comps.push({ type: 14, divider: true });
    const lines = bodyText.split('\n');
    const formatted = lines.map(line => {
      if (!line.trim()) return line;
      if (line.startsWith('-#')) return line;
      return `-# **${line}**`;
    }).join('\n');
    comps.push({ type: 10, content: formatted });
  }

  // 3. Attached GIF / Image (Media Gallery in CV2) - 100% Optional
  let mediaUrl = trigger.gif?.trim() || null;
  if (!mediaUrl && trigger.response && /^https?:\/\/[^\s]+?\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(trigger.response.trim())) {
    mediaUrl = trigger.response.trim();
  }
  if (mediaUrl) {
    if (comps.length > 0) comps.push({ type: 14, divider: true });
    comps.push({
      type: 12,
      items: [
        { media: { url: mediaUrl } }
      ]
    });
  }

  // 4. Footer - 100% Optional & Unique per Reply
  if (trigger.footer && trigger.footer.trim()) {
    if (comps.length > 0) comps.push({ type: 14, divider: true });
    comps.push({ type: 10, content: `-# **${trigger.footer.trim()}**` });
  }

  // Fallback if completely empty
  if (comps.length === 0) {
    comps.push({ type: 10, content: `-# **[Auto-Reply Triggered: \`${trigger.match}\`]**` });
  }

  return {
    type: 17,
    accent_color: accentInt,
    components: comps
  };
}

export function buildAutoReplyDashboard(guild, page = 0) {
  const triggers = db.getTriggers(guild.id);
  const config = db.getGuildConfig(guild.id);
  const accentHex = config.accentColor || '#5865F2';
  const accentInt = parseInt(accentHex.replace('#', ''), 16);

  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(triggers.length / itemsPerPage));
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const pageTriggers = triggers.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  let triggersContent = '-# • **No auto-replies configured yet.** Click **Create Auto-Reply** below to add one!';
  if (triggers.length > 0) {
    triggersContent = pageTriggers.map((t, idx) => {
      const globalIdx = currentPage * itemsPerPage + idx + 1;
      const rawContent = (t.content || t.response || '').trim();
      const contentSnippet = rawContent ? (rawContent.length > 50 ? rawContent.slice(0, 47) + '...' : rawContent).replace(/\n/g, ' ') : (t.gif ? '`Media Only`' : '`None`');
      const headingText = t.heading ? `\`${t.heading}\`` : '`None`';
      const footerText = t.footer ? `\`${t.footer}\`` : '`None`';
      const mediaText = t.gif ? '`<Attached>`' : '`None`';

      return (
        `-# • **[#${globalIdx}] Keyword:** \`${t.match}\`\n` +
        `-# • **Heading:** ${headingText} \u2022 **Footer:** ${footerText}\n` +
        `-# • **Content:** **${contentSnippet}** \u2022 **GIF:** ${mediaText}`
      );
    }).join('\n-# • ──────────────────────────────\n');
  }

  const containerComps = [
    {
      type: 10,
      content:
        `# Auto-Reply Manager\n` +
        `-# **__Server Keyword Auto-Responder Matrix__**\n\n` +
        `-# • **Total Active Replies:** **${triggers.length} configured**\n` +
        `-# • **Page:** **${currentPage + 1} of ${totalPages}**\n` +
        `-# • **Theme Accent:** **${accentHex}**\n` +
        `-# • **Format:** **Accent Borderless CV2 Container**\n` +
        `-# • **Customization:** **Heading, Content, GIF & Footer (All 100% Optional & Unique)**`
    },
    { type: 14, divider: true },
    {
      type: 10,
      content:
        `-# **__Active Auto-Replies List__**\n` +
        triggersContent
    },
    { type: 14, divider: true }
  ];

  // Action Row 1: Primary Controls
  const mainControls = [
    { type: 2, custom_id: 'ar_btn_create', label: 'Create Auto-Reply', style: 3 },
    { type: 2, custom_id: `ar_btn_refresh_${currentPage}`, label: 'Refresh', style: 2 },
    { type: 2, custom_id: 'ar_btn_test_modal', label: 'Test / Preview', style: 1 }
  ];
  if (triggers.length > 0) {
    mainControls.push({ type: 2, custom_id: 'ar_btn_clear_all', label: 'Clear All', style: 4 });
  }

  containerComps.push({
    type: 1,
    components: mainControls
  });

  // Action Row 2: Direct Remove Buttons for the items on this page (User explicitly requested remove buttons for them!)
  if (pageTriggers.length > 0) {
    const removeButtons = pageTriggers.slice(0, 5).map(t => ({
      type: 2,
      custom_id: `ar_btn_del_${encodeURIComponent(t.match)}`,
      label: `Remove: ${t.match.slice(0, 15)}`,
      style: 4
    }));

    containerComps.push({
      type: 1,
      components: removeButtons
    });
  }

  // Action Row 3: Pagination if multiple pages
  if (totalPages > 1) {
    containerComps.push({
      type: 1,
      components: [
        { type: 2, custom_id: `ar_page_${currentPage - 1}`, label: '◀ Prev', style: 2, disabled: currentPage === 0 },
        { type: 2, custom_id: 'ar_page_noop', label: `Page ${currentPage + 1} / ${totalPages}`, style: 2, disabled: true },
        { type: 2, custom_id: `ar_page_${currentPage + 1}`, label: 'Next ▶', style: 2, disabled: currentPage >= totalPages - 1 }
      ]
    });
  }

  // Action Row 4: Select Menu to Edit any trigger
  if (triggers.length > 0) {
    const editOptions = triggers.slice(0, 25).map(t => ({
      label: `Edit: ${t.match}`.slice(0, 100),
      value: t.match.slice(0, 100),
      description: (t.heading || t.content || 'Click to edit fields').slice(0, 100)
    }));

    containerComps.push({
      type: 1,
      components: [
        {
          type: 3,
          custom_id: 'ar_select_edit',
          placeholder: 'Select an Auto-Reply to Edit...',
          options: editOptions
        }
      ]
    });

    // Action Row 5: Quick Select Menu to Delete any trigger
    if (triggers.length > 5) {
      const deleteOptions = triggers.slice(0, 25).map(t => ({
        label: `Delete: ${t.match}`.slice(0, 100),
        value: t.match.slice(0, 100),
        description: `Delete trigger "${t.match}"`.slice(0, 100)
      }));

      containerComps.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: 'ar_select_delete',
            placeholder: 'Or Select any Auto-Reply to Remove...',
            options: deleteOptions
          }
        ]
      });
    }
  }

  containerComps.push({ type: 14, divider: true });
  containerComps.push({
    type: 10,
    content: '-# Athena Prime Defense Matrix • Auto-Reply Manager'
  });

  return {
    components: [{
      type: 17,
      accent_color: accentInt,
      components: containerComps
    }],
    flags: MessageFlags.IsComponentsV2
  };
}

export async function handleAutoReplyInteractions(interaction) {
  // 1. BUTTON INTERACTIONS
  if (interaction.isButton()) {
    // Direct Delete button for an item
    if (interaction.customId.startsWith('ar_btn_del_')) {
      const match = decodeURIComponent(interaction.customId.replace('ar_btn_del_', ''));
      db.removeTrigger(interaction.guild.id, match);
      const panel = buildAutoReplyDashboard(interaction.guild);
      return cv2.respond(interaction, panel, 7);
    }

    // Pagination
    if (interaction.customId.startsWith('ar_page_')) {
      const pageStr = interaction.customId.replace('ar_page_', '');
      const page = parseInt(pageStr, 10) || 0;
      const panel = buildAutoReplyDashboard(interaction.guild, page);
      return cv2.respond(interaction, panel, 7);
    }

    // Refresh
    if (interaction.customId.startsWith('ar_btn_refresh')) {
      const parts = interaction.customId.split('_');
      const page = parseInt(parts[3] || '0', 10) || 0;
      const panel = buildAutoReplyDashboard(interaction.guild, page);
      return cv2.respond(interaction, panel, 7);
    }

    // Clear All
    if (interaction.customId === 'ar_btn_clear_all') {
      db.clearTriggers(interaction.guild.id);
      const panel = buildAutoReplyDashboard(interaction.guild, 0);
      return cv2.respond(interaction, panel, 7);
    }

    // Test Modal Prompt
    if (interaction.customId === 'ar_btn_test_modal') {
      const modal = new ModalBuilder().setCustomId('ar_modal_test_input').setTitle('Test Auto-Reply');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_test_keyword')
            .setLabel('Keyword to Test')
            .setPlaceholder('Enter the trigger keyword to preview...')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    // Create Modal (Everything except keyword is 100% Optional!)
    if (interaction.customId === 'ar_btn_create') {
      const modal = new ModalBuilder().setCustomId('ar_modal_create').setTitle('Create Auto-Reply');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_keyword')
            .setLabel('Trigger Keyword (Required)')
            .setPlaceholder('e.g. foofwo, hello, rules')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_heading')
            .setLabel('Heading / Title (Optional)')
            .setPlaceholder('e.g. Server Welcome')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_content')
            .setLabel('Reply Message Content (Optional)')
            .setPlaceholder('Enter reply text here...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_gif')
            .setLabel('GIF / Image URL (Optional)')
            .setPlaceholder('e.g. https://media.tenor.com/... or image link')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_footer')
            .setLabel('Custom Unique Footer (Optional)')
            .setPlaceholder('e.g. Welcome to Editors Heaven')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );
      return interaction.showModal(modal);
    }
  }

  // 2. SELECT MENU INTERACTIONS
  if (interaction.isStringSelectMenu()) {
    // Select menu to edit
    if (interaction.customId === 'ar_select_edit') {
      const match = interaction.values[0];
      const trigger = db.getTrigger(interaction.guild.id, match);
      if (!trigger) {
        return interaction.reply({ content: 'Could not find the selected trigger.', flags: 64 });
      }

      const modal = new ModalBuilder()
        .setCustomId(`ar_modal_edit_${encodeURIComponent(match)}`)
        .setTitle(`Edit: ${match.slice(0, 30)}`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_keyword')
            .setLabel('Trigger Keyword')
            .setValue(trigger.match)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_heading')
            .setLabel('Heading / Title (Optional)')
            .setValue(trigger.heading || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_content')
            .setLabel('Reply Message Content (Optional)')
            .setValue(trigger.content || trigger.response || '')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_gif')
            .setLabel('GIF / Image URL (Optional)')
            .setValue(trigger.gif || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ar_footer')
            .setLabel('Custom Unique Footer (Optional)')
            .setValue(trigger.footer || '')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );
      return interaction.showModal(modal);
    }

    // Select menu to delete
    if (interaction.customId === 'ar_select_delete') {
      const match = interaction.values[0];
      db.removeTrigger(interaction.guild.id, match);
      const panel = buildAutoReplyDashboard(interaction.guild);
      return cv2.respond(interaction, panel, 7);
    }

    // Select menu to test / preview
    if (interaction.customId === 'ar_select_test') {
      const match = interaction.values[0];
      const trigger = db.getTrigger(interaction.guild.id, match);
      if (!trigger) {
        return interaction.reply({ content: 'Trigger not found.', flags: 64 });
      }
      const previewContainer = buildAutoReplyPreview(interaction.guild, trigger);
      return interaction.reply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
    }
  }

  // 3. MODAL SUBMIT INTERACTIONS
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'ar_modal_create') {
      const match = interaction.fields.getTextInputValue('ar_keyword').trim();
      const heading = interaction.fields.getTextInputValue('ar_heading').trim() || null;
      const content = interaction.fields.getTextInputValue('ar_content').trim() || null;
      const gif = interaction.fields.getTextInputValue('ar_gif').trim() || null;
      const footer = interaction.fields.getTextInputValue('ar_footer').trim() || null;

      db.setTrigger(interaction.guild.id, { match, heading, content, gif, footer });
      const panel = buildAutoReplyDashboard(interaction.guild);
      return cv2.respond(interaction, panel, 7);
    }

    if (interaction.customId.startsWith('ar_modal_edit_')) {
      const oldMatch = decodeURIComponent(interaction.customId.replace('ar_modal_edit_', ''));
      const newMatch = interaction.fields.getTextInputValue('ar_keyword').trim();
      const heading = interaction.fields.getTextInputValue('ar_heading').trim() || null;
      const content = interaction.fields.getTextInputValue('ar_content').trim() || null;
      const gif = interaction.fields.getTextInputValue('ar_gif').trim() || null;
      const footer = interaction.fields.getTextInputValue('ar_footer').trim() || null;

      if (oldMatch.toLowerCase() !== newMatch.toLowerCase()) {
        db.removeTrigger(interaction.guild.id, oldMatch);
      }
      db.setTrigger(interaction.guild.id, { match: newMatch, heading, content, gif, footer });

      const panel = buildAutoReplyDashboard(interaction.guild);
      return cv2.respond(interaction, panel, 7);
    }

    if (interaction.customId === 'ar_modal_test_input') {
      const match = interaction.fields.getTextInputValue('ar_test_keyword').trim();
      const trigger = db.getTrigger(interaction.guild.id, match);
      if (!trigger) {
        return interaction.reply({ content: `No auto-reply found matching keyword: \`${match}\`.`, flags: 64 });
      }
      const previewContainer = buildAutoReplyPreview(interaction.guild, trigger);
      return interaction.reply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
    }
  }
}

export const commands = [
  {
    name: 'autoreply',
    aliases: ['ar', 'trigger', 'customreply'],
    description: 'Interactive Auto-Reply Manager with list of set replies, remove buttons, and optional fields.',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [
      {
        name: 'dashboard',
        description: 'Open the interactive Auto-Reply Control Matrix',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'create',
        description: 'Create a new keyword auto-reply',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'keyword', description: 'Keyword to trigger the response', type: 3, required: true },
          { name: 'content', description: 'Body text of the auto-reply (optional)', type: 3, required: false },
          { name: 'heading', description: 'Title heading of the embed (optional)', type: 3, required: false },
          { name: 'gif', description: 'Direct image or GIF URL to attach (optional)', type: 3, required: false },
          { name: 'footer', description: 'Custom unique footer text (optional)', type: 3, required: false }
        ]
      },
      {
        name: 'edit',
        description: 'Edit a specific field of an existing auto-reply',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'keyword', description: 'Trigger keyword to edit', type: 3, required: true },
          {
            name: 'field',
            description: 'Field to edit',
            type: 3,
            required: true,
            choices: [
              { name: 'Heading', value: 'heading' },
              { name: 'Content', value: 'content' },
              { name: 'GIF / Media', value: 'gif' },
              { name: 'Footer', value: 'footer' }
            ]
          },
          { name: 'value', description: 'New value for the field', type: 3, required: true }
        ]
      },
      {
        name: 'remove',
        description: 'Remove an existing auto-reply',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'keyword', description: 'Keyword to remove', type: 3, required: true }
        ]
      },
      {
        name: 'test',
        description: 'Preview how an auto-reply looks in chat',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'keyword', description: 'Keyword to preview', type: 3, required: true }
        ]
      },
      {
        name: 'list',
        description: 'List all active auto-replies',
        type: 1 // SUB_COMMAND
      }
    ],

    async executePrefix(message, args) {
      if (args.length === 0) {
        const payload = buildAutoReplyDashboard(message.guild);
        return message.reply(payload);
      }

      const sub = args[0].toLowerCase();

      if (sub === 'add' || sub === 'create') {
        const rest = args.slice(1).join(' ');
        const parts = rest.split('|').map(p => p.trim());
        if (parts.length === 0 || !parts[0]) {
          return message.reply(cv2.warn(
            'Usage Guide',
            '`!ar add <keyword> | [content] | [heading] | [gif] | [footer]`\n\n' +
            '**Note:** Heading, content, GIF, and footer are 100% optional!\n' +
            '-# • `!ar add foofwo | Welcome to our server!`\n' +
            '-# • `!ar add foofwo | Welcome | Greeting | https://media.tenor.com/... | Custom Footer`'
          ));
        }

        const match = parts[0];
        const content = parts[1] || null;
        const heading = parts[2] || null;
        let gif = parts[3] || null;
        const footer = parts[4] || null;

        if (message.attachments.size > 0 && !gif) {
          gif = message.attachments.first().url;
        }

        db.setTrigger(message.guild.id, { match, heading, content, gif, footer });
        return message.reply(cv2.success('Auto-Reply Created', `Whenever someone types \`${match}\`, I will reply with an accent borderless CV2 embed.`));
      }

      if (sub === 'edit') {
        if (args.length < 4) {
          return message.reply(cv2.warn(
            'Usage Guide',
            '`!ar edit <keyword> <heading|content|gif|footer> <new_value>`\n\n' +
            '**Examples:**\n' +
            '-# • `!ar edit foofwo heading Announcement`\n' +
            '-# • `!ar edit foofwo content Check out our channels!`\n' +
            '-# • `!ar edit foofwo gif https://media.tenor.com/...`\n' +
            '-# • `!ar edit foofwo footer Server Bot Matrix`'
          ));
        }

        const keyword = args[1];
        const field = args[2].toLowerCase();
        const value = args.slice(3).join(' ');

        const validFields = ['heading', 'content', 'gif', 'footer'];
        if (!validFields.includes(field)) {
          return message.reply(cv2.warn('Invalid Field', `Field must be one of: \`${validFields.join(', ')}\``));
        }

        const success = db.updateTrigger(message.guild.id, keyword, { [field]: value });
        if (success) {
          return message.reply(cv2.success('Auto-Reply Updated', `Updated **${field}** for keyword \`${keyword}\`.`));
        } else {
          return message.reply(cv2.warn('Not Found', `No auto-reply found for keyword \`${keyword}\`.`));
        }
      }

      if (sub === 'remove' || sub === 'delete' || sub === 'del') {
        const match = args.slice(1).join(' ').trim();
        if (!match) return message.reply(cv2.warn('Usage Error', '`!ar remove <keyword>`'));

        const success = db.removeTrigger(message.guild.id, match);
        if (success) {
          return message.reply(cv2.success('Auto-Reply Removed', `Deleted auto-reply for \`${match}\`.`));
        } else {
          return message.reply(cv2.warn('Not Found', `No auto-reply found matching \`${match}\`.`));
        }
      }

      if (sub === 'clear' || sub === 'clearall') {
        db.clearTriggers(message.guild.id);
        return message.reply(cv2.success('Auto-Replies Cleared', 'All auto-replies have been removed from this server.'));
      }

      if (sub === 'test' || sub === 'preview') {
        const match = args.slice(1).join(' ').trim();
        if (!match) return message.reply(cv2.warn('Usage Error', '`!ar test <keyword>`'));

        const trigger = db.getTrigger(message.guild.id, match);
        if (!trigger) {
          return message.reply(cv2.warn('Not Found', `No auto-reply found matching \`${match}\`.`));
        }

        const previewContainer = buildAutoReplyPreview(message.guild, trigger);
        return message.reply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      }

      if (sub === 'list' || sub === 'dashboard' || sub === 'manager') {
        const payload = buildAutoReplyDashboard(message.guild);
        return message.reply(payload);
      }

      // Default fallback: open dashboard
      const payload = buildAutoReplyDashboard(message.guild);
      return message.reply(payload);
    },

    async executeSlash(interaction) {
      const sub = interaction.options.getSubcommand();

      if (sub === 'dashboard' || sub === 'list') {
        const payload = buildAutoReplyDashboard(interaction.guild);
        return interaction.reply({ ...payload });
      }

      if (sub === 'create') {
        const match = interaction.options.getString('keyword').trim();
        const content = interaction.options.getString('content') ? interaction.options.getString('content').trim() : null;
        const heading = interaction.options.getString('heading') ? interaction.options.getString('heading').trim() : null;
        const gif = interaction.options.getString('gif') ? interaction.options.getString('gif').trim() : null;
        const footer = interaction.options.getString('footer') ? interaction.options.getString('footer').trim() : null;

        db.setTrigger(interaction.guild.id, { match, heading, content, gif, footer });
        return interaction.reply(cv2.success('Auto-Reply Created', `Whenever someone types \`${match}\`, I will reply with an accent borderless CV2 embed.`));
      }

      if (sub === 'edit') {
        const keyword = interaction.options.getString('keyword').trim();
        const field = interaction.options.getString('field');
        const value = interaction.options.getString('value').trim();

        const success = db.updateTrigger(interaction.guild.id, keyword, { [field]: value });
        if (success) {
          return interaction.reply(cv2.success('Auto-Reply Updated', `Updated **${field}** for keyword \`${keyword}\`.`));
        } else {
          return interaction.reply(cv2.warn('Not Found', `No auto-reply found for keyword \`${keyword}\`.`));
        }
      }

      if (sub === 'remove') {
        const keyword = interaction.options.getString('keyword').trim();
        const success = db.removeTrigger(interaction.guild.id, keyword);
        if (success) {
          return interaction.reply(cv2.success('Auto-Reply Removed', `Deleted auto-reply for \`${keyword}\`.`));
        } else {
          return interaction.reply(cv2.warn('Not Found', `No auto-reply found matching \`${keyword}\`.`));
        }
      }

      if (sub === 'test') {
        const keyword = interaction.options.getString('keyword').trim();
        const trigger = db.getTrigger(interaction.guild.id, keyword);
        if (!trigger) {
          return interaction.reply(cv2.warn('Not Found', `No auto-reply found matching \`${keyword}\`.`));
        }

        const previewContainer = buildAutoReplyPreview(interaction.guild, trigger);
        return interaction.reply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      }
    }
  }
];
