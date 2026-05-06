//! Helpers for constructing AI SDK v5 UI Message Stream Protocol frames.
//!
//! Every helper returns a `serde_json::Value` ready to be serialized as a
//! single `data: {...}` SSE frame.

use serde_json::{Value, json};

pub fn start(message_id: &str) -> Value {
    json!({ "type": "start", "messageId": message_id })
}

pub fn start_step() -> Value {
    json!({ "type": "start-step" })
}

pub fn finish_step() -> Value {
    json!({ "type": "finish-step" })
}

pub fn finish() -> Value {
    json!({ "type": "finish" })
}

pub fn text_start(id: &str) -> Value {
    json!({ "type": "text-start", "id": id })
}

pub fn text_delta(id: &str, delta: &str) -> Value {
    json!({ "type": "text-delta", "id": id, "delta": delta })
}

pub fn text_end(id: &str) -> Value {
    json!({ "type": "text-end", "id": id })
}

pub fn tool_input_start(tool_call_id: &str, tool_name: &str) -> Value {
    json!({
        "type": "tool-input-start",
        "toolCallId": tool_call_id,
        "toolName": tool_name,
    })
}

pub fn tool_input_delta(tool_call_id: &str, delta: &str) -> Value {
    json!({
        "type": "tool-input-delta",
        "toolCallId": tool_call_id,
        "inputTextDelta": delta,
    })
}

pub fn tool_input_available(tool_call_id: &str, tool_name: &str, input: &Value) -> Value {
    json!({
        "type": "tool-input-available",
        "toolCallId": tool_call_id,
        "toolName": tool_name,
        "input": input,
    })
}

pub fn tool_output_available(tool_call_id: &str, output: &Value) -> Value {
    json!({
        "type": "tool-output-available",
        "toolCallId": tool_call_id,
        "output": output,
    })
}

pub fn tool_output_error(tool_call_id: &str, error_text: &str) -> Value {
    json!({
        "type": "tool-output-error",
        "toolCallId": tool_call_id,
        "errorText": error_text,
    })
}

pub fn error(error_text: &str) -> Value {
    json!({ "type": "error", "errorText": error_text })
}
