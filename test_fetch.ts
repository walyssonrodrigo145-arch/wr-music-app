import superjson from 'superjson';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

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
  
  const client = createTRPCProxyClient<any>({
    links: [
      httpBatchLink({
        url: 'https://wrmusicpro.com.br/api/trpc',
        transformer: superjson,
        fetch: (url, opts) => {
          return fetch(url, {
            ...opts,
            headers: {
              ...opts?.headers,
              cookie: cookies || ''
            }
          });
        }
      })
    ]
  });

  try {
    console.log("Calling create...");
    const createRes = await client.automations.create.mutate({
      name: "Teste Prod Fix",
      trigger: "payment_due",
      offsetDays: 1,
      offsetHours: 0,
      messageTemplate: "Ola TESTE",
      channel: "whatsapp",
      isActive: 1
    });
    console.log("CREATE SUCCESS", createRes);
  } catch (err: any) {
    console.error("CREATE ERR:", err.message);
  }
}

main().catch(console.error);
