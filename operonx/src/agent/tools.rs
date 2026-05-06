//! Native Rust tools available to the coding agent.
//!
//! All paths are resolved against `Workspace::root` and refuse to escape it.

use std::{
    path::{Component, Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use anyhow::{Context, Result, anyhow, bail};
use ignore::WalkBuilder;
use serde::Deserialize;
use serde_json::{Value, json};
use similar::TextDiff;
use tokio::{io::AsyncReadExt, process::Command, time::timeout};

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
        std::fs::create_dir_all(&root).with_context(|| {
            format!("creating workspace root {}", root.display())
        })?;
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

/// Returns the OpenAI-style tool definitions.
pub fn tool_definitions() -> Vec<Value> {
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
    ]
}

fn tool_def(name: &str, description: &str, parameters: Value) -> Value {
    json!({
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": parameters,
        }
    })
}

pub async fn dispatch(ws: &Workspace, tool_name: &str, input: &Value) -> Result<Value> {
    match tool_name {
        "read_file" => read_file(ws, input).await,
        "write_file" => write_file(ws, input).await,
        "apply_patch" => apply_patch(ws, input).await,
        "list_dir" => list_dir(ws, input),
        "search" => search(ws, input),
        "exec" => exec(ws, input).await,
        other => Err(anyhow!("unknown tool: {other}")),
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
        bail!("file too large ({} bytes, max {MAX_FILE_BYTES})", bytes.len());
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
    let (program, rest) = parts.split_first().ok_or_else(|| anyhow!("empty command"))?;

    let timeout_secs = args.timeout_secs.unwrap_or(DEFAULT_EXEC_TIMEOUT_SECS).clamp(1, 1800);

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
        Remove(String),
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
                    h.lines.push(HunkLine::Remove(rest.to_owned()));
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
        let old = parts.next().ok_or_else(|| anyhow!("malformed hunk header"))?;
        let old = old.trim_start_matches('-');
        let start: usize = old
            .split(',')
            .next()
            .unwrap_or("1")
            .parse()
            .unwrap_or(1);
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
                    HunkLine::Remove(_) => {
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
