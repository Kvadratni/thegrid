#!/bin/bash

GRID_SERVER="${GRID_SERVER:-http://localhost:3001}"
DEBUG_LOG="/tmp/thegrid-hooks.log"

# Read all stdin first
input_line=$(cat)

echo "[$(date)] === HOOK CALLED ===" >> "$DEBUG_LOG"
echo "CLAUDE_* env vars:" >> "$DEBUG_LOG"
env | grep -i claude >> "$DEBUG_LOG" 2>/dev/null || echo "  (none)" >> "$DEBUG_LOG"
echo "STDIN: $input_line" >> "$DEBUG_LOG"
echo "---" >> "$DEBUG_LOG"

send_event() {
    local tool_name="$1"
    local file_path="$2"
    local hook_event="$3"
    local command="$4"

    # Escape the command for JSON (replace quotes and newlines)
    local escaped_command=$(echo "$command" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ')

    local details='{}'
    if [ -n "$command" ]; then
        details="{\"command\": \"$escaped_command\"}"
    fi

    local payload=$(cat <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "sessionId": "${CLAUDE_PROJECT_DIR:-unknown}",
    "hookEvent": "$hook_event",
    "toolName": "$tool_name",
    "filePath": "$file_path",
    "agentType": "main",
    "details": $details
}
EOF
)

    curl -s -X POST "${GRID_SERVER}/api/events" \
        -H "Content-Type: application/json" \
        -d "$payload" > /dev/null 2>&1 &
}

# Try to extract tool name and file path from the JSON input
tool_name=$(echo "$input_line" | grep -oE '"tool_name"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
if [ -z "$tool_name" ]; then
    tool_name=$(echo "$input_line" | grep -oE '"name"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
fi

file_path=$(echo "$input_line" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
if [ -z "$file_path" ]; then
    file_path=$(echo "$input_line" | grep -oE '"path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
fi

# Extract command for Bash tool
command=""
if [ "$tool_name" = "Bash" ]; then
    command=$(echo "$input_line" | grep -oE '"command"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
fi

hook_event=$(echo "$input_line" | grep -oE '"hook_event"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
if [ -z "$hook_event" ]; then
    hook_event="ToolUse"
fi

echo "[$(date)] Extracted: tool=$tool_name file=$file_path event=$hook_event cmd=$command" >> "$DEBUG_LOG"

if [ -n "$tool_name" ]; then
    send_event "$tool_name" "$file_path" "$hook_event" "$command"
fi

# Pass through the input unchanged
echo "$input_line"
exit 0
