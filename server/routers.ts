import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { parseIntentContent } from "./intent";
import { z } from "zod";

const intentSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["open_url", "take_note", "search_web", "set_reminder", "tell_time"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    url: { type: ["string", "null"], description: "Normalized absolute URL for open_url, otherwise null" },
    query: { type: ["string", "null"], description: "Search query for search_web, otherwise null" },
    note: { type: ["string", "null"], description: "Note body for take_note, otherwise null" },
    reminderText: { type: ["string", "null"], description: "Reminder message for set_reminder, otherwise null" },
    reminderMinutes: { type: ["integer", "null"], description: "Minutes from now for set_reminder, otherwise null" },
    response: { type: "string", description: "Short human-friendly confirmation or clarification" },
  },
  required: ["action", "confidence", "url", "query", "note", "reminderText", "reminderMinutes", "response"],
  additionalProperties: false,
} as const;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  voice: router({
    parseIntent: publicProcedure
      .input(z.object({ transcript: z.string().trim().min(2).max(1000) }))
      .mutation(async ({ input }) => {
        const completion = await invokeLLM({
          model: "claude-sonnet-4-6",
          messages: [
            {
              role: "system",
              content: `You are the intent router for a voice command console. Return only valid JSON matching the schema. Choose exactly one action: open_url, take_note, search_web, set_reminder, tell_time. Normalize URLs by adding https:// when missing and never invent a path. For reminders, convert phrases like 'in ten minutes' into reminderMinutes. For tell_time, do not use an external API; the browser will report local time. If the request is ambiguous, choose the closest action with low confidence and explain what is missing in response.`,
            },
            { role: "user", content: input.transcript },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "voice_intent", strict: true, schema: intentSchema },
          },
        });

        const content = completion.choices?.[0]?.message?.content;
        return parseIntentContent(content);
      }),
  }),
});

export type AppRouter = typeof appRouter;
