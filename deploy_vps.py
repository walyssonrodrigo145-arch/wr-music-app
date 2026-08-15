import pty, os, time, select, sys

script_cmd = """
set -e
cd /root/wr-music-app
echo "=== [1] GIT PULL ==="
git reset --hard HEAD
git pull origin main

echo "=== [2] BUILD DOCKER COMPOSE ==="
docker compose build --no-cache app
docker compose up -d --force-recreate app

echo "=== [3] VERIFY CONTAINER ==="
docker ps | grep wr-music-app
"""

print("🚀 Starting VPS deployment...")
pid, fd = pty.fork()
if pid == 0:
    os.execv('/usr/bin/ssh', ['ssh', '-o', 'StrictHostKeyChecking=no', 'root@179.197.76.174', script_cmd])
else:
    output = []
    start = time.time()
    pwd_sent = False
    
    # 5 minutes timeout for full rebuild
    while time.time() - start < 300:
        r, _, _ = select.select([fd], [], [], 0.5)
        if r:
            try:
                data = os.read(fd, 4096)
                if not data:
                    break
                text = data.decode('utf-8', errors='ignore')
                output.append(text)
                sys.stdout.write(text)
                sys.stdout.flush()
                if 'password:' in text.lower() and not pwd_sent:
                    os.write(fd, b'Walysson2003@\n')
                    pwd_sent = True
            except Exception as e:
                print(f"Error reading output: {e}")
                break
        
        # Check if process exited
        pid_res, status = os.waitpid(pid, os.WNOHANG)
        if pid_res != 0:
            # Read remaining output
            try:
                while True:
                    data = os.read(fd, 4096)
                    if not data:
                        break
                    sys.stdout.write(data.decode('utf-8', errors='ignore'))
                    sys.stdout.flush()
            except Exception:
                pass
            print(f"\n✅ Deployment process finished with exit code {status >> 8} in {int(time.time() - start)}s.")
            break
