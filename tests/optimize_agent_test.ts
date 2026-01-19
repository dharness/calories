import { config as loadEnv } from "dotenv";
import { optimizeAgent } from "../server/agents/optimizeAgent";
import { initializeClients } from "../server/init";

loadEnv();

const exampleRecipe = `
Blueberry Muffins

Ingredients:
- 1 cup white sugar
- ½ cup butter, softened
- 2 large eggs
- 2 tablespoons vegetable oil
- 1 cup sour cream
- ½ cup milk
- 1 tablespoon grated lemon zest
- 3 cups all-purpose flour
- 1 tablespoon baking powder
- ½ teaspoon baking soda
- ¾ teaspoon salt
- 2 cups fresh blueberries
`;

async function main() {
  try {
    initializeClients();

    console.log("Testing optimizeAgent with recipe text");
    const startTime = Date.now();

    await optimizeAgent(exampleRecipe);

    const endTime = Date.now();
    console.log(`\nTest completed in ${endTime - startTime}ms`);
  } catch (error) {
    console.error("Test failed:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
