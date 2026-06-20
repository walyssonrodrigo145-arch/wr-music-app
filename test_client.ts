import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import fetch from "node-fetch";

// Assuming we bypass auth or use a test route. Let's create a test client.
const client = createTRPCProxyClient<any>({
  links: [
    httpBatchLink({
      url: "http://localhost:3000/api/trpc",
      transformer: superjson,
      fetch: fetch as any,
    }),
  ],
});

async function main() {
  try {
    const res = await client.automations.create.mutate({
      name: "Teste",
      trigger: "payment_due",
      offsetDays: 1,
      offsetHours: 0,
      messageTemplate: "Ola",
      channel: "whatsapp",
      isActive: 1
    });
    console.log("SUCCESS:", res);
  } catch (err: any) {
    console.error("ERROR CAUGHT:");
    console.error(err.message);
    if (err.shape) console.error("SHAPE:", err.shape);
    if (err.data) console.error("DATA:", err.data);
  }
}

main();
