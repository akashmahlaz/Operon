use std::process::ExitStatus;
use std::sync::Arc;

use serde::Serialize;
use tokio::process::Command;

#[derive(Clone)]
pub struct CodexBridge {
    command: Arc<str>,
}

#[derive(Debug, Serialize)]
pub struct CodexHealth {
    pub status: CodexHealthStatus,
    pub command: String,
    pub app_server_available: bool,
    pub details: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CodexHealthStatus {
    Ready,
    Unavailable,
}

impl CodexBridge {
    pub fn new(command: impl Into<String>) -> Self {
        Self {
            command: Arc::from(command.into()),
        }
    }

    pub async fn health(&self) -> CodexHealth {
        match Command::new(self.command.as_ref())
            .arg("app-server")
            .arg("--help")
            .output()
            .await
        {
            Ok(output) if output.status.success() => CodexHealth {
                status: CodexHealthStatus::Ready,
                command: self.command.to_string(),
                app_server_available: true,
                details: output_summary(output.status, &output.stdout, &output.stderr),
            },
            Ok(output) => CodexHealth {
                status: CodexHealthStatus::Unavailable,
                command: self.command.to_string(),
                app_server_available: false,
                details: output_summary(output.status, &output.stdout, &output.stderr),
            },
            Err(error) => CodexHealth {
                status: CodexHealthStatus::Unavailable,
                command: self.command.to_string(),
                app_server_available: false,
                details: error.to_string(),
            },
        }
    }
}

fn output_summary(status: ExitStatus, stdout: &[u8], stderr: &[u8]) -> String {
    let stdout = String::from_utf8_lossy(stdout).trim().to_owned();
    let stderr = String::from_utf8_lossy(stderr).trim().to_owned();

    if !stderr.is_empty() {
        return format!("exit_status={status}; stderr={stderr}");
    }

    if !stdout.is_empty() {
        let first_line = stdout.lines().next().unwrap_or_default();
        return format!("exit_status={status}; stdout={first_line}");
    }

    format!("exit_status={status}")
}
