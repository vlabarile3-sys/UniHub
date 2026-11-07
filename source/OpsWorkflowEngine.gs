// File: OpsWorkflowEngine.gs

/**
* =========================================
* FLOWPILOT - OPS AUTOMATION ENGINE (BACKEND RUNNER)
* Execution Environment: V8 Engine
* Description: DAG Parser, Variable Interpolator & Workspace API Executor
* Architecture: Multi-Tenant Workspace Isolation (OPS vs QA)
* =========================================
*/

/**
* Salva lo stato del Canvas in modo isolato per il workspace specificato.
* @param {string} payload Stringa JSON del grafo (nodi ed edges).
* @param {string} workspace Dipartimento corrente (es. 'OPS' o 'QA').
*/
function saveCanvasState(payload, workspace = 'OPS') {
if (typeof requireRole === 'function') requireRole(['OPS', 'QA', 'TL']);
try {
const safeWorkspace = String(workspace).toUpperCase();
PropertiesService.getScriptProperties().setProperty(`FLOWPILOT_DAG_STATE_${safeWorkspace}`, payload);
return { success: true, message: `Canvas salvato con successo nel workspace ${safeWorkspace}.` };
} catch (e) {
return { success: false, error: e.message };
}
}

/**
* Carica lo stato del Canvas specifico del workspace.
* @param {string} workspace Dipartimento corrente (es. 'OPS' o 'QA').
*/
function loadCanvasState(workspace = 'OPS') {
if (typeof requireRole === 'function') requireRole(['OPS', 'QA', 'TL']);
try {
const safeWorkspace = String(workspace).toUpperCase();
const raw = PropertiesService.getScriptProperties().getProperty(`FLOWPILOT_DAG_STATE_${safeWorkspace}`);
if (!raw) return { success: true, data: { nodes: [], edges: [] } };
return { success: true, data: JSON.parse(raw) };
} catch (e) {
return { success: false, error: e.message };
}
}

/**
* Avvia l'esecuzione del flusso per un workspace isolato.
* @param {string} startNodeId L'ID del nodo trigger di partenza.
* @param {object} triggerPayload Payload opzionale iniettato dai Demoni.
* @param {string} workspace Dipartimento corrente (es. 'OPS' o 'QA').
*/
function executeManualWorkflow(startNodeId, triggerPayload = null, workspace = 'OPS') {
if (typeof requireRole === 'function') requireRole(['OPS', 'QA', 'TL']);
const lock = LockService.getScriptLock();
if (!lock.tryLock(15000)) return { success: false, error: "Engine busy. Please try again." };

try {
const stateRes = loadCanvasState(workspace);
if (!stateRes.success || !stateRes.data) {
throw new Error(`No Canvas State available for workspace: ${workspace}`);
}

const nodes = stateRes.data.nodes || [];
const edges = stateRes.data.edges || [];

const nodeMap = {};
nodes.forEach(n => nodeMap[n.id] = n);

if (!nodeMap[startNodeId]) {
throw new Error("Starting node not found in the DAG.");
}

const adjacencyList = {};
edges.forEach(e => {
if (!adjacencyList[e.source]) adjacencyList[e.source] = [];
adjacencyList[e.source].push(e.target);
});

const context = {
system: {
timestamp: new Date().toISOString(),
user: Session.getEffectiveUser().getEmail(),
workspace: workspace.toUpperCase()
}
};
if (triggerPayload) {
context['trigger'] = triggerPayload;
context[startNodeId] = triggerPayload;
}

const executionLog = [];
const queue = [startNodeId];
let safetyCounter = 0;

while (queue.length > 0 && safetyCounter < 50) {
const currentId = queue.shift();
safetyCounter++;
const node = nodeMap[currentId];
if (!node) continue;

try {
const interpolatedParams = _interpolateParams(node.parameters || {}, context);
const result = _executeNodeAction(node.type, interpolatedParams);
if (triggerPayload && currentId === startNodeId) {
executionLog.push(`[SUCCESS] Trigger node ${node.id} (${node.type}) ingested external payload in ${workspace}.`);
} else {
context[node.id] = result;
executionLog.push(`[SUCCESS] Node ${node.id} (${node.type}) executed.`);
}

if (node.type === 'LOGIC_IF') {
if (result.conditionMet === false) {
executionLog.push(`[HALT] Branch stopped at node ${node.id}: Condition not met.`);
continue;
}
}

if (adjacencyList[currentId]) {
adjacencyList[currentId].forEach(targetId => queue.push(targetId));
}

} catch (e) {
executionLog.push(`[ERROR] Critical error in node ${node.id}: ${e.message}`);
break;
}
}

return { success: true, log: executionLog, context: context };

} catch (e) {
return { success: false, error: e.message };
} finally {
lock.releaseLock();
}
}

/**
* Motore nativo di esecuzione dei nodi. Mappa i tipi di nodo ai servizi Google Workspace.
*/
function _executeNodeAction(nodeType, params) {
switch (nodeType) {
case 'TRIGGER_MANUAL':
case 'TRIGGER_CRON':
case 'TRIGGER_GMAIL_POLLER':
return { status: "STARTED", triggerData: params.description || "N/A" };

case 'ACTION_EMAIL':
if (!params.to || !params.subject || !params.body) throw new Error("Incomplete Email parameters.");
MailApp.sendEmail({
to: params.to,
subject: params.subject,
htmlBody: params.body
});
return { action: "MAIL_SENT", recipient: params.to };

case 'ACTION_SHEET':
if (!params.spreadsheetId || !params.sheetName || !params.rowData) throw new Error("Incomplete Spreadsheet parameters.");
let rowArray = [];
try {
rowArray = JSON.parse(params.rowData);
} catch (e) {
throw new Error("Row Data parameter is not a valid JSON array.");
}
const ss = SpreadsheetApp.openById(params.spreadsheetId);
const sheet = ss.getSheetByName(params.sheetName);
if (!sheet) throw new Error(`Tab ${params.sheetName} not found.`);
sheet.appendRow(rowArray);
return { action: "ROW_APPENDED", sheetName: params.sheetName, rowCount: rowArray.length };

case 'ACTION_PULSE':
if (!params.message) throw new Error("Empty Pulse message.");
const payloadStr = JSON.stringify({
target: params.target || 'ALL',
priority: params.priority || 'NORMAL',
message: params.message
});
if (typeof publishBroadcast === 'function') {
const pulseRes = publishBroadcast(payloadStr);
if (!pulseRes.success) throw new Error("Pulse Broadcast failed.");
}
return { action: "BROADCAST_PUBLISHED", priority: params.priority };

case 'LOGIC_IF':
if (!params.condition) throw new Error("Empty LOGIC_IF condition.");
let conditionMet = false;
try {
conditionMet = new Function('return ' + params.condition)();
} catch (e) {
throw new Error("Invalid Condition syntax.");
}
return { conditionMet: !!conditionMet };

case 'LOGIC_REGEX_PARSER':
if (typeof executeRegexParser !== 'function') {
throw new Error("Regex Parser isolated module is not loaded or missing.");
}
return executeRegexParser(params);

case 'ACTION_STUDIO_BATCH':
if (typeof executeStudioAction !== 'function') {
throw new Error("Studio isolated module is not loaded or missing.");
}
return executeStudioAction(params);

default:
throw new Error(`Unsupported node type: ${nodeType}`);
}
}

/**
* Interpolazione sintassi {{var.path}} tramite l'albero Context in memoria RAM.
*/
function _interpolateParams(params, context) {
const interpolated = {};
for (let key in params) {
let val = params[key];
if (typeof val === 'string') {
val = val.replace(/\{\{([^}]+)\}\}/g, function(match, path) {
let parts = path.trim().split('.');
let current = context;
for (let p of parts) {
if (current == null) return "undefined";
current = current[p];
}
return current !== undefined ? current : "";
});
}
interpolated[key] = val;
}
return interpolated;
}