import { queryPacman } from '../config/pacmanDb.js';
import Branch from '../models/Branch.js';

export const CACHE_TTL_MS = 5 * 60 * 1000;
const IN_FLIGHT_MAX_AGE_MS = 2 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const analyticsCache = new Map();
const inFlightRequests = new Map();
let nextCacheGeneration = 0;
const keyMinWriteGen = new Map();
const keyActiveLoaders = new Map();

const OMAN_OFFSET_MS = 4 * 60 * 60 * 1000;

export const LOCATION_TO_BRANCH_ALIASES = {
    'nrp al khoud 6': 'nrp',
    'nrp': 'nrp',
    'alkhoud': 'alkhoud',
    'al khoud': 'alkhoud',
    'wave mabela': 'wave mabela',
    'barka': 'barka',
    'wadi al mavil': 'wadi mavil',
    'wadi al mawil': 'wadi mavil',
    'wadi mavil': 'wadi mavil',
    'bousher': 'bousher',
    'nakhal': 'nakhal',
    'al hail -south': 'al hail',
    'al hail south': 'al hail',
    'al hail': 'al hail',
    'kinaan al hail south': 'al hail'
};

export const CR_ENTITIES = {
    aap: {
        crKey: 'aap',
        label: "Al Atta'a Pharmacy (Main CR)",
        shortLabel: "Al Atta'a Main CR",
        allLocationIds: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        retailLocationIds: [2, 3, 5, 6, 7, 8, 9, 10, 11, 12],
        hasWarehouse: true,
        warehouseLocationId: 4
    },
    naap: {
        crKey: 'naap',
        label: "New Al Atta'a Pharmacies & Stores (Bousher & Suwaiq)",
        shortLabel: "New Al Atta'a CR (Bousher & Suwaiq)",
        allLocationIds: [13, 14],
        retailLocationIds: [13, 14],
        hasWarehouse: false,
        warehouseLocationId: null
    },
    all: {
        crKey: 'all',
        label: 'All Retail Combined (Excl. Store Inter-CR Sales)',
        shortLabel: 'All Retail Combined',
        allLocationIds: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        retailLocationIds: [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        hasWarehouse: true,
        warehouseLocationId: 4
    }
};

export function getLocationCrKey(locId) {
    const id = Number(locId);
    return id === 13 || id === 14 ? 'naap' : 'aap';
}

export function resolveCrScope(query = {}, rawLocationId = 0) {
    const rawCr = String(query.cr || 'aap').toLowerCase().trim();
    const entity = CR_ENTITIES[rawCr] || CR_ENTITIES.aap;
    const reqLoc = Math.max(0, Number(rawLocationId) || 0);
    const locationId = reqLoc > 0 && entity.allLocationIds.includes(reqLoc) ? reqLoc : 0;
    const salesLocationIds = locationId > 0 ? [locationId] : entity.retailLocationIds;
    const stockLocationIds = locationId > 0 ? [locationId] : entity.allLocationIds;

    return {
        crKey: entity.crKey,
        crLabel: entity.label,
        crShortLabel: entity.shortLabel,
        locationId,
        allLocationIds: entity.allLocationIds,
        retailLocationIds: entity.retailLocationIds,
        salesLocationIds,
        stockLocationIds,
        salesLocCsv: salesLocationIds.join(','),
        stockLocCsv: stockLocationIds.join(','),
        allLocCsv: entity.allLocationIds.join(','),
        retailLocCsv: entity.retailLocationIds.join(','),
        salesLocStrCsv: salesLocationIds.map((id) => `'${id}'`).join(','),
        stockLocStrCsv: stockLocationIds.map((id) => `'${id}'`).join(','),
        allLocStrCsv: entity.allLocationIds.map((id) => `'${id}'`).join(','),
        retailLocStrCsv: entity.retailLocationIds.map((id) => `'${id}'`).join(','),
        hasWarehouse: entity.hasWarehouse
    };
}

export function normalizeName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clonePayload(value, contextLabel = 'analytics cache') {
    try {
        return structuredClone(value);
    } catch (err) {
        throw new Error(`Failed to deep-clone ${contextLabel} payload: ${err.message}`);
    }
}

export function buildCacheKey(namespace, parts = []) {
    return JSON.stringify([String(namespace || ''), ...parts]);
}

function pruneExpiredCache() {
    const now = Date.now();
    for (const [k, entry] of analyticsCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
            analyticsCache.delete(k);
        }
    }
    while (analyticsCache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = analyticsCache.keys().next().value;
        if (oldestKey === undefined) break;
        analyticsCache.delete(oldestKey);
    }
}

export function getCached(key, forceRefresh = false) {
    if (forceRefresh) return null;
    const entry = analyticsCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        analyticsCache.delete(key);
        return null;
    }
    return clonePayload(entry.data, 'cache hit');
}

export function setCached(key, data, writtenGen = null) {
    const cloned = clonePayload(data, 'cache write');
    if (analyticsCache.size >= MAX_CACHE_ENTRIES) {
        pruneExpiredCache();
    }
    analyticsCache.set(key, {
        data: cloned,
        timestamp: Date.now(),
        writtenGen: writtenGen ?? ++nextCacheGeneration
    });
}

/**
 * Executes an analytics loader with 5-minute TTL caching, safe in-flight
 * request deduplication, monotonic generation write-guards, and deep-cloned isolation:
 * - Identical concurrent requests share the same in-flight Promise (1 SQL run).
 * - `forceRefresh = true` bypasses cached entries and pre-refresh in-flight promises,
 *   and immediately advances `keyMinWriteGen` so older loaders cannot overwrite fresh data.
 * - Expired in-flight loaders cannot overwrite results from newer loaders.
 * - Cleanup in `finally` checks strict Promise identity and releases generation metadata
 *   once all active loaders for the key have settled (bounded memory, race-free).
 * - Deep-clones via native `structuredClone()` on cache write and every caller return;
 *   never falls back to shallow copy on clone error.
 */
export async function withAnalyticsCache(cacheKey, forceRefresh, loaderFn, options = {}) {
    if (!forceRefresh) {
        const cached = getCached(cacheKey, false);
        if (cached) {
            return { ...cached, fromCache: true };
        }
    }

    const maxAgeMs = Number.isFinite(options.inFlightMaxAgeMs) && options.inFlightMaxAgeMs >= 0
        ? options.inFlightMaxAgeMs
        : IN_FLIGHT_MAX_AGE_MS;

    const inFlightKey = forceRefresh ? `refresh:${cacheKey}` : cacheKey;
    const existing = inFlightRequests.get(inFlightKey);
    if (existing && (Date.now() - existing.startedAt) < maxAgeMs) {
        const data = await existing.promise;
        return { ...clonePayload(data, 'shared in-flight response'), fromCache: false };
    }

    const reqGen = ++nextCacheGeneration;
    const prevMinGen = keyMinWriteGen.get(cacheKey) || 0;
    if (reqGen > prevMinGen) {
        keyMinWriteGen.set(cacheKey, reqGen);
    }
    keyActiveLoaders.set(cacheKey, (keyActiveLoaders.get(cacheKey) || 0) + 1);

    const promise = Promise.resolve()
        .then(() => loaderFn())
        .then((result) => {
            // Deep-clone before storing or returning; if cloning fails, throw without caching.
            const safeSnapshot = clonePayload(result, 'loader result');
            const minAllowedGen = keyMinWriteGen.get(cacheKey) || 0;
            const currentEntry = analyticsCache.get(cacheKey);
            const currentWrittenGen = currentEntry?.writtenGen || 0;
            if (reqGen >= minAllowedGen && reqGen >= currentWrittenGen) {
                setCached(cacheKey, safeSnapshot, reqGen);
            }
            return safeSnapshot;
        })
        .finally(() => {
            const current = inFlightRequests.get(inFlightKey);
            if (current && current.promise === promise) {
                inFlightRequests.delete(inFlightKey);
            }
            const remaining = (keyActiveLoaders.get(cacheKey) || 1) - 1;
            if (remaining <= 0) {
                keyActiveLoaders.delete(cacheKey);
                keyMinWriteGen.delete(cacheKey);
            } else {
                keyActiveLoaders.set(cacheKey, remaining);
            }
        });

    inFlightRequests.set(inFlightKey, { promise, startedAt: Date.now(), gen: reqGen });
    const data = await promise;
    return { ...clonePayload(data, 'fresh response'), fromCache: false };
}

export function getAnalyticsCacheStats() {
    return {
        cacheSize: analyticsCache.size,
        inFlightSize: inFlightRequests.size,
        trackedGenerationKeys: keyMinWriteGen.size,
        activeLoaderKeys: keyActiveLoaders.size,
        ttlMs: CACHE_TTL_MS
    };
}

export function formatDateISO(dateObj) {
    return dateObj.toISOString().slice(0, 10);
}

function getOmanTodayISO() {
    return new Date(Date.now() + OMAN_OFFSET_MS).toISOString().slice(0, 10);
}

function addDaysISO(isoDate, deltaDays) {
    const ms = Date.parse(`${isoDate}T00:00:00Z`) + deltaDays * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
}

export function resolveDateRange(query = {}, defaultDays = 30) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const rawStart = String(query.startDate || '').trim();
    const rawEnd = String(query.endDate || '').trim();
    const preset = String(query.preset || '').toLowerCase().trim();

    if (datePattern.test(rawStart) && datePattern.test(rawEnd)) {
        const [startDate, endDate] = rawStart <= rawEnd ? [rawStart, rawEnd] : [rawEnd, rawStart];
        const startMs = Date.parse(`${startDate}T00:00:00Z`);
        const endMs = Date.parse(`${endDate}T00:00:00Z`);
        const days = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
        const periodLabel = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
        return { startDate, endDate, days, periodLabel, preset: preset || 'custom', isCustomRange: true };
    }

    const today = getOmanTodayISO();
    if (preset === 'today') {
        return { startDate: today, endDate: today, days: 1, periodLabel: 'Today', preset: 'today', isCustomRange: false };
    }
    if (preset === 'yesterday') {
        const yest = addDaysISO(today, -1);
        return { startDate: yest, endDate: yest, days: 1, periodLabel: 'Yesterday', preset: 'yesterday', isCustomRange: false };
    }
    if (preset === 'this_week') {
        const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // Sunday = 0 (Oman workweek start)
        const startDate = addDaysISO(today, -dow);
        const days = dow + 1;
        return { startDate, endDate: today, days, periodLabel: 'This Week', preset: 'this_week', isCustomRange: false };
    }
    if (preset === 'this_month') {
        const startDate = `${today.slice(0, 7)}-01`;
        const days = Math.max(1, Number(today.slice(8, 10)) || 1);
        return { startDate, endDate: today, days, periodLabel: 'This Month', preset: 'this_month', isCustomRange: false };
    }

    if (preset === '7d') {
        const startDate = addDaysISO(today, -6); // 7 inclusive calendar days (today - 6 .. today)
        return { startDate, endDate: today, days: 7, periodLabel: '7D', preset: '7d', isCustomRange: false };
    }
    if (preset === '30d') {
        const startDate = addDaysISO(today, -29); // 30 inclusive calendar days (today - 29 .. today)
        return { startDate, endDate: today, days: 30, periodLabel: '30D', preset: '30d', isCustomRange: false };
    }
    if (preset === '90d') {
        const startDate = addDaysISO(today, -89); // 90 inclusive calendar days (today - 89 .. today)
        return { startDate, endDate: today, days: 90, periodLabel: '90D', preset: '90d', isCustomRange: false };
    }
    if (preset === '1y' || preset === '365d') {
        // 1Y business definition: trailing 365 inclusive calendar days in Oman local time (today - 364 .. today)
        const startDate = addDaysISO(today, -364);
        return { startDate, endDate: today, days: 365, periodLabel: '1Y', preset: '1y', isCustomRange: false };
    }

    const days = Math.min(365, Math.max(1, Number(query.days) || defaultDays));
    const endDate = today;
    // Exact inclusive calendar-day window: today - (days - 1) through today = `days` inclusive days
    const startDate = addDaysISO(today, -(days - 1));
    const periodLabel = days === 365 ? '1Y' : `${days}D`;
    const resolvedPreset = days === 365 ? '1y' : `${days}d`;
    return { startDate, endDate, days, periodLabel, preset: resolvedPreset, isCustomRange: false };
}

export function parseChannel(rawChannel, defaultChannel = 'pos') {
    const val = String(rawChannel || defaultChannel).toLowerCase().trim();
    if (val === 'pos' || val === 'nonpos' || val === 'all') return val;
    return defaultChannel;
}

export function buildChannelClause(channel, alias = 'sd') {
    if (channel === 'pos') {
        return `ISNULL(LTRIM(RTRIM(${alias}.shiftid)), '0') NOT IN ('', '0')`;
    }
    if (channel === 'nonpos') {
        return `ISNULL(LTRIM(RTRIM(${alias}.shiftid)), '0') IN ('', '0')`;
    }
    return '1 = 1';
}

export function parseStatus(rawStatus, defaultStatus = 'active') {
    const val = String(rawStatus || defaultStatus).toLowerCase().trim();
    if (val === 'active' || val === 'cancelled' || val === 'all') return val;
    return defaultStatus;
}

/**
 * Returns WITH (INDEX(indxdate)) for multi-day scans (>7D) on Tbl_salesdetails / Tbl_salemaster
 * without NOLOCK (READ COMMITTED), leaving short 1D-7D queries unhindered for SQL Server optimizer.
 */
export function buildDateIndexHint(days) {
    return Number(days) > 7 ? 'WITH (INDEX(indxdate))' : '';
}

export async function getActiveContext(forceRefresh = false) {
    return withAnalyticsCache(buildCacheKey('__active_context__', []), forceRefresh, async () => {
        const [companyRes, locationsRes, branches] = await Promise.all([
            queryPacman(`
                SELECT TOP 1
                    ISNULL(fyid, 1) AS fyid,
                    ISNULL(name, 'Pacman Pro Pharmacy') AS companyName
                FROM dbo.Tblcompany;
            `, {}, { lockTimeoutMs: 10000 }),
            queryPacman(`
                SELECT LocationId, Location
                FROM dbo.Tbl_location
                ORDER BY LocationId ASC;
            `, {}, { lockTimeoutMs: 10000 }),
            Branch.find({}).select('_id name location').sort({ name: 1 }).lean()
        ]);

        const companyRow = companyRes.recordset?.[0] || { fyid: 1, companyName: 'AL ATTAA PHARMACY' };
        const fyid = Number(companyRow.fyid || 1);

        const branchLookup = new Map();
        for (const b of branches) {
            branchLookup.set(normalizeName(b.name), b);
        }

        const matchBranch = (pacmanLocationName) => {
            const norm = normalizeName(pacmanLocationName);
            if (branchLookup.has(norm)) return branchLookup.get(norm);

            const rawLower = String(pacmanLocationName || '').toLowerCase().trim();
            const aliasTarget = LOCATION_TO_BRANCH_ALIASES[rawLower] || LOCATION_TO_BRANCH_ALIASES[norm];
            if (aliasTarget && branchLookup.has(normalizeName(aliasTarget))) {
                return branchLookup.get(normalizeName(aliasTarget));
            }

            for (const [bNorm, branchDoc] of branchLookup.entries()) {
                if (bNorm.length >= 3 && (norm.includes(bNorm) || bNorm.includes(norm))) {
                    return branchDoc;
                }
            }
            return null;
        };

        const locations = (locationsRes.recordset || []).map((loc) => {
            const id = Number(loc.LocationId);
            const crKey = id > 1 ? getLocationCrKey(id) : null;
            const matched = id > 1 ? matchBranch(loc.Location) : null;
            return {
                locationId: id,
                name: loc.Location,
                crKey,
                crName: crKey === 'naap' ? "New Al Atta'a CR" : crKey === 'aap' ? "Al Atta'a Main CR" : null,
                isWarehouse: id === 4,
                matchedBranchId: matched?._id?.toString() || null,
                matchedBranchName: matched?.name || null
            };
        });

        const locationMatchMap = new Map(locations.map((l) => [l.locationId, l]));

        return {
            fyid,
            companyName: companyRow.companyName,
            locations,
            locationMatchMap,
            medReqBranches: branches.map((b) => ({ _id: b._id.toString(), name: b.name }))
        };
    });
}
