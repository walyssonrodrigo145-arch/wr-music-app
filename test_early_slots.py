import pty, os, time, select

sql = """
SELECT 
  so.id as offer_id,
  so."slotDate",
  so.status,
  so."teacherId",
  l.id as student_lesson_id,
  l."scheduledAt" as student_lesson_time,
  s.name as student_name
FROM slot_offers so
JOIN lessons l ON l."userId" = so."teacherId" AND l."scheduledAt" > so."slotDate" AND l.status = 'agendada'
JOIN students s ON l."studentId" = s.id
WHERE so.status = 'aberta' AND s."studentUserId" = 1597;
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
