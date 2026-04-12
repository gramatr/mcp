/**
 * types.ts — hook response/payload types shared across migrated hooks.
 *
 * Phase 1 migration (#652): only the types session-start.ts depends on.
 * Copied from packages/client/core/types.ts — keep the shape in sync until
 * Phase 2 collapses the duplication.
 */
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
export interface RouteClassification {
    effort_level?: string;
    intent_type?: string;
    confidence?: number;
    memory_tier?: string;
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
}
export interface ClassifierHeadScore {
    label?: string;
    score?: number;
    confidence?: number;
}
export type ClassifierHeadValue = ClassifierHeadScore | ClassifierHeadScore[];
export interface RouteResponse {
    classification?: RouteClassification;
    statusline_markdown?: string;
    packet_1_contents?: string[];
    packet_2_contents?: string[];
    packet_2_status?: string;
    enrichment_id?: string | null;
    capability_audit?: CapabilityAuditResult;
    phase_template?: PhaseTemplate;
    format_spec?: {
        mode?: string;
        phases?: string[];
        response_contract?: string[];
    };
    quality_gate_config?: QualityGateConfig;
    context_pre_load_plan?: ContextPreLoadPlan;
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
    active_skill?: {
        name?: string;
        title?: string;
        phase?: string;
        directives?: string[];
    };
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
    skill_routing?: {
        matched_skills?: Array<{
            name?: string;
            id?: string;
        }>;
        use_count?: number;
        decline_count?: number;
        na_count?: number;
        pattern_boost_applied?: boolean;
    };
    diary_compact?: {
        summary?: string;
        current_focus?: string;
    };
    agent_recommendation?: {
        type?: string;
        source?: string;
        confidence?: number;
    };
    active_task?: {
        id?: string;
        title?: string;
        phase?: string;
        status?: string;
    };
    suggested_agents?: Array<{
        name?: string;
        display_name?: string;
        model?: string;
        reason?: string;
    }>;
    composed_agents?: Array<{
        name?: string;
        display_name?: string;
        system_prompt?: string;
        expertise_areas?: string[];
        task_domain?: string;
        model_preference?: string;
        context_summary?: string;
    }>;
    memory_context?: {
        total_count?: number;
        results?: Array<{
            entity_name?: string;
            entity_type?: string;
            content?: string;
            similarity?: number;
        }>;
    };
    search_results?: {
        results?: Array<{
            entity_id?: string;
            entity_name?: string;
            entity_type?: string;
            snippet?: string;
            similarity_score?: number;
        }>;
        count?: number;
        scope?: string;
        cache_hit?: boolean;
        search_ms?: number;
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
}
//# sourceMappingURL=types.d.ts.map