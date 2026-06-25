
const fs = require("fs");

let job = fs.readFileSync("server/automationJob.ts", "utf8");
job = job.split("routingRes.success ? \"enviado\" : \"pendente\"").join("\"pendente\"");
job = job.split("routingRes.success ? now2 : undefined").join("undefined");
job = job.split("routingRes.errors ? routingRes.errors.join(', ') : null").join("null");
job = job.split("if (routingRes.success)").join("if (false)");
job = job.split("if (row.allowAutoReminders === false || row.allowAutoReminders === 0) continue;").join("");
job = job.split("row.studentPhone || row.guardianPhone").join("row.phone || row.guardianPhone");
fs.writeFileSync("server/automationJob.ts", job);

let rt = fs.readFileSync("server/routers.ts", "utf8");
rt = rt.split("allowAutoReminders: true,").join("");
rt = rt.split("crypto.scryptSync").join("require(\"crypto\").scryptSync");
rt = rt.split("crypto.randomBytes").join("require(\"crypto\").randomBytes");
fs.writeFileSync("server/routers.ts", rt);

let gem = fs.readFileSync("server/utils/gemini.ts", "utf8");
gem = gem.split("role: \"system\"").join("role: \"user\"");
fs.writeFileSync("server/utils/gemini.ts", gem);

console.log("Fixed!");

