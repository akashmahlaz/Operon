import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  getMetaCampaignInsights,
  getMetaStatus,
  listMetaAdAccounts,
  listMetaCampaigns,
  pauseMetaCampaign,
  resumeMetaCampaign,
  validateAndStoreMetaToken,
} from "@/lib/services/meta-ads";

export function createMetaAdsTools(userId: string) {
  return {
    meta_get_status: tool({
      description: "Check whether the operator has connected Meta (Facebook/Instagram) and return the authenticated user.",
      inputSchema: z.object({}),
      execute: async () => getMetaStatus(userId),
    }),
    meta_save_token: tool({
      description: "Securely store a Meta Marketing API access token. Validates by fetching /me, then encrypts and saves. Tokens come from developers.facebook.com or via Meta Business Suite.",
      inputSchema: z.object({ token: z.string().min(20) }),
      execute: async ({ token }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Meta token save attempt", metadata: { tool: "meta_save_token" } });
        const result = await validateAndStoreMetaToken(userId, token);
        return { saved: true, name: result.user.name, metaUserId: result.user.id };
      },
    }),
    meta_list_ad_accounts: tool({
      description: "List Meta ad accounts the operator has access to. Returns the act_ id needed for other tools.",
      inputSchema: z.object({}),
      execute: async () => ({ adAccounts: await listMetaAdAccounts(userId) }),
    }),
    meta_list_campaigns: tool({
      description: "List campaigns under one ad account.",
      inputSchema: z.object({
        adAccountId: z.string().min(1).describe("Ad account id, e.g. 'act_1234567890'."),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async ({ adAccountId, limit }) => ({
        campaigns: await listMetaCampaigns(userId, adAccountId, limit ?? 25),
      }),
    }),
    meta_campaign_insights: tool({
      description: "Fetch performance insights (impressions, clicks, spend, CTR, CPM, conversions) for a campaign.",
      inputSchema: z.object({
        campaignId: z.string().min(1),
        datePreset: z
          .enum([
            "today",
            "yesterday",
            "this_week_mon_today",
            "last_7d",
            "last_14d",
            "last_30d",
            "this_month",
            "last_month",
            "this_quarter",
            "maximum",
          ])
          .optional(),
      }),
      execute: async ({ campaignId, datePreset }) => ({
        insights: await getMetaCampaignInsights(userId, campaignId, datePreset ?? "last_7d"),
      }),
    }),
    meta_pause_campaign: tool({
      description: "Pause a Meta campaign (sets status to PAUSED). Use to stop spending immediately.",
      inputSchema: z.object({ campaignId: z.string().min(1) }),
      execute: async ({ campaignId }) => {
        await appendLog({ userId, level: "warn", source: "ai-tool", message: "Meta campaign paused", metadata: { tool: "meta_pause_campaign", campaignId } });
        return pauseMetaCampaign(userId, campaignId);
      },
    }),
    meta_resume_campaign: tool({
      description: "Resume a paused Meta campaign (sets status to ACTIVE).",
      inputSchema: z.object({ campaignId: z.string().min(1) }),
      execute: async ({ campaignId }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Meta campaign resumed", metadata: { tool: "meta_resume_campaign", campaignId } });
        return resumeMetaCampaign(userId, campaignId);
      },
    }),
  };
}
