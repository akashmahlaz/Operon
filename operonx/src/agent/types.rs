use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type RunId = Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct RunRequest {
    /// Initial user prompt that kicks off the run.
    pub prompt: String,
    /// Provider-qualified model id. Defaults to "openai:gpt-4o-mini" if absent.
    #[serde(default)]
    pub model: Option<String>,
    /// Optional pre-existing conversation id; new one is created if absent.
    #[serde(default)]
    pub conversation_id: Option<Uuid>,
    /// Conversation channel. Defaults to coding for /api/coding and web for /api/chat proxies.
    #[serde(default)]
    pub channel: Option<String>,
    /// Optional workspace path override (must already exist & be inside the
    /// configured workspace root).
    #[serde(default)]
    pub workspace: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunStatus {
    Queued,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl RunStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Running => "running",
            Self::Paused => "paused",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }
}

/// Internal event broadcast from the runner to subscribers (SSE clients).
///
/// `sequence` matches the `run_events.sequence` column so reconnecting clients
/// can replay-then-tail.
#[derive(Debug, Clone, Serialize)]
pub struct AgentEvent {
    pub sequence: i64,
    /// Raw payload as serialized for the AI SDK UI Message Stream Protocol.
    /// Each value is one `data: ...` SSE frame body.
    pub frame: serde_json::Value,
}
