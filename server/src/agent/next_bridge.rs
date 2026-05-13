//! Bridge: dynamically pull the Next.js connector catalog (Gmail, Vercel,
//! Stripe, Cloudflare, SEO, Meta, memory, skills, …) into the Rust agent's
//! tool surface and dispatch tool calls back to Next via /api/tools/execute.
//!
//! Auth: operonx mints a short-lived JWT for the user using OPERON_JWT_SECRET.
//! Next's /api/tools route validates it by calling `${OPERON_API_URL}/auth/me`,
//! which decodes the same JWT — so no extra shared secret is needed.

use anyhow::{Context, Result, anyhow};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Clone, Debug, Deserialize)]
pub struct NextToolDescriptor {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_object_schema")]
    pub input_schema: Value,
}

fn default_object_schema() -> Value {
    json!({ "type": "object", "additionalProperties": true })
}

#[derive(Deserialize)]
struct ToolsResponse {
    #[serde(default)]
    tools: Vec<RawTool>,
}

#[derive(Deserialize)]
struct RawTool {
    name: String,
    #[serde(default)]
    description: String,
    /// AI-SDK Zod schemas serialize to a JSON Schema-ish blob, OR to `null`
    /// when `schemas=true` is missing. We pass through whatever Next gives us.
    #[serde(default, rename = "inputSchema")]
    input_schema: Option<Value>,
}

#[derive(Clone)]
pub struct NextBridge {
    client: Client,
    base_url: String,
    bearer: String,
    channel: String,
    conversation_id: Option<String>,
}

impl NextBridge {
    pub fn new(
        client: Client,
        base_url: impl Into<String>,
        bearer: impl Into<String>,
        channel: impl Into<String>,
        conversation_id: Option<String>,
    ) -> Self {
        Self {
            client,
            base_url: base_url.into().trim_end_matches('/').to_owned(),
            bearer: bearer.into(),
            channel: channel.into(),
            conversation_id,
        }
    }

    /// Fetch the live tool catalog the operator has access to right now.
    /// Tools that need a missing connector are filtered server-side.
    pub async fn list_tools(&self) -> Result<Vec<NextToolDescriptor>> {
        let mut url = format!(
            "{}/api/tools?schemas=true&channel={}",
            self.base_url, self.channel
        );
        if let Some(cid) = &self.conversation_id {
            url.push_str(&format!("&conversationId={}", cid));
        }
        let resp = self
            .client
            .get(&url)
            .bearer_auth(&self.bearer)
            .send()
            .await
            .context("fetching Next.js tool catalog")?;
        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("/api/tools {status}: {text}"));
        }
        let body: ToolsResponse = resp.json().await.context("parsing /api/tools response")?;
        Ok(body
            .tools
            .into_iter()
            .map(|t| NextToolDescriptor {
                name: t.name,
                description: t.description,
                input_schema: t.input_schema.unwrap_or_else(default_object_schema),
            })
            .collect())
    }

    /// Execute a single tool against Next.js.
    pub async fn execute(&self, tool: &str, args: &Value) -> Result<Value> {
        let url = format!("{}/api/tools/execute", self.base_url);
        let body = json!({
            "tool": tool,
            "args": args,
            "channel": self.channel,
            "conversationId": self.conversation_id,
        });
        let resp = self
            .client
            .post(&url)
            .bearer_auth(&self.bearer)
            .json(&body)
            .send()
            .await
            .context("calling /api/tools/execute")?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(anyhow!("tool `{tool}` failed ({status}): {text}"));
        }
        let parsed: Value = serde_json::from_str(&text)
            .map_err(|e| anyhow!("invalid JSON from /api/tools/execute: {e}"))?;
        if parsed.get("ok").and_then(Value::as_bool) == Some(false) {
            let err = parsed.get("error").and_then(Value::as_str).unwrap_or("unknown error");
            return Err(anyhow!("tool `{tool}` failed: {err}"));
        }
        Ok(parsed.get("output").cloned().unwrap_or(Value::Null))
    }
}
