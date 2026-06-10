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
 *
 * SETUP: paste your Databricks PAT into DATABRICKS_TOKEN below (same token as
 * the local `databricks token` file). Do NOT commit a real token to git.
 * Written with conservative ES5-style syntax for the Code Engine editor.
 */

var axios = require("axios");
var pg = require("pg");

var DATABRICKS_HOST = "https://dbc-0516e56c-ba3e.cloud.databricks.com";
var DATABRICKS_TOKEN = "REPLACE_WITH_DATABRICKS_TOKEN";
var GENIE_SPACE_ID = "01f1642295b61d6b8849e106f52fc781";
var WAREHOUSE_ID = "ea829ba58bcae093";
var CATALOG = "databricks_raptor";
var SCHEMA = "pattern4_agent_automation";
var WRITEBACK_TABLE = "agent_action_writeback";
var LAKEBASE_ENDPOINT = "projects/cobra-v1/branches/production/endpoints/primary";
var LAKEBASE_HOST = "ep-fancy-mud-d2xv4rcd.database.us-east-1.cloud.databricks.com";
var LAKEBASE_DATABASE = "databricks_postgres";
var LAKEBASE_USER = "cassidy.hilton@domo.com";
var lakebaseTokenCache = { token: "", expiresAt: 0 };

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

/* ------------------------------ Lakebase PG ------------------------------- */

function getLakebaseToken() {
  var now = Date.now();
  if (lakebaseTokenCache.token && lakebaseTokenCache.expiresAt > now + 60000) {
    return Promise.resolve(lakebaseTokenCache.token);
  }
  return axios
    .post(
      DATABRICKS_HOST + "/api/2.0/postgres/credentials",
      { endpoint: LAKEBASE_ENDPOINT },
      { headers: dbxHeaders() }
    )
    .then(function (resp) {
      var data = resp.data || {};
      lakebaseTokenCache.token = data.token || "";
      lakebaseTokenCache.expiresAt = data.expire_time ? Date.parse(data.expire_time) : now + 50 * 60 * 1000;
      return lakebaseTokenCache.token;
    });
}

function lakebaseQuery(sql, params) {
  console.log("[pattern4ce.lakebaseQuery] start", JSON.stringify({ sqlPreview: String(sql || "").slice(0, 160), paramCount: params ? params.length : 0 }));
  var client;
  return getLakebaseToken()
    .then(function (token) {
      client = new pg.Client({
        host: LAKEBASE_HOST,
        port: 5432,
        database: LAKEBASE_DATABASE,
        user: LAKEBASE_USER,
        password: token,
        ssl: { rejectUnauthorized: true }
      });
      return client.connect();
    })
    .then(function () {
      return client.query(sql, params || []);
    })
    .then(function (result) {
      console.log("[pattern4ce.lakebaseQuery] success", JSON.stringify({ rowCount: result.rowCount || 0 }));
      return { status: "SUCCEEDED", rows: result.rows || [], rowCount: result.rowCount || 0, fields: result.fields || [] };
    })
    .catch(function (err) {
      var detail = err && err.message ? err.message : String(err);
      console.error("[pattern4ce.lakebaseQuery] failed", JSON.stringify({ error: detail }));
      return { status: "FAILED", error: detail, rows: [], rowCount: 0 };
    })
    .then(function (out) {
      if (client) {
        return client.end().catch(function () {}).then(function () { return out; });
      }
      return out;
    });
}

function listScenarios() {
  return lakebaseQuery(
    "SELECT id, name, created_by, status, assumptions, results, baseline_id, created_at, updated_at FROM public.p4_scenario_runs ORDER BY created_at DESC LIMIT 50",
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

function listPredictionFeedback() {
  return lakebaseQuery(
    "SELECT id, prediction_id, entity_type, entity_id, feedback, predicted_value, corrected_value, comment, created_by, created_at FROM public.p4_prediction_feedback ORDER BY created_at DESC LIMIT 50",
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
  var stmt =
    "INSERT INTO " +
    CATALOG +
    "." +
    SCHEMA +
    "." +
    WRITEBACK_TABLE +
    " (" +
    cols.join(", ") +
    ") VALUES (" +
    vals.join(", ") +
    ")";

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

module.exports = {
  askGenie: askGenie,
  writeActionStatus: writeActionStatus,
  listScenarios: listScenarios,
  createScenario: createScenario,
  updateScenario: updateScenario,
  deleteScenario: deleteScenario,
  listPredictionFeedback: listPredictionFeedback,
  savePredictionFeedback: savePredictionFeedback,
  runSql: runSql,
  sqlString: sqlString,
  lakebaseQuery: lakebaseQuery
};
