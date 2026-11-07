// File: OpsModule_Studio.gs

/**
* ==========================================
* FLOWPILOT AUTOMATION - STUDIO MICROSERVICE
* Architecture: Isolated Backend Module
* Description: Example workflow automation, document copies, audit logging and dynamic dropdown APIs.
* ==========================================
*/

const STUDIO_CONFIG = {
mainSpreadsheetId: PropertiesService.getScriptProperties().getProperty('STUDIO_MAIN_DB') || '',
auditTabName: 'Audit_Log'
};

/**
* ==========================================
* SECTION 1: RPC API FOR FRONTEND (DYNAMIC DROPDOWNS)
* ==========================================
*/

/**
* Recupera la lista degli agenti per il dropdown dinamico della UI Canvas.
* @param {string} workflowName Nome della tab nel DB Spreadsheet.
* @returns {Array<Object>} Array di agenti {id, name, email}.
*/
function getAgentsForDropdown(workflowName) {
if (!workflowName) return [];
if (typeof requireRole === 'function') requireRole(['OPS', 'QA', 'TL']);
const cacheKey = `STUDIO_AGENTS_${workflowName.replace(/\s+/g, '_')}`;
const cache = CacheService.getScriptCache();
let agentsData = cache.get(cacheKey);

if (!agentsData) {
try {
const ss = SpreadsheetApp.openById(STUDIO_CONFIG.mainSpreadsheetId);
const sheet = ss.getSheetByName(workflowName);
if (!sheet) return [];
const lastRow = sheet.getLastRow();
if (lastRow < 3) return [];

const rawData = sheet.getRange(`B3:D${lastRow}`).getValues();
const agentsArray = rawData.map(([id, name, email]) => {
if (!id || !String(id).trim() || !email || !String(email).trim()) return null;
return {
id: String(id).trim(),
name: name ? String(name).trim() : String(id).trim(),
email: String(email).trim()
};
}).filter(Boolean);

agentsData = JSON.stringify(agentsArray);
cache.put(cacheKey, agentsData, 60);
} catch (e) {
console.error("Studio DB Fetch Error: " + e.message);
return [];
}
}
return JSON.parse(agentsData);
}

/**
* Recupera i thread recenti di un agente da Gmail per la selezione manuale.
* @param {string} agentEmail L'email estratta dall'agente selezionato.
* @returns {Array<Object>} Array dei 5 thread più recenti {id, subject, date}.
*/
function getThreadsForDropdown(agentEmail) {
if (!agentEmail) return [];
if (typeof requireRole === 'function') requireRole(['OPS', 'QA', 'TL']);
try {
const query = `to:${agentEmail} OR from:${agentEmail}`;
const threads = GmailApp.search(query, 0, 5);
return threads.map(t => {
const subjectRaw = t.getFirstMessageSubject() || '(No Subject)';
const shortSubject = subjectRaw.length > 50 ? subjectRaw.substring(0, 50) + '...' : subjectRaw;
return {
id: t.getId(),
subject: shortSubject,
date: Utilities.formatDate(t.getLastMessageDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
};
});
} catch (e) {
console.error("Studio Gmail Fetch Error: " + e.message);
return [];
}
}


/**
* ==========================================
* SECTION 2: CORE EXECUTION ENGINE
* ==========================================
*/

/**
* Entry point invocato da OpsWorkflowEngine.gs quando incontra il nodo ACTION_STUDIO_BATCH
* @param {Object} params Parametri interpolati ricevuti dal DAG
* @returns {Object} Payload di risposta per il context globale
*/
function executeStudioAction(params) {
const {
agentLdap,
workflowName,
targetDate,
emailSubject,
emailBody,
driveFileId,
destinationFolderId,
ccEmails,
explicitThreadId
} = params;

if (!agentLdap || !workflowName || !emailBody) {
throw new Error("Studio Engine: Parametri obbligatori mancanti (agentLdap, workflowName, emailBody).");
}

// 1. Estrazione Dati Agente (Cerca nella cache o nel DB)
const agentList = getAgentsForDropdown(workflowName);
const agent = agentList.find(a => a.id === String(agentLdap).trim()) || null;
if (!agent) {
throw new Error(`Studio Engine: Agente ${agentLdap} non trovato nel workflow ${workflowName}.`);
}

const formattedDate = targetDate ? Utilities.formatDate(new Date(targetDate), Session.getScriptTimeZone(), 'yyyy/MM/dd') : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd');
let newFileUrl = "";
let newFileId = null;
let permissionErrors = [];

const validCcEmails = ccEmails ? ccEmails.split(',').map(e => e.trim()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) : [];

// 2. Manipolazione Google Drive (Clonazione e IAM Permissions via Drive API v3)
if (driveFileId && driveFileId.trim() !== '') {
try {
const templateFile = DriveApp.getFileById(driveFileId.trim());
const mimeType = templateFile.getMimeType();
const newFile = templateFile.makeCopy(`File - ${agent.name} - ${formattedDate}`);
if (destinationFolderId && destinationFolderId.trim() !== '') {
try {
newFile.moveTo(DriveApp.getFolderById(destinationFolderId.trim()));
} catch (moveErr) {
console.warn("Studio Drive Move Fallito: " + moveErr);
}
}

newFileId = newFile.getId();
newFileUrl = newFile.getUrl();

// Injection variabili nei Documenti supportati
if (mimeType === MimeType.GOOGLE_SHEETS) {
const sh = SpreadsheetApp.openById(newFileId);
sh.createTextFinder('{{AGENT_NAME}}').matchCase(false).replaceAllWith(agent.name);
sh.createTextFinder('{{DATE}}').matchCase(false).replaceAllWith(formattedDate);
sh.createTextFinder('{{AGENT_ID}}').matchCase(false).replaceAllWith(agent.id);
} else if (mimeType === MimeType.GOOGLE_DOCS) {
const doc = DocumentApp.openById(newFileId);
doc.getBody().replaceText('{{AGENT_NAME}}', agent.name);
doc.getBody().replaceText('{{DATE}}', formattedDate);
doc.getBody().replaceText('{{AGENT_ID}}', agent.id);
doc.saveAndClose();
} else if (mimeType === MimeType.GOOGLE_SLIDES) {
const slide = SlidesApp.openById(newFileId);
slide.replaceAllText('{{AGENT_NAME}}', agent.name);
slide.replaceAllText('{{DATE}}', formattedDate);
slide.replaceAllText('{{AGENT_ID}}', agent.id);
slide.saveAndClose();
}

// Propagazione Permessi IAM
const allEmailsToShare = [agent.email, ...validCcEmails];
allEmailsToShare.forEach(email => {
try {
Drive.Permissions.create({
'role': 'writer',
'type': 'user',
'emailAddress': email
}, newFileId, {
'sendNotificationEmail': false,
'supportsAllDrives': true
});
} catch (permErr) {
console.error(`Studio Permessi falliti per ${email}:`, permErr);
permissionErrors.push(email);
}
});
} catch (driveErr) {
throw new Error("Studio Drive Ops Fallite: " + driveErr.message);
}
}

// 3. Compilazione Email Parsing
const parseText = (str) => {
if (!str) return "";
return str.replace(/{{AGENT_ID}}/g, agent.id)
.replace(/{{AGENT_NAME}}/g, agent.name)
.replace(/{{DATE}}/g, formattedDate)
.replace(/{{FILE_URL}}/g, newFileUrl);
};

const parseBody = (str) => {
let s = parseText(str);
// Sanificazione stili CSS (come nell'originale)
s = s.replace(/style\s*=\s*["']([^"']*)["']/gi, (match, styles) => {
let cleanStyles = styles
.replace(/(?:background-color|background)\s*:[^;]+;?/gi, '')
.replace(/color\s*:\s*(?:#e0e0e0|#fff|#ffffff|rgb\(224,\s*224,\s*224\));?/gi, 'color: #333333;');
return `style="${cleanStyles}"`;
});

if (newFileUrl) {
s = s.replace(/href=["']{{FILE_URL}}["']/g, `href="${newFileUrl}"`);
s = s.replace(/{{FILE_URL}}/g, `<a href="${newFileUrl}" target="_blank" style="color: #1155cc; font-weight: bold; text-decoration: underline;">Click Here</a>`);
} else {
s = s.replace(/href=["']{{FILE_URL}}["']/g, 'href="#"');
s = s.replace(/{{FILE_URL}}/g, '<em style="color: #999;">No document attached</em>');
}
return s;
};

let draft;
let actionLog = "NEW THREAD DRAFTED";

if (permissionErrors.length > 0) {
actionLog += ` [Warning: Drive share failed for ${permissionErrors.length} users]`;
}

const compiledSubject = parseText(emailSubject || `Notice for ${agent.name}`);
const compiledBody = parseBody(emailBody);
const ccString = validCcEmails.join(',');

// 4. Iniezione Thread o Creazione Draft
if (explicitThreadId && explicitThreadId !== "NEW" && explicitThreadId !== "") {
try {
const targetThread = GmailApp.getThreadById(explicitThreadId.trim());
if (targetThread) {
const uniqueCcList = [...new Set([agent.email, ...validCcEmails])].join(',');
draft = targetThread.createDraftReplyAll('', {
htmlBody: compiledBody,
cc: uniqueCcList
});
actionLog = permissionErrors.length > 0 ? `EXPLICIT REPLY INJECTED [Warning: Share failed for ${permissionErrors.length}]` : "EXPLICIT REPLY INJECTED";
}
} catch (threadErr) {
console.warn("Studio Aggancio Thread Fallito: " + threadErr);
}
}

if (!draft) {
draft = GmailApp.createDraft(
agent.email,
compiledSubject,
'',
{ htmlBody: compiledBody, cc: ccString }
);
}

// 5. Audit Logging Sicuro
_studioLogAudit(agent.name, workflowName, targetDate, actionLog);

return {
action: "STUDIO_EXECUTED",
draftId: draft.getId(),
draftUrl: `https://mail.google.com/mail/u/0/#drafts?compose=${draft.getId()}`,
fileUrl: newFileUrl,
log: actionLog
};
}

/**
* Registrazione delle operazioni nella tab Audit_Log.
* Implementa LockService per prevenire sovrascritture in caso di exec parallele (DAG complessi).
*/
function _studioLogAudit(agentName, workflowName, targetDate, actionTaken) {
const lock = LockService.getScriptLock();
if (!lock.tryLock(10000)) {
console.warn("Studio Audit: Lock timeout. Impossibile scrivere log per " + agentName);
return;
}
try {
const ss = SpreadsheetApp.openById(STUDIO_CONFIG.mainSpreadsheetId);
let sheet = ss.getSheetByName(STUDIO_CONFIG.auditTabName);
if (!sheet) {
sheet = ss.insertSheet(STUDIO_CONFIG.auditTabName);
sheet.getRange("A1:E1").setValues([["Timestamp", "Agent Name", "Workflow", "Target Date", "Action Taken"]])
.setBackground("#141821").setFontColor("#d4af37").setFontWeight("bold");
}
const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
const nextRow = Math.max(sheet.getLastRow() + 1, 2);
const safeDate = targetDate || "N/A";
sheet.getRange(nextRow, 1, 1, 5).setValues([[timestamp, agentName, workflowName, safeDate, actionTaken]]);
} catch (e) {
console.error("Studio Audit Write Failure: ", e);
} finally {
lock.releaseLock();
}
}