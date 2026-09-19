import { z } from "zod";

export const swipePointSchema = z.object({
  x: z.number().int().min(0).max(2147483647),
  y: z.number().int().min(0).max(2147483647),
}).strict();

export const swipeParamsSchema = z.object({
  start: swipePointSchema,
  end: swipePointSchema,
  durationMs: z.number().int().min(1).max(10000),
}).strict().refine(value => value.start.x !== value.end.x || value.start.y !== value.end.y, {
  message: "swipe start and end must differ",
  path: ["end"],
});

export type SwipeParams = z.infer<typeof swipeParamsSchema>;
