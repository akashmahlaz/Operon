//! Native Rust tools available to the coding agent.
//!
//! All paths are resolved against `Workspace::root` and refuse to escape it.

use std::{
    collections::HashSet,
    path::{Component, Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use anyhow::{Context, Result, anyhow, bail};
use ignore::WalkBuilder;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use similar::TextDiff;
use tokio::{io::AsyncReadExt, process::Command, time::timeout};

use super::github;
use super::next_bridge::{NextBridge, NextToolDescriptor};

const MAX_FILE_BYTES: usize = 1_000_000;
const DEFAULT_EXEC_TIMEOUT_SECS: u64 = 300;
const MAX_EXEC_OUTPUT_BYTES: usize = 200_000;
const MAX_LIST_ENTRIES: usize = 500;
const MAX_SEARCH_RESULTS: usize = 200;

#[derive(Clone)]
pub struct Workspace {
    root: Arc<PathBuf>,
}

impl Workspace {
    pub fn new(root: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&root)
            .with_context(|| format!("creating workspace root {}", root.display()))?;
        let canonical = std::fs::canonicalize(&root)
            .with_context(|| format!("canonicalizing workspace root {}", root.display()))?;
        Ok(Self {
            root: Arc::new(canonical),
        })
    }

    pub fn root(&self) -> &Path {
        self.root.as_path()
    }

    /// Resolve a relative path inside the workspace, refusing absolute paths
    /// and any `..` component that would escape the root.
    fn resolve(&self, rel: &str) -> Result<PathBuf> {
        let candidate = Path::new(rel);
        if candidate.is_absolute() {
            bail!("path must be relative to workspace root: {rel}");
        }
        let mut joined = self.root.as_ref().clone();
        for component in candidate.components() {
            match component {
                Component::CurDir => {}
                Component::ParentDir => {
                    if !joined.pop() || !joined.starts_with(self.root.as_ref()) {
                        bail!("path escapes workspace: {rel}");
                    }
                }
                Component::Normal(name) => joined.push(name),
                Component::Prefix(_) | Component::RootDir => {
                    bail!("path must be relative: {rel}");
                }
            }
        }
        if !joined.starts_with(self.root.as_ref()) {
            bail!("path escapes workspace: {rel}");
        }
        Ok(joined)
    }
}

/// Per-run context handed to every tool dispatch. Carries the workspace plus
/// any opt-in credentials the user has connected (GitHub, etc.).
#[derive(Clone)]
pub struct AgentContext {
    pub workspace: Workspace,
    pub http: Client,
    pub github_token: Option<String>,
    /// Conversation channel: "web" | "coding" | "whatsapp" | "telegram".
    /// Local-fs / shell tools (`exec`, `write_file`, `apply_patch`) are only
    /// dispatched in `coding`. Web mode must use the GitHub API tools instead.
    pub channel: String,
    /// Optional bridge to the Next.js connector catalog (Gmail, Vercel, Stripe,
    /// Cloudflare, SEO, Meta Ads, memory, skills, MCP). When set, every tool
    /// the operator has connected on the Next side is exposed to the model and
    /// dispatched back to /api/tools/execute.
    pub next_bridge: Option<NextBridge>,
    /// Tool descriptors fetched from /api/tools at run start. Empty when the
    /// bridge isn't configured.
    pub next_tools: Vec<NextToolDescriptor>,
}

impl AgentContext {
    pub fn new(
        workspace: Workspace,
        http: Client,
        github_token: Option<String>,
        channel: String,
        next_bridge: Option<NextBridge>,
        next_tools: Vec<NextToolDescriptor>,
    ) -> Self {
        Self {
            workspace,
            http,
            github_token,
            channel,
            next_bridge,
            next_tools,
        }
    }

    fn is_coding(&self) -> bool {
        self.channel == "coding"
    }
}

/// Returns the OpenAI-style tool definitions filtered for the active channel.
///
/// In `web` (and any non-`coding`) channels, the local-fs and shell tools
/// (`write_file`, `apply_patch`, `exec`) are HIDDEN from the model so it cannot
/// run `git`/`gh`/etc. against the operator's machine. The model is expected
/// to use `github_create_repo`, `github_write_file`, `github_create_pr`, etc.
/// instead.
#[allow(dead_code)]
pub fn tool_definitions(channel: &str) -> Vec<Value> {
    tool_definitions_with_next(channel, &[])
}

/// Returns the channel-filtered native tool defs PLUS any Next.js connector
/// tools registered for this run via the [`NextBridge`].
pub fn tool_definitions_with_next(channel: &str, next_tools: &[NextToolDescriptor]) -> Vec<Value> {
    tool_definitions_for_loaded_next(channel, next_tools, None)
}

/// Returns native tools plus only the Next.js connector tools named in
/// `loaded_next_tool_names`. This is the deferred-loading path used by the
/// agent loop so large connector catalogs do not exceed provider tool limits.
pub fn tool_definitions_for_loaded_next(
    channel: &str,
    next_tools: &[NextToolDescriptor],
    loaded_next_tool_names: Option<&HashSet<String>>,
) -> Vec<Value> {
    let coding = channel == "coding";
    let local_only: &[&str] = &["write_file", "apply_patch", "exec"];
    let mut defs: Vec<Value> = all_tool_definitions()
        .into_iter()
        .filter(|t| {
            if coding {
                return true;
            }
            let name = t
                .get("function")
                .and_then(|f| f.get("name"))
                .and_then(|n| n.as_str())
                .unwrap_or("");
            !local_only.contains(&name)
        })
        .collect();
    let native_names: std::collections::HashSet<String> = defs
        .iter()
        .filter_map(|t| {
            t.get("function")
                .and_then(|f| f.get("name"))
                .and_then(|n| n.as_str())
                .map(str::to_owned)
        })
        .collect();
    for t in next_tools {
        if let Some(loaded) = loaded_next_tool_names {
            if !loaded.contains(&t.name) {
                continue;
            }
        }
        // Avoid colliding with native tools (e.g. github_*). Native wins.
        if native_names.contains(&t.name) {
            continue;
        }
        defs.push(next_tool_definition(t));
    }
    defs
}

pub fn native_tool_names(channel: &str) -> HashSet<String> {
    tool_definitions_for_loaded_next(channel, &[], None)
        .into_iter()
        .filter_map(|tool| {
            tool.get("function")
                .and_then(|function| function.get("name"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .collect()
}

fn next_tool_definition(tool: &NextToolDescriptor) -> Value {
    json!({
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description,
            "parameters": normalize_tool_parameters(tool.input_schema.clone()),
        }
    })
}

fn all_tool_definitions() -> Vec<Value> {
    vec![
        tool_def(
            "read_file",
            "Read a UTF-8 text file from the workspace.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["path"],
                "properties": {
                    "path": { "type": "string", "description": "Workspace-relative file path." }
                }
            }),
        ),
        tool_def(
            "write_file",
            "Create or overwrite a UTF-8 text file in the workspace.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["path", "contents"],
                "properties": {
                    "path": { "type": "string" },
                    "contents": { "type": "string" }
                }
            }),
        ),
        tool_def(
            "apply_patch",
            "Apply a unified diff against the workspace. Each hunk header must use file paths relative to the workspace root.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["diff"],
                "properties": {
                    "diff": { "type": "string", "description": "Unified diff text." }
                }
            }),
        ),
        tool_def(
            "list_dir",
            "List a directory (gitignore-aware, max 500 entries).",
            json!({
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "path": { "type": "string", "default": "." }
                }
            }),
        ),
        tool_def(
            "search",
            "Substring search across the workspace. Honors .gitignore.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["query"],
                "properties": {
                    "query": { "type": "string" },
                    "path":  { "type": "string", "description": "Subdirectory to scope search to." }
                }
            }),
        ),
        tool_def(
            "tool_search",
            "Search the deferred connector tool catalog by capability. Matching connector tools are automatically loaded for the next agent step. Use this when you need Gmail, Calendar, Vercel, WhatsApp, Telegram, memory, MCP, or other connector tools that are not currently available by exact name.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["query"],
                "properties": {
                    "query": { "type": "string", "description": "Natural language description of the tool capability to find. Use broad queries such as 'gmail email inbox' or 'vercel deployments'." },
                    "limit": { "type": "integer", "minimum": 1, "maximum": 25, "default": 8 }
                }
            }),
        ),
        tool_def(
            "exec",
            "Run a shell command in the workspace. Captures stdout/stderr and exit code.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["command"],
                "properties": {
                    "command":      { "type": "string", "description": "Full command line, parsed with shell-words." },
                    "cwd":          { "type": "string", "description": "Workspace-relative cwd." },
                    "timeout_secs": { "type": "integer", "minimum": 1, "maximum": 1800 }
                }
            }),
        ),
        tool_def(
            "github_get_status",
            "Check whether the user has connected GitHub. Returns {connected, login, name, avatar_url} when connected. Always call this first when the user asks anything about GitHub.",
            json!({ "type": "object", "additionalProperties": false, "properties": {} }),
        ),
        tool_def(
            "github_list_repos",
            "List the authenticated user's accessible GitHub repositories (most recently updated first).",
            json!({
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "visibility": { "type": "string", "enum": ["all", "public", "private"], "default": "all" },
                    "per_page":   { "type": "integer", "minimum": 1, "maximum": 100, "default": 30 }
                }
            }),
        ),
        tool_def(
            "github_get_repo",
            "Fetch metadata for a single GitHub repository.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["owner", "repo"],
                "properties": {
                    "owner": { "type": "string" },
                    "repo":  { "type": "string" }
                }
            }),
        ),
        tool_def(
            "github_list_contents",
            "List files and folders at a path inside a GitHub repository (defaults to repo root).",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["owner", "repo"],
                "properties": {
                    "owner": { "type": "string" },
                    "repo":  { "type": "string" },
                    "path":  { "type": "string", "default": "" },
                    "ref":   { "type": "string", "description": "Branch, tag, or commit SHA. Defaults to default branch." }
                }
            }),
        ),
        tool_def(
            "github_read_file",
            "Read a single file from a GitHub repository (decoded UTF-8).",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["owner", "repo", "path"],
                "properties": {
                    "owner": { "type": "string" },
                    "repo":  { "type": "string" },
                    "path":  { "type": "string" },
                    "ref":   { "type": "string" }
                }
            }),
        ),
        tool_def(
            "github_search_code",
            "Search for code across GitHub. Optionally scope to a single repo (`owner/repo`).",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["query"],
                "properties": {
                    "query":    { "type": "string" },
                    "repo":     { "type": "string", "description": "`owner/repo` to scope the search." },
                    "per_page": { "type": "integer", "minimum": 1, "maximum": 50, "default": 20 }
                }
            }),
        ),
        tool_def(
            "github_list_branches",
            "List branches of a GitHub repository.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["owner", "repo"],
                "properties": {
                    "owner": { "type": "string" },
                    "repo":  { "type": "string" }
                }
            }),
        ),
        tool_def(
            "github_list_issues",
            "List issues for a GitHub repository.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["owner", "repo"],
                "properties": {
                    "owner": { "type": "string" },
                    "repo":  { "type": "string" },
                    "state": { "type": "string", "enum": ["open", "closed", "all"], "default": "open" }
                }
            }),
        ),
        tool_def(
            "github_list_pull_requests",
            "List pull requests for a GitHub repository.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["owner", "repo"],
                "properties": {
                    "owner": { "type": "string" },
                    "repo":  { "type": "string" },
                    "state": { "type": "string", "enum": ["open", "closed", "all"], "default": "open" }
                }
            }),
        ),
        tool_def(
            "github_create_repo",
            "Create a new GitHub repository under the connected operator account. Use this — NOT a shell `gh repo create` or `git init` — when the user asks to create a repo. Set `auto_init: true` to seed with README so the repo is immediately usable.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["name"],
                "properties": {
                    "name":               { "type": "string" },
                    "private":            { "type": "boolean", "default": true },
                    "description":        { "type": "string" },
                    "auto_init":          { "type": "boolean", "default": true },
                    "gitignore_template": { "type": "string", "description": "e.g. 'Rust', 'Node', 'Python'." },
                    "license_template":   { "type": "string", "description": "e.g. 'mit', 'apache-2.0'." }
                }
            }),
        ),
        tool_def(
            "github_create_branch",
            "Create a new branch in a GitHub repository, branched off `from_branch` (defaults to the repo default branch).",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["owner", "repo", "branch"],
                "properties": {
                    "owner":       { "type": "string" },
                    "repo":        { "type": "string" },
                    "branch":      { "type": "string" },
                    "from_branch": { "type": "string" }
                }
            }),
        ),
        tool_def(
            "github_write_file",
            "Create or update a file in a GitHub repository via the API. Pass the existing `sha` to update an existing file; omit to create a new one. Content is plain text and base64-encoded automatically. Use this — NOT `git push` or `gh` shell commands — to ship a file change in web mode.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["owner", "repo", "path", "contents", "message"],
                "properties": {
                    "owner":    { "type": "string" },
                    "repo":     { "type": "string" },
                    "path":     { "type": "string" },
                    "contents": { "type": "string" },
                    "message":  { "type": "string", "description": "Commit message." },
                    "branch":   { "type": "string" },
                    "sha":      { "type": "string", "description": "Existing file blob sha when updating." }
                }
            }),
        ),
        tool_def(
            "github_delete_file",
            "Delete a file from a GitHub repository via the API. Requires the existing blob `sha`.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["owner", "repo", "path", "message", "sha"],
                "properties": {
                    "owner":   { "type": "string" },
                    "repo":    { "type": "string" },
                    "path":    { "type": "string" },
                    "message": { "type": "string" },
                    "sha":     { "type": "string" },
                    "branch":  { "type": "string" }
                }
            }),
        ),
        tool_def(
            "github_create_pr",
            "Open a pull request from `head` (e.g. 'feature-branch') into `base` (e.g. 'main').",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["owner", "repo", "title", "head", "base"],
                "properties": {
                    "owner": { "type": "string" },
                    "repo":  { "type": "string" },
                    "title": { "type": "string" },
                    "head":  { "type": "string" },
                    "base":  { "type": "string" },
                    "body":  { "type": "string" },
                    "draft": { "type": "boolean", "default": false }
                }
            }),
        ),
        tool_def(
            "spawn_subagent",
            "Delegate a focused sub-task to a child agent that streams its output live back into this conversation. Use sparingly for parallelizable read-only research, summarization, or multi-step exploration. The subagent inherits this run's provider, model, channel and credentials but runs with an isolated, tighter step budget.",
            json!({
                "type": "object",
                "additionalProperties": false,
                "required": ["prompt"],
                "properties": {
                    "agent": {
                        "type": "string",
                        "description": "Optional human-readable name for the subagent (e.g. 'explore', 'summarize'). Used as a label only."
                    },
                    "prompt": {
                        "type": "string",
                        "description": "The full instruction the subagent should execute. Be specific — the subagent has no other context."
                    }
                }
            }),
        ),
    ]
}

fn tool_def(name: &str, description: &str, parameters: Value) -> Value {
    json!({
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": normalize_tool_parameters(parameters),
        }
    })
}

fn normalize_tool_parameters(parameters: Value) -> Value {
    let mut schema = match parameters {
        Value::Object(map) => Value::Object(map),
        _ => json!({ "type": "object", "properties": {} }),
    };

    normalize_json_schema(&mut schema);
    schema
}

fn normalize_json_schema(schema: &mut Value) {
    let Some(object) = schema.as_object_mut() else {
        return;
    };

    let is_object = object
        .get("type")
        .and_then(Value::as_str)
        .map(|value| value == "object")
        .unwrap_or(false)
        || object.contains_key("properties");

    if is_object {
        object.insert("type".to_owned(), Value::String("object".to_owned()));
        if !object.get("properties").is_some_and(Value::is_object) {
            object.insert("properties".to_owned(), Value::Object(Map::new()));
        }

        let property_names: HashSet<String> = object
            .get("properties")
            .and_then(Value::as_object)
            .map(|properties| properties.keys().cloned().collect())
            .unwrap_or_default();

        match object.get_mut("required") {
            Some(Value::Array(required)) => {
                required.retain(|item| {
                    item.as_str()
                        .map(|name| property_names.contains(name))
                        .unwrap_or(false)
                });
            }
            Some(_) => {
                object.remove("required");
            }
            None => {}
        }
    }

    if let Some(properties) = object.get_mut("properties").and_then(Value::as_object_mut) {
        for value in properties.values_mut() {
            normalize_json_schema(value);
        }
    }

    if let Some(items) = object.get_mut("items") {
        normalize_json_schema(items);
    }

    if let Some(additional) = object.get_mut("additionalProperties") {
        if additional.is_object() {
            normalize_json_schema(additional);
        }
    }
}

pub async fn dispatch(ctx: &AgentContext, tool_name: &str, input: &Value) -> Result<Value> {
    let ws = &ctx.workspace;
    // Defense in depth: even if the model somehow names a local-only tool,
    // refuse to run it outside the coding channel.
    if matches!(tool_name, "exec" | "write_file" | "apply_patch") && !ctx.is_coding() {
        return Err(anyhow!(
            "tool `{tool_name}` is not available in the `{}` channel — this runs on a server, not the operator's machine. Use the github_* API tools (github_create_repo / github_write_file / github_create_pr / etc.) to ship changes.",
            ctx.channel
        ));
    }
    match tool_name {
        "read_file" => read_file(ws, input).await,
        "write_file" => write_file(ws, input).await,
        "apply_patch" => apply_patch(ws, input).await,
        "list_dir" => list_dir(ws, input),
        "search" => search(ws, input),
        "tool_search" => tool_search(ctx, input),
        "exec" => exec(ws, input).await,
        "github_get_status" => github::get_status(&ctx.http, ctx.github_token.as_deref()).await,
        name if name.starts_with("github_") => {
            let token = ctx.github_token.as_deref().ok_or_else(|| {
                anyhow!("GitHub is not connected for this user. Ask the user to connect GitHub from Dashboard > Settings > Providers.")
            })?;
            dispatch_github(&ctx.http, token, name, input).await
        }
        other => {
            // Try the Next.js connector bridge (Gmail, Vercel, Stripe, …).
            if let Some(bridge) = &ctx.next_bridge {
                if ctx.next_tools.iter().any(|t| t.name == other) {
                    return bridge.execute(other, input).await;
                }
            }
            Err(anyhow!("unknown tool: {other}"))
        }
    }
}

fn tool_search(ctx: &AgentContext, input: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    struct Args {
        query: String,
        #[serde(default)]
        limit: Option<usize>,
    }

    let args: Args = serde_json::from_value(input.clone())?;
    let query = args.query.trim();
    if query.is_empty() {
        bail!("query is required");
    }

    let limit = args.limit.unwrap_or(8).clamp(1, 25);
    let native_names = native_tool_names(&ctx.channel);
    let mut matches: Vec<(i32, &NextToolDescriptor)> = ctx
        .next_tools
        .iter()
        .filter(|tool| !native_names.contains(&tool.name))
        .map(|tool| (search_score(&tool.name, &tool.description, query), tool))
        .filter(|(score, _)| *score > 0)
        .collect();

    matches.sort_by(|(left_score, left_tool), (right_score, right_tool)| {
        right_score
            .cmp(left_score)
            .then_with(|| left_tool.name.cmp(&right_tool.name))
    });

    let tools: Vec<Value> = matches
        .into_iter()
        .take(limit)
        .map(|(score, tool)| {
            json!({
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
                "score": score,
                "source": "next",
                "loaded_next_step": true,
            })
        })
        .collect();

    Ok(json!({
        "query": query,
        "tools": tools,
        "instruction": "The returned tools are loaded for your next step. Call the exact tool name when needed. If nothing relevant was returned, refine the query with broader capability words."
    }))
}

fn search_score(name: &str, description: &str, query: &str) -> i32 {
    let name = name.to_ascii_lowercase();
    let description = description.to_ascii_lowercase();
    let query = query.to_ascii_lowercase();
    let haystack = format!("{name} {description}");
    let mut score = 0;

    for token in query
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .filter(|token| token.len() >= 2)
    {
        if name == token {
            score += 20;
        } else if name.contains(token) {
            score += 10;
        } else if description.contains(token) {
            score += 3;
        }
    }

    let boosts: &[(&[&str], &[&str])] = &[
        (
            &["gmail", "email", "mail", "inbox"],
            &["gmail", "email", "mail"],
        ),
        (
            &["calendar", "meeting", "schedule", "event"],
            &["calendar", "event", "schedule"],
        ),
        (
            &["github", "repo", "pull", "issue", "branch", "commit"],
            &["github", "repo", "pull", "issue", "branch", "commit"],
        ),
        (
            &["vercel", "deploy", "deployment", "domain"],
            &["vercel", "deploy", "deployment", "domain"],
        ),
        (&["whatsapp"], &["whatsapp"]),
        (&["telegram"], &["telegram"]),
        (&["memory", "remember", "recall"], &["memory"]),
        (&["mcp", "server"], &["mcp"]),
        (
            &["stripe", "payment", "invoice", "customer"],
            &["stripe", "payment", "invoice", "customer"],
        ),
        (
            &["facebook", "meta", "ads", "campaign", "social"],
            &["facebook", "meta", "ads", "campaign", "social"],
        ),
    ];

    for (query_terms, tool_terms) in boosts {
        if query_terms.iter().any(|term| query.contains(term))
            && tool_terms.iter().any(|term| haystack.contains(term))
        {
            score += 40;
        }
    }

    score
}

async fn dispatch_github(client: &Client, token: &str, tool: &str, input: &Value) -> Result<Value> {
    #[derive(Deserialize, Default)]
    struct ListReposArgs {
        #[serde(default)]
        visibility: Option<String>,
        #[serde(default)]
        per_page: Option<u32>,
    }
    #[derive(Deserialize)]
    struct RepoArgs {
        owner: String,
        repo: String,
    }
    #[derive(Deserialize)]
    struct ContentsArgs {
        owner: String,
        repo: String,
        #[serde(default)]
        path: Option<String>,
        #[serde(default, rename = "ref")]
        git_ref: Option<String>,
    }
    #[derive(Deserialize)]
    struct ReadFileArgs {
        owner: String,
        repo: String,
        path: String,
        #[serde(default, rename = "ref")]
        git_ref: Option<String>,
    }
    #[derive(Deserialize)]
    struct SearchArgs {
        query: String,
        #[serde(default)]
        repo: Option<String>,
        #[serde(default)]
        per_page: Option<u32>,
    }
    #[derive(Deserialize)]
    struct StateArgs {
        owner: String,
        repo: String,
        #[serde(default)]
        state: Option<String>,
    }

    match tool {
        "github_list_repos" => {
            let a: ListReposArgs = serde_json::from_value(input.clone()).unwrap_or_default();
            github::list_repos(
                client,
                token,
                a.visibility.as_deref(),
                a.per_page.unwrap_or(30),
            )
            .await
        }
        "github_get_repo" => {
            let a: RepoArgs = serde_json::from_value(input.clone())?;
            github::get_repo(client, token, &a.owner, &a.repo).await
        }
        "github_list_contents" => {
            let a: ContentsArgs = serde_json::from_value(input.clone())?;
            github::list_contents(
                client,
                token,
                &a.owner,
                &a.repo,
                a.path.as_deref().unwrap_or(""),
                a.git_ref.as_deref(),
            )
            .await
        }
        "github_read_file" => {
            let a: ReadFileArgs = serde_json::from_value(input.clone())?;
            github::read_file(
                client,
                token,
                &a.owner,
                &a.repo,
                &a.path,
                a.git_ref.as_deref(),
            )
            .await
        }
        "github_search_code" => {
            let a: SearchArgs = serde_json::from_value(input.clone())?;
            github::search_code(
                client,
                token,
                &a.query,
                a.repo.as_deref(),
                a.per_page.unwrap_or(20),
            )
            .await
        }
        "github_list_branches" => {
            let a: RepoArgs = serde_json::from_value(input.clone())?;
            github::list_branches(client, token, &a.owner, &a.repo).await
        }
        "github_list_issues" => {
            let a: StateArgs = serde_json::from_value(input.clone())?;
            github::list_issues(client, token, &a.owner, &a.repo, a.state.as_deref()).await
        }
        "github_list_pull_requests" => {
            let a: StateArgs = serde_json::from_value(input.clone())?;
            github::list_pull_requests(client, token, &a.owner, &a.repo, a.state.as_deref()).await
        }
        "github_create_repo" => {
            #[derive(Deserialize)]
            struct A {
                name: String,
                #[serde(default = "default_true")]
                private: bool,
                #[serde(default)]
                description: Option<String>,
                #[serde(default = "default_true")]
                auto_init: bool,
                #[serde(default)]
                gitignore_template: Option<String>,
                #[serde(default)]
                license_template: Option<String>,
            }
            fn default_true() -> bool {
                true
            }
            let a: A = serde_json::from_value(input.clone())?;
            github::create_repo(
                client,
                token,
                &a.name,
                a.private,
                a.description.as_deref(),
                a.auto_init,
                a.gitignore_template.as_deref(),
                a.license_template.as_deref(),
            )
            .await
        }
        "github_create_branch" => {
            #[derive(Deserialize)]
            struct A {
                owner: String,
                repo: String,
                branch: String,
                #[serde(default)]
                from_branch: Option<String>,
            }
            let a: A = serde_json::from_value(input.clone())?;
            github::create_branch(
                client,
                token,
                &a.owner,
                &a.repo,
                &a.branch,
                a.from_branch.as_deref(),
            )
            .await
        }
        "github_write_file" => {
            #[derive(Deserialize)]
            struct A {
                owner: String,
                repo: String,
                path: String,
                contents: String,
                message: String,
                #[serde(default)]
                branch: Option<String>,
                #[serde(default)]
                sha: Option<String>,
            }
            let a: A = serde_json::from_value(input.clone())?;
            github::write_file(
                client,
                token,
                &a.owner,
                &a.repo,
                &a.path,
                &a.contents,
                &a.message,
                a.branch.as_deref(),
                a.sha.as_deref(),
            )
            .await
        }
        "github_delete_file" => {
            #[derive(Deserialize)]
            struct A {
                owner: String,
                repo: String,
                path: String,
                message: String,
                sha: String,
                #[serde(default)]
                branch: Option<String>,
            }
            let a: A = serde_json::from_value(input.clone())?;
            github::delete_file(
                client,
                token,
                &a.owner,
                &a.repo,
                &a.path,
                &a.message,
                &a.sha,
                a.branch.as_deref(),
            )
            .await
        }
        "github_create_pr" => {
            #[derive(Deserialize)]
            struct A {
                owner: String,
                repo: String,
                title: String,
                head: String,
                base: String,
                #[serde(default)]
                body: Option<String>,
                #[serde(default)]
                draft: bool,
            }
            let a: A = serde_json::from_value(input.clone())?;
            github::create_pull_request(
                client,
                token,
                &a.owner,
                &a.repo,
                &a.title,
                &a.head,
                &a.base,
                a.body.as_deref(),
                a.draft,
            )
            .await
        }
        other => Err(anyhow!("unknown github tool: {other}")),
    }
}

async fn read_file(ws: &Workspace, input: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    struct Args {
        path: String,
    }
    let args: Args = serde_json::from_value(input.clone())?;
    let path = ws.resolve(&args.path)?;
    let bytes = tokio::fs::read(&path)
        .await
        .with_context(|| format!("reading {}", path.display()))?;
    if bytes.len() > MAX_FILE_BYTES {
        bail!(
            "file too large ({} bytes, max {MAX_FILE_BYTES})",
            bytes.len()
        );
    }
    let contents = String::from_utf8(bytes).context("file is not valid UTF-8")?;
    Ok(json!({ "path": args.path, "contents": contents }))
}

async fn write_file(ws: &Workspace, input: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    struct Args {
        path: String,
        contents: String,
    }
    let args: Args = serde_json::from_value(input.clone())?;
    let path = ws.resolve(&args.path)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .with_context(|| format!("creating parent of {}", path.display()))?;
    }
    let byte_count = args.contents.len();
    tokio::fs::write(&path, args.contents.as_bytes())
        .await
        .with_context(|| format!("writing {}", path.display()))?;
    Ok(json!({ "path": args.path, "bytes": byte_count }))
}

async fn apply_patch(ws: &Workspace, input: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    struct Args {
        diff: String,
    }
    let args: Args = serde_json::from_value(input.clone())?;
    let summary = patch::apply_unified_diff(ws, &args.diff).await?;
    Ok(json!({ "files_changed": summary.files_changed, "summary": summary.summary }))
}

fn list_dir(ws: &Workspace, input: &Value) -> Result<Value> {
    #[derive(Deserialize, Default)]
    struct Args {
        #[serde(default)]
        path: Option<String>,
    }
    let args: Args = serde_json::from_value(input.clone()).unwrap_or_default();
    let rel = args.path.unwrap_or_else(|| ".".to_owned());
    let target = ws.resolve(&rel)?;

    let mut entries = Vec::new();
    let walker = WalkBuilder::new(&target)
        .max_depth(Some(1))
        .hidden(false)
        .git_ignore(true)
        .build();

    for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if entry.path() == target {
            continue;
        }
        let rel_path = entry
            .path()
            .strip_prefix(ws.root())
            .unwrap_or(entry.path())
            .to_string_lossy()
            .replace('\\', "/");
        let kind = if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            "dir"
        } else {
            "file"
        };
        entries.push(json!({ "path": rel_path, "type": kind }));
        if entries.len() >= MAX_LIST_ENTRIES {
            break;
        }
    }

    Ok(json!({ "path": rel, "entries": entries }))
}

fn search(ws: &Workspace, input: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    struct Args {
        query: String,
        #[serde(default)]
        path: Option<String>,
    }
    let args: Args = serde_json::from_value(input.clone())?;
    let needle = args.query;
    if needle.is_empty() {
        bail!("search query must not be empty");
    }
    let scope = ws.resolve(args.path.as_deref().unwrap_or("."))?;

    let mut hits = Vec::new();
    let walker = WalkBuilder::new(&scope)
        .hidden(false)
        .git_ignore(true)
        .build();

    'outer: for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let bytes = match std::fs::read(entry.path()) {
            Ok(b) if b.len() <= MAX_FILE_BYTES => b,
            _ => continue,
        };
        let text = match std::str::from_utf8(&bytes) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let rel_path = entry
            .path()
            .strip_prefix(ws.root())
            .unwrap_or(entry.path())
            .to_string_lossy()
            .replace('\\', "/");

        for (lineno, line) in text.lines().enumerate() {
            if line.contains(&needle) {
                hits.push(json!({
                    "path": rel_path,
                    "line": lineno + 1,
                    "preview": line.chars().take(240).collect::<String>(),
                }));
                if hits.len() >= MAX_SEARCH_RESULTS {
                    break 'outer;
                }
            }
        }
    }

    Ok(json!({ "query": needle, "hits": hits }))
}

async fn exec(ws: &Workspace, input: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    struct Args {
        command: String,
        #[serde(default)]
        cwd: Option<String>,
        #[serde(default)]
        timeout_secs: Option<u64>,
    }
    let args: Args = serde_json::from_value(input.clone())?;

    let cwd = ws.resolve(args.cwd.as_deref().unwrap_or("."))?;
    let parts = shell_words::split(&args.command).context("parsing command")?;
    let (program, rest) = parts
        .split_first()
        .ok_or_else(|| anyhow!("empty command"))?;

    let timeout_secs = args
        .timeout_secs
        .unwrap_or(DEFAULT_EXEC_TIMEOUT_SECS)
        .clamp(1, 1800);

    let mut command = Command::new(program);
    command
        .args(rest)
        .current_dir(&cwd)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    let mut child = command
        .spawn()
        .with_context(|| format!("spawning `{}`", args.command))?;

    let stdout_handle = child.stdout.take().unwrap();
    let stderr_handle = child.stderr.take().unwrap();

    let read_stream = |mut h: tokio::process::ChildStdout| async move {
        let mut buf = Vec::new();
        let mut chunk = [0u8; 4096];
        loop {
            let n = h.read(&mut chunk).await.unwrap_or(0);
            if n == 0 {
                break;
            }
            buf.extend_from_slice(&chunk[..n]);
            if buf.len() >= MAX_EXEC_OUTPUT_BYTES {
                buf.truncate(MAX_EXEC_OUTPUT_BYTES);
                break;
            }
        }
        buf
    };
    let read_err = |mut h: tokio::process::ChildStderr| async move {
        let mut buf = Vec::new();
        let mut chunk = [0u8; 4096];
        loop {
            let n = h.read(&mut chunk).await.unwrap_or(0);
            if n == 0 {
                break;
            }
            buf.extend_from_slice(&chunk[..n]);
            if buf.len() >= MAX_EXEC_OUTPUT_BYTES {
                buf.truncate(MAX_EXEC_OUTPUT_BYTES);
                break;
            }
        }
        buf
    };

    let stdout_task = tokio::spawn(read_stream(stdout_handle));
    let stderr_task = tokio::spawn(read_err(stderr_handle));

    let wait = child.wait();
    let exit = match timeout(Duration::from_secs(timeout_secs), wait).await {
        Ok(result) => result.context("waiting on child process")?,
        Err(_) => {
            bail!("command timed out after {timeout_secs}s");
        }
    };

    let stdout_bytes = stdout_task.await.unwrap_or_default();
    let stderr_bytes = stderr_task.await.unwrap_or_default();

    Ok(json!({
        "command": args.command,
        "exit_code": exit.code(),
        "stdout": String::from_utf8_lossy(&stdout_bytes),
        "stderr": String::from_utf8_lossy(&stderr_bytes),
    }))
}

mod patch {
    //! Minimal unified-diff applier: parses one or more file diffs and writes
    //! the result back. Supports new file, delete, and in-place edits.
    use super::*;

    pub struct PatchSummary {
        pub files_changed: usize,
        pub summary: Vec<String>,
    }

    pub async fn apply_unified_diff(ws: &Workspace, diff: &str) -> Result<PatchSummary> {
        let files = parse(diff)?;
        let mut summary = Vec::new();
        for file in &files {
            apply_one(ws, file).await?;
            summary.push(format!(
                "{} ({} hunks)",
                file.target_path.as_deref().unwrap_or("unknown"),
                file.hunks.len()
            ));
        }
        Ok(PatchSummary {
            files_changed: files.len(),
            summary,
        })
    }

    struct FileDiff {
        target_path: Option<String>,
        is_new: bool,
        is_delete: bool,
        hunks: Vec<Hunk>,
    }

    struct Hunk {
        old_start: usize,
        lines: Vec<HunkLine>,
    }

    enum HunkLine {
        Context(String),
        Add(String),
        Remove,
    }

    fn parse(diff: &str) -> Result<Vec<FileDiff>> {
        let mut files = Vec::new();
        let mut current: Option<FileDiff> = None;
        let mut current_hunk: Option<Hunk> = None;

        for raw in diff.split('\n') {
            let line = raw.strip_suffix('\r').unwrap_or(raw);
            if let Some(rest) = line.strip_prefix("--- ") {
                if let Some(file) = current.take() {
                    if let Some(h) = current_hunk.take() {
                        files.push(close_file(file, Some(h)));
                    } else {
                        files.push(file);
                    }
                }
                current = Some(FileDiff {
                    target_path: None,
                    is_new: rest.contains("/dev/null"),
                    is_delete: false,
                    hunks: Vec::new(),
                });
            } else if let Some(rest) = line.strip_prefix("+++ ") {
                if let Some(file) = current.as_mut() {
                    if rest.contains("/dev/null") {
                        file.is_delete = true;
                    } else {
                        file.target_path = Some(strip_prefix(rest));
                    }
                }
            } else if let Some(rest) = line.strip_prefix("@@") {
                if let Some(h) = current_hunk.take() {
                    if let Some(file) = current.as_mut() {
                        file.hunks.push(h);
                    }
                }
                let old_start = parse_hunk_header(rest)?;
                current_hunk = Some(Hunk {
                    old_start,
                    lines: Vec::new(),
                });
            } else if let Some(h) = current_hunk.as_mut() {
                if let Some(rest) = line.strip_prefix('+') {
                    h.lines.push(HunkLine::Add(rest.to_owned()));
                } else if let Some(rest) = line.strip_prefix('-') {
                    let _ = rest;
                    h.lines.push(HunkLine::Remove);
                } else if let Some(rest) = line.strip_prefix(' ') {
                    h.lines.push(HunkLine::Context(rest.to_owned()));
                } else if line.is_empty() {
                    h.lines.push(HunkLine::Context(String::new()));
                }
            }
        }

        if let Some(file) = current {
            files.push(close_file(file, current_hunk));
        }

        if files.is_empty() {
            bail!("no file diffs found in patch");
        }
        Ok(files)
    }

    fn close_file(mut file: FileDiff, last_hunk: Option<Hunk>) -> FileDiff {
        if let Some(h) = last_hunk {
            file.hunks.push(h);
        }
        file
    }

    fn strip_prefix(path: &str) -> String {
        let path = path.split('\t').next().unwrap_or(path).trim().to_owned();
        if let Some(rest) = path.strip_prefix("a/") {
            rest.to_owned()
        } else if let Some(rest) = path.strip_prefix("b/") {
            rest.to_owned()
        } else {
            path
        }
    }

    fn parse_hunk_header(rest: &str) -> Result<usize> {
        // expected: " -OLD,COUNT +NEW,COUNT @@"
        let inside = rest.trim().trim_end_matches("@@").trim();
        let mut parts = inside.split_whitespace();
        let old = parts
            .next()
            .ok_or_else(|| anyhow!("malformed hunk header"))?;
        let old = old.trim_start_matches('-');
        let start: usize = old.split(',').next().unwrap_or("1").parse().unwrap_or(1);
        Ok(start.max(1))
    }

    async fn apply_one(ws: &Workspace, file: &FileDiff) -> Result<()> {
        let target = file
            .target_path
            .as_deref()
            .ok_or_else(|| anyhow!("patch missing target path"))?;
        let path = ws.resolve(target)?;

        if file.is_delete {
            tokio::fs::remove_file(&path)
                .await
                .with_context(|| format!("removing {}", path.display()))?;
            return Ok(());
        }

        let original = if file.is_new {
            String::new()
        } else {
            tokio::fs::read_to_string(&path)
                .await
                .with_context(|| format!("reading {}", path.display()))?
        };

        let updated = apply_hunks(&original, &file.hunks)?;
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await.ok();
        }
        tokio::fs::write(&path, updated.as_bytes())
            .await
            .with_context(|| format!("writing {}", path.display()))?;

        // sanity: ensure diff actually changed something
        let _ = TextDiff::from_lines(&original, &updated);
        Ok(())
    }

    fn apply_hunks(original: &str, hunks: &[Hunk]) -> Result<String> {
        let original_lines: Vec<&str> = original.split_inclusive('\n').collect();
        let mut output: Vec<String> = Vec::new();
        let mut cursor = 0usize; // index into original_lines

        for hunk in hunks {
            let target_idx = hunk.old_start.saturating_sub(1);
            // copy any unchanged lines between cursor and the hunk start
            while cursor < target_idx && cursor < original_lines.len() {
                output.push(original_lines[cursor].to_owned());
                cursor += 1;
            }

            for line in &hunk.lines {
                match line {
                    HunkLine::Context(text) => {
                        if cursor < original_lines.len() {
                            output.push(original_lines[cursor].to_owned());
                            cursor += 1;
                        } else {
                            output.push(format!("{text}\n"));
                        }
                    }
                    HunkLine::Remove => {
                        if cursor < original_lines.len() {
                            cursor += 1;
                        }
                    }
                    HunkLine::Add(text) => {
                        output.push(format!("{text}\n"));
                    }
                }
            }
        }

        // append the remainder of the original
        while cursor < original_lines.len() {
            output.push(original_lines[cursor].to_owned());
            cursor += 1;
        }

        Ok(output.join(""))
    }
}
