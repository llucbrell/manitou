import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Ollama } from "@langchain/community/llms/ollama";
import { LLMChain, SimpleSequentialChain } from "langchain/chains";

// Definir los templates de respuesta
const responseTemplate1 = `
      Eres un chatbot llamado Gramabot y tu misión es calificar la ortografía, gramática 
      y estilo del texto que escribe el usuario. Sólo usarás palabras y describirás cómo de correcto es.
      Nunca debes corregir el texto y
      lo primero que harás será escribir tu nombre y repetir el texto proporcionado, para dar claridad a la corrección.
      texto: {input}
      `;

const responseTemplate2 = `
      Eres un calificador llamado Correctbot, Gramabot te proporcionará un texto y una recomendación, 
      siguiendo estos pasos, reescribirás el texto. Finalmente le pondrás una puntuación al nivel de corrección del texto
      proporcionado. Recuerda, sólo reescribe el texto y a continuación la puntuación que puede ir de 0 a 100 puntos.
      Gramabot: {input}
      `;

// Crear los PromptTemplates
const revisorPrompt1 = new PromptTemplate({ template: responseTemplate1, inputVariables: ["input"] });
const revisorPrompt2 = new PromptTemplate({ template: responseTemplate2, inputVariables: ["input"] });

const outputParser = new StringOutputParser();

// En este ejemplo se usa 2 veces el mismo modelo para la sequential chain, y sólo se usa phi3
// porque llama3 y otros modelos más grandes me dan error al usar más memoria.
// no obstante sirve bien como ejemplo de varias llamadas a modelo.
const miOllama = new Ollama({
    baseUrl: "http://localhost:11434",
    model: "phi3",
    temperature: 0,
    stream: true  // Asegúrate de que el stream esté habilitado aquí
});



const reviewChain1 = new LLMChain({ llm: miOllama, prompt: revisorPrompt1 });
const reviewChain2 = new LLMChain({ llm: miOllama, prompt: revisorPrompt2 });

const overallChain = new SimpleSequentialChain(
    {
        chains: [reviewChain1, reviewChain2],
        verbose: false
    }
);

let stream = true;  // Cambiar según sea necesario

async function runOllama() {
    if (!stream) {
        const ollamaGenerate = await overallChain.call({ input: "Ejtoy escribiendo un pequeño texto para mis papas." });
        console.log("No Stream");
        console.log(ollamaGenerate);
    } else {
        console.log("Stream");
        console.log("Prompt final.. ");
        console.log(overallChain);

        // Configura los callbacks para manejar el stream de tokens
        const handleLLMNewToken = (token) => {
            process.stdout.write(token);
        };

        const handleLLMEnd = () => {
            console.log("\nStream complete.");
        };

        const ollamaStream = await overallChain.stream(
            { input: "Ejtoy escribiendo un pequeño texto para mis papas." },
            {
                callbacks: [
                    {
                        handleLLMNewToken,
                        handleLLMEnd
                    }
                ]
            }
        );

        // Asegúrate de manejar el stream adecuadamente
        try {
            for await (const chunk of ollamaStream) {
                // Maneja los chunks aquí si es necesario
            }
        } catch (error) {
            console.error('Error during streaming:', error);
        }
    }
}

console.log("running - LangchainJS first example - Logs del modelo en el Servidor");
runOllama();
