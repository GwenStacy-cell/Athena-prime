import { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { isBotOwnerSync } from '../utils/helpers.js';
import { resolvePlaceholders } from './welcome.js';
import { resolveMediaUrl, isPinterestUrl } from '../utils/pinterest.js';

export function buildAutoReplyPreview(guild, trigger, userOrMember = null) {
  const config = db.getGuildConfig(guild.id);
  const accentHex = config.accentColor || '#5865F2';
  const accentInt = parseInt(accentHex.replace('#', ''), 16);

  const resolve = (txt) => {
    if (!txt || typeof txt !== 'string') return '';
    return userOrMember ? resolvePlaceholders(txt, userOrMember, guild) : txt;
  };

  const comps = [];

  // 1. Heading (Title) - 100% Optional
  if (trigger.heading && trigger.heading.trim()) {
    comps.push({ type: 10, content: `## **${resolve(trigger.heading.trim())}**` });
  }

  // 2. Content / Description (grey bold markdown) - 100% Optional
  const rawBody = (trigger.content || trigger.response || '').trim();
  const bodyText = resolve(rawBody);
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
    mediaUrl = resolve(mediaUrl);
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
    comps.push({ type: 10, content: `-# **${resolve(trigger.footer.trim())}**` });
  } else if (trigger.isGlobal) {
    if (comps.length > 0) comps.push({ type: 14, divider: true });
    comps.push({ type: 10, content: `-# **Global Network Auto-Reply • Athena Prime**` });
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

export function makeAccentResponse(guild, title, description, isSuccess = true) {
  const config = db.getGuildConfig(guild.id);
  const accentHex = config.accentColor || '#5865F2';
  const accentInt = parseInt(accentHex.replace('#', ''), 16);
  const formattedTitle = isSuccess && !title.includes('1557841381630681106') ? `${title} | <a:atheNATICK:1557841381630681106>` : title;

  const bodyLines = description.split('\n').map(l => {
    if (!l.trim()) return l;
    if (l.startsWith('-#') || l.startsWith('>')) return l;
    return `-# **${l}**`;
  }).join('\n');

  return {
    components: [{
      type: 17,
      accent_color: accentInt,
      components: [
        { type: 10, content: `## **${formattedTitle}**` },
        { type: 14, divider: true },
        { type: 10, content: bodyLines },
        { type: 14, divider: true },
        { type: 10, content: '-# **Athena Prime Defense Matrix \u2022 Auto-Reply**' }
      ]
    }],
    flags: MessageFlags.IsComponentsV2
  };
}

export function buildAutoReplyDashboard(guild, page = 0) {
  const triggers = db.getAutoReplies(guild.id);
  const globalTriggers = db.getGlobalTriggers();
  const config = db.getGuildConfig(guild.id);
  const accentHex = config.accentColor || '#5865F2';
  const accentInt = parseInt(accentHex.replace('#', ''), 16);

  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(triggers.length / itemsPerPage));
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const pageTriggers = triggers.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  let triggersContent = '-# • **No server auto-replies configured yet.** Click **Create Auto-Reply** below to add one!';
  if (triggers.length > 0) {
    triggersContent = pageTriggers.map((t, idx) => {
      const globalIdx = currentPage * itemsPerPage + idx + 1;
      const rawContent = (t.content || t.response || '').trim();
      const contentSnippet = rawContent ? (rawContent.length > 50 ? rawContent.slice(0, 47) + '...' : rawContent).replace(/\n/g, ' ') : (t.gif ? 'None (Media Only)' : 'None');
      const headingText = t.heading ? `\`${t.heading}\`` : 'None';
      const footerText = t.footer ? `\`${t.footer}\`` : 'None';
      const mediaText = t.gif ? 'Attached' : 'None';

      return (
        `-# • **[#${globalIdx}] Keyword:** \`${t.match}\`\n` +
        `-# • **Heading:** **${headingText}** \u2022 **Footer:** **${footerText}**\n` +
        `-# • **Content:** **${contentSnippet}** \u2022 **GIF:** **${mediaText}**`
      );
    }).join('\n-# • ──────────────────────────────\n');
  }

  const containerComps = [
    {
      type: 10,
      content:
        `# Auto-Reply Manager\n` +
        `-# **__Server Keyword Auto-Responder Matrix__**\n\n` +
        `-# • **Total Server Replies:** **${triggers.length} configured**\n` +
        `-# • **Global Network Replies:** **${globalTriggers.length} configured** -# *(Bot Owner Only)*\n` +
        `-# • **Page:** **${currentPage + 1} of ${totalPages}**\n` +
        `-# • **Theme Accent:** **${accentHex}**\n` +
        `-# • **Format:** **Accent Borderless CV2 Container**\n` +
        `-# • **Customization:** **Heading, Content, GIF & Footer (All 100% Optional & Unique)**`
    },
    { type: 14, divider: true },
    {
      type: 10,
      content:
        `-# **__Active Server Auto-Replies List__**\n` +
        triggersContent
    },
    { type: 14, divider: true }
  ];

  // Action Row 1: Primary Controls
  const mainControls = [
    { type: 2, custom_id: 'ar_btn_create', label: 'Create Auto-Reply', style: 3 },
    { type: 2, custom_id: 'ar_btn_global', label: 'Global Reply (Owner Only)', style: 1 },
    { type: 2, custom_id: `ar_btn_refresh_${currentPage}`, label: 'Refresh', style: 2 },
    { type: 2, custom_id: 'ar_btn_test_modal', label: 'Test / Preview', style: 2 }
  ];
  if (triggers.length > 0) {
    mainControls.push({ type: 2, custom_id: 'ar_btn_clear_all', label: 'Clear All', style: 4 });
  }

  containerComps.push({
    type: 1,
    components: mainControls
  });

  // Action Row 2: Direct Remove Buttons for the items on this page
  if (pageTriggers.length > 0) {
    const removeButtons = pageTriggers.slice(0, 5).map(t => {
      const label = t.match.length > 15 ? t.match.slice(0, 12) + '...' : t.match;
      return {
        type: 2,
        custom_id: `ar_btn_del_${Buffer.from(t.match).toString('base64url')}`,
        label: `Remove: ${label}`,
        style: 4
      };
    });

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
        { type: 2, custom_id: `ar_page_${currentPage - 1}`, label: 'Prev', style: 2, disabled: currentPage === 0 },
        { type: 2, custom_id: 'ar_page_noop', label: `Page ${currentPage + 1} / ${totalPages}`, style: 2, disabled: true },
        { type: 2, custom_id: `ar_page_${currentPage + 1}`, label: 'Next', style: 2, disabled: currentPage >= totalPages - 1 }
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

export function buildGlobalAutoReplyDashboard(guild, page = 0) {
  const globalTriggers = db.getGlobalTriggers();
  const config = db.getGuildConfig(guild.id);
  const accentHex = config.accentColor || '#5865F2';
  const accentInt = parseInt(accentHex.replace('#', ''), 16);

  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(globalTriggers.length / itemsPerPage));
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const pageTriggers = globalTriggers.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  let triggersContent = '-# • **No global auto-replies configured yet.** Click **Create Global Reply** below to add one across all servers!';
  if (globalTriggers.length > 0) {
    triggersContent = pageTriggers.map((t, idx) => {
      const globalIdx = currentPage * itemsPerPage + idx + 1;
      const rawContent = (t.content || t.response || '').trim();
      const contentSnippet = rawContent ? (rawContent.length > 50 ? rawContent.slice(0, 47) + '...' : rawContent).replace(/\n/g, ' ') : (t.gif ? 'None (Media Only)' : 'None');
      const headingText = t.heading ? `\`${t.heading}\`` : 'None';
      const footerText = t.footer ? `\`${t.footer}\`` : 'None';
      const mediaText = t.gif ? 'Attached' : 'None';

      return (
        `-# • **[#${globalIdx}] Global Keyword:** \`${t.match}\`\n` +
        `-# • **Heading:** **${headingText}** \u2022 **Footer:** **${footerText}**\n` +
        `-# • **Content:** **${contentSnippet}** \u2022 **GIF:** **${mediaText}**`
      );
    }).join('\n-# • ──────────────────────────────\n');
  }

  const containerComps = [
    {
      type: 10,
      content:
        `# Global Auto-Reply Manager\n` +
        `-# **__All-Servers Network Auto-Responder Matrix (Bot Owner Only)__**\n\n` +
        `-# • **Total Global Replies:** **${globalTriggers.length} configured**\n` +
        `-# • **Page:** **${currentPage + 1} of ${totalPages}**\n` +
        `-# • **Network Scope:** **Active across ALL servers joined by Athena Prime**\n` +
        `-# • **Access Level:** **Bot Owner Exclusive**\n` +
        `-# • **Customization:** **Heading, Content, GIF & Footer (All 100% Optional & Unique)**`
    },
    { type: 14, divider: true },
    {
      type: 10,
      content:
        `-# **__Active Global Network Replies List__**\n` +
        triggersContent
    },
    { type: 14, divider: true }
  ];

  // Action Row 1: Primary Controls
  const mainControls = [
    { type: 2, custom_id: 'ar_btn_global_create', label: 'Create Global Reply', style: 3 },
    { type: 2, custom_id: 'ar_btn_switch_server', label: 'Server Replies', style: 1 },
    { type: 2, custom_id: `ar_btn_global_refresh_${currentPage}`, label: 'Refresh', style: 2 },
    { type: 2, custom_id: 'ar_btn_global_test_modal', label: 'Test / Preview', style: 2 }
  ];
  if (globalTriggers.length > 0) {
    mainControls.push({ type: 2, custom_id: 'ar_btn_global_clear_all', label: 'Clear All Global', style: 4 });
  }

  containerComps.push({
    type: 1,
    components: mainControls
  });

  // Action Row 2: Direct Remove Buttons
  if (pageTriggers.length > 0) {
    const removeButtons = pageTriggers.slice(0, 5).map(t => {
      const label = t.match.length > 15 ? t.match.slice(0, 12) + '...' : t.match;
      return {
        type: 2,
        custom_id: `ar_btn_global_del_${Buffer.from(t.match).toString('base64url')}`,
        label: `Remove: ${label}`,
        style: 4
      };
    });

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
        { type: 2, custom_id: `ar_page_global_${currentPage - 1}`, label: 'Prev', style: 2, disabled: currentPage === 0 },
        { type: 2, custom_id: 'ar_page_global_noop', label: `Page ${currentPage + 1} / ${totalPages}`, style: 2, disabled: true },
        { type: 2, custom_id: `ar_page_global_${currentPage + 1}`, label: 'Next', style: 2, disabled: currentPage >= totalPages - 1 }
      ]
    });
  }

  // Action Row 4: Select Menu to Edit any global trigger
  if (globalTriggers.length > 0) {
    const editOptions = globalTriggers.slice(0, 25).map(t => ({
      label: `Edit Global: ${t.match}`.slice(0, 100),
      value: t.match.slice(0, 100),
      description: (t.heading || t.content || 'Click to edit fields').slice(0, 100)
    }));

    containerComps.push({
      type: 1,
      components: [
        {
          type: 3,
          custom_id: 'ar_select_global_edit',
          placeholder: 'Select a Global Auto-Reply to Edit...',
          options: editOptions
        }
      ]
    });

    // Action Row 5: Quick Select Menu to Delete any global trigger
    if (globalTriggers.length > 5) {
      const deleteOptions = globalTriggers.slice(0, 25).map(t => ({
        label: `Delete Global: ${t.match}`.slice(0, 100),
        value: t.match.slice(0, 100),
        description: `Delete global trigger "${t.match}"`.slice(0, 100)
      }));

      containerComps.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: 'ar_select_global_delete',
            placeholder: 'Or Select any Global Auto-Reply to Remove...',
            options: deleteOptions
          }
        ]
      });
    }
  }

  containerComps.push({ type: 14, divider: true });
  containerComps.push({
    type: 10,
    content: '-# Athena Prime Defense Matrix • Global Auto-Reply (Owner Only)'
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
  try {
    // 1. BUTTON INTERACTIONS
    if (interaction.isButton()) {
      // Direct Delete button for an item
      if (interaction.customId.startsWith('ar_btn_del_')) {
        const raw = interaction.customId.replace('ar_btn_del_', '');
        let match;
        try {
          match = Buffer.from(raw, 'base64url').toString('utf8');
        } catch {
          match = decodeURIComponent(raw);
        }
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
        db.clearAutoReplies(interaction.guild.id);
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

      // Global dashboard toggle (Bot Owner only)
      if (interaction.customId === 'ar_btn_global') {
        if (!isBotOwnerSync(interaction.user.id)) {
          return interaction.reply({
            content: '-# **Access Denied:** The **Global Auto-Reply** button is restricted to the **Bot Owner only**.\n-# **Note:** Global replies trigger across every server where Athena Prime is present.',
            flags: 64
          });
        }
        const panel = buildGlobalAutoReplyDashboard(interaction.guild, 0);
        return cv2.respond(interaction, panel, 7);
      }

      // Switch back to Server dashboard
      if (interaction.customId === 'ar_btn_switch_server') {
        const panel = buildAutoReplyDashboard(interaction.guild, 0);
        return cv2.respond(interaction, panel, 7);
      }

      // Global Create Modal (Bot Owner only)
      if (interaction.customId === 'ar_btn_global_create') {
        if (!isBotOwnerSync(interaction.user.id)) {
          return interaction.reply({ content: '-# **Access Denied:** Global auto-replies are restricted to the **Bot Owner only**.', flags: 64 });
        }
        const modal = new ModalBuilder().setCustomId('ar_modal_global_create').setTitle('Create Global Auto-Reply (All Servers)');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ar_keyword').setLabel('Global Trigger Keyword (Required)').setPlaceholder('e.g. owner, support, help').setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ar_heading').setLabel('Heading / Title (Optional)').setPlaceholder('e.g. Official Network Notice').setStyle(TextInputStyle.Short).setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ar_content').setLabel('Reply Message Content (Optional)').setPlaceholder('Enter message content here...').setStyle(TextInputStyle.Paragraph).setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ar_gif').setLabel('GIF / Image URL (Optional)').setPlaceholder('e.g. https://media.tenor.com/...').setStyle(TextInputStyle.Short).setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ar_footer').setLabel('Custom Unique Footer (Optional)').setPlaceholder('e.g. Athena Prime Global Matrix').setStyle(TextInputStyle.Short).setRequired(false)
          )
        );
        return interaction.showModal(modal);
      }

      // Global Direct Delete button
      if (interaction.customId.startsWith('ar_btn_global_del_')) {
        if (!isBotOwnerSync(interaction.user.id)) {
          return interaction.reply({ content: '-# **Access Denied:** Global auto-replies are restricted to the **Bot Owner only**.', flags: 64 });
        }
        const raw = interaction.customId.replace('ar_btn_global_del_', '');
        let match;
        try {
          match = Buffer.from(raw, 'base64url').toString('utf8');
        } catch {
          match = decodeURIComponent(raw);
        }
        db.removeGlobalTrigger(match);
        const panel = buildGlobalAutoReplyDashboard(interaction.guild, 0);
        return cv2.respond(interaction, panel, 7);
      }

      // Global Pagination
      if (interaction.customId.startsWith('ar_page_global_')) {
        const pageStr = interaction.customId.replace('ar_page_global_', '');
        const page = parseInt(pageStr, 10) || 0;
        const panel = buildGlobalAutoReplyDashboard(interaction.guild, page);
        return cv2.respond(interaction, panel, 7);
      }

      // Global Refresh
      if (interaction.customId.startsWith('ar_btn_global_refresh')) {
        const parts = interaction.customId.split('_');
        const page = parseInt(parts[4] || '0', 10) || 0;
        const panel = buildGlobalAutoReplyDashboard(interaction.guild, page);
        return cv2.respond(interaction, panel, 7);
      }

      // Global Clear All
      if (interaction.customId === 'ar_btn_global_clear_all') {
        if (!isBotOwnerSync(interaction.user.id)) {
          return interaction.reply({ content: '-# **Access Denied:** Global auto-replies are restricted to the **Bot Owner only**.', flags: 64 });
        }
        db.clearGlobalTriggers();
        const panel = buildGlobalAutoReplyDashboard(interaction.guild, 0);
        return cv2.respond(interaction, panel, 7);
      }

      // Global Test Modal Prompt
      if (interaction.customId === 'ar_btn_global_test_modal') {
        const modal = new ModalBuilder().setCustomId('ar_modal_global_test_input').setTitle('Test Global Auto-Reply');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ar_test_keyword')
              .setLabel('Global Keyword to Test')
              .setPlaceholder('Enter the global trigger keyword to preview...')
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
          .setCustomId(`ar_modal_edit_${Buffer.from(match).toString('base64url')}`)
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

      // Global Select menu to edit
      if (interaction.customId === 'ar_select_global_edit') {
        if (!isBotOwnerSync(interaction.user.id)) {
          return interaction.reply({ content: '-# **Access Denied:** Global auto-replies are restricted to the **Bot Owner only**.', flags: 64 });
        }
        const match = interaction.values[0];
        const trigger = db.getGlobalTrigger(match);
        if (!trigger) {
          return interaction.reply({ content: 'Could not find the selected global trigger.', flags: 64 });
        }

        const modal = new ModalBuilder()
          .setCustomId(`ar_modal_global_edit_${Buffer.from(match).toString('base64url')}`)
          .setTitle(`Edit Global: ${match.slice(0, 30)}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ar_keyword').setLabel('Global Trigger Keyword').setValue(trigger.match).setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ar_heading').setLabel('Heading / Title (Optional)').setValue(trigger.heading || '').setStyle(TextInputStyle.Short).setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ar_content').setLabel('Reply Message Content (Optional)').setValue(trigger.content || trigger.response || '').setStyle(TextInputStyle.Paragraph).setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ar_gif').setLabel('GIF / Image URL (Optional)').setValue(trigger.gif || '').setStyle(TextInputStyle.Short).setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ar_footer').setLabel('Custom Unique Footer (Optional)').setValue(trigger.footer || '').setStyle(TextInputStyle.Short).setRequired(false)
          )
        );
        return interaction.showModal(modal);
      }

      // Global Select menu to delete
      if (interaction.customId === 'ar_select_global_delete') {
        if (!isBotOwnerSync(interaction.user.id)) {
          return interaction.reply({ content: '-# **Access Denied:** Global auto-replies are restricted to the **Bot Owner only**.', flags: 64 });
        }
        const match = interaction.values[0];
        db.removeGlobalTrigger(match);
        const panel = buildGlobalAutoReplyDashboard(interaction.guild);
        return cv2.respond(interaction, panel, 7);
      }
    }

    // 3. MODAL SUBMIT INTERACTIONS
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'ar_modal_create') {
        const match = interaction.fields.getTextInputValue('ar_keyword').trim();
        const existingTrigger = db.getTriggerOnly(interaction.guild.id, match);
        if (existingTrigger) {
          return interaction.reply({
            content: `-# **Conflict Detected:** A Trigger (\`!trigger\`) is already active for \`${match}\` in this server.\n-# **Sync Policy:** You can use only one system for this keyword. Remove the existing trigger first in order to set up an Auto-Reply.`,
            flags: 64
          });
        }
        const heading = interaction.fields.getTextInputValue('ar_heading').trim() || null;
        const content = interaction.fields.getTextInputValue('ar_content').trim() || null;
        let gif = interaction.fields.getTextInputValue('ar_gif').trim() || null;
        if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
        const footer = interaction.fields.getTextInputValue('ar_footer').trim() || null;

        db.setTrigger(interaction.guild.id, { match, heading, content, gif, footer, type: 'ar' });
        const panel = buildAutoReplyDashboard(interaction.guild);
        return cv2.respond(interaction, panel, 7);
      }

      if (interaction.customId === 'ar_modal_global_create') {
        if (!isBotOwnerSync(interaction.user.id)) {
          return interaction.reply({ content: '-# **Access Denied:** Global auto-replies are restricted to the **Bot Owner only**.', flags: 64 });
        }
        const match = interaction.fields.getTextInputValue('ar_keyword').trim();
        const heading = interaction.fields.getTextInputValue('ar_heading').trim() || null;
        const content = interaction.fields.getTextInputValue('ar_content').trim() || null;
        let gif = interaction.fields.getTextInputValue('ar_gif').trim() || null;
        if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
        const footer = interaction.fields.getTextInputValue('ar_footer').trim() || null;

        db.setGlobalTrigger({ match, heading, content, gif, footer });
        const panel = buildGlobalAutoReplyDashboard(interaction.guild);
        return cv2.respond(interaction, panel, 7);
      }

      if (interaction.customId.startsWith('ar_modal_edit_')) {
        const raw = interaction.customId.replace('ar_modal_edit_', '');
        let oldMatch;
        try {
          oldMatch = Buffer.from(raw, 'base64url').toString('utf8');
        } catch {
          oldMatch = decodeURIComponent(raw);
        }
        const newMatch = interaction.fields.getTextInputValue('ar_keyword').trim();
        const heading = interaction.fields.getTextInputValue('ar_heading').trim() || null;
        const content = interaction.fields.getTextInputValue('ar_content').trim() || null;
        let gif = interaction.fields.getTextInputValue('ar_gif').trim() || null;
        if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
        const footer = interaction.fields.getTextInputValue('ar_footer').trim() || null;

        if (oldMatch.toLowerCase() !== newMatch.toLowerCase()) {
          db.removeTrigger(interaction.guild.id, oldMatch);
        }
        db.setTrigger(interaction.guild.id, { match: newMatch, heading, content, gif, footer });

        const panel = buildAutoReplyDashboard(interaction.guild);
        return cv2.respond(interaction, panel, 7);
      }

      if (interaction.customId.startsWith('ar_modal_global_edit_')) {
        if (!isBotOwnerSync(interaction.user.id)) {
          return interaction.reply({ content: '-# **Access Denied:** Global auto-replies are restricted to the **Bot Owner only**.', flags: 64 });
        }
        const raw = interaction.customId.replace('ar_modal_global_edit_', '');
        let oldMatch;
        try {
          oldMatch = Buffer.from(raw, 'base64url').toString('utf8');
        } catch {
          oldMatch = decodeURIComponent(raw);
        }
        const newMatch = interaction.fields.getTextInputValue('ar_keyword').trim();
        const heading = interaction.fields.getTextInputValue('ar_heading').trim() || null;
        const content = interaction.fields.getTextInputValue('ar_content').trim() || null;
        let gif = interaction.fields.getTextInputValue('ar_gif').trim() || null;
        if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
        const footer = interaction.fields.getTextInputValue('ar_footer').trim() || null;

        if (oldMatch.toLowerCase() !== newMatch.toLowerCase()) {
          db.removeGlobalTrigger(oldMatch);
        }
        db.setGlobalTrigger({ match: newMatch, heading, content, gif, footer });

        const panel = buildGlobalAutoReplyDashboard(interaction.guild);
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

      if (interaction.customId === 'ar_modal_global_test_input') {
        const match = interaction.fields.getTextInputValue('ar_test_keyword').trim();
        const trigger = db.getGlobalTrigger(match);
        if (!trigger) {
          return interaction.reply({ content: `No global auto-reply found matching keyword: \`${match}\`.`, flags: 64 });
        }
        const previewContainer = buildAutoReplyPreview(interaction.guild, trigger);
        return interaction.reply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      }
    }
  } catch (err) {
    console.error('[AutoReply Manager] Interaction error:', err);
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: 'An error occurred while handling the auto-reply action.', flags: 64 }).catch(() => null);
    }
  }
}

// ==========================================
// TRIGGER MATRIX & CONFLICT RESOLUTION
// ==========================================
export const pendingTriggerConflicts = new Map();

export function canManageTriggers(guild, userOrMember) {
  if (!guild || !userOrMember) return false;
  const userId = userOrMember.id || userOrMember;
  if (isBotOwnerSync(userId)) return true;
  if (guild.ownerId === userId) return true;
  if (db.isExtraOwner(guild.id, userId)) return true;
  const member = guild.members.cache.get(userId) || (userOrMember.permissions ? userOrMember : null);
  if (member?.permissions?.has(PermissionFlagsBits.ManageGuild) || member?.permissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  return false;
}

export function buildConflictPromptPayload(guild, confKey, conf) {
  const config = db.getGuildConfig(guild.id);
  const accentHex = config.accentColor || '#5865F2';
  const accentInt = parseInt(accentHex.replace('#', ''), 16);

  let title = 'Trigger Sync Conflict';
  let body = '';
  const buttons = [];

  if (conf.type === 'global') {
    title = 'Global Auto-Reply Active';
    body =
      `A **Global Auto-Reply** set by the Bot Owner is currently active for keyword \`${conf.keyword}\` across all Athena Prime servers.\n\n` +
      `> -# • **Active Scope:** Global Network Auto-Reply\n` +
      `> -# • **Question:** Should I disable the global auto-reply **only for this server** in order to set a custom trigger for this server alone?\n` +
      `> -# • **Impact:** Other servers will continue using the global auto-reply uninterrupted.`;

    buttons.push(
      { type: 2, custom_id: `trig_conf_global_${confKey}`, label: 'Disable Global & Set Trigger', style: 3 },
      { type: 2, custom_id: `trig_conf_cancel_${confKey}`, label: 'Cancel', style: 2 }
    );
  } else if (conf.type === 'ar') {
    title = 'Auto-Reply Already Configured';
    body =
      `You can use only one system for this keyword! An Auto-Reply (\`!ar\`) is already configured for \`${conf.keyword}\` in this server.\n\n` +
      `> -# • **Active System:** \`!autoreply\` / \`!ar\`\n` +
      `> -# • **Sync Policy:** To set a Trigger for this keyword, the Auto-Reply must be replaced or removed.\n` +
      `> -# • **Question:** Would you like to remove the existing \`!ar\` setup and set this Trigger instead?`;

    buttons.push(
      { type: 2, custom_id: `trig_conf_replace_ar_${confKey}`, label: 'Replace !ar & Set Trigger', style: 4 },
      { type: 2, custom_id: `trig_conf_cancel_${confKey}`, label: 'Cancel', style: 2 }
    );
  } else if (conf.type === 'both') {
    title = 'Multiple Conflicts Detected';
    body =
      `Both a local Auto-Reply (\`!ar\`) and an active Global Auto-Reply exist for \`${conf.keyword}\`.\n\n` +
      `> -# • **Active Systems:** Local \`!ar\` + Global Network Reply\n` +
      `> -# • **Question:** Would you like to replace the local \`!ar\` and disable the global reply for this server alone to activate this Trigger?`;

    buttons.push(
      { type: 2, custom_id: `trig_conf_both_${confKey}`, label: 'Replace !ar, Disable Global & Set Trigger', style: 3 },
      { type: 2, custom_id: `trig_conf_cancel_${confKey}`, label: 'Cancel', style: 2 }
    );
  }

  return {
    components: [{
      type: 17,
      accent_color: accentInt,
      components: [
        { type: 10, content: `## **${title}**` },
        { type: 14, divider: true },
        { type: 10, content: body },
        { type: 14, divider: true },
        {
          type: 1,
          components: buttons
        },
        { type: 14, divider: true },
        { type: 10, content: '-# Athena Prime Defense Matrix • Trigger Sync System' }
      ]
    }],
    flags: MessageFlags.IsComponentsV2
  };
}

export function buildTriggerDashboard(guild, page = 0) {
  const triggers = db.getTriggersOnly(guild.id);
  const globalTriggers = db.getGlobalTriggers();
  const config = db.getGuildConfig(guild.id);
  const accentHex = config.accentColor || '#5865F2';
  const accentInt = parseInt(accentHex.replace('#', ''), 16);

  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(triggers.length / itemsPerPage));
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const pageTriggers = triggers.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  let triggersContent = '-# • **No server triggers configured yet.** Click **Create Trigger** below to add one!';
  if (triggers.length > 0) {
    triggersContent = pageTriggers.map((t, idx) => {
      const globalIdx = currentPage * itemsPerPage + idx + 1;
      const rawContent = (t.content || t.response || '').trim();
      const contentSnippet = rawContent ? (rawContent.length > 50 ? rawContent.slice(0, 47) + '...' : rawContent).replace(/\n/g, ' ') : (t.gif ? 'None (Media Only)' : 'None');
      const headingText = t.heading ? `\`${t.heading}\`` : 'None';
      const footerText = t.footer ? `\`${t.footer}\`` : 'None';
      const mediaText = t.gif ? 'Attached' : 'None';

      return (
        `-# • **[#${globalIdx}] Trigger Word:** \`${t.match}\`\n` +
        `-# • **Response:** **${contentSnippet}**\n` +
        `-# • **Heading:** **${headingText}** • **Footer:** **${footerText}** • **Media:** **${mediaText}**`
      );
    }).join('\n-# • ──────────────────────────────\n');
  }

  const containerComps = [
    {
      type: 10,
      content:
        `# Trigger Response Matrix\n` +
        `-# **__Server Trigger Word Responder System__**\n\n` +
        `-# • **Active Server Triggers:** **${triggers.length} configured**\n` +
        `-# • **Global Network Replies:** **${globalTriggers.length} active**\n` +
        `-# • **Page:** **${currentPage + 1} of ${totalPages}**\n` +
        `-# • **Sync Status:** **Synchronized with Auto-Reply Matrix (!ar)**\n` +
        `-# • **Removal Access:** **Server Admins / Extra Owner**\n` +
        `-# • **Dynamic Tags:** **Supports {user}, {server}, {count}, etc.**`
    },
    { type: 14, divider: true },
    {
      type: 10,
      content:
        `-# **__Configured Server Triggers List__**\n` +
        triggersContent
    },
    { type: 14, divider: true }
  ];

  // Action Row 1: Primary Controls
  const mainControls = [
    { type: 2, custom_id: 'trig_btn_create', label: 'Create Trigger', style: 3 },
    { type: 2, custom_id: `trig_btn_refresh_${currentPage}`, label: 'Refresh', style: 2 },
    { type: 2, custom_id: 'trig_btn_test_modal', label: 'Test / Preview', style: 2 }
  ];
  if (triggers.length > 0) {
    mainControls.push({ type: 2, custom_id: 'trig_btn_clear_all', label: 'Clear All', style: 4 });
  }

  containerComps.push({
    type: 1,
    components: mainControls
  });

  // Action Row 2: Direct Remove Buttons
  if (pageTriggers.length > 0) {
    const removeButtons = pageTriggers.slice(0, 5).map(t => {
      const label = t.match.length > 15 ? t.match.slice(0, 12) + '...' : t.match;
      return {
        type: 2,
        custom_id: `trig_btn_del_${Buffer.from(t.match).toString('base64url')}`,
        label: `Remove: ${label}`,
        style: 4
      };
    });

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
        { type: 2, custom_id: `trig_page_${currentPage - 1}`, label: 'Prev', style: 2, disabled: currentPage === 0 },
        { type: 2, custom_id: 'trig_page_noop', label: `Page ${currentPage + 1} / ${totalPages}`, style: 2, disabled: true },
        { type: 2, custom_id: `trig_page_${currentPage + 1}`, label: 'Next', style: 2, disabled: currentPage >= totalPages - 1 }
      ]
    });
  }

  // Action Row 4: Select Menu to Edit any trigger
  if (triggers.length > 0) {
    const editOptions = triggers.slice(0, 25).map(t => ({
      label: `Edit: ${t.match}`.slice(0, 100),
      value: t.match.slice(0, 100),
      description: (t.heading || t.content || 'Click to edit trigger').slice(0, 100)
    }));

    containerComps.push({
      type: 1,
      components: [
        {
          type: 3,
          custom_id: 'trig_select_edit',
          placeholder: 'Select a Trigger to Edit...',
          options: editOptions
        }
      ]
    });

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
            custom_id: 'trig_select_delete',
            placeholder: 'Or Select any Trigger to Remove...',
            options: deleteOptions
          }
        ]
      });
    }
  }

  containerComps.push({ type: 14, divider: true });
  containerComps.push({
    type: 10,
    content: '-# Athena Prime Defense Matrix • Trigger Response System'
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

export async function handleTriggerInteractions(interaction) {
  try {
    // 1. CONFLICT CONFIRMATION BUTTONS
    if (interaction.isButton() && interaction.customId.startsWith('trig_conf_')) {
      const parts = interaction.customId.split('_');
      const action = parts[2]; // global, replace, both, cancel
      const confKey = parts.slice(action === 'replace' ? 4 : 3).join('_');
      const conf = pendingTriggerConflicts.get(confKey);

      if (!conf) {
        return interaction.reply({
          content: '-# **Expired:** This conflict resolution prompt has expired or has already been resolved.',
          flags: 64
        });
      }

      if (interaction.user.id !== conf.userId && !isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({
          content: `-# **Access Denied:** Only <@${conf.userId}> can confirm this resolution.`,
          flags: 64
        });
      }

      if (action === 'cancel') {
        pendingTriggerConflicts.delete(confKey);
        return interaction.update({
          components: [{
            type: 17,
            accent_color: 0xED4245,
            components: [
              { type: 10, content: '## **Trigger Setup Cancelled**' },
              { type: 14, divider: true },
              { type: 10, content: '-# **Action aborted. No changes have been made to your triggers or auto-replies.**' }
            ]
          }],
          flags: MessageFlags.IsComponentsV2
        });
      }

      if (action === 'global') {
        db.disableGlobalTriggerForGuild(interaction.guild.id, conf.keyword);
        db.setTrigger(interaction.guild.id, {
          match: conf.keyword,
          heading: conf.heading,
          content: conf.content,
          gif: conf.gif,
          footer: conf.footer,
          type: 'trigger'
        });
        pendingTriggerConflicts.delete(confKey);
        const resp = makeAccentResponse(
          interaction.guild,
          'Global Disabled & Trigger Set',
          `Disabled global auto-reply for \`${conf.keyword}\` in this server and set trigger response successfully.`,
          true
        );
        return interaction.update(resp);
      }

      if (action === 'replace') {
        db.removeTrigger(interaction.guild.id, conf.keyword);
        db.setTrigger(interaction.guild.id, {
          match: conf.keyword,
          heading: conf.heading,
          content: conf.content,
          gif: conf.gif,
          footer: conf.footer,
          type: 'trigger'
        });
        pendingTriggerConflicts.delete(confKey);
        const resp = makeAccentResponse(
          interaction.guild,
          'Auto-Reply Replaced & Trigger Set',
          `Removed existing \`!ar\` and set trigger response for \`${conf.keyword}\` successfully.`,
          true
        );
        return interaction.update(resp);
      }

      if (action === 'both') {
        db.disableGlobalTriggerForGuild(interaction.guild.id, conf.keyword);
        db.removeTrigger(interaction.guild.id, conf.keyword);
        db.setTrigger(interaction.guild.id, {
          match: conf.keyword,
          heading: conf.heading,
          content: conf.content,
          gif: conf.gif,
          footer: conf.footer,
          type: 'trigger'
        });
        pendingTriggerConflicts.delete(confKey);
        const resp = makeAccentResponse(
          interaction.guild,
          'Trigger Configured',
          `Replaced existing local \`!ar\` and disabled global auto-reply for \`${conf.keyword}\` in this server. Trigger is now active!`,
          true
        );
        return interaction.update(resp);
      }
    }

    // 2. DASHBOARD BUTTONS
    if (interaction.isButton()) {
      // Direct Delete button for a trigger (Server Admins / Extra Owner)
      if (interaction.customId.startsWith('trig_btn_del_')) {
        if (!canManageTriggers(interaction.guild, interaction.member || interaction.user)) {
          return interaction.reply({
            content: '-# **Access Denied:** Removing trigger setups requires **Server Admin** or **Extra Owner** permissions.',
            flags: 64
          });
        }
        const raw = interaction.customId.replace('trig_btn_del_', '');
        let match;
        try {
          match = Buffer.from(raw, 'base64url').toString('utf8');
        } catch {
          match = decodeURIComponent(raw);
        }
        db.removeTrigger(interaction.guild.id, match);
        db.enableGlobalTriggerForGuild(interaction.guild.id, match);
        const panel = buildTriggerDashboard(interaction.guild);
        return cv2.respond(interaction, panel, 7);
      }

      // Pagination
      if (interaction.customId.startsWith('trig_page_')) {
        const pageStr = interaction.customId.replace('trig_page_', '');
        const page = parseInt(pageStr, 10) || 0;
        const panel = buildTriggerDashboard(interaction.guild, page);
        return cv2.respond(interaction, panel, 7);
      }

      // Refresh
      if (interaction.customId.startsWith('trig_btn_refresh')) {
        const parts = interaction.customId.split('_');
        const page = parseInt(parts[3] || '0', 10) || 0;
        const panel = buildTriggerDashboard(interaction.guild, page);
        return cv2.respond(interaction, panel, 7);
      }

      // Clear All (Server Admins / Extra Owner)
      if (interaction.customId === 'trig_btn_clear_all') {
        if (!canManageTriggers(interaction.guild, interaction.member || interaction.user)) {
          return interaction.reply({
            content: '-# **Access Denied:** Clearing trigger setups requires **Server Admin** or **Extra Owner** permissions.',
            flags: 64
          });
        }
        db.clearTriggersOnly(interaction.guild.id);
        const panel = buildTriggerDashboard(interaction.guild, 0);
        return cv2.respond(interaction, panel, 7);
      }

      // Test Modal Prompt
      if (interaction.customId === 'trig_btn_test_modal') {
        const modal = new ModalBuilder().setCustomId('trig_modal_test_input').setTitle('Test Trigger');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_test_keyword')
              .setLabel('Keyword to Test')
              .setPlaceholder('Enter the trigger keyword to preview...')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
        return interaction.showModal(modal);
      }

      // Create Modal
      if (interaction.customId === 'trig_btn_create') {
        if (!canManageTriggers(interaction.guild, interaction.member || interaction.user)) {
          return interaction.reply({
            content: '-# **Access Denied:** Creating triggers requires **Server Admin** or **Extra Owner** permissions.',
            flags: 64
          });
        }
        const modal = new ModalBuilder().setCustomId('trig_modal_create').setTitle('Create Trigger');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_keyword')
              .setLabel('Trigger Keyword (Required)')
              .setPlaceholder('e.g. athena, ping, info')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_content')
              .setLabel('Trigger Response Content (Required)')
              .setPlaceholder('Enter trigger response (supports {user}, {server}, etc.)...')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_heading')
              .setLabel('Heading / Title (Optional)')
              .setPlaceholder('e.g. System Alert')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_gif')
              .setLabel('GIF / Image / Pinterest URL (Optional)')
              .setPlaceholder('e.g. https://pin.it/... or image link')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_footer')
              .setLabel('Custom Unique Footer (Optional)')
              .setPlaceholder('e.g. Athena Prime Trigger Network')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          )
        );
        return interaction.showModal(modal);
      }
    }

    // 3. SELECT MENU INTERACTIONS
    if (interaction.isStringSelectMenu()) {
      // Select menu to edit
      if (interaction.customId === 'trig_select_edit') {
        if (!canManageTriggers(interaction.guild, interaction.member || interaction.user)) {
          return interaction.reply({
            content: '-# **Access Denied:** Editing triggers requires **Server Admin** or **Extra Owner** permissions.',
            flags: 64
          });
        }
        const match = interaction.values[0];
        const trigger = db.getTriggerOnly(interaction.guild.id, match) || db.getTrigger(interaction.guild.id, match);
        if (!trigger) {
          return interaction.reply({ content: 'Could not find the selected trigger.', flags: 64 });
        }

        const modal = new ModalBuilder()
          .setCustomId(`trig_modal_edit_${Buffer.from(match).toString('base64url')}`)
          .setTitle(`Edit Trigger: ${match.slice(0, 25)}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_keyword')
              .setLabel('Trigger Keyword')
              .setValue(trigger.match)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_content')
              .setLabel('Trigger Response Content')
              .setValue(trigger.content || trigger.response || '')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_heading')
              .setLabel('Heading / Title (Optional)')
              .setValue(trigger.heading || '')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_gif')
              .setLabel('GIF / Image / Pinterest URL (Optional)')
              .setValue(trigger.gif || '')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('trig_footer')
              .setLabel('Custom Unique Footer (Optional)')
              .setValue(trigger.footer || '')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          )
        );
        return interaction.showModal(modal);
      }

      // Select menu to delete (Server Admins / Extra Owner)
      if (interaction.customId === 'trig_select_delete') {
        if (!canManageTriggers(interaction.guild, interaction.member || interaction.user)) {
          return interaction.reply({
            content: '-# **Access Denied:** Removing trigger setups requires **Server Admin** or **Extra Owner** permissions.',
            flags: 64
          });
        }
        const match = interaction.values[0];
        db.removeTrigger(interaction.guild.id, match);
        db.enableGlobalTriggerForGuild(interaction.guild.id, match);
        const panel = buildTriggerDashboard(interaction.guild);
        return cv2.respond(interaction, panel, 7);
      }
    }

    // 4. MODAL SUBMITS
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'trig_modal_create') {
        if (!canManageTriggers(interaction.guild, interaction.member || interaction.user)) {
          return interaction.reply({
            content: '-# **Access Denied:** Creating triggers requires **Server Admin** or **Extra Owner** permissions.',
            flags: 64
          });
        }
        const match = interaction.fields.getTextInputValue('trig_keyword').trim();
        const content = interaction.fields.getTextInputValue('trig_content').trim();
        const heading = interaction.fields.getTextInputValue('trig_heading')?.trim() || null;
        let gif = interaction.fields.getTextInputValue('trig_gif')?.trim() || null;
        if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
        const footer = interaction.fields.getTextInputValue('trig_footer')?.trim() || null;

        // Check Conflict
        const existingAr = db.getAutoReply(interaction.guild.id, match);
        const globalTrig = db.getGlobalTrigger(match);
        const isGlobalActive = globalTrig && !db.isGlobalTriggerDisabled(interaction.guild.id, match);

        let conflictType = null;
        if (existingAr && isGlobalActive) conflictType = 'both';
        else if (existingAr) conflictType = 'ar';
        else if (isGlobalActive) conflictType = 'global';

        if (conflictType) {
          const confKey = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          pendingTriggerConflicts.set(confKey, {
            type: conflictType,
            keyword: match,
            content,
            heading,
            gif,
            footer,
            userId: interaction.user.id
          });
          setTimeout(() => pendingTriggerConflicts.delete(confKey), 5 * 60 * 1000);
          const promptPayload = buildConflictPromptPayload(interaction.guild, confKey, pendingTriggerConflicts.get(confKey));
          return interaction.reply(promptPayload);
        }

        db.setTrigger(interaction.guild.id, { match, heading, content, gif, footer, type: 'trigger' });
        const panel = buildTriggerDashboard(interaction.guild);
        return cv2.respond(interaction, panel, 7);
      }

      if (interaction.customId.startsWith('trig_modal_edit_')) {
        if (!canManageTriggers(interaction.guild, interaction.member || interaction.user)) {
          return interaction.reply({
            content: '-# **Access Denied:** Editing triggers requires **Server Admin** or **Extra Owner** permissions.',
            flags: 64
          });
        }
        const raw = interaction.customId.replace('trig_modal_edit_', '');
        let oldMatch;
        try {
          oldMatch = Buffer.from(raw, 'base64url').toString('utf8');
        } catch {
          oldMatch = decodeURIComponent(raw);
        }
        const newMatch = interaction.fields.getTextInputValue('trig_keyword').trim();
        const content = interaction.fields.getTextInputValue('trig_content').trim();
        const heading = interaction.fields.getTextInputValue('trig_heading')?.trim() || null;
        let gif = interaction.fields.getTextInputValue('trig_gif')?.trim() || null;
        if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
        const footer = interaction.fields.getTextInputValue('trig_footer')?.trim() || null;

        if (oldMatch.toLowerCase() !== newMatch.toLowerCase()) {
          db.removeTrigger(interaction.guild.id, oldMatch);
        }
        db.setTrigger(interaction.guild.id, { match: newMatch, heading, content, gif, footer, type: 'trigger' });

        const panel = buildTriggerDashboard(interaction.guild);
        return cv2.respond(interaction, panel, 7);
      }

      if (interaction.customId === 'trig_modal_test_input') {
        const match = interaction.fields.getTextInputValue('trig_test_keyword').trim();
        const trigger = db.getTriggerOnly(interaction.guild.id, match) || db.getTrigger(interaction.guild.id, match);
        if (!trigger) {
          return interaction.reply({ content: `No trigger found matching keyword: \`${match}\`.`, flags: 64 });
        }
        const previewContainer = buildAutoReplyPreview(interaction.guild, trigger, interaction.member || interaction.user);
        return interaction.reply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      }
    }
  } catch (err) {
    console.error('[Trigger Manager] Interaction error:', err);
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: 'An error occurred while handling the trigger action.', flags: 64 }).catch(() => null);
    }
  }
}

export const autoreplyCmd = {
    name: 'autoreply',
    aliases: ['ar', 'customreply'],
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
      },
      {
        name: 'global-dashboard',
        description: 'Open the Global Auto-Reply Manager (Bot Owner Only)',
        type: 1 // SUB_COMMAND
      }
    ],

    async executePrefix(message, args) {
      if (args.length === 0) {
        const payload = buildAutoReplyDashboard(message.guild);
        return message.reply(payload);
      }

      const sub = args[0].toLowerCase();

      if (sub === 'global') {
        if (!isBotOwnerSync(message.author.id)) {
          return message.reply(makeAccentResponse(
            message.guild,
            'Access Denied',
            'Global Auto-Replies are restricted to the **Bot Owner only**.\n-# **Scope:** These replies trigger across every server connected to Athena Prime.',
            false
          ));
        }

        const globalSub = args[1]?.toLowerCase();
        if (!globalSub || globalSub === 'dashboard' || globalSub === 'list' || globalSub === 'manager') {
          const payload = buildGlobalAutoReplyDashboard(message.guild);
          return message.reply(payload);
        }

        if (globalSub === 'add' || globalSub === 'create') {
          const rest = args.slice(2).join(' ');
          const parts = rest.split('|').map(p => p.trim());
          if (parts.length === 0 || !parts[0]) {
            return message.reply(makeAccentResponse(
              message.guild,
              'Global Usage Guide',
              '`!ar global add <keyword> | [content] | [heading] | [gif] | [footer]`\n\n' +
              'Example:\n-# • `!ar global add support | Join our support server: https://discord.gg/...`',
              false
            ));
          }

          const match = parts[0];
          const content = parts[1] || null;
          const heading = parts[2] || null;
          let gif = parts[3] || null;
          if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
          const footer = parts[4] || null;

          if (message.attachments.size > 0 && !gif) {
            gif = message.attachments.first().url;
          }

          db.setGlobalTrigger({ match, heading, content, gif, footer });
          return message.reply(makeAccentResponse(message.guild, 'Global Auto-Reply Created', `Global auto-reply for \`${match}\` created! It will now trigger across all connected servers.`, true));
        }

        if (globalSub === 'remove' || globalSub === 'delete' || globalSub === 'del') {
          const match = args.slice(2).join(' ').trim();
          if (!match) return message.reply(makeAccentResponse(message.guild, 'Usage Error', '`!ar global remove <keyword>`', false));
          const success = db.removeGlobalTrigger(match);
          if (success) {
            return message.reply(makeAccentResponse(message.guild, 'Global Auto-Reply Removed', `Deleted global auto-reply for \`${match}\`.`, true));
          } else {
            return message.reply(makeAccentResponse(message.guild, 'Not Found', `No global auto-reply found matching \`${match}\`.`, false));
          }
        }

        if (globalSub === 'clear' || globalSub === 'clearall') {
          db.clearGlobalTriggers();
          return message.reply(makeAccentResponse(message.guild, 'Global Auto-Replies Cleared', 'All global auto-replies have been removed from Athena Prime.', true));
        }

        const payload = buildGlobalAutoReplyDashboard(message.guild);
        return message.reply(payload);
      }

      if (sub === 'add' || sub === 'create') {
        const rest = args.slice(1).join(' ');
        const parts = rest.split('|').map(p => p.trim());
        if (parts.length === 0 || !parts[0]) {
          return message.reply(makeAccentResponse(
            message.guild,
            'Usage Guide',
            '`!ar add <keyword> | [content] | [heading] | [gif] | [footer]`\n\n' +
            'Note: Heading, content, GIF, and footer are 100% optional!\n' +
            '-# • `!ar add foofwo | Welcome to our server!`\n' +
            '-# • `!ar add foofwo | Welcome | Greeting | https://media.tenor.com/... | Custom Footer`',
            false
          ));
        }

        const match = parts[0];
        const existingTrigger = db.getTriggerOnly(message.guild.id, match);
        if (existingTrigger) {
          return message.reply(makeAccentResponse(
            message.guild,
            'Conflict: Trigger Active',
            `You can use only one system for this keyword! A Trigger (\`!trigger\`) is already active for \`${match}\` in this server.\n\n` +
            `> -# • **Active In:** \`!trigger\` (Trigger Response System)\n` +
            `> -# • **Action Required:** Remove the existing trigger first (Bot Owner required) before setting up an Auto-Reply for this word.`,
            false
          ));
        }
        const content = parts[1] || null;
        const heading = parts[2] || null;
        let gif = parts[3] || null;
        if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
        const footer = parts[4] || null;

        if (message.attachments.size > 0 && !gif) {
          gif = message.attachments.first().url;
        }

        db.setTrigger(message.guild.id, { match, heading, content, gif, footer, type: 'ar' });
        return message.reply(makeAccentResponse(message.guild, 'Auto-Reply Created', `Whenever someone types \`${match}\`, I will reply with an accent borderless CV2 embed.`, true));
      }

      if (sub === 'edit') {
        if (args.length < 4) {
          return message.reply(makeAccentResponse(
            message.guild,
            'Usage Guide',
            '`!ar edit <keyword> <heading|content|gif|footer> <new_value>`\n\n' +
            'Examples:\n' +
            '-# • `!ar edit foofwo heading Announcement`\n' +
            '-# • `!ar edit foofwo content Check out our channels!`\n' +
            '-# • `!ar edit foofwo gif https://media.tenor.com/...`\n' +
            '-# • `!ar edit foofwo footer Server Bot Matrix`',
            false
          ));
        }

        const keyword = args[1];
        const field = args[2].toLowerCase();
        const value = args.slice(3).join(' ');

        const validFields = ['heading', 'content', 'gif', 'footer'];
        if (!validFields.includes(field)) {
          return message.reply(makeAccentResponse(message.guild, 'Invalid Field', `Field must be one of: \`${validFields.join(', ')}\``, false));
        }

        const success = db.updateTrigger(message.guild.id, keyword, { [field]: value });
        if (success) {
          return message.reply(makeAccentResponse(message.guild, 'Auto-Reply Updated', `Updated **${field}** for keyword \`${keyword}\`.`, true));
        } else {
          return message.reply(makeAccentResponse(message.guild, 'Not Found', `No auto-reply found for keyword \`${keyword}\`.`, false));
        }
      }

      if (sub === 'remove' || sub === 'delete' || sub === 'del') {
        const match = args.slice(1).join(' ').trim();
        if (!match) return message.reply(makeAccentResponse(message.guild, 'Usage Error', '`!ar remove <keyword>`', false));

        const success = db.removeTrigger(message.guild.id, match);
        if (success) {
          return message.reply(makeAccentResponse(message.guild, 'Auto-Reply Removed', `Deleted auto-reply for \`${match}\`.`, true));
        } else {
          return message.reply(makeAccentResponse(message.guild, 'Not Found', `No auto-reply found matching \`${match}\`.`, false));
        }
      }

      if (sub === 'clear' || sub === 'clearall') {
        db.clearAutoReplies(message.guild.id);
        return message.reply(makeAccentResponse(message.guild, 'Auto-Replies Cleared', 'All auto-replies have been removed from this server.', true));
      }

      if (sub === 'test' || sub === 'preview') {
        const match = args.slice(1).join(' ').trim();
        if (!match) return message.reply(makeAccentResponse(message.guild, 'Usage Error', '`!ar test <keyword>`', false));

        const trigger = db.getTrigger(message.guild.id, match);
        if (!trigger) {
          return message.reply(makeAccentResponse(message.guild, 'Not Found', `No auto-reply found matching \`${match}\`.`, false));
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

      if (sub === 'global-dashboard') {
        if (!isBotOwnerSync(interaction.user.id)) {
          return interaction.reply({
            content: '-# **Access Denied:** Global Auto-Replies are restricted to the **Bot Owner only**.\n-# **Note:** Global replies trigger across all connected servers.',
            flags: 64
          });
        }
        const payload = buildGlobalAutoReplyDashboard(interaction.guild);
        return interaction.reply({ ...payload });
      }

      if (sub === 'create') {
        const match = interaction.options.getString('keyword').trim();
        const existingTrigger = db.getTriggerOnly(interaction.guild.id, match);
        if (existingTrigger) {
          return interaction.reply({
            content: `-# **Conflict Detected:** A Trigger (\`!trigger\`) is already active for \`${match}\` in this server.\n-# **Sync Policy:** You can use only one system for this keyword. Please remove the trigger first to set up an Auto-Reply.`,
            flags: 64
          });
        }
        const content = interaction.options.getString('content') ? interaction.options.getString('content').trim() : null;
        const heading = interaction.options.getString('heading') ? interaction.options.getString('heading').trim() : null;
        let gif = interaction.options.getString('gif') ? interaction.options.getString('gif').trim() : null;
        if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
        const footer = interaction.options.getString('footer') ? interaction.options.getString('footer').trim() : null;

        db.setTrigger(interaction.guild.id, { match, heading, content, gif, footer, type: 'ar' });
        return interaction.reply(makeAccentResponse(interaction.guild, 'Auto-Reply Created', `Whenever someone types \`${match}\`, I will reply with an accent borderless CV2 embed.`, true));
      }

      if (sub === 'edit') {
        const keyword = interaction.options.getString('keyword').trim();
        const field = interaction.options.getString('field');
        const value = interaction.options.getString('value').trim();

        const success = db.updateTrigger(interaction.guild.id, keyword, { [field]: value });
        if (success) {
          return interaction.reply(makeAccentResponse(interaction.guild, 'Auto-Reply Updated', `Updated **${field}** for keyword \`${keyword}\`.`, true));
        } else {
          return interaction.reply(makeAccentResponse(interaction.guild, 'Not Found', `No auto-reply found for keyword \`${keyword}\`.`, false));
        }
      }

      if (sub === 'remove') {
        const keyword = interaction.options.getString('keyword').trim();
        const success = db.removeTrigger(interaction.guild.id, keyword);
        if (success) {
          return interaction.reply(makeAccentResponse(interaction.guild, 'Auto-Reply Removed', `Deleted auto-reply for \`${keyword}\`.`, true));
        } else {
          return interaction.reply(makeAccentResponse(interaction.guild, 'Not Found', `No auto-reply found matching \`${keyword}\`.`, false));
        }
      }

      if (sub === 'test') {
        const keyword = interaction.options.getString('keyword').trim();
        const trigger = db.getTrigger(interaction.guild.id, keyword);
        if (!trigger) {
          return interaction.reply(makeAccentResponse(interaction.guild, 'Not Found', `No auto-reply found matching \`${keyword}\`.`, false));
        }

        const previewContainer = buildAutoReplyPreview(interaction.guild, trigger);
        return interaction.reply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      }
    }
};

export const triggerCmd = {
  name: 'trigger',
  aliases: ['trig'],
  description: 'Manage trigger word responses synchronized with the Auto-Reply Matrix.',
  category: 'utility',
  permissions: [PermissionFlagsBits.ManageGuild],
  options: [
    {
      name: 'create',
      description: 'Create a new keyword trigger',
      type: 1, // SUB_COMMAND
      options: [
        { name: 'keyword', description: 'Keyword to trigger the response', type: 3, required: true },
        { name: 'response', description: 'Response text for the trigger', type: 3, required: true },
        { name: 'heading', description: 'Title heading (optional)', type: 3, required: false },
        { name: 'gif', description: 'Direct image, GIF or Pinterest URL (optional)', type: 3, required: false },
        { name: 'footer', description: 'Custom unique footer text (optional)', type: 3, required: false }
      ]
    },
    {
      name: 'delete',
      description: 'Delete a trigger word response (Server Admins / Extra Owner)',
      type: 1, // SUB_COMMAND
      options: [
        { name: 'keyword', description: 'Keyword to delete', type: 3, required: true }
      ]
    },
    {
      name: 'list',
      description: 'List all active triggers in this server',
      type: 1 // SUB_COMMAND
    },
    {
      name: 'clear',
      description: 'Clear all triggers in this server (Server Admins / Extra Owner)',
      type: 1 // SUB_COMMAND
    },
    {
      name: 'test',
      description: 'Test/preview a trigger response',
      type: 1, // SUB_COMMAND
      options: [
        { name: 'keyword', description: 'Keyword to test', type: 3, required: true }
      ]
    },
    {
      name: 'dashboard',
      description: 'Open the interactive Trigger Matrix Dashboard',
      type: 1 // SUB_COMMAND
    },
    {
      name: 'add',
      description: 'Add a new keyword trigger',
      type: 1, // SUB_COMMAND
      options: [
        { name: 'keyword', description: 'Keyword to trigger the response', type: 3, required: true },
        { name: 'response', description: 'Response text for the trigger', type: 3, required: true },
        { name: 'heading', description: 'Title heading (optional)', type: 3, required: false },
        { name: 'gif', description: 'Direct image, GIF or Pinterest URL (optional)', type: 3, required: false },
        { name: 'footer', description: 'Custom unique footer text (optional)', type: 3, required: false }
      ]
    },
    {
      name: 'remove',
      description: 'Remove a trigger word response (Server Admins / Extra Owner)',
      type: 1, // SUB_COMMAND
      options: [
        { name: 'keyword', description: 'Keyword to remove', type: 3, required: true }
      ]
    }
  ],

  async executePrefix(message, args) {
    if (args.length === 0) {
      const payload = buildTriggerDashboard(message.guild);
      return message.reply(payload);
    }

    const sub = args[0].toLowerCase();
    const fullText = args.join(' ');
    const isDirectCreate = fullText.includes('|') && !['add', 'create', 'remove', 'delete', 'del', 'clear', 'clearall', 'list', 'test', 'preview', 'dashboard'].includes(sub);

    if (sub === 'create' || sub === 'add' || isDirectCreate) {
      if (!canManageTriggers(message.guild, message.member || message.author)) {
        return message.reply(makeAccentResponse(
          message.guild,
          'Access Denied',
          'Only **Server Admins**, **Extra Owners**, or the **Server Owner** can create triggers.',
          false
        ));
      }

      const rest = isDirectCreate ? fullText : args.slice(1).join(' ');
      const parts = rest.split('|').map(p => p.trim());
      if (parts.length === 0 || !parts[0] || !parts[1]) {
        return message.reply(makeAccentResponse(
          message.guild,
          'Trigger Usage Guide',
          '`!trigger create <match> | <response>`\n\n' +
          '**Examples:**\n' +
          '-# • `!trigger create hello | Hello {user}, welcome to {server}!`\n' +
          '-# • `!trigger create ping | pong`\n' +
          '-# • `!trigger hello | Direct shortcut response!`\n\n' +
          '> -# • **Placeholders:** `{user}`, `{server}`, `{count}`\n' +
          '> -# • **Commands:** `!trigger delete <match>`, `!trigger list`',
          false
        ));
      }

      const match = parts[0];
      const content = parts[1];
      const heading = parts[2] || null;
      let gif = parts[3] || null;
      if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
      const footer = parts[4] || null;

      if (message.attachments.size > 0 && !gif) {
        gif = message.attachments.first().url;
      }

      // Check Conflicts
      const existingAr = db.getAutoReply(message.guild.id, match);
      const globalTrig = db.getGlobalTrigger(match);
      const isGlobalActive = globalTrig && !db.isGlobalTriggerDisabled(message.guild.id, match);

      let conflictType = null;
      if (existingAr && isGlobalActive) conflictType = 'both';
      else if (existingAr) conflictType = 'ar';
      else if (isGlobalActive) conflictType = 'global';

      if (conflictType) {
        const confKey = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        pendingTriggerConflicts.set(confKey, {
          type: conflictType,
          keyword: match,
          content,
          heading,
          gif,
          footer,
          userId: message.author.id
        });
        setTimeout(() => pendingTriggerConflicts.delete(confKey), 5 * 60 * 1000);
        return message.reply(buildConflictPromptPayload(message.guild, confKey, pendingTriggerConflicts.get(confKey)));
      }

      db.setTrigger(message.guild.id, { match, heading, content, gif, footer, type: 'trigger' });
      return message.reply(makeAccentResponse(
        message.guild,
        'Trigger Created',
        `Whenever someone types \`${match}\`, I will execute the configured trigger response.`,
        true
      ));
    }

    if (sub === 'delete' || sub === 'remove' || sub === 'del') {
      if (!canManageTriggers(message.guild, message.member || message.author)) {
        return message.reply(makeAccentResponse(
          message.guild,
          'Access Denied',
          'Only **Server Admins**, **Extra Owners**, or the **Server Owner** can delete triggers.',
          false
        ));
      }

      const match = args.slice(1).join(' ').trim();
      if (!match) return message.reply(makeAccentResponse(message.guild, 'Usage Error', '`!trigger delete <keyword>`', false));

      const success = db.removeTrigger(message.guild.id, match);
      if (success) {
        db.enableGlobalTriggerForGuild(message.guild.id, match);
        return message.reply(makeAccentResponse(message.guild, 'Trigger Removed', `Deleted trigger setup for \`${match}\`.`, true));
      } else {
        return message.reply(makeAccentResponse(message.guild, 'Not Found', `No trigger found matching \`${match}\`.`, false));
      }
    }

    if (sub === 'clear' || sub === 'clearall') {
      if (!canManageTriggers(message.guild, message.member || message.author)) {
        return message.reply(makeAccentResponse(
          message.guild,
          'Access Denied',
          'Only **Server Admins**, **Extra Owners**, or the **Server Owner** can clear triggers.',
          false
        ));
      }

      db.clearTriggersOnly(message.guild.id);
      return message.reply(makeAccentResponse(message.guild, 'Triggers Cleared', 'All trigger word setups have been cleared from this server.', true));
    }

    if (sub === 'test' || sub === 'preview') {
      const match = args.slice(1).join(' ').trim();
      if (!match) return message.reply(makeAccentResponse(message.guild, 'Usage Error', '`!trigger test <keyword>`', false));

      const trigger = db.getTriggerOnly(message.guild.id, match) || db.getTrigger(message.guild.id, match);
      if (!trigger) {
        return message.reply(makeAccentResponse(message.guild, 'Not Found', `No trigger found matching \`${match}\`.`, false));
      }

      const previewContainer = buildAutoReplyPreview(message.guild, trigger, message.member || message.author);
      return message.reply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
    }

    if (sub === 'list' || sub === 'dashboard' || sub === 'manager') {
      const payload = buildTriggerDashboard(message.guild);
      return message.reply(payload);
    }

    const payload = buildTriggerDashboard(message.guild);
    return message.reply(payload);
  },

  async executeSlash(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'dashboard' || sub === 'list') {
      const payload = buildTriggerDashboard(interaction.guild);
      return interaction.reply({ ...payload });
    }

    if (sub === 'create' || sub === 'add') {
      if (!canManageTriggers(interaction.guild, interaction.member || interaction.user)) {
        return interaction.reply({
          content: '-# **Access Denied:** Only **Server Admins**, **Extra Owners**, or the **Server Owner** can create triggers.',
          flags: 64
        });
      }

      const match = interaction.options.getString('keyword').trim();
      const content = interaction.options.getString('response').trim();
      const heading = interaction.options.getString('heading')?.trim() || null;
      let gif = interaction.options.getString('gif')?.trim() || null;
      if (gif && isPinterestUrl(gif)) gif = await resolveMediaUrl(gif);
      const footer = interaction.options.getString('footer')?.trim() || null;

      // Check Conflict
      const existingAr = db.getAutoReply(interaction.guild.id, match);
      const globalTrig = db.getGlobalTrigger(match);
      const isGlobalActive = globalTrig && !db.isGlobalTriggerDisabled(interaction.guild.id, match);

      let conflictType = null;
      if (existingAr && isGlobalActive) conflictType = 'both';
      else if (existingAr) conflictType = 'ar';
      else if (isGlobalActive) conflictType = 'global';

      if (conflictType) {
        const confKey = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        pendingTriggerConflicts.set(confKey, {
          type: conflictType,
          keyword: match,
          content,
          heading,
          gif,
          footer,
          userId: interaction.user.id
        });
        setTimeout(() => pendingTriggerConflicts.delete(confKey), 5 * 60 * 1000);
        return interaction.reply(buildConflictPromptPayload(interaction.guild, confKey, pendingTriggerConflicts.get(confKey)));
      }

      db.setTrigger(interaction.guild.id, { match, heading, content, gif, footer, type: 'trigger' });
      return interaction.reply(makeAccentResponse(
        interaction.guild,
        'Trigger Created',
        `Whenever someone types \`${match}\`, I will execute the configured trigger response.`,
        true
      ));
    }

    if (sub === 'delete' || sub === 'remove') {
      if (!canManageTriggers(interaction.guild, interaction.member || interaction.user)) {
        return interaction.reply({
          content: '-# **Access Denied:** Only **Server Admins**, **Extra Owners**, or the **Server Owner** can delete triggers.',
          flags: 64
        });
      }

      const keyword = interaction.options.getString('keyword').trim();
      const success = db.removeTrigger(interaction.guild.id, keyword);
      if (success) {
        db.enableGlobalTriggerForGuild(interaction.guild.id, keyword);
        return interaction.reply(makeAccentResponse(interaction.guild, 'Trigger Removed', `Deleted trigger setup for \`${keyword}\`.`, true));
      } else {
        return interaction.reply(makeAccentResponse(interaction.guild, 'Not Found', `No trigger found matching \`${keyword}\`.`, false));
      }
    }

    if (sub === 'clear') {
      if (!canManageTriggers(interaction.guild, interaction.member || interaction.user)) {
        return interaction.reply({
          content: '-# **Access Denied:** Only **Server Admins**, **Extra Owners**, or the **Server Owner** can clear triggers.',
          flags: 64
        });
      }

      db.clearTriggersOnly(interaction.guild.id);
      return interaction.reply(makeAccentResponse(interaction.guild, 'Triggers Cleared', 'All trigger word setups have been cleared from this server.', true));
    }

    if (sub === 'test') {
      const keyword = interaction.options.getString('keyword').trim();
      const trigger = db.getTriggerOnly(interaction.guild.id, keyword) || db.getTrigger(interaction.guild.id, keyword);
      if (!trigger) {
        return interaction.reply(makeAccentResponse(interaction.guild, 'Not Found', `No trigger found matching \`${keyword}\`.`, false));
      }

      const previewContainer = buildAutoReplyPreview(interaction.guild, trigger, interaction.member || interaction.user);
      return interaction.reply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
    }
  }
};

export const commands = [
  autoreplyCmd,
  triggerCmd
];
