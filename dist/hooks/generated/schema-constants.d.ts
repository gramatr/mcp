/**
 * AUTO-GENERATED — do not edit manually.
 * Source: contracts/enums/*.yaml
 * Generator: contracts/generator/generate.ts
 * Generated: 2026-04-14T23:49:46.161Z
 *
 * These constants are extracted from canonical YAML contract files
 * at build time so client hooks can validate MCP tool inputs without
 * depending on @gramatr/core at runtime.
 */
export declare const EFFORT_LEVELS: readonly ["instant", "fast", "standard", "extended", "deep", "advanced", "comprehensive"];
export declare const INTENT_TYPES: readonly ["search", "retrieve", "create", "update", "analyze", "generate"];
export declare const MEMORY_TIERS: readonly ["hot", "warm", "cold", "none"];
export declare const ENTITY_TYPES: readonly ["profile", "voice", "craft", "work_style", "memory", "relationship", "preference", "team_identity", "org_identity", "task", "milestone", "prd", "decision", "steering_rule", "skill", "agent_definition", "playbook", "standard", "reference", "blog_idea", "agent_diary", "session", "conversation", "turn", "classification_record", "agent_execution", "intelligence_packet", "learning_signal", "learning_reflection", "learning_pattern", "learning_correction", "attachment", "execution_record", "model_evaluation", "benchmark", "external_connection", "infrastructure", "audit_log"];
export declare const WORK_STATUSES: readonly ["open", "in_progress", "blocked", "review", "done"];
export declare const PROJECT_STATUSES: readonly ["active", "archived", "planning"];
export declare const SESSION_STATUSES: readonly ["active", "completed", "abandoned"];
export declare const DECISION_STATUSES: readonly ["proposed", "accepted", "superseded", "deprecated"];
export declare const PRD_STATUSES: readonly ["draft", "criteria_defined", "planned", "in_progress", "verifying", "complete", "failed", "blocked"];
export declare const OUTCOMES: readonly ["success", "partial", "failed", "abandoned"];
export declare const EMBEDDING_STATUSES: readonly ["pending", "processing", "complete", "failed"];
export declare const ALGORITHM_PHASES: readonly ["observe", "think", "plan", "build", "execute", "verify", "learn"];
export declare const AGENT_TYPES: readonly ["Architect", "Engineer", "Researcher", "QATester", "Designer", "Intern", "Pentester", "Artist", "custom"];
export declare const PATTERN_TYPES: readonly ["sequential_actions", "tool_preference", "effort_pattern", "time_pattern", "domain_affinity", "skill_chain"];
export declare const DIARY_SCOPES: readonly ["system", "org", "team", "user", "project"];
export declare const DOMAINS: readonly ["data-engineering", "platform-engineering", "ai-infrastructure", "product", "operations", "security", "frontend", "backend", "devops", "design", "marketing", "sales", "finance", "legal", "writing", "research", "project-management", "people", "personal", "learning", "general"];
export declare const INFRA_TYPES: readonly ["compute", "database", "storage", "network", "workstation", "cluster", "service"];
export declare const EXTERNAL_SERVICES: readonly ["superset", "salesforce", "github", "jira", "linear", "slack", "discord", "notion", "custom"];
export declare const AUTH_TYPES: readonly ["oauth2", "api_key", "basic", "token"];
export declare const CONNECTION_STATUSES: readonly ["connected", "expired", "revoked", "error"];
export declare const ENFORCEMENT_LEVELS: readonly ["mandatory", "recommended", "informational"];
export declare const DECISION_TYPES: readonly ["architecture", "tooling", "process", "security", "data", "infrastructure", "product", "operational"];
export declare const REFERENCE_TYPES: readonly ["documentation", "api_spec", "diagram", "article", "url"];
export declare const MODEL_PREFERENCES: readonly ["opus", "sonnet", "haiku", "gpt-4o", "gpt-4o-mini", "o3", "llama-3.2", "qwen-3", "gemini-2.5"];
export declare const AUDIT_EVENT_TYPES: readonly ["auth", "entity_crud", "search", "admin", "api_key", "config", "oauth", "export"];
export declare const AUDIT_ACTIONS: readonly ["create", "read", "update", "delete", "login", "logout", "grant", "revoke", "export", "import"];
export declare const AUDIT_RESOURCE_TYPES: readonly ["entity", "observation", "relation", "api_key", "session", "oauth_client", "user", "embedding_model"];
export declare const EFFORT_LEVEL_SET: Set<string>;
export declare const INTENT_TYPE_SET: Set<string>;
export declare const MEMORY_TIER_SET: Set<string>;
export declare const ENTITY_TYPE_SET: Set<string>;
export declare const WORK_STATUS_SET: Set<string>;
/**
 * Per-tool required field validation rules.
 * Maps tool name -> array of { field, validValues? } checks.
 * If validValues is provided, the field must be one of those values.
 * If validValues is omitted, the field just needs to be present and non-empty.
 */
export declare const TOOL_INPUT_RULES: Record<string, Array<{
    field: string;
    validValues?: readonly string[];
}>>;
//# sourceMappingURL=schema-constants.d.ts.map