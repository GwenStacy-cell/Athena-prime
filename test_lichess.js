import https from 'https';
https.get('https://lichess1.org/export/fen.gif?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1&theme=brown&piece=cburnett', (res) => console.log(res.statusCode));
