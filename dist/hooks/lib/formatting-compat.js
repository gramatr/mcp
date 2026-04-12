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
    const results = route.memory_context?.results ?? [];
    if (results.length === 0)
        return [];
    const lines = ['Memory context:'];
    for (const result of results.slice(0, 3)) {
        const labelParts = [result.entity_name, result.entity_type].filter(Boolean);
        const label = labelParts.join(' / ');
        const content = trimLine(result.content || '').slice(0, 220);
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
    const lines = [];
    if (route.packet_1_contents?.length) {
        lines.push(`Packet 1: ${route.packet_1_contents.join(', ')}`);
    }
    if (route.packet_2_contents?.length || route.packet_2_status || route.enrichment_id) {
        const parts = [];
        if (route.packet_2_status)
            parts.push(`status=${route.packet_2_status}`);
        if (route.packet_2_contents?.length)
            parts.push(`contents=${route.packet_2_contents.join(', ')}`);
        if (route.enrichment_id)
            parts.push(`enrichment_id=${route.enrichment_id}`);
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
    if (!route.classifier_heads)
        return [];
    const entries = Object.entries(route.classifier_heads).slice(0, 4);
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
    const signals = route.routing_signals;
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
    const skillRouting = route.skill_routing;
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
    const search = route.search_results;
    if (!search?.results?.length)
        return [];
    const lines = ['Search results:'];
    for (const result of search.results.slice(0, 3)) {
        const label = [result.entity_name, result.entity_type].filter(Boolean).join(' / ');
        const snippet = trimLine(result.snippet || '').slice(0, 160);
        lines.push(`- ${[label, snippet].filter(Boolean).join(': ')}`);
    }
    return lines;
}
export function buildUserPromptAdditionalContext(route) {
    const lines = [];
    if (typeof route.statusline_markdown === 'string' && route.statusline_markdown.trim()) {
        lines.push(route.statusline_markdown.trim());
        lines.push('');
    }
    lines.push('[GMTR Intelligence]');
    const classification = route.classification;
    if (classification) {
        const parts = [
            classification.effort_level ? `effort=${classification.effort_level}` : '',
            classification.intent_type ? `intent=${classification.intent_type}` : '',
            classification.memory_scope ? `scope=${classification.memory_scope}` : '',
            classification.memory_tier ? `memory=${classification.memory_tier}` : '',
        ].filter(Boolean);
        if (parts.length > 0)
            lines.push(parts.join(' | '));
    }
    if (route.project_state?.current_phase || route.project_state?.active_prd_title) {
        const phase = route.project_state.current_phase || 'unknown';
        const prd = route.project_state.active_prd_title;
        lines.push(`Project state: phase=${phase}${prd ? ` | prd=${prd}` : ''}`);
    }
    if (route.capability_audit?.formatted_summary)
        lines.push(route.capability_audit.formatted_summary.trim());
    if (route.context_pre_load_plan?.entity_types?.length) {
        const tier = route.context_pre_load_plan.tier || 'none';
        const scope = route.context_pre_load_plan.scope ? ` | scope=${route.context_pre_load_plan.scope}` : '';
        lines.push(`Preload plan: tier=${tier}${scope} | entities=${route.context_pre_load_plan.entity_types.join(', ')}`);
    }
    lines.push(...formatPacketManifest(route));
    lines.push(...formatList('Explicit wants:', classification?.reverse_engineering?.explicit_wants));
    lines.push(...formatList('Implicit wants:', classification?.reverse_engineering?.implicit_wants, 4));
    lines.push(...formatList('Gotchas:', classification?.reverse_engineering?.gotchas, 4));
    lines.push(...formatList('Constraints:', classification?.constraints_extracted, 4));
    lines.push(...formatList('ISC scaffold:', classification?.isc_scaffold, 5));
    lines.push(...formatList('Behavioral directives:', route.behavioral_directives, 6));
    lines.push(...formatClassifierHeads(route));
    lines.push(...formatRoutingSignals(route));
    lines.push(...formatSkillRouting(route));
    lines.push(...formatMemoryContext(route));
    lines.push(...formatSearchResults(route));
    if (route.curated_context) {
        lines.push('Curated context:');
        lines.push(route.curated_context.trim());
    }
    if (route.project_state?.session_history_summary) {
        lines.push('Session history:');
        lines.push(route.project_state.session_history_summary.trim());
    }
    if (route.diary_compact?.summary || route.diary_compact?.current_focus) {
        lines.push('Diary compact:');
        if (route.diary_compact.summary)
            lines.push(trimLine(route.diary_compact.summary));
        if (route.diary_compact.current_focus)
            lines.push(`Focus: ${trimLine(route.diary_compact.current_focus)}`);
    }
    if (route.agent_recommendation?.type || route.agent_recommendation?.source) {
        const parts = [
            route.agent_recommendation.type ? `type=${route.agent_recommendation.type}` : '',
            route.agent_recommendation.source ? `source=${route.agent_recommendation.source}` : '',
            typeof route.agent_recommendation.confidence === 'number'
                ? `confidence=${Math.round(route.agent_recommendation.confidence * 100)}%`
                : '',
        ].filter(Boolean);
        lines.push(`Agent recommendation: ${parts.join(' | ')}`);
    }
    if (route.active_task?.id || route.active_task?.title || route.active_task?.phase || route.active_task?.status) {
        const parts = [
            route.active_task.id ? `id=${route.active_task.id}` : '',
            route.active_task.title ? `title=${route.active_task.title}` : '',
            route.active_task.phase ? `phase=${route.active_task.phase}` : '',
            route.active_task.status ? `status=${route.active_task.status}` : '',
        ].filter(Boolean);
        lines.push(`Active task: ${parts.join(' | ')}`);
    }
    if (route.packet_diagnostics?.memory_context?.status === 'error') {
        lines.push('Memory diagnostics:');
        lines.push(`- ${trimLine(route.packet_diagnostics.memory_context.error || 'memory pre-load degraded')}`);
    }
    if (route.packet_diagnostics?.project_state?.status === 'error') {
        lines.push('Project state diagnostics:');
        lines.push(`- ${trimLine(route.packet_diagnostics.project_state.error || 'project state degraded')}`);
    }
    const degradedClassifierStages = route.execution_summary?.degraded_components?.filter((component) => component.startsWith('classification.')) || [];
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