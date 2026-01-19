import { config as loadEnv } from "dotenv";
import { ingredientDataAgent } from "../server/agents/ingredientDataAgent";
import { initializeClients } from "../server/init";
import { EventLogger } from "../server/utils/eventLogger";

loadEnv();

const exampleIngredients = ["1 cup white sugar"];

async function main() {
  initializeClients();

  console.log("Testing ingredientDataAgent with:", exampleIngredients);
  const results = await Promise.all(
    exampleIngredients.map((ingredient) => ingredientDataAgent(ingredient))
  );

  EventLogger.writeToFile("ingredient_data_agent_events.jsonl");
  const eventCount = EventLogger.getAllEvents().length;
  console.log(`Wrote ${eventCount} events to ingredient_data_agent_events.jsonl`);
}
main();
