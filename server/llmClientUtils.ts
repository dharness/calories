import { appendFileSync } from "fs";
import { AgentProgressEvent } from "./llmClient";
import { EventLogger } from "./utils/eventLogger";

const DEFAULT_LOG_PATH = "./tmp_logs";

function appendEventToLog(event: AgentProgressEvent): void {
  const logLine = JSON.stringify(event) + "\n"
  appendFileSync(DEFAULT_LOG_PATH, logLine);
}

export interface ThinkingLoggerOptions {
  logToFile?: boolean;
  logToGlobal?: boolean;
  metadata?: Record<string, any>;
}

export function createThinkingLogger(
  options: ThinkingLoggerOptions = {}
): (event: AgentProgressEvent) => void {
  const { logToFile = false, logToGlobal = true, metadata = {} } = options;

  return (event: AgentProgressEvent) => {
    if (logToFile) appendEventToLog(event)
    if (logToGlobal) EventLogger.logEvent(event, metadata)
  };
}
