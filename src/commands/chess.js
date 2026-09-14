import { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { Chess } from 'chess.js';
import cv2 from '../cv2.js';

const THEMES = [
    { label: 'Brown Classic', value: 'brown' },
    { label: 'Blue Modern', value: 'blue' },
    { label: 'Green Board', value: 'green' },
    { label: 'Purple Dark', value: 'purple' },
    { label: 'Wood Texture', value: 'wood' },
    { label: 'Maple Texture', value: 'maple' },
    { label: 'Blue Alt', value: 'blue3' },
    { label: 'Canvas Fabric', value: 'canvas' },
    { label: 'Metal Steel', value: 'metal' },
    { label: 'Pink Aesthetic', value: 'pink' }
];

export const commands = [
  {
    name: 'chess',
    description: 'Play a game of Chess against Cloud Stockfish 16.1 or a friend!',
    category: 'engagement',
    permissions: [],
    async executePrefix(message, args) {
      if (!args[0]) {
        return message.reply(cv2.info('Athena Chess', 'Usage:\n`!chess ai` - Play against Cloud Stockfish\n`!chess @user` - Play against a friend\n`!chess stop` - End current game'));
      }
      
      const client = message.client;
      if (!client.chessGames) client.chessGames = new Map();
      
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
         return message.reply(cv2.info('Athena Chess', 'Usage:\n`!chess ai` - Play against Stockfish\n`!chess @user` - Play against a friend'));
      }
      
      if (targetUser && targetUser.id === message.author.id) {
         return message.reply(cv2.warn('Invalid Target', 'You cannot play against yourself.'));
      }
      
      if (targetUser && targetUser.bot) {
         return message.reply(cv2.warn('Invalid Target', 'You cannot challenge other bots. Use `!chess ai` to play against me!'));
      }
      
      const newGame = {
         id: message.author.id, // Game ID
         chess: new Chess(),
         playerWhite: message.author.id,
         playerBlack: isAI ? 'ai' : targetUser.id,
         channelId: message.channel.id,
         theme: 'brown',
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
    const client = message.client;
    if (!client.chessGames || !client.chessGames.has(message.author.id)) return;
    
    const game = client.chessGames.get(message.author.id);
    if (game.channelId !== message.channel.id) return;
    
    const isWhiteTurn = game.chess.turn() === 'w';
    if (isWhiteTurn && message.author.id !== game.playerWhite) return;
    if (!isWhiteTurn && message.author.id !== game.playerBlack) return;
    
    const moveStr = message.content.trim().split(' ')[0];
    const userRole = isWhiteTurn ? 'White' : 'Black';
    
    const moveResult = tryMove(game, moveStr);
    
    if (!moveResult) {
        const tempMsg = await message.reply(`-# **Illegal Move:** \`${moveStr}\``).catch(()=>null);
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
        const aiMessage = await message.channel.send("<a:loading:1542155051286396938> `-# **Athena's Cloud Stockfish is calculating...**`");
        
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

export async function handleChessThemeMenu(interaction) {
    const theme = interaction.values[0];
    const client = interaction.client;
    
    if (!client.chessGames || !client.chessGames.has(interaction.user.id)) {
        return interaction.reply({ content: 'You are not in an active chess game!', flags: MessageFlags.Ephemeral });
    }
    
    const game = client.chessGames.get(interaction.user.id);
    game.theme = theme;
    
    await interaction.update({ content: `-# **Applying ${theme} theme...**`, components: [] });
    if (game.lastMessage) game.lastMessage.delete().catch(()=>null);
    await renderBoard(interaction.channel, game, game.chess.isGameOver());
}

async function renderBoard(channel, game, isGameOver = false) {
    const fen = game.chess.fen();
    const encodedFen = encodeURIComponent(fen);
    const imageUrl = `https://lichess1.org/export/fen.gif?fen=${encodedFen}&theme=${game.theme}&piece=cburnett`;
    
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
    
    const components = [
        {
            type: 17, // Container
            components: [
                {
                    type: 9, // Section
                    components: [{ type: 10, content: '**Athena Grandmaster Chess**' }],
                    accessory: {
                        type: 11, // Thumbnail
                        media: { url: 'https://i.imgur.com/kSXY8bC.png' } // A nice chess knight icon
                    }
                },
                { type: 14, divider: true },
                {
                    type: 10, // Text
                    content: statusText
                },
                {
                    type: 11, // Image block inside container (if CV2 supports it, else we use standard image accessory)
                    media: { url: imageUrl }
                },
                { type: 14, divider: true },
                {
                    type: 10,
                    content: `-# Powered by Cloud Stockfish & Lichess API`
                }
            ]
        }
    ];
    
    // Wait, CV2 type 11 accessory in type 17 container isn't a massive banner image. 
    // CV2 handles large images via Message options `files` or `embeds`.
    // Since we want borderless CV2, maybe we just use standard `cv2` rendering but attach an embed with JUST the image.
    // Or we can use a TextDisplayBuilder with the image URL which Discord auto-embeds natively!
    // But Discord native auto-embeds have a side color border.
    
    const embed = {
        image: { url: imageUrl },
        color: 0x2b2d31 // matches background exactly to appear borderless
    };
    
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('chess_theme')
            .setPlaceholder('Change Chessboard Theme...')
            .addOptions(THEMES)
    );
    
    const container = {
        type: 17,
        components: [
            {
                type: 9,
                components: [{ type: 10, content: '**Athena Grandmaster Chess**' }],
            },
            { type: 14, divider: true },
            { type: 10, content: statusText }
        ]
    };
    
    const msg = await channel.send({ 
        components: [container, row], 
        embeds: [embed], 
        flags: MessageFlags.IsComponentsV2 
    }).catch(()=>null);
    
    game.lastMessage = msg;
}
