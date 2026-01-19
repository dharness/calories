import { writeFileSync } from "fs";
import { logError } from "../utils/errorLogger";
import { USDADataType } from "../usdaClient";
import {
  IngredientData,
  IngredientDataResult,
  ingredientDataAgent,
} from "./ingredientDataAgent";
import { ExtractedIngredient, ingredientExtractorAgent } from "./ingredientExtractorAgent";

export async function optimizeAgent(recipeText: string): Promise<void> {
  const runId = Date.now().toString();

  let ingredients: ExtractedIngredient[];
  try {
    ingredients = await ingredientExtractorAgent(recipeText);
  } catch (error) {
    logError(error, {
      context: "optimizeAgent",
      stage: "ingredientExtraction",
      runId,
    });
    throw error;
  }

  const ingredientDataPromises = ingredients.map((ingredient) =>
    ingredientDataAgent(ingredient.name, runId)
  );

  const results = await Promise.allSettled(ingredientDataPromises);

  const successfulResults: IngredientData[] = [];
  const allIngredientTraces: Array<{
    ingredient: string;
    searchTerms: Array<{ term: string; dataType?: USDADataType | string }>;
    success: boolean;
  }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const ingredient = ingredients[i];

    if (result.status === "fulfilled") {
      const ingredientResult = result.value;
      if (ingredientResult.success && ingredientResult.data) {
        successfulResults.push(ingredientResult.data);
        allIngredientTraces.push({
          ingredient: ingredient.name,
          searchTerms: ingredientResult.searchTerms,
          success: true,
        });
      } else {
        allIngredientTraces.push({
          ingredient: ingredient.name,
          searchTerms: ingredientResult.searchTerms,
          success: false,
        });
      }
    } else {
      const error = result.reason;
      const errorMessage = error?.message || String(error);
      allIngredientTraces.push({
        ingredient: ingredient.name,
        searchTerms: [],
        success: false,
      });
      logError(error, {
        context: "optimizeAgent",
        ingredient: ingredient.name,
        runId,
      });
      console.error(
        `Unexpected error processing ingredient "${ingredient.name}":`,
        errorMessage
      );
    }
  }

  console.log(`\n=== Run ID: ${runId} ===`);
  console.log("\n=== Ingredient Search Traces ===");
  for (const trace of allIngredientTraces) {
    const status = trace.success ? "✓" : "✗";
    const searchTermsStr = trace.searchTerms
      .map((st, idx) => {
        const termStr = st.dataType ? `${st.term} (${st.dataType})` : st.term;
        return `${idx + 1}. ${termStr}`;
      })
      .join("\n    ");

    console.log(
      `${status} "${trace.ingredient}":${trace.searchTerms.length > 0 ? `\n    ${searchTermsStr}` : " (no searches attempted)"}`
    );
  }

  const failedCount = allIngredientTraces.filter((t) => !t.success).length;
  if (failedCount > 0) {
    console.log(
      `\nSummary: ${successfulResults.length} successful, ${failedCount} failed`
    );
  }

  writeFileSync(
    "optimize_agent_output.json",
    JSON.stringify(successfulResults, null, 2)
  );
}
