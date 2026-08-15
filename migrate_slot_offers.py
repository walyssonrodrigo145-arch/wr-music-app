import pty, os, time, select

migration_sql = """
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "autoAdvanceSlotsEnabled" integer DEFAULT 1 NOT NULL;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "autoAdvanceWhatsAppTemplate" text;

CREATE TABLE IF NOT EXISTS slot_offers (
  id serial PRIMARY KEY,
  "organizationId" integer,
  "originalLessonId" integer NOT NULL,
  "teacherId" integer NOT NULL,
  "slotDate" timestamp NOT NULL,
  duration integer DEFAULT 60 NOT NULL,
  "instrumentId" integer,
  title varchar(255),
  status varchar(20) DEFAULT 'aberta' NOT NULL,
  "acceptedByStudentId" integer,
  "acceptedLessonId" integer,
  "acceptedAt" timestamp,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT NOW() NOT NULL,
  "updatedAt" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS slot_offers_org_status_idx ON slot_offers ("organizationId", status);
CREATE INDEX IF NOT EXISTS slot_offers_slot_date_idx ON slot_offers ("slotDate");
"""

full_script = f"""cat << 'EOF' | docker exec -i wr-music-app-db-1 psql -U postgres -d wrmusic
{migration_sql}
EOF
"""

print("🚀 Running DB migrations for slot_offers on VPS...")
pid, fd = pty.fork()
if pid == 0:
    os.execv('/usr/bin/ssh', ['ssh', '-o', 'StrictHostKeyChecking=no', 'root@179.197.76.174', full_script])
else:
    output = []
    start = time.time()
    pwd_sent = False
    while time.time() - start < 15:
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
