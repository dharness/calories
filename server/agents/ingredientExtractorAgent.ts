import { z } from "zod";
import { getLLMClient } from "../llmClient";

export interface ExtractedIngredient {
  quantity: number;
  unit: string;
  name: string;
  originalText?: string;
}

const ExtractedIngredientSchema = z.object({
  quantity: z.number().describe("The numeric quantity of the ingredient"),
  unit: z.string().describe("The unit of measurement (e.g., 'cup', 'tablespoon', 'teaspoon', 'gram', 'piece', 'whole', etc.)"),
  name: z.string().describe("The name of the ingredient"),
  originalText: z.string().optional().describe("The original text from the recipe for this ingredient"),
});

const IngredientExtractionResponseSchema = z.object({
  ingredients: z.array(ExtractedIngredientSchema).describe("List of extracted ingredients from the recipe"),
});

export async function ingredientExtractorAgent(
  recipeText: string
): Promise<ExtractedIngredient[]> {
  const client = getLLMClient();

  const prompt = `Extract all ingredients from the following recipe text. For each ingredient, identify:
1. The quantity (as a number)
2. The unit of measurement (e.g., cup, tablespoon, teaspoon, gram, piece, whole, etc.)
3. The ingredient name

Recipe text:
${recipeText}

Return a list of all ingredients found in the recipe. If a quantity or unit is not specified, use reasonable defaults (e.g., quantity: 1, unit: "whole" or "piece").`;

  const result = await client.generateWithZodSchema<{ ingredients: ExtractedIngredient[] }>(
    prompt,
    IngredientExtractionResponseSchema,
    "IngredientExtraction"
  );

  return result.ingredients;
}
