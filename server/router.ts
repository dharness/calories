import { initializeClients } from "./init";
import { getLLMClient } from "./llmClient";
import { getFoodDetails, GetFoodDetailsInput } from "./services/getFoodDetails";
import { parseIngredients } from "./services/ingredientParser";
import { publicProcedure, router } from "./trpc";
import { getUSDAClient } from "./usdaClient";

initializeClients();

interface SearchInput {
  query: string;
  limit?: number;
}

interface CaloriesInput {
  fdcId?: number;
  name?: string;
  quantity?: number;
  unit?: string;
}

interface OptimizeInput {
  recipeText: string;
}

export const appRouter = router({
  search: publicProcedure
    .input((val: unknown): SearchInput => val as SearchInput)
    .query(async ({ input }) => {
      const trimmedQuery = input.query.trim();
      if (!trimmedQuery) {
        throw new Error("Missing search query");
      }

      const results = await getUSDAClient().searchFoods(
        trimmedQuery,
        input.limit ?? 10,
        "Foundation"
      );
      return { results };
    }),

  calories: publicProcedure
    .input((val: unknown): CaloriesInput => val as CaloriesInput)
    .query(async ({ input }) => {
      const trimmedName = input.name?.trim() || "";
      if (!input.fdcId && !trimmedName) {
        throw new Error("Missing fdcId or ingredient name");
      }

      const qty = input.quantity ?? 100;
      const unitStr = input.unit?.trim() || "g";

      const result = input.fdcId
        ? await getUSDAClient().getCaloriesByFdcId(qty, unitStr, input.fdcId)
        : await getUSDAClient().getCalories(qty, unitStr, trimmedName);

      return {
        name: trimmedName || (result.meta.description as string) || "",
        quantity: qty,
        unit: unitStr,
        calories: Number(result.calories.toFixed(2)),
        meta: result.meta,
      };
    }),

  optimize: publicProcedure
    .input((val: unknown): OptimizeInput => val as OptimizeInput)
    .query(async ({ input }) => {
      const ingredients = await parseIngredients(input.recipeText);
      return { ingredients };
    }),

  getFoodDetails: publicProcedure
    .input((val: unknown): GetFoodDetailsInput => val as GetFoodDetailsInput)
    .query(async ({ input }) => {
      const foodDetails = await getFoodDetails(input.ingredientName);
      return { foodDetails };
    }),
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
