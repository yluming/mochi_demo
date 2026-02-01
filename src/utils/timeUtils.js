/**
 * Mochi Time Utilities
 * Handles conversion between RFC3339 (Backend) and Human-Readable (UI) formats.
 */

/**
 * Formats RFC3339 string to HH:mm (e.g., 2025-11-09T14:32:00Z -> 14:32)
 */
export const formatToHHmm = (isoString) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (e) {
        return '';
    }
};

/**
 * Formats RFC3339 string to Chinese Date (e.g., 2025-11-09T00:00:00Z -> 2025年11月9日)
 */
export const formatToDate = (isoString) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
        return '';
    }
};

/**
 * Formats RFC3339 string to Chinese Weekday (e.g., 2025-11-09T00:00:00Z -> 星期一)
 */
export const formatToWeekday = (isoString) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('zh-CN', { weekday: 'long' });
    } catch (e) {
        return '';
    }
};

/**
 * Formats RFC3339 string to History Session Timestamp (e.g., 2025/11/09 · 14:32)
 */
export const formatToSessionTime = (isoString) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const datePart = date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/-/g, '/');
        const timePart = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${datePart} · ${timePart}`;
    } catch (e) {
        return '';
    }
};

/**
 * Generates relative labels for the Date Roller (Today, Yesterday, Thu 7, etc.)
 */
export const getTimeLabel = (isoString) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const now = new Date();

        // IMPORTANT: Use UTC dates for comparison since isoString is in UTC
        const dDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const dNow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

        const diffDays = Math.round((dNow - dDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';

        // Return short format: Mon 3, Tue 4, etc.
        // Use UTC methods to get the correct weekday and day
        const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        const day = date.getUTCDate();
        return `${weekdayShort} ${day}`;
    } catch (e) {
        return '';
    }
};

/**
 * Checks if a given RFC3339 string represents Today (Local Time)
 */
export const isDateToday = (isoString) => {
    if (!isoString) return false;
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return false;

        const now = new Date();
        return date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();
    } catch (e) {
        return false;
    }
};
