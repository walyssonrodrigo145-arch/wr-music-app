fetch("http://localhost:3000/api/trpc/system.forceMigrations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({})
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
