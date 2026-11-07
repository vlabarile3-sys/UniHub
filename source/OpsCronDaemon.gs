// File: OpsCronDaemon.gs

/**
* =========================================
* FLOWPILOT - OPS AUTOMATION ENGINE
* Module: Cron Daemon & Time Trigger Manager
* Architecture: Master Poller Pattern (V8)
* Description: Orchestrates server-side time triggers and asynchronous polling (e.g., Gmail).
* =========================================
*/

const DAEMON_HANDLER = '_onMasterDaemonTick';
const DAEMON_INTERVAL_MINUTES = 15;

/**
* Installs the Master Time-Driven Trigger.
* Only users with specific roles can activate the server-side daemon.
*/
function installMasterDaemon() {
requireRole(['OPS', 'QA']);
// 1. Purge existing daemons to prevent overlapping memory leaks
removeMasterDaemon();
// 2. Register the new clock trigger natively via ScriptApp
ScriptApp.newTrigger(DAEMON_HANDLER)
.timeBased()
.everyMinutes(DAEMON_INTERVAL_MINUTES)
.create();
return { success: true, message: `Master Daemon installed successfully. Polling every ${DAEMON_INTERVAL_MINUTES} minutes.` };
}

/**
* Stops and removes all Master Daemons from the Google Workspace project.
*/
function removeMasterDaemon() {
requireRole(['OPS', 'QA']);
const triggers = ScriptApp.getProjectTriggers();
let deletedCount = 0;
triggers.forEach(t => {
if (t.getHandlerFunction() === DAEMON_HANDLER) {
ScriptApp.deleteTrigger(t);
deletedCount++;
}
});
return { success: true, message: `Terminated ${deletedCount} active daemon instances.` };
}

/**
* The core callback executed by Google's internal clock.
* It reads the Canvas state and evaluates CRON nodes & Poller nodes.
*/
function _onMasterDaemonTick() {
const lock = LockService.getScriptLock();
// Wait up to 25 seconds for a lock. Prevents double-execution if a previous DAG is still running.
if (!lock.tryLock(25000)) {
console.warn("Daemon Tick: Engine is currently locked by another long-running automation.");
return;
}

try {
const stateRes = loadCanvasState();
if (!stateRes.success || !stateRes.data) return;

const nodes = stateRes.data.nodes || [];
// --- 1. EVALUATE TIME TRIGGERS (CRON) ---
const cronNodes = nodes.filter(n => n.type === 'TRIGGER_CRON');
if (cronNodes.length > 0) {
const now = new Date();
const currentHour = now.getHours();
const currentDay = now.getDate();
const currentMonth = now.getMonth() + 1;
const currentDayOfWeek = now.getDay();

cronNodes.forEach(node => {
const cronExpr = (node.parameters && node.parameters.cron) ? node.parameters.cron : null;
if (cronExpr && _evaluateCronExpression(cronExpr, currentHour, currentDay, currentMonth, currentDayOfWeek)) {
console.log(`[DAEMON] Triggering workflow sequence from CRON node: ${node.id}`);
executeManualWorkflow(node.id);
}
});
}

// --- 2. EVALUATE ASYNC POLLERS (GMAIL) ---
const pollerNodes = nodes.filter(n => n.type === 'TRIGGER_GMAIL_POLLER');
if (pollerNodes.length > 0) {
if (typeof executeGmailPolling !== 'function') {
console.error("[DAEMON] Gmail Poller module is missing or not loaded.");
} else {
pollerNodes.forEach(node => {
try {
const params = node.parameters || {};
const extractedPayloads = executeGmailPolling(params);
if (extractedPayloads && extractedPayloads.length > 0) {
console.log(`[DAEMON] Poller ${node.id} extracted ${extractedPayloads.length} new payload(s). Routing to engine...`);
// Fork the DAG execution for each extracted email
extractedPayloads.forEach(payload => {
// Passes the payload directly to the Engine to be injected into RAM context
executeManualWorkflow(node.id, payload);
});
}
} catch (e) {
console.error(`[DAEMON] Poller execution failed for node ${node.id}: ${e.message}`);
}
});
}
}

} catch (e) {
console.error("Critical Daemon Tick Error: " + e.message);
} finally {
lock.releaseLock();
}
}

/**
* Native V8 Lightweight CRON Evaluator.
*/
function _evaluateCronExpression(cronExpression, hour, day, month, dow) {
const parts = cronExpression.trim().split(/\s+/);
if (parts.length < 4) return false;

return _matchCronPart(parts[0], hour) &&
_matchCronPart(parts[1], day) &&
_matchCronPart(parts[2], month) &&
_matchCronPart(parts[3], dow);
}

/**
* Matches a single piece of the CRON expression.
*/
function _matchCronPart(part, value) {
if (part === '*') return true;
if (part.includes('-')) {
const [start, end] = part.split('-').map(Number);
return value >= start && value <= end;
}
return Number(part) === value;
}