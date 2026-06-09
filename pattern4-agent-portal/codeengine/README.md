# Pattern 4 Code Engine package (`pattern4ce`)

The portal uses the **proven deal-inspect pattern**: a single Code Engine package whose
**Domo package name equals the manifest `proxyId`** (`pattern4ce`). The app calls
`domo.post('/domo/codeengine/v2/packages/<functionName>', args)` and Domo routes to this
package via `proxyId` — the package id/version are NOT in the URL or the manifest.

## Why the old setup failed

The previous manifest used `packagesMapping` (plural) with `packageId`/`version`/`functionName`.
That binding only lives in a per-card **context**, which is created at card-instantiation time and
is NOT updated by `domo publish`. Existing cards (and App Studio embeds) therefore never resolved
the package aliases, so calls failed before reaching Code Engine (no logs). The `proxyId` +
singular `packageMapping` pattern resolves at runtime by package name and avoids this.

## Deploy steps

1. In Domo, open **Code Engine** and create a **new package named exactly `pattern4ce`**
   (the name must match `manifest.json` `proxyId`).
2. Paste the contents of `functions.js` into the package code.
3. Set `DATABRICKS_TOKEN` at the top of the file to your Databricks PAT
   (same token as the local `databricks token` file). Keep it server-side; never commit it.
4. Confirm the package exposes these functions with these inputs (the editor's function form must match):
   - `askGenie(question, conversationId, persona, model)` → object
   - `writeActionStatus(actionId, decision, executionStatus, approvedBy, note, persona)` → object
   - (`runSql`, `sqlString` are internal helpers)
5. **Release** the package (v1.0.0).
6. Re-publish the app:  `cd pattern4-agent-portal && domo publish`
7. **Re-instantiate the card** so it binds the new proxy:
   - App Studio: remove and re-add the **Pattern 4 Agent Portal** app to the view.
8. Reload and ask Genie. Expect the **"Databricks Genie · live"** badge and a real CE log entry.
   Then Execute a pending action and confirm a row in
   `databricks_raptor.pattern4_agent_automation.agent_action_writeback`.

## Reusing existing code instead

If you prefer to reuse the already-tested code from the two existing packages, just copy
`askGenie` (+ its helpers) and `writeActionStatus` (+ its helpers) into the single `pattern4ce`
package. The only hard requirement is: one package, named `pattern4ce`, exposing `askGenie` and
`writeActionStatus`.
