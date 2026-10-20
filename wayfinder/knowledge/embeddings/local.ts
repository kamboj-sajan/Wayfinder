import { pipeline } from "@xenova/transformers";

let model: any;

async function loadModel() {
  if (!model) {
    model = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return model;
}

export async function embedLocal(text: string): Promise<number[]> {
  const m = await loadModel();

  const output = await m(text, {
    pooling: "mean",
    normalize: true
  });

  return Array.from(output.data);
}
