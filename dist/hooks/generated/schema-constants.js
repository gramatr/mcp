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
// ── Classifier enums ──
export const EFFORT_LEVELS = ["instant", "fast", "standard", "extended", "deep", "advanced", "comprehensive"];
export const INTENT_TYPES = ["search", "retrieve", "create", "update", "analyze", "generate"];
export const MEMORY_TIERS = ["hot", "warm", "cold", "none"];
// ── Entity type enum (#686 identity taxonomy — see EntityTypeEnum in @gramatr/core) ──
export const ENTITY_TYPES = ["profile", "voice", "craft", "work_style", "memory", "relationship", "preference", "team_identity", "org_identity", "task", "milestone", "prd", "decision", "steering_rule", "skill", "agent_definition", "playbook", "standard", "reference", "blog_idea", "agent_diary", "session", "conversation", "turn", "classification_record", "agent_execution", "intelligence_packet", "learning_signal", "learning_reflection", "learning_pattern", "learning_correction", "attachment", "execution_record", "model_evaluation", "benchmark", "external_connection", "infrastructure", "audit_log"];
// ── Lifecycle enums ──
export const WORK_STATUSES = ["open", "in_progress", "blocked", "review", "done"];
export const PROJECT_STATUSES = ["active", "archived", "planning"];
export const SESSION_STATUSES = ["active", "completed", "abandoned"];
export const DECISION_STATUSES = ["proposed", "accepted", "superseded", "deprecated"];
export const PRD_STATUSES = ["draft", "criteria_defined", "planned", "in_progress", "verifying", "complete", "failed", "blocked"];
export const OUTCOMES = ["success", "partial", "failed", "abandoned"];
export const EMBEDDING_STATUSES = ["pending", "processing", "complete", "failed"];
// ── Domain & classification ──
export const ALGORITHM_PHASES = ["observe", "think", "plan", "build", "execute", "verify", "learn"];
export const AGENT_TYPES = ["Architect", "Engineer", "Researcher", "QATester", "Designer", "Intern", "Pentester", "Artist", "custom"];
export const PATTERN_TYPES = ["sequential_actions", "tool_preference", "effort_pattern", "time_pattern", "domain_affinity", "skill_chain"];
export const DIARY_SCOPES = ["system", "org", "team", "user", "project"];
export const DOMAINS = ["data-engineering", "platform-engineering", "ai-infrastructure", "product", "operations", "security", "frontend", "backend", "devops", "design", "marketing", "sales", "finance", "legal", "writing", "research", "project-management", "people", "personal", "learning", "general"];
// ── Infrastructure & connection ──
export const INFRA_TYPES = ["compute", "database", "storage", "network", "workstation", "cluster", "service"];
export const EXTERNAL_SERVICES = ["superset", "salesforce", "github", "jira", "linear", "slack", "discord", "notion", "custom"];
export const AUTH_TYPES = ["oauth2", "api_key", "basic", "token"];
export const CONNECTION_STATUSES = ["connected", "expired", "revoked", "error"];
// ── Knowledge & content ──
export const ENFORCEMENT_LEVELS = ["mandatory", "recommended", "informational"];
export const DECISION_TYPES = ["architecture", "tooling", "process", "security", "data", "infrastructure", "product", "operational"];
export const REFERENCE_TYPES = ["documentation", "api_spec", "diagram", "article", "url"];
export const MODEL_PREFERENCES = ["opus", "sonnet", "haiku", "gpt-4o", "gpt-4o-mini", "o3", "llama-3.2", "qwen-3", "gemini-2.5"];
// ── Audit ──
export const AUDIT_EVENT_TYPES = ["auth", "entity_crud", "search", "admin", "api_key", "config", "oauth", "export"];
export const AUDIT_ACTIONS = ["create", "read", "update", "delete", "login", "logout", "grant", "revoke", "export", "import"];
export const AUDIT_RESOURCE_TYPES = ["entity", "observation", "relation", "api_key", "session", "oauth_client", "user", "embedding_model"];
// ── Lookup sets (for O(1) validation in hooks) ──
export const EFFORT_LEVEL_SET = new Set(EFFORT_LEVELS);
export const INTENT_TYPE_SET = new Set(INTENT_TYPES);
export const MEMORY_TIER_SET = new Set(MEMORY_TIERS);
export const ENTITY_TYPE_SET = new Set(ENTITY_TYPES);
export const WORK_STATUS_SET = new Set(WORK_STATUSES);
/**
 * Per-tool required field validation rules.
 * Maps tool name -> array of { field, validValues? } checks.
 * If validValues is provided, the field must be one of those values.
 * If validValues is omitted, the field just needs to be present and non-empty.
 */
export const TOOL_INPUT_RULES = {
    create_entity: [
        { field: 'name' },
        { field: 'entity_type', validValues: ENTITY_TYPES },
        { field: 'project_id' },
    ],
    update_entity: [
        { field: 'entity_id' },
    ],
    add_observation: [
        { field: 'entity_id' },
        { field: 'content' },
    ],
    search_semantic: [
        { field: 'query' },
    ],
    search_entities: [], // all fields optional
    create_relation: [
        { field: 'source_entity_id' },
        { field: 'target_entity_id' },
        { field: 'relation_type' },
    ],
    mark_entity_inactive: [
        { field: 'entity_id' },
    ],
    mark_observation_inactive: [
        { field: 'observation_id' },
    ],
    reactivate_entity: [
        { field: 'entity_id' },
    ],
    get_entities: [
        { field: 'entity_ids' },
    ],
    list_entities: [], // all fields optional
};
//# sourceMappingURL=schema-constants.js.map