import { z } from "zod";

export const intentSchema = z.object({
  action: z.enum(["open_url", "take_note", "search_web", "set_reminder", "tell_time"]),
  confidence: z.number().min(0).max(1),
  url: z.string().url().nullable().optional(),
  query: z.string().min(1).nullable().optional(),
  note: z.string().min(1).nullable().optional(),
  reminderText: z.string().min(1).nullable().optional(),
  reminderMinutes: z.number().int().min(1).max(10080).nullable().optional(),
  response: z.string().min(1),
});

export type VoiceIntent = z.infer<typeof intentSchema>;

export function parseIntentContent(content: unknown): VoiceIntent {
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return intentSchema.parse(parsed);
}
