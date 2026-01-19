import { getLLMClient } from "../llmClient";
import { getFoodDetailsTool } from "../tools/getFoodDetails";
import { searchFoodsTool } from "../tools/searchFoods";

export async function optimizeRecipe(
  recipeText: string
): Promise<any> {
  const prompt = `Your job is to take a recipe and make a healthier version. 

To do this, you should:
1. Extract the ingredients from the recipe.
2. For each ingredient, brainstorm 1-3 search query variations.
3. Use the searchFoods tool with these variations to find the best matching food in the USDA database. You can search multiple variations at once using the 'queries' parameter.
4. Get the full food details using getFoodDetails.
5. Suggest healthier alternatives or optimizations based on the data.
  `;

  const agent = getLLMClient().createAgent({
    tools: [searchFoodsTool, getFoodDetailsTool],
  });

  const result = await agent.invoke(prompt);
  return result;
}