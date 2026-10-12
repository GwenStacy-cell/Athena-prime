import { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';

export function buildAutoReplyPreview(guild, trigger) {
  const config = db.getGuildConfig(guild.id);
  const accentHex = config.accentColor || '#5865F2';
  const accentInt = parseInt(accentHex.replace('#', ''), 16);

  const comps = [];

  // 1. Heading (Title)
  if (trigger.heading) {
    comps.push({ type: 10, content: `## **${trigger.heading}**` });
    comps.push({ type: 14, divider: true });
  }

  // 2. Content / Description (grey bold markdown)
  const bodyText = trigger.content || trigger.response || '';
  if (bodyText) {
    const lines = bodyText.split('\n');
    const formatted = lines.map(line => {
      if (!line.trim()) return line;
      if (line.startsWith('-#')) return line;
      return `-# **${line}**`;
    }).join('\n');
    comps.push({ type: 10, content: formatted });
  }

  // 3. Attached GIF / Image (Media Gallery in CV2)
  const mediaUrl = trigger.gif || (trigger.response && /^https?:\/\/[^\s]+?\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(trigger.response.trim()) ? trigger.response.trim() : null);
  if (mediaUrl) {
    comps.push({
      type: 12,
      items: [
        { media: { url: mediaUrl } }
      ]
    });
  }

  // 4. Footer
  comps.push({ type: 14, divider: true });
  const footerText = trigger.footer || `${guild.name} • Auto-Reply`;
  comps.push({ type: 10, content: `-# **${footerText}**` });

  return {
    type: 17,
    accent_color: accentInt,
    components: comps
  };
}

export function buildAutoReplyDashboard(guild) {
  const triggers = db.getTriggers(guild.id);
  const config = db.getGuildConfig(guild.id);
  const accentHex = config.accentColor || '#5865F2';
  const accentInt = parseInt(accentHex.replace('#', ''), 16);

  let triggersContent = '-# • **No auto-replies configured yet.** Click **Create Auto-Reply** below to add one!';
  if (triggers.length > 0) {
    triggersContent = triggers.map((t, idx) => {
      const shortContent = (t.content || t.response || '').replace(/\n/g, ' ');
      const preview = shortContent.length > 60 ? shortContent.slice(0, 57) + '...' : shortContent;
      return (
        `-# • **#${idx + 1} Keyword:** \`${t.match}\`\n` +
        `-# • **Heading:** ${t.heading ? `**${t.heading}**` : '`None`'} | **Media:** ${t.gif ? '`Attached`' : '`None`'}\n` +
        `-# • **Content:** ${preview ? `**${preview}**` : '`None`'}\n` +
        `-# • **Footer:** ${t.footer ? `**${t.footer}**` : '`Default`'}`
      );
    }).join('\n-# • ──────────────────────────────\n');
  }

  const containerComps = [
    {
      type: 10,
      content:
        `# Auto-Reply Manager\n` +
        `-# **__Server Keyword Auto-Responder Matrix__**\n\n` +
        `-# • **Active Auto-Replies:** **${triggers.length} configured**\n` +
        `-# • **Response Engine:** **Accent Borderless CV2 Container**\n` +
        `-# • **Media Capabilities:** **GIF & Image Embedding Active**\n` +
        `-# • **Access Tier:** **Server Owner & Extra Owners**`
    },
    { type: 14, divider: true },
    {
      type: 10,
      content:
        `-# **__Configured Server Triggers__**\n` +
        triggersContent
    },
    { type: 14, divider: true },
    {
      type: 1,
      components: [
        { type: 2, custom_id: 'ar_btn_create', label: 'Create Auto-Reply', style: 3 },
        { type: 2, custom_id: 'ar_btn_refresh', label: 'Refresh List', style: 2 }
      ]
    }
  ];

  if (triggers.length > 0) {
    // Select menu to edit
    const editOptions = triggers.slice(0, 25).map(t => ({
      label: `Edit: ${t.match}`.slice(0, 100),
      value: t.match.slice(0, 100),
      description: (t.heading || t.content || 'Edit fields').slice(0, 100)
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

    // Select menu to delete
    const deleteOptions = triggers.slice(0, 25).map(t => ({
      label: `Delete: ${t.match}`.slice(0, 100),
      value: t.match.slice(0, 100),
      description: `Remove ${t.match} auto-reply`.slice(0, 100)
    }));

    containerComps.push({
      type: 1,
      components: [
        {
          type: 3,
          custom_id: 'ar_select_delete',
          placeholder: 'Select an Auto-Reply to Delete...',
          options: deleteOptions
        }
      ]
    });
  }

  containerComps.push({ type: 14, divider: true });
  containerComps.push({
    type: 10,
    content: '-# Athena Prime Defense Matrix • Auto-Reply Suite'
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
  if (interaction.isButton()) {
    if (interaction.customId === 'ar_btn_create') {
      const modal = new ModalBuilder().setCustomId('ar_modal_create').setTitle('Create Auto-Reply');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ar_keyword').setLabel('Trigger Keyword').setPlaceholder('e.g. foofwo, rules, hello').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ar_heading').setLabel('Heading (Title)').setPlaceholder('e.g. Server Welcome').setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ar_content').setLabel('Content / Reply Text').setPlaceholder('Enter response message here...').setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ar_gif').setLabel('GIF / Image URL').setPlaceholder('e.g. https://media.tenor.com/...').setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ar_footer').setLabel('Footer Text').setPlaceholder('e.g. Athena Defense Suite').setStyle(TextInputStyle.Short).setRequired(false)
        )
      );
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'ar_btn_refresh') {
      const panel = buildAutoReplyDashboard(interaction.guild);
      return cv2.respond(interaction, panel, 7);
    }
  }

  if (interaction.isStringSelectMenu()) {
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
          new TextInputBuilder().setCustomId('ar_keyword').setLabel('Trigger Keyword').setValue(trigger.match).setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ar_heading').setLabel('Heading (Title)').setValue(trigger.heading || '').setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ar_content').setLabel('Content / Reply Text').setValue(trigger.content || trigger.response || '').setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ar_gif').setLabel('GIF / Image URL').setValue(trigger.gif || '').setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ar_footer').setLabel('Footer Text').setValue(trigger.footer || '').setStyle(TextInputStyle.Short).setRequired(false)
        )
      );
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'ar_select_delete') {
      const match = interaction.values[0];
      db.removeTrigger(interaction.guild.id, match);
      const panel = buildAutoReplyDashboard(interaction.guild);
      return cv2.respond(interaction, panel, 7);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'ar_modal_create') {
      const match = interaction.fields.getTextInputValue('ar_keyword').trim();
      const heading = interaction.fields.getTextInputValue('ar_heading').trim() || null;
      const content = interaction.fields.getTextInputValue('ar_content').trim();
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
      const content = interaction.fields.getTextInputValue('ar_content').trim();
      const gif = interaction.fields.getTextInputValue('ar_gif').trim() || null;
      const footer = interaction.fields.getTextInputValue('ar_footer').trim() || null;

      if (oldMatch.toLowerCase() !== newMatch.toLowerCase()) {
        db.removeTrigger(interaction.guild.id, oldMatch);
      }
      db.setTrigger(interaction.guild.id, { match: newMatch, heading, content, gif, footer });

      const panel = buildAutoReplyDashboard(interaction.guild);
      return cv2.respond(interaction, panel, 7);
    }
  }
}

export const commands = [
  {
    name: 'autoreply',
    aliases: ['ar', 'trigger', 'customreply'],
    description: 'Manage custom auto-replies with accent borderless CV2 embeds, GIFs, and headers.',
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
          { name: 'content', description: 'Body text of the auto-reply', type: 3, required: true },
          { name: 'heading', description: 'Title heading of the embed', type: 3, required: false },
          { name: 'gif', description: 'Direct image or GIF URL to attach', type: 3, required: false },
          { name: 'footer', description: 'Custom footer text', type: 3, required: false }
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
        if (parts.length < 2) {
          return message.reply(cv2.warn(
            'Usage Guide',
            '`!ar add <keyword> | <content> [| <heading>] [| <gif>] [| <footer>]`\n\n' +
            '**Examples:**\n' +
            '-# • `!ar add foofwo | Welcome to our server!`\n' +
            '-# • `!ar add foofwo | Welcome | Greeting | https://media.tenor.com/... | Athena Auto-Reply`'
          ));
        }

        const match = parts[0];
        const content = parts[1];
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

      if (sub === 'remove' || sub === 'delete') {
        const match = args.slice(1).join(' ').trim();
        if (!match) return message.reply(cv2.warn('Usage Error', '`!ar remove <keyword>`'));

        const success = db.removeTrigger(message.guild.id, match);
        if (success) {
          return message.reply(cv2.success('Auto-Reply Removed', `Deleted auto-reply for \`${match}\`.`));
        } else {
          return message.reply(cv2.warn('Not Found', `No auto-reply found matching \`${match}\`.`));
        }
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

      if (sub === 'list' || sub === 'dashboard') {
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
        const content = interaction.options.getString('content').trim();
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
