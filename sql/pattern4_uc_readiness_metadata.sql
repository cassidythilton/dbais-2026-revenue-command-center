COMMENT ON TABLE gold_executive_revenue_health IS 'Pattern 4 executive revenue health gold view. Daily revenue, margin, expansion, churn, and revenue-at-risk metrics by tenant, region, and segment. Source of truth for executive KPI cards and revenue trend analysis in Domo and Genie.';
COMMENT ON TABLE gold_customer_renewal_risk IS 'Pattern 4 customer renewal risk gold view. Account-level renewal risk, risk drivers, revenue at risk, support pressure, usage signals, and recommended retention actions. Source of truth for account triage, Genie root-cause questions, and Domo agent action planning.';
COMMENT ON TABLE gold_incident_revenue_impact IS 'Pattern 4 incident revenue impact gold view. Incident-level root cause, affected accounts, support cases, SLA breaches, sentiment impact, and renewal revenue at risk. Source of truth for the West SEV-1 reliability incident narrative.';
COMMENT ON TABLE gold_agent_action_queue IS 'Pattern 4 agent action queue gold view. Genie-informed Domo agent recommendations, approval state, execution state, workflow cycle time, and expected/actual protected revenue. Source of truth for insight-to-action workflow status.';
COMMENT ON TABLE gold_portal_user_scope IS 'Pattern 4 portal user scope gold view. Demo persona entitlement mapping by tenant, region, account owner, and access level. Source of truth for aligning Unity Catalog row filters and Domo PDP.';

ALTER VIEW gold_executive_revenue_health SET TBLPROPERTIES (
  'domo.ai.context'='Executive revenue health dataset for Pattern 4. Use for questions about net revenue, gross margin, expansion ARR, churned ARR, revenue at risk, fiscal periods, region, segment, and tenant.',
  'domo.ai.synonyms'='revenue health,executive KPIs,ARR,risk exposure,margin,regional revenue',
  'pattern4.domain'='revenue_operations',
  'pattern4.plane'='gold_semantic_layer',
  'domo.dataset.alias'='executiveRevenueHealth'
);
ALTER VIEW gold_customer_renewal_risk SET TBLPROPERTIES (
  'domo.ai.context'='Customer renewal risk dataset for Pattern 4. Use for account triage, risk tiers, renewal risk scores, top risk drivers, support pressure, usage drops, and recommended retention actions.',
  'domo.ai.synonyms'='renewal risk,churn risk,account health,risk driver,customer health,retention action',
  'pattern4.domain'='customer_success',
  'pattern4.plane'='gold_semantic_layer',
  'domo.dataset.alias'='customerRenewalRisk'
);
ALTER VIEW gold_incident_revenue_impact SET TBLPROPERTIES (
  'domo.ai.context'='Incident revenue impact dataset for Pattern 4. Use for root-cause analysis of incidents, affected accounts, SLA breaches, support case spikes, customer impact, and renewal revenue at risk.',
  'domo.ai.synonyms'='incident impact,root cause,SLA breach,support spike,reliability incident,SEV-1',
  'pattern4.domain'='incident_response',
  'pattern4.plane'='gold_semantic_layer',
  'domo.dataset.alias'='incidentRevenueImpact'
);
ALTER VIEW gold_agent_action_queue SET TBLPROPERTIES (
  'domo.ai.context'='Agent action queue dataset for Pattern 4. Use for questions about recommended actions, approvals, execution status, workflows, protected revenue, and agent-to-agent business execution.',
  'domo.ai.synonyms'='agent actions,workflow queue,approval status,execution status,protected revenue,human approval',
  'pattern4.domain'='agentic_action',
  'pattern4.plane'='gold_semantic_layer',
  'domo.dataset.alias'='agentActionQueue'
);
ALTER VIEW gold_portal_user_scope SET TBLPROPERTIES (
  'domo.ai.context'='Portal user scope dataset for Pattern 4. Use for persona scoping, tenant access, region access, account-owner access, and alignment between Unity Catalog row filters and Domo PDP.',
  'domo.ai.synonyms'='persona,entitlement,user scope,PDP,row filter,access level',
  'pattern4.domain'='governance',
  'pattern4.plane'='gold_semantic_layer',
  'domo.dataset.alias'='portalUserScope'
);
