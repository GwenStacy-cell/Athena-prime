import { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder } from 'discord.js';
import { Chess } from 'chess.js';
import cv2 from '../cv2.js';

const THEMES = [
    { label: 'Tournament Green', value: 'tournament' },
    { label: 'Walnut Wood', value: 'walnut' },
    { label: 'Glass Board', value: 'glass' },
    { label: 'Burled Wood', value: 'burled_wood' },
    { label: 'Icy Sea', value: 'icy_sea' },
    { label: 'Bases', value: 'bases' },
    { label: '8-Bit Retro', value: '8_bit' },
    { label: 'Marble Texture', value: 'marble' },
    { label: 'Sky Blue', value: 'sky' },
    { label: 'Stone Texture', value: 'stone' },
    { label: 'Classic Brown', value: 'brown' },
    { label: 'Classic Green', value: 'green' },
    { label: 'Parchment', value: 'parchment' },
    { label: 'Lolz (Meme)', value: 'lolz' },
    { label: 'Graffiti', value: 'graffiti' },
    { label: 'Neon', value: 'neon' },
    { label: 'Dark Wood', value: 'dark' },
    { label: 'Nature', value: 'nature' },
    { label: 'Ocean', value: 'ocean' },
    { label: 'Newspaper', value: 'newspaper' }
];

export const commands = [
  {
    name: 'chess',
    description: 'Play a game of Chess against Cloud Stockfish 16.1 or a friend!',
    category: 'engagement',
    permissions: [],
    async executePrefix(message, args) {
      if (!args[0]) {
        return message.reply(cv2.info('Athena Chess', 'Usage:\n`!chess ai` - Play against Cloud Stockfish\n`!chess @user` - Play against a friend\n`!chess theme` - Change board style\n`!chess stop` - End current game'));
      }
      
      const client = message.client;
      if (!client.chessGames) client.chessGames = new Map();
      
      if (args[0].toLowerCase() === 'theme' || args[0].toLowerCase() === 'themes') {
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('chess_theme_select')
                .setPlaceholder('Select a Chessboard Theme...')
                .addOptions(THEMES.slice(0, 20))
        );
        
        const container = {
            type: 17,
            components: [
                { type: 10, content: '## **Athena Theme Configuration**' },
                { type: 14, divider: true },
                { type: 10, content: '-# **Please select your preferred chessboard aesthetic from the dropdown below.**' }
            ]
        };
        
        return message.reply({ 
            components: [container, row.toJSON()], 
            flags: MessageFlags.IsComponentsV2 
        }).catch(async (e) => {
            await message.reply({ content: '-# **Select your preferred Chessboard aesthetic:**', components: [row] }).catch(()=>null);
        });
      }
      
      if (args[0].toLowerCase() === 'stop' || args[0].toLowerCase() === 'resign') {
        const game = client.chessGames.get(message.author.id);
        if (!game) return message.reply(cv2.warn('No Active Game', 'You do not have an active chess game.'));
        
        client.chessGames.delete(game.playerWhite);
        client.chessGames.delete(game.playerBlack);
        
        return message.reply(cv2.success('Game Ended', 'You resigned. The chess game has been stopped.'));
      }
      
      if (client.chessGames.has(message.author.id)) {
        return message.reply(cv2.warn('Game in Progress', 'You already have an active game! Type `!chess stop` to end it.'));
      }
      
      const isAI = args[0].toLowerCase() === 'ai' || args[0].toLowerCase() === 'bot';
      const targetUser = message.mentions.users.first();
      
      if (!isAI && !targetUser) {
         return message.reply(cv2.info('Athena Chess', 'Usage:\n`!chess ai` - Play against Stockfish\n`!chess @user` - Play against a friend\n`!chess theme` - Change board style'));
      }
      
      if (targetUser && targetUser.id === message.author.id) {
         return message.reply(cv2.warn('Invalid Target', 'You cannot play against yourself.'));
      }
      
      if (targetUser && targetUser.bot) {
         return message.reply(cv2.warn('Invalid Target', 'You cannot challenge other bots. Use `!chess ai` to play against me!'));
      }
      
      const newGame = {
         id: message.author.id,
         chess: new Chess(),
         playerWhite: message.author.id,
         playerBlack: isAI ? 'ai' : targetUser.id,
         channelId: message.channel.id,
         theme: client.globalChessTheme || 'tournament',
         lastMessage: null,
         lastMoveText: null
      };
      
      client.chessGames.set(newGame.playerWhite, newGame);
      if (!isAI) client.chessGames.set(newGame.playerBlack, newGame);
      
      await renderBoard(message.channel, newGame);
    }
  }
];

function tryMove(game, moveStr) {
    const attempts = [
        moveStr,
        moveStr.toLowerCase(),
        moveStr.charAt(0).toUpperCase() + moveStr.slice(1).toLowerCase(),
        moveStr.charAt(0).toUpperCase() + moveStr.slice(1)
    ];
    for (const attempt of attempts) {
        try {
            const move = game.chess.move(attempt);
            if (move) return move;
        } catch(e) {}
    }
    return null;
}

export async function handleChessMove(message) {
    if (message.author.bot) return;
    
    if (message.content.startsWith('!') || message.content.startsWith('?')) return;
    
    const client = message.client;
    if (!client.chessGames || !client.chessGames.has(message.author.id)) return;
    
    const game = client.chessGames.get(message.author.id);
    if (game.channelId !== message.channel.id) return;
    
    const isWhiteTurn = game.chess.turn() === 'w';
    if (isWhiteTurn && message.author.id !== game.playerWhite) return;
    if (!isWhiteTurn && message.author.id !== game.playerBlack) return;
    
    const moveStrRaw = message.content.trim().split(' ')[0];
    if (!moveStrRaw || moveStrRaw.length < 2) return;
    
    const moveStrLower = moveStrRaw.toLowerCase();
    if (moveStrLower === 'chess') return;
    
    const userRole = isWhiteTurn ? 'White' : 'Black';
    const moveResult = tryMove(game, moveStrRaw);
    
    if (!moveResult) {
        const tempMsg = await message.reply(`-# **Illegal Move:** \`${moveStrRaw}\``).catch(()=>null);
        if (tempMsg) setTimeout(() => tempMsg.delete().catch(()=>null), 4000);
        message.delete().catch(()=>null);
        return;
    }
    
    game.lastMoveText = `-# **${userRole} moved \`${moveResult.san}\`**`;
    message.delete().catch(()=>null);
    if (game.lastMessage) game.lastMessage.delete().catch(()=>null);
    
    if (game.chess.isGameOver()) {
        await renderBoard(message.channel, game, true);
        client.chessGames.delete(game.playerWhite);
        if (game.playerBlack !== 'ai') client.chessGames.delete(game.playerBlack);
        return;
    }
    
    await renderBoard(message.channel, game);
    
    if (game.playerBlack === 'ai' && game.chess.turn() === 'b') {
        const aiMessage = await message.channel.send(`-# <a:loading:1542155051286396938> **Athena's Cloud Stockfish is calculating...**`);
        
        try {
            const fen = encodeURIComponent(game.chess.fen());
            const res = await fetch(`https://stockfish.online/api/s/v2.php?fen=${fen}&depth=12`);
            const data = await res.json();
            
            if (data.success && data.bestmove) {
                const best = data.bestmove.split(' ')[1];
                if (best) {
                    const aiMoveResult = tryMove(game, best);
                    aiMessage.delete().catch(()=>null);
                    if (game.lastMessage) game.lastMessage.delete().catch(()=>null);
                    
                    if (aiMoveResult) {
                        game.lastMoveText = `-# **Stockfish moved \`${aiMoveResult.san}\`**`;
                    }
                    
                    if (game.chess.isGameOver()) {
                        await renderBoard(message.channel, game, true);
                        client.chessGames.delete(game.playerWhite);
                    } else {
                        await renderBoard(message.channel, game);
                    }
                }
            }
        } catch (err) {
            aiMessage.edit('-# **Stockfish Cloud API is currently busy. Please wait a moment and type your move again.**').catch(()=>null);
            game.chess.undo();
            await renderBoard(message.channel, game);
        }
    }
}

export async function handleChessThemeSelect(interaction) {
    await interaction.deferUpdate().catch(()=>{});
    
    const theme = interaction.values[0];
    const fen = new Chess().fen();
    const encodedFen = encodeURIComponent(fen);
    const imageUrl = `https://www.chess.com/dynboard?fen=${encodedFen}&board=${theme}&piece=neo&size=3`;
    
    const rowSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('chess_theme_select')
            .setPlaceholder(`Previewing: ${theme}`)
            .addOptions(THEMES.slice(0, 20))
    );
    
    const rowButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`chess_theme_apply_${theme}`)
            .setLabel('Apply Theme')
            .setStyle(ButtonStyle.Secondary)
    );
    
    // Discord API explicitly rejects Type 11 (Media) inside Type 17 (Container).
    // The only way to send a large image while keeping the dark borderless aesthetic
    // is a standard embed colored 0x2b2d31, which perfectly blends into Discord's background.
    const embed = new EmbedBuilder()
        .setTitle(`Theme Preview: ${theme}`)
        .setImage(imageUrl + '&ext=.png')
        .setColor(0x2b2d31);
        
    if (interaction.message.flags.has(MessageFlags.IsComponentsV2)) {
        await interaction.message.delete().catch(()=>null);
        await interaction.channel.send({
            embeds: [embed],
            components: [rowSelect, rowButton]
        }).catch(()=>null);
    } else {
        await interaction.editReply({
            content: '',
            embeds: [embed],
            components: [rowSelect, rowButton],
            flags: 0
        }).catch(()=>null);
    }
}

export async function handleChessThemeApply(interaction) {
    await interaction.deferUpdate().catch(()=>{});
    
    const theme = interaction.customId.replace('chess_theme_apply_', '');
    interaction.client.globalChessTheme = theme;
    
    if (interaction.client.chessGames && interaction.client.chessGames.has(interaction.user.id)) {
        const game = interaction.client.chessGames.get(interaction.user.id);
        game.theme = theme;
        await interaction.message.delete().catch(()=>null);
        if (game.lastMessage) game.lastMessage.delete().catch(()=>null);
        await renderBoard(interaction.channel, game, game.chess.isGameOver());
        const confirmMsg = await interaction.channel.send(`-# **Theme updated seamlessly in your active game!**`).catch(()=>null);
        if (confirmMsg) setTimeout(() => confirmMsg.delete().catch(()=>null), 4000);
    } else {
        await interaction.editReply({ 
            content: `-# **Theme successfully applied! Future games will use the ${theme} aesthetic.**`, 
            components: [], 
            embeds: [],
            files: [],
            flags: 0 
        }).catch(()=>null);
    }
}

async function renderBoard(channel, game, isGameOver = false) {
    const fen = game.chess.fen();
    const encodedFen = encodeURIComponent(fen);
    const imageUrl = `https://www.chess.com/dynboard?fen=${encodedFen}&board=${game.theme}&piece=neo&size=3`;
    
    let statusText = '';
    if (isGameOver) {
        if (game.chess.isCheckmate()) statusText = '-# **CHECKMATE!**';
        else if (game.chess.isDraw()) statusText = '-# **DRAW!**';
        else statusText = '-# **GAME OVER!**';
    } else {
        const turnUser = game.chess.turn() === 'w' ? `<@${game.playerWhite}>` : (game.playerBlack === 'ai' ? '**Athena (Stockfish)**' : `<@${game.playerBlack}>`);
        statusText = `-# **Turn:** ${turnUser}\n-# Type your move in chat (e.g. \`e4\`, \`Nf3\`).\n-# Type \`!chess stop\` to resign.`;
    }
    
    if (game.lastMoveText) {
        statusText = `${game.lastMoveText}\n\n${statusText}`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('Athena Grandmaster Chess')
        .setDescription(statusText)
        .setImage(imageUrl + '&ext=.png')
        .setColor(0x2b2d31)
        .setFooter({ text: 'Powered by Cloud Stockfish & Chess.com API' });
    
    let msg = await channel.send({ 
        embeds: [embed],
        flags: 0 
    }).catch(async (e) => {
        console.error('[Chess] Failed to send board embed:', e);
        return null;
    });
    
    if (msg) game.lastMessage = msg;
}
