export function formatFailureWarning(failure) {
    const lines = [];
    lines.push('⚠️ [gramatr intelligence — failed]');
    lines.push('');
    switch (failure.reason) {
        case 'auth':
            lines.push('🔒 AUTHENTICATION FAILURE — gramatr decision router cannot authenticate.');
            lines.push(`Detail: ${failure.detail}`);
            lines.push('');
            lines.push('FIX: Set GRAMATR_TOKEN in your environment (AIOS_MCP_TOKEN remains a legacy alias)');
            lines.push('Without this, NO pre-classification happens. The Algorithm runs without intelligence.');
            break;
        case 'timeout':
            lines.push('⏱️ TIMEOUT — gramatr decision router did not respond in time.');
            lines.push(`Detail: ${failure.detail}`);
            lines.push('');
            lines.push('The classifier may be overloaded or the server may be slow.');
            break;
        case 'server_down':
            lines.push('🔴 SERVER UNREACHABLE — cannot connect to gramatr server.');
            lines.push(`Detail: ${failure.detail}`);
            lines.push('');
            lines.push('Check: Is the server running? Is the URL correct? Is there a network issue?');
            break;
        case 'server_error':
            lines.push('💥 SERVER ERROR — gramatr server returned an error.');
            lines.push(`Detail: ${failure.detail}`);
            break;
        case 'parse_error':
            lines.push('🔧 PARSE ERROR — could not understand the server response.');
            lines.push(`Detail: ${failure.detail}`);
            break;
        default:
            lines.push('❓ UNKNOWN ERROR — gramatr enrichment failed.');
            lines.push(`Detail: ${failure.detail}`);
    }
    lines.push('');
    lines.push('IMPORTANT: Tell the user about this error. Do not silently proceed without intelligence.');
    lines.push('You should still follow the Algorithm from CLAUDE.md, but note that pre-classification is unavailable.');
    return lines.join('\n');
}
export function mergeEnrichmentIntoRoute(route, enrichment) {
    if (!enrichment || !route.classification)
        return;
    if (enrichment.reverse_engineering) {
        route.classification.reverse_engineering = enrichment.reverse_engineering;
    }
    if (enrichment.isc_scaffold) {
        route.classification.isc_scaffold = enrichment.isc_scaffold;
    }
    if (enrichment.constraints_extracted) {
        route.classification.constraints_extracted = enrichment.constraints_extracted;
    }
}
function normalizeClassifierHeadScores(value) {
    if (!value)
        return [];
    return Array.isArray(value) ? value : [value];
}
export function formatIntelligence(data, enrichment) {
    const c = data.classification || {};
    const ts = data.token_savings || {};
    const es = data.execution_summary || {};
    const lines = [];
    lines.push(`[gramatr intelligence — pre-classified by ${es.classifier_model || 'gramatr'}]`);
    const ps = data.project_state;
    if (ps && ps.project_id) {
        lines.push('');
        lines.push('ACTIVE PROJECT STATE:');
        if (ps.active_prd_title) {
            lines.push(`  PRD: ${ps.active_prd_title}${ps.active_prd_id ? ` (${ps.active_prd_id})` : ''}`);
        }
        if (ps.current_phase) {
            lines.push(`  Phase: ${ps.current_phase}`);
        }
        if (ps.isc_summary && ps.isc_summary.total && ps.isc_summary.total > 0) {
            const s = ps.isc_summary;
            lines.push(`  ISC: ${s.passing || 0}/${s.total} passing, ${s.failing || 0} failing, ${s.pending || 0} pending`);
        }
        if (ps.session_history_summary) {
            lines.push(`  Last session: "${ps.session_history_summary}"`);
        }
        if (ps.current_phase && ps.current_phase !== 'OBSERVE') {
            lines.push(`  ⚠️ RESUME from ${ps.current_phase} phase — do NOT restart OBSERVE`);
        }
        lines.push('');
    }
    const meta = [];
    if (c.effort_level)
        meta.push(`Effort: ${c.effort_level}`);
    if (c.intent_type)
        meta.push(`Intent: ${c.intent_type}`);
    if (c.confidence)
        meta.push(`Confidence: ${Math.round(c.confidence * 100)}%`);
    if (c.memory_scope)
        meta.push(`Scope: ${c.memory_scope}`);
    if (c.memory_tier)
        meta.push(`Memory: ${c.memory_tier}`);
    if (meta.length)
        lines.push(meta.join(' | '));
    if (c.matched_skills?.length) {
        lines.push(`Matched skills: ${c.matched_skills.join(', ')}`);
    }
    const re = c.reverse_engineering;
    if (re) {
        if (re.explicit_wants?.length) {
            lines.push('What user explicitly wants:');
            for (const w of re.explicit_wants)
                lines.push(`  - ${w}`);
        }
        if (re.implicit_wants?.length) {
            lines.push('What is implied but not stated:');
            for (const w of re.implicit_wants)
                lines.push(`  - ${w}`);
        }
        if (re.explicit_dont_wants?.length) {
            lines.push('What user explicitly does NOT want:');
            for (const w of re.explicit_dont_wants)
                lines.push(`  - ${w}`);
        }
        if (re.implicit_dont_wants?.length) {
            lines.push('What user would clearly NOT want:');
            for (const w of re.implicit_dont_wants)
                lines.push(`  - ${w}`);
        }
        if (re.gotchas?.length) {
            lines.push('Gotchas and edge cases:');
            for (const g of re.gotchas)
                lines.push(`  - ${g}`);
        }
    }
    if (c.suggested_capabilities?.length) {
        lines.push(`Suggested capabilities: ${c.suggested_capabilities.join(', ')}`);
    }
    if (c.isc_scaffold?.length) {
        lines.push('ISC Scaffold (preliminary Ideal State Criteria):');
        for (let i = 0; i < c.isc_scaffold.length; i++) {
            lines.push(`  ${i + 1}. ${c.isc_scaffold[i]}`);
        }
    }
    if (c.constraints_extracted?.length) {
        lines.push(`Constraints: ${c.constraints_extracted.join('; ')}`);
    }
    const audit = data.capability_audit;
    if (audit?.formatted_summary) {
        lines.push('');
        lines.push(audit.formatted_summary);
    }
    const qg = data.quality_gate_config;
    if (qg?.rules?.length) {
        lines.push('');
        lines.push(`ISC Quality Gate: min ${qg.min_criteria || 4} criteria, ${qg.anti_required ? 'anti-criteria required' : 'anti-criteria optional'}, ${qg.word_range?.min || 8}-${qg.word_range?.max || 12} words each`);
        const effortGated = qg.rules.filter((r) => r.min_effort);
        if (effortGated.length) {
            lines.push(`  Effort-gated rules: ${effortGated.map((r) => `${r.id} (${r.min_effort}+)`).join(', ')}`);
        }
    }
    const preload = data.context_pre_load_plan;
    if (preload?.entity_types?.length) {
        lines.push(`Context pre-load: ${preload.tier} tier → ${preload.entity_types.join(', ')}`);
    }
    const directives = data.behavioral_directives;
    if (directives?.length) {
        lines.push('');
        lines.push('BEHAVIORAL DIRECTIVES (from gramatr steering rules — follow these):');
        for (const d of directives)
            lines.push(`  - ${d}`);
    }
    if (data.packet_1_contents?.length || data.packet_2_contents?.length || data.packet_2_status || data.enrichment_id) {
        lines.push('');
        if (data.packet_1_contents?.length) {
            lines.push(`PACKET 1 CONTENTS: ${data.packet_1_contents.join(', ')}`);
        }
        const packet2Parts = [
            data.packet_2_status ? `status=${data.packet_2_status}` : '',
            data.packet_2_contents?.length ? `contents=${data.packet_2_contents.join(', ')}` : '',
            data.enrichment_id ? `enrichment_id=${data.enrichment_id}` : '',
        ].filter(Boolean);
        if (packet2Parts.length) {
            lines.push(`PACKET 2: ${packet2Parts.join(' | ')}`);
        }
    }
    if (data.format_spec?.mode || data.format_spec?.phases?.length || data.format_spec?.response_contract?.length) {
        lines.push('');
        lines.push(`FORMAT SPEC: ${[
            data.format_spec.mode ? `mode=${data.format_spec.mode}` : '',
            data.format_spec.phases?.length ? `phases=${data.format_spec.phases.join('→')}` : '',
            data.format_spec.response_contract?.length ? `contract=${data.format_spec.response_contract.join(', ')}` : '',
        ].filter(Boolean).join(' | ')}`);
    }
    if (data.classifier_heads) {
        const entries = Object.entries(data.classifier_heads).slice(0, 4);
        if (entries.length) {
            lines.push('');
            lines.push('CLASSIFIER HEADS:');
            for (const [head, rawScores] of entries) {
                const top = normalizeClassifierHeadScores(rawScores)
                    .slice(0, 2)
                    .map((score) => {
                    const numericScore = typeof score.score === 'number'
                        ? score.score
                        : typeof score.confidence === 'number'
                            ? score.confidence
                            : null;
                    const pct = typeof numericScore === 'number' ? `${Math.round(numericScore * 100)}%` : '';
                    return [score.label, pct].filter(Boolean).join(' ');
                })
                    .filter(Boolean)
                    .join(', ');
                lines.push(`  - ${head}: ${top || 'present'}`);
            }
        }
    }
    if (data.routing_signals) {
        const parts = [
            data.routing_signals.complexity ? `complexity=${data.routing_signals.complexity}` : '',
            data.routing_signals.crud_operation ? `crud=${data.routing_signals.crud_operation}` : '',
            data.routing_signals.conversation_phase ? `phase=${data.routing_signals.conversation_phase}` : '',
            data.routing_signals.memory_scope ? `scope=${data.routing_signals.memory_scope}` : '',
            data.routing_signals.memory_priority ? `memory=${data.routing_signals.memory_priority}` : '',
            typeof data.routing_signals.retrieval_needed === 'boolean' ? `retrieval=${data.routing_signals.retrieval_needed}` : '',
            typeof data.routing_signals.is_read_only === 'boolean' ? `read_only=${data.routing_signals.is_read_only}` : '',
            typeof data.routing_signals.requires_approval === 'boolean' ? `approval=${data.routing_signals.requires_approval}` : '',
            typeof data.routing_signals.escalation_recommended === 'boolean' ? `escalate=${data.routing_signals.escalation_recommended}` : '',
        ].filter(Boolean);
        if (parts.length || data.routing_signals.safety_flags?.length) {
            lines.push('');
            lines.push(`ROUTING SIGNALS: ${parts.join(' | ')}`);
            if (data.routing_signals.entity_type_suggestion?.top) {
                lines.push(`  Entity suggestion: ${data.routing_signals.entity_type_suggestion.top}`);
            }
            if (data.routing_signals.safety_flags?.length) {
                lines.push(`  Safety flags: ${data.routing_signals.safety_flags.join(', ')}`);
            }
        }
    }
    if (data.skill_routing) {
        const matched = (data.skill_routing.matched_skills || []).map((skill) => skill.name || skill.id).filter(Boolean);
        const stats = [
            typeof data.skill_routing.use_count === 'number' ? `use=${data.skill_routing.use_count}` : '',
            typeof data.skill_routing.decline_count === 'number' ? `decline=${data.skill_routing.decline_count}` : '',
            typeof data.skill_routing.na_count === 'number' ? `na=${data.skill_routing.na_count}` : '',
            typeof data.skill_routing.pattern_boost_applied === 'boolean' ? `pattern_boost=${data.skill_routing.pattern_boost_applied}` : '',
        ].filter(Boolean);
        if (matched.length || stats.length) {
            lines.push('');
            if (matched.length)
                lines.push(`SKILL ROUTING: ${matched.join(', ')}`);
            if (stats.length)
                lines.push(`  Stats: ${stats.join(' | ')}`);
        }
    }
    const activeSkill = data.active_skill;
    if (activeSkill?.directives?.length) {
        lines.push('');
        lines.push(`ACTIVE SKILL: ${activeSkill.title || activeSkill.name} (phase: ${activeSkill.phase || 'ALL'})`);
        for (const d of activeSkill.directives)
            lines.push(`  - ${d}`);
    }
    const rules = data.behavioral_rules;
    const effort = c.effort_level || 'standard';
    const memoryTier = c.memory_tier || 'none';
    const memoryScope = c.memory_scope || data.routing_signals?.memory_scope || null;
    if (rules) {
        lines.push('');
        lines.push(`ALGORITHM: ${(rules.algorithm_phases || []).join(' → ')}`);
        if (rules.hard_gates) {
            lines.push('');
            lines.push('HARD GATES:');
            for (const value of Object.values(rules.hard_gates)) {
                lines.push(`  - ${value}`);
            }
        }
        if (rules.verification_rules?.length) {
            lines.push('');
            lines.push('VERIFICATION RULES:');
            for (const r of rules.verification_rules)
                lines.push(`  - ${r}`);
        }
        if (rules.code_rules?.length) {
            lines.push('');
            lines.push('CODE RULES:');
            for (const r of rules.code_rules)
                lines.push(`  - ${r}`);
        }
        if (rules.safety_rules?.length) {
            lines.push('');
            lines.push('SAFETY RULES:');
            for (const r of rules.safety_rules)
                lines.push(`  - ${r}`);
        }
    }
    if (memoryTier !== 'none') {
        lines.push('');
        lines.push('═══ MANDATORY: QUERY GRAMATR MEMORY BEFORE ANY WORK ═══');
        lines.push(`${memoryScope ? `Memory scope: ${memoryScope} | ` : ''}Memory tier: ${memoryTier} — Use search_results from Packet 1 if present. Only call search_semantic for follow-up queries.`);
        lines.push('Do NOT answer from stale local markdown alone. gramatr has the live knowledge graph.');
    }
    lines.push('');
    lines.push('═══ MANDATORY: CREATE ISC VIA TaskCreate BEFORE ANY WORK ═══');
    lines.push('You MUST call the TaskCreate tool for each criterion below. This creates visible tracked tasks.');
    lines.push('NEVER write criteria as manual text/tables. ALWAYS use TaskCreate + TaskList tools.');
    lines.push('ALWAYS prefix task subjects with "ISC-C{N}: " for criteria or "ISC-A{N}: " for anti-criteria.');
    lines.push('The ISC prefix is REQUIRED — it signals to the user that gramatr intelligence is driving the criteria.');
    lines.push('This is a HARD GATE — do NOT proceed to any work until TaskCreate calls are complete.');
    lines.push('');
    lines.push('When presenting gramatr intelligence (ISC scaffolds, search results, agent recommendations, summaries), prefix with **grā:** in bold. This distinguishes server-pre-computed content from your own reasoning. Example: "**grā:** ISC scaffold suggests 6 criteria for this migration task."');
    if (effort === 'instant') {
        lines.push('');
        lines.push('FORMAT (instant effort — minimal): State, do, confirm.');
    }
    else if (effort === 'fast') {
        lines.push('');
        lines.push('FORMAT (fast effort — compressed):');
        lines.push('  1. "Understanding: [wants] | Avoiding: [don\'t wants]"');
        if (c.isc_scaffold?.length) {
            lines.push('  2. MANDATORY — call TaskCreate for each:');
            for (let i = 0; i < c.isc_scaffold.length; i++) {
                lines.push(`     [INVOKE TaskCreate: subject="ISC-C${i + 1}: ${c.isc_scaffold[i]}", description="Binary testable: PASS or FAIL."]`);
            }
            lines.push('  3. [INVOKE TaskList to display criteria to user]');
            lines.push('  4. Do the work');
            lines.push('  5. [INVOKE TaskList], then [INVOKE TaskUpdate] each with PASS/FAIL + evidence');
        }
        else {
            lines.push('  2. [INVOKE TaskCreate for at least 4 criteria you identify]');
            lines.push('  3. [INVOKE TaskList to display criteria to user]');
            lines.push('  4. Do the work');
            lines.push('  5. [INVOKE TaskList], then [INVOKE TaskUpdate] each with PASS/FAIL + evidence');
        }
    }
    else {
        lines.push('');
        lines.push(`FORMAT (${effort} effort — full phases)`);
        const agents = data.suggested_agents;
        if (agents?.length) {
            lines.push('');
            lines.push('Suggested agents:');
            for (const a of agents) {
                lines.push(`  - ${a.display_name || a.name || 'agent'} (${a.model || 'default'}) — ${a.reason || ''}`);
            }
        }
    }
    const mem = data.memory_context;
    if (mem?.results?.length) {
        lines.push('');
        lines.push(`RELEVANT MEMORY (${mem.total_count} matches from gramatr knowledge graph):`);
        for (const r of mem.results.slice(0, 5)) {
            const sim = r.similarity ? ` (${Math.round(r.similarity * 100)}% match)` : '';
            lines.push(`  - [${r.entity_type || 'unknown'}] ${r.entity_name || 'unnamed'}${sim}: ${(r.content || '').substring(0, 150)}`);
        }
    }
    if (data.search_results?.results?.length) {
        lines.push('');
        lines.push(`SEARCH RESULTS (${data.search_results.count || data.search_results.results.length} pre-loaded):`);
        for (const r of data.search_results.results.slice(0, 3)) {
            const label = [r.entity_name, r.entity_type].filter(Boolean).join(' / ');
            lines.push(`  - ${[label, (r.snippet || '').substring(0, 150)].filter(Boolean).join(': ')}`);
        }
    }
    if (data.diary_compact?.summary || data.diary_compact?.current_focus) {
        lines.push('');
        lines.push('DIARY COMPACT:');
        if (data.diary_compact.summary)
            lines.push(`  ${data.diary_compact.summary}`);
        if (data.diary_compact.current_focus)
            lines.push(`  Focus: ${data.diary_compact.current_focus}`);
    }
    if (data.agent_recommendation?.type || data.agent_recommendation?.source) {
        lines.push('');
        lines.push(`AGENT RECOMMENDATION: ${[
            data.agent_recommendation.type ? `type=${data.agent_recommendation.type}` : '',
            data.agent_recommendation.source ? `source=${data.agent_recommendation.source}` : '',
            typeof data.agent_recommendation.confidence === 'number'
                ? `confidence=${Math.round(data.agent_recommendation.confidence * 100)}%`
                : '',
        ].filter(Boolean).join(' | ')}`);
    }
    if (data.active_task?.id || data.active_task?.title || data.active_task?.phase || data.active_task?.status) {
        lines.push('');
        lines.push(`ACTIVE TASK: ${[
            data.active_task.id ? `id=${data.active_task.id}` : '',
            data.active_task.title ? `title=${data.active_task.title}` : '',
            data.active_task.phase ? `phase=${data.active_task.phase}` : '',
            data.active_task.status ? `status=${data.active_task.status}` : '',
        ].filter(Boolean).join(' | ')}`);
    }
    const composed = data.composed_agents;
    if (composed?.length) {
        lines.push('');
        lines.push('gramatr composed agent (specialized for this task — USE THIS):');
        for (const ca of composed) {
            lines.push(`  Agent: ${ca.display_name || ca.name || 'specialist'}`);
            lines.push(`  Domain: ${ca.task_domain || 'general'} | Expertise: ${(ca.expertise_areas || []).join(', ')}`);
            lines.push(`  Model: ${ca.model_preference || 'default'}`);
            lines.push(`  Context: ${ca.context_summary || 'memory-aware'}`);
            lines.push('  ACTION: Use the Task tool with subagent_type="general-purpose" and inject this system prompt:');
            lines.push('  --- AGENT SYSTEM PROMPT START ---');
            const promptPreview = (ca.system_prompt || '').substring(0, 800);
            lines.push(`  ${promptPreview}${(ca.system_prompt || '').length > 800 ? '... [truncated — use gramatr_invoke_agent for full prompt]' : ''}`);
            lines.push('  --- AGENT SYSTEM PROMPT END ---');
        }
    }
    const saved = ts.total_saved || ts.tokens_saved || 0;
    if (saved > 0) {
        lines.push(`[Token savings: ${saved.toLocaleString()} tokens saved per request (CLAUDE.md: ${(ts.claude_md_reduction || 0).toLocaleString()}, OBSERVE offload: ${(ts.observe_work_offloaded || 0).toLocaleString()})]`);
    }
    if (data.curated_context) {
        lines.push('');
        lines.push('CURATED CONTEXT:');
        lines.push(data.curated_context.trim());
    }
    const diagnostics = data.packet_diagnostics;
    if (diagnostics?.memory_context?.status === 'error' || diagnostics?.project_state?.status === 'error') {
        lines.push('');
        lines.push('PACKET DIAGNOSTICS:');
        if (diagnostics.memory_context?.status === 'error') {
            lines.push(`  - Memory pre-load degraded: ${diagnostics.memory_context.error || 'unknown error'}`);
        }
        if (diagnostics.project_state?.status === 'error') {
            lines.push(`  - Project state degraded: ${diagnostics.project_state.error || 'unknown error'}`);
        }
    }
    const degraded = data.execution_summary?.degraded_components?.filter((component) => component.startsWith('classification.')) || [];
    if (degraded.length > 0) {
        lines.push('');
        lines.push('CLASSIFIER DIAGNOSTICS:');
        for (const component of degraded) {
            lines.push(`  - ${component.replace('classification.', '').replace(/_/g, ' ')} degraded`);
        }
    }
    if (!enrichment && data.packet_2_status === 'pending' && data.enrichment_id) {
        lines.push('');
        lines.push(`Packet 2 (reverse engineering + ISC scaffold) is still generating. If needed, call gramatr_get_enrichment with enrichment_id="${data.enrichment_id}".`);
    }
    return lines.join('\n');
}
export function emitStatus(data, elapsed, lastFailure) {
    if (!data) {
        if (lastFailure) {
            process.stderr.write(`[gramatr] ✗ ${lastFailure.reason} (${elapsed}ms) — ${lastFailure.detail}\n`);
        }
        else {
            process.stderr.write(`[gramatr] ✗ no result (${elapsed}ms)\n`);
        }
        return;
    }
    const c = data.classification || {};
    const es = data.execution_summary || {};
    const st = es.stage_timing || {};
    const version = es.server_version ? `v${es.server_version}` : '';
    const classifier = es.classifier_model || 'unknown';
    const confidence = c.confidence ? `${Math.round(c.confidence * 100)}%` : '';
    process.stderr.write(`[grāmatr${version ? ' ' + version : ''}] ✓ ${c.effort_level || '?'}/${c.intent_type || '?'} ${confidence} (${classifier}, ${elapsed}ms)\n`);
    const stages = [];
    if (st.distilbert_ms !== undefined)
        stages.push(`classify:${st.distilbert_ms}ms`);
    if (st.mistral_classify_ms !== undefined)
        stages.push(`classify:${st.mistral_classify_ms}ms`);
    if (st.tool_calling_ms !== undefined)
        stages.push(`memory:${st.tool_calling_ms}ms`);
    if (st.reverse_engineering_ms !== undefined)
        stages.push(`RE:${st.reverse_engineering_ms}ms`);
    if (st.isc_scaffold_ms !== undefined)
        stages.push(`ISC:${st.isc_scaffold_ms}ms`);
    if (stages.length > 0) {
        process.stderr.write(`[gramatr] stages: ${stages.join(' → ')}\n`);
    }
}
//# sourceMappingURL=intelligence.js.map