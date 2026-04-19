function toAgentHint(agent) {
    if (!agent || typeof agent !== 'object')
        return null;
    const a = agent;
    const displayName = typeof a.display_name === 'string'
        ? a.display_name
        : typeof a.displayName === 'string'
            ? a.displayName
            : null;
    const model = typeof a.model === 'string'
        ? a.model
        : typeof a.model_preference === 'string'
            ? a.model_preference
            : null;
    return {
        name: typeof a.name === 'string' ? a.name : null,
        display_name: displayName,
        model,
        reason: typeof a.reason === 'string' ? a.reason : null,
    };
}
function hasAgentIdentity(hint) {
    return !!hint && !!(hint.name || hint.display_name || hint.model || hint.reason);
}
function toRecommendationMeta(value) {
    if (!value || typeof value !== 'object')
        return null;
    const r = value;
    return {
        type: typeof r.type === 'string' ? r.type : null,
        source: typeof r.source === 'string' ? r.source : null,
        confidence: typeof r.confidence === 'number' ? r.confidence : null,
    };
}
function renderContractBlock(payload) {
    return ['```json', JSON.stringify(payload, null, 2), '```'].join('\n');
}
function cloneContractPayload(payload) {
    return JSON.parse(JSON.stringify(payload));
}
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function normalizeHardGates(value) {
    if (Array.isArray(value)) {
        return value.filter((gate) => typeof gate === 'string' && gate.trim().length > 0);
    }
    if (isRecord(value)) {
        return Object.values(value)
            .filter((gate) => typeof gate === 'string' && gate.trim().length > 0);
    }
    return [];
}
function deriveCanonicalPacket2State(payload) {
    const packet1 = isRecord(payload.packet_1) ? payload.packet_1 : {};
    const manifest = isRecord(packet1.manifest) ? packet1.manifest : {};
    const packet2 = isRecord(payload.packet_2) ? payload.packet_2 : {};
    const unifiedPacket = isRecord(payload.unified_packet) ? payload.unified_packet : {};
    const unifiedManifest = isRecord(unifiedPacket.manifest) ? unifiedPacket.manifest : {};
    const unifiedEnrichment = isRecord(unifiedPacket.enrichment) ? unifiedPacket.enrichment : {};
    const status = manifest.packet_2_status
        || packet2.status
        || unifiedManifest.enrichment_status
        || payload.packet_2_status
        || 'not_applicable';
    const required = Boolean((typeof manifest.packet_2_required === 'boolean' ? manifest.packet_2_required : undefined)
        ?? (typeof packet2.required === 'boolean' ? packet2.required : undefined)
        ?? (typeof unifiedManifest.enrichment_required === 'boolean' ? unifiedManifest.enrichment_required : undefined)
        ?? (typeof unifiedEnrichment.required === 'boolean' ? unifiedEnrichment.required : undefined)
        ?? (typeof payload.packet_2_required === 'boolean' ? payload.packet_2_required : undefined)
        ?? (status === 'required'));
    const enrichmentId = manifest.enrichment_id
        || packet2.enrichment_id
        || unifiedManifest.enrichment_id
        || unifiedEnrichment.enrichment_id
        || payload.enrichment_id
        || null;
    return { status, required, enrichmentId };
}
export function formatFailureWarning(failure) {
    const titleMap = {
        auth: 'AUTHENTICATION FAILURE',
        timeout: 'TIMEOUT',
        server_down: 'SERVER UNREACHABLE',
        server_error: 'SERVER ERROR',
        parse_error: 'PARSE ERROR',
        unknown: 'UNKNOWN ERROR',
    };
    return renderContractBlock({
        schema: 'gmtr.intelligence.error.v1',
        error: {
            reason: failure.reason,
            title: titleMap[failure.reason],
            detail: failure.detail,
        },
        required_actions: [
            'Tell the user intelligence pre-classification failed.',
            'Do not pretend intelligence packet delivery succeeded.',
            'Continue with degraded flow only after surfacing the failure.',
        ],
    });
}
export function mergeEnrichmentIntoRoute(route, enrichment) {
    const packet2 = enrichment?.packet_2 || enrichment;
    const reasoning = (packet2?.reasoning || packet2 || {});
    const classification = route.packet_1?.classification || route.classification;
    if (!enrichment || !classification)
        return;
    if (reasoning.reverse_engineering) {
        classification.reverse_engineering = reasoning.reverse_engineering;
    }
    if (reasoning.isc_scaffold) {
        classification.isc_scaffold = reasoning.isc_scaffold;
    }
    if (reasoning.constraints_extracted) {
        classification.constraints_extracted = reasoning.constraints_extracted;
    }
    if (packet2 && route.packet_2 === undefined) {
        route.packet_2 = packet2;
    }
}
function normalizeClassifierHeadScores(value) {
    if (!value)
        return [];
    return Array.isArray(value) ? value : [value];
}
function normalizeMatchedSkillNames(packet1, classification) {
    const fromClassification = Array.isArray(classification.matched_skills)
        ? classification.matched_skills.filter((skill) => typeof skill === 'string')
        : [];
    if (fromClassification.length > 0)
        return fromClassification;
    const matched = packet1.skills?.routing?.matched_skills || [];
    return matched
        .map((skill) => skill.name || skill.id)
        .filter((name) => typeof name === 'string');
}
function normalizeRoutingSignals(value) {
    if (!value || typeof value !== 'object')
        return null;
    const raw = value;
    const { bert_entity_scope, bert_entity_category, bert_entity_type_suggestion, classifier_entity_scope, classifier_entity_category, classifier_entity_type_suggestion, ...rest } = raw;
    return {
        ...rest,
        classifier_entity_scope: classifier_entity_scope ?? bert_entity_scope ?? null,
        classifier_entity_category: classifier_entity_category ?? bert_entity_category ?? null,
        classifier_entity_type_suggestion: classifier_entity_type_suggestion ?? bert_entity_type_suggestion ?? null,
    };
}
function normalizeClassifierSignals(classifierHeads, routingSignals) {
    const normalizedHeads = classifierHeads
        ? Object.fromEntries(Object.entries(classifierHeads).map(([head, value]) => [
            head,
            normalizeClassifierHeadScores(value),
        ]))
        : null;
    const entityClassification = {
        scope: routingSignals?.classifier_entity_scope ?? null,
        category: routingSignals?.classifier_entity_category ?? null,
        type_suggestion: routingSignals?.classifier_entity_type_suggestion ?? null,
    };
    if (!normalizedHeads && !entityClassification.scope && !entityClassification.category && !entityClassification.type_suggestion) {
        return null;
    }
    return {
        heads: normalizedHeads,
        entity_classification: entityClassification,
    };
}
function buildRequiredActions(packet2Required, enrichmentId, hardGates = []) {
    const actions = [];
    if (packet2Required && enrichmentId) {
        actions.push(`Call gramatr_get_packet_two with enrichment_id="${enrichmentId}" before proceeding.`);
    }
    for (const gate of hardGates) {
        actions.push(`Mandatory gate: ${gate}`);
    }
    return actions;
}
function normalizeFullContractPayload(data) {
    const payload = cloneContractPayload(data);
    const packet1 = (payload.packet_1 || {});
    const manifest = (packet1.manifest || {});
    const unifiedPacket = (payload.unified_packet || null);
    const packet2 = (payload.packet_2 || {});
    const packet2State = deriveCanonicalPacket2State(payload);
    const packet1RoutingSignals = normalizeRoutingSignals(packet1.routing_signals);
    if (packet1RoutingSignals) {
        packet1.routing_signals = packet1RoutingSignals;
    }
    const packet1ClassifierHeads = packet1.classifier_heads;
    const packet1ClassifierSignals = normalizeClassifierSignals(packet1ClassifierHeads, packet1RoutingSignals);
    if (packet1ClassifierSignals) {
        packet1.classifier_signals = packet1ClassifierSignals;
    }
    if (unifiedPacket) {
        const unifiedRoutingSignals = normalizeRoutingSignals(unifiedPacket.routing_signals);
        if (unifiedRoutingSignals) {
            unifiedPacket.routing_signals = unifiedRoutingSignals;
        }
        const unifiedClassifierSignals = normalizeClassifierSignals(packet1ClassifierHeads, unifiedRoutingSignals);
        if (unifiedClassifierSignals) {
            unifiedPacket.classifier_signals = unifiedClassifierSignals;
        }
    }
    if (Object.keys(packet2).length > 0) {
        packet2.fetch_tool = packet2.fetch_tool || 'gramatr_get_packet_two';
        packet2.required = packet2State.required;
        packet2.enrichment_id = packet2.enrichment_id ?? packet2State.enrichmentId;
    }
    manifest.packet_2_status = manifest.packet_2_status || packet2State.status;
    manifest.packet_2_required = packet2State.required;
    manifest.enrichment_id = manifest.enrichment_id ?? packet2State.enrichmentId;
    const hardGates = normalizeHardGates((isRecord(packet1.behavioral_rules) ? packet1.behavioral_rules.hard_gates : undefined)
        ?? (unifiedPacket && isRecord(unifiedPacket.behavioral_rules) ? unifiedPacket.behavioral_rules.hard_gates : undefined));
    payload.required_actions = buildRequiredActions(packet2State.required, packet2State.enrichmentId, hardGates);
    payload.contract_enforcement = {
        required_actions: payload.required_actions,
        hard_gates: hardGates,
        packet_2_required: packet2State.required,
    };
    return payload;
}
export function formatIntelligence(data, enrichment) {
    if (data.schema === 'gmtr.intelligence.contract.v2'
        || data.schema === 'gmtr.intelligence.unified.v1'
        || data.contract_shape === 'full'
        || data.unified_packet) {
        if (data.schema === 'gmtr.intelligence.contract.v2') {
            return renderContractBlock(cloneContractPayload(data));
        }
        return renderContractBlock(normalizeFullContractPayload(data));
    }
    const packet1 = data.packet_1 || {};
    const _manifest = packet1.manifest;
    const packet2State = deriveCanonicalPacket2State(data);
    const packet2Status = packet2State.status;
    const enrichmentId = packet2State.enrichmentId;
    const c = packet1.classification || data.classification || {};
    const _es = packet1.execution_summary || data.execution_summary || {};
    const routingSignals = normalizeRoutingSignals(packet1.routing_signals || data.routing_signals);
    const classifierHeads = (packet1.classifier_heads || data.classifier_heads);
    const classifierSignals = normalizeClassifierSignals(classifierHeads, routingSignals);
    const memory = packet1.memory_context || data.memory_context;
    const searchResults = packet1.search_results || data.search_results;
    const agentRecommendation = packet1.agents?.recommendation || packet1.agent_recommendation || data.agent_recommendation || null;
    const suggestedAgents = packet1.agents?.suggested || packet1.suggested_agents || data.suggested_agents || [];
    const selectedAgent = suggestedAgents[0] || null;
    const recommendationHint = toAgentHint(agentRecommendation);
    const selectedHint = toAgentHint(selectedAgent);
    const recommendationMeta = toRecommendationMeta(agentRecommendation);
    const matchedSkillNames = normalizeMatchedSkillNames(packet1, c);
    const activeSkill = packet1.skills?.active?.name || packet1.active_skill?.name || null;
    const skillStats = packet1.skills?.routing
        ? {
            use_count: packet1.skills.routing.use_count ?? null,
            decline_count: packet1.skills.routing.decline_count ?? null,
            na_count: packet1.skills.routing.na_count ?? null,
        }
        : null;
    const envelope = {
        schema: 'gmtr.intelligence.envelope.v1',
        source: 'gramatr',
        consumer_instructions: {
            protocol: 'Process this unified contract as authoritative context input.',
            unified: [
                'Use classification + routing_signals to decide immediate response mode.',
                'Use memory_context/search_results directly; do not re-summarize memory with LLM.',
                'Execute required_actions exactly when present.',
            ],
            contract_enforcement: [
                'Execute required_actions as mandatory contract obligations.',
                'Treat behavioral_rules.hard_gates as non-optional constraints.',
            ],
        },
        packet_1: {
            manifest: {
                packet_2_status: packet2Status,
                packet_2_required: packet2State.required,
                enrichment_id: enrichmentId,
            },
            classification: {
                effort_level: c.effort_level || null,
                intent_type: c.intent_type || null,
                confidence: c.confidence ?? null,
                memory_scope: c.memory_scope || routingSignals?.memory_scope || null,
                matched_skills: matchedSkillNames,
                constraints_extracted: c.constraints_extracted || [],
            },
            routing_signals: routingSignals || null,
            classifier_signals: classifierSignals,
            memory_context: memory || null,
            search_results: searchResults || null,
            skills: {
                active: activeSkill,
                matched: matchedSkillNames,
                stats: skillStats,
            },
            agents: {
                recommendation: hasAgentIdentity(recommendationHint) ? recommendationHint : null,
                recommendation_meta: recommendationMeta,
                selected: selectedHint,
                suggested: selectedHint ? [selectedHint] : [],
                suggested_count: suggestedAgents.length,
            },
        },
        packet_2: {
            status: packet2Status,
            required: packet2State.required,
            enrichment_id: enrichmentId,
            fetch_tool: 'gramatr_get_packet_two',
        },
        required_actions: buildRequiredActions(packet2State.required, enrichmentId, normalizeHardGates(packet1.behavioral_rules?.hard_gates || data.behavioral_rules?.hard_gates)),
    };
    return renderContractBlock(envelope);
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
    const packet1 = data.packet_1 || {};
    const c = packet1.classification || data.classification || {};
    const es = packet1.execution_summary || data.execution_summary || {};
    const st = es.stage_timing || {};
    const version = es.server_version ? `v${es.server_version}` : '';
    const classifier = es.classifier_model || 'unknown';
    const confidence = c.confidence ? `${Math.round(c.confidence * 100)}%` : '';
    process.stderr.write(`[grāmatr${version ? ' ' + version : ''}] ✓ ${c.effort_level || '?'}/${c.intent_type || '?'} ${confidence} (${classifier}, ${elapsed}ms)\n`);
    const stages = [];
    if (st.classifier_ms !== undefined)
        stages.push(`classify:${st.classifier_ms}ms`);
    // Backward compat: accept legacy key from older servers
    else if (st.distilbert_ms !== undefined)
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