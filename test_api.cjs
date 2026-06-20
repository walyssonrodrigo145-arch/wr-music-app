const http = require('http');

const data = JSON.stringify({
  "0": {
    "json": {
      "name": "Teste",
      "trigger": "payment_due",
      "messageTemplate": "Ola"
    }
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/trpc/automations.create?batch=1',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let out = '';
  res.on('data', d => {
    out += d;
  });
  res.on('end', () => {
    console.log(out);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
