//! Helpers for emitting SSE event frames in the envelope shape consumed by
//! the in-app `useStreamEvents` hook: `{ "type": "...", "data": { ... } }`.

use serde_json::{Value, json};

pub fn reasoning_start() -> Value {
    json!({ "type": "reasoning-start", "data": {} })
}

pub fn reasoning_delta(text: &str) -> Value {
    json!({ "type": "reasoning-delta", "data": { "text": text } })
}

pub fn reasoning_end() -> Value {
    json!({ "type": "reasoning-end", "data": {} })
}

pub fn text_delta(text: &str) -> Value {
    json!({ "type": "text-delta", "data": { "text": text } })
}

pub fn text_end() -> Value {
    json!({ "type": "text-end", "data": {} })
}

pub fn tool_call_start(tool_call_id: &str, tool_name: &str) -> Value {
    json!({
        "type": "tool-call-start",
        "data": { "toolCallId": tool_call_id, "toolName": tool_name }
    })
}

pub fn tool_call_input_streaming(tool_call_id: &str, args: &Value) -> Value {
    json!({
        "type": "tool-call-input-streaming",
        "data": { "toolCallId": tool_call_id, "args": args }
    })
}

pub fn tool_call_input_available(tool_call_id: &str, args: &Value) -> Value {
    json!({
        "type": "tool-call-input-available",
        "data": { "toolCallId": tool_call_id, "args": args }
    })
}

pub fn tool_call_execute(tool_call_id: &str) -> Value {
    json!({
        "type": "tool-call-execute",
        "data": { "toolCallId": tool_call_id }
    })
}

pub fn tool_call_output_available(tool_call_id: &str, result: &Value) -> Value {
    json!({
        "type": "tool-call-output-available",
        "data": { "toolCallId": tool_call_id, "result": result }
    })
}

pub fn tool_call_output_error(tool_call_id: &str, error_text: &str) -> Value {
    json!({
        "type": "tool-call-output-error",
        "data": { "toolCallId": tool_call_id, "errorText": error_text }
    })
}

pub fn tool_call_end(tool_call_id: &str) -> Value {
    json!({
        "type": "tool-call-end",
        "data": { "toolCallId": tool_call_id }
    })
}

pub fn message_end() -> Value {
    json!({ "type": "message-end", "data": {} })
}

pub fn error(error_text: &str) -> Value {
    json!({ "type": "error", "data": { "errorText": error_text } })
}
