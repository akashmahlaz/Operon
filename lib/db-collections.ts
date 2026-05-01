import client from "@/lib/db";
import type { Collection, Document } from "mongodb";

/**
 * Centralized Mongo collection accessors.
 * Add a getter here for every new collection so call-sites stay typed
 * and the database name is configured in one place.
 */

const dbName = process.env.MONGODB_DB ?? "operon";

function db() {
  return client.db(dbName);
}

function collection<TSchema extends Document = Document>(name: string): Collection<TSchema> {
  return db().collection<TSchema>(name);
}

export const collections = {
  conversations: <TSchema extends Document = Document>() => collection<TSchema>("conversations"),
  messages: <TSchema extends Document = Document>() => collection<TSchema>("messages"),
  skills: <TSchema extends Document = Document>() => collection<TSchema>("skills"),
  agents: <TSchema extends Document = Document>() => collection<TSchema>("agents"),
  integrations: <TSchema extends Document = Document>() => collection<TSchema>("integrations"),
  jobs: <TSchema extends Document = Document>() => collection<TSchema>("jobs"),
  logs: <TSchema extends Document = Document>() => collection<TSchema>("logs"),
  uploads: <TSchema extends Document = Document>() => collection<TSchema>("uploads"),
  users: <TSchema extends Document = Document>() => collection<TSchema>("users"),
};
