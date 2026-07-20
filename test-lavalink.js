import http from 'http';

const options = {
  hostname: '54.91.178.110',
  port: 2333,
  path: '/version',
  method: 'GET',
  headers: {
    'Authorization': 'Prince12'
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('--- LAVALINK VERSION ---');
    console.log(data);
  });
});

req.on('error', error => {
  console.error('--- LAVALINK CONNECTION ERROR ---');
  console.error(error);
});

req.end();
