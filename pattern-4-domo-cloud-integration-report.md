# Sprint 2 Domo Cloud Integration Report

## Summary

Domo API access is valid for `databricks-demo`, and Domo can query existing Databricks-backed federated datasets. The requested `Databricks Raptor AWS` integration is visible as a DATABRICKS Cloud Amplifier integration, but the available public/API surfaces do not expose a supported way to programmatically create new Cloud Amplifier datasets from Databricks tables/views.

## Confirmed

- Domo instance: `https://databricks-demo.domo.com/`
- Auth mode: Ryuu session through `community-domo-cli`
- Cloud Amplifier integration:
  - Name: `Databricks Raptor AWS`
  - ID: `a83b5bbc-fc3f-43c0-8ea5-f15117de997d`
  - Type: `DATABRICKS`
  - Auth method: `PERSONAL_ACCESS_TOKEN`
- Existing Databricks Cloud Amplifier integrations are visible through:
  - `GET /api/query/migration/integrations/databricks`
- Existing Databricks-backed Domo datasets can be queried through:
  - `POST /api/query/v1/execute/{dataset_id}`

## Known-Good Federated Dataset Test

Tested existing Domo dataset:

- Dataset: `samples.bakehouse.sales_customers`
- Dataset ID: `0267021c-2604-492b-a49a-47c5bfb2e41d`
- Cloud integration: `Braxton Integration`
- Cloud ID: `9880e0a1-be2e-4ca5-9fcd-04f4141a4a5c`
- Result: Domo SQL query succeeded.

This proves Domo can execute live/federated Databricks-backed dataset queries when the dataset is already registered.

## Raptor Integration Probe

The `Databricks Raptor AWS` integration appears in the Cloud Amplifier integration list:

```json
{
  "id": "a83b5bbc-fc3f-43c0-8ea5-f15117de997d",
  "name": "Databricks Raptor AWS",
  "type": "DATABRICKS",
  "authMethod": "PERSONAL_ACCESS_TOKEN"
}
```

Read-only migration probes:

- `GET /api/query/migration/integrations/types` returned `DATABRICKS` and `POSTGRES`.
- `GET /api/query/migration/candidates/federated/to/amplifier/integrations/a83b5bbc-fc3f-43c0-8ea5-f15117de997d` returned a 400 response stating DATABRICKS is not supported for that migration path.
- `GET /api/query/migration/candidates/amplifier/to/federated/integrations/a83b5bbc-fc3f-43c0-8ea5-f15117de997d` returned an empty list.

## Required Domo DataSets

Register these Databricks views as Domo Cloud Amplifier datasets:

| Domo Alias | Databricks Object | Purpose |
| --- | --- | --- |
| `executiveRevenueHealth` | `databricks_raptor.pattern4_agent_automation.gold_executive_revenue_health` | KPI strip and regional trend. |
| `customerRenewalRisk` | `databricks_raptor.pattern4_agent_automation.gold_customer_renewal_risk` | Account triage and risk table. |
| `incidentRevenueImpact` | `databricks_raptor.pattern4_agent_automation.gold_incident_revenue_impact` | Incident root-cause panel. |
| `agentActionQueue` | `databricks_raptor.pattern4_agent_automation.gold_agent_action_queue` | Agent action status and approvals. |
| `portalUserScope` | `databricks_raptor.pattern4_agent_automation.gold_portal_user_scope` | Persona/PDP testing and portal scope. |

Recommended Domo dataset names:

- `Pattern 4 | Executive Revenue Health`
- `Pattern 4 | Customer Renewal Risk`
- `Pattern 4 | Incident Revenue Impact`
- `Pattern 4 | Agent Action Queue`
- `Pattern 4 | Portal User Scope`

## Manual Registration Steps

Use the Domo UI:

1. Open Data Center.
2. Go to Data Warehouse / Cloud Integrations.
3. Select `Databricks`.
4. Open `Databricks Raptor AWS`.
5. Choose tables/views to connect.
6. Find catalog `databricks_raptor`.
7. Select schema `pattern4_agent_automation`.
8. Select the five `gold_*` views listed above.
9. Create Domo datasets using the recommended names.
10. Share or grant access to the build user if needed.

## Follow-Up After Registration

After the five Domo datasets exist, run:

```bash
DOMO_INSTANCE=databricks-demo DOMO_AUTH_MODE=ryuu-session community-domo-cli datasets list
```

Then validate each dataset:

```bash
DOMO_INSTANCE=databricks-demo DOMO_AUTH_MODE=ryuu-session community-domo-cli datasets schema <dataset_id>
DOMO_INSTANCE=databricks-demo DOMO_AUTH_MODE=ryuu-session community-domo-cli datasets sql <dataset_id> --body '{"sql":"select * from dataset limit 5"}'
```

Once dataset IDs are known, update the project manifest/mapping and build the first dashboard cards.
