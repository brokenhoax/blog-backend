import { getCollection } from "./chroma-collection.ts";

const recordsCollection = await getCollection("data");

const results = await recordsCollection.query({
  queryTexts: [
    "Here is my VIN: 1HGCM82633A912457. When does my registration expire?",
  ],
  nResults: 1,
  include: ["embeddings", "documents", "metadatas", "distances"],
});

console.log("Query results:", results);

export { results };
