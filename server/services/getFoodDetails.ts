import { USDANutritionClient } from "../usdaClient";

export interface GetFoodDetailsInput {
  ingredientName: string;
}

export async function getFoodDetails(
  ingredientName: string,
  client: USDANutritionClient
): Promise<any> {
  const trimmedName = ingredientName.trim();
  if (!trimmedName) {
    throw new Error("Missing ingredient name");
  }

  const searchResults = await client.searchFoods(
    trimmedName,
    1,
    "Foundation"
  );

  if (!searchResults.length) {
    throw new Error(`No food found for ingredient: ${trimmedName}`);
  }

  const firstResult = searchResults[0];
  const fdcId = firstResult.fdcId;

  if (!fdcId) {
    throw new Error(`No FDC ID found for ingredient: ${trimmedName}`);
  }

  const foodDetails = await client.getFoodDetails(fdcId);
  return foodDetails;
}
