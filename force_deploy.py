import pty, os, time, sys

script_cmd = """
cd /root/wr-music-app || cd $(find / -maxdepth 3 -type d -name "wr-music-app" | head -n 1)
echo "=== [1] RESET LOCAL CHANGES AND PULL ==="
git reset --hard HEAD
git pull origin main

echo "=== [2] REBUILD AND RESTART ==="
docker compose up -d --build

echo "=== [3] VERIFY CONTAINER STATUS ==="
docker ps | grep wr-music-app
"""

pid, fd = pty.fork()
if pid == 0:
    os.execv('/usr/bin/ssh', ['ssh', '-o', 'StrictHostKeyChecking=no', 'root@179.197.76.174', script_cmd])
else:
    output = []
    time.sleep(1)
    try:
        buf = os.read(fd, 4096)
        output.append(buf.decode('utf-8', errors='ignore'))
        if 'password:' in buf.decode('utf-8', errors='ignore').lower():
            os.write(fd, b'Walysson2003@\n')
    except Exception as e:
        output.append(str(e))
    
    start = time.time()
    while time.time() - start < 60:
        try:
            data = os.read(fd, 4096)
            if not data:
                break
            text = data.decode('utf-8', errors='ignore')
            output.append(text)
            print(text, end="")
            if 'password:' in text.lower():
                os.write(fd, b'Walysson2003@\n')
        except Exception:
            break
