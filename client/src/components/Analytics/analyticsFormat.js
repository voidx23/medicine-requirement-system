const OMAN_OFFSET_MS = 4 * 60 * 60 * 1000;

export function formatOMR(val, decimals = 3) {
    const num = Number(val || 0);
    return `OMR ${num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })}`;
}

export function formatNum(val, maxDecimals = 2) {
    const num = Number(val || 0);
    return num.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
}

/**
 * Formats Pacman Pro SQL Server timestamps (invdate, lastSoldAt, returnDate).
 * SQL Server stores Oman local wall-clock datetimes with no timezone offset,
 * and node-mssql (useUTC: true) serializes them verbatim with a trailing 'Z'.
 * Formatting in UTC preserves the exact stored Oman wall-clock date & time
 * without applying a second +4h browser timezone shift.
 */
export function formatDateTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
    });
}

export function getOmanTodayISO() {
    return new Date(Date.now() + OMAN_OFFSET_MS).toISOString().slice(0, 10);
}

function addDaysISO(isoDate, deltaDays) {
    const ms = Date.parse(`${isoDate}T00:00:00Z`) + deltaDays * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
}

export function getPresetDateRange(presetKey) {
    const today = getOmanTodayISO();
    switch (presetKey) {
        case 'today':
            return { startDate: today, endDate: today, preset: 'today', label: 'Today' };
        case 'yesterday': {
            const y = addDaysISO(today, -1);
            return { startDate: y, endDate: y, preset: 'yesterday', label: 'Yesterday' };
        }
        case 'this_week': {
            const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
            return { startDate: addDaysISO(today, -dow), endDate: today, preset: 'this_week', label: 'This Week' };
        }
        case 'this_month':
            return { startDate: `${today.slice(0, 7)}-01`, endDate: today, preset: 'this_month', label: 'This Month' };
        case '7d':
            // Exact 7 inclusive calendar days in Oman local time (today - 6 .. today)
            return { startDate: addDaysISO(today, -6), endDate: today, preset: '7d', label: '7D' };
        case '90d':
            // Exact 90 inclusive calendar days in Oman local time (today - 89 .. today)
            return { startDate: addDaysISO(today, -89), endDate: today, preset: '90d', label: '90D' };
        case '1y':
            // 1Y business definition: trailing 365 inclusive calendar days in Oman local time (today - 364 .. today)
            return { startDate: addDaysISO(today, -364), endDate: today, preset: '1y', label: '1Y' };
        case '30d':
        default:
            // Exact 30 inclusive calendar days in Oman local time (today - 29 .. today)
            return { startDate: addDaysISO(today, -29), endDate: today, preset: '30d', label: '30D' };
    }
}

export const DATE_PRESETS = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' },
    { key: 'this_month', label: 'This Month' },
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: '1y', label: '1Y' }
];

export const CR_OPTIONS = [
    { key: 'aap', title: "Al Atta'a Pharmacy (Main CR)", sub: 'Store AK6 + 9 AAP/NRP Branches' },
    { key: 'naap', title: "New Al Atta'a Pharmacies & Stores", sub: 'Bousher & Suwaiq (New CR)' },
    { key: 'all', title: 'All Retail Combined', sub: 'All Branches (Excl. Store Inter-CR)' }
];

export const CHANNEL_OPTIONS = [
    { key: 'pos', label: 'POS Counter' },
    { key: 'nonpos', label: 'Non-POS / Back-Office' },
    { key: 'all', label: 'All Channels' }
];

export const STATUS_OPTIONS = [
    { key: 'active', label: 'Active Only' },
    { key: 'cancelled', label: 'Cancelled / Voided' },
    { key: 'all', label: 'All Statuses' }
];

/**
 * Reads persistent analytics filter state from URLSearchParams with safe defaults.
 */
export function readAnalyticsParams(searchParams, defaults = {}) {
    const defaultRange = getPresetDateRange(defaults.preset || '30d');
    const preset = searchParams.get('preset') || (searchParams.get('startDate') ? 'custom' : defaultRange.preset);
    const startDate = searchParams.get('startDate') || (preset !== 'custom' ? getPresetDateRange(preset).startDate : defaultRange.startDate);
    const endDate = searchParams.get('endDate') || (preset !== 'custom' ? getPresetDateRange(preset).endDate : defaultRange.endDate);

    return {
        cr: searchParams.get('cr') || defaults.cr || 'aap',
        locationId: Number(searchParams.get('locationId') || defaults.locationId || 0),
        preset,
        startDate,
        endDate,
        channel: searchParams.get('channel') || defaults.channel || 'pos',
        status: searchParams.get('status') || defaults.status || 'active',
        search: searchParams.get('search') || '',
        categoryId: searchParams.get('categoryId') || '',
        supplierId: searchParams.get('supplierId') || '',
        cashierId: searchParams.get('cashierId') || '',
        paymodeId: searchParams.get('paymodeId') || '',
        date: searchParams.get('date') || ''
    };
}

/**
 * Builds a clean query string preserving active analytics filters across drill-downs.
 */
export function buildAnalyticsQuery(state = {}, overrides = {}) {
    const merged = { ...state, ...overrides };
    const qs = new URLSearchParams();
    const keys = [
        'cr', 'locationId', 'preset', 'startDate', 'endDate',
        'channel', 'status', 'search', 'categoryId', 'supplierId',
        'cashierId', 'paymodeId', 'date'
    ];
    for (const k of keys) {
        const val = merged[k];
        if (val !== undefined && val !== null && val !== '' && !(k === 'locationId' && Number(val) === 0)) {
            qs.set(k, String(val));
        }
    }
    return qs.toString();
}
