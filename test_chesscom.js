import https from 'https';
https.get('https://www.chess.com/dynboard?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1&board=green&piece=neo&size=2', (res) => console.log(res.statusCode));
