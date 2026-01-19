import { StructuredTool } from "@langchain/core/tools";
import { getFoodDetailsTool } from "./getFoodDetails";
import { searchFoodsTool } from "./searchFoods";

export type ToolName = "searchFoods" | "getFoodDetails";

const TOOL_REGISTRY: Record<ToolName, StructuredTool> = {
  searchFoods: searchFoodsTool,
  getFoodDetails: getFoodDetailsTool,
};

export function getTools(toolNames: ToolName[]): StructuredTool[] {
  return toolNames.map((name) => {
    const tool = TOOL_REGISTRY[name];
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool;
  });
}

export function getAllTools(): StructuredTool[] {
  return Object.values(TOOL_REGISTRY);
}
