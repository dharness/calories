import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getUSDAClient, USDADataType } from "../usdaClient";

export const searchFoodsTool = tool(
  async ({ queries, dataType, limit }: { queries: string[]; dataType?: USDADataType; limit?: number }) => {
    try {
      const result = await getUSDAClient().multiSearchFoods(queries, limit || 10, dataType);
      return JSON.stringify(result);
    } catch (e) {
      console.log(e);
      return "you got an error";
    }
  },
  {
    name: "searchFoods",
    description: "Search for foods by multiple ingredient names/variations in parallel. Gets back a combined list of unique foods that matched. Optionally filter by dataType (e.g., 'Foundation', 'SR Legacy', 'Branded'). If not specified, searches all data types.",
    schema: z.object({
      queries: z.array(z.string()).describe("An array of search queries/variations to run in parallel"),
      dataType: z.string().optional().describe("Optional data type filter. Valid values include 'Foundation' (analytically derived, high quality), 'SR Legacy' (historic Standard Reference), 'Branded' (branded/private label foods), 'Survey (FNDDS)', or 'Experimental Foods'. If not provided, searches all data types."),
      limit: z.number().optional().describe("Maximum number of results to return per query (default 10)"),
    }),
  }
);
