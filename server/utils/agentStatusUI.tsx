import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";
import { AgentProgressEvent } from "../llmClient";
import { EventLogger, LoggedEvent } from "./eventLogger";

interface AgentEvent {
  event: AgentProgressEvent;
  timestamp: number;
}

interface IngredientStatus {
  ingredientName: string;
  runId: string;
  events: AgentEvent[];
}

function formatEvent(event: AgentProgressEvent): string {
  if (event.type === "tool_call") {
    const argsStr = typeof event.args === "object" 
      ? JSON.stringify(event.args).substring(0, 50)
      : String(event.args).substring(0, 50);
    return `${event.toolName}(${argsStr}${argsStr.length >= 50 ? "..." : ""})`;
  }
  
  if (event.type === "tool_result") {
    let resultInfo = "";
    let parsedResult = event.result;
    
    if (typeof event.result === "string") {
      try {
        parsedResult = JSON.parse(event.result);
      } catch {
        resultInfo = `${event.result.length} chars`;
        return `${event.toolName} → ${resultInfo}`;
      }
    }
    
    if (Array.isArray(parsedResult)) {
      resultInfo = `${parsedResult.length} results`;
    } else if (typeof parsedResult === "object" && parsedResult !== null) {
      resultInfo = `${Object.keys(parsedResult).length} keys`;
    } else {
      resultInfo = "result";
    }
    return `${event.toolName} → ${resultInfo}`;
  }
  
  if (event.type === "llm_response") {
    const flattened = event.content.replace(/\s+/g, " ").trim();
    const preview = flattened.substring(0, 60);
    return `llm: ${preview}${flattened.length > 60 ? "..." : ""}`;
  }
  
  if (event.type === "agent_action") {
    const flattened = event.action.replace(/\s+/g, " ").trim();
    return `action: ${flattened}`;
  }
  
  if (event.type === "start") {
    return "Starting...";
  }
  
  if (event.type === "error") {
    return `ERROR: ${event.error}`;
  }
  
  if (event.type === "fetch_food_details") {
    return `Fetching food details (ID: ${event.fdcId})`;
  }
  
  if (event.type === "end") {
    return event.success ? "Completed ✓" : "Failed ✗";
  }
  
  if (event.type === "retry") {
    return `Retrying (${event.attempt}/${event.maxRetries}) in ${(event.delayMs / 1000).toFixed(1)}s`;
  }
  
  return "unknown";
}

export function AgentStatusUI() {
  const [ingredientStatuses, setIngredientStatuses] = useState<Map<string, IngredientStatus>>(new Map());

  useEffect(() => {
    const handleEvent = (event: LoggedEvent) => {
      if (event.metadata.agent !== "ingredientData") {
        return;
      }

      const ingredientName = event.metadata.inputText || "Unknown";
      const runId = event.metadata.runId || "unknown";
      const agentKey = `${ingredientName}_${runId}`;

      setIngredientStatuses((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(agentKey);
        
        const newEvent: AgentEvent = {
          event: event.event,
          timestamp: event.timestamp,
        };

        if (existing) {
          updated.set(agentKey, {
            ...existing,
            events: [...existing.events, newEvent].sort((a, b) => a.timestamp - b.timestamp),
          });
        } else {
          updated.set(agentKey, {
            ingredientName,
            runId,
            events: [newEvent],
          });
        }

        return updated;
      });
    };

    const existingEvents = EventLogger.getEvents({ agent: "ingredientData" });
    const initialStatuses = new Map<string, IngredientStatus>();
    
    for (const event of existingEvents) {
      const ingredientName = event.metadata.inputText || "Unknown";
      const runId = event.metadata.runId || "unknown";
      const agentKey = `${ingredientName}_${runId}`;
      const existing = initialStatuses.get(agentKey);
      
      const newEvent: AgentEvent = {
        event: event.event,
        timestamp: event.timestamp,
      };

      if (existing) {
        existing.events.push(newEvent);
      } else {
        initialStatuses.set(agentKey, {
          ingredientName,
          runId,
          events: [newEvent],
        });
      }
    }

    for (const status of initialStatuses.values()) {
      status.events.sort((a, b) => a.timestamp - b.timestamp);
    }

    setIngredientStatuses(initialStatuses);

    EventLogger.addListener(handleEvent);

    return () => {
      EventLogger.removeListener(handleEvent);
    };
  }, []);

  const statusArray = Array.from(ingredientStatuses.values());

  function getCurrentStatus(status: IngredientStatus): string {
    if (status.events.length === 0) {
      return "Waiting...";
    }

    const lastEvent = status.events[status.events.length - 1];
    return formatEvent(lastEvent.event);
  }

  const INGREDIENT_NAME_WIDTH = 30;

  return (
    <Box flexDirection="column">
      {statusArray.length === 0 ? (
        <Text dimColor>Waiting for agent events...</Text>
      ) : (
        statusArray.map((status, index) => {
          const currentStatus = getCurrentStatus(status);
          const ingredientName = status.ingredientName.padEnd(INGREDIENT_NAME_WIDTH);
          return (
            <Text key={`${status.ingredientName}_${status.runId}_${index}`}>
              {ingredientName} | {currentStatus}
            </Text>
          );
        })
      )}
    </Box>
  );
}
