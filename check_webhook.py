import urllib.request, json

APIKEY = 'minha_chave_secreta_123'
EVO_URL = 'http://179.197.76.174:8080'
WEBHOOK_URL = 'https://wrmusicpro.com.br/api/webhooks/whatsapp'
INSTANCE = 'prof_1598'

# 1. Check connection status
req_status = urllib.request.Request(f"{EVO_URL}/instance/connectionState/{INSTANCE}", headers={'apikey': APIKEY})
try:
    with urllib.request.urlopen(req_status) as resp:
        print("Status prof_1598:", json.loads(resp.read().decode()))
except Exception as e:
    print("Error status:", e)

# 2. Set webhook for prof_1598
payload = json.dumps({
    "webhook": {
        "enabled": True,
        "url": WEBHOOK_URL,
        "byEvents": False,
        "base64": False,
        "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "MESSAGES_UPDATE"]
    }
}).encode('utf-8')

req_wh = urllib.request.Request(
    f"{EVO_URL}/webhook/set/{INSTANCE}",
    data=payload,
    headers={'Content-Type': 'application/json', 'apikey': APIKEY},
    method='POST'
)

try:
    with urllib.request.urlopen(req_wh) as resp:
        print("Set Webhook prof_1598:", json.loads(resp.read().decode()))
except Exception as e:
    print("Error set webhook:", e)

# 3. Verify webhook
req_find = urllib.request.Request(f"{EVO_URL}/webhook/find/{INSTANCE}", headers={'apikey': APIKEY})
try:
    with urllib.request.urlopen(req_find) as resp:
        print("Find Webhook prof_1598:", json.loads(resp.read().decode()))
except Exception as e:
    print("Error find webhook:", e)
