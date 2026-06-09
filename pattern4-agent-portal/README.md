# Pattern 4 Agent Portal

Pro-code portal scaffold for the Databricks + Domo Pattern 4 agent-to-agent demo.

## Current Mode

The app runs locally with mock data until the five Domo Cloud Amplifier datasets are registered from `Databricks Raptor AWS`.

When running inside Domo with dataset aliases mapped, `src/app.js` attempts to fetch:

- `executiveRevenueHealth`
- `customerRenewalRisk`
- `incidentRevenueImpact`
- `agentActionQueue`
- `portalUserScope`

If any fetch fails, the app falls back to mock data.

## Dataset Registration

Register the five Databricks gold views listed in `dataset-mapping.template.json`.

After registration:

1. Fill `dataSetId` values in `manifest.json`.
2. Validate each Domo dataset with `community-domo-cli datasets schema <dataset_id>`.
3. Publish the app with `domo publish`.

## Local Preview

Open `index.html` directly in a browser. It does not need a build step.

## Domo Notes

- The current app is dependency-free: no npm install required.
- Dataset aliases are fixed to the names in `manifest.json`.
- Genie call is currently a placeholder. Wire it to a Domo Workflow/Code Engine endpoint or direct Databricks Genie API proxy after the Genie Space is finalized.
