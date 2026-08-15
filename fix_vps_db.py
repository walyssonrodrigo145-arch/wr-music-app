import pty, os, time, sys

script_cmd = """
echo "=== [1] FIXING SETTINGS FOR LEANDRO (1598) AND ALL USERS WITH NULL URL ==="
docker exec wr-music-app-db-1 psql -U postgres -d wrmusic -c "
UPDATE settings 
SET 
  \\"whatsappBotUrl\\" = 'http://179.197.76.174:8080',
  \\"whatsappBotToken\\" = 'minha_chave_secreta_123'
WHERE \\"whatsappBotUrl\\" IS NULL OR \\"whatsappBotUrl\\" = '';
"

echo "=== [2] VERIFYING SETTINGS FOR LEANDRO (1598) ==="
docker exec wr-music-app-db-1 psql -U postgres -d wrmusic -c "
SELECT s.id, s.\\"userId\\", u.name, u.email, u.role, s.\\"whatsappBotUrl\\", s.\\"whatsappBotToken\\"
FROM users u
LEFT JOIN settings s ON u.id = s.\\"userId\\"
WHERE u.id = 1598 OR u.name ILIKE '%leandro%';
"
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
    while time.time() - start < 15:
        try:
            data = os.read(fd, 4096)
            if not data:
                break
            text = data.decode('utf-8', errors='ignore')
            output.append(text)
            if 'password:' in text.lower():
                os.write(fd, b'Walysson2003@\n')
        except Exception:
            break
    
    res = "".join(output)
    print("OUTPUT:\n", res)
