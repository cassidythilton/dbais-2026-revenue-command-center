/*
 * Pattern 4 Code Engine package  (Domo package name MUST be: pattern4ce)
 * ---------------------------------------------------------------------------
 * This single package backs the Pattern 4 Agent Portal. The app manifest
 * (proxyId: "pattern4ce") routes domo.post('/domo/codeengine/v2/packages/<fn>')
 * to the functions below by name.
 *
 * Exposed functions (must match manifest.json packageMapping aliases):
 *   - askGenie(question, conversationId, persona, model)
 *   - writeActionStatus(actionId, decision, executionStatus, approvedBy, note, persona)
 *   - listScenarios()
 *   - createScenario(name, status, createdBy, assumptions, results)
 *   - updateScenario(id, name, status, createdBy, assumptions, results)
 *   - deleteScenario(id)
 *   - listPredictionFeedback()
 *   - savePredictionFeedback(predictionId, entityType, entityId, feedback, predictedValue, correctedValue, comment, createdBy)
 *   - runModelInference(records)
 *   - getUcReadinessState(tableName)
 *   - getDomoAiReadiness(datasetId)
 *   - syncDomoAiReadiness(datasetId, desiredState, columns)
 *   - wipeDomoAiReadiness(datasetId, columns)
 *   - updateUcColumnContext(tableName, columnName, context, synonyms, aiEnabled, updatedBy)
 *
 * SETUP: paste your Databricks PAT into DATABRICKS_TOKEN below (same token as
 * the local `databricks token` file). Do NOT commit a real token to git.
 * Written with conservative ES5-style syntax for the Code Engine editor.
 */

var axios = require("axios");
/* NOTE: Domo Code Engine does not provide the 'pg' module. Postgres access is
 * handled by a self-contained, lazily-evaluated bundle inside lakebaseQuery()
 * (see the LAKEBASE_PG_BUNDLE base64 blob). Never add a top-level require("pg"):
 * it throws MODULE_NOT_FOUND at load and crashes EVERY function in the package. */

var DATABRICKS_HOST = "https://dbc-0516e56c-ba3e.cloud.databricks.com";
var DATABRICKS_TOKEN = "REPLACE_WITH_DATABRICKS_TOKEN";
var DOMO_INSTANCE = "https://databricks-demo.domo.com";
var DOMO_DEVELOPER_TOKEN = "REPLACE_WITH_DOMO_DEVELOPER_TOKEN";
var GENIE_SPACE_ID = "01f1642295b61d6b8849e106f52fc781";
var WAREHOUSE_ID = "ea829ba58bcae093";
var CATALOG = "databricks_raptor";
var SCHEMA = "pattern4_agent_automation";
var WRITEBACK_TABLE = "agent_action_writeback";
var MODEL_SERVING_ENDPOINT = "pattern4-renewal-risk";
/* Unity AI Gateway-governed LLM reasoning endpoint (external-model wrapper over a
 * foundation model). AI Gateway enforces usage tracking, rate limits, guardrails
 * (input safety + PII BLOCK / output safety + PII MASK), and inference-table audit. */
var REASONING_ENDPOINT = "pattern4-reasoning-gateway";
/* Databricks Agent Bricks Supervisor Agent (MAS) — "Pattern 4 Retention Supervisor".
 * Orchestrates the Pattern 4 Genie Space (governed NL->SQL over the gold views) to
 * reason about an at-risk account and recommend a retention action. Served at an
 * agent/v1/responses endpoint. This is the Databricks-side agent that the Domo
 * workflow AI agent tile calls (agent-to-agent). */
var RETENTION_AGENT_ENDPOINT = "mas-77bd204b-endpoint";
/* Live Domo Workflow (Renewal Risk Retention). Shape A: the app starts this
 * governed workflow server-side via the product API; the workflow routes a human
 * approval, then its service task calls writeActionStatus to write status back. */
var WORKFLOW_MODEL_ID = "6cbd5ecb-1036-410a-b188-60a49820d264";
var WORKFLOW_VERSION = "1.0.3";  // fallback only; startRetentionWorkflow resolves the active version dynamically
var WORKFLOW_START_MESSAGE = "Start Pattern 4 - Renewal Risk Retention";
/* Approval queue for the Renewal Risk Retention userTask. The in-app Approvals tab
 * lists these tasks and completes them (Approve/Reject) so the loop stays in-app. */
var APPROVAL_QUEUE_ID = "55c37364-de76-47a3-8ba6-b5415e063e58";
/* Lakebase connectivity (host/db/endpoint/M2M auth) is fully self-contained
 * inside the bundled lakebaseQuery() implementation below. */

function dbxHeaders() {
  return {
    Authorization: "Bearer " + DATABRICKS_TOKEN,
    "Content-Type": "application/json"
  };
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/* ----------------------------- Databricks SQL ----------------------------- */

function runSql(statement) {
  console.log("[pattern4ce.runSql] start", JSON.stringify({ statementPreview: String(statement || "").slice(0, 180) }));
  var url = DATABRICKS_HOST + "/api/2.0/sql/statements";
  var body = {
    warehouse_id: WAREHOUSE_ID,
    catalog: CATALOG,
    schema: SCHEMA,
    statement: statement,
    wait_timeout: "30s"
  };
  return axios.post(url, body, { headers: dbxHeaders() }).then(function (resp) {
    var data = resp.data || {};
    var state = data.status && data.status.state ? data.status.state : "";
    var statementId = data.statement_id;
    console.log("[pattern4ce.runSql] submitted", JSON.stringify({ statementId: statementId, state: state }));
    function poll() {
      if (state === "SUCCEEDED" || state === "FAILED" || state === "CANCELED" || state === "") {
        console.log("[pattern4ce.runSql] finished", JSON.stringify({ statementId: statementId, state: state }));
        return Promise.resolve(data);
      }
      return sleep(2000)
        .then(function () {
          return axios.get(url + "/" + statementId, { headers: dbxHeaders() });
        })
        .then(function (r) {
          data = r.data || {};
          state = data.status && data.status.state ? data.status.state : "";
          return poll();
        });
    }
    if (state === "PENDING" || state === "RUNNING") {
      return poll();
    }
    return data;
  });
}

function sqlString(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function parseMaybeJson(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function identifierPart(value) {
  return String(value || "").replace(/`/g, "``");
}

function quotedTableName(fullName) {
  return String(fullName || "")
    .split(".")
    .map(function (part) { return "`" + identifierPart(part) + "`"; })
    .join(".");
}

function runSqlChecked(statement) {
  return runSql(statement).then(function (data) {
    var state = data.status && data.status.state ? data.status.state : "SUCCEEDED";
    if (state === "FAILED") {
      var detail = data.status && data.status.error ? data.status.error : "SQL failed";
      return Promise.reject(detail);
    }
    return data;
  });
}

function resolveDomoDeveloperToken() {
  if (!DOMO_DEVELOPER_TOKEN || DOMO_DEVELOPER_TOKEN.indexOf("REPLACE_WITH") === 0) {
    return Promise.reject("DOMO_DEVELOPER_TOKEN is not configured in Code Engine");
  }
  return Promise.resolve(DOMO_DEVELOPER_TOKEN);
}

function domoHeaders(domoToken) {
  return {
    "X-DOMO-Developer-Token": domoToken,
    "Content-Type": "application/json;charset=utf-8",
    "accept": "application/json, text/plain, */*"
  };
}

function domoApi(method, path, body) {
  return resolveDomoDeveloperToken().then(function (domoToken) {
    return axios({
      method: method,
      url: DOMO_INSTANCE + path,
      headers: domoHeaders(domoToken),
      data: body || undefined,
      timeout: 30000
    }).then(function (resp) {
      return resp.data;
    });
  });
}

function normalizeDomoReadiness(raw) {
  var payload = raw;
  if (Array.isArray(payload)) {
    payload = payload[0] || {};
  }
  var dict = payload.dataDictionary || payload;
  var columns = dict.columns || [];
  return {
    id: dict.id || "",
    datasetId: dict.datasetId || "",
    name: dict.name || "",
    description: dict.description || "",
    unitOfAnalysis: dict.unitOfAnalysis || "",
    columns: columns.map(function (col) {
      return {
        name: col.name,
        description: col.description || "",
        synonyms: col.synonyms || [],
        agentEnabled: !!col.agentEnabled,
        sampleValues: col.sampleValues || [],
        subType: col.subType || null,
        beastmodeId: col.beastmodeId || null
      };
    })
  };
}

function getDomoDatasetInfo(datasetId) {
  return domoApi("GET", "/api/data/v3/datasources/" + datasetId);
}

function getDomoDatasetSchema(datasetId) {
  return domoApi("GET", "/api/query/v1/datasources/" + datasetId + "/schema/indexed?includeHidden=true");
}

function getDomoAiReadiness(datasetId) {
  return domoApi("GET", "/api/ai/readiness/v1/data-dictionary/dataset/" + datasetId)
    .then(function (data) {
      return { status: "SUCCEEDED", readiness: normalizeDomoReadiness(data) };
    })
    .catch(function (err) {
      var status = err && err.response && err.response.status ? err.response.status : "";
      if (status === 404) {
        return { status: "SUCCEEDED", readiness: { datasetId: datasetId, columns: [] }, notFound: true };
      }
      return { status: "FAILED", error: err && err.response && err.response.data ? err.response.data : String(err) };
    });
}

function buildReadinessBaseline(datasetId, datasetInfo, schemaInfo, existing) {
  var table = schemaInfo && schemaInfo.tables && schemaInfo.tables[0] ? schemaInfo.tables[0] : { columns: [] };
  var existingByName = {};
  (existing && existing.columns ? existing.columns : []).forEach(function (col) {
    existingByName[col.name] = col;
  });
  var baseline = {
    datasetId: datasetId,
    name: datasetInfo && datasetInfo.name ? datasetInfo.name : (existing && existing.name ? existing.name : datasetId),
    description: existing && existing.description ? existing.description : "",
    unitOfAnalysis: existing && existing.unitOfAnalysis ? existing.unitOfAnalysis : "",
    columns: (table.columns || []).map(function (col) {
      var current = existingByName[col.name] || {};
      return {
        name: col.name,
        description: current.description || "",
        synonyms: current.synonyms || [],
        subType: current.subType || null,
        agentEnabled: !!current.agentEnabled,
        sampleValues: current.sampleValues || [],
        beastmodeId: current.beastmodeId || null
      };
    })
  };
  if (existing && existing.id) {
    baseline.id = existing.id;
  }
  return baseline;
}

function selectedColumnSet(columns) {
  var parsed = parseMaybeJson(columns, []);
  if (!Array.isArray(parsed)) return {};
  var out = {};
  parsed.forEach(function (col) {
    if (typeof col === "string") out[col] = true;
    else if (col && col.name) out[col.name] = true;
  });
  return out;
}

function readinessDetail(err) {
  try {
    if (err && err.response && err.response.data) {
      var data = err.response.data;
      return typeof data === "string" ? data : JSON.stringify(data);
    }
  } catch (ignore) {}
  if (err && err.message) return err.message;
  try {
    return String(err);
  } catch (ignore2) {
    return "Unknown error";
  }
}

function readinessColumnsFromExisting(existing) {
  return (existing && existing.columns ? existing.columns : []).map(function (col) {
    return {
      name: col.name,
      description: col.description || "",
      synonyms: col.synonyms || [],
      subType: col.subType || null,
      agentEnabled: !!col.agentEnabled,
      sampleValues: col.sampleValues || [],
      beastmodeId: col.beastmodeId || null
    };
  });
}

function baselineFromExisting(datasetId, existing) {
  var baseline = {
    datasetId: datasetId,
    name: existing && existing.name ? existing.name : datasetId,
    description: existing && existing.description ? existing.description : "",
    unitOfAnalysis: existing && existing.unitOfAnalysis ? existing.unitOfAnalysis : "",
    columns: readinessColumnsFromExisting(existing)
  };
  if (existing && existing.id) baseline.id = existing.id;
  return baseline;
}

function saveDomoReadiness(datasetId, payload) {
  var method = payload.id ? "PUT" : "POST";
  return domoApi(method, "/api/ai/readiness/v1/data-dictionary/dataset/" + datasetId, payload)
    .catch(function (err) {
      var status = err && err.response && err.response.status ? err.response.status : "";
      if (method === "POST" && status === 409) {
        return getDomoAiReadiness(datasetId).then(function (existingResp) {
          if (existingResp && existingResp.readiness && existingResp.readiness.id) {
            payload.id = existingResp.readiness.id;
            return domoApi("PUT", "/api/ai/readiness/v1/data-dictionary/dataset/" + datasetId, payload);
          }
          throw err;
        });
      }
      throw err;
    });
}

/* ------------------------------ Lakebase PG ------------------------------- */

/* lakebaseQuery: self-contained Postgres client for the cobra-v1 Lakebase.
 * The implementation (node-postgres + OAuth M2M credential exchange to the
 * cobra-v1 endpoint) is bundled as base64 and lazily evaluated on first call,
 * so the package never depends on Domo CE providing a 'pg' module. Ported from
 * the released LakebaseQuery package (55a6749a v1.0.3). Returns
 * { rows, rowCount, fields } on success or { error, rows, rowCount } on failure. */
var LAKEBASE_PG_BUNDLE = "__LAKEBASE_PG_BUNDLE_B64__";
var _lakebaseImpl = null;

function lakebaseQuery(sql, params) {
  if (!_lakebaseImpl) {
    var _m = { exports: {} };
    new Function("exports", "require", "module", Buffer.from(LAKEBASE_PG_BUNDLE, "base64").toString())(_m.exports, require, _m);
    _lakebaseImpl = _m.exports.lakebaseQuery;
  }
  return Promise.resolve(_lakebaseImpl(sql, params));
}

function listScenarios(limit) {
  // `limit` is required so Domo registers a proxy route (zero-parameter functions are
  // not routed and 404). Validated to a safe integer, so concatenation cannot inject.
  var lim = Number(limit);
  if (!(lim > 0 && lim <= 500)) lim = 50;
  return lakebaseQuery(
    "SELECT id, name, created_by, status, assumptions, results, baseline_id, created_at, updated_at FROM public.p4_scenario_runs ORDER BY created_at DESC LIMIT " + lim,
    []
  );
}

function createScenario(name, status, createdBy, assumptions, results) {
  return lakebaseQuery(
    "INSERT INTO public.p4_scenario_runs (name, status, created_by, assumptions, results) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb) RETURNING *",
    [name, status || "draft", createdBy || "demo.user@domo.com", JSON.stringify(assumptions || {}), JSON.stringify(results || {})]
  );
}

function updateScenario(id, name, status, createdBy, assumptions, results) {
  return lakebaseQuery(
    "UPDATE public.p4_scenario_runs SET name = $2, status = $3, created_by = $4, assumptions = $5::jsonb, results = $6::jsonb, updated_at = now() WHERE id = $1 RETURNING *",
    [Number(id), name, status || "draft", createdBy || "demo.user@domo.com", JSON.stringify(assumptions || {}), JSON.stringify(results || {})]
  );
}

function deleteScenario(id) {
  return lakebaseQuery("DELETE FROM public.p4_scenario_runs WHERE id = $1 RETURNING id", [Number(id)]);
}

function listPredictionFeedback(limit) {
  // `limit` is required so Domo registers a proxy route (zero-parameter functions are
  // not routed and 404). Validated to a safe integer, so concatenation cannot inject.
  var lim = Number(limit);
  if (!(lim > 0 && lim <= 500)) lim = 50;
  return lakebaseQuery(
    "SELECT id, prediction_id, entity_type, entity_id, feedback, predicted_value, corrected_value, comment, created_by, created_at FROM public.p4_prediction_feedback ORDER BY created_at DESC LIMIT " + lim,
    []
  );
}

function savePredictionFeedback(predictionId, entityType, entityId, feedback, predictedValue, correctedValue, comment, createdBy) {
  return lakebaseQuery(
    "INSERT INTO public.p4_prediction_feedback (prediction_id, entity_type, entity_id, feedback, predicted_value, corrected_value, comment, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    [
      predictionId || "manual",
      entityType || "account",
      entityId || "unknown",
      feedback || "accept",
      predictedValue === null || predictedValue === undefined ? null : Number(predictedValue),
      correctedValue === null || correctedValue === undefined ? null : Number(correctedValue),
      comment || "",
      createdBy || "demo.user@domo.com"
    ]
  );
}

// STAGED (not released): enables full edit/delete of prediction-feedback rows from the
// Lakebase explorer. Lands on the next approved pattern4ce release; the app keeps the
// feedback edit/delete controls disabled until then.
function updatePredictionFeedback(id, entityId, feedback, predictedValue, correctedValue, comment, createdBy) {
  return lakebaseQuery(
    "UPDATE public.p4_prediction_feedback SET entity_id = $2, feedback = $3, predicted_value = $4, corrected_value = $5, comment = $6, created_by = $7 WHERE id = $1 RETURNING *",
    [
      Number(id),
      entityId || "unknown",
      feedback || "accept",
      predictedValue === null || predictedValue === undefined ? null : Number(predictedValue),
      correctedValue === null || correctedValue === undefined ? null : Number(correctedValue),
      comment || "",
      createdBy || "demo.user@domo.com"
    ]
  );
}

function deletePredictionFeedback(id) {
  return lakebaseQuery("DELETE FROM public.p4_prediction_feedback WHERE id = $1 RETURNING id", [Number(id)]);
}

/* -------------------------- AI Readiness sync ----------------------------- */

function getUcReadinessState(tableName) {
  var fullName = String(tableName || "");
  var parts = fullName.split(".");
  var catalog = parts[0] || CATALOG;
  var schema = parts[1] || SCHEMA;
  var table = parts[2] || "";
  var tableUrl = DATABRICKS_HOST + "/api/2.1/unity-catalog/tables/" + encodeURIComponent(fullName);
  var tagsSql =
    "SELECT column_name, tag_name, tag_value FROM system.information_schema.column_tags " +
    "WHERE catalog_name = " + sqlString(catalog) +
    " AND schema_name = " + sqlString(schema) +
    " AND table_name = " + sqlString(table);
  var tableInfo;
  return axios.get(tableUrl, { headers: dbxHeaders() })
    .then(function (resp) {
      tableInfo = resp.data || {};
      return runSqlChecked(tagsSql);
    })
    .then(function (tagResp) {
      var tagColumns = tagResp.manifest && tagResp.manifest.schema && tagResp.manifest.schema.columns ? tagResp.manifest.schema.columns : [];
      var tagRows = tagResp.result && tagResp.result.data_array ? tagResp.result.data_array : [];
      var tagMap = {};
      tagRows.forEach(function (row) {
        var col = row[0];
        var key = row[1];
        var value = row[2];
        if (!tagMap[col]) tagMap[col] = [];
        tagMap[col].push({ key: key, value: value });
      });
      var properties = tableInfo.properties || {};
      return {
        status: "SUCCEEDED",
        tableName: fullName,
        comment: tableInfo.comment || "",
        properties: properties,
        columns: (tableInfo.columns || []).map(function (col) {
          var tags = tagMap[col.name] || [];
          var synonyms = [];
          tags.forEach(function (tag) {
            if (tag.key === "domo.ai.synonym" || tag.key === "domo_ai_synonym") synonyms.push(tag.value);
          });
          return {
            name: col.name,
            type: col.type_name || col.type_text || col.type_json || "",
            context: col.comment || "",
            synonyms: synonyms,
            tags: tags,
            aiEnabled: tags.some(function (tag) { return tag.key === "domo_ai_ready" && String(tag.value) === "true"; }) || !!col.comment
          };
        })
      };
    })
    .catch(function (err) {
      var detail = err && err.response && err.response.data ? err.response.data : err && err.message ? err.message : String(err);
      console.error("[pattern4ce.getUcReadinessState] failed", JSON.stringify({ tableName: fullName, error: detail }));
      return { status: "FAILED", error: detail, tableName: fullName };
    });
}

function syncDomoAiReadiness(datasetId, desiredState, columns) {
  var desired = parseMaybeJson(desiredState, {});
  var selected = selectedColumnSet(columns);
  var desiredByName = {};
  (desired.columns || []).forEach(function (col) { desiredByName[col.name] = col; });
  function applyAndSave(baseline) {
    baseline.description = desired.context || desired.datasetContext || baseline.description || "";
    baseline.columns = baseline.columns.map(function (col) {
      var shouldSync = !Object.keys(selected).length || selected[col.name];
      var desiredCol = desiredByName[col.name];
      if (shouldSync && desiredCol) {
        return {
          name: col.name,
          description: desiredCol.context || desiredCol.description || "",
          synonyms: desiredCol.synonyms || [],
          subType: col.subType || null,
          agentEnabled: desiredCol.aiEnabled !== false,
          sampleValues: col.sampleValues || [],
          beastmodeId: col.beastmodeId || null
        };
      }
      return col;
    });
    return saveDomoReadiness(datasetId, baseline);
  }
  return getDomoAiReadiness(datasetId)
    .then(function (readinessResp) {
      var existing = readinessResp.readiness || { columns: [] };
      // Common path: the dictionary already lists every column, so reuse it and
      // avoid extra round-trips to the (slow/flaky) dataset-info + schema APIs.
      if (existing.columns && existing.columns.length) {
        return applyAndSave(baselineFromExisting(datasetId, existing));
      }
      // First-time creation only: enumerate columns from dataset schema.
      var datasetInfo;
      return getDomoDatasetInfo(datasetId)
        .then(function (info) { datasetInfo = info || {}; return getDomoDatasetSchema(datasetId); })
        .then(function (schema) {
          return applyAndSave(buildReadinessBaseline(datasetId, datasetInfo, schema || {}, existing));
        });
    })
    .then(function (result) {
      return { status: "SUCCEEDED", readiness: normalizeDomoReadiness(result), datasetId: datasetId };
    })
    .catch(function (err) {
      var detail = readinessDetail(err);
      try { console.error("[pattern4ce.syncDomoAiReadiness] failed", JSON.stringify({ datasetId: datasetId, error: detail })); } catch (ignore) {}
      return { status: "FAILED", error: detail, datasetId: datasetId };
    });
}

function wipeDomoAiReadiness(datasetId, columns) {
  var selected = selectedColumnSet(columns);
  function applyAndSave(baseline) {
    var wipeAll = !Object.keys(selected).length;
    if (wipeAll) baseline.description = "";
    baseline.columns = baseline.columns.map(function (col) {
      if (wipeAll || selected[col.name]) {
        return {
          name: col.name,
          description: "",
          synonyms: [],
          subType: col.subType || null,
          agentEnabled: false,
          sampleValues: col.sampleValues || [],
          beastmodeId: col.beastmodeId || null
        };
      }
      return col;
    });
    return saveDomoReadiness(datasetId, baseline);
  }
  return getDomoAiReadiness(datasetId)
    .then(function (readinessResp) {
      var existing = readinessResp.readiness || { columns: [] };
      if (existing.columns && existing.columns.length) {
        return applyAndSave(baselineFromExisting(datasetId, existing));
      }
      var datasetInfo;
      return getDomoDatasetInfo(datasetId)
        .then(function (info) { datasetInfo = info || {}; return getDomoDatasetSchema(datasetId); })
        .then(function (schema) {
          return applyAndSave(buildReadinessBaseline(datasetId, datasetInfo, schema || {}, existing));
        });
    })
    .then(function (result) {
      return { status: "SUCCEEDED", readiness: normalizeDomoReadiness(result), datasetId: datasetId };
    })
    .catch(function (err) {
      var detail = readinessDetail(err);
      try { console.error("[pattern4ce.wipeDomoAiReadiness] failed", JSON.stringify({ datasetId: datasetId, error: detail })); } catch (ignore) {}
      return { status: "FAILED", error: detail, datasetId: datasetId };
    });
}

function updateUcColumnContext(tableName, columnName, context, synonyms, aiEnabled, updatedBy) {
  var full = quotedTableName(tableName);
  var col = "`" + identifierPart(columnName) + "`";
  var cleanContext = context || "";
  var parsedSynonyms = parseMaybeJson(synonyms, []);
  if (!Array.isArray(parsedSynonyms)) parsedSynonyms = [];
  var stmts = [
    "COMMENT ON COLUMN " + full + "." + col + " IS " + sqlString(cleanContext),
    "ALTER TABLE " + full + " ALTER COLUMN " + col + " SET TAGS ('domo_ai_ready' = " + sqlString(aiEnabled === false ? "false" : "true") + ")",
    "ALTER TABLE " + full + " ALTER COLUMN " + col + " SET TAGS ('domo_ai_synonyms' = " + sqlString(parsedSynonyms.join(",")) + ")",
    "ALTER TABLE " + full + " ALTER COLUMN " + col + " SET TAGS ('domo_ai_updated_by' = " + sqlString(updatedBy || "Pattern 4 Revenue Command Center") + ")"
  ];
  var chain = Promise.resolve();
  stmts.forEach(function (stmt) {
    chain = chain.then(function () { return runSqlChecked(stmt); });
  });
  return chain
    .then(function () {
      return getUcReadinessState(tableName);
    })
    .catch(function (err) {
      var detail = err && err.message ? err.message : String(err);
      console.error("[pattern4ce.updateUcColumnContext] failed", JSON.stringify({ tableName: tableName, columnName: columnName, error: detail }));
      return { status: "FAILED", error: detail, tableName: tableName, columnName: columnName };
    });
}

/* ---------------------------- Model inference ----------------------------- */

function normalizeInferenceRecords(records) {
  var source = records;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch (err) {
      source = [];
    }
  }
  if (!Array.isArray(source)) {
    source = source ? [source] : [];
  }
  var required = [
    "segment",
    "region",
    "industry",
    "annual_recurring_revenue",
    "cases_90d",
    "sla_breaches_90d",
    "negative_cases_90d",
    "avg_usage_score_90d",
    "usage_drop_days_90d",
    "days_to_renewal"
  ];
  var normalized = [];
  for (var i = 0; i < source.length; i++) {
    var row = source[i] || {};
    var next = {};
    for (var r = 0; r < required.length; r++) {
      var key = required[r];
      if (key === "segment" || key === "region" || key === "industry") {
        next[key] = row[key] === null || row[key] === undefined ? "" : String(row[key]);
      } else {
        next[key] = row[key] === null || row[key] === undefined || row[key] === "" ? null : Number(row[key]);
      }
    }
    normalized.push(next);
  }
  return normalized;
}

function normalizeModelServingPredictions(predictions) {
  var normalized = [];
  for (var i = 0; i < (predictions || []).length; i++) {
    var value = predictions[i];
    if (Array.isArray(value)) {
      normalized.push(Number(value.length > 1 ? value[1] : value[0]));
    } else if (value && typeof value === "object" && value.probability !== undefined) {
      normalized.push(Number(value.probability));
    } else {
      normalized.push(Number(value));
    }
  }
  return normalized;
}

function runModelInference(records) {
  var normalized = normalizeInferenceRecords(records);
  console.log("[pattern4ce.runModelInference] start", JSON.stringify({
    endpoint: MODEL_SERVING_ENDPOINT,
    recordCount: normalized.length
  }));
  if (!normalized.length) {
    return Promise.resolve({ status: "FAILED", error: "No records supplied for inference", predictions: [] });
  }
  var url = DATABRICKS_HOST + "/serving-endpoints/" + MODEL_SERVING_ENDPOINT + "/invocations";
  return axios
    .post(
      url,
      { dataframe_records: normalized },
      { headers: dbxHeaders(), timeout: 30000 }
    )
    .then(function (resp) {
      var data = resp.data || {};
      var rawPredictions = data.predictions || [];
      var predictions = normalizeModelServingPredictions(rawPredictions);
      console.log("[pattern4ce.runModelInference] success", JSON.stringify({
        endpoint: MODEL_SERVING_ENDPOINT,
        predictionCount: predictions.length
      }));
      return {
        status: "SUCCEEDED",
        endpoint: MODEL_SERVING_ENDPOINT,
        predictions: predictions,
        rawPredictions: rawPredictions,
        records: normalized,
        governedBy: "MLflow Unity Catalog model + Databricks Model Serving + Domo Code Engine"
      };
    })
    .catch(function (err) {
      var detail = err && err.response && err.response.data ? err.response.data : err && err.message ? err.message : String(err);
      console.error("[pattern4ce.runModelInference] failed", JSON.stringify({ endpoint: MODEL_SERVING_ENDPOINT, error: detail }));
      return { status: "FAILED", endpoint: MODEL_SERVING_ENDPOINT, error: detail, predictions: [] };
    });
}

/* ------------------------------ Genie proxy ------------------------------- */

function askGenie(question, conversationId, persona, model) {
  var started = Date.now();
  console.log("[pattern4ce.askGenie] start", JSON.stringify({
    questionPreview: String(question || "").slice(0, 160),
    hasConversationId: !!conversationId,
    persona: persona || "",
    model: model || ""
  }));
  var base = DATABRICKS_HOST + "/api/2.0/genie/spaces/" + GENIE_SPACE_ID;
  var startUrl;
  var startBody;
  if (conversationId) {
    startUrl = base + "/conversations/" + conversationId + "/messages";
    startBody = { content: question };
  } else {
    startUrl = base + "/start-conversation";
    startBody = { content: question };
  }

  var convId;
  var msgId;

  return axios
    .post(startUrl, startBody, { headers: dbxHeaders() })
    .then(function (resp) {
      var d = resp.data || {};
      convId = d.conversation_id || (d.conversation && d.conversation.id) || conversationId;
      msgId = d.message_id || (d.message && d.message.id) || d.id;
      console.log("[pattern4ce.askGenie] conversation started", JSON.stringify({ conversationId: convId, messageId: msgId }));
      var msgUrl = base + "/conversations/" + convId + "/messages/" + msgId;

      function poll(attempt) {
        return axios.get(msgUrl, { headers: dbxHeaders() }).then(function (r) {
          var m = r.data || {};
          var status = m.status || "";
          console.log("[pattern4ce.askGenie] poll", JSON.stringify({
            attempt: attempt,
            status: status,
            attachments: m.attachments ? m.attachments.length : 0
          }));
          if (
            status === "COMPLETED" ||
            status === "FAILED" ||
            attempt > 45
          ) {
            return m;
          }
          return sleep(2000).then(function () {
            return poll(attempt + 1);
          });
        });
      }
      return poll(0);
    })
    .then(function (message) {
      var answerText = "";
      var sqlText = "";
      var attachmentId = "";
      var attachments = message.attachments || [];
      console.log("[pattern4ce.askGenie] attachments", JSON.stringify({ count: attachments.length }));
      var i;
      for (i = 0; i < attachments.length; i++) {
        var a = attachments[i];
        if (a.text && a.text.content) {
          answerText = a.text.content;
        }
        if (a.query && a.query.query) {
          sqlText = a.query.query;
          attachmentId = a.attachment_id || a.query.id || "";
          if (!answerText && a.query.description) {
            answerText = a.query.description;
          }
        }
      }

      function synthesizeAnswer(resultColumns, resultRows) {
        if (!resultColumns || !resultColumns.length || !resultRows || !resultRows.length) {
          return "Genie returned a governed SQL result but did not provide a narrative answer. Review the result table below.";
        }
        var first = resultRows[0] || [];
        var parts = [];
        for (var si = 0; si < resultColumns.length && si < 5; si++) {
          var col = resultColumns[si] || {};
          parts.push(String(col.name || ("Column " + (si + 1))).replace(/_/g, " ") + ": " + first[si]);
        }
        return "Genie returned " + resultRows.length + " row" + (resultRows.length === 1 ? "" : "s") + " from governed Unity Catalog data. Top result — " + parts.join("; ") + ".";
      }

      function finalize(rowCount, resultColumns, resultRows) {
        var chartColumns = resultColumns || [];
        var chartRows = resultRows || [];
        console.log("[pattern4ce.askGenie] success", JSON.stringify({
          conversationId: convId,
          messageId: msgId,
          rowCount: rowCount || 0,
          columnCount: chartColumns.length,
          hasSql: !!sqlText,
          latencyMs: Date.now() - started
        }));
        return {
          status: "SUCCEEDED",
          answer: answerText || synthesizeAnswer(chartColumns, chartRows),
          sql: sqlText,
          rowCount: rowCount || 0,
          columns: chartColumns,
          dataRows: chartRows,
          latencyMs: Date.now() - started,
          conversationId: convId,
          messageId: msgId,
          spaceId: GENIE_SPACE_ID,
          model: model || "genie-default",
          suggestedQuestions: message.suggested_questions || [],
          governedBy: "Unity Catalog + Domo Code Engine proxy"
        };
      }

      if (sqlText && attachmentId) {
        var metadataRows = 0;
        for (i = 0; i < attachments.length; i++) {
          var metaAttachment = attachments[i];
          if (
            metaAttachment.query &&
            metaAttachment.query.query_result_metadata &&
            metaAttachment.query.query_result_metadata.row_count
          ) {
            metadataRows = metaAttachment.query.query_result_metadata.row_count;
          }
        }
        var qUrl =
          base +
          "/conversations/" +
          convId +
          "/messages/" +
          msgId +
          "/query-result/" +
          attachmentId;
        return axios
          .get(qUrl, { headers: dbxHeaders() })
          .then(function (qr) {
            var sr = qr.data && qr.data.statement_response ? qr.data.statement_response : {};
            var schemaColumns =
              sr.manifest && sr.manifest.schema && sr.manifest.schema.columns
                ? sr.manifest.schema.columns
                : [];
            var resultColumns = [];
            for (var c = 0; c < schemaColumns.length; c++) {
              resultColumns.push({
                name: schemaColumns[c].name,
                type_name: schemaColumns[c].type_name,
                type_text: schemaColumns[c].type_text,
                position: schemaColumns[c].position
              });
            }
            var resultRows = sr.result && sr.result.data_array ? sr.result.data_array : [];
            var rows =
              sr.result && sr.result.data_typed_array ? sr.result.data_typed_array.length : 0;
            if (!rows && sr.result && sr.result.data_array) {
              rows = sr.result.data_array.length;
            }
            return finalize(rows, resultColumns, resultRows);
          })
          .catch(function () {
            return finalize(metadataRows);
          });
      }
      return finalize(0);
    })
    .catch(function (err) {
      var detail = err && err.response && err.response.data ? err.response.data : err && err.message ? err.message : String(err);
      console.error("[pattern4ce.askGenie] failed", JSON.stringify({ error: detail }));
      return { status: "FAILED", error: detail };
    });
}

/* --------------------------- Action writeback ----------------------------- */

function writeActionStatus(actionId, decision, executionStatus, approvedBy, note, persona) {
  console.log("[pattern4ce.writeActionStatus] start", JSON.stringify({
    actionId: actionId,
    decision: decision || "Approved",
    executionStatus: executionStatus || "Executed",
    persona: persona || ""
  }));
  var cols = [
    "writeback_id",
    "action_id",
    "decision",
    "execution_status",
    "approved_by",
    "note",
    "persona",
    "source_app",
    "created_ts"
  ];
  var vals = [
    "uuid()",
    sqlString(actionId),
    sqlString(decision || "Approved"),
    sqlString(executionStatus || "Executed"),
    sqlString(approvedBy || "demo.user@domo.com"),
    sqlString(note || ""),
    sqlString(persona || ""),
    sqlString("Pattern 4 Agent Portal"),
    "current_timestamp()"
  ];
  // Databricks rejects non-deterministic functions (uuid(), current_timestamp())
  // inside an INSERT ... VALUES inline table, so use INSERT ... SELECT instead.
  var stmt =
    "INSERT INTO " +
    CATALOG +
    "." +
    SCHEMA +
    "." +
    WRITEBACK_TABLE +
    " (" +
    cols.join(", ") +
    ") SELECT " +
    vals.join(", ");

  return runSql(stmt)
    .then(function (data) {
      var state = data.status && data.status.state ? data.status.state : "SUCCEEDED";
      if (state === "FAILED") {
        console.error("[pattern4ce.writeActionStatus] sql failed", JSON.stringify({ actionId: actionId, error: data.status ? data.status.error : "SQL failed" }));
        return { status: "FAILED", error: data.status ? data.status.error : "SQL failed" };
      }
      console.log("[pattern4ce.writeActionStatus] success", JSON.stringify({ actionId: actionId, state: state }));
      return { status: "SUCCEEDED", actionId: actionId, state: state };
    })
    .catch(function (err) {
      var detail = err && err.response && err.response.data ? err.response.data : err && err.message ? err.message : String(err);
      console.error("[pattern4ce.writeActionStatus] failed", JSON.stringify({ actionId: actionId, error: detail }));
      return { status: "FAILED", error: detail };
    });
}

/* -------------- Unity AI Gateway-governed LLM reasoning (OBO-ready) -------------- */

function askReasoningModel(prompt, persona) {
  console.log("[pattern4ce.askReasoningModel] start", JSON.stringify({ persona: persona || "", promptPreview: String(prompt || "").slice(0, 120) }));
  var url = DATABRICKS_HOST + "/serving-endpoints/" + REASONING_ENDPOINT + "/invocations";
  var body = {
    messages: [
      { role: "system", content: "You are a renewal-risk retention triage analyst for a B2B revenue command center. Be concise, specific, and action-oriented. Persona: " + (persona || "Executive Sponsor") + "." },
      { role: "user", content: String(prompt || "") }
    ],
    max_tokens: 220,
    temperature: 0.2
  };
  return axios.post(url, body, { headers: dbxHeaders(), timeout: 60000 })
    .then(function (resp) {
      var data = resp.data || {};
      var choices = data.choices || [];
      var content = choices.length && choices[0].message ? choices[0].message.content : "";
      console.log("[pattern4ce.askReasoningModel] success", JSON.stringify({ usage: data.usage || null }));
      return {
        status: "SUCCEEDED",
        content: content,
        usage: data.usage || null,
        endpoint: REASONING_ENDPOINT,
        governedBy: "Unity AI Gateway",
        guardrails: "input: safety + PII block · output: safety + PII mask"
      };
    })
    .catch(function (err) {
      var detail = err && err.response && err.response.data ? err.response.data : err && err.message ? err.message : String(err);
      console.error("[pattern4ce.askReasoningModel] failed", JSON.stringify({ error: detail }));
      return { status: "FAILED", error: detail, endpoint: REASONING_ENDPOINT, governedBy: "Unity AI Gateway" };
    });
}

/* --------- Databricks Supervisor Agent (MAS) — agent-to-agent bridge --------- */

function extractResponsesText(data) {
  // Parse the OpenAI Responses API shape returned by an agent/v1/responses endpoint.
  var out = data && data.output ? data.output : null;
  var text = "";
  if (Array.isArray(out)) {
    for (var i = 0; i < out.length; i++) {
      var item = out[i] || {};
      var content = item.content;
      if (Array.isArray(content)) {
        for (var j = 0; j < content.length; j++) {
          var seg = content[j] || {};
          if (typeof seg.text === "string") {
            text += (text ? "\n" : "") + seg.text;
          }
        }
      } else if (typeof content === "string") {
        text += (text ? "\n" : "") + content;
      }
    }
  }
  if (!text && data && typeof data.output_text === "string") {
    text = data.output_text;
  }
  return text;
}

// The Domo AI-agent tile that calls this tool has a tool-call timeout (~60s). The
// Genie-backed MAS is ~45s warm but can exceed the budget when cold/slow, which hangs
// the agent tile. So we BOUND the MAS call and fall back to the fast guardrailed
// reasoning LLM (pattern4-reasoning-gateway, ~4s) so the tool ALWAYS returns quickly.
var RETENTION_AGENT_BUDGET_MS = 48000;

function askRetentionAgent(prompt) {
  console.log("[pattern4ce.askRetentionAgent] start", JSON.stringify({ promptPreview: String(prompt || "").slice(0, 140) }));
  var url = DATABRICKS_HOST + "/serving-endpoints/" + RETENTION_AGENT_ENDPOINT + "/invocations";
  var body = { input: [{ role: "user", content: String(prompt || "") }] };
  return axios.post(url, body, { headers: dbxHeaders(), timeout: RETENTION_AGENT_BUDGET_MS })
    .then(function (resp) {
      var data = resp.data || {};
      var recommendation = extractResponsesText(data);
      if (!recommendation) throw new Error("empty MAS response");
      console.log("[pattern4ce.askRetentionAgent] success", JSON.stringify({ status: data.status || null, chars: recommendation.length }));
      return {
        status: "SUCCEEDED",
        recommendation: recommendation,
        agentStatus: data.status || null,
        usage: data.usage || null,
        endpoint: RETENTION_AGENT_ENDPOINT,
        agent: "Pattern 4 Retention Supervisor (Databricks Agent Bricks)",
        source: "mas",
        governedBy: "Unity Catalog + Genie + Model Serving"
      };
    })
    .catch(function (err) {
      var detail = err && err.message ? err.message : String(err);
      console.warn("[pattern4ce.askRetentionAgent] MAS exceeded budget/failed; using fast governed fallback", JSON.stringify({ error: detail }));
      // Fast, guardrailed fallback so the Domo agent tile never hangs.
      return askReasoningModel(prompt, "Executive Sponsor").then(function (rm) {
        if (rm && rm.status === "SUCCEEDED") {
          return {
            status: "SUCCEEDED",
            recommendation: rm.content,
            endpoint: REASONING_ENDPOINT,
            agent: "Pattern 4 Retention Supervisor (fast governed fallback)",
            source: "reasoning-gateway-fallback",
            note: "MAS exceeded the agent latency budget; returned a fast Unity AI Gateway-guardrailed recommendation.",
            governedBy: "Unity AI Gateway (guardrails)"
          };
        }
        return { status: "FAILED", error: (rm && rm.error) || detail, endpoint: RETENTION_AGENT_ENDPOINT };
      });
    });
}

/* ----------------- In-app approval queue (Task Center) bridge ----------------- */

function listApprovalTasks(limit) {
  console.log("[pattern4ce.listApprovalTasks] start", JSON.stringify({ limit: limit || null }));
  return domoApi("GET", "/api/queues/v1/" + APPROVAL_QUEUE_ID + "/tasks")
    .then(function (data) {
      var rows = Array.isArray(data) ? data : (data && data.tasks ? data.tasks : []);
      var tasks = rows.map(function (t) {
        var attrs = t.attributes || [];
        var src = t.sourceInfo || {};
        return {
          id: t.id,
          title: Array.isArray(attrs) && attrs.length ? attrs[0] : "Approve renewal-risk retention",
          status: t.status,
          version: t.version,
          assignedTo: t.assignedTo,
          createdOn: t.createdOn,
          completedOn: t.completedOn,
          completedBy: t.completedBy,
          // sourceInfo links the Task Center task to its workflow instance, so the
          // app can match a task to a specific run (live Action Journey timeline).
          instanceId: src.instanceId || null,
          flowNodeId: src.flowNodeId || null,
          modelVersion: src.modelVersion || null
        };
      });
      tasks.sort(function (a, b) { return String(b.createdOn || "").localeCompare(String(a.createdOn || "")); });
      if (limit && Number(limit) > 0) tasks = tasks.slice(0, Number(limit));
      console.log("[pattern4ce.listApprovalTasks] ok", JSON.stringify({ count: tasks.length }));
      return { status: "SUCCEEDED", tasks: tasks, queueId: APPROVAL_QUEUE_ID };
    })
    .catch(function (err) {
      var detail = err && err.response && err.response.data ? err.response.data : err && err.message ? err.message : String(err);
      console.error("[pattern4ce.listApprovalTasks] failed", JSON.stringify({ error: detail }));
      return { status: "FAILED", error: detail };
    });
}

function completeApprovalTask(taskId, decision, version) {
  var dec = decision === "Approved" || decision === "Rejected" ? decision : "Approved";
  var ver = version === null || version === undefined || version === "" ? "1" : String(version);
  console.log("[pattern4ce.completeApprovalTask] start", JSON.stringify({ taskId: taskId, decision: dec, version: ver }));
  var path = "/api/queues/v1/" + APPROVAL_QUEUE_ID + "/tasks/" + encodeURIComponent(taskId) + "/complete?version=" + encodeURIComponent(ver);
  // Body = form output aliases. Decision drives the workflow gateway (Approved/Rejected).
  return domoApi("POST", path, { Decision: dec })
    .then(function (data) {
      console.log("[pattern4ce.completeApprovalTask] ok", JSON.stringify({ taskId: taskId, decision: dec }));
      return { status: "SUCCEEDED", taskId: taskId, decision: dec, task: data || null };
    })
    .catch(function (err) {
      var detail = err && err.response && err.response.data ? err.response.data : err && err.message ? err.message : String(err);
      console.error("[pattern4ce.completeApprovalTask] failed", JSON.stringify({ taskId: taskId, error: detail }));
      return { status: "FAILED", error: detail, taskId: taskId };
    });
}

/* ----------------------- Live Domo Workflow trigger ----------------------- */

function cmpSemver(a, b) {
  var pa = String(a).split(".").map(Number);
  var pb = String(b).split(".").map(Number);
  for (var i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

// Resolve the highest deployed/active workflow version so we never hardcode it
// (avoids re-releasing this package every time the workflow is re-versioned).
function resolveActiveWorkflowVersion() {
  return domoApi("GET", "/api/workflow/v1/models/" + WORKFLOW_MODEL_ID)
    .then(function (model) {
      var vs = (model && model.versions) || [];
      var active = vs.filter(function (v) { return v.active === true || v.deployedOn; });
      if (!active.length) return WORKFLOW_VERSION;
      active.sort(function (a, b) { return cmpSemver(b.version, a.version); });
      return active[0].version || WORKFLOW_VERSION;
    })
    .catch(function () { return WORKFLOW_VERSION; });
}

function startRetentionWorkflow(actionId, account, recommendation, persona, predicted, protectedRevenue, sourceQuestion) {
  console.log("[pattern4ce.startRetentionWorkflow] start", JSON.stringify({
    actionId: actionId, persona: persona || ""
  }));
  var predictedNum = predicted === null || predicted === undefined || predicted === "" ? null : Number(predicted);
  var protectedNum = protectedRevenue === null || protectedRevenue === undefined || protectedRevenue === "" ? null : Number(protectedRevenue);
  return resolveActiveWorkflowVersion().then(function (activeVersion) {
  var startBody = {
    messageName: WORKFLOW_START_MESSAGE,
    version: activeVersion,
    modelId: WORKFLOW_MODEL_ID,
    data: {
      actionId: actionId,
      account: account || "",
      recommendation: recommendation || "",
      persona: persona || "",
      predicted: predictedNum,
      protectedRevenue: protectedNum,
      sourceQuestion: sourceQuestion || ""
    }
  };
  console.log("[pattern4ce.startRetentionWorkflow] starting version", JSON.stringify({ version: activeVersion }));
  // Server-side start via the product API (developer token) — no app context /
  // workflowMapping, so it is immune to the App Studio stale-context failure mode.
  return domoApi("POST", "/api/workflow/v1/instances/message", startBody)
    .then(function (instance) {
      var instanceId = instance && instance.id ? instance.id : "";
      console.log("[pattern4ce.startRetentionWorkflow] workflow started", JSON.stringify({
        actionId: actionId, instanceId: instanceId, status: instance ? instance.status : null
      }));
      // Write the Pending audit/trace row (joined to the decision row by action_id).
      return writeTraceRow(actionId, persona, recommendation, sourceQuestion, predictedNum, protectedNum, instanceId)
        .then(function () {
          return {
            status: "SUCCEEDED",
            instanceId: instanceId,
            modelId: WORKFLOW_MODEL_ID,
            version: activeVersion,
            workflowStatus: instance ? instance.status : null
          };
        })
        .catch(function (traceErr) {
          // The workflow started; a trace-row failure should not fail the trigger.
          console.error("[pattern4ce.startRetentionWorkflow] trace write failed", JSON.stringify({ error: String(traceErr) }));
          return { status: "SUCCEEDED", instanceId: instanceId, modelId: WORKFLOW_MODEL_ID, version: activeVersion, traceWritten: false };
        });
    })
    .catch(function (err) {
      var detail = err && err.response && err.response.data ? err.response.data : err && err.message ? err.message : String(err);
      console.error("[pattern4ce.startRetentionWorkflow] failed", JSON.stringify({ actionId: actionId, error: detail }));
      return { status: "FAILED", error: detail };
    });
  });
}

function writeTraceRow(actionId, persona, recommendation, sourceQuestion, predicted, protectedRevenue, instanceId) {
  var cols = [
    "writeback_id", "action_id", "decision", "execution_status", "approved_by",
    "note", "persona", "source_app", "created_ts",
    "workflow_instance_id", "workflow_model_id", "source_question", "recommendation",
    "predicted_value", "protected_value", "approval_state", "trigger_source"
  ];
  var vals = [
    "uuid()",
    sqlString(actionId),
    sqlString("Pending"),
    sqlString("Pending"),
    sqlString(""),
    sqlString("Workflow started; awaiting human approval"),
    sqlString(persona || ""),
    sqlString("Pattern 4 Agent Portal"),
    "current_timestamp()",
    sqlString(instanceId || ""),
    sqlString(WORKFLOW_MODEL_ID),
    sqlString(sourceQuestion || ""),
    sqlString(recommendation || ""),
    predicted === null || predicted === undefined ? "NULL" : Number(predicted),
    protectedRevenue === null || protectedRevenue === undefined ? "NULL" : Number(protectedRevenue),
    sqlString("Pending"),
    sqlString("workflow")
  ];
  // INSERT ... SELECT (uuid()/current_timestamp() are not allowed in VALUES inline tables).
  var stmt = "INSERT INTO " + CATALOG + "." + SCHEMA + "." + WRITEBACK_TABLE +
    " (" + cols.join(", ") + ") SELECT " + vals.join(", ");
  return runSqlChecked(stmt);
}

function getRetentionWorkflowResult(instanceId, actionId) {
  console.log("[pattern4ce.getRetentionWorkflowResult] start", JSON.stringify({ instanceId: instanceId, actionId: actionId }));
  var workflowStatus = null;
  var statusP = instanceId
    ? domoApi("GET", "/api/workflow/v1/instances/" + encodeURIComponent(instanceId))
        .then(function (inst) { workflowStatus = inst && inst.status ? inst.status : null; })
        .catch(function () { workflowStatus = null; })
    : Promise.resolve();
  // Latest decision row for this action (writeActionStatus writes decision <> 'Pending').
  var stmt =
    "SELECT decision, execution_status, approved_by, created_ts FROM " +
    CATALOG + "." + SCHEMA + "." + WRITEBACK_TABLE +
    " WHERE action_id = " + sqlString(actionId) +
    " AND decision IS NOT NULL AND decision <> 'Pending'" +
    " ORDER BY created_ts DESC LIMIT 1";
  return statusP
    .then(function () { return runSqlChecked(stmt); })
    .then(function (data) {
      var rows = data && data.result && data.result.data_array ? data.result.data_array : [];
      var row = rows.length ? rows[0] : null;
      var out = {
        status: "SUCCEEDED",
        workflowStatus: workflowStatus,
        decision: row ? row[0] : null,
        executionStatus: row ? row[1] : null,
        approvedBy: row ? row[2] : null,
        decidedTs: row ? row[3] : null,
        decided: !!row
      };
      console.log("[pattern4ce.getRetentionWorkflowResult] result", JSON.stringify(out));
      return out;
    })
    .catch(function (err) {
      var detail = err && err.response && err.response.data ? err.response.data : err && err.message ? err.message : String(err);
      console.error("[pattern4ce.getRetentionWorkflowResult] failed", JSON.stringify({ error: detail }));
      return { status: "FAILED", error: detail, workflowStatus: workflowStatus };
    });
}

module.exports = {
  askGenie: askGenie,
  askReasoningModel: askReasoningModel,
  askRetentionAgent: askRetentionAgent,
  listApprovalTasks: listApprovalTasks,
  completeApprovalTask: completeApprovalTask,
  writeActionStatus: writeActionStatus,
  startRetentionWorkflow: startRetentionWorkflow,
  getRetentionWorkflowResult: getRetentionWorkflowResult,
  listScenarios: listScenarios,
  createScenario: createScenario,
  updateScenario: updateScenario,
  deleteScenario: deleteScenario,
  listPredictionFeedback: listPredictionFeedback,
  savePredictionFeedback: savePredictionFeedback,
  updatePredictionFeedback: updatePredictionFeedback,
  deletePredictionFeedback: deletePredictionFeedback,
  runModelInference: runModelInference,
  getUcReadinessState: getUcReadinessState,
  getDomoAiReadiness: getDomoAiReadiness,
  syncDomoAiReadiness: syncDomoAiReadiness,
  wipeDomoAiReadiness: wipeDomoAiReadiness,
  updateUcColumnContext: updateUcColumnContext,
  runSql: runSql,
  sqlString: sqlString,
  lakebaseQuery: lakebaseQuery
};
