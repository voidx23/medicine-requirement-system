import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const FORBIDDEN_SQL_PATTERN = /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|SP_EXECUTESQL|XP_\w+|SP_CONFIGURE|DBCC|GRANT|REVOKE|DENY|BACKUP|RESTORE|SHUTDOWN|KILL|RECONFIGURE|BULK|OPENROWSET|OPENDATASOURCE|OPENQUERY|WAITFOR|WRITETEXT|UPDATETEXT|READTEXT|COMMIT|ROLLBACK|SAVE\s+TRAN|BEGIN\s+TRAN|DECLARE|SET)\b/i;
const SELECT_INTO_PATTERN = /\bSELECT\b[\s\S]*?\bINTO\b\s+(?!@)/i;

function getPacmanConfig() {
    return {
        user: process.env.PACMAN_DB_USER,
        password: process.env.PACMAN_DB_PASSWORD,
        server: process.env.PACMAN_DB_HOST,
        port: Number(process.env.PACMAN_DB_PORT || 1435),
        database: process.env.PACMAN_DB_NAME,
        pool: {
            // Capped at 10 (down from 20) for SQL Server 2014 Express (1 GB RAM / 4 cores)
            // to prevent memory-grant contention and connection-queue spikes under concurrent load.
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        },
        options: {
            // Explicit TCP port routes directly to PACKMAN_273 without SQL Browser (UDP 1434)
            encrypt: false,
            trustServerCertificate: true,
            enableArithAbort: true,
            cryptoCredentialsDetails: {
                minVersion: 'TLSv1'
            }
        },
        connectionTimeout: 15000,
        requestTimeout: 60000
    };
}

let poolPromise = null;

/**
 * Returns the shared read-only SQL Server ConnectionPool for Pacman Pro.
 */
export async function getPacmanPool() {
    if (!poolPromise) {
        const config = getPacmanConfig();
        if (!config.server || !config.database || !config.user || !config.password) {
            throw new Error('Pacman Pro database environment variables (PACMAN_DB_*) are not configured.');
        }
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .catch((err) => {
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

/**
 * Single-pass SQL lexical stripper that:
 * - Replaces single-quoted string literal contents with '' (handling escaped '') so
 *   literal filter values never cause false positives or hide syntax tokens.
 * - Strips line comments (-- ...) and SQL Server nested block comments (/* ... *\/).
 * - Rejects unclosed block comments or unclosed string literals.
 */
function stripSqlCommentsAndLiterals(rawSql) {
    let out = '';
    let i = 0;
    const len = rawSql.length;

    while (i < len) {
        const ch = rawSql[i];
        const next = i + 1 < len ? rawSql[i + 1] : '';

        // Single-quoted string literal (handles escaped '' pairs)
        if (ch === "'") {
            out += "''";
            i++;
            let closed = false;
            while (i < len) {
                if (rawSql[i] === "'") {
                    if (i + 1 < len && rawSql[i + 1] === "'") {
                        i += 2;
                        continue;
                    }
                    i++;
                    closed = true;
                    break;
                }
                i++;
            }
            if (!closed) {
                throw new Error('Read-only guard: unclosed SQL string literal.');
            }
            continue;
        }

        // Line comment: -- ... \n
        if (ch === '-' && next === '-') {
            out += ' ';
            i += 2;
            while (i < len && rawSql[i] !== '\n') i++;
            continue;
        }

        // Nested block comment: /* ... /* ... */ ... */
        if (ch === '/' && next === '*') {
            out += ' ';
            i += 2;
            let depth = 1;
            while (i < len && depth > 0) {
                if (rawSql[i] === '/' && i + 1 < len && rawSql[i + 1] === '*') {
                    depth++;
                    i += 2;
                } else if (rawSql[i] === '*' && i + 1 < len && rawSql[i + 1] === '/') {
                    depth--;
                    i += 2;
                } else {
                    i++;
                }
            }
            if (depth !== 0) {
                throw new Error('Read-only guard: unclosed SQL block comment.');
            }
            continue;
        }

        out += ch;
        i++;
    }

    return out;
}

/**
 * Validates that a SQL string is strictly a single read-only SELECT or WITH statement.
 * Rejects multi-statement batches (;), SELECT...INTO, and all DDL/DML/DCL/admin keywords.
 */
export function assertReadOnlySql(sqlText) {
    if (typeof sqlText !== 'string' || !sqlText.trim()) {
        throw new Error('Read-only guard: query must be a non-empty SQL string.');
    }
    if (sqlText.includes('\0')) {
        throw new Error('Read-only guard: NUL bytes are not allowed in SQL.');
    }

    const stripped = stripSqlCommentsAndLiterals(sqlText).trim();
    // Allow at most one optional trailing semicolon; reject any embedded semicolons (batch stacking)
    const withoutTrailingSemi = stripped.replace(/;\s*$/, '');
    if (withoutTrailingSemi.includes(';')) {
        throw new Error('Read-only guard: multiple SQL statements are blocked on Pacman Pro.');
    }

    if (!/^(SELECT|WITH)\b/i.test(withoutTrailingSemi)) {
        throw new Error('Read-only guard: query must begin with SELECT or WITH.');
    }
    if (FORBIDDEN_SQL_PATTERN.test(withoutTrailingSemi)) {
        throw new Error('Read-only guard: write, DDL, or administrative statements are blocked on Pacman Pro.');
    }
    if (SELECT_INTO_PATTERN.test(withoutTrailingSemi)) {
        throw new Error('Read-only guard: SELECT ... INTO table creation is blocked on Pacman Pro.');
    }
}

/**
 * Executes a parameterized, strictly read-only SQL query against Pacman Pro.
 *
 * LOCK_TIMEOUT safety on pooled connections:
 * - Caller SQL is validated strictly via assertReadOnlySql() before any wrapper is added.
 * - When options.lockTimeoutMs is provided, the validated query runs inside TRY/CATCH
 *   that sets LOCK_TIMEOUT and resets it to -1 on both success and SQL errors.
 * - When options.lockTimeoutMs is omitted, SET LOCK_TIMEOUT -1 is explicitly prefixed
 *   at batch entry so a reused SPID can never inherit a stale timeout even after a
 *   prior client-side abort/cancellation.
 */
export async function queryPacman(sqlText, params = {}, options = {}) {
    assertReadOnlySql(sqlText);
    const pool = await getPacmanPool();
    const request = pool.request();

    if (typeof options.onRequest === 'function') {
        options.onRequest(request);
    }

    for (const [key, val] of Object.entries(params)) {
        if (val && typeof val === 'object' && 'type' in val && 'value' in val) {
            request.input(key, val.type, val.value);
        } else if (typeof val === 'number') {
            request.input(key, Number.isInteger(val) ? sql.Int : sql.Float, val);
        } else {
            request.input(key, val);
        }
    }

    const cleanedSql = String(sqlText).trim().replace(/;+\s*$/, '');
    const lockTimeoutMs =
        options && Number.isInteger(options.lockTimeoutMs) && options.lockTimeoutMs > 0
            ? options.lockTimeoutMs
            : null;

    const finalSql = lockTimeoutMs
        ? `BEGIN TRY\n    SET LOCK_TIMEOUT ${lockTimeoutMs};\n    ${cleanedSql};\n    SET LOCK_TIMEOUT -1;\nEND TRY\nBEGIN CATCH\n    SET LOCK_TIMEOUT -1;\n    THROW;\nEND CATCH;`
        : `SET LOCK_TIMEOUT -1;\n${cleanedSql};`;

    return request.query(finalSql);
}

export { sql };
