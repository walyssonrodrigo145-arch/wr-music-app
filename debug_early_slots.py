import pty, os, time, select

test_cmd = """docker exec -i wr-music-app-app-1 pnpm exec tsx -e '
import { getDb } from "./server/db";
import { slotOffers, lessons, students, users, instruments } from "./drizzle/schema";
import { eq, and, gt, gte, lte, lt } from "drizzle-orm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

async function testSlotAdvance(userId, orgId) {
  const db = await getDb();
  console.log("=== Testing with lt() for userId:", userId);

  const [found] = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(and(
      eq(students.organizationId, orgId),
      eq(students.studentUserId, userId)
    ))
    .limit(1);

  const studentId = found?.id;
  const now = new Date();

  const [todayLesson] = await db
    .select({
      id: lessons.id,
      scheduledAt: lessons.scheduledAt,
      teacherId: lessons.userId,
      title: lessons.title,
    })
    .from(lessons)
    .where(and(
      eq(lessons.organizationId, orgId),
      eq(lessons.studentId, studentId),
      eq(lessons.status, "agendada")
    ))
    .orderBy(lessons.scheduledAt)
    .limit(1);

  console.log("Today Lesson:", todayLesson);

  const tolerance = new Date(now.getTime() - 4 * 3600 * 1000);

  const offers = await db
    .select({
      id: slotOffers.id,
      slotDate: slotOffers.slotDate,
      status: slotOffers.status,
      teacherId: slotOffers.teacherId,
    })
    .from(slotOffers)
    .where(and(
      eq(slotOffers.organizationId, orgId),
      eq(slotOffers.teacherId, todayLesson.teacherId),
      eq(slotOffers.status, "aberta"),
      gt(slotOffers.slotDate, tolerance),
      lt(slotOffers.slotDate, todayLesson.scheduledAt)
    ));

  console.log("SUCCESS! Matching Open Offers:", offers);
}

(async () => {
  await testSlotAdvance(1597, 1);
})();
'"""

pid, fd = pty.fork()
if pid == 0:
    os.execv('/usr/bin/ssh', ['ssh', '-o', 'StrictHostKeyChecking=no', 'root@179.197.76.174', test_cmd])
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
