/**
 * types.ts — hook response/payload types shared across migrated hooks.
 *
 * Phase 1 migration (#652): only the types session-start.ts depends on.
 * Copied from packages/client/core/types.ts — keep the shape in sync until
 * Phase 2 collapses the duplication.
 */
/** Lean session shape returned by the server in recent_sessions (Issue #720). */
export interface RemoteSessionRecord {
    id: string;
    client_session_id: string | null;
    interaction_id: string | null;
    client_type: string | null;
    agent_name: string | null;
    git_branch: string | null;
    started_at: string | null;
    ended_at: string | null;
    status: string;
    reason: string | null;
    summary: string | null;
}
export interface SessionStartResponse {
    project_id?: string;
    interaction_id?: string;
    interactionId?: string;
    entity_id?: string;
    entityId?: string;
    interaction_resumed?: boolean;
    interactionResumed?: boolean;
    handoff_context?: string | null;
    handoffContext?: string | null;
    /** Recent sessions for this project — upserted locally for cross-agent sync (#720). */
    recent_sessions?: RemoteSessionRecord[];
}
export interface HandoffMeta {
    saved_at?: string;
    branch?: string;
    session_id?: string;
    conversation_id?: string;
    platform?: string;
    legacy_missing_platform?: boolean;
}
export interface HandoffResponse {
    status?: string;
    source?: string;
    project_id?: string;
    session_id?: string;
    branch?: string;
    platform?: string;
    created_at?: string;
    section_count?: number;
    _meta?: HandoffMeta;
    where_we_are?: string;
    what_shipped?: string;
    whats_next?: string;
    key_context?: string;
    dont_forget?: string;
}
export interface HookFailure {
    title: string;
    detail: string;
    action?: string;
}
export interface MctToolCallError {
    reason: 'auth' | 'http_error' | 'mcp_error' | 'parse_error' | 'timeout' | 'network_error' | 'unknown';
    detail: string;
    status?: number;
}
export interface RouteClassification {
    effort_level?: string;
    intent_type?: string;
    confidence?: number;
    memory_scope?: string;
    matched_skills?: string[];
    constraints_extracted?: string[];
    reverse_engineering?: {
        explicit_wants?: string[];
        implicit_wants?: string[];
        explicit_dont_wants?: string[];
        implicit_dont_wants?: string[];
        gotchas?: string[];
    };
    suggested_capabilities?: string[];
    isc_scaffold?: string[];
    is_fallback?: boolean;
}
export interface CapabilityAuditEntry {
    id?: number;
    name?: string;
    section?: string;
    disposition?: string;
    reason?: string;
    phase?: string;
}
export interface CapabilityAuditResult {
    entries?: CapabilityAuditEntry[];
    use_count?: number;
    decline_count?: number;
    na_count?: number;
    formatted_summary?: string;
}
export interface PhaseTemplate {
    header?: string;
    time_check?: string;
    voice_message?: string;
    phase_description?: string;
}
export interface QualityGateRule {
    id?: string;
    name?: string;
    description?: string;
    min_effort?: string | null;
    automated?: boolean;
}
export interface QualityGateConfig {
    rules?: QualityGateRule[];
    min_criteria?: number;
    anti_required?: boolean;
    word_range?: {
        min?: number;
        max?: number;
    };
}
export interface ContextPreLoadPlan {
    entity_types?: string[];
    fetch_limits?: Record<string, number>;
    tier?: string;
    scope?: string;
    boost_signals?: {
        entity_scope?: string | null;
        entity_category?: string | null;
        entity_type_suggestion?: string | null;
    } | null;
}
export interface MemoryPlan {
    strategy?: string;
    memory_scope?: string | null;
    search_scope?: string;
    domain_class?: string | null;
    entity_type_filter?: string | null;
    preload_entity_types?: string[];
    top_k?: number;
    query?: string;
    semantic_search_enabled?: boolean;
    rerank_enabled?: boolean;
}
export interface ActiveSkillDefinition {
    name?: string;
    title?: string;
    phase?: string;
    directives?: string[];
}
export interface SkillRoutingDefinition {
    matched_skills?: Array<{
        name?: string;
        id?: string;
    }>;
    use_count?: number;
    decline_count?: number;
    na_count?: number;
    pattern_boost_applied?: boolean;
    routing_time_ms?: number;
}
export interface AgentRecommendationDefinition {
    type?: string;
    source?: string;
    confidence?: number;
}
export interface SuggestedAgentDefinition {
    name?: string;
    display_name?: string;
    model?: string;
    reason?: string;
}
export interface ComposedAgentDefinition {
    name?: string;
    display_name?: string;
    system_prompt?: string;
    expertise_areas?: string[];
    task_domain?: string;
    model_preference?: string;
    context_summary?: string;
}
export interface ClassifierHeadScore {
    label?: string;
    score?: number;
    confidence?: number;
}
export type ClassifierHeadValue = ClassifierHeadScore | ClassifierHeadScore[];
export interface Packet1Envelope {
    manifest?: {
        contents?: string[];
        packet_2_contents?: string[];
        packet_2_status?: 'required' | 'not_applicable' | 'merged';
        packet_2_required?: boolean;
        enrichment_id?: string | null;
    };
    classification?: RouteClassification;
    capability_audit?: CapabilityAuditResult;
    phase_template?: PhaseTemplate;
    format_spec?: RouteResponse['format_spec'];
    quality_gate_config?: QualityGateConfig;
    context_pre_load_plan?: ContextPreLoadPlan;
    memory_plan?: MemoryPlan;
    project_state?: RouteResponse['project_state'];
    packet_diagnostics?: RouteResponse['packet_diagnostics'];
    curated_context?: string;
    context_references?: RouteResponse['context_references'];
    behavioral_directives?: string[];
    behavioral_rules?: RouteResponse['behavioral_rules'];
    skills?: {
        routing?: SkillRoutingDefinition;
        active?: ActiveSkillDefinition;
    };
    agents?: {
        recommendation?: AgentRecommendationDefinition;
        suggested?: SuggestedAgentDefinition[];
        composed?: ComposedAgentDefinition[];
    };
    active_skill?: RouteResponse['active_skill'];
    classifier_heads?: RouteResponse['classifier_heads'];
    routing_signals?: RouteResponse['routing_signals'];
    skill_routing?: RouteResponse['skill_routing'];
    diary_compact?: RouteResponse['diary_compact'];
    agent_recommendation?: RouteResponse['agent_recommendation'];
    active_task?: RouteResponse['active_task'];
    suggested_agents?: RouteResponse['suggested_agents'];
    composed_agents?: RouteResponse['composed_agents'];
    memory_context?: RouteResponse['memory_context'];
    search_results?: RouteResponse['search_results'];
    token_savings?: RouteResponse['token_savings'];
    execution_summary?: RouteResponse['execution_summary'];
    statusline_markdown?: string;
}
export interface Packet2Envelope {
    enrichment_id?: string | null;
    required?: boolean;
    reasoning?: {
        reverse_engineering?: RouteClassification['reverse_engineering'];
        isc_scaffold?: string[];
        constraints_extracted?: string[];
    };
    memory_follow_up?: {
        required?: boolean;
        suggested_scope?: string | null;
        suggested_query?: string | null;
        entity_type_filter?: string | null;
        strategy?: string;
        top_k?: number;
        results?: Array<{
            memory_id?: string;
            observation_id?: string;
            entity_id?: string;
            entity_name?: string;
            entity_type?: string;
            summary?: string;
            similarity_score?: number;
        }>;
    };
    agents?: {
        suggested?: SuggestedAgentDefinition[];
    };
    suggested_agents?: Array<{
        name?: string;
        display_name?: string;
        model?: string;
        reason?: string;
    }>;
}
export interface RouteResponse {
    schema?: string;
    source?: string;
    manifest?: {
        contract_shape?: string;
        completeness?: string;
        response_contract?: string;
        project_id?: string;
        session_id?: string;
        interaction_id?: string;
        turn_id?: string | null;
    };
    contract_shape?: string;
    completeness?: string;
    consumer_instructions?: Record<string, unknown>;
    required_actions?: string[];
    packet_1?: Packet1Envelope;
    packet_2?: Packet2Envelope;
    unified_packet?: Record<string, unknown>;
    classification?: RouteClassification;
    statusline_markdown?: string;
    packet_1_contents?: string[];
    packet_2_contents?: string[];
    packet_2_status?: string;
    packet_2_required?: boolean;
    enrichment_id?: string | null;
    enrichment?: {
        status?: string;
        required?: boolean;
        enrichment_id?: string | null;
        fetch_tool?: string | null;
        data?: Record<string, unknown> | null;
    };
    capability_audit?: CapabilityAuditResult;
    phase_template?: PhaseTemplate;
    format_spec?: {
        mode?: string;
        phases?: string[];
        response_contract?: string[];
    };
    quality_gate_config?: QualityGateConfig;
    context_pre_load_plan?: ContextPreLoadPlan;
    memory_plan?: MemoryPlan;
    project_state?: {
        project_id?: string;
        active_prd_id?: string | null;
        active_prd_title?: string | null;
        isc_summary?: {
            total?: number;
            passing?: number;
            failing?: number;
            pending?: number;
        };
        current_phase?: string | null;
        active_client?: {
            client_id?: string;
            client_type?: string;
        } | null;
        last_updated?: string;
        session_history_summary?: string;
    } | null;
    packet_diagnostics?: {
        memory_context?: {
            status?: string;
            requested_types?: string[];
            delivered_count?: number;
            error?: string;
        };
        project_state?: {
            status?: string;
            project_id?: string;
            error?: string;
        };
    };
    curated_context?: string;
    context_references?: Array<{
        id?: string;
        type?: string;
        name?: string;
    }> | string[];
    behavioral_directives?: string[];
    behavioral_rules?: {
        algorithm_phases?: string[];
        hard_gates?: string[];
        verification_rules?: string[];
        code_rules?: string[];
        safety_rules?: string[];
        response_contract?: string[];
        quality_bar?: string[];
        learn_requirements?: string[];
    };
    active_skill?: ActiveSkillDefinition;
    classifier_heads?: Record<string, ClassifierHeadValue>;
    routing_signals?: {
        complexity?: string;
        crud_operation?: string;
        conversation_phase?: string;
        memory_scope?: string;
        memory_priority?: string;
        retrieval_needed?: boolean;
        is_read_only?: boolean;
        requires_approval?: boolean;
        escalation_recommended?: boolean;
        safety_flags?: string[];
        entity_type_suggestion?: {
            top?: string;
        };
    };
    skill_routing?: SkillRoutingDefinition;
    diary_compact?: {
        summary?: string;
        current_focus?: string;
    };
    agent_recommendation?: AgentRecommendationDefinition;
    active_task?: {
        id?: string;
        title?: string;
        phase?: string;
        status?: string;
    };
    suggested_agents?: SuggestedAgentDefinition[];
    composed_agents?: ComposedAgentDefinition[];
    memory_context?: {
        total_count?: number;
        results?: Array<{
            memory_id?: string;
            entity_id?: string;
            entity_name?: string;
            entity_type?: string;
            summary?: string;
            content?: string;
            similarity?: number;
        }>;
    };
    search_results?: {
        results?: Array<{
            memory_id?: string;
            observation_id?: string;
            entity_id?: string;
            entity_name?: string;
            entity_type?: string;
            summary?: string;
            snippet?: string;
            similarity_score?: number;
        }>;
        count?: number;
        top_k?: number;
        scope?: string;
        search_scope?: string;
        cache_hit?: boolean;
        search_ms?: number;
        query?: string;
        entity_type_filter?: string | null;
    };
    token_savings?: {
        claude_md_reduction?: number;
        observe_work_offloaded?: number;
        reasoning_tokens_used?: number;
        total_saved?: number;
        tokens_saved?: number;
        savings_ratio?: number;
    };
    execution_summary?: {
        classifier_model?: string;
        classifier_time_ms?: number;
        execution_time_ms?: number;
        server_version?: string;
        stage_timing?: Record<string, number>;
        degraded_components?: string[];
    };
    memory?: {
        scope?: string;
        context?: unknown;
        search_results?: Array<{
            entity_id?: string;
            name?: string;
            snippet?: string;
            similarity_score?: number;
        }>;
    };
    execution?: {
        summary?: unknown;
        token_savings?: {
            total_saved?: number;
            tokens_saved?: number;
            savings_ratio?: number;
            claude_md_reduction?: number;
        };
        diagnostics?: unknown;
    };
}
//# sourceMappingURL=types.d.ts.map