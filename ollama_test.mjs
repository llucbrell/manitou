// Asumiendo que el módulo Ollama también soporta CommonJS

async function testOllama() {

  const stream = await ollama.stream("Translate 'I love programming' into German.");

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  console.log(chunks.join(""));
}

testOllama(ollama);
