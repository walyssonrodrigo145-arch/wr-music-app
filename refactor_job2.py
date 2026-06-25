import re

filepath = r"c:\Users\walysson\Downloads\wr-music-app-main\server\automationJob.ts"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace targetPhone block
pattern = re.compile(
    r"let targetPhone = ([^;]+);[\s\S]*?(?=await db\.insert\(reminders\)\.values)", 
    re.MULTILINE
)

# Wait, we don't want to replace `await db.insert(reminders).values`.
# We want to replace everything from `let targetPhone = ` up to the end of the `if (userSet.whatsappAutoSend === 1` block.
# Actually, the logic is:
# let targetPhone = ...
# if (!targetPhone) continue;
# await db.insert(reminders).values({...});
# if (userSet.whatsappAutoSend === 1 && userSet.whatsappBotUrl) {
#   const sendRes = await sendWhatsAppMessage({ ... });
#   ...
# }
#
# Because there are slight variations in the insert parameters (due.studentId vs lesson.studentId vs student.id), 
# I will use a regex that matches the targetPhone logic, deletes it, and then replaces the `sendWhatsAppMessage` block.

def replacer(match):
    var_name = match.group(1).split('.')[0] # e.g. "due", "lesson", "student", "inactive"
    return f"""
                const routingRes = await sendSmartWhatsAppNotification({{
                  sendToStudent: (rule as any).sendToStudent === 1 || (rule as any).sendToStudent === undefined,
                  sendToGuardian: (rule as any).sendToGuardian === 1,
                  student: {{ phone: {var_name}.studentPhone || {var_name}.phone, guardianPhone: {var_name}.guardianPhone }},
                  message,
                  sessionId: `prof_${{userId}}`,
                  whatsappConfig: {{ url: userSet.whatsappBotUrl, token: userSet.whatsappBotToken }}
                }});

                if (!routingRes.success && (!routingRes.errors || routingRes.errors[0] === "Nenhum telefone válido encontrado para envio.")) continue;

"""

content = re.sub(
    r"let targetPhone = ([a-zA-Z0-9_]+)\.(studentPhone|phone);[\s\S]*?if \(!targetPhone\) continue;\s*",
    replacer,
    content
)

def send_whatsapp_replacer(match):
    # This replaces the `if (userSet.whatsappAutoSend === 1 ...` block with the new result handling
    return """
                if (userSet.whatsappAutoSend === 1 && userSet.whatsappBotUrl) {
                  const [newRem] = await db.select({ id: reminders.id }).from(reminders).where(eq(reminders.refId, refId)).limit(1);
                  if (newRem) {
                    await db.update(reminders).set({
                      status: routingRes.success ? "enviado" : "pendente",
                      sentAt: routingRes.success ? now2 : undefined,
                      errorMessage: routingRes.errors ? routingRes.errors.join(', ') : null,
                      updatedAt: new Date(),
                    }).where(eq(reminders.id, newRem.id));
                  }
                  if (routingRes.success) {
                    await db.update(messageAutomationRules).set({ totalSent: (rule.totalSent ?? 0) + 1, lastExecutedAt: now2, updatedAt: new Date() }).where(eq(messageAutomationRules.id, rule.id));
                  }
                }
"""

content = re.sub(
    r"if \(userSet\.whatsappAutoSend === 1 && userSet\.whatsappBotUrl\) \{[\s\S]*?const sendRes = await sendWhatsAppMessage\(\{[\s\S]*?\}\);[\s\S]*?if \(sendRes\.success\) \{[\s\S]*?\}\s*\}",
    send_whatsapp_replacer,
    content
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("WhatsApp send logic replaced")
