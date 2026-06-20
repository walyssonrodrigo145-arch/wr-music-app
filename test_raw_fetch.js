async function main() {
  console.log("Starting login against production...");
  const loginRes = await fetch('https://wrmusicpro.com.br/api/trpc/auth.login?batch=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      "0": {
        "json": { "email": "admin@aladim.com.br", "password": "admin" } // Replace if needed
      }
    })
  });
  const cookies = loginRes.headers.get('set-cookie');
  console.log("Login OK, status:", loginRes.status);
  
  const payload = {
    "0": {
      "json": {
        "name": "Teste Prod Raw",
        "trigger": "payment_due",
        "offsetDays": 1,
        "offsetHours": 0,
        "messageTemplate": "Ola",
        "channel": "whatsapp",
        "isActive": 1
      }
    }
  };

  const createRes = await fetch('https://wrmusicpro.com.br/api/trpc/automations.create?batch=1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify(payload)
  });

  const text = await createRes.text();
  console.log("CREATE STATUS:", createRes.status);
  console.log("CREATE BODY:", text);
}

main().catch(console.error);
