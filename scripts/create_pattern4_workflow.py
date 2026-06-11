#!/usr/bin/env python3
"""Author the Pattern 4 "Renewal Risk Retention" Domo Workflow via REST.

Shape A (live workflow): rootNode (API inputs from startRetentionWorkflow) ->
userTaskNode (human approval form, assigned to the demo user) -> conditionalGateway
(Approved? Basic Equals) -> serviceTask pattern4ce.writeActionStatus (Approved/Executed)
or (Rejected/Rejected) -> end. The CE writeback step runs on the RELEASED pattern4ce
v1.0.12 (6-input writeActionStatus), so the workflow is functional without a new release.

Idempotent: reuses the model/queue/form recorded in scripts/pattern4_workflow.json.
No secrets in this file (uses the community-domo-cli ryuu-session login).
"""
from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from p4_domo import client, rid, pretty, DomoApiError  # noqa: E402

REPO = Path(__file__).resolve().parents[1]
STATE_FILE = REPO / "scripts/pattern4_workflow.json"

MODEL_NAME = "Pattern 4 - Renewal Risk Retention"
VERSION = "1.0.3"
ASSIGNEE_USER_ID = "1433178023"          # Cassidy Hilton (Admin)
CE_PACKAGE_ID = "36a18258-0fb7-407a-b268-4a326c5b73c3"
CE_PACKAGE_NAME = "pattern4ce"
CE_FUNCTION = "writeActionStatus"
CE_VERSION = "1.0.18"            # released package version the workflow binds to (bounded agent + writeback fix)
AGENT_TOOL_FUNCTION = "askRetentionAgent"   # Domo AI agent's tool -> Databricks MAS
FORM_VERSION = 2                 # bump to force the approval form to be recreated

# Workflow inputs (supplied by the app via startRetentionWorkflow start API).
INPUTS = [
    ("actionId", "text", True),
    ("account", "text", False),
    ("recommendation", "text", False),
    ("persona", "text", False),
    ("predicted", "decimal", False),
    ("protectedRevenue", "decimal", False),
    ("sourceQuestion", "text", False),
]


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2))


# ----------------------------- model / queue / form -----------------------------

def ensure_model(c, state) -> str:
    if state.get("model_id"):
        return state["model_id"]
    models = c.request("GET", "/workflow/v2/models?limit=200")
    found = [m for m in models if m.get("name") == MODEL_NAME]
    if found:
        state["model_id"] = found[0]["id"]
    else:
        r = c.request("POST", "/workflow/v1/models",
                      json_body={"name": MODEL_NAME,
                                 "description": "Human-approved renewal-risk retention action with writeback (Pattern 4)."})
        state["model_id"] = r["id"]
    save_state(state)
    return state["model_id"]


def ensure_queue(c, state) -> str:
    if state.get("queue_id"):
        return state["queue_id"]
    name = "Renewal Risk Approvals"
    queues = c.request("GET", "/queues/v1")
    found = [q for q in queues if q.get("name") == name]
    if found:
        state["queue_id"] = found[0]["id"]
    else:
        r = c.request("POST", "/queues/v1", json_body={
            "name": name,
            "description": "Pattern 4 renewal-risk retention approvals.",
            "active": True,
            "notificationsEnabled": True,
            "taskLevelFiltersEnabled": False,
            "taskLevelFilters": None,
        })
        state["queue_id"] = r["id"]
    save_state(state)
    return state["queue_id"]


# Approval form fields. (label, fieldType, dataType, alias, is_choice)
FORM_FIELDS = [
    ("Account", "SHORT_ANSWER", "text", "Account", None),
    ("Recommended action", "PARAGRAPH", "text", "Recommendation", None),
    ("AI agent recommendation (Databricks)", "PARAGRAPH", "text", "Agent_Recommendation", None),
    ("Protected revenue ($)", "SHORT_ANSWER", "decimal", "Protected_Revenue", None),
    ("Source question / context", "PARAGRAPH", "text", "Source_Question", None),
    ("Decision", "SINGLE_CHOICE", "text", "Decision", ["Approved", "Rejected"]),
]


def ensure_form(c, state, model_id) -> dict:
    if state.get("form_id") and state.get("form_field_ids") and state.get("form_version") == FORM_VERSION:
        return {"id": state["form_id"], "fields": state["form_field_ids"]}
    field_ids = {alias: str(uuid.uuid4()) for (_, _, _, alias, _) in FORM_FIELDS}
    fields = []
    field_config = {}
    for (label, ftype, dtype, alias, choices) in FORM_FIELDS:
        fid = field_ids[alias]
        f = {
            "id": fid,
            "label": label,
            "placeholder": "",
            "optional": alias != "Decision",   # only Decision is required for the demo
            "fieldType": ftype,
            "dataType": dtype,
            "acceptsInput": True,
            "acceptsOutput": True,
            "options": {"values": choices or [], "acceptsOther": False},
            "alias": alias,
            "isList": False,
        }
        if choices:
            f["defaultValue"] = "Rejected"
            f["displayAsDropdown"] = False
        fields.append(f)
        field_config[fid] = {"targetMapping": {"target": alias}}
    body = {
        "domainType": "WORKFLOW",
        "domainId": f"{model_id} - {VERSION}",
        "name": "Approve renewal-risk retention",
        "description": "Review the recommended retention action and approve or reject.",
        "sections": [{"id": str(uuid.uuid4()), "title": "", "fields": fields}],
        "settings": {},
        "attributes": [{"type": "paragraph", "children": [{"text": ""}]}],
        "fieldConfiguration": field_config,
        "submitConfiguration": {"type": "UNASSIGNED", "isDatasetOwner": False, "submitType": "INSERT"},
        "searchable": False,
        "submitConfigurationType": "UNASSIGNED",
    }
    r = c.request("POST", "/forms/v2", json_body=body)
    state["form_id"] = r["id"]
    state["form_field_ids"] = field_ids
    state["form_version"] = FORM_VERSION
    save_state(state)
    return {"id": r["id"], "fields": field_ids}


# ----------------------------- definition builder -----------------------------

def build_definition(model_id, form, queue_id) -> dict:
    form_id = form["id"]
    ff = form["fields"]

    # dataList variables (one per input + the decision output)
    var = {name: f"var_{rid(11)}" for (name, _, _) in INPUTS}
    var_decision = f"var_{rid(11)}"
    dtype = {name: t for (name, t, _) in INPUTS}

    data_list = []
    for (name, t, _req) in INPUTS:
        data_list.append({
            "id": var[name], "paramName": name, "dataType": t, "isList": False,
            "children": [], "showChildren": False, "entitySubType": None,
            "value": None, "isOutput": False,
        })
    data_list.append({
        "id": var_decision, "paramName": "decision", "dataType": "text", "isList": False,
        "children": [], "showChildren": False, "entitySubType": None,
        "value": "Rejected", "isOutput": True,
    })

    # rootNode inputs + schema.inputs
    root_inputs = []
    schema_inputs = {}
    for (name, t, req) in INPUTS:
        iid = rid()
        root_inputs.append({
            "aiDescription": None, "children": [], "configType": None, "customMappingType": None,
            "dataType": t, "displayName": name, "entitySubType": None, "flag": "input",
            "id": iid, "isList": False, "mappedTo": var[name], "paramName": name,
            "required": req, "value": None, "visible": True,
        })
        schema_inputs[iid] = {
            "name": name, "type": t, "subType": None, "isList": False,
            "isNullable": not req, "id": iid, "parent": None, "isChild": False,
        }

    root = {
        "id": "rootNode", "position": {"x": 320, "y": 40},
        "data": {
            "dimensions": {"width": 200, "height": 60},
            "title": f"Start {MODEL_NAME}", "description": "", "type": "Start",
            "_designNode": "rootNode", "isFormStart": False, "formId": None,
            "input": root_inputs,
        },
        "style": {"zIndex": 3, "outline": "none"}, "index": 0, "type": "rootNode",
    }

    # Object var that captures the Domo AI agent's structured result (recommendation).
    var_agent = f"var_{rid(11)}"
    var_agent_rec = var_agent + ".recommendation"
    data_list.append({
        "id": var_agent, "paramName": "agentRecommendation", "dataType": "object", "isList": False,
        "children": [{
            "id": var_agent_rec, "paramName": "recommendation", "dataType": "text", "isList": False,
            "children": [], "showChildren": False, "entitySubType": None, "value": None, "isOutput": True,
        }],
        "showChildren": True, "entitySubType": None, "value": None, "isOutput": True,
    })

    # userTaskNode: display fields (input) + Decision (output)
    # src "__agentrec__" maps to the AI agent's object-child var (dotted path).
    display = [
        ("Account", "Account", "text", "SHORT_ANSWER", "account"),
        ("Recommendation", "Recommended action", "text", "PARAGRAPH", "recommendation"),
        ("Agent_Recommendation", "AI agent recommendation (Databricks)", "text", "PARAGRAPH", "__agentrec__"),
        ("Protected_Revenue", "Protected revenue ($)", "decimal", "SHORT_ANSWER", "protectedRevenue"),
        ("Source_Question", "Source question / context", "text", "PARAGRAPH", "sourceQuestion"),
    ]
    ut_input = []
    ut_output = []
    for (alias, label, t, ftype, src) in display:
        mapped = var_agent_rec if src == "__agentrec__" else var[src]
        ent = {
            "acceptsInput": True, "children": [], "customMappingType": "form", "dataType": t,
            "datasetMapping": None, "displayName": label, "entitySubType": None,
            "fieldOptionsMappedTo": None, "fieldOptionsValue": None, "flag": "input",
            "formFieldId": ff[alias], "formFieldType": ftype, "id": rid(), "isList": False,
            "mappedTo": mapped, "paramName": alias, "required": False, "value": None,
            "visible": True, "configType": "forms", "useExternalValues": False,
        }
        ut_input.append(ent)
        out = dict(ent)
        out["flag"] = "output"; out["id"] = rid(); out["configType"] = "form"
        ut_output.append(out)
    # Decision: input (default Rejected, no var) + output (-> var_decision)
    dec_in = {
        "acceptsInput": True, "children": [], "customMappingType": "form", "dataType": "text",
        "datasetMapping": None, "displayName": "Decision", "entitySubType": None,
        "fieldOptionsMappedTo": None, "fieldOptionsValue": None, "flag": "input",
        "formFieldId": ff["Decision"], "formFieldType": "SINGLE_CHOICE", "id": rid(),
        "isList": False, "mappedTo": None, "paramName": "Decision", "required": True,
        "value": "Rejected", "visible": True, "configType": "forms", "useExternalValues": False,
    }
    ut_input.append(dec_in)
    dec_out = dict(dec_in)
    dec_out["flag"] = "output"; dec_out["id"] = rid(); dec_out["mappedTo"] = var_decision
    dec_out["value"] = None; dec_out["configType"] = "form"
    ut_output.append(dec_out)

    ut_id = rid()
    user_task = {
        "id": ut_id, "position": {"x": 320, "y": 360},
        "data": {
            "dimensions": {"width": 200, "height": 60}, "title": "Approve retention action", "description": "",
            "_designNode": "userTaskNode", "configType": "form",
            "selectedUserTaskTitle": "Approve renewal-risk retention",
            "selectedUserTaskDescription": "",
            "input": ut_input, "output": ut_output, "fieldOptions": [],
            "formId": form_id, "selectedQueue": queue_id,
            "assignedTo": {
                "aiDescription": None, "children": [], "configType": None, "customMappingType": None,
                "dataType": "person", "displayName": "Assigned To", "entitySubType": None,
                "flag": "input", "id": rid(), "isList": False, "mappedTo": None,
                "paramName": "DOMO_ASSIGNED_TO_", "required": True, "value": ASSIGNEE_USER_ID,
                "visible": True,
            },
        },
        "style": {"zIndex": 4, "outline": "none"}, "index": 2, "type": "userTaskNode",
    }

    # ---- Domo AI Agent tile: calls the Databricks MAS (agent-to-agent) ----
    def stext(t):
        return {"text": t, "bold": False, "italic": False, "underlined": False, "sql": False}

    def svar(varid, name, dtype="text"):
        return {"type": "variable", "children": [stext("")], "dataType": dtype, "id": varid, "name": name, "isList": False}

    ai_id = rid()
    result_id = rid()
    tool_in_id = rid()
    ai_agent = {
        "id": ai_id, "position": {"x": 320, "y": 200},
        "data": {
            "dimensions": {"width": 200, "height": 60},
            "title": "Retention triage agent", "description": "",
            "prompt": {
                "id": rid(), "paramName": "prompt", "dataType": "text", "mappedTo": None,
                "value": [{"type": "paragraph", "children": [
                    stext("At-risk account: "), svar(var["account"], "account"),
                    stext(". Risk context: "), svar(var["sourceQuestion"], "sourceQuestion"),
                    stext(". Seed recommendation: "), svar(var["recommendation"], "recommendation"),
                    stext(". Call the Ask Retention Agent tool (the Databricks Retention Supervisor Agent, which reasons over governed Unity Catalog data via Genie) with this account and context, then return ONE concrete recommended retention action plus a one-sentence rationale."),
                ]}],
                "required": True, "isList": False, "children": [], "displayName": "Prompt",
                "visible": True, "flag": "input", "customMappingType": None, "configType": None,
                "entitySubType": None, "aiDescription": None,
            },
            "result": {
                "id": result_id, "paramName": "result", "dataType": "object", "mappedTo": var_agent,
                "value": None, "required": True, "isList": False,
                "children": [{
                    "id": result_id + ".recommendation", "paramName": "recommendation", "dataType": "text",
                    "mappedTo": var_agent_rec, "value": None, "required": True, "isList": False, "children": [],
                    "displayName": "", "visible": True, "flag": "output", "customMappingType": None,
                    "configType": None, "entitySubType": None, "aiDescription": None,
                }],
                "displayName": "Result", "visible": True, "flag": "output", "customMappingType": None,
                "configType": None, "entitySubType": None, "aiDescription": None,
            },
            "agent": {
                "instructions": (
                    "You are a renewal-risk retention analyst for a B2B revenue command center. "
                    "Use the Ask Retention Agent tool — the Databricks Retention Supervisor Agent (an "
                    "Agent Bricks multi-agent that reasons over governed Unity Catalog gold views via Genie) "
                    "— passing the account name and risk context from the prompt. Based on its governed "
                    "response, return ONE concrete recommended retention action with a one-sentence rationale "
                    "and what to watch after executing. Put the final text in result.recommendation."
                ),
                "tools": [{
                    "functionName": AGENT_TOOL_FUNCTION,
                    "functionDescription": "Ask the Databricks Retention Supervisor Agent (Genie-backed) for a governed retention recommendation for an at-risk account.",
                    "inputs": [{
                        "id": tool_in_id, "paramName": "prompt", "dataType": "text", "mappedTo": None,
                        "value": None, "required": False, "isList": False, "children": [], "displayName": "prompt",
                        "visible": True, "flag": "input", "customMappingType": None, "configType": None,
                        "entitySubType": None, "aiDescription": None,
                    }],
                    "inputDescriptions": {tool_in_id: "The account name and risk context to analyze."},
                    "id": rid(), "name": "Ask Retention Agent",
                    "description": "Databricks Retention Supervisor Agent (MAS) over the Pattern 4 Genie space.",
                    "packageId": CE_PACKAGE_ID, "packageVersion": CE_VERSION,
                    "output": {
                        "id": rid(), "paramName": "result", "dataType": "object", "mappedTo": None,
                        "value": None, "required": False, "isList": False, "children": [], "displayName": "result",
                        "visible": True, "flag": "output", "customMappingType": None, "configType": None,
                        "entitySubType": None, "aiDescription": None,
                    },
                    "type": "FUNCTION",
                }],
                "context": {"datasets": [], "directories": [], "files": [], "isEmpty": True},
                "outputDescriptions": {},
            },
            "_designNode": "AI_AGENT",
        },
        "style": {"zIndex": 3, "outline": "none"}, "index": 1, "type": "AI_AGENT",
    }

    gateway_id = rid()
    gateway = {
        "id": gateway_id, "position": {"x": 320, "y": 520},
        "data": {
            "dimensions": {"width": 200, "height": 60}, "title": "Approved?",
            "description": "Route on the approval decision.",
            "_designNode": "conditionalGatewayNode", "inclusive": False,
        },
        "style": {"zIndex": 3, "outline": "none"}, "index": 3, "type": "conditionalGatewayNode",
    }

    def service_task(node_id, idx, x, y, title, decision, exec_status, note):
        def inp(name, mapped, value, required):
            return {
                "aiDescription": None, "children": [], "configType": None, "customMappingType": None,
                "dataType": "text", "displayName": name, "entitySubType": None, "flag": "input",
                "id": rid(), "isList": False, "mappedTo": mapped, "paramName": name,
                "required": required, "value": value, "visible": True,
            }
        return {
            "id": node_id, "position": {"x": x, "y": y},
            "data": {
                "dimensions": {"width": 200, "height": 60}, "title": title, "description": "",
                "_designNode": "serviceTaskNode",
                "input": [
                    inp("actionId", var["actionId"], None, True),
                    inp("decision", None, decision, False),
                    inp("executionStatus", None, exec_status, False),
                    inp("approvedBy", None, "cassidy.hilton@domo.com", False),
                    inp("note", None, note, False),
                    inp("persona", var["persona"], None, False),
                ],
                "output": [],
                "taskType": "nebulaFunction",
                "metadata": {
                    "version": CE_VERSION, "settings": {},
                    "packageId": CE_PACKAGE_ID, "packageName": CE_PACKAGE_NAME,
                    "functionName": CE_FUNCTION,
                },
                "usesStructuredOutputs": False,
                "selectedTaskTitle": CE_FUNCTION,
                "selectedTaskDescription": "Write Action Status",
            },
            "style": {"zIndex": 3, "outline": "none"}, "index": idx, "type": "serviceTaskNode",
        }

    approve_id, reject_id = rid(), rid()
    approve_task = service_task(approve_id, 4, 180, 700, "Write Approved status",
                                "Approved", "Executed", "Approved via Domo Workflow")
    reject_task = service_task(reject_id, 5, 460, 700, "Write Rejected status",
                               "Rejected", "Rejected", "Rejected via Domo Workflow")

    end1_id, end2_id = rid(), rid()
    end1 = {"id": end1_id, "position": {"x": 180, "y": 860},
            "data": {"dimensions": {"width": 200, "height": 60}, "title": "Done (approved)", "description": "",
                     "_designNode": "endNode", "terminating": False},
            "style": {"zIndex": 4, "outline": "none"}, "index": 6, "type": "endNode"}
    end2 = {"id": end2_id, "position": {"x": 460, "y": 860},
            "data": {"dimensions": {"width": 200, "height": 60}, "title": "Done (rejected)", "description": "",
                     "_designNode": "endNode", "terminating": False},
            "style": {"zIndex": 4, "outline": "none"}, "index": 7, "type": "endNode"}

    def default_edge(idx, src, tgt, sp, tp, path):
        return {"id": f"edge-{src}-{tgt}-{rid(11)}", "source": src, "target": tgt,
                "data": {"sourcePosition": sp, "targetPosition": tp, "path": path, "title": ""},
                "style": {"zIndex": 5}, "index": idx, "arrowHeadType": "arrow", "type": "defaultEdge"}

    def condition_edge(idx, src, tgt, title, kind, rules, sp, tp, path, ex, en, pill):
        data = {
            "sourcePosition": sp, "targetPosition": tp, "path": path,
            "entryPosition": en, "exitPosition": ex, "description": "", "title": title,
            "type": kind, "nodeId": rid(), "position": pill,
            "dimensions": {"width": 200, "height": 40}, "splitIndex": 2, "_designNode": "condition",
        }
        if rules is not None:
            data["rules"] = rules
        return {"id": f"edge-{src}-{tgt}-{rid(11)}", "source": src, "target": tgt,
                "data": data, "style": {}, "index": idx, "arrowHeadType": "arrow", "type": "conditionEdge"}

    approve_rules = [[{
        "variable": {"id": var_decision, "paramName": "decision", "dataType": "text",
                     "isList": False, "children": [], "showChildren": False,
                     "entitySubType": None, "value": None, "isOutput": True},
        "operator": "Equals", "valueType": "Custom", "value": "Approved",
    }]]

    # Trunk nodes centered at x=420; branches at approve=280 / reject=560 (symmetric).
    edges = [
        default_edge(8, "rootNode", ai_id, "bottom", "top", [[420, 100], [420, 199]]),
        default_edge(9, ai_id, ut_id, "bottom", "top", [[420, 260], [420, 359]]),
        default_edge(10, ut_id, gateway_id, "bottom", "top", [[420, 420], [420, 519]]),
        condition_edge(11, gateway_id, approve_id, "Approved", "Basic", approve_rules,
                       "bottom", "top", [[420, 580], [280, 640], [280, 699]], "bottom", "top",
                       {"x": 280, "y": 620}),
        condition_edge(12, gateway_id, reject_id, "Rejected", "Default", None,
                       "bottom", "top", [[420, 580], [560, 640], [560, 699]], "bottom", "top",
                       {"x": 560, "y": 620}),
        default_edge(13, approve_id, end1_id, "bottom", "top", [[280, 760], [280, 859]]),
        default_edge(14, reject_id, end2_id, "bottom", "top", [[560, 760], [560, 859]]),
    ]

    return {
        "version": 2,
        "designElements": [root, ai_agent, user_task, gateway, approve_task, reject_task, end1, end2] + edges,
        "dataList": data_list,
        "schema": {"inputs": schema_inputs, "outputs": {}},
    }


def ensure_version(c, model_id) -> None:
    """Create the version shell if missing. POST /versions creates an empty
    version; the definition is then stored via the v2 PUT below."""
    m = c.request("GET", f"/workflow/v1/models/{model_id}")
    have = {v.get("version") for v in (m.get("versions") or [])}
    if VERSION not in have:
        c.request("POST", f"/workflow/v1/models/{model_id}/versions", json_body={"version": VERSION})


def put_definition(c, model_id, definition):
    # The v2 definition endpoint requires the version to already exist.
    path = f"/workflow/v2/models/{model_id}/versions/{VERSION}/definition"
    return c.request("PUT", path, json_body=definition)


def validate(c, model_id):
    v = c.request("POST", f"/workflow/v2/models/{model_id}/versions/{VERSION}/validate", json_body={})
    errs = [x for x in v if (x.get("message") or {}).get("validationLevel") == "ERROR"]
    return v, errs


def main() -> int:
    c = client()
    state = load_state()
    model_id = ensure_model(c, state)
    queue_id = ensure_queue(c, state)
    form = ensure_form(c, state, model_id)
    print("model:", model_id, "| queue:", queue_id, "| form:", form["id"])

    definition = build_definition(model_id, form, queue_id)
    (REPO / "scripts/pattern4_workflow_definition.json").write_text(pretty(definition))

    ensure_version(c, model_id)
    try:
        put_definition(c, model_id, definition)
    except DomoApiError as e:
        msg = json.dumps(e.payload) if e.payload else str(e)
        if "released model version" in msg:
            print(f"NOTE: version {VERSION} is deployed/locked; definition changes require a NEW version "
                  f"(bump VERSION here + CE WORKFLOW_VERSION + re-release). Leaving the live version as-is.")
            return 0
        print("PUT definition ERR", e.status_code, pretty(e.payload) if e.payload else msg)
        return 1

    allv, errs = validate(c, model_id)
    print(f"validate: {len(allv)} messages, {len(errs)} ERRORs")
    for x in allv:
        msg = x.get("message") or {}
        print("  ", msg.get("id"), msg.get("validationLevel"), x.get("source"), x.get("name") or "")

    # Server-side start contract (Shape A): pattern4ce.startRetentionWorkflow POSTs this.
    state["version"] = VERSION
    state["start_message_name"] = f"Start {MODEL_NAME}"
    state["start_endpoint"] = "/api/workflow/v1/instances/message"
    state["assignee_user_id"] = ASSIGNEE_USER_ID
    save_state(state)
    print("\nStart contract (server-side, dev token):")
    print(f"  POST {state['start_endpoint']}")
    print(f"  body: {{messageName: {state['start_message_name']!r}, version: {VERSION!r}, modelId: {model_id!r}, data: {{...inputs...}}}}")
    print("\nNEXT (user, one-click): open the workflow in Domo and click Deploy to register the start trigger.")
    if errs:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
