import * as XLSX from 'xlsx';

/**
 * Exports tabular analytics data to Excel (.xlsx) with an optional filter metadata header sheet.
 */
export function exportToExcel(rows = [], filename = 'analytics_report', sheetName = 'Report', filterMeta = {}) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

    const metaEntries = Object.entries(filterMeta)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => ({ Filter: k, Value: String(v) }));
    if (metaEntries.length > 0) {
        metaEntries.push({ Filter: 'Exported At', Value: new Date().toLocaleString() });
        const metaWs = XLSX.utils.json_to_sheet(metaEntries);
        XLSX.utils.book_append_sheet(wb, metaWs, 'Applied Filters');
    }

    const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, safeName);
}

/**
 * Exports tabular analytics data to CSV (.csv) using XLSX utility for proper RFC-4180 escaping.
 */
export function exportToCsv(rows = [], filename = 'analytics_report') {
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
