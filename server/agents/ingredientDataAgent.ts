import { z } from "zod";
import { AgentProgressEvent, getLLMClient } from "../llmClient";
import { createThinkingLogger } from "../llmClientUtils";
import { getFoodDetailsTool } from "../tools/getFoodDetails";
import { searchFoodsTool } from "../tools/searchFoods";
import { getUSDAClient, USDADataType } from "../usdaClient";
import { logError } from "../utils/errorLogger";
import { EventLogger } from "../utils/eventLogger";

export interface IngredientData {
  id: number;
  description: string;
}

export interface SearchTerm {
  term: string;
  dataType?: USDADataType | string;
}

export interface IngredientDataResult {
  success: boolean;
  data: IngredientData | null;
  searchTerms: SearchTerm[];
}

const FoodIdResponseSchema = z.object({
  id: z.number().nullable().describe("The FDC ID of the ingredient found, or null if not found"),
});

export async function ingredientDataAgent(
  ingredientText: string,
  runId: string = Date.now().toString()
): Promise<IngredientDataResult> {
  const client = getLLMClient();
  const searchTerms: SearchTerm[] = [];

  EventLogger.logEvent({ type: "start" }, {
    runId,
    agent: "ingredientData",
    inputText: ingredientText,
  });

  const thinkingLogger = createThinkingLogger({
    metadata: {
      runId,
      agent: "ingredientData",
      inputText: ingredientText,
    },
  });

  const systemPrompt = `
    Your task is to find the "correct" database entry for an ingreditent listed in a recipe.
    The "correct" entry is the one which most likely represents the intent of the recipe author.
    "Base" ingredients (rather than specific brands) should be preferred.
    Your job is to find the "correct" ingredient and return its "id" from the database.

    STEP 1: Decide the Search Term
    Think about the ingredient name and search operators you've been given and decide if it is a good "search term" for the usda database.
    

    STEP 2: Foundation Search
    Search the database for foundational ingredients only using your search term.

    STEP 3: Analyze Foundation Results
    Analyze the results of the foundation search. Do any of these results represent the "correct" ingredient?
    If so, you are done! Simply return the id of the correct ingredient and skip the rest of the steps.
    If not, proceed to step 4.

    STEP 4: Search Everything
    Search the database again, but with no foundation filter using your search term.

    STEP 5: Analyze "Everything" Results
    Analyze the results of the "everything" search. Do any of these results represent the "correct" ingredient?
    If so, you are done! Simply return the id of the correct ingredient.
    If not, we could not find the correct ingredient. Stop here and return null for the id.
    `;
  const prompt = `Here is the input ingredient text: ${ingredientText}`;

  const agent = client.createAgent({
    responseFormat: FoodIdResponseSchema,
    tools: [searchFoodsTool],
    systemPrompt: systemPrompt,
    onProgress: thinkingLogger,
    onRetry: (attempt, maxRetries, delayMs) => {
      EventLogger.logEvent(
        { type: "retry", attempt, maxRetries, delayMs },
        {
          runId,
          agent: "ingredientData",
          inputText: ingredientText,
        }
      );
    },
  });

  let data: IngredientData | null = null;
  let success = false;

  try {
    const agentResult = await agent.invoke(prompt);

    if (agentResult.id) {
      EventLogger.logEvent(
        { type: "fetch_food_details", fdcId: agentResult.id },
        {
          runId,
          agent: "ingredientData",
          inputText: ingredientText,
        }
      );

      const foodDetails = await getUSDAClient().getFoodDetails(agentResult.id!);

      data = {
        id: agentResult.id,
        description: foodDetails?.description || ingredientText,
      };
      success = true;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const cleanErrorMessage = errorMessage.replace(/\s+/g, " ").trim().substring(0, 100);
    EventLogger.logEvent(
      { type: "error", error: cleanErrorMessage },
      {
        runId,
        agent: "ingredientData",
        inputText: ingredientText,
      }
    );
    logError(error, {
      context: "ingredientDataAgent",
      runId,
      agent: "ingredientData",
      inputText: ingredientText,
    });
  }

  EventLogger.logEvent(
    { type: "end", success },
    {
      runId,
      agent: "ingredientData",
      inputText: ingredientText,
    }
  );

  return {
    success,
    data,
    searchTerms,
  };
}
