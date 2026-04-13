console.log("DB URL:", process.env.DATABASE_URL);
console.log("All env:", Object.keys(process.env).filter(k => k.includes("DB") || k.includes("URL")));
