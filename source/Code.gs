/**
* =========================================
* FLOWPILOT + STUDIO SLIDE AI (UNIFIED)
* Backend Architect: Demo-Workspace-Architect
* Engine: V8 (ES6+)
* Storage: 100% Sheet DB (Lazy Init + Global State Engine 2.0)
* Pipeline: Core System, ACL, Pulse Broadcasting, Global Dashboard, Lens Vault & OPS Neural Canvas
* =========================================
*/

const TARGET_DB_ID = PropertiesService.getScriptProperties().getProperty('DEMO_DB_ID') || ''; 
const ACL_SHEET_NAME = "ACL_DB";
const BROADCAST_SHEET_NAME = "PULSE_BROADCAST_DB";
const PINS_SHEET_NAME = "QUICK_PINS_DB";
const GLOBAL_STATE_SHEET_NAME = "GLOBAL_STATE_DB";
const CANVAS_SHEET_NAME = "OPS_CANVAS_DB"; // Neural Canvas Storage
const LENS_VAULT_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('DEMO_DRIVE_FOLDER_ID') || ''; 

/**
* =========================================
* AUTOMATION: TIME-DRIVEN BACKUP
* =========================================
*/

/** Creates isolated demo storage and adds fictional sample records. */
function setupDemoWorkspace() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty('DEMO_DB_ID');
  if (!spreadsheetId) {
    const spreadsheet = SpreadsheetApp.create('FlowPilot Demo Database');
    spreadsheetId = spreadsheet.getId();
    props.setProperty('DEMO_DB_ID', spreadsheetId);
  }
  props.setProperty('STUDIO_MAIN_DB', spreadsheetId);
  let folderId = props.getProperty('DEMO_DRIVE_FOLDER_ID');
  if (!folderId) {
    const folder = DriveApp.createFolder('FlowPilot Demo Assets');
    folderId = folder.getId();
    props.setProperty('DEMO_DRIVE_FOLDER_ID', folderId);
  }
  _seedDemoContent_(spreadsheetId);
  return { spreadsheetId: spreadsheetId, folderId: folderId, message: 'Demo workspace ready with fictional sample data.' };
}

function _seedDemoContent_(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const now = new Date();
  const month = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
  const workflows = ['DEMO', 'SUPPORT', 'ONBOARDING', 'OPERATIONS', 'INSIGHTS', 'AUTOMATION'];
  const tasks = ['Content Review', 'Knowledge Article Update', 'Weekly Insights', 'Team Onboarding'];
  const sampleState = {
    db: [
      { id: 'demo-resource-1', title: 'Demo Playbook — Getting Started', url: 'https://example.com/demo/playbook', category: 'root', type: 'doc', tags: ['demo', 'guide'], isAgentVisible: true },
      { id: 'demo-resource-2', title: 'Sample Workflow Metrics', url: 'https://example.com/demo/metrics', category: 'root', type: 'sheet', tags: ['demo', 'metrics'], isAgentVisible: true }
    ],
    pocs: [{ id: 1001, task: tasks[0], pocName: 'Alex Morgan', month: month }],
    cats: [{ id: 'root', name: 'Shared Materials', parentId: null }],
    qas: ['Alex Morgan', 'Sam Taylor', 'Jordan Lee'],
    links: {},
    channels: ['General KB', 'Team Guides', 'Release Notes'],
    workflows: workflows,
    workflowPolicies: {},
    workflowTasks: {}
  };
  workflows.forEach(function (workflow) {
    sampleState.workflowPolicies[workflow] = ['Approved', 'Needs Review', 'Example'];
    sampleState.workflowTasks[workflow] = tasks;
  });

  let stateSheet = ss.getSheetByName('GLOBAL_STATE_DB');
  if (!stateSheet) {
    stateSheet = ss.insertSheet('GLOBAL_STATE_DB');
    stateSheet.appendRow(['TEAM_CONTEXT', 'CHUNK_INDEX', 'PAYLOAD_DATA']);
  }
  if (stateSheet.getLastRow() <= 1) {
    ['QA', 'TL', 'OPS'].forEach(function (team) {
      stateSheet.appendRow([team, 0, JSON.stringify(sampleState)]);
    });
  }

  let pinsSheet = ss.getSheetByName('QUICK_PINS_DB');
  if (!pinsSheet) {
    pinsSheet = ss.insertSheet('QUICK_PINS_DB');
    pinsSheet.appendRow(['ID', 'TITLE', 'URL', 'AGENT_VISIBLE', 'ADDED_BY', 'TIMESTAMP']);
  }
  if (pinsSheet.getLastRow() <= 1) {
    pinsSheet.appendRow(['demo-pin-1', 'Demo Playbook', 'https://example.com/demo/playbook', true, 'Demo Studio', now.toISOString()]);
  }

  let broadcastSheet = ss.getSheetByName('PULSE_BROADCAST_DB');
  if (!broadcastSheet) {
    broadcastSheet = ss.insertSheet('PULSE_BROADCAST_DB');
    broadcastSheet.appendRow(['ID', 'AUTHOR', 'WORKFLOW_TARGET', 'SCHEDULED_TIMESTAMP', 'MESSAGE_PAYLOAD', 'PRIORITY']);
  }
  if (broadcastSheet.getLastRow() <= 1) {
    broadcastSheet.appendRow(['demo-broadcast-1', 'Demo Studio', 'ALL', now.toISOString(), 'Welcome to the fictional FlowPilot demo. Explore the sample workflows and shared guides.', 'NORMAL']);
  }

  const alignmentName = 'ALIGNMENTS_DB_DEMO';
  let alignmentSheet = ss.getSheetByName(alignmentName);
  if (!alignmentSheet) {
    alignmentSheet = ss.insertSheet(alignmentName);
    alignmentSheet.appendRow(['DATE', 'VERDICT', 'USER_PROMPT', 'BOT_RESPONSE', 'DESCRIPTION', 'CHANNEL', 'HISTORY_JSON']);
  }
  if (alignmentSheet.getLastRow() <= 1) {
    alignmentSheet.appendRow([now.toISOString(), 'Approved', 'How can I write a clear project update?', 'Start with the outcome, summarize progress, then list decisions and next steps.', 'Fictional example for demonstrating searchable team guidance.', 'General KB', '[]']);
    alignmentSheet.appendRow([new Date(now.getTime() - 86400000).toISOString(), 'Needs Review', 'What should a useful handoff include?', 'Include current status, owner, relevant links, and the next action.', 'Second fictional record used only for the demo.', 'Team Guides', '[]']);
  }
}
function installWeeklyBackupTrigger() {
const triggers = ScriptApp.getProjectTriggers();
for (let i = 0; i < triggers.length; i++) {
if (triggers[i].getHandlerFunction() === 'autoWeeklyBackup') {
ScriptApp.deleteTrigger(triggers[i]);
}
}

ScriptApp.newTrigger('autoWeeklyBackup')
.timeBased()
.onWeekDay(ScriptApp.WeekDay.FRIDAY)
.atHour(16)
.create();
Logger.log("✅ Trigger installato: Backup automatico schedulato ogni Venerdì ~16:00.");
}

function autoWeeklyBackup() {
const team = "QA";
try {
Logger.log("Avvio backup automatico per il team: " + team);
const globalData = loadGlobalData(team);
if (!globalData) {
Logger.log("⚠️ Nessun dato trovato in GLOBAL_STATE_DB. Script interrotto.");
return;
}
const payloadString = JSON.stringify(globalData);
const result = syncDataToCloud(payloadString, team);
Logger.log("Esito Backup: " + result.status + " - " + result.message);
} catch (e) {
Logger.log("❌ Errore critico nel backup automatico: " + e.toString());
}
}

/**
* =========================================
* SECURITY & ACL ENGINE (NATIVE SHEET DB)
* =========================================
*/

function _getAclSheet() {
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
let sheet = ss.getSheetByName(ACL_SHEET_NAME);

if (!sheet) {
sheet = ss.insertSheet(ACL_SHEET_NAME);
sheet.appendRow(["Email", "Role", "Added On"]);
sheet.getRange("A1:C1").setFontWeight("bold");
sheet.setFrozenRows(1);

const oldAclStr = PropertiesService.getScriptProperties().getProperty('FLOWPILOT_ACL');
if (oldAclStr) {
try {
const oldAcl = JSON.parse(oldAclStr);
const rows = [];
for (let email in oldAcl) {
rows.push([email.toLowerCase().trim(), oldAcl[email].toUpperCase().trim(), new Date().toISOString()]);
}
if (rows.length > 0) sheet.getRange(2, 1, rows.length, 3).setValues(rows);
} catch (e) { }
} else {
let owner = "demo.owner@example.invalid";
try { owner = Session.getActiveUser().getEmail().toLowerCase().trim(); } catch (e) { }
if (owner) sheet.appendRow([owner, "QA", new Date().toISOString()]);
}
}
return sheet;
}

function getAclMap() {
const cache = CacheService.getScriptCache();
const cached = cache.get("FLOWPILOT_ACL_MAP");
if (cached) return JSON.parse(cached);

try {
const sheet = _getAclSheet();
const lastRow = sheet.getLastRow();
const map = {};
if (lastRow > 1) {
const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
for (let i = 0; i < data.length; i++) {
if (data[i][0]) {
map[data[i][0].toString().toLowerCase().trim()] = data[i][1].toString().toUpperCase().trim();
}
}
}
cache.put("FLOWPILOT_ACL_MAP", JSON.stringify(map), 3600);
return map;
} catch (e) {
return {};
}
}

function getMyRole() {
let email = "";
try { email = Session.getActiveUser().getEmail().toLowerCase().trim(); } catch (e) { }

if (!email) return "QA";

let owner = "";
try { owner = Session.getEffectiveUser().getEmail().toLowerCase().trim(); } catch (e) { }
if (email !== "" && owner !== "" && email === owner) {
const map = getAclMap();
if (!map[email]) {
try {
const sheet = _getAclSheet();
sheet.appendRow([email, "QA", new Date().toISOString()]);
CacheService.getScriptCache().remove("FLOWPILOT_ACL_MAP");
Logger.log("Auto-registrato Owner in ACL: " + email);
} catch(e) {}
}
return "QA";
}

const map = getAclMap();
return map[email] || "AGENT";
}

function requireRole(allowedRoles) {
const role = getMyRole();
if (!allowedRoles.includes(role)) {
const email = Session.getActiveUser().getEmail() || "Sconosciuto";
throw new Error(`SECURITY EXCEPTION: Accesso negato all'account '${email}' [${role}]. Autorizzazione richiesta: ${allowedRoles.join(', ')}`);
}
}

function setAclUser(email, role) {
requireRole(['QA', 'TL', 'OPS']);
const lock = LockService.getScriptLock();
if (!lock.tryLock(5000)) return { success: false, error: "Sottosistema di sicurezza occupato." };

try {
const sheet = _getAclSheet();
const lastRow = sheet.getLastRow();
let targetEmail = email.toLowerCase().trim();
let targetRole = role.toUpperCase().trim();
let updated = false;

if (lastRow > 1) {
const data = sheet.getRange(1, 1, lastRow, 1).getValues();
for (let i = 1; i < data.length; i++) {
if (data[i][0].toString().toLowerCase().trim() === targetEmail) {
sheet.getRange(i + 1, 2).setValue(targetRole);
updated = true;
break;
}
}
}

if (!updated) {
sheet.appendRow([targetEmail, targetRole, new Date().toISOString()]);
}

CacheService.getScriptCache().remove("FLOWPILOT_ACL_MAP");
return { success: true, acl: getAclMap() };
} catch (e) {
return { success: false, error: e.message };
} finally {
lock.releaseLock();
}
}

function removeAclUser(email) {
requireRole(['QA', 'TL', 'OPS']);
const targetEmail = email.toLowerCase().trim();

const lock = LockService.getScriptLock();
if (!lock.tryLock(5000)) return { success: false, error: "Sottosistema di sicurezza occupato." };

try {
const sheet = _getAclSheet();
const lastRow = sheet.getLastRow();
let deleted = false;

if (lastRow > 1) {
const data = sheet.getRange(1, 1, lastRow, 1).getValues();
for (let i = data.length - 1; i >= 1; i--) {
if (data[i][0].toString().toLowerCase().trim() === targetEmail) {
sheet.deleteRow(i + 1);
deleted = true;
break;
}
}
}

if (!deleted) return { success: false, error: "Utente non trovato nel database ACL." };

CacheService.getScriptCache().remove("FLOWPILOT_ACL_MAP");
return { success: true, acl: getAclMap() };
} catch (e) {
return { success: false, error: e.message };
} finally {
lock.releaseLock();
}
}

function doGet(e) {
const faviconUrl = "https://example.invalid/favicon.ico";
let teamContext = getMyRole();

if (e && e.parameter && e.parameter.forceRole) {
let requested = e.parameter.forceRole.toUpperCase();
if (['QA', 'AGENT', 'OPS', 'TL'].includes(requested)) {
teamContext = requested;
}
}

const userEmail = Session.getActiveUser().getEmail() || "Sconosciuto";

const template = HtmlService.createTemplateFromFile('Index');
template.TEAM_CONTEXT = teamContext;
template.USER_EMAIL = userEmail;

return template.evaluate()
.setTitle(`FlowPilot - Workspace ${teamContext}`)
.setFaviconUrl(faviconUrl)
.addMetaTag('viewport', 'width=device-width, initial-scale=1')
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
* =========================================
* QUICK PINS & DASHBOARD ENGINE (NATIVE SHEET DB)
* =========================================
*/

function _getPinsSheet() {
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
let sheet = ss.getSheetByName(PINS_SHEET_NAME);
if (!sheet) {
sheet = ss.insertSheet(PINS_SHEET_NAME);
sheet.appendRow(["ID", "TITLE", "URL", "AGENT_VISIBLE", "ADDED_BY", "TIMESTAMP"]);
sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#3b82f6").setFontColor("#ffffff");
sheet.setFrozenRows(1);
}
return sheet;
}

function getPinsData() {
try {
const sheet = _getPinsSheet();
const lastRow = sheet.getLastRow();
if (lastRow <= 1) return { success: true, data: [] };

const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
const role = getMyRole();
const isAgent = role === "AGENT";
const result = [];

for (let i = 0; i < data.length; i++) {
const row = data[i];
const isAgentVisible = row[3] === true || row[3] === "TRUE" || row[3] === "true";

if (!isAgent || isAgentVisible) {
result.push({
id: row[0].toString(),
title: row[1].toString(),
url: row[2].toString(),
agentVisible: isAgentVisible,
addedBy: row[4] ? row[4].toString() : "System"
});
}
}
return { success: true, data: result };
} catch (e) {
return { success: false, error: e.message };
}
}

function saveQuickPinData(payloadStr) {
requireRole(['QA', 'TL', 'OPS']);
const lock = LockService.getScriptLock();
if (!lock.tryLock(5000)) return { success: false, error: "Database occupato. Riprova." };

try {
const payload = JSON.parse(payloadStr);
const sheet = _getPinsSheet();
const data = sheet.getDataRange().getValues();
const timestamp = new Date().toISOString();
let authorEmail = "System";
try { authorEmail = Session.getActiveUser().getEmail().split('@')[0]; } catch (e) { }

if (payload.id) {
let updated = false;
for (let i = 1; i < data.length; i++) {
if (data[i][0].toString() === payload.id) {
sheet.getRange(i + 1, 2, 1, 3).setValues([[payload.title, payload.url, payload.agentVisible]]);
updated = true;
break;
}
}
if (!updated) throw new Error("Collegamento non trovato nel database.");
} else {
sheet.appendRow([
Date.now().toString(),
payload.title,
payload.url,
payload.agentVisible || false,
authorEmail,
timestamp
]);
}
return { success: true };
} catch (e) {
return { success: false, error: e.message };
} finally {
lock.releaseLock();
}
}

function deleteQuickPinData(id) {
requireRole(['QA', 'TL', 'OPS']);
const lock = LockService.getScriptLock();
if (!lock.tryLock(5000)) return { success: false, error: "Database occupato." };

try {
const sheet = _getPinsSheet();
const data = sheet.getDataRange().getValues();
for (let i = data.length - 1; i >= 1; i--) {
if (data[i][0].toString() === id.toString()) {
sheet.deleteRow(i + 1);
return { success: true };
}
}
return { success: false, error: "Collegamento non trovato." };
} catch (e) {
return { success: false, error: e.message };
} finally {
lock.releaseLock();
}
}

/**
* =========================================
* PULSE BROADCASTING SYSTEM (PRIORITY SUPPORT)
* =========================================
*/

function _getBroadcastSheet() {
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
let sheet = ss.getSheetByName(BROADCAST_SHEET_NAME);
if (!sheet) {
sheet = ss.insertSheet(BROADCAST_SHEET_NAME);
sheet.appendRow(["ID", "AUTHOR", "WORKFLOW_TARGET", "SCHEDULED_TIMESTAMP", "MESSAGE_PAYLOAD", "PRIORITY"]);
sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#0f172a").setFontColor("#f8fafc");
sheet.setFrozenRows(1);
sheet.setColumnWidth(5, 500);
}
return sheet;
}

function fetchBroadcasts(workflow) {
try {
const sheet = _getBroadcastSheet();
const lastRow = sheet.getLastRow();
if (lastRow <= 1) return { success: true, data: [] };

const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
const now = new Date().getTime();
const role = getMyRole();
const isAgent = role === "AGENT";
const result = [];

for (let i = 0; i < data.length; i++) {
const row = data[i];
const targetWf = row[2] ? row[2].toString().trim() : "ALL";

if (targetWf === "ALL" || targetWf === workflow) {
const timestamp = new Date(row[3]).getTime();

if (!isAgent || timestamp <= now) {
result.push({
id: row[0].toString(),
author: row[1].toString(),
target: targetWf,
scheduled: row[3].toString(),
payload: row[4].toString(),
priority: row[5] ? row[5].toString() : "NORMAL"
});
}
}
}

result.sort((a, b) => new Date(b.scheduled).getTime() - new Date(a.scheduled).getTime());
return { success: true, data: result };
} catch (e) {
return { success: false, error: e.message };
}
}

function publishBroadcast(payloadStr) {
requireRole(['QA', 'TL', 'OPS']);
const lock = LockService.getScriptLock();
if (!lock.tryLock(5000)) return { success: false, error: "System busy. Try again." };
try {
const payload = JSON.parse(payloadStr);
const sheet = _getBroadcastSheet();

let authorEmail = "System";
try { authorEmail = Session.getActiveUser().getEmail().split('@')[0]; } catch (e) { }

const scheduledDate = payload.scheduled ? new Date(payload.scheduled).toISOString() : new Date().toISOString();
const priority = payload.priority || "NORMAL";

sheet.appendRow([
Date.now().toString(),
authorEmail,
payload.target || "ALL",
scheduledDate,
payload.message || "",
priority
]);

return { success: true };
} catch (e) {
return { success: false, error: e.message };
} finally {
lock.releaseLock();
}
}

function deleteBroadcast(id) {
requireRole(['QA', 'TL', 'OPS']);
const lock = LockService.getScriptLock();
if (!lock.tryLock(5000)) return { success: false, error: "System busy." };
try {
const sheet = _getBroadcastSheet();
const data = sheet.getDataRange().getValues();
for (let i = data.length - 1; i >= 1; i--) {
if (data[i][0].toString() === id.toString()) {
sheet.deleteRow(i + 1);
return { success: true };
}
}
return { success: false, error: "Broadcast not found." };
} catch (e) {
return { success: false, error: e.message };
} finally {
lock.releaseLock();
}
}

/**
* =========================================
* GLOBAL STATE ENGINE 2.0 (100% NATIVE SHEETS DB)
* =========================================
*/

function _getGlobalStateSheet() {
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
let sheet = ss.getSheetByName(GLOBAL_STATE_SHEET_NAME);
if (!sheet) {
sheet = ss.insertSheet(GLOBAL_STATE_SHEET_NAME);
sheet.appendRow(["TEAM_CONTEXT", "CHUNK_INDEX", "PAYLOAD_DATA"]);
sheet.getRange("A1:C1").setFontWeight("bold").setBackground("#0f172a").setFontColor("#f8fafc");
sheet.setFrozenRows(1);
sheet.setColumnWidth(1, 150);
sheet.setColumnWidth(2, 100);
sheet.setColumnWidth(3, 800);
}
return sheet;
}

function saveGlobalData(payloadString, team) {
requireRole(['QA', 'TL', 'OPS']);
const lock = LockService.getScriptLock();
if (!lock.tryLock(15000)) return { status: "error", message: "System busy (Storage Lock). Try again later." };
try {
const sheet = _getGlobalStateSheet();
const data = sheet.getDataRange().getValues();
for (let i = data.length - 1; i >= 1; i--) {
if (data[i][0] === team) {
sheet.deleteRow(i + 1);
}
}

const CHUNK_SIZE = 45000;
const totalChunks = Math.ceil(payloadString.length / CHUNK_SIZE);
const rowsToInsert = [];

for (let i = 0; i < totalChunks; i++) {
const chunk = payloadString.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
rowsToInsert.push([team, i, chunk]);
}

if (rowsToInsert.length > 0) {
sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, 3).setValues(rowsToInsert);
}

try {
const scriptProps = PropertiesService.getScriptProperties();
const keys = scriptProps.getKeys().filter(k => k.startsWith(`${team}_GLOBAL_`));
keys.forEach(k => scriptProps.deleteProperty(k));
} catch(e) { }

return { status: "success" };
} catch (error) {
return { status: "error", message: error.toString() };
} finally {
lock.releaseLock();
}
}

function loadGlobalData(team) {
try {
const sheet = _getGlobalStateSheet();
const lastRow = sheet.getLastRow();
if (lastRow <= 1) return fallbackLoadGlobalData_(team);

const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
const teamChunks = data.filter(row => row[0] === team);
if (teamChunks.length === 0) return fallbackLoadGlobalData_(team);

teamChunks.sort((a, b) => parseInt(a[1]) - parseInt(b[1]));

let assembled = "";
for (let i = 0; i < teamChunks.length; i++) {
assembled += teamChunks[i][2];
}

return assembled ? JSON.parse(assembled) : null;
} catch (e) {
Logger.log("Error loading global state: " + e.message);
return fallbackLoadGlobalData_(team);
}
}

function fallbackLoadGlobalData_(team) {
const prefixKey = `${team}_GLOBAL`;
const scriptProps = PropertiesService.getScriptProperties();
const countStr = scriptProps.getProperty(`${prefixKey}_COUNT`);
if (!countStr) return null;

const count = parseInt(countStr, 10);
let assembled = "";
for (let i = 0; i < count; i++) {
const chunk = scriptProps.getProperty(`${prefixKey}_CHUNK_${i}`);
if (chunk) assembled += chunk;
}

try {
return assembled ? JSON.parse(assembled) : null;
} catch (e) {
return null;
}
}

/**
* SALVATAGGIO DI EMERGENZA NEL CLOUD (HYBRID GOOGLE DRIVE BYPASS)
*/
function syncDataToCloud(payloadString, team) {
requireRole(['QA', 'TL', 'OPS']);
const lock = LockService.getScriptLock();
if (!lock.tryLock(10000)) return { status: "error", message: "Server occupato. Riprova più tardi." };
try {
const spreadsheet = SpreadsheetApp.openById(TARGET_DB_ID);
const tabName = `${team}_Backups`;
let sheet = spreadsheet.getSheetByName(tabName);

if (!sheet) {
sheet = spreadsheet.insertSheet(tabName);
sheet.appendRow(["Data e Ora", "Operatore", "Totale Valigia", "Totale POC", "Backup Location"]);
sheet.getRange("A1:E1").setFontWeight("bold");
}

let user = "Sconosciuto";
try {
user = Session.getActiveUser().getEmail();
if (!user || user === "") {
user = Session.getEffectiveUser().getEmail() + " (Auto-Trigger)";
}
} catch (e) { }

let totaleValigia = 0;
let totalePoc = 0;
try {
const parsed = JSON.parse(payloadString);
if (parsed.db && Array.isArray(parsed.db)) totaleValigia = parsed.db.length;
if (parsed.pocs && Array.isArray(parsed.pocs)) totalePoc = parsed.pocs.length;
} catch (e) {
Logger.log("Impossibile estrarre metriche: " + e.message);
}

let backupUrl = payloadString;

if (payloadString.length > 45000) {
const targetFile = DriveApp.getFileById(TARGET_DB_ID);
const parents = targetFile.getParents();
let parentFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
let backupFolders = parentFolder.getFoldersByName("FlowPilot_Backups");
let backupFolder = backupFolders.hasNext() ? backupFolders.next() : parentFolder.createFolder("FlowPilot_Backups");
const fileName = `Backup_${team}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
const file = backupFolder.createFile(fileName, payloadString, MimeType.PLAIN_TEXT);
backupUrl = file.getUrl();
}

sheet.appendRow([new Date().toISOString(), user, totaleValigia, totalePoc, backupUrl]);
return { status: "success", message: `Backup completato!` };
} catch (error) {
return { status: "error", message: error.toString() };
} finally {
lock.releaseLock();
}
}

function emergencyRestoreFromSheet() {
requireRole(['QA', 'TL', 'OPS']);
const team = "QA";
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
const sheet = ss.getSheetByName(`${team}_Backups`);

if (!sheet) {
Logger.log("❌ Errore: Tab dei backup non trovata.");
return;
}

const lastRow = sheet.getLastRow();
if (lastRow < 2) {
Logger.log("❌ Errore: Nessun backup presente nella tab.");
return;
}

const lastRowData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
let payloadStr = "";
const backupDataCell = String(lastRowData[4]);

if (backupDataCell.includes("drive.google.com/file/d/")) {
const match = backupDataCell.match(/\/d\/([a-zA-Z0-9-_]+)/);
if (match && match[1]) {
const fileId = match[1];
try {
payloadStr = DriveApp.getFileById(fileId).getBlob().getDataAsString();
Logger.log("✅ Backup scaricato da Google Drive.");
} catch (e) {
Logger.log("❌ Errore lettura file Drive: " + e.message);
return;
}
}
} else if (backupDataCell.startsWith('{"db":') || backupDataCell.includes('"db":[')) {
payloadStr = backupDataCell;
}

if (!payloadStr) {
Logger.log("❌ Errore: Nessun JSON valido o link Drive trovato nell'ultima riga di backup.");
return;
}

try {
JSON.parse(payloadStr);
saveGlobalData(payloadStr, team);
Logger.log(`✅ RIPRISTINO D'EMERGENZA COMPLETATO CON SUCCESSO! Ricarica l'applicazione.`);
} catch (e) {
Logger.log(`❌ Errore fatale durante il ripristino: Il file JSON è corrotto. Error: ${e.message}`);
}
}

/**
* =========================================
* KNOWLEDGE BASE METRICS ENGINE
* =========================================
*/
function getKnowledgeMetrics() {
const cache = CacheService.getScriptCache();
const cached = cache.get("FLOWPILOT_KB_METRICS");
if (cached) return { success: true, data: JSON.parse(cached) };

try {
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
const sheets = ss.getSheets();
const metrics = {};

for (let s of sheets) {
const sheetName = s.getName();
if (sheetName.startsWith("ALIGNMENTS_DB_")) {
const lastRow = s.getLastRow();
if (lastRow < 2) continue;

const data = s.getRange(2, 2, lastRow - 1, 2).getValues();

for (let i = 0; i < data.length; i++) {
const wf = (data[i][0] || "Uncategorized").toString().trim();
const ch = (data[i][1] || "General KB").toString().trim();

if (!metrics[ch]) metrics[ch] = { _total: 0 };
if (!metrics[ch][wf]) metrics[ch][wf] = 0;

metrics[ch][wf]++;
metrics[ch]._total++;
}
}
}

cache.put("FLOWPILOT_KB_METRICS", JSON.stringify(metrics), 3600);
return { success: true, data: metrics };
} catch (e) {
return { success: false, data: {} };
}
}

/**
* =========================================
* STUDIO L2 CACHE ENGINE & MATRIX MINING
* =========================================
*/

function saveToCacheService(key, value, ttlSeconds) {
try {
const cache = CacheService.getScriptCache();
const chunkSize = 90000;
const totalChunks = Math.ceil(value.length / chunkSize);
cache.put(`${key}_CCOUNT`, totalChunks.toString(), ttlSeconds);

for (let i = 0; i < totalChunks; i++) {
cache.put(`${key}_CCHUNK_${i}`, value.substring(i * chunkSize, (i + 1) * chunkSize), ttlSeconds);
}
} catch (e) {
Logger.log(`Allocazione Cache bypassata: ${e.message}`);
}
}

function loadFromCacheService(key) {
try {
const cache = CacheService.getScriptCache();
const countStr = cache.get(`${key}_CCOUNT`);
if (!countStr) return null;

const count = parseInt(countStr, 10);
let assembled = "";
for (let i = 0; i < count; i++) {
const chunk = cache.get(`${key}_CCHUNK_${i}`);
if (chunk) assembled += chunk;
}
return assembled || null;
} catch (e) {
return null;
}
}

function getSheetMetadata(spreadsheetId) {
requireRole(['QA', 'TL', 'OPS']);
try {
const ss = SpreadsheetApp.openById(spreadsheetId);
return { success: true, metadata: ss.getSheets().map(s => ({ name: s.getName(), lastRow: s.getLastRow(), id: s.getSheetId() })) };
} catch (e) {
return { success: false, error: e.message };
}
}

function getSheetHeaders(config) {
requireRole(['QA', 'TL', 'OPS']);
try {
const rangeName = "'" + config.sheetName + "'!" + config.headerRow + ":" + config.headerRow;
const response = Sheets.Spreadsheets.Values.get(config.spreadsheetId, rangeName);

if (!response.values || response.values.length === 0) return { success: true, headers: [] };
return { success: true, headers: response.values[0].map((h, i) => ({ name: h || `Col ${i + 1}`, index: i })) };
} catch (e) {
return { success: false, error: e.message };
}
}

function fetchFullSheetData(config) {
requireRole(['QA', 'TL', 'OPS']);
try {
const cleanSheetName = config.sheetName.replace(/[^a-zA-Z0-9]/g, '_');
const cacheKey = `STUDIO_DATA_${config.spreadsheetId}_${cleanSheetName}_H${config.headerRow}`;

const cachedString = loadFromCacheService(cacheKey);
if (cachedString) {
return { success: true, data: JSON.parse(cachedString), cached: true };
}

const rangeName = "'" + config.sheetName + "'";
const response = Sheets.Spreadsheets.Values.get(config.spreadsheetId, rangeName, { valueRenderOption: 'FORMATTED_VALUE' });
const values = response.values || [];
const headerRowIdx = parseInt(config.headerRow) || 1;

if (values.length <= headerRowIdx) return { success: true, data: [] };

let processedData = [];
for (let i = headerRowIdx; i < values.length; i++) {
const row = values[i];
if (row.some(cell => cell && cell.toString().trim() !== "")) {
processedData.push({ realRowIndex: i + 1, cells: row });
}
}

saveToCacheService(cacheKey, JSON.stringify(processedData), 240);
return { success: true, data: processedData, cached: false };
} catch (e) {
return { success: false, error: e.message };
}
}

function saveSheetConfig(config) {
requireRole(['QA', 'TL', 'OPS']);
try {
const key = `V26_CFG_${config.spreadsheetId}_${config.sheetName}`;
PropertiesService.getUserProperties().setProperty(key, JSON.stringify({ headerRow: config.headerRow, mapping: config.mapping }));
return { success: true };
} catch (e) {
return { success: false };
}
}

function loadSheetConfig(config) {
requireRole(['QA', 'TL', 'OPS']);
try {
const key = `V26_CFG_${config.spreadsheetId}_${config.sheetName}`;
const saved = PropertiesService.getUserProperties().getProperty(key);
if (saved) return { success: true, config: JSON.parse(saved) };
return { success: false };
} catch (e) {
return { success: false };
}
}

function searchAdvancedMultiTab(config) {
requireRole(['QA', 'TL', 'OPS']);
try {
const ss = SpreadsheetApp.openById(config.spreadsheetId);
const results = [];
const maxResults = 40;

const rules = {
query: /context|query|prompt|input|topic|domanda|user/i,
response: /response|reply|output|answer|model|risposta|bot/i,
verdict: /final verdict|verdict|label|policy|labeling|explanation|logic/i,
discussion: /discussion|explanation|logic|reasoning|comments|note|description/i
};

for (let t = 0; t < config.tabs.length; t++) {
const tabName = config.tabs[t];
const sheet = ss.getSheetByName(tabName);
if (!sheet) continue;

const lastCol = Math.max(sheet.getLastColumn(), 1);
if (lastCol === 0) continue;

const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
const configKey = "V26_CFG_" + config.spreadsheetId + "_" + tabName;
const savedStr = PropertiesService.getUserProperties().getProperty(configKey);
let savedMap = null;

if (savedStr) {
try { savedMap = JSON.parse(savedStr).mapping; } catch (e) { }
}

let mapping = { query: -1, response: -1, verdict: -1, discussion: -1 };

if (savedMap) {
if (savedMap.user !== undefined && savedMap.user !== "") mapping.query = parseInt(savedMap.user);
if (savedMap.bot !== undefined && savedMap.bot !== "") mapping.response = parseInt(savedMap.bot);
if (savedMap.explanation !== undefined && savedMap.explanation !== "") mapping.verdict = parseInt(savedMap.explanation);
if (savedMap.description !== undefined && savedMap.description !== "") mapping.discussion = parseInt(savedMap.description);
}

for (let c = 0; c < headers.length; c++) {
let h = headers[c].toLowerCase();
if (mapping.query === -1 && rules.query.test(h)) mapping.query = c;
if (mapping.response === -1 && rules.response.test(h)) mapping.response = c;
if (mapping.verdict === -1 && rules.verdict.test(h)) mapping.verdict = c;
if (mapping.discussion === -1 && rules.discussion.test(h)) mapping.discussion = c;
}

const finder = sheet.createTextFinder(config.query).useRegularExpression(false);
const matches = finder.findAll();
const rowsFound = new Set();

for (let i = 0; i < matches.length; i++) {
if (results.length >= maxResults) break;
const r = matches[i].getRow();
if (r <= 1 || rowsFound.has(r)) continue;

rowsFound.add(r);
const rowValues = sheet.getRange(r, 1, 1, lastCol).getDisplayValues()[0];
results.push({ sheetName: tabName, row: r, headers: headers, rowData: rowValues, mapping: mapping });
}
if (results.length >= maxResults) break;
}
return { success: true, results: results };
} catch (e) {
return { success: false, error: e.message };
}
}

function searchGlobalFast(config) {
requireRole(['QA', 'TL', 'OPS']);
try {
const ss = SpreadsheetApp.openById(config.spreadsheetId);
const finder = ss.createTextFinder(config.query).useRegularExpression(false);
const results = finder.findAll();
return { success: true, results: results.slice(0, 10).map(r => ({ sheetName: r.getSheet().getName(), row: r.getRow() })) };
} catch (e) {
return { success: false, error: e.message };
}
}

/**
* =========================================
* MULTIMODAL & LENS VAULT ENGINE
* =========================================
*/

function uploadImageToDrive(base64Data, mimeType, filename) {
requireRole(['QA', 'TL', 'OPS']);
const lock = LockService.getScriptLock();
if (!lock.tryLock(15000)) return { success: false, error: "System busy (Storage Lock). Try again later." };
try {
if (!LENS_VAULT_FOLDER_ID) throw new Error("Lens Vault Folder ID non configurato.");
const cleanBase64 = base64Data.indexOf(',') !== -1 ? base64Data.split(',')[1] : base64Data;
const decoded = Utilities.base64Decode(cleanBase64);
const blob = Utilities.newBlob(decoded, mimeType || 'image/png', filename || `Screenshot_${Date.now()}.png`);
const folder = DriveApp.getFolderById(LENS_VAULT_FOLDER_ID);
const file = folder.createFile(blob);
return { success: true, url: file.getUrl(), id: file.getId() };
} catch (e) {
return { success: false, error: e.message };
} finally {
lock.releaseLock();
}
}

/**
* =========================================
* OPS NEURAL CANVAS ENGINE
* =========================================
*/

function _getCanvasSheet() {
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
let sheet = ss.getSheetByName(CANVAS_SHEET_NAME);
if (!sheet) {
sheet = ss.insertSheet(CANVAS_SHEET_NAME);
sheet.appendRow(["CHUNK_INDEX", "PAYLOAD_DATA"]);
sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#0f172a").setFontColor("#f8fafc");
sheet.setFrozenRows(1);
}
return sheet;
}

function saveCanvasState(payloadString) {
requireRole(['OPS', 'TL', 'QA']);
const lock = LockService.getScriptLock();
if (!lock.tryLock(10000)) return { success: false, error: "System busy. Try again." };

try {
const sheet = _getCanvasSheet();
const lastRow = sheet.getLastRow();
if (lastRow > 1) {
sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
}

const CHUNK_SIZE = 45000;
const totalChunks = Math.ceil(payloadString.length / CHUNK_SIZE);
const rowsToInsert = [];

for (let i = 0; i < totalChunks; i++) {
const chunk = payloadString.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
rowsToInsert.push([i, chunk]);
}

if (rowsToInsert.length > 0) {
sheet.getRange(2, 1, rowsToInsert.length, 2).setValues(rowsToInsert);
}
return { success: true };
} catch (e) {
return { success: false, error: e.message };
} finally {
lock.releaseLock();
}
}

function loadCanvasState() {
requireRole(['OPS', 'TL', 'QA', 'AGENT']);
try {
const sheet = _getCanvasSheet();
const lastRow = sheet.getLastRow();
if (lastRow <= 1) return { success: true, data: null };

const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
data.sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

let assembled = "";
for (let i = 0; i < data.length; i++) {
if (data[i][1]) assembled += data[i][1];
}

return { success: true, data: assembled ? JSON.parse(assembled) : null };
} catch (e) {
return { success: false, error: e.message };
}
}