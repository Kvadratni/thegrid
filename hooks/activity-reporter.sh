#!/bin/bash

GRID_SERVER="${GRID_SERVER:-http://localhost:3001}"

send_event() {
    local hook_event="$1"
    local tool_name="$2"
    local file_path="$3"
    local agent_type="${4:-main}"

    local payload=$(cat <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "sessionId": "${CLAUDE_SESSION_ID:-unknown}",
    "hookEvent": "$hook_event",
    "toolName": "$tool_name",
    "filePath": "$file_path",
    "agentType": "$agent_type",
    "details": {}
}
EOF
)

    curl -s -X POST "${GRID_SERVER}/api/events" \
        -H "Content-Type: application/json" \
        -d "$payload" > /dev/null 2>&1 &
}

extract_file_path() {
    local input="$1"
    echo "$input" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//' || \
    echo "$input" | grep -oE '"path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//' || \
    echo ""
}

read -r input_line

hook_event="${CLAUDE_HOOK_EVENT:-PreToolUse}"
tool_name="${CLAUDE_TOOL_NAME:-Unknown}"
file_path=$(extract_file_path "$input_line")

case "$tool_name" in
    Read|Write|Edit|Glob|Grep)
        send_event "$hook_event" "$tool_name" "$file_path"
        ;;
    Bash)
        working_dir="${CLAUDE_WORKING_DIRECTORY:-$(pwd)}"
        send_event "$hook_event" "$tool_name" "$working_dir"
        ;;
    Task)
        send_event "$hook_event" "$tool_name" "$file_path" "subagent"
        ;;
    *)
        send_event "$hook_event" "$tool_name" ""
        ;;
esac

echo "$input_line"
exit 0
