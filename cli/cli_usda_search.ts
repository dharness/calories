#!/usr/bin/env bun

import { config as loadEnv } from "dotenv";
import { USDADataType, USDANutritionClient } from "../server/usdaClient";

loadEnv();

const apiKey = process.env.USDA_API_KEY;
if (!apiKey) {
  console.error("Error: USDA_API_KEY not set in environment");
  process.exit(1);
}

const query = process.argv[2] || "blueberries";
const client = new USDANutritionClient(apiKey);

try {
  const results = await client.searchFoods(query, 20, USDADataType.Foundation);
  console.log(JSON.stringify(results, null, 2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
