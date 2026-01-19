import { writeFileSync } from "fs";
import { AgentProgressEvent } from "../llmClient";

export interface LoggedEvent {
  id: string;
  timestamp: number;
  event: AgentProgressEvent;
  metadata: {
    runId?: string;
    agent?: string;
    inputText?: string;
    [key: string]: any;
  };
}

export type EventListener = (event: LoggedEvent) => void;

export class EventLogger {
  private events: LoggedEvent[] = [];
  private eventIdCounter = 0;
  private listeners: EventListener[] = [];

  private constructor() { }

  private static instance: EventLogger | null = null;

  private static getInstance(): EventLogger {
    if (!EventLogger.instance) {
      EventLogger.instance = new EventLogger();
    }
    return EventLogger.instance;
  }

  static logEvent(event: AgentProgressEvent, metadata: Record<string, any> = {}): void {
    const instance = EventLogger.getInstance();
    const loggedEvent: LoggedEvent = {
      id: `event_${instance.eventIdCounter++}`,
      timestamp: Date.now(),
      event,
      metadata,
    };
    instance.events.push(loggedEvent);
    instance.listeners.forEach((listener) => listener(loggedEvent));
  }

  static getEvents(filter?: Partial<LoggedEvent["metadata"]>): LoggedEvent[] {
    const instance = EventLogger.getInstance();
    if (!filter || Object.keys(filter).length === 0) {
      return [...instance.events];
    }

    return instance.events.filter((loggedEvent) => {
      for (const [key, value] of Object.entries(filter)) {
        if (loggedEvent.metadata[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  static getAllEvents(): LoggedEvent[] {
    const instance = EventLogger.getInstance();
    return [...instance.events];
  }

  static clearEvents(): void {
    const instance = EventLogger.getInstance();
    instance.events = [];
    instance.eventIdCounter = 0;
  }

  static writeToFile(filename: string): void {
    const instance = EventLogger.getInstance();
    const jsonlContent = instance.events.map((event) => JSON.stringify(event)).join("\n");
    writeFileSync(filename, jsonlContent);
  }

  static addListener(listener: EventListener): void {
    const instance = EventLogger.getInstance();
    instance.listeners.push(listener);
  }

  static removeListener(listener: EventListener): void {
    const instance = EventLogger.getInstance();
    const index = instance.listeners.indexOf(listener);
    if (index > -1) {
      instance.listeners.splice(index, 1);
    }
  }
}
