// Import logs management
export interface ImportLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: string;
  recordId?: string;
}

// Global logs storage
let importLogs: ImportLogEntry[] = [];
let logListeners: ((logs: ImportLogEntry[]) => void)[] = [];

export function addImportLog(
  level: ImportLogEntry['level'],
  message: string,
  details?: string,
  recordId?: string
) {
  const entry: ImportLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
    recordId,
  };
  
  importLogs = [entry, ...importLogs].slice(0, 500); // Keep last 500 logs
  notifyListeners();
  
  // Also log to console for debugging
  const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
  console[consoleMethod](`[Import ${level.toUpperCase()}]`, message, details || '');
}

export function clearImportLogs() {
  importLogs = [];
  notifyListeners();
}

export function getImportLogs(): ImportLogEntry[] {
  return importLogs;
}

export function subscribeToLogs(listener: (logs: ImportLogEntry[]) => void) {
  logListeners.push(listener);
  return () => {
    logListeners = logListeners.filter(l => l !== listener);
  };
}

function notifyListeners() {
  logListeners.forEach(l => l(importLogs));
}
