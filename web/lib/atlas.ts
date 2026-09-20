// OPTIONAL - MongoDB Atlas (the MLH "Best Use of MongoDB Atlas" track).
// If MONGODB_URI in .env.local is empty, every function here does nothing and the app works normally.
// If it is set, each question is saved to Atlas, and the page shows recent questions from other Hokies.
let clientPromise: Promise<any> | null = null;

async function getCollection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  const { MongoClient } = await import("mongodb");
  clientPromise ??= new MongoClient(uri).connect();
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB ?? "hokie").collection("exchanges");
}

/** Save one question and its answer. Never throws. */
export async function logExchange(question: string, answer: string, usedAgents: string[]): Promise<void> {
  try {
    const col = await getCollection();
    if (!col) return;
    await col.insertOne({ question, answer, usedAgents, at: new Date() });
  } catch (err) {
    console.error("Atlas save failed (the app still works):", err);
  }
}

/** The most recent questions (newest first). Returns [] if Atlas is not set up. */
export async function recentQuestions(limit = 5): Promise<string[]> {
  try {
    const col = await getCollection();
    if (!col) return [];
    const rows = await col.find({}, { projection: { question: 1 } }).sort({ at: -1 }).limit(limit).toArray();
    return rows.map((r: { question: string }) => r.question);
  } catch (err) {
    console.error("Atlas read failed (the app still works):", err);
    return [];
  }
}
