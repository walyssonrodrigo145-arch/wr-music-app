const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function deploy() {
  try {
    console.log("Conectando à VPS...");
    await ssh.connect({
      host: '76.13.228.159',
      username: 'root',
      password: 'Walysson2003@'
    });
    console.log("Conectado com sucesso!");

    // We don't know the exact path of the project, so we'll look for it
    // Usually it's in /root/wr-music-app or /home/ubuntu/wr-music-app or /var/www/...
    // Let's run a find command or check standard locations
    
    console.log("Localizando o projeto 'wr-music-app'...");
    const { stdout: findOut } = await ssh.execCommand("find / -type d -name 'wr-music-app' -not -path '*/node_modules/*' -not -path '*/.npm/*' | head -n 1");
    
    const projectPath = findOut.trim();
    if (!projectPath) {
      console.log("Não consegui encontrar a pasta 'wr-music-app'. Verifique se o nome do diretório é outro.");
      process.exit(1);
    }
    
    console.log(`Projeto encontrado em: ${projectPath}`);
    
    // Command sequence
    console.log("Executando git pull...");
    const gitPullResult = await ssh.execCommand('git pull origin main', { cwd: projectPath });
    console.log(gitPullResult.stdout);
    if (gitPullResult.stderr) console.error(gitPullResult.stderr);
    
    console.log("Instalando dependências...");
    const npmIResult = await ssh.execCommand('npm install', { cwd: projectPath });
    console.log(npmIResult.stdout);
    
    console.log("Fazendo build do projeto...");
    const buildResult = await ssh.execCommand('npm run build', { cwd: projectPath });
    console.log(buildResult.stdout);
    if (buildResult.stderr) console.error(buildResult.stderr);
    
    console.log("Reiniciando a aplicação...");
    // Assuming pm2 is used and the process has a known name or we can just restart all or use systemctl
    const restartResult = await ssh.execCommand('pm2 restart all || npm run start', { cwd: projectPath });
    console.log(restartResult.stdout);
    
    console.log("Deploy concluído!");
  } catch (error) {
    console.error("Erro no deploy:", error);
  } finally {
    ssh.dispose();
  }
}

deploy();
