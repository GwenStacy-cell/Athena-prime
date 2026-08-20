export function createMockInteraction(message, args, cmd) {
  return {
    isCommand: () => true,
    isChatInputCommand: () => true,
    commandName: cmd.name,
    guildId: message.guildId,
    channelId: message.channelId,
    guild: message.guild,
    channel: message.channel,
    member: message.member,
    user: message.author,
    client: message.client,
    options: {
      _findOption: function(name) {
         // Flatten all options to find the one we need by name
         let allOpts = [];
         const recurse = (opts) => {
            if (!opts) return;
            for (const o of opts) {
               allOpts.push(o);
               if (o.options) recurse(o.options);
            }
         };
         recurse(cmd.options);
         
         const opt = allOpts.find(o => o.name === name);
         if (!opt) return null;
         
         // To find its index in args, we just filter out subcommands (type 1) and subcommand groups (type 2)
         // and we just match args sequentially to the remaining leaf options.
         // Wait, the user types: !ticket setup 123 456
         // args[0] = 'setup', args[1] = '123', args[2] = '456'
         
         const isSubcmd = cmd.options?.some(o => o.type === 1 || o.type === 2);
         let argOffset = isSubcmd ? 1 : 0;
         
         // Assuming linear option filling
         let leafOpts = allOpts.filter(o => o.type !== 1 && o.type !== 2);
         const idx = leafOpts.findIndex(o => o.name === name);
         
         if (idx !== -1) {
            return args[argOffset + idx] || null;
         }
         return null;
      },
      get: function(name) {
         const val = this._findOption(name);
         if (!val) return null;
         return { name: name, value: val };
      },
      getString: function(name) {
         return this._findOption(name);
      },
      getInteger: function(name) {
        const val = this._findOption(name);
        return val ? parseInt(val) : null;
      },
      getUser: function(name) {
        const val = this._findOption(name);
        if (!val) return null;
        const id = val.replace(/[^0-9]/g, '');
        return message.client.users.cache.get(id) || null;
      },
      getRole: function(name) {
        const val = this._findOption(name);
        if (!val) return null;
        const id = val.replace(/[^0-9]/g, '');
        return message.guild.roles.cache.get(id) || null;
      },
      getChannel: function(name) {
        const val = this._findOption(name);
        if (!val) return null;
        const id = val.replace(/[^0-9]/g, '');
        return message.guild.channels.cache.get(id) || null;
      },
      getSubcommand: function() {
        if (cmd.options?.some(o => o.type === 1)) {
          return args[0]?.toLowerCase() || null;
        }
        return null;
      }
    },
    deferred: false,
    replied: false,
    _replyMsg: null,
    deferReply: async function(opts) { 
       this.deferred = true; 
    },
    reply: async function(opts) {
       this.replied = true;
       if (typeof opts === 'string') opts = { content: opts };
       if (!opts.content && !opts.embeds && !opts.components) return; // Silent reply guard
       this._replyMsg = await message.reply(opts);
       return this._replyMsg;
    },
    editReply: async function(opts) {
       if (this._replyMsg) {
          return this._replyMsg.edit(opts);
       }
       return this.reply(opts);
    },
    followUp: async function(opts) {
       return this.reply(opts);
    }
  };
}
