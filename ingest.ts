import fs from "fs";
import { getCollection, embed } from "./chroma-collection.ts";

async function ingest() {
  const collection = await getCollection("data");
  const data = JSON.parse(fs.readFileSync("./data/dmvData.json", "utf8"));

  for (const record of data) {
    const text = JSON.stringify(record, null, 2);
    const vector = await embed(text);

    await collection.add({
      ids: [record.vin],
      embeddings: [vector],
      documents: [text],
      metadatas: [{ plate: record.plate, make: record.make }],
    });
  }

  console.log("Ingestion complete.");
}

ingest().catch(console.error);
