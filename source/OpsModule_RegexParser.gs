// File: OpsModule_RegexParser.gs

/**
* ==========================================
* FLOWPILOT AUTOMATION - REGEX PARSER MICROSERVICE
* Architecture: Isolated Backend Module
* Description: Motore di estrazione dati strutturati tramite espressioni regolari (Pattern Matching).
* ==========================================
*/

/**
* Analizza un testo sorgente applicando regole Regex per estrarre coppie Chiave/Valore.
* * @param {Object} params Parametri dal nodo, contenenti sourceText e fino a 5 coppie key/pattern.
* @returns {Object} Payload con le chiavi estratte, pronto per l'injection nel Context RAM.
*/
function executeRegexParser(params) {
const sourceText = params.sourceText || "";
const extractedData = {
action: "REGEX_PARSED",
bytesAnalyzed: sourceText.length
};

if (!sourceText) {
console.warn("Regex Parser: Nessun testo sorgente fornito (sourceText vuoto).");
return extractedData;
}

let matchCount = 0;

// Il motore supporta fino a 5 regole di estrazione in parallelo per nodo
for (let i = 1; i <= 5; i++) {
const keyName = params[`key${i}`];
const regexPattern = params[`pattern${i}`];

if (keyName && keyName.trim() !== "" && regexPattern && regexPattern.trim() !== "") {
const cleanKey = keyName.trim();
try {
// Inizializza la regex con case-insensitive 'i' (e 'm' per multiline se necessario)
const regex = new RegExp(regexPattern, 'im');
const match = regex.exec(sourceText);

if (match) {
// Se la regex usa un gruppo di cattura (match[1]), estrae solo quello (es. LDAP puro).
// Altrimenti prende l'intero blocco matchato (match[0]).
const extractedValue = match[1] !== undefined ? match[1] : match[0];
extractedData[cleanKey] = extractedValue.trim();
matchCount++;
} else {
// Pattern non trovato nel testo
extractedData[cleanKey] = null;
}
} catch (e) {
console.warn(`Regex Parser Error sulla chiave [${cleanKey}]: Pattern non valido -> ${regexPattern}`);
extractedData[cleanKey] = "REGEX_ERROR";
}
}
}
extractedData.matchesFound = matchCount;
return extractedData;
}