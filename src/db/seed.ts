import { db, APP_STATE_ID, SCHEMA_VERSION, type Question } from "./schema";

const DEFAULT_QUESTIONS: string[] = [
  "Responsiveness to cues",
  "Calmness under pressure",
  "Willingness to move forward",
  "Lateral suppleness",
  "Halting and standing",
  "Bridle acceptance",
  "Groundwork manners",
  "Confidence with new stimuli",
];

export async function ensureSeed() {
  try {
    const existing = await db.appState.get(APP_STATE_ID);
    if (existing?.seeded) return;

    const now = new Date().toISOString();
    const questions: Question[] = DEFAULT_QUESTIONS.map((text, idx) => ({
      id: crypto.randomUUID(),
      text,
      order: idx,
      active: true,
      createdAt: now,
      updatedAt: now,
    }));

    await db.transaction("rw", db.questions, db.appState, async () => {
      const existingCount = await db.questions.count();
      if (existingCount === 0) {
        await db.questions.bulkAdd(questions);
      }
      await db.appState.put({
        id: APP_STATE_ID,
        activeHorseId: existing?.activeHorseId,
        schemaVersion: SCHEMA_VERSION,
        seeded: true,
        lastBackupAt: existing?.lastBackupAt,
      });
    });
  } catch (err) {
    console.error("Failed to seed database", err);
  }
}
