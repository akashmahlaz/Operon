import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import { requireConfirmation } from "@/lib/ai/tools/confirm";
import {
  createCloudflareDnsRecord,
  deleteCloudflareDnsRecord,
  getCloudflareStatus,
  listCloudflareAccounts,
  listCloudflareDnsRecords,
  listCloudflareR2Buckets,
  listCloudflareWorkers,
  listCloudflareZones,
  purgeCloudflareCache,
  updateCloudflareDnsRecord,
  validateAndStoreCloudflareToken,
} from "@/lib/services/cloudflare";

export function createCloudflareTools(userId: string) {
  return {
    cloudflare_get_status: tool({
      description: "Check whether the operator has connected Cloudflare and return the API token status.",
      inputSchema: z.object({}),
      execute: async () => getCloudflareStatus(userId),
    }),
    cloudflare_save_token: tool({
      description: "Securely store a Cloudflare API token. Validates by calling /user/tokens/verify, then encrypts and saves. Tokens are created at dash.cloudflare.com/profile/api-tokens.",
      inputSchema: z.object({ token: z.string().min(20) }),
      execute: async ({ token }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Cloudflare token save attempt", metadata: { tool: "cloudflare_save_token" } });
        const result = await validateAndStoreCloudflareToken(userId, token);
        return { saved: true, status: result.verify.status };
      },
    }),
    cloudflare_list_zones: tool({
      description: "List Cloudflare zones (domains) the token has access to. Use the returned zone id for DNS calls.",
      inputSchema: z.object({ perPage: z.number().int().min(1).max(100).optional() }),
      execute: async ({ perPage }) => ({ zones: await listCloudflareZones(userId, perPage ?? 50) }),
    }),
    cloudflare_list_dns: tool({
      description: "List DNS records for a Cloudflare zone, optionally filtered by type (A, AAAA, CNAME, TXT, MX).",
      inputSchema: z.object({ zoneId: z.string().min(1), type: z.string().optional() }),
      execute: async ({ zoneId, type }) => ({ records: await listCloudflareDnsRecords(userId, zoneId, type) }),
    }),
    cloudflare_create_dns: tool({
      description: "Create a DNS record in a Cloudflare zone. ttl=1 means automatic. proxied=true puts traffic behind Cloudflare.",
      inputSchema: z.object({
        zoneId: z.string().min(1),
        type: z.string().min(1),
        name: z.string().min(1),
        content: z.string().min(1),
        ttl: z.number().int().optional(),
        proxied: z.boolean().optional(),
        comment: z.string().optional(),
      }),
      execute: async ({ zoneId, ...input }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Cloudflare DNS created", metadata: { tool: "cloudflare_create_dns", zoneId, type: input.type, name: input.name } });
        return createCloudflareDnsRecord(userId, zoneId, input);
      },
    }),
    cloudflare_update_dns: tool({
      description: "Update an existing DNS record by id (partial update supported).",
      inputSchema: z.object({
        zoneId: z.string().min(1),
        recordId: z.string().min(1),
        type: z.string().optional(),
        name: z.string().optional(),
        content: z.string().optional(),
        ttl: z.number().int().optional(),
        proxied: z.boolean().optional(),
        comment: z.string().optional(),
      }),
      execute: async ({ zoneId, recordId, ...input }) =>
        updateCloudflareDnsRecord(userId, zoneId, recordId, input),
    }),
    cloudflare_delete_dns: tool({
      description: "Delete a DNS record from a Cloudflare zone. Two-phase: first call returns requires_confirmation+token+summary; show summary to operator, only call back with __confirmToken on explicit approval.",
      inputSchema: z.object({ zoneId: z.string().min(1), recordId: z.string().min(1), __confirmToken: z.string().optional() }),
      execute: async ({ zoneId, recordId, __confirmToken }) => {
        const pending = await requireConfirmation({
          userId, tool: "cloudflare_delete_dns", args: { zoneId, recordId },
          summary: `Delete DNS record ${recordId} in zone ${zoneId}?`,
          confirmToken: __confirmToken,
        });
        if (pending) return pending;
        await appendLog({ userId, level: "warn", source: "ai-tool", message: "Cloudflare DNS deleted", metadata: { tool: "cloudflare_delete_dns", zoneId, recordId } });
        return deleteCloudflareDnsRecord(userId, zoneId, recordId);
      },
    }),
    cloudflare_purge_cache: tool({
      description: "Purge Cloudflare cache. When everything=true, two-phase confirmation is required (it nukes the whole zone cache).",
      inputSchema: z.object({
        zoneId: z.string().min(1),
        everything: z.boolean().optional(),
        files: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        __confirmToken: z.string().optional(),
      }),
      execute: async ({ zoneId, everything, files, tags, __confirmToken }) => {
        if (everything) {
          const pending = await requireConfirmation({
            userId, tool: "cloudflare_purge_cache", args: { zoneId, everything, files, tags },
            summary: `Purge ENTIRE cache for zone ${zoneId}?`,
            confirmToken: __confirmToken,
          });
          if (pending) return pending;
        }
        await appendLog({ userId, level: "warn", source: "ai-tool", message: "Cloudflare cache purged", metadata: { tool: "cloudflare_purge_cache", zoneId, everything: !!everything } });
        return purgeCloudflareCache(userId, zoneId, { everything, files, tags });
      },
    }),
    cloudflare_list_accounts: tool({
      description: "List Cloudflare accounts the token has access to. Needed for Workers and R2 calls.",
      inputSchema: z.object({}),
      execute: async () => ({ accounts: await listCloudflareAccounts(userId) }),
    }),
    cloudflare_list_workers: tool({
      description: "List Cloudflare Workers scripts in an account.",
      inputSchema: z.object({ accountId: z.string().min(1) }),
      execute: async ({ accountId }) => ({ workers: await listCloudflareWorkers(userId, accountId) }),
    }),
    cloudflare_list_r2_buckets: tool({
      description: "List Cloudflare R2 (S3-compatible object storage) buckets in an account.",
      inputSchema: z.object({ accountId: z.string().min(1) }),
      execute: async ({ accountId }) => listCloudflareR2Buckets(userId, accountId),
    }),
  };
}
