/**
 * AUTO-GENERATED — do not edit manually.
 * Source: contracts/platforms/*.yaml
 * Generator: contracts/generator/generate.ts
 * Generated: 2026-04-21T15:46:48.865Z
 */
/** grāmatr for ChatGPT — ChatGPT official plugin/add-on — sandbox environment, OAuth auth, OpenAPI manifest */
export const CHATGPT_ADDON_HOOKS = {
    "name": "chatgpt-addon",
    "display_name": "grāmatr for ChatGPT",
    "description": "ChatGPT official plugin/add-on — sandbox environment, OAuth auth, OpenAPI manifest",
    "client_flag": "none",
    "config_file": "none",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "IDENTITY",
        "DEGRADED_MODE"
    ]
};
/** ChatGPT Desktop — ChatGPT Desktop app integration via MCP server config (hookless) */
export const CHATGPT_DESKTOP_HOOKS = {
    "name": "chatgpt-desktop",
    "display_name": "ChatGPT Desktop",
    "description": "ChatGPT Desktop app integration via MCP server config (hookless)",
    "client_flag": "none",
    "config_file": "platform-specific",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES"
    ]
};
/** grāmatr — ChatGPT Custom GPT instructions — ~8000 char budget, MCP pre-wired at GPT level, shareable link */
export const CHATGPT_GPT_HOOKS = {
    "name": "chatgpt-gpt",
    "display_name": "grāmatr",
    "description": "ChatGPT Custom GPT instructions — ~8000 char budget, MCP pre-wired at GPT level, shareable link",
    "client_flag": "none",
    "config_file": "none",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "DEGRADED_MODE"
    ]
};
/** ChatGPT Project — ChatGPT Project instructions — 5000 char budget, MCP connected at project level */
export const CHATGPT_PROJECT_HOOKS = {
    "name": "chatgpt-project",
    "display_name": "ChatGPT Project",
    "description": "ChatGPT Project instructions — 5000 char budget, MCP connected at project level",
    "client_flag": "none",
    "config_file": "none",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY"
    ]
};
/** ChatGPT Web — ChatGPT Web (chat.openai.com) integration via MCP — hookless, paste into personal prompt or custom GPT */
export const CHATGPT_WEB_HOOKS = {
    "name": "chatgpt-web",
    "display_name": "ChatGPT Web",
    "description": "ChatGPT Web (chat.openai.com) integration via MCP — hookless, paste into personal prompt or custom GPT",
    "client_flag": "none",
    "config_file": "none",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "FEEDBACK_RULES",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT"
    ]
};
/** grāmatr for Claude — Claude.ai official MCP add-on — Anthropic partner program, sandbox environment */
export const CLAUDE_ADDON_HOOKS = {
    "name": "claude-addon",
    "display_name": "grāmatr for Claude",
    "description": "Claude.ai official MCP add-on — Anthropic partner program, sandbox environment",
    "client_flag": "none",
    "config_file": "none",
    "hooks": {
        "UserPromptSubmit": [
            {
                "hook": "user-prompt-submit",
                "statusMessage": "Routing through gramatr intelligence layer",
                "timeout": 10
            }
        ],
        "SessionStart": [
            {
                "hook": "session-start",
                "statusMessage": "Loading gramatr session context",
                "timeout": 10
            }
        ],
        "SessionEnd": [
            {
                "hook": "session-end",
                "statusMessage": "Saving gramatr session",
                "timeout": 10
            }
        ],
        "Stop": [
            {
                "hook": "stop",
                "statusMessage": "Submitting gramatr classification feedback",
                "timeout": 8
            }
        ]
    },
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "IDENTITY",
        "DEGRADED_MODE"
    ]
};
/** Claude Code — Claude Code CLI integration with full hook lifecycle */
export const CLAUDE_CODE_HOOKS = {
    "name": "claude-code",
    "display_name": "Claude Code",
    "description": "Claude Code CLI integration with full hook lifecycle",
    "client_flag": "--claude-code",
    "config_file": "~/.claude/settings.json",
    "hooks": {
        "PreToolUse": [
            {
                "hook": "git-gate",
                "matcher": "Bash"
            },
            {
                "hook": "input-validator",
                "matcher": "Bash"
            },
            {
                "hook": "input-validator",
                "matcher": "Edit"
            },
            {
                "hook": "edit-tracker",
                "matcher": "Edit"
            },
            {
                "hook": "input-validator",
                "matcher": "Write"
            },
            {
                "hook": "edit-tracker",
                "matcher": "Write"
            },
            {
                "hook": "input-validator",
                "matcher": "mcp__.*gramatr.*__"
            },
            {
                "hook": "agent-gate",
                "matcher": "Agent"
            }
        ],
        "PostToolUse": [
            {
                "hook": "agent-verify",
                "matcher": "Agent"
            },
            {
                "hook": "tool-tracker",
                "matcher": "mcp__.*gramatr.*__"
            }
        ],
        "UserPromptSubmit": [
            {
                "hook": "rating-capture"
            },
            {
                "hook": "user-prompt-submit"
            }
        ],
        "SessionStart": [
            {
                "hook": "session-start",
                "statusMessage": "Loading gramatr session context"
            }
        ],
        "SessionEnd": [
            {
                "hook": "session-end",
                "statusMessage": "Saving gramatr session"
            }
        ],
        "Stop": [
            {
                "hook": "stop",
                "statusMessage": "Submitting gramatr classification feedback"
            }
        ],
        "SubagentStart": [
            {
                "hook": "subagent-route",
                "statusMessage": "Routing sub-agent through grāmatr intelligence"
            }
        ],
        "TaskCreated": [
            {
                "hook": "task-quality-gate",
                "statusMessage": "Verifying Quality Gate criteria"
            }
        ],
        "InstructionsLoaded": [
            {
                "hook": "instructions-loaded",
                "statusMessage": "Loading grāmatr project context",
                "matcher": "CLAUDE.md"
            }
        ]
    },
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ]
    },
    "settings": {
        "attribution": {
            "commit": "Co-Authored-By: gramatr — Real-Time Intelligent Context Engineering <noreply@gramatr.com>",
            "pr": "Co-Authored-By: gramatr — Real-Time Intelligent Context Engineering <noreply@gramatr.com>"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "IDENTITY",
        "DEGRADED_MODE"
    ]
};
/** Claude Desktop — Claude Desktop app integration via MCP server config (hookless) */
export const CLAUDE_DESKTOP_HOOKS = {
    "name": "claude-desktop",
    "display_name": "Claude Desktop",
    "description": "Claude Desktop app integration via MCP server config (hookless)",
    "client_flag": "none",
    "config_file": "~/Library/Application Support/Claude/claude_desktop_config.json",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES"
    ]
};
/** Claude Project — Claude.ai Project instructions — larger budget than personal, MCP connected at project level */
export const CLAUDE_PROJECT_HOOKS = {
    "name": "claude-project",
    "display_name": "Claude Project",
    "description": "Claude.ai Project instructions — larger budget than personal, MCP connected at project level",
    "client_flag": "none",
    "config_file": "none",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "DEGRADED_MODE"
    ]
};
/** Claude Web — Claude Web (claude.ai) integration via MCP — hookless, paste instructions into personal prompt */
export const CLAUDE_WEB_HOOKS = {
    "name": "claude-web",
    "display_name": "Claude Web",
    "description": "Claude Web (claude.ai) integration via MCP — hookless, paste instructions into personal prompt",
    "client_flag": "none",
    "config_file": "none",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES"
    ]
};
/** Codex — OpenAI Codex CLI integration with session and prompt hooks */
export const CODEX_HOOKS = {
    "name": "codex",
    "display_name": "Codex",
    "description": "OpenAI Codex CLI integration with session and prompt hooks",
    "client_flag": "--codex",
    "config_file": "~/.codex/config.toml",
    "hooks": {
        "SessionStart": [
            {
                "hook": "session-start",
                "matcher": "startup|resume",
                "statusMessage": "Loading gramatr session context",
                "timeout": 15
            }
        ],
        "UserPromptSubmit": [
            {
                "hook": "user-prompt-submit",
                "statusMessage": "Routing request through gramatr",
                "timeout": 15
            }
        ],
        "Stop": [
            {
                "hook": "session-end",
                "statusMessage": "Saving gramatr session state",
                "timeout": 15
            },
            {
                "hook": "stop",
                "statusMessage": "Submitting gramatr classification feedback",
                "timeout": 10
            }
        ]
    },
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ]
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "IDENTITY",
        "PROJECT_UNRESOLVED",
        "PROJECT_NEW",
        "PROJECT_RESUMED",
        "DEGRADED_MODE"
    ]
};
/** Cursor — Cursor IDE integration via MCP server config (hookless, uses route_request) */
export const CURSOR_HOOKS = {
    "name": "cursor",
    "display_name": "Cursor",
    "description": "Cursor IDE integration via MCP server config (hookless, uses route_request)",
    "client_flag": "--cursor",
    "config_file": "~/.cursor/mcp.json",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "MANUAL_ROUTING"
    ]
};
/** Gemini CLI — Gemini CLI integration via extension manifest and hooks */
export const GEMINI_CLI_HOOKS = {
    "name": "gemini-cli",
    "display_name": "Gemini CLI",
    "description": "Gemini CLI integration via extension manifest and hooks",
    "client_flag": "--gemini",
    "config_file": "~/.gemini/extensions/gramatr/gemini-extension.json",
    "hooks": {
        "SessionStart": [
            {
                "hook": "session-start",
                "name": "gramatr-session-start",
                "timeout": 15,
                "description": "Load gramatr session context and handoff"
            }
        ],
        "BeforeAgent": [
            {
                "hook": "user-prompt-submit",
                "name": "gramatr-prompt-routing",
                "timeout": 15,
                "description": "Route prompt through gramatr intelligence"
            }
        ],
        "SessionEnd": [
            {
                "hook": "session-end",
                "name": "gramatr-session-save",
                "timeout": 15,
                "description": "Persist gramatr session state and save handoff"
            },
            {
                "hook": "stop",
                "name": "gramatr-session-feedback",
                "timeout": 10,
                "description": "Submit classification feedback to gramatr"
            }
        ]
    },
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "timeout": 30000
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "IDENTITY",
        "PROJECT_UNRESOLVED",
        "PROJECT_NEW",
        "PROJECT_RESUMED",
        "DEGRADED_MODE"
    ]
};
/** OpenCode — OpenCode plugin-based integration (no hooks file, uses plugin architecture) */
export const OPENCODE_HOOKS = {
    "name": "opencode",
    "display_name": "OpenCode",
    "description": "OpenCode plugin-based integration (no hooks file, uses plugin architecture)",
    "client_flag": "--opencode",
    "config_file": "~/.config/opencode/config.json",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY"
    ]
};
/** VS Code — VS Code integration with Copilot/Continue via MCP server config (hookless) */
export const VSCODE_HOOKS = {
    "name": "vscode",
    "display_name": "VS Code",
    "description": "VS Code integration with Copilot/Continue via MCP server config (hookless)",
    "client_flag": "none",
    "config_file": "~/.vscode/mcp.json",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "MANUAL_ROUTING"
    ]
};
/** Windsurf — Windsurf IDE integration via MCP server config (hookless) */
export const WINDSURF_HOOKS = {
    "name": "windsurf",
    "display_name": "Windsurf",
    "description": "Windsurf IDE integration via MCP server config (hookless)",
    "client_flag": "none",
    "config_file": "~/.windsurf/mcp.json",
    "hooks": {},
    "mcp_server": {
        "command": "npx",
        "args": [
            "@gramatr/mcp"
        ],
        "env": {
            "GRAMATR_DIR": "~/.gramatr"
        }
    },
    "instruction_blocks": [
        "CONTRACT_RULES",
        "MEMORY_RULES",
        "ENTITY_TYPES",
        "REQUIRED_FIELDS",
        "EFFORT_PHASES",
        "QUALITY_GATE_REQUIREMENT",
        "CLASSIFICATION_SUMMARY",
        "FEEDBACK_RULES",
        "SUBAGENT_RULES",
        "MANUAL_ROUTING"
    ]
};
/** All platform configs keyed by platform name */
export const PLATFORM_HOOKS = {
    'chatgpt-addon': CHATGPT_ADDON_HOOKS,
    'chatgpt-desktop': CHATGPT_DESKTOP_HOOKS,
    'chatgpt-gpt': CHATGPT_GPT_HOOKS,
    'chatgpt-project': CHATGPT_PROJECT_HOOKS,
    'chatgpt-web': CHATGPT_WEB_HOOKS,
    'claude-addon': CLAUDE_ADDON_HOOKS,
    'claude-code': CLAUDE_CODE_HOOKS,
    'claude-desktop': CLAUDE_DESKTOP_HOOKS,
    'claude-project': CLAUDE_PROJECT_HOOKS,
    'claude-web': CLAUDE_WEB_HOOKS,
    'codex': CODEX_HOOKS,
    'cursor': CURSOR_HOOKS,
    'gemini-cli': GEMINI_CLI_HOOKS,
    'opencode': OPENCODE_HOOKS,
    'vscode': VSCODE_HOOKS,
    'windsurf': WINDSURF_HOOKS,
};
//# sourceMappingURL=platform-hooks.js.map