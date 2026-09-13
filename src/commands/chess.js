import { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { Chess } from 'chess.js';
import cv2 from '../cv2.js';

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
         chess: new Chess(),
         playerWhite: message.author.id,
         playerBlack: isAI ? 'ai' : targetUser.id,
         channelId: message.channel.id,
         lastMessage: null
      };
      
      client.chessGames.set(newGame.playerWhite, newGame);
      if (!isAI) client.chessGames.set(newGame.playerBlack, newGame);
      
      await renderBoard(message.channel, newGame);
    }
  }
];

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
    
    try {
        game.chess.move(moveStr); // throws if invalid
        message.delete().catch(()=>null);
        if (game.lastMessage) game.lastMessage.delete().catch(()=>null);
        
        if (game.chess.isGameOver()) {
            await renderBoard(message.channel, game, true);
            client.chessGames.delete(game.playerWhite);
            if (game.playerBlack !== 'ai') client.chessGames.delete(game.playerBlack);
            return;
        }
        
        await renderBoard(message.channel, game);
        
        // If PvE, trigger AI move
        if (game.playerBlack === 'ai' && game.chess.turn() === 'b') {
            const aiMessage = await message.channel.send("<a:loading:1542155051286396938> *Athena's Cloud Stockfish is calculating...*");
            
            try {
                const fen = encodeURIComponent(game.chess.fen());
                const res = await fetch(`https://stockfish.online/api/s/v2.php?fen=${fen}&depth=12`);
                const data = await res.json();
                
                if (data.success && data.bestmove) {
                    const best = data.bestmove.split(' ')[1]; // "bestmove e2e4 ponder c7c5"
                    if (best) {
                        game.chess.move(best);
                        aiMessage.delete().catch(()=>null);
                        if (game.lastMessage) game.lastMessage.delete().catch(()=>null);
                        
                        if (game.chess.isGameOver()) {
                            await renderBoard(message.channel, game, true);
                            client.chessGames.delete(game.playerWhite);
                        } else {
                            await renderBoard(message.channel, game);
                        }
                    }
                }
            } catch (err) {
                aiMessage.edit('*Stockfish Cloud API is currently busy. Please wait a moment and type your move again.*').catch(()=>null);
                // Revert turn so user can try again or wait
                game.chess.undo();
                await renderBoard(message.channel, game);
            }
        }
    } catch(e) {}
}

async function renderBoard(channel, game, isGameOver = false) {
    const fen = game.chess.fen();
    const encodedFen = encodeURIComponent(fen);
    const imageUrl = `https://fen2image.chessvision.ai/${encodedFen}`;
    
    let statusText = '';
    if (isGameOver) {
        if (game.chess.isCheckmate()) statusText = '🏆 **Checkmate!**';
        else if (game.chess.isDraw()) statusText = '🤝 **Draw!**';
        else statusText = '🏁 **Game Over!**';
    } else {
        const turnUser = game.chess.turn() === 'w' ? `<@${game.playerWhite}>` : (game.playerBlack === 'ai' ? '**Athena (Stockfish)**' : `<@${game.playerBlack}>`);
        statusText = `🔄 Turn: ${turnUser}\nType your move in chat (e.g. \`e4\`, \`Nf3\`).\nType \`!chess stop\` to resign.`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('♟️ Athena Grandmaster Chess')
        .setDescription(statusText)
        .setImage(imageUrl)
        .setColor(0x2b2d31)
        .setFooter({ text: 'Powered by Cloud Stockfish 16.1 API & chess.js' });
        
    const msg = await channel.send({ embeds: [embed] }).catch(()=>null);
    game.lastMessage = msg;
}
