import { getOrCreateCollection } from "./chroma-collection.js";

const recordsCollection = await getOrCreateCollection("data");

const results = await recordsCollection.query({
  queryTexts: [
    "Here is my VIN: 1HGCM82633A912457. When does my registration expire?",
  ],
  nResults: 1,
  include: ["embeddings", "documents", "metadatas", "distances"],
});

console.log("Query results:", results);

export { results };
