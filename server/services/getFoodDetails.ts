import { getUSDAClient } from "../usdaClient";

export interface GetFoodDetailsInput {
  ingredientName: string;
}

export async function getFoodDetails(
  ingredientName: string
): Promise<any> {
  const trimmedName = ingredientName.trim();
  if (!trimmedName) {
    throw new Error("Missing ingredient name");
  }

  const searchResults = await getUSDAClient().searchFoods(
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

  const foodDetails = await getUSDAClient().getFoodDetails(fdcId);
  return foodDetails;
}
