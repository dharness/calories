import { config as loadEnv } from "dotenv";
import readline from "node:readline";

import { USDANutritionClient } from "./usdaClient";

type Ingredient = {
  quantity: number;
  unit: string;
  name: string;
};

type RecipeJson = {
  title?: string;
  ingredients?: Array<{
    quantity?: number;
    unit?: string;
    name?: string;
  }>;
};

const GEMINI_MODEL = "gemini-3.5-flash-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_ITERATIONS = 8;
const CALORIE_TOLERANCE_RATIO = 0.05;

const ingredientToLine = (ingredient: Ingredient): string => {
  const unitPart = ingredient.unit ? ` ${ingredient.unit}` : "";
  return `${ingredient.quantity}${unitPart} ${ingredient.name}`.trim();
};

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const geminiGenerate = async (prompt: string, apiKey: string): Promise<string> => {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
  };
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Gemini request failed: ${response.status} ${response.statusText} ${body}`
    );
  }
  const data = await response.json();
  const candidates = data?.candidates ?? [];
  if (!candidates.length) {
    throw new Error("Gemini response had no candidates.");
  }
  const text = candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini response did not include text output.");
  }
  return text;
};

const extractJson = (text: string): Record<string, unknown> => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON object found in Gemini response.");
  }
  return JSON.parse(match[0]);
};

const parseRecipeFromGemini = async (
  recipeText: string,
  apiKey: string
): Promise<RecipeJson> => {
  const prompt = [
    "Convert the following recipe into JSON with keys:",
    "`title` (string), `ingredients` (array of objects with",
    "`quantity` (number), `unit` (string, can be empty),",
    "`name` (string). Only output JSON.\n",
    `Recipe:\n${recipeText}`,
  ].join(" ");
  const responseText = await geminiGenerate(prompt, apiKey);
  return extractJson(responseText) as RecipeJson;
};

const normalizeRecipe = (recipeJson: RecipeJson): Ingredient[] => {
  const ingredients: Ingredient[] = [];
  for (const item of recipeJson.ingredients ?? []) {
    const quantity = Number(item?.quantity ?? 0);
    const unit = String(item?.unit ?? "").trim();
    const name = String(item?.name ?? "").trim();
    if (!name || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }
    ingredients.push({ quantity, unit, name });
  }
  return ingredients;
};

const calculateTotalCalories = async (
  ingredients: Ingredient[],
  client: USDANutritionClient
): Promise<[number, Array<Record<string, unknown>>]> => {
  let total = 0.0;
  const breakdown: Array<Record<string, unknown>> = [];
  for (const ingredient of ingredients) {
    const line = ingredientToLine(ingredient);
    const result = await client.getCalories(
      ingredient.quantity,
      ingredient.unit,
      ingredient.name
    );
    total += result.calories;
    breakdown.push({
      line,
      calories: result.calories,
      data: result.meta,
    });
  }
  return [total, breakdown];
};

const requestRecipeAdjustment = async (
  recipeJson: RecipeJson,
  calorieDelta: number,
  apiKey: string,
  history: string[]
): Promise<Record<string, unknown>> => {
  const prompt = [
    "You are a culinary assistant that reduces calories while preserving dish logic.",
    "Given the recipe JSON and the calorie reduction needed, propose a revised recipe JSON.",
    "Return JSON only with keys: `title`, `ingredients`, and `changes`",
    "(array of short strings describing substitutions or quantity reductions).",
    "If possible, keep the number of ingredients similar and avoid removing core components.\n",
    `Calorie reduction needed: ${calorieDelta.toFixed(0)} calories.\n`,
    `Current recipe JSON:\n${JSON.stringify(recipeJson, null, 2)}\n`,
    `Changes already made:\n${JSON.stringify(history, null, 2)}`,
  ].join(" ");
  const responseText = await geminiGenerate(prompt, apiKey);
  return extractJson(responseText);
};

const withinTolerance = (total: number, target: number): boolean =>
  Math.abs(total - target) <= target * CALORIE_TOLERANCE_RATIO;

const runOptimizer = async (
  recipeText: string,
  targetCalories: number
): Promise<Record<string, unknown>> => {
  const geminiKey = requireEnv("GEMINI_API_KEY");
  const usdaKey = requireEnv("USDA_API_KEY");
  const usdaClient = new USDANutritionClient(usdaKey);

  let recipeJson = await parseRecipeFromGemini(recipeText, geminiKey);
  const changesLog: string[] = [];
  let total = 0.0;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const ingredients = normalizeRecipe(recipeJson);
    if (!ingredients.length) {
      throw new Error("No usable ingredients after normalization.");
    }

    [total] = await calculateTotalCalories(ingredients, usdaClient);

    if (withinTolerance(total, targetCalories)) {
      return {
        recipe: recipeJson,
        total_calories: total,
        changes: changesLog,
      };
    }

    if (total < targetCalories) {
      return {
        recipe: recipeJson,
        total_calories: total,
        changes: changesLog,
      };
    }

    const delta = total - targetCalories;
    const adjusted = await requestRecipeAdjustment(
      recipeJson,
      delta,
      geminiKey,
      changesLog
    );
    recipeJson = {
      title: String(adjusted?.title ?? recipeJson.title ?? "Untitled"),
      ingredients: (adjusted as RecipeJson)?.ingredients ?? recipeJson.ingredients,
    };
    const changes = (adjusted as any)?.changes ?? [];
    if (Array.isArray(changes)) {
      changesLog.push(...changes.map((entry) => String(entry)));
    }
  }

  return {
    recipe: recipeJson,
    total_calories: total,
    changes: changesLog,
    warning: "Max iterations reached before hitting target.",
  };
};

const question = (rl: readline.Interface, prompt: string): Promise<string> =>
  new Promise((resolve) => rl.question(prompt, resolve));

const readRecipeLines = async (
  rl: readline.Interface
): Promise<string[]> => {
  const lines: string[] = [];
  await new Promise<void>((resolve) => {
    const onLine = (line: string) => {
      if (!line.trim()) {
        rl.removeListener("line", onLine);
        resolve();
        return;
      }
      lines.push(line);
    };
    rl.on("line", onLine);
  });
  return lines;
};

const main = async (): Promise<void> => {
  loadEnv();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Paste the recipe (end with an empty line):");
  const lines = await readRecipeLines(rl);
  if (!lines.length) {
    rl.close();
    throw new Error("No recipe provided.");
  }

  const targetInput = (await question(rl, "Target calories: ")).trim();
  rl.close();

  if (!targetInput) {
    throw new Error("No target calories provided.");
  }
  const targetCalories = Number(targetInput);
  if (!Number.isFinite(targetCalories)) {
    throw new Error("Target calories must be a number.");
  }

  const result = await runOptimizer(lines.join("\n"), targetCalories);
  console.log("\nFinal Recipe JSON:");
  console.log(JSON.stringify(result.recipe, null, 2));
  console.log(`\nFinal Calories: ${Number(result.total_calories).toFixed(0)}`);
  console.log("\nChanges made:");
  for (const change of (result.changes as string[]) ?? []) {
    console.log(`- ${change}`);
  }
  if (result.warning) {
    console.log(`\nWarning: ${result.warning}`);
  }
};

main().catch((error) => {
  const { logError } = require("../server/utils/errorLogger");
  logError(error, { context: "cli_main" });
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
