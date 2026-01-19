import { z } from "zod";
import { getLLMClient } from "../llmClient";

export type Ingredient = {
  quantity: number;
  unit: string;
  name: string;
};

const IngredientSchema = z.object({
  quantity: z.number().describe("The quantity of the ingredient as a number (e.g., 2, 1.5, 0.5)"),
  unit: z.string().describe("The unit of measurement (e.g., 'cups', 'tsp', 'tbsp', 'oz', 'g', or empty string if no unit)"),
  name: z.string().describe("The name of the ingredient"),
});

const IngredientsArraySchema = z.array(IngredientSchema).describe("Array of ingredients extracted from the recipe");

// Parse recipe text into structured ingredients using LLM with guided decoding
export async function parseIngredients(
  recipeText: string
): Promise<Ingredient[]> {
  const prompt = `Parse the following recipe text and extract all ingredients. Return only the ingredients as a JSON array.

Recipe text:
${recipeText}

Extract each ingredient with its quantity (as a number), unit (as a string, or empty string if no unit), and name. For example:
- "2 cups flour" -> {quantity: 2, unit: "cups", name: "flour"}
- "1/2 tsp salt" -> {quantity: 0.5, unit: "tsp", name: "salt"}
- "3 eggs" -> {quantity: 3, unit: "", name: "eggs"}
- "1.5 cups sugar" -> {quantity: 1.5, unit: "cups", name: "sugar"}
- "1 ½ cup butter, softened" -> {quantity: 1.5, unit: "cups", name: "butter"}

Convert fractions to decimals (e.g., 1/2 -> 0.5, 1/4 -> 0.25).
Ignore any instructions, directions, or non-ingredient text.`;


console.log("prompt", prompt);

  const result = await getLLMClient().generateWithZodSchema<Ingredient[]>(
    prompt,
    IngredientsArraySchema,
    "Ingredients"
  );

  if (Array.isArray(result)) {
    return result;
  }

  throw new Error("Failed to parse ingredients from LLM response");
}
