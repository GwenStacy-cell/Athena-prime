import { MessageFlags } from 'discord.js';

// Returns true if a line already has discord markdown — skip auto-formatting
function isPreformatted(line) {
  if (!line.trim()) return true;
  return /^(-#|#{1,3} |> |\*\*|__|`|\|)/.test(line) || /^[\u2022\-\*\+] /.test(line);
}

// Returns true if line starts with a custom or unicode emoji
function hasEmojiStart(line) {
  return /^<a?:[a-zA-Z0-9_]+:\d+>/.test(line) || /^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(line);
}

// Style a single line: grey, with optional bullet for plain text
function styleLine(line, addBullet) {
  if (!line.trim()) return line;
  if (isPreformatted(line)) return line;
  const startsEmoji = hasEmojiStart(line);
  const hasBold = line.includes('**');
  if (startsEmoji || hasBold) return '-# ' + line;
  const bullet = addBullet ? '\u2022 ' : '';
  return '-# **' + bullet + line + '**';
}

// Separator raw component
const SEP = { type: 14, divider: true };

// Build a raw CV2 container JSON with separators
function buildContainer(title, description, fields, customFooter) {
  if (!fields) fields = [];
  var comps = [];

  // Big bold heading + divider under it
  if (title) {
    comps.push({ type: 10, content: '## **' + title + '**' });
    comps.push(SEP);
  }

  // Grey bold description with smart bullets
  if (description) {
    var lines = description.split('\n');
    var plainCount = lines.filter(function(l) {
      return l.trim() && !isPreformatted(l) && !hasEmojiStart(l);
    }).length;
    var multiLine = plainCount > 1;
    var formatted = lines.map(function(l) { return styleLine(l, multiLine); }).join('\n');
    comps.push({ type: 10, content: formatted.trim() || '\u200b' });
  }

  // Fields
  var fieldText = '';
  var inlineBuf = [];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (f.inline) {
      inlineBuf.push('**' + f.name + ':** ' + f.value);
    } else {
      if (inlineBuf.length > 0) { fieldText += '-# ' + inlineBuf.join('  **\u00b7**  ') + '\n'; inlineBuf = []; }
      fieldText += '\n**' + f.name + '**\n' + f.value + '\n';
    }
  }
  if (inlineBuf.length > 0) fieldText += '\n-# ' + inlineBuf.join('  **\u00b7**  ') + '\n';
  if (fieldText.trim()) {
    comps.push(SEP);
    comps.push({ type: 10, content: fieldText.trim() });
  }

  // Bottom divider
  comps.push(SEP);
  let footerText = customFooter ? customFooter : 'Athena Bulletproof Security System \u00b7 V1.0.0';
  
  const footers = {
      'success': 'System Operation Successfully Completed.',
      'warning': 'Security Protocol Advisory Issued.',
      'danger': 'Critical Security Protocol Engaged.',
      'error': 'System Fault Encountered.',
      'shield': 'Active Threat Neutralization and Firewall Defense Matrix Engaged.',
      'raid': 'Anti-Nuke Raid Protection Protocols Fully Enforced.',
      'info': 'System Data Retrieval and Analysis Complete.',
      'log': 'Secure Audit Log Entry Processed.',
      'moderation': 'Administrative Moderation Action Executed.',
      'security': 'Athena Core Security System Active.',
      'owner': 'Executive Override Command Authorized.',
      'engagement': 'Community Engagement and Interaction Module Active.',
      'utility': 'System Utility and Diagnostic Tools Deployed.',
      'configuration': 'System Core Configuration and Settings Modified.'
  };

  if (footers[footerText]) footerText = footers[footerText];

  comps.push({ type: 10, content: `-# **${footerText}**` });

  return { type: 17, components: comps };
}

function make(title, desc, fields, eph, customFooter) {
  if (!fields) fields = [];
  if (!eph) eph = false;
  var flags = eph ? (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) : MessageFlags.IsComponentsV2;
  return { components: [buildContainer(title, desc, fields, customFooter)], flags: flags };
}

var _m = function(eph) {
  return {
    success:  function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    warn:     function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    danger:   function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    error:    function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    info:     function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    raid:     function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    owner:    function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    security: function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    log:      function(t,d,f,ft) { return make('Log: ' + t, d, f, eph, ft); },
  };
};

export var cv2 = Object.assign(_m(false), {
  e:            _m(true),
  asEphemeral:  function(p) {
    return Object.assign({}, p, { flags: ((p.flags != null ? p.flags : MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral) });
  },
  buildContainer: buildContainer,
  make:           make,
  edit: async function(ctx, payload) {
    if (typeof payload === 'string') payload = { content: payload };
    // Strip all legacy discord.js fields that are injected as undefined/null
    // and cause DiscordAPIError[50035] when IS_COMPONENTS_V2 flag is set
    const isCV2 = payload.flags != null && (payload.flags & 32768);
    let body = payload;
    if (isCV2) {
      body = { components: payload.components, flags: payload.flags };
    }
    if (ctx.editReply) {
      return ctx.client.rest.patch(`/webhooks/${ctx.client.user.id}/${ctx.token}/messages/@original`, { body });
    } else if (ctx.edit) {
      return ctx.client.rest.patch(`/channels/${ctx.channel.id}/messages/${ctx.id}`, { body });
    }
  },
});

export default cv2;
// Safely edit a message or interaction reply with CV2 payload to bypass discord.js injecting content: null
