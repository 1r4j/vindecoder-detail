import db from '../db.js';

export const AUDIT_EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  REGISTER_FAILED: 'REGISTER_FAILED',
  LOGOUT: 'LOGOUT',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  TOKEN_VERIFIED: 'TOKEN_VERIFIED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  INVOICE_CREATED: 'INVOICE_CREATED',
  INVOICE_UPDATED: 'INVOICE_UPDATED',
  INVOICE_DELETED: 'INVOICE_DELETED',
  DATA_EXPORTED: 'DATA_EXPORTED'
};

export function logAuditEvent(eventType, userId = null, details = {}) {
  try {
    if (!db.auditLogs) {
      db.auditLogs = [];
    }

    const logEntry = {
      id: db.auditLogs.length + 1,
      eventType,
      userId,
      timestamp: new Date().toISOString(),
      details
    };

    db.auditLogs.push(logEntry);

    // Keep only last 10000 logs to prevent unbounded growth
    if (db.auditLogs.length > 10000) {
      db.auditLogs = db.auditLogs.slice(-10000);
    }

    db.save();
    console.log(`📋 Audit: ${eventType}`, { userId, ...details });
  } catch (error) {
    console.error('Audit logging error:', error.message);
  }
}

export function getAuditLogs(userId = null, limit = 100) {
  try {
    if (!db.auditLogs) return [];

    let logs = db.auditLogs;
    if (userId) {
      logs = logs.filter(log => log.userId === parseInt(userId));
    }

    return logs.slice(-limit).reverse();
  } catch (error) {
    console.error('Error retrieving audit logs:', error.message);
    return [];
  }
}

export default {
  logAuditEvent,
  getAuditLogs,
  AUDIT_EVENTS
};
