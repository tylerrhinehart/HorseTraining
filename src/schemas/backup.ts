import { z } from "zod";

const ratingSchema = z.object({
  score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  comment: z.string().optional(),
  questionTextSnapshot: z.string(),
});

const horseSchema = z.object({
  id: z.string(),
  name: z.string(),
  breed: z.string().optional(),
  ownerName: z.string().optional(),
  ownerEmail: z.string().optional(),
  startDate: z.string(),
  durationDays: z.number().int().positive(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
});

const questionSchema = z.object({
  id: z.string(),
  text: z.string(),
  order: z.number().int(),
  active: z.boolean(),
  deletedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const evaluationSchema = z.object({
  id: z.string(),
  horseId: z.string(),
  date: z.string(),
  ratings: z.record(z.string(), ratingSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const backupSchema = z.object({
  app: z.literal("horse-training-tracker"),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  horses: z.array(horseSchema),
  questions: z.array(questionSchema),
  evaluations: z.array(evaluationSchema),
});

export type Backup = z.infer<typeof backupSchema>;
