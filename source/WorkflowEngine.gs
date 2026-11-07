/**
* =========================================
* FLOWPILOT BACKEND ENGINE (GAS V8)
* Pipeline: Multi-Tab Workflow Architecture (100% Lazy Init)
* Target: Google Sheets Database Segregation & Zero-Trust Security
* =========================================
*/

/**
* UTILITY: Genera il nome sicuro del Tab (es. "DEMO" -> "ALIGNMENTS_DB_DEMO")
*/
function getSafeSheetName_(workflow) {
const safeName = workflow.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
return 'ALIGNMENTS_DB_' + safeName;
}

/**
* LAZY INITIALIZATION ENGINE: Crea fisicamente un nuovo Tab nel database se non esiste
*/
function createWorkflowSheet(workflowName) {
requireRole(['QA', 'TL', 'OPS']); // SECURITY PATCH: Blocco lato server
const lock = LockService.getScriptLock();
lock.waitLock(10000);
try {
const ss = SpreadsheetApp.openById(TARGET_DB_ID); // Usa costantemente il DB Centrale
const sheetName = getSafeSheetName_(workflowName);

let sheet = ss.getSheetByName(sheetName);
if (!sheet) {
sheet = ss.insertSheet(sheetName);
// Intestazioni Standard
const headers = ["DATE", "VERDICT", "USER_PROMPT", "BOT_RESPONSE", "DESCRIPTION", "CHANNEL", "HISTORY_JSON"];
const headerRange = sheet.getRange(1, 1, 1, headers.length);
headerRange.setValues([headers])
.setFontWeight("bold")
.setBackground("#0f172a")
.setFontColor("#f8fafc");
sheet.setFrozenRows(1);
sheet.setColumnWidths(1, headers.length, 150);
sheet.setColumnWidth(3, 400); // Prompt più largo
sheet.setColumnWidth(4, 400); // Bot Response più largo
}
return { success: true, sheetName: sheetName };
} catch (e) {
return { success: false, error: e.toString() };
} finally {
lock.releaseLock();
}
}

/**
* Legge tutte le InfoCards da un Workflow specifico
* GRACEFUL DEGRADATION: Nessun blocco se il tab non esiste (Lazy Read).
*/
function fetchAlignments(workflow) {
try {
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
const sheetName = getSafeSheetName_(workflow);
const sheet = ss.getSheetByName(sheetName);
if (!sheet) return { success: true, data: [] }; // Tab non ancora creato (ritorna vuoto pulito)

const data = sheet.getDataRange().getValues();
if (data.length <= 1) return { success: true, data: [] }; // Solo header o vuoto

const rows = data.slice(1);
const result = rows.map(row => {
let historyParsed = []; // Inizializzazione standard forzata ad Array
if (row[6]) {
try {
let parsed = JSON.parse(row[6].toString());
if (Array.isArray(parsed)) {
historyParsed = parsed;
} else if (parsed && typeof parsed === 'object') {
historyParsed = [parsed]; // TYPE NORMALIZER: Forza oggetto singolo ad array
}
} catch(err) {
historyParsed = []; // Fail-safe se il JSON è corrotto
}
}
return {
date: row[0],
verdict: row[1] ? row[1].toString() : "Review",
user: row[2] ? row[2].toString() : "",
bot: row[3] ? row[3].toString() : "",
description: row[4] ? row[4].toString() : "",
channel: row[5] ? row[5].toString() : "General KB",
_history: historyParsed
};
});
return { success: true, data: result };
} catch (e) {
return { success: false, error: e.toString() };
}
}

/**
* Scrive le InfoCards nel tab specifico del Workflow
* LAZY INIT: Auto-creazione della struttura se il workflow è nuovo.
*/
function publishAlignments(payloadStr, workflow) {
requireRole(['QA', 'TL', 'OPS']); // SECURITY PATCH: Previene iniezioni via console dagli Agenti
const lock = LockService.getScriptLock();
lock.waitLock(10000);
try {
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
const sheetName = getSafeSheetName_(workflow);
let sheet = ss.getSheetByName(sheetName);

// Fail-safe (Lazy Init): Se il tab non esiste, lo crea al volo
if (!sheet) {
createWorkflowSheet(workflow);
sheet = ss.getSheetByName(sheetName);
}

const items = JSON.parse(payloadStr);
const rowsToInsert = items.map(item => [
item.date,
item.verdict || "Review",
item.user || "",
item.bot || "",
item.description || "",
item.channel || "General KB",
item.history_json || "" // PATCH: Permette inserimento history se fornita alla creazione
]);

if (rowsToInsert.length > 0) {
sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
}
return { success: true, count: rowsToInsert.length };
} catch (e) {
return { success: false, error: e.toString() };
} finally {
lock.releaseLock();
}
}

/**
* Aggiorna una singola InfoCard (Cerca per Data + Prompt Originale)
* BATCH CRUD OPTIMIZATION APPLICATA
*/
function updateAlignment(dateStr, workflow, updatedData, originalData) {
requireRole(['QA', 'TL', 'OPS']); // SECURITY PATCH: Impedisce alterazioni non autorizzate
const lock = LockService.getScriptLock();
lock.waitLock(10000);
try {
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
const sheetName = getSafeSheetName_(workflow);
const sheet = ss.getSheetByName(sheetName);
if (!sheet) throw new Error("Database tab missing for this workflow.");

const data = sheet.getDataRange().getValues();
const targetDate = new Date(dateStr).getTime();

for (let i = 1; i < data.length; i++) {
let rowDate = new Date(data[i][0]).getTime();
// Match esatto: Stessa data + Stesso User Prompt Originale + Stessa Bot Response
if (rowDate === targetDate && data[i][2] == originalData.user && data[i][3] == originalData.bot) {
let finalHistoryStr = "";
// PATCH: Priotizza la history esatta iniettata dal frontend
if (updatedData.history_json) {
finalHistoryStr = updatedData.history_json;
} else if (updatedData.HISTORY_JSON) {
finalHistoryStr = updatedData.HISTORY_JSON;
} else if (updatedData._history) {
finalHistoryStr = typeof updatedData._history === 'string' ? updatedData._history : JSON.stringify(updatedData._history);
} else {
// Fallback se il frontend non manda history: concatena il vecchio stato
let currentHistory = [];
if (data[i][6]) {
try {
let parsed = JSON.parse(data[i][6]);
if (Array.isArray(parsed)) currentHistory = parsed;
else if (parsed) currentHistory = [parsed];
} catch(err) {}
}
const legacyBlock = {
date: new Date(data[i][0]).toISOString(), // Preserva la timestamp esatta della transazione originale
verdict: data[i][1],
description: data[i][4]
};
currentHistory.unshift(legacyBlock);
finalHistoryStr = JSON.stringify(currentHistory);
}

const currentChannel = data[i][5] || "General KB";
// PARADOSSO TEMPORALE FIX:
// Il Master Record deve ereditare il tempo presente (o la data specificata dal frontend).
const newMasterDate = updatedData.date ? updatedData.date : new Date().toISOString();
// Vettore dati per update massivo (Colonna A -> Colonna G)
const updateArray = [[
newMasterDate, // A: Nuova Data Aggiornata
updatedData.verdict, // B
updatedData.user, // C
updatedData.bot, // D
updatedData.description, // E
currentChannel, // F
finalHistoryStr // G
]];
// Singola chiamata API modificata: Aggiorna 7 colonne partendo dalla 1 (DATE)
sheet.getRange(i + 1, 1, 1, 7).setValues(updateArray);
return { success: true, message: "InfoCard updated successfully." };
}
}
return { success: false, error: "Record not found in the database." };
} catch (e) {
return { success: false, error: e.toString() };
} finally {
lock.releaseLock();
}
}

/**
* Elimina fisicamente un'InfoCard dal Tab
*/
function deleteAlignment(dateStr, workflow, originalData) {
requireRole(['QA', 'TL', 'OPS']); // SECURITY PATCH: Impedisce cancellazioni tramite API
const lock = LockService.getScriptLock();
lock.waitLock(10000);
try {
const ss = SpreadsheetApp.openById(TARGET_DB_ID);
const sheetName = getSafeSheetName_(workflow);
const sheet = ss.getSheetByName(sheetName);
if (!sheet) throw new Error("Database tab missing for this workflow.");

const data = sheet.getDataRange().getValues();
const targetDate = new Date(dateStr).getTime();

for (let i = data.length - 1; i >= 1; i--) { // Ciclo inverso per evitare slittamento indici
let rowDate = new Date(data[i][0]).getTime();
if (rowDate === targetDate && data[i][2] == originalData.user && data[i][3] == originalData.bot) {
sheet.deleteRow(i + 1);
return { success: true, message: "InfoCard deleted permanently." };
}
}
return { success: false, error: "Record not found." };
} catch (e) {
return { success: false, error: e.toString() };
} finally {
lock.releaseLock();
}
}