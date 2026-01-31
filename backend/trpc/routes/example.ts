import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "../create-context";

export const exampleRouter = createTRPCRouter({
  hi: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(({ input }) => {
      console.log("[backend] example.hi", input);

      return {
        hello: input.name,
        date: new Date(),
      };
    }),
});
