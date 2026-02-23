import type { AgentProvider, ProviderConfig, ParsedStreamEvent } from './types.js';

// ─── Tool Name Normalization ───────────────────────────────────────────────────
// Maps provider-specific tool names to The Grid's canonical tool names.

const TOOL_NAME_MAP: Record<string, string> = {
    // Claude
    Read: 'Read', Write: 'Write', Edit: 'Edit', Bash: 'Bash',
    Glob: 'Glob', Grep: 'Grep', Task: 'Task', Delete: 'Delete',
    WebFetch: 'WebFetch', WebSearch: 'WebSearch', TodoWrite: 'TodoWrite',
    NotebookEdit: 'NotebookEdit', AskUserQuestion: 'AskUserQuestion',

    // Gemini CLI (actual stream-json tool names)
    read_file: 'Read', write_file: 'Write', edit_file: 'Edit',
    run_shell_command: 'Bash', search_files: 'Grep', list_directory: 'Glob',
    ReadFile: 'Read', WriteFile: 'Write', EditFile: 'Edit',
    ExecuteCommand: 'Bash', Search: 'Grep', ListFiles: 'Glob',
    ReadDirectory: 'Glob',

    // Codex CLI (read_file/write_file already covered by Gemini above)
    patch: 'Edit',
    shell: 'Bash', grep: 'Grep', ls: 'Glob',

    // Goose
    read: 'Read', write: 'Write', edit: 'Edit',
    bash: 'Bash', search: 'Grep', list: 'Glob',

    // Kilocode / OpenCode
    readFile: 'Read', writeFile: 'Write', editFile: 'Edit',
    runCommand: 'Bash', searchFiles: 'Grep', listFiles: 'Glob',

    // Aider
    editor: 'Edit', run: 'Bash',

    // Generic fallbacks
    file_read: 'Read', file_write: 'Write', file_edit: 'Edit',
    execute: 'Bash', find: 'Grep', glob: 'Glob',
};

export function normalizeToolName(raw: string): string {
    return TOOL_NAME_MAP[raw] || raw;
}

// ─── Provider Colors ───────────────────────────────────────────────────────────

export const PROVIDER_COLORS: Record<AgentProvider, string> = {
    claude: '#00FFFF',  // Cyan
    gemini: '#4285F4',  // Blue
    codex: '#10A37F',  // Green
    goose: '#FF6600',  // Orange
    kilocode: '#E91E63',  // Magenta
    opencode: '#76FF03',  // Lime
    kimi: '#FF4081',  // Pink
    cline: '#009688',  // Teal
    augment: '#3F51B5',  // Indigo
    qwen: '#FFC107',  // Amber
    aider: '#FF5252',  // Red
    copilot: '#56B6C2',  // Sky Blue
    generic: '#AA00FF',  // Purple
};

// ─── Provider Display Names ────────────────────────────────────────────────────

export const PROVIDER_NAMES: Record<AgentProvider, string> = {
    claude: 'Claude Code',
    gemini: 'Gemini CLI',
    codex: 'Codex CLI',
    goose: 'Goose',
    kilocode: 'Kilocode',
    opencode: 'OpenCode',
    kimi: 'Kimi CLI',
    cline: 'Cline',
    augment: 'Augment',
    qwen: 'Qwen Code',
    aider: 'Aider',
    copilot: 'GitHub Copilot',
    generic: 'Generic Agent',
};

// ─── Provider CLI Commands ─────────────────────────────────────────────────────
// The command name used to check `which <cmd>` for availability detection.

export const PROVIDER_COMMANDS: Record<AgentProvider, string> = {
    claude: 'claude',
    gemini: 'gemini',
    codex: 'codex',
    goose: 'goose',
    kilocode: 'kilocode',
    opencode: 'opencode',
    kimi: 'kimi',
    cline: 'cline',
    augment: 'augment',
    qwen: 'qwen',
    aider: 'aider',
    copilot: 'github-copilot',
    generic: '',  // Not spawnable
};

// ─── Stream Parsers ────────────────────────────────────────────────────────────
// Each provider emits different JSON on stdout. These parsers normalize output
// into a common ParsedStreamEvent format.

function parseClaudeStream(line: string, _sessionId: string, workingDirectory: string): ParsedStreamEvent | null {
    try {
        const parsed = JSON.parse(line);

        if (parsed.type === 'assistant' && parsed.message?.content) {
            // Return first tool_use or text block found
            for (const block of parsed.message.content) {
                if (block.type === 'tool_use') {
                    return {
                        type: 'tool_use',
                        toolName: normalizeToolName(block.name || 'Unknown'),
                        filePath: block.input?.file_path || block.input?.path || workingDirectory,
                        details: block.input,
                    };
                }
                if (block.type === 'text' && block.text) {
                    return { type: 'text', message: block.text };
                }
            }
        }

        if (parsed.type === 'result') {
            return {
                type: 'result',
                message: parsed.result,
                details: {
                    success: !parsed.is_error,
                    duration_ms: parsed.duration_ms,
                    num_turns: parsed.num_turns,
                    cost_usd: parsed.total_cost_usd,
                    claudeSessionId: parsed.session_id,
                },
            };
        }
    } catch { /* not JSON */ }
    return null;
}

function parseGeminiStream(line: string, _sessionId: string, workingDirectory: string): ParsedStreamEvent | null {
    try {
        const parsed = JSON.parse(line);

        // Gemini JSON output: { "type": "functionCall", "name": "...", "args": { ... } }
        if (parsed.type === 'functionCall' || parsed.functionCall) {
            const fc = parsed.functionCall || parsed;
            return {
                type: 'tool_use',
                toolName: normalizeToolName(fc.name || 'Unknown'),
                filePath: fc.args?.path || fc.args?.file_path || workingDirectory,
            };
        }

        // Text response
        if (parsed.type === 'text' || parsed.text) {
            return { type: 'text', message: parsed.text || parsed.content };
        }

        // Result/completion
        if (parsed.type === 'result' || parsed.done || parsed.status === 'completed') {
            return {
                type: 'result',
                message: parsed.result || parsed.text || 'Completed',
                details: { success: true },
            };
        }
    } catch { /* not JSON */ }
    return null;
}

function parseCodexStream(line: string, _sessionId: string, workingDirectory: string): ParsedStreamEvent | null {
    try {
        const parsed = JSON.parse(line);

        // Codex uses similar patterns to Claude with tool_use blocks
        if (parsed.type === 'function_call' || parsed.tool_use) {
            const tool = parsed.tool_use || parsed;
            return {
                type: 'tool_use',
                toolName: normalizeToolName(tool.name || tool.function || 'Unknown'),
                filePath: tool.arguments?.path || tool.arguments?.file_path || workingDirectory,
            };
        }

        if (parsed.type === 'message' || parsed.content) {
            return { type: 'text', message: parsed.content || parsed.text || parsed.message };
        }

        if (parsed.type === 'result' || parsed.status === 'completed') {
            return {
                type: 'result',
                message: parsed.result || parsed.output || 'Completed',
                details: { success: !parsed.error },
            };
        }
    } catch { /* not JSON */ }
    return null;
}

function parseGooseStream(line: string, _sessionId: string, workingDirectory: string): ParsedStreamEvent | null {
    try {
        const parsed = JSON.parse(line);

        if (parsed.tool_call || parsed.type === 'tool_use') {
            const tool = parsed.tool_call || parsed;
            return {
                type: 'tool_use',
                toolName: normalizeToolName(tool.name || tool.tool || 'Unknown'),
                filePath: tool.arguments?.path || tool.input?.path || workingDirectory,
            };
        }

        if (parsed.type === 'text' || parsed.content) {
            return { type: 'text', message: parsed.content || parsed.text };
        }

        if (parsed.type === 'result' || parsed.done) {
            return {
                type: 'result',
                message: parsed.result || parsed.output || 'Completed',
                details: { success: true },
            };
        }
    } catch { /* not JSON */ }
    return null;
}

// Generic parser that handles Gemini CLI stream-json and other common formats
function parseGenericStream(line: string, _sessionId: string, workingDirectory: string): ParsedStreamEvent | null {
    try {
        const parsed = JSON.parse(line);

        // Gemini stream-json: {"type":"tool_use","tool_name":"read_file","parameters":{"file_path":"..."}}
        if (parsed.type === 'tool_use') {
            const name = parsed.tool_name || parsed.name || 'Unknown';
            const params = parsed.parameters || parsed.input || parsed.args || {};
            return {
                type: 'tool_use',
                toolName: normalizeToolName(name),
                filePath: params.file_path || params.path || params.dir_path || params.target_file || workingDirectory,
                details: params,
            };
        }

        // Gemini tool_result: {"type":"tool_result","tool_id":"...","status":"success"}
        if (parsed.type === 'tool_result') {
            return null; // Skip tool results, we already captured the tool_use
        }

        // Other common formats: nested tool_use/tool_call/functionCall objects
        if (parsed.tool_use || parsed.tool_call || parsed.functionCall) {
            const tool = parsed.tool_use || parsed.tool_call || parsed.functionCall;
            return {
                type: 'tool_use',
                toolName: normalizeToolName(tool.name || tool.tool_name || tool.function || 'Unknown'),
                filePath: tool.input?.path || tool.arguments?.path || tool.args?.path || tool.parameters?.file_path || workingDirectory,
            };
        }

        // Gemini stream-json messages: {"type":"message","role":"assistant","content":"...","delta":true}
        if (parsed.type === 'message' && parsed.role === 'assistant' && !parsed.delta) {
            return { type: 'text', message: parsed.content };
        }

        // Other text formats
        if (parsed.type === 'text') {
            return { type: 'text', message: parsed.content || parsed.text };
        }

        // Result: Gemini {"type":"result","status":"success","stats":{...}}
        if (parsed.type === 'result') {
            return {
                type: 'result',
                message: parsed.result || parsed.output || 'Completed',
                details: {
                    success: parsed.status === 'success' || (!parsed.error && !parsed.is_error),
                    ...(parsed.stats || {}),
                },
            };
        }

        // Skip init messages
        if (parsed.type === 'init') return null;

    } catch { /* not JSON */ }
    return null;
}

// ─── Provider Configs ──────────────────────────────────────────────────────────

export const PROVIDER_CONFIGS: Partial<Record<AgentProvider, ProviderConfig>> = {
    claude: {
        name: 'Claude Code',
        command: 'claude',
        color: PROVIDER_COLORS.claude,
        icon: '●',
        buildArgs: (prompt, _wd, dangerousMode) => {
            const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose'];
            if (dangerousMode) args.push('--dangerously-skip-permissions');
            return args;
        },
        parseStream: parseClaudeStream,
        acpCommand: 'claude-agent-acp',
        canResume: true,
    },
    gemini: {
        name: 'Gemini CLI',
        command: 'gemini',
        color: PROVIDER_COLORS.gemini,
        icon: '◆',
        buildArgs: (prompt, _wd, dangerousMode) => {
            const args = ['-p', prompt, '--output-format', 'stream-json'];
            if (dangerousMode) args.push('--yolo');
            return args;
        },
        parseStream: parseGenericStream,
        acpCommand: 'gemini',
        acpArgs: (dangerousMode?: boolean) => {
            const args = ['--experimental-acp'];
            if (dangerousMode) args.push('--yolo');
            return args;
        },
        canResume: false,
    },
    codex: {
        name: 'Codex CLI',
        command: 'codex',
        color: PROVIDER_COLORS.codex,
        icon: '■',
        buildArgs: (prompt) => ['-q', '--json', prompt],
        parseStream: parseCodexStream,
        acpCommand: 'codex-acp',
    },
    goose: {
        name: 'Goose',
        command: 'goose',
        color: PROVIDER_COLORS.goose,
        icon: '▲',
        buildArgs: (prompt) => ['run', '--text', prompt, '--output-format', 'stream-json'],
        parseStream: parseGooseStream,
        acpCommand: 'goose',
        acpArgs: ['acp'],
    },
    kilocode: {
        name: 'Kilocode',
        command: 'kilocode',
        color: PROVIDER_COLORS.kilocode,
        icon: '◎',
        buildArgs: (prompt) => ['--json', prompt],
        parseStream: parseGenericStream,
        acpCommand: 'kilo-acp',
    },
    opencode: {
        name: 'OpenCode',
        command: 'opencode',
        color: PROVIDER_COLORS.opencode,
        icon: '⬡',
        buildArgs: (prompt) => ['run', prompt],
        parseStream: parseGenericStream,
        acpCommand: 'opencode',
    },
    kimi: {
        name: 'Kimi CLI',
        command: 'kimi',
        color: PROVIDER_COLORS.kimi,
        icon: '✦',
        buildArgs: (prompt) => ['-p', prompt],
        parseStream: parseGenericStream,
        acpCommand: 'kimi',
    },
    aider: {
        name: 'Aider',
        command: 'aider',
        color: PROVIDER_COLORS.aider,
        icon: '▼',
        buildArgs: (prompt) => ['--message', prompt, '--yes'],
        parseStream: parseGenericStream,
    },
};

// ─── All Providers (for detection) ─────────────────────────────────────────────

export const ALL_PROVIDERS: AgentProvider[] = [
    'claude', 'gemini', 'codex', 'goose', 'kilocode',
    'opencode', 'kimi', 'cline', 'augment', 'qwen',
    'aider', 'copilot', 'generic',
];

// Providers that can be spawned (have a CLI config)
export const SPAWNABLE_PROVIDERS: AgentProvider[] = Object.keys(PROVIDER_CONFIGS) as AgentProvider[];
