#!/usr/bin/env bun

import { config as loadEnv } from "dotenv";
import { USDANutritionClient } from "./server/usdaClient";

loadEnv();

const apiKey = process.env.USDA_API_KEY;
if (!apiKey) {
  console.error("Error: USDA_API_KEY not set in environment");
  console.error("Make sure you have a .env file with USDA_API_KEY=your_key");
  process.exit(1);
}

console.log(`API Key loaded: ${apiKey.substring(0, 8)}...`);

const query = process.argv[2] || "blueberries";
const client = new USDANutritionClient(apiKey);

console.log(`Searching USDA API for: "${query}"`);
console.log("=".repeat(60));
console.log("");

try {
  const results = await client.searchFoods(query, 20);
  
  console.log(`Found ${results.length} results:\n`);
  
  // Group by description to find duplicates
  const byDescription = new Map<string, number[]>();
  results.forEach((item) => {
    const key = item.description.toLowerCase().trim();
    if (!byDescription.has(key)) {
      byDescription.set(key, []);
    }
    byDescription.get(key)!.push(item.fdcId);
  });
  
  // Show duplicates
  const duplicates = Array.from(byDescription.entries()).filter(
    ([_, fdcIds]) => fdcIds.length > 1
  );
  
  if (duplicates.length > 0) {
    console.log("DUPLICATE DESCRIPTIONS FOUND:");
    console.log("-".repeat(60));
    duplicates.forEach(([desc, fdcIds]) => {
      console.log(`"${desc}" appears ${fdcIds.length} times:`);
      fdcIds.forEach((id) => console.log(`  - FDC ID: ${id}`));
    });
    console.log("");
  }
  
  // Show all results with details
  console.log("ALL RESULTS:");
  console.log("-".repeat(60));
  results.forEach((item, idx) => {
    console.log(`${idx + 1}. FDC ID: ${item.fdcId}`);
    console.log(`   Description: ${item.description}`);
    console.log("");
  });
  
  // Now fetch full details for first few to see what differs
  // We need to make a direct API call since getFoodDetails is private
  console.log("=".repeat(60));
  console.log("DETAILED ANALYSIS (first 3 results):");
  console.log("=".repeat(60));
  
  for (let i = 0; i < Math.min(3, results.length); i++) {
    const item = results[i];
    console.log(`\nResult ${i + 1}: ${item.description} (FDC ID: ${item.fdcId})`);
    
    try {
      const food = await client.getFoodDetails(item.fdcId);
      console.log(`  Data Type: ${food.dataType || "N/A"}`);
      console.log(`  Brand Owner: ${food.brandOwner || "N/A"}`);
      console.log(`  GTIN/UPC: ${food.gtinUpc || "N/A"}`);
      console.log(`  Publication Date: ${food.publicationDate || "N/A"}`);
      console.log(`  Food Code: ${food.foodCode || "N/A"}`);
      if (food.foodNutrients && food.foodNutrients.length > 0) {
        const energy = food.foodNutrients.find(
          (n: any) => n.nutrientId === 1008 || n.nutrient?.id === 1008
        );
        console.log(`  Energy (kcal/100g): ${energy?.value || energy?.amount || "N/A"}`);
      }
    } catch (err) {
      console.log(`  Error fetching details: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
} catch (err) {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) {
    console.error("Stack:", err.stack);
  }
  process.exit(1);
}
