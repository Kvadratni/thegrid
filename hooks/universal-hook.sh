#!/bin/bash
# Universal Activity Reporter for The Grid
# Works with any ACP-enabled agent. Auto-detects the agent provider or
# accepts it via $GRID_PROVIDER environment variable.
#
# Usage:
#   GRID_PROVIDER=gemini bash /path/to/thegrid/hooks/universal-hook.sh
#
# Or set up as a hook in your agent's config. The script will attempt to
# auto-detect the provider from CLAUDE_* or other env vars.

GRID_SERVER="${GRID_SERVER:-http://localhost:3001}"
DEBUG_LOG="/tmp/thegrid-hooks.log"

# Read all stdin first
input_line=$(cat)

# Auto-detect provider from environment
if [ -n "$GRID_PROVIDER" ]; then
    provider="$GRID_PROVIDER"
elif [ -n "$CLAUDE_PROJECT_DIR" ] || [ -n "$CLAUDE_SESSION_ID" ]; then
    provider="claude"
elif [ -n "$GEMINI_PROJECT_DIR" ]; then
    provider="gemini"
elif [ -n "$CODEX_SESSION" ]; then
    provider="codex"
elif [ -n "$GOOSE_SESSION" ]; then
    provider="goose"
elif [ -n "$KILOCODE_SESSION" ] || [ -n "$OPENCODE_SESSION" ]; then
    provider="kilocode"
else
    provider="generic"
fi

echo "[$(date)] === UNIVERSAL HOOK ($provider) ===" >> "$DEBUG_LOG"
echo "STDIN: $input_line" >> "$DEBUG_LOG"

send_event() {
    local tool_name="$1"
    local file_path="$2"
    local hook_event="$3"
    local command="$4"

    local escaped_command=$(echo "$command" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ')

    local details='{}'
    if [ -n "$command" ]; then
        details="{\"command\": \"$escaped_command\"}"
    fi

    local session_id="${CLAUDE_PROJECT_DIR:-${GEMINI_PROJECT_DIR:-${CODEX_SESSION:-${GOOSE_SESSION:-unknown}}}}"

    local payload=$(cat <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "sessionId": "$session_id",
    "hookEvent": "$hook_event",
    "toolName": "$tool_name",
    "filePath": "$file_path",
    "agentType": "main",
    "provider": "$provider",
    "details": $details
}
EOF
)

    curl -s -X POST "${GRID_SERVER}/api/events" \
        -H "Content-Type: application/json" \
        -d "$payload" > /dev/null 2>&1 &
}

# Extract tool name from JSON input (supports multiple formats)
tool_name=$(echo "$input_line" | grep -oE '"tool_name"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
if [ -z "$tool_name" ]; then
    tool_name=$(echo "$input_line" | grep -oE '"name"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
fi

# Extract file path
file_path=$(echo "$input_line" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
if [ -z "$file_path" ]; then
    file_path=$(echo "$input_line" | grep -oE '"path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
fi

# Extract command for shell/bash tools
command=""
if [ "$tool_name" = "Bash" ] || [ "$tool_name" = "ExecuteCommand" ] || [ "$tool_name" = "shell" ] || [ "$tool_name" = "runCommand" ]; then
    command=$(echo "$input_line" | grep -oE '"command"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
fi

hook_event=$(echo "$input_line" | grep -oE '"hook_event"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
if [ -z "$hook_event" ]; then
    hook_event="ToolUse"
fi

echo "[$(date)] Extracted: provider=$provider tool=$tool_name file=$file_path event=$hook_event" >> "$DEBUG_LOG"

if [ -n "$tool_name" ]; then
    send_event "$tool_name" "$file_path" "$hook_event" "$command"
fi

# Pass through the input unchanged
echo "$input_line"
exit 0
