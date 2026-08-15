import pty, os, time, select

sql = """
SELECT s.id, s.name, s.email, s."studentUserId", s."organizationId", u.id as user_id, u.email as user_email, u.role as user_role 
FROM students s 
LEFT JOIN users u ON s."studentUserId" = u.id 
WHERE s.id = 362;

SELECT id, "originalLessonId", "teacherId", "slotDate", status, "expiresAt" FROM slot_offers ORDER BY id DESC LIMIT 5;

SELECT id, "studentId", "userId", "scheduledAt", status, "organizationId" FROM lessons WHERE "studentId" = 362 ORDER BY id DESC LIMIT 5;
"""

cmd = f"""cat << 'EOF' | docker exec -i wr-music-app-db-1 psql -U postgres -d wrmusic
{sql}
EOF
"""

pid, fd = pty.fork()
if pid == 0:
    os.execv('/usr/bin/ssh', ['ssh', '-o', 'StrictHostKeyChecking=no', 'root@179.197.76.174', cmd])
else:
    output = []
    start = time.time()
    pwd_sent = False
    while time.time() - start < 10:
        r, _, _ = select.select([fd], [], [], 0.5)
        if r:
            try:
                data = os.read(fd, 4096)
                if not data:
                    break
                text = data.decode('utf-8', errors='ignore')
                output.append(text)
                if 'password:' in text.lower() and not pwd_sent:
                    os.write(fd, b'Walysson2003@\n')
                    pwd_sent = True
            except Exception:
                break
    print(''.join(output))
