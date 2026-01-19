import { appendFileSync } from "fs";

const ERROR_LOG_FILE = "errors.log";

interface ErrorLogEntry {
  timestamp: string;
  error: {
    message: string;
    name?: string;
    stack?: string;
    status?: number;
    statusCode?: number;
    details?: any;
    cause?: any;
  };
  context?: Record<string, any>;
}

function extractErrorDetails(error: any): ErrorLogEntry["error"] {
  if (!error) {
    return { message: String(error) };
  }

  return {
    message: error?.message || String(error),
    name: error?.name,
    stack: error?.stack,
    status: error?.status,
    statusCode: error?.statusCode,
    details: error?.details || error?.error?.details,
    cause: error?.cause,
  };
}

export function logError(
  error: any,
  context?: Record<string, any>
): void {
  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    error: extractErrorDetails(error),
    context,
  };

  const logLine = JSON.stringify(logEntry) + "\n";

  try {
    // appendFileSync is synchronous and flushes immediately
    appendFileSync(ERROR_LOG_FILE, logLine, "utf-8");
  } catch (writeError) {
    console.error("Failed to write error log:", writeError);
  }
}
