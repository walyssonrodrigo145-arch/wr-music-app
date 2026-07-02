const http = require('http');

http.get('http://76.13.228.159', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log("STATUS CODE:", res.statusCode);
    if(data.includes('VITE_ANALYTICS_ENDPOINT')) {
      console.log('INDEX HTML ENCONTRADO!');
    } else {
      console.log("HTML RETORNADO:", data.substring(0, 500));
    }
  });
}).on('error', (err) => console.log('ERRO HTTP:', err.message));
