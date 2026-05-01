import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  APP_STATE_ID,
  type Horse,
  type Question,
  type Evaluation,
  type Rating,
  type ID,
} from "./schema";
import { todayLocal } from "../utils/dates";

const nowIso = () => new Date().toISOString();

// ---------- Horses ----------

export function useHorses(includeArchived = false) {
  return useLiveQuery(async () => {
    const all = await db.horses.toArray();
    const filtered = includeArchived
      ? all
      : all.filter((h) => !h.archivedAt);
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [includeArchived]);
}

export function useHorse(id: ID | undefined) {
  return useLiveQuery(
    () => (id ? db.horses.get(id) : undefined),
    [id],
  );
}

export async function createHorse(input: {
  name: string;
  breed?: string;
  ownerName?: string;
  ownerEmail?: string;
  startDate: string;
  durationDays: number;
  notes?: string;
}): Promise<Horse> {
  const now = nowIso();
  const horse: Horse = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    breed: input.breed?.trim() || undefined,
    ownerName: input.ownerName?.trim() || undefined,
    ownerEmail: input.ownerEmail?.trim() || undefined,
    startDate: input.startDate,
    durationDays: input.durationDays,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.horses.add(horse);
  // Make this horse the active one if there isn't one yet.
  const state = await db.appState.get(APP_STATE_ID);
  if (!state?.activeHorseId) {
    await setActiveHorse(horse.id);
  }
  // Best-effort: ask for persistent storage on first horse.
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      "persist" in navigator.storage
    ) {
      navigator.storage.persist();
    }
  } catch {
    /* noop */
  }
  return horse;
}

export async function updateHorse(id: ID, patch: Partial<Horse>) {
  await db.horses.update(id, { ...patch, updatedAt: nowIso() });
}

export async function archiveHorse(id: ID) {
  await db.horses.update(id, {
    archivedAt: nowIso(),
    updatedAt: nowIso(),
  });
  const state = await db.appState.get(APP_STATE_ID);
  if (state?.activeHorseId === id) {
    const next = await db.horses
      .toArray()
      .then((all) => all.find((h) => !h.archivedAt && h.id !== id));
    await setActiveHorse(next?.id);
  }
}

export async function unarchiveHorse(id: ID) {
  await db.horses.update(id, {
    archivedAt: undefined,
    updatedAt: nowIso(),
  });
}

export async function deleteHorse(id: ID) {
  await db.transaction("rw", db.horses, db.evaluations, db.appState, async () => {
    await db.evaluations.where("horseId").equals(id).delete();
    await db.horses.delete(id);
    const state = await db.appState.get(APP_STATE_ID);
    if (state?.activeHorseId === id) {
      const next = await db.horses
        .toArray()
        .then((all) => all.find((h) => !h.archivedAt));
      await setActiveHorse(next?.id);
    }
  });
}

// ---------- Active horse ----------

export function useAppState() {
  return useLiveQuery(() => db.appState.get(APP_STATE_ID), []);
}

export function useActiveHorse() {
  const state = useAppState();
  return useLiveQuery(async () => {
    if (!state?.activeHorseId) return undefined;
    return db.horses.get(state.activeHorseId);
  }, [state?.activeHorseId]);
}

export async function setActiveHorse(id: ID | undefined) {
  const existing = await db.appState.get(APP_STATE_ID);
  await db.appState.put({
    id: APP_STATE_ID,
    activeHorseId: id,
    schemaVersion: existing?.schemaVersion ?? 1,
    seeded: existing?.seeded,
    lastBackupAt: existing?.lastBackupAt,
  });
}

// ---------- Questions ----------

export function useActiveQuestions() {
  return useLiveQuery(async () => {
    const all = await db.questions.toArray();
    return all
      .filter((q) => q.active && !q.deletedAt)
      .sort((a, b) => a.order - b.order);
  }, []);
}

export function useAllQuestions(includeDeleted = false) {
  return useLiveQuery(async () => {
    const all = await db.questions.toArray();
    const filtered = includeDeleted ? all : all.filter((q) => !q.deletedAt);
    return filtered.sort((a, b) => a.order - b.order);
  }, [includeDeleted]);
}

export async function createQuestion(text: string): Promise<Question> {
  const now = nowIso();
  const all = await db.questions.toArray();
  const order =
    all.reduce((max, q) => Math.max(max, q.order), -1) + 1;
  const q: Question = {
    id: crypto.randomUUID(),
    text: text.trim(),
    order,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.questions.add(q);
  return q;
}

export async function updateQuestion(id: ID, patch: Partial<Question>) {
  await db.questions.update(id, { ...patch, updatedAt: nowIso() });
}

export async function softDeleteQuestion(id: ID) {
  await db.questions.update(id, {
    deletedAt: nowIso(),
    active: false,
    updatedAt: nowIso(),
  });
}

export async function reorderQuestions(orderedIds: ID[]) {
  const now = nowIso();
  await db.transaction("rw", db.questions, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.questions.update(orderedIds[i], {
        order: i,
        updatedAt: now,
      });
    }
  });
}

// ---------- Evaluations ----------

export function useEvaluationsForHorse(horseId: ID | undefined) {
  return useLiveQuery(async () => {
    if (!horseId) return [] as Evaluation[];
    const all = await db.evaluations
      .where("horseId")
      .equals(horseId)
      .toArray();
    return all.sort((a, b) => a.date.localeCompare(b.date));
  }, [horseId]);
}

export function useEvaluationByDate(
  horseId: ID | undefined,
  date: string | undefined,
) {
  return useLiveQuery(async () => {
    if (!horseId || !date) return undefined;
    return db.evaluations
      .where("[horseId+date]")
      .equals([horseId, date])
      .first();
  }, [horseId, date]);
}

export async function upsertEvaluation(input: {
  horseId: ID;
  date?: string;
  ratings: Record<ID, Rating>;
}): Promise<Evaluation> {
  const date = input.date ?? todayLocal();
  const now = nowIso();
  const existing = await db.evaluations
    .where("[horseId+date]")
    .equals([input.horseId, date])
    .first();
  if (existing) {
    const updated: Evaluation = {
      ...existing,
      ratings: input.ratings,
      updatedAt: now,
    };
    await db.evaluations.put(updated);
    return updated;
  }
  const created: Evaluation = {
    id: crypto.randomUUID(),
    horseId: input.horseId,
    date,
    ratings: input.ratings,
    createdAt: now,
    updatedAt: now,
  };
  await db.evaluations.add(created);
  return created;
}

export async function deleteEvaluation(id: ID) {
  await db.evaluations.delete(id);
}
