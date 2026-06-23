async function test() {
  const res = await fetch("http://76.13.228.159:8080/instance/create", {
    method: "POST",
    headers: {
      "apikey": "minha_chave_secreta_123",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ instanceName: "prof_1", qrcode: true })
  });
  const data = await res.json();
  console.log("Create Result:", data);
}

test();
