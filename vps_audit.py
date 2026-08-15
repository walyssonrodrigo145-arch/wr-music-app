import pty, os, time, sys

script_cmd = """
echo "=== [1] LEANDRO USER ==="
docker exec wr-music-app-db-1 psql -U postgres -d wrmusic -c "SELECT id, name, email, role, phone, \\"organizationId\\" FROM users WHERE name ILIKE '%leandro%' OR email ILIKE '%leandro%';"

echo "=== [2] SETTINGS TABLE (ALL USERS) ==="
docker exec wr-music-app-db-1 psql -U postgres -d wrmusic -c "SELECT s.id, s.\\"userId\\", u.name, u.email, u.role, s.\\"whatsappBotUrl\\", s.\\"whatsappBotToken\\", s.\\"whatsappAutoSend\\", s.\\"chatbotEnabled\\" FROM users u LEFT JOIN settings s ON u.id = s.\\"userId\\" ORDER BY u.id ASC;"
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
    with open('audit_out.txt', 'w') as f:
        f.write(res)
    print("DONE. Length:", len(res))
