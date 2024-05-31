import { Ollama } from "@langchain/community/llms/ollama";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const template = 
      `Responde a la pregunta siendo muy gracioso
      	Pregunta: {pregunta}
      `;

const miprompt = new PromptTemplate({template, inputVariables: ["pregunta"]});
const outputParser = new StringOutputParser();

const miOllama = new Ollama({
    baseUrl: "http://localhost:11434",
    model: "phi3",
    temperature: 0,
    stream: true  // Asegúrate de que el stream esté habilitado aquí
});

const chain = new LLMChain({
  llm: miOllama,
  prompt: miprompt,
  outputParser: outputParser
});


let stream = true;

async function runOllama() {
    if (!stream) {
        const ollamaGenerate = await chain.call({ pregunta: "hola" });
        console.log("No Stream");
        console.log(ollamaGenerate.text);
    } else {
        console.log("Stream");
        console.log("Prompt final.. ");
        console.log(miprompt);

        // Configura los callbacks para manejar el stream de tokens
        const handleLLMNewToken = (token) => {
            process.stdout.write(token);
        };

        const handleLLMEnd = () => {
            console.log("\nStream complete.");
        };

        const ollamaStream = await chain.stream(
            { pregunta: "hola" },
            {
                callbacks: [
                    {
                        handleLLMNewToken,
                        handleLLMEnd
                    }
                ]
            }
        );
    }
}

console.log("running - LangchainJS first example - Logs del modelo en el Servidor");
runOllama();
