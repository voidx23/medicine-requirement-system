import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import dotenv from 'dotenv';
import sql from 'mssql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function sanitizeMessage(message) {
    if (!message) return 'Unknown error';
    let sanitized = String(message);
    if (process.env.PACMAN_DB_PASSWORD) {
        sanitized = sanitized.split(process.env.PACMAN_DB_PASSWORD).join('***');
    }
    if (process.env.PACMAN_DB_USER) {
        sanitized = sanitized.replace(
            new RegExp(`user ['"]?${process.env.PACMAN_DB_USER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?`, 'gi'),
            "user '***'"
        );
    }
    return sanitized;
}

function testTcpReachability(host, port, timeoutMs = 10000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const socket = new net.Socket();
        let settled = false;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve({ ...result, durationMs: Date.now() - startTime });
        };

        socket.setTimeout(timeoutMs);

        socket.once('connect', () => {
            finish({ ok: true });
        });

        socket.once('timeout', () => {
            finish({
                ok: false,
                code: 'ETIMEDOUT',
                message: `TCP connection to ${host}:${port} timed out after ${timeoutMs}ms`
            });
        });

        socket.once('error', (err) => {
            finish({
                ok: false,
                code: err.code || 'TCP_ERROR',
                message: err.message
            });
        });

        socket.connect(port, host);
    });
}

function classifyError(err, stage) {
    const code = err?.code || err?.originalError?.code || '';
    const sqlNumber = err?.number ?? err?.originalError?.info?.number ?? err?.originalError?.number ?? null;
    const msg = String(err?.message || '');

    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
        return 'Server Address (DNS/hostname resolution failed)';
    }
    if (code === 'ECONNREFUSED') {
        return 'Port / Service (TCP connection actively refused — SQL Server may not be listening on this port or port is wrong)';
    }
    if (code === 'ETIMEDOUT' || code === 'ESOCKET' && /timeout/i.test(msg)) {
        return 'Network Access / Firewall / Port (TCP connection timed out — firewall, security group, or ISP block on port)';
    }
    if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'EACCES' || code === 'EPERM') {
        return 'Network Access / Firewall (Host/network unreachable or socket blocked by environment/firewall)';
    }
    if (/SSL|TLS|handshake|cipher|protocol|ECONNRESET/i.test(msg) || code === 'ECONNRESET') {
        return 'TLS Protocol / Network Handshake (Older SQL Server TLS/cipher negotiation mismatch or connection reset)';
    }
    if (sqlNumber === 18456 || code === 'ELOGIN' || /Login failed/i.test(msg)) {
        return 'Authentication (Invalid username/password or SQL Server authentication mode mismatch)';
    }
    if (sqlNumber === 4060 || /Cannot open database/i.test(msg)) {
        return 'Database Permissions / Database Name (Target database does not exist or login lacks access)';
    }
    if (sqlNumber === 229 || sqlNumber === 262 || /permission was denied/i.test(msg)) {
        return 'Database Permissions (Login authenticated but lacks SELECT/VIEW permissions)';
    }
    if (stage === 'tcp') {
        return 'Network Access / Firewall / Port';
    }
    return 'SQL Server Connection / Configuration';
}

async function run() {
    const host = process.env.PACMAN_DB_HOST;
    const port = Number(process.env.PACMAN_DB_PORT);
    const database = process.env.PACMAN_DB_NAME;
    const user = process.env.PACMAN_DB_USER;
    const password = process.env.PACMAN_DB_PASSWORD;

    const missing = [];
    if (!host) missing.push('PACMAN_DB_HOST');
    if (!process.env.PACMAN_DB_PORT || Number.isNaN(port)) missing.push('PACMAN_DB_PORT');
    if (!database) missing.push('PACMAN_DB_NAME');
    if (!user) missing.push('PACMAN_DB_USER');
    if (!password) missing.push('PACMAN_DB_PASSWORD');

    if (missing.length > 0) {
        console.log('Connection Status: FAILED');
        console.log(`Error Details: Missing or invalid environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }

    console.log('=== Pacman Pro Cloud SQL Server Connectivity Test ===');
    console.log(`Target Endpoint: ${host}:${port}`);
    console.log(`Target Database: ${database}`);
    console.log('');

    // Stage 1: Raw TCP reachability check
    console.log('[Stage 1] Checking raw TCP reachability...');
    const tcpResult = await testTcpReachability(host, port, 10000);
    if (!tcpResult.ok) {
        console.log(`TCP Reachability: FAILED (${tcpResult.durationMs}ms)`);
        console.log('');
        console.log('Connection Status: FAILED');
        console.log(`Error Details: [${tcpResult.code}] ${sanitizeMessage(tcpResult.message)}`);
        console.log(`Root Cause Classification: ${classifyError(tcpResult, 'tcp')}`);
        console.log('Database Name: N/A');
        console.log('Test Query Returned Data: No');
        console.log('Number of Records Returned: 0');
        process.exit(1);
    }
    console.log(`TCP Reachability: OK (${tcpResult.durationMs}ms)`);

    // Stage 2: SQL Server TDS connection & authentication
    const pacmanConfig = {
        user,
        password,
        server: host,
        port,
        database,
        pool: {
            max: 5,
            min: 0,
            idleTimeoutMillis: 15000
        },
        options: {
            // Do NOT pass instanceName when connecting with an explicit TCP port
            encrypt: false,
            trustServerCertificate: true,
            enableArithAbort: true,
            cryptoCredentialsDetails: {
                minVersion: 'TLSv1'
            }
        },
        connectionTimeout: 15000,
        requestTimeout: 30000
    };

    let pool = null;
    try {
        console.log('[Stage 2] Connecting to SQL Server via mssql...');
        pool = await new sql.ConnectionPool(pacmanConfig).connect();
        console.log('Connection Status: SUCCESSFUL');

        // Stage 3: Harmless read-only queries
        console.log('[Stage 3] Running read-only verification queries...');

        const metaResult = await pool.request().query(`
            SELECT
                DB_NAME() AS current_database,
                @@SERVERNAME AS server_instance,
                CAST(SERVERPROPERTY('ProductVersion') AS varchar(50)) AS sql_version,
                CAST(SERVERPROPERTY('Edition') AS varchar(100)) AS sql_edition;
        `);

        const metaRow = metaResult.recordset?.[0] || {};
        const connectedDbName = metaRow.current_database || 'Unknown';

        const tablesResult = await pool.request().query(`
            SELECT
                TABLE_SCHEMA,
                TABLE_NAME,
                TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES WITH (NOLOCK)
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME;
        `);

        const tableRows = tablesResult.recordset || [];
        const totalTableCount = tableRows.length;
        const sampleTables = tableRows.slice(0, 15).map((r) => `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`);

        console.log(`Database Name: ${connectedDbName}`);
        console.log(`SQL Server Instance: ${metaRow.server_instance || 'Unknown'}`);
        console.log(`SQL Server Version: ${metaRow.sql_version || 'Unknown'} (${metaRow.sql_edition || 'Unknown'})`);
        console.log(`Test Query Returned Data: ${totalTableCount > 0 ? 'Yes' : 'No'}`);
        console.log(`Number of Records Returned (Base Tables): ${totalTableCount}`);
        console.log(`Sample Tables (first ${sampleTables.length}): ${sampleTables.join(', ')}`);

        // Additional harmless read-only checks on core Pacman Pro tables
        try {
            const fyResult = await pool.request().query(`
                SELECT TOP 1 fyid, name, fy, fyend FROM dbo.Tblcompany WITH (NOLOCK);
            `);
            const locResult = await pool.request().query(`
                SELECT LocationId, Location, Company FROM dbo.Tbl_location WITH (NOLOCK) ORDER BY LocationId;
            `);
            const itemCountResult = await pool.request().query(`
                SELECT COUNT(*) AS total_items FROM dbo.tbl_item_master WITH (NOLOCK);
            `);

            const fyRow = fyResult.recordset?.[0];
            const locations = locResult.recordset || [];
            const totalItems = itemCountResult.recordset?.[0]?.total_items ?? 0;

            console.log('');
            console.log('--- Core Pacman Pro Read-Only Verification ---');
            console.log(`Tblcompany Records: ${fyResult.recordset?.length || 0}${fyRow ? ` (Active fyid: ${fyRow.fyid}, Company: ${fyRow.name})` : ''}`);
            console.log(`Tbl_location Records: ${locations.length}${locations.length > 0 ? ` (${locations.map((l) => `${l.LocationId}: ${l.Location}`).join(' | ')})` : ''}`);
            console.log(`tbl_item_master Total Items: ${totalItems}`);
        } catch (coreErr) {
            console.log(`Core Pacman Pro Table Check Warning: ${sanitizeMessage(coreErr.message)}`);
        }

        process.exitCode = 0;
    } catch (err) {
        const errCode = err?.code || err?.originalError?.code || 'SQL_ERROR';
        const sqlNumber = err?.number ?? err?.originalError?.info?.number ?? err?.originalError?.number ?? null;
        const sqlState = err?.state ?? err?.originalError?.info?.state ?? null;

        console.log('Connection Status: FAILED');
        console.log(
            `Error Details: [code=${errCode}${sqlNumber !== null ? `, number=${sqlNumber}` : ''}${sqlState !== null ? `, state=${sqlState}` : ''}] ${sanitizeMessage(err?.message)}`
        );
        console.log(`Root Cause Classification: ${classifyError(err, 'sql')}`);
        console.log('Database Name: N/A');
        console.log('Test Query Returned Data: No');
        console.log('Number of Records Returned: 0');
        process.exitCode = 1;
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch {
                // Ignore pool close errors during cleanup
            }
        }
    }
}

run();
