import re
import os

filepath = r"c:\Users\walysson\Downloads\wr-music-app-main\server\automationJob.ts"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add allowAutoReminders to all select queries that fetch from students
# We'll just look for 'birthDate: students.birthDate,' and append 'allowAutoReminders: students.allowAutoReminders,'
content = re.sub(
    r'(birthDate:\s*students\.birthDate,)',
    r'\1\n                  allowAutoReminders: students.allowAutoReminders,',
    content
)

# 2. Add continue if allowAutoReminders is false
# We'll inject this inside the loops for 'due', 'lesson', 'student', 'inactive' etc.
content = re.sub(
    r'(for \s*\(const\s+(\w+)\s+of\s+\w+\)\s*\{)',
    r'\1\n                if (\2.allowAutoReminders === false || \2.allowAutoReminders === 0) continue;',
    content
)

# 3. Replace the age calculation and sendWhatsAppMessage block with sendSmartWhatsAppNotification
# Pattern to replace:
# let targetPhone = ...
# if (XYZ.birthDate) { ... }
# if (!targetPhone) continue;
# await db.insert(reminders)...
# if (userSet.whatsappAutoSend...
# ...
#   if (sendRes.success) { ... }
# }

# This is a bit too complex for regex. I will write a more surgical replace.

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Regex replacements applied")
