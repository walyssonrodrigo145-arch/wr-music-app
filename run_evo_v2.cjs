const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", () => {
  console.log("Enviando e executando script...");
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut("evo_run.sh", "/root/evo_run.sh", (err) => {
      if (err) { console.error(err); conn.end(); return; }
      conn.exec("chmod +x /root/evo_run.sh && bash /root/evo_run.sh", (err, stream) => {
        if (err) throw err;
        stream.on("close", () => { console.log("\n? Feito!"); conn.end(); })
          .on("data", d => process.stdout.write(d.toString()))
          .stderr.on("data", d => process.stderr.write(d.toString()));
      });
    });
  });
}).connect({ host: "76.13.228.159", port: 22, username: "root", password: "Walysson2003@" });
