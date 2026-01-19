import { getCached, setCached } from "./usdaCache";
import { logError } from "./utils/errorLogger";

export enum USDADataType {
  Foundation = "Foundation",
  SRLegacy = "SR Legacy",
  Branded = "Branded",
  SurveyFNDDS = "Survey (FNDDS)",
  ExperimentalFoods = "Experimental",
}

export type USDAResult = {
  calories: number;
  meta: Record<string, unknown>;
};

export type FoodSearchResult = {
  fdcId: number;
  description: string;
  lowercaseDescription: string;
  commonNames: string;
  additionalDescriptions: string;
  dataType: string;
  publishedDate: string;
  foodCategory: string;
};

const USDA_SEARCH_ENDPOINT = "https://api.nal.usda.gov/fdc/v1/foods/search";
const USDA_FOOD_ENDPOINT = "https://api.nal.usda.gov/fdc/v1/food";

let usdaClientInstance: USDANutritionClient | null = null;

export function initializeUSDAClient(apiKey: string): void {
  if (usdaClientInstance) {
    throw new Error("USDANutritionClient has already been initialized");
  }
  usdaClientInstance = new USDANutritionClient(apiKey);
}

export function getUSDAClient(): USDANutritionClient {
  if (!usdaClientInstance) {
    throw new Error(
      "USDANutritionClient has not been initialized. Call initializeUSDAClient() first."
    );
  }
  return usdaClientInstance;
}

export class USDANutritionClient {
  constructor(private apiKey: string) { }

  async getCalories(
    quantity: number,
    unit: string,
    name: string
  ): Promise<USDAResult> {
    const foodHit = await this.searchFood(name);
    const fdcId = foodHit?.fdcId;
    if (!fdcId) {
      throw new Error(`No USDA FDC ID found for '${name}'.`);
    }

    return this.getCaloriesByFdcId(quantity, unit, fdcId);
  }

  async getCaloriesByFdcId(
    quantity: number,
    unit: string,
    fdcId: number
  ): Promise<USDAResult> {
    const food = await this.getFoodDetails(fdcId);
    const kcalPer100g = this.extractEnergyKcal(food);

    let [grams, source] = this.unitToGrams(quantity, unit);
    if (grams <= 0) {
      [grams, source] = this.gramsFromFoodPortions(quantity, unit, food);
    }
    if (grams <= 0) {
      grams = quantity * 100.0;
      source = "fallback_100g";
    }

    const calories = (kcalPer100g / 100.0) * grams;
    return {
      calories,
      meta: {
        fdcId,
        description: food?.description,
        kcal_per_100g: kcalPer100g,
        grams,
        gram_source: source,
      },
    };
  }

  async searchFoods(
    query: string,
    limit = 10,
    dataType?: USDADataType | string
  ): Promise<FoodSearchResult[]> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      query: query.trim(),
      pageSize: String(limit),
    });

    // Add dataType filter if provided
    if (dataType) {
      params.append("dataType", dataType);
    }

    const response = await fetch(`${USDA_SEARCH_ENDPOINT}?${params.toString()}`);
    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        `USDA search failed: ${response.status} ${response.statusText} ${body}`
      );
      logError(error, {
        context: "usdaClient.searchFoods",
        query,
        status: response.status,
        statusText: response.statusText,
      });
      throw error;
    }
    const data = await response.json();
    const foods = data?.foods ?? [];

    return foods.map((food: any) => this.extractFoodFields(food));
  }

  private extractFoodFields(food: any): FoodSearchResult {
    return {
      fdcId: food.fdcId,
      description: food.description,
      lowercaseDescription: food.lowercaseDescription,
      commonNames: food.commonNames,
      additionalDescriptions: food.additionalDescriptions,
      dataType: food.dataType,
      publishedDate: food.publishedDate,
      foodCategory: food.foodCategory,
    };
  }

  async multiSearchFoods(
    queries: string[],
    limit = 10,
    dataType?: USDADataType
  ): Promise<FoodSearchResult[]> {
    const searchPromises = queries.map((query) =>
      this.searchFoods(query, limit, dataType)
    );
    const resultsArray = await Promise.all(searchPromises);

    // Flatten results and keep unique ones by fdcId
    const seenFdcIds = new Set<number>();
    const uniqueResults: FoodSearchResult[] = [];

    for (const results of resultsArray) {
      for (const food of results) {
        if (!seenFdcIds.has(food.fdcId)) {
          seenFdcIds.add(food.fdcId);
          uniqueResults.push(food);
        }
      }
    }

    return uniqueResults;
  }

  private async searchFood(name: string): Promise<any> {
    // Search Foundation Foods first
    const results = await this.searchFoods(name, 1, USDADataType.Foundation);
    if (!results.length) {
      throw new Error(`No USDA foods found for '${name}'.`);
    }
    return { fdcId: results[0].fdcId, description: results[0].description };
  }

  async getFoodDetails(fdcId: number): Promise<any> {
    // Check cache first
    const cached = getCached(fdcId);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from API
    const params = new URLSearchParams({ api_key: this.apiKey });
    const response = await fetch(
      `${USDA_FOOD_ENDPOINT}/${fdcId}?${params.toString()}`
    );
    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        `USDA food lookup failed: ${response.status} ${response.statusText} ${body}`
      );
      logError(error, {
        context: "usdaClient.getFoodDetails",
        fdcId,
        status: response.status,
        statusText: response.statusText,
      });
      throw error;
    }
    const data = await response.json();

    // Store in cache
    setCached(fdcId, data);

    return data;
  }

  private extractEnergyKcal(food: any): number {
    const nutrients = food?.foodNutrients ?? [];
    for (const nutrient of nutrients) {
      const nutrientId =
        nutrient?.nutrientId ?? nutrient?.nutrient?.id ?? null;
      const nutrientName =
        nutrient?.nutrientName ?? nutrient?.nutrient?.name ?? "";
      const unitName =
        nutrient?.unitName ?? nutrient?.nutrient?.unitName ?? "";
      const value = nutrient?.value ?? nutrient?.amount ?? 0;

      // Check for standard Energy nutrient (ID 1008)
      if (nutrientId === 1008) {
        return Number(value) || 0;
      }

      // Check for Energy with kcal unit (exact match or contains "Energy")
      const normalizedUnit = String(unitName).toLowerCase();
      if (normalizedUnit === "kcal") {
        if (nutrientName === "Energy" || nutrientName.startsWith("Energy")) {
          return Number(value) || 0;
        }
      }
    }
    return 0.0;
  }

  private normalizeUnit(unit: string): string {
    return unit.trim().toLowerCase().replace(/s$/, "");
  }

  private unitToGrams(quantity: number, unit: string): [number, string] {
    const normalized = this.normalizeUnit(unit);
    const conversions: Record<string, number> = {
      g: 1.0,
      gram: 1.0,
      kg: 1000.0,
      kilogram: 1000.0,
      oz: 28.3495,
      ounce: 28.3495,
      lb: 453.592,
      pound: 453.592,
    };
    if (normalized in conversions) {
      return [quantity * conversions[normalized], "weight"];
    }
    return [0.0, "unknown"];
  }

  private gramsFromFoodPortions(
    quantity: number,
    unit: string,
    food: any
  ): [number, string] {
    const normalized = this.normalizeUnit(unit);
    if (!normalized) {
      return [quantity, "assumed_grams"];
    }

    const portions = food?.foodPortions ?? [];
    for (const portion of portions) {
      const measureUnit = portion?.measureUnit?.name ?? "";
      const modifier = portion?.modifier ?? "";
      if (
        this.normalizeUnit(measureUnit) === normalized ||
        this.normalizeUnit(modifier) === normalized
      ) {
        const gramWeight = portion?.gramWeight;
        if (gramWeight) {
          return [quantity * Number(gramWeight), "portion"];
        }
      }
    }

    return [0.0, "unknown"];
  }
}
