import { Database } from "bun:sqlite";

const DB_PATH = "usda_cache.db";

let db: Database | null = null;

export function initCache(): void {
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS usda_cache (
      fdc_id INTEGER PRIMARY KEY,
      response_data TEXT NOT NULL
    )
  `);
}

export function getCached(fdcId: number): any | null {
  if (!db) return null;
  const row = db.query("SELECT response_data FROM usda_cache WHERE fdc_id = ?").get(fdcId);
  if (!row) return null;
  return JSON.parse((row as { response_data: string }).response_data);
}

export function setCached(fdcId: number, data: any): void {
  if (!db) return;
  const json = JSON.stringify(data);
  db.query("INSERT OR REPLACE INTO usda_cache (fdc_id, response_data) VALUES (?, ?)").run(fdcId, json);
}
