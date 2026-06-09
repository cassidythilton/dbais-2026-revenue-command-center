CREATE TABLE IF NOT EXISTS agent_action_writeback (
  writeback_id STRING,
  action_id STRING,
  decision STRING,
  execution_status STRING,
  approved_by STRING,
  note STRING,
  persona STRING,
  source_app STRING,
  created_ts TIMESTAMP
)
USING DELTA
COMMENT 'Pattern 4 Domo-to-Databricks writeback table for approved agent actions, execution state, and user/persona audit context.';

ALTER TABLE agent_action_writeback SET TBLPROPERTIES (
  'pattern4.domain'='agentic_action_writeback',
  'pattern4.plane'='domo_to_unity_catalog_writeback',
  'domo.ai.context'='Domo agent action writeback table. Use to audit approved or rejected recommendations, workflow execution status, approver identity, persona, and source app.'
);
