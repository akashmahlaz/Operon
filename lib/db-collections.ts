import client from "@/lib/db";

/**
 * Centralized Mongo collection accessors.
 * Add a getter here for every new collection so call-sites stay typed
 * and the database name is configured in one place.
 */

const dbName = process.env.MONGODB_DB ?? "brilion";

function db() {
  return client.db(dbName);
}

export const collections = {
  conversations: () => db().collection("conversations"),
  messages: () => db().collection("messages"),
  skills: () => db().collection("skills"),
  agents: () => db().collection("agents"),
  integrations: () => db().collection("integrations"),
  jobs: () => db().collection("jobs"),
  logs: () => db().collection("logs"),
  users: () => db().collection("users"),
};
