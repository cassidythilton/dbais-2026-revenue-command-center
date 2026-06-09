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
 *
 * SETUP: paste your Databricks PAT into DATABRICKS_TOKEN below (same token as
 * the local `databricks token` file). Do NOT commit a real token to git.
 * Written with conservative ES5-style syntax for the Code Engine editor.
 */

var axios = require("axios");

var DATABRICKS_HOST = "https://dbc-0516e56c-ba3e.cloud.databricks.com";
var DATABRICKS_TOKEN = "REPLACE_WITH_DATABRICKS_TOKEN";
var GENIE_SPACE_ID = "01f1642295b61d6b8849e106f52fc781";
var WAREHOUSE_ID = "ea829ba58bcae093";
var CATALOG = "databricks_raptor";
var SCHEMA = "pattern4_agent_automation";
var WRITEBACK_TABLE = "agent_action_writeback";

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
            (m.attachments && m.attachments.length > 0 && attempt > 2) ||
            attempt > 30
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

      function finalize(rowCount) {
        console.log("[pattern4ce.askGenie] success", JSON.stringify({
          conversationId: convId,
          messageId: msgId,
          rowCount: rowCount || 0,
          hasSql: !!sqlText,
          latencyMs: Date.now() - started
        }));
        return {
          status: "SUCCEEDED",
          answer: answerText || "Genie returned no text answer.",
          sql: sqlText,
          rowCount: rowCount || 0,
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
            var rows =
              sr.result && sr.result.data_typed_array ? sr.result.data_typed_array.length : 0;
            if (!rows && sr.result && sr.result.data_array) {
              rows = sr.result.data_array.length;
            }
            return finalize(rows);
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
  runSql: runSql,
  sqlString: sqlString
};
