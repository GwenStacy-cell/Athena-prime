import { MessageFlags } from 'discord.js';

// Returns true if a line already has discord markdown — skip auto-formatting
function isPreformatted(line) {
  if (!line.trim()) return true;
  return /^(-#|#{1,3} |> |```)/.test(line);
}

// Returns true if line starts with a custom or unicode emoji
function hasEmojiStart(line) {
  return /^<a?:[a-zA-Z0-9_]+:\d+>/.test(line) || /^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(line);
}

// Style a single line: grey, with optional bullet for plain text
function styleLine(line, addBullet) {
  if (!line.trim()) return line;
  if (isPreformatted(line)) {
    if (line.startsWith('-#') && !line.includes('**')) {
      const rest = line.replace(/^-#\s*/, '');
      return '-# **' + rest + '**';
    }
    return line;
  }
  const startsEmoji = hasEmojiStart(line);
  const hasListMarker = /^[\u2022\-\*+] /.test(line);
  
  const bullet = (addBullet && !hasListMarker) ? '\u2022 ' : '';
  if (line.includes('**')) {
    return '-# ' + bullet + line;
  }
  const cleanLine = line.replace(/^\*\*|\*\*$/g, '');
  return '-# **' + bullet + cleanLine + '**';
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
    var inDescCode = false;
    var formattedLines = [];
    for (var d = 0; d < lines.length; d++) {
      var dLine = lines[d];
      var dTrimmed = dLine.trim();
      if (dTrimmed.startsWith('```')) {
        inDescCode = !inDescCode;
        formattedLines.push(dLine);
        continue;
      }
      if (inDescCode) {
        formattedLines.push(dLine);
        continue;
      }
      formattedLines.push(styleLine(dLine, false));
    }
    var formatted = formattedLines.join('\n').trim() || '\u200b';

    if (formatted.length <= 3900) {
      comps.push({ type: 10, content: formatted });
    } else {
      var splitLines = formatted.split('\n');
      var currentChunk = '';
      for (var j = 0; j < splitLines.length; j++) {
        var nextLine = splitLines[j];
        if (currentChunk.length + nextLine.length + 1 > 3800) {
          if (currentChunk.trim()) {
            comps.push({ type: 10, content: currentChunk.trim() });
            comps.push(SEP);
            currentChunk = '';
          }
        }
        currentChunk += (currentChunk ? '\n' : '') + nextLine;
      }
      if (currentChunk.trim()) {
        comps.push({ type: 10, content: currentChunk.trim() });
      }
    }
  }

  // Fields
  var fieldLines = [];
  var inlineBuf = [];

  function flushInline() {
    if (inlineBuf.length > 0) {
      fieldLines.push('-# ' + inlineBuf.join('  \u00b7  '));
      inlineBuf = [];
    }
  }

  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (!f || !f.name) continue;
    var name = String(f.name).replace(/^\*\*|\*\*$/g, '').trim();
    var val = String(f.value || '').trim();

    if (f.inline) {
      inlineBuf.push('**' + name + ':** ' + val);
      if (inlineBuf.length >= 3) {
        flushInline();
      }
    } else {
      flushInline();
      if (val.includes('```')) {
        var inFieldCode = false;
        var subLines = val.split('\n').map(function(l) {
          var trimmed = l.trim();
          if (trimmed.startsWith('```')) {
            inFieldCode = !inFieldCode;
            return trimmed;
          }
          if (inFieldCode) {
            return l;
          }
          return trimmed ? (trimmed.startsWith('-#') ? trimmed : '-# ' + trimmed) : '';
        });
        fieldLines.push('-# **' + name + ':**\n' + subLines.join('\n'));
      } else if (val.includes('\n')) {
        var subLines = val.split('\n').map(function(l) {
          return l.trim() ? (l.startsWith('-#') ? l : '-# ' + l) : '';
        });
        fieldLines.push('-# **' + name + ':**\n' + subLines.join('\n'));
      } else {
        fieldLines.push('-# **' + name + ':** ' + val);
      }
    }
  }
  flushInline();

  var fieldText = fieldLines.join('\n').trim();
  if (fieldText) {
    comps.push(SEP);
    if (fieldText.length <= 3900) {
      comps.push({ type: 10, content: fieldText });
    } else {
      var fLines = fieldText.split('\n');
      var fChunk = '';
      for (var k = 0; k < fLines.length; k++) {
        var nextFLine = fLines[k];
        if (fChunk.length + nextFLine.length + 1 > 3800) {
          if (fChunk.trim()) {
            comps.push({ type: 10, content: fChunk.trim() });
            comps.push(SEP);
            fChunk = '';
          }
        }
        fChunk += (fChunk ? '\n' : '') + nextFLine;
      }
      if (fChunk.trim()) {
        comps.push({ type: 10, content: fChunk.trim() });
      }
    }
  }

  // Bottom divider
  comps.push(SEP);
  let footerKey = (customFooter || '').toLowerCase().trim();
  
  const footers = {
      'success': 'System Operation Successfully Completed.',
      'warning': 'Defense Protocol Advisory Issued.',
      'danger': 'Critical Defense Protocol Engaged.',
      'error': 'System Fault Encountered.',
      'shield': 'Active Threat Neutralization and Firewall Defense Matrix Engaged.',
      'raid': 'Anti-Nuke Raid Protection Protocols Fully Enforced.',
      'info': 'System Data Retrieval and Analysis Complete.',
      'log': 'Athena Audit Log Entry Processed.',
      'moderation': 'Administrative Moderation Action Executed.',
      'security': 'Athena Core Defense System Active.',
      'defense': 'Athena Core Defense System Active.',
      'owner': 'Executive Override Command Authorized.',
      'engagement': 'Community Engagement and Interaction Module Active.',
      'utility': 'System Utility and Diagnostic Tools Deployed.',
      'utilities': 'System Utility and Diagnostic Tools Deployed.',
      'configuration': 'System Core Configuration and Settings Modified.',
      'config': 'System Core Configuration and Settings Modified.',
      'enuke': 'Emergency Defense Protocol Active.',
      'modmode': 'Server Maintenance and ModMode Active.',
      'general': 'System Data Retrieval and Analysis Complete.'
  };

  let footerText;
  if (footers[footerKey]) {
    footerText = footers[footerKey];
  } else if (!customFooter) {
    footerText = 'Athena Bulletproof Defense Matrix \u00b7 V1.0.0';
  } else {
    footerText = customFooter;
  }

  comps.push({ type: 10, content: `-# **${footerText}**` });

  // Pure borderless CV2 container (no accent_color)
  return { type: 17, components: comps };
}

function make(title, desc, fields, eph, customFooter) {
  if (!fields) fields = [];
  if (!eph) eph = false;
  var flags = eph ? (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) : MessageFlags.IsComponentsV2;
  return { components: [buildContainer(title, desc, fields, customFooter)], flags: flags };
}

export const TICK_EMOJI = '<a:atheNATICK:1557841381630681106>';

var _m = function(eph) {
  return {
    success:  function(t,d,f,ft) {
      var heading = t;
      if (t && !t.includes('1557841381630681106')) {
        heading = t + ' | ' + TICK_EMOJI;
      }
      return make(heading, d, f, eph, ft);
    },
    warn:     function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    danger:   function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    error:    function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    info:     function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    raid:     function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    owner:    function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    security: function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    defense:  function(t,d,f,ft) { return make(t,d,f,eph,ft); },
    log:      function(t,d,f,ft) { return make('Log: ' + t, d, f, eph, ft); },
  };
};

export var cv2 = Object.assign(_m(false), {
  TICK_EMOJI:   TICK_EMOJI,
  e:            _m(true),
  asEphemeral:  function(p) {
    return Object.assign({}, p, { flags: ((p.flags != null ? p.flags : MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral) });
  },
  buildContainer: buildContainer,
  make:           make,
  
  respond: async function(ctx, payload, type = 4) {
    if (typeof payload === 'string') payload = { content: payload };
    const isCV2 = payload.flags != null && (payload.flags & 32768);
    let body = payload;
    if (isCV2) {
      const comps = Array.isArray(payload.components) ? [...payload.components] : [];
      if (payload.content) {
        if (comps[0]?.type === 17 && Array.isArray(comps[0].components)) {
          comps[0].components.unshift({ type: 14, divider: true });
          comps[0].components.unshift({ type: 10, content: payload.content });
        }
      }
      body = { components: comps, flags: payload.flags };
      if (payload.files) body.files = payload.files;
    }
    
    if (ctx.replied || ctx.deferred) {
      return cv2.edit(ctx, payload);
    }

    // type 4 = ChannelMessageWithSource (Reply)
    // type 7 = UpdateMessage (Update)
    return ctx.client.rest.post(`/interactions/${ctx.id}/${ctx.token}/callback`, { body: { type: type, data: body } });
  },
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
