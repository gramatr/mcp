export const ENTITY_TYPES = ["profile", "voice", "craft", "work_style", "memory", "relationship", "preference", "team_identity", "org_identity", "task", "milestone", "prd", "decision", "steering_rule", "skill", "agent_definition", "playbook", "standard", "reference", "blog_idea", "agent_diary", "session", "conversation", "turn", "classification_record", "agent_execution", "intelligence_packet", "learning_signal", "learning_reflection", "learning_pattern", "learning_correction", "attachment", "execution_record", "model_evaluation", "benchmark", "external_connection", "infrastructure", "audit_log"];
export const ENTITY_TYPE_SET = new Set(ENTITY_TYPES);
export const TOOL_INPUT_RULES = {
    create_entity: [{ field: 'name' }, { field: 'entity_type', validValues: ENTITY_TYPES }, { field: 'project_id' }],
    update_entity: [{ field: 'entity_id' }],
    add_observation: [{ field: 'entity_id' }, { field: 'content' }],
    search_semantic: [{ field: 'query' }],
    search_entities: [],
    create_relation: [{ field: 'source_entity_id' }, { field: 'target_entity_id' }, { field: 'relation_type' }],
    mark_entity_inactive: [{ field: 'entity_id' }],
    mark_observation_inactive: [{ field: 'observation_id' }],
    reactivate_entity: [{ field: 'entity_id' }],
    get_entities: [{ field: 'entity_ids' }],
    list_entities: [],
};
//# sourceMappingURL=schema-constants.js.map