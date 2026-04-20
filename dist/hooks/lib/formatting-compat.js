function trimLine(line) {
    return line.replace(/\s+/g, ' ').trim();
}
function formatList(title, items, maxItems = 5) {
    if (!items || items.length === 0)
        return [];
    const lines = [title];
    for (const item of items.slice(0, maxItems)) {
        const text = trimLine(item);
        if (text)
            lines.push(`- ${text}`);
    }
    return lines.length > 1 ? lines : [];
}
function formatMemoryContext(route) {
    const packet1 = route.packet_1;
    const results = packet1?.memory_context?.results ?? route.memory_context?.results ?? [];
    if (results.length === 0)
        return [];
    const lines = ['Memory context:'];
    for (const result of results.slice(0, 3)) {
        const labelParts = [result.entity_name, result.entity_type].filter(Boolean);
        const label = labelParts.join(' / ');
        const content = trimLine(result.summary || result.content || '').slice(0, 220);
        if (label && content)
            lines.push(`- ${label}: ${content}`);
        else if (label)
            lines.push(`- ${label}`);
        else if (content)
            lines.push(`- ${content}`);
    }
    return lines.length > 1 ? lines : [];
}
function formatPacketManifest(route) {
    const manifest = route.packet_1?.manifest;
    const lines = [];
    const packet1Contents = manifest?.contents ?? route.packet_1_contents;
    if (packet1Contents?.length) {
        lines.push(`Packet 1: ${packet1Contents.join(', ')}`);
    }
    const packet2Contents = manifest?.packet_2_contents ?? route.packet_2_contents;
    const packet2Status = manifest?.packet_2_status ?? route.packet_2_status;
    const enrichmentId = manifest?.enrichment_id ?? route.enrichment_id;
    if (packet2Contents?.length || packet2Status || enrichmentId) {
        const parts = [];
        if (packet2Status)
            parts.push(`status=${packet2Status}`);
        if (packet2Contents?.length)
            parts.push(`contents=${packet2Contents.join(', ')}`);
        if (enrichmentId)
            parts.push(`enrichment_id=${enrichmentId}`);
        lines.push(`Packet 2: ${parts.join(' | ')}`);
    }
    return lines;
}
function normalizeClassifierHeadScores(value) {
    if (!value)
        return [];
    return Array.isArray(value) ? value : [value];
}
function formatClassifierHeads(route) {
    const classifierHeads = route.packet_1?.classifier_heads ?? route.classifier_heads;
    if (!classifierHeads)
        return [];
    const entries = Object.entries(classifierHeads).slice(0, 4);
    if (!entries.length)
        return [];
    const lines = ['Classifier heads:'];
    for (const [head, rawScores] of entries) {
        const top = normalizeClassifierHeadScores(rawScores).slice(0, 2).map((score) => {
            const numericScore = typeof score.score === 'number'
                ? score.score
                : typeof score.confidence === 'number'
                    ? score.confidence
                    : null;
            const pct = typeof numericScore === 'number' ? `${Math.round(numericScore * 100)}%` : '';
            return [score.label, pct].filter(Boolean).join(' ');
        }).filter(Boolean).join(', ');
        lines.push(`- ${head}: ${top || 'present'}`);
    }
    return lines;
}
function formatRoutingSignals(route) {
    const signals = route.packet_1?.routing_signals ?? route.routing_signals;
    if (!signals)
        return [];
    const parts = [
        signals.complexity ? `complexity=${signals.complexity}` : '',
        signals.crud_operation ? `crud=${signals.crud_operation}` : '',
        signals.conversation_phase ? `phase=${signals.conversation_phase}` : '',
        signals.memory_scope ? `scope=${signals.memory_scope}` : '',
        signals.memory_priority ? `memory=${signals.memory_priority}` : '',
        typeof signals.retrieval_needed === 'boolean' ? `retrieval=${signals.retrieval_needed}` : '',
        typeof signals.is_read_only === 'boolean' ? `read_only=${signals.is_read_only}` : '',
        typeof signals.requires_approval === 'boolean' ? `approval=${signals.requires_approval}` : '',
    ].filter(Boolean);
    const lines = parts.length ? [`Routing signals: ${parts.join(' | ')}`] : [];
    if (signals.entity_type_suggestion?.top)
        lines.push(`Entity suggestion: ${signals.entity_type_suggestion.top}`);
    if (signals.safety_flags?.length)
        lines.push(`Safety flags: ${signals.safety_flags.join(', ')}`);
    return lines;
}
function formatSkillRouting(route) {
    const skillRouting = route.packet_1?.skills?.routing ?? route.packet_1?.skill_routing ?? route.skill_routing;
    if (!skillRouting)
        return [];
    const lines = [];
    const matched = (skillRouting.matched_skills || []).map((skill) => skill.name || skill.id).filter(Boolean);
    if (matched.length)
        lines.push(`Skill routing: ${matched.join(', ')}`);
    const counts = [
        typeof skillRouting.use_count === 'number' ? `use=${skillRouting.use_count}` : '',
        typeof skillRouting.decline_count === 'number' ? `decline=${skillRouting.decline_count}` : '',
        typeof skillRouting.na_count === 'number' ? `na=${skillRouting.na_count}` : '',
        typeof skillRouting.pattern_boost_applied === 'boolean' ? `pattern_boost=${skillRouting.pattern_boost_applied}` : '',
    ].filter(Boolean);
    if (counts.length)
        lines.push(`Skill routing stats: ${counts.join(' | ')}`);
    return lines;
}
function formatSearchResults(route) {
    const search = route.packet_1?.search_results ?? route.search_results;
    if (!search?.results?.length)
        return [];
    const lines = ['Search results:'];
    for (const result of search.results.slice(0, 3)) {
        const label = [result.entity_name, result.entity_type].filter(Boolean).join(' / ');
        const snippet = trimLine(result.summary || result.snippet || '').slice(0, 160);
        lines.push(`- ${[label, snippet].filter(Boolean).join(': ')}`);
    }
    return lines;
}
export function buildUserPromptAdditionalContext(route) {
    const lines = [];
    const packet1 = route.packet_1 || {};
    const statusline = packet1.statusline_markdown || route.statusline_markdown;
    if (typeof statusline === 'string' && statusline.trim()) {
        lines.push(statusline.trim());
        lines.push('');
    }
    lines.push('[GMTR Intelligence]');
    const classification = packet1.classification || route.classification;
    if (classification) {
        const parts = [
            classification.effort_level ? `effort=${classification.effort_level}` : '',
            classification.intent_type ? `intent=${classification.intent_type}` : '',
            classification.memory_scope ? `scope=${classification.memory_scope}` : '',
        ].filter(Boolean);
        if (parts.length > 0)
            lines.push(parts.join(' | '));
    }
    const projectState = packet1.project_state || route.project_state;
    if (projectState?.current_phase || projectState?.active_prd_title) {
        const phase = projectState.current_phase || 'unknown';
        const prd = projectState.active_prd_title;
        lines.push(`Project state: phase=${phase}${prd ? ` | prd=${prd}` : ''}`);
    }
    const capabilityAudit = packet1.capability_audit || route.capability_audit;
    if (capabilityAudit?.formatted_summary)
        lines.push(capabilityAudit.formatted_summary.trim());
    const preloadPlan = packet1.context_pre_load_plan || route.context_pre_load_plan;
    if (preloadPlan?.entity_types?.length) {
        const scope = preloadPlan.scope ? ` | scope=${preloadPlan.scope}` : '';
        lines.push(`Preload plan:${scope} | entities=${preloadPlan.entity_types.join(', ')}`);
    }
    const memoryPlan = packet1.memory_plan || route.memory_plan;
    if (memoryPlan?.strategy) {
        const parts = [
            `strategy=${memoryPlan.strategy}`,
            memoryPlan.memory_scope ? `scope=${memoryPlan.memory_scope}` : '',
            memoryPlan.domain_class ? `domain=${memoryPlan.domain_class}` : '',
            memoryPlan.entity_type_filter ? `filter=${memoryPlan.entity_type_filter}` : '',
            typeof memoryPlan.top_k === 'number' ? `top_k=${memoryPlan.top_k}` : '',
        ].filter(Boolean);
        lines.push(`Memory plan: ${parts.join(' | ')}`);
    }
    lines.push(...formatPacketManifest(route));
    lines.push(...formatList('Explicit wants:', classification?.reverse_engineering?.explicit_wants));
    lines.push(...formatList('Implicit wants:', classification?.reverse_engineering?.implicit_wants, 4));
    lines.push(...formatList('Gotchas:', classification?.reverse_engineering?.gotchas, 4));
    lines.push(...formatList('Constraints:', classification?.constraints_extracted, 4));
    lines.push(...formatList('Quality Gates:', classification?.isc_scaffold, 5));
    lines.push(...formatList('Behavioral directives:', packet1.behavioral_directives || route.behavioral_directives, 6));
    lines.push(...formatClassifierHeads(route));
    lines.push(...formatRoutingSignals(route));
    lines.push(...formatSkillRouting(route));
    lines.push(...formatMemoryContext(route));
    lines.push(...formatSearchResults(route));
    const curatedContext = packet1.curated_context || route.curated_context;
    if (curatedContext) {
        lines.push('Curated context:');
        lines.push(curatedContext.trim());
    }
    if (projectState?.session_history_summary) {
        lines.push('Session history:');
        lines.push(projectState.session_history_summary.trim());
    }
    const diaryCompact = packet1.diary_compact || route.diary_compact;
    if (diaryCompact?.summary || diaryCompact?.current_focus) {
        lines.push('Diary compact:');
        if (diaryCompact.summary)
            lines.push(trimLine(diaryCompact.summary));
        if (diaryCompact.current_focus)
            lines.push(`Focus: ${trimLine(diaryCompact.current_focus)}`);
    }
    const agentRecommendation = packet1.agents?.recommendation || packet1.agent_recommendation || route.agent_recommendation;
    if (agentRecommendation?.type || agentRecommendation?.source) {
        const parts = [
            agentRecommendation.type ? `type=${agentRecommendation.type}` : '',
            agentRecommendation.source ? `source=${agentRecommendation.source}` : '',
            typeof agentRecommendation.confidence === 'number'
                ? `confidence=${Math.round(agentRecommendation.confidence * 100)}%`
                : '',
        ].filter(Boolean);
        lines.push(`Agent recommendation: ${parts.join(' | ')}`);
    }
    const activeTask = packet1.active_task || route.active_task;
    if (activeTask?.id || activeTask?.title || activeTask?.phase || activeTask?.status) {
        const parts = [
            activeTask.id ? `id=${activeTask.id}` : '',
            activeTask.title ? `title=${activeTask.title}` : '',
            activeTask.phase ? `phase=${activeTask.phase}` : '',
            activeTask.status ? `status=${activeTask.status}` : '',
        ].filter(Boolean);
        lines.push(`Active task: ${parts.join(' | ')}`);
    }
    const packetDiagnostics = packet1.packet_diagnostics || route.packet_diagnostics;
    if (packetDiagnostics?.memory_context?.status === 'error') {
        lines.push('Memory diagnostics:');
        lines.push(`- ${trimLine(packetDiagnostics.memory_context.error || 'memory pre-load degraded')}`);
    }
    if (packetDiagnostics?.project_state?.status === 'error') {
        lines.push('Project state diagnostics:');
        lines.push(`- ${trimLine(packetDiagnostics.project_state.error || 'project state degraded')}`);
    }
    const executionSummary = packet1.execution_summary || route.execution_summary;
    const degradedClassifierStages = executionSummary?.degraded_components?.filter((component) => component.startsWith('classification.')) || [];
    if (degradedClassifierStages.length > 0) {
        lines.push('Classifier diagnostics:');
        for (const component of degradedClassifierStages) {
            lines.push(`- ${trimLine(component.replace('classification.', '').replace(/_/g, ' ') + ' degraded')}`);
        }
    }
    return lines.join('\n').trim();
}
export function buildSessionStartAdditionalContext(projectId, sessionStart, handoff) {
    const lines = ['[GMTR Session Context]'];
    lines.push(`Project: ${projectId}`);
    if (sessionStart?.interaction_id)
        lines.push(`Interaction: ${sessionStart.interaction_id}`);
    if (handoff?.source || handoff?._meta?.platform || handoff?._meta?.branch) {
        const metaParts = [
            handoff.source ? `source=${handoff.source}` : '',
            handoff._meta?.platform ? `platform=${handoff._meta.platform}` : '',
            handoff._meta?.branch ? `branch=${handoff._meta.branch}` : '',
        ].filter(Boolean);
        if (metaParts.length > 0)
            lines.push(`Handoff meta: ${metaParts.join(' | ')}`);
    }
    if (handoff?.where_we_are) {
        lines.push('Where we are:');
        lines.push(handoff.where_we_are.trim());
    }
    if (handoff?.what_shipped) {
        lines.push('What shipped:');
        lines.push(handoff.what_shipped.trim());
    }
    if (handoff?.whats_next) {
        lines.push('What is next:');
        lines.push(handoff.whats_next.trim());
    }
    if (handoff?.key_context) {
        lines.push('Key context:');
        lines.push(handoff.key_context.trim());
    }
    if (handoff?.dont_forget) {
        lines.push('Do not forget:');
        lines.push(handoff.dont_forget.trim());
    }
    if (!handoff?.where_we_are && !handoff?.whats_next && !handoff?.key_context) {
        lines.push('No saved handoff was found. Query gramatr memory before doing context recovery.');
    }
    return lines.join('\n').trim();
}
export function buildHookFailureAdditionalContext(failure) {
    const lines = ['[GMTR Intelligence Unavailable]'];
    lines.push(failure.title);
    lines.push(`Detail: ${trimLine(failure.detail)}`);
    if (failure.action)
        lines.push(`Action: ${trimLine(failure.action)}`);
    return lines.join('\n').trim();
}
//# sourceMappingURL=formatting-compat.js.map