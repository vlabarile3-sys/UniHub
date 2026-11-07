// File: OpsModule_GmailPoller.gs

/**
* ==========================================
* FLOWPILOT AUTOMATION - GMAIL POLLER MICROSERVICE
* Architecture: Isolated Backend Module
* Description: Scans Gmail for new emails based on custom queries, extracts data, and applies idempotency constraints.
* ==========================================
*/

const POLLER_PROCESSED_LABEL = 'FLOWPILOT_PROCESSED';

/**
* Scans the inbox using native GmailApp search capabilities and extracts structured payloads.
*
* @param {Object} params The node parameters containing the search query and limits.
* @returns {Array<Object>} An array of extracted email payloads.
*/
function executeGmailPolling(params) {
const rawQuery = params.query || 'is:unread';
const maxResults = parseInt(params.maxResults) || 5; // Batch limit to avoid execution timeouts
const extractedPayloads = [];

try {
// 1. Ensure idempotency label exists in the user's Gmail
let processedLabel = GmailApp.getUserLabelByName(POLLER_PROCESSED_LABEL);
if (!processedLabel) {
processedLabel = GmailApp.createLabel(POLLER_PROCESSED_LABEL);
}

// 2. Safe Query Construction (Exclude already processed threads)
const safeQuery = `${rawQuery} -label:${POLLER_PROCESSED_LABEL}`;
// 3. Execute Search
const targetThreads = GmailApp.search(safeQuery, 0, maxResults);
if (targetThreads.length === 0) {
return extractedPayloads; // Return empty array if no new items
}

// 4. Payload Extraction & Marking
targetThreads.forEach(thread => {
const firstMessage = thread.getMessages()[0]; // Extract the root message of the thread
// Build the standard context payload for the DAG
extractedPayloads.push({
threadId: thread.getId(),
messageId: firstMessage.getId(),
sender: firstMessage.getFrom(),
subject: firstMessage.getSubject(),
plainBody: firstMessage.getPlainBody(), // Plain text is safer for Regex extraction downstream
date: firstMessage.getDate().toISOString()
});

// Immediately mark as processed to prevent overlapping during the next daemon cycle
thread.addLabel(processedLabel);
});

return extractedPayloads;

} catch (e) {
console.error("Gmail Poller Execution Error: " + e.message);
return [];
}
}