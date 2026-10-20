import { AzureOpenAIEmbeddings } from "@langchain/openai";

export async function embedAzure(text: string): Promise<number[]> {
  const embeddings = new AzureOpenAIEmbeddings({
    apiKey: process.env.AZURE_OPENAI_KEY!,
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT!,
    openAIApiVersion: "2024-02-01",

    configuration: {
      baseURL: process.env.AZURE_OPENAI_ENDPOINT
    }
  });

  return embeddings.embedQuery(text);
}
