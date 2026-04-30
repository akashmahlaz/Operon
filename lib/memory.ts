/**
 * In-memory placeholder for cross-session memory recall.
 * Swap with Mongo / Redis-backed search once persistence is wired.
 */

export interface MemoryFact {
  id: string;
  content: string;
  source?: string;
  createdAt: string;
}

const facts: MemoryFact[] = [];

export const memory = {
  async add(fact: Omit<MemoryFact, "id" | "createdAt">) {
    const entry: MemoryFact = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...fact,
    };
    facts.push(entry);
    return entry;
  },
  async search(query: string) {
    const q = query.toLowerCase();
    return facts.filter((f) => f.content.toLowerCase().includes(q));
  },
  async list() {
    return [...facts];
  },
};
