import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getUSDAClient } from "../usdaClient";

export const getFoodDetailsTool = tool(
  async ({ fdcId }: { fdcId: number }) => {
    try {
      const result = await getUSDAClient().getFoodDetails(fdcId);
      return JSON.stringify(result);
    } catch(e) {
      console.log(e);
      return "you got an error";
    }
  },
  {
    name: "getFoodDetails",
    description: "Get detailed food information by FDC ID. Returns complete nutritional data including all nutrients, portions, and metadata.",
    schema: z.object({
      fdcId: z.number().describe("The Food Data Central ID (fdcId) of the food item"),
    }),
  }
);
