/**
 * Mochi API Service
 * Handles data fetching and authentication.
 * Currently supports a MOCK mode for development without a reliable backend.
 */
import { makeBlobs, enrichBlob } from '../utils/blobHelpers';

// Toggle this to switch between Mock Data and Real API
const USE_MOCK = false
    ;
const API_BASE_URL = '/api';
const DEMO_PASSWORD = 'User0'; // Hardcoded for demo integration

// --- Helper for Mock Dates ---
const getRelDate = (offsetDays) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString();
};

// --- Mock Data Store ---
const MOCK_DATA = {
    today: {
        id: 'today',
        label: 'Today',
        fullDate: getRelDate(0),
        emoji: '😇',
        statusText: '情绪起起伏伏，你始终能把自己接住',
        // Make sure today's blobs have correct current dates when loaded
        blobs: makeBlobs().map(b => ({ ...b, time: new Date().toISOString() })),
        whisper: { text: '听起来你现在需要一点点安静的空间...' },
    },
    yesterday: {
        id: 'yesterday',
        label: 'Yesterday',
        fullDate: getRelDate(1),
        emoji: '😌',
        statusText: '虽然有些波折，但最后还是找到了平静',
        whisper: { text: '这是你昨天留下的记录' },
        archiveLabel: {
            emotions: '#疲惫 #烦躁→平静',
            events: '加班 | 深夜散步 | 放空'
        },
        blobs: [
            { id: 10, sentimentTag: '沉思紫/灰', label: '疲惫', time: getRelDate(1), note: '洗完澡感觉好多了', source: '手动记录' },
            { id: 11, sentimentTag: '沉思紫/灰', label: '思考', time: getRelDate(1), note: '关于未来的计划...', source: '对话提取' },
        ].map(enrichBlob)
    },
    day3: {
        id: 'day3',
        label: 'day3',
        fullDate: getRelDate(2),
        emoji: '😴',
        statusText: '那天你好像睡了很久...',
        whisper: { text: '深度睡眠是最好的治愈' },
        archiveLabel: {
            emotions: '#焦虑 #挫败 #治愈',
            events: '任务堆积 | 某件事没说完'
        },
        blobs: [] // Empty date
    },
    day4: {
        id: 'day4',
        label: 'day4',
        fullDate: getRelDate(3),
        emoji: '⚡️',
        statusText: '能量满满的一天，效率很高',
        whisper: { text: '这是你的高效时刻' },
        archiveLabel: {
            emotions: '#兴奋 #成就感 #满足',
            events: '项目上线 | 团队聚餐 | 好的睡眠'
        },
        blobs: [
            { id: 20, sentimentTag: '能量橙/黄', label: '心流', time: getRelDate(3), note: '专注工作的感觉真好', source: '手动记录' }
        ].map(enrichBlob)
    },
    day5: {
        id: 'day5',
        label: 'day5',
        fullDate: getRelDate(4),
        emoji: '🧘‍♂️',
        statusText: '平静如水，适合静坐',
        whisper: { text: '内心的宁静最仁贵' },
        archiveLabel: {
            emotions: '#平静 #专注 #放松',
            events: '早起冥想 | 整理房间'
        },
        blobs: [] // Empty date
    }
};

const getHeaders = (includeAuth = true) => {
    let token = localStorage.getItem('mochi_token');

    // Auto-clean the specific 'demo token' (with space) or 'demo_token' (with underscore)
    if (token && (token === 'demo token' || token === 'demo_token')) {
        console.warn(`[getHeaders] Purging legacy mock token: ${token}`);
        localStorage.removeItem('mochi_token');
        token = null;
    }

    const headers = {
        'Content-Type': 'application/json',
        'X-Demo-Password': DEMO_PASSWORD
    };
    if (includeAuth && token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`[API] Headers generated (auth=${includeAuth}, hasToken=${!!token}):`, headers);
    return headers;
};

// --- Unread Blob Cache Management (Date-based) ---
const UNREAD_IDS_KEY = 'mochi_unread_blob_ids';
const UNREAD_DATE_KEY = 'mochi_unread_date';

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayDateString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * Add a blob ID to the unread cache
 * @param {number|string} id - Blob ID to cache
 */
export const addUnreadBlobId = (id) => {
    const today = getTodayDateString();
    const cachedDate = localStorage.getItem(UNREAD_DATE_KEY);

    // If date changed, clear old cache
    if (cachedDate && cachedDate !== today) {
        clearUnreadBlobIds();
    }

    // Get existing IDs
    const existingIds = getUnreadBlobIds();

    // Add new ID if not already present
    if (!existingIds.includes(String(id))) {
        existingIds.push(String(id));
        localStorage.setItem(UNREAD_IDS_KEY, existingIds.join(','));
        localStorage.setItem(UNREAD_DATE_KEY, today);
        console.log(`[Cache] Added unread blob ID: ${id}`);
    }
};

/**
 * Get cached unread blob IDs (auto-clears if date changed)
 * @returns {Array<string>} Array of blob ID strings
 */
export const getUnreadBlobIds = () => {
    const today = getTodayDateString();
    const cachedDate = localStorage.getItem(UNREAD_DATE_KEY);

    // If date changed, clear cache and return empty
    if (cachedDate && cachedDate !== today) {
        console.log(`[Cache] Date changed from ${cachedDate} to ${today}, clearing cache`);
        clearUnreadBlobIds();
        return [];
    }

    const idsStr = localStorage.getItem(UNREAD_IDS_KEY);
    if (!idsStr) return [];

    return idsStr.split(',').filter(id => id.trim());
};

/**
 * Clear the unread blob cache
 */
export const clearUnreadBlobIds = () => {
    localStorage.removeItem(UNREAD_IDS_KEY);
    localStorage.removeItem(UNREAD_DATE_KEY);
    console.log('[Cache] Cleared unread blob IDs');
};

// Callback function to handle token expiration
let onTokenExpired = null;

export const setTokenExpiredCallback = (callback) => {
    onTokenExpired = callback;
};

// Helper function to handle API errors
const handleApiError = async (response) => {
    let errorDetail = '';
    try {
        const text = await response.text();
        try {
            const errorData = JSON.parse(text);
            errorDetail = errorData.error || errorData.message || text;
        } catch (e) {
            errorDetail = text || `Status: ${response.status}`;
        }
    } catch (e) {
        errorDetail = `Status: ${response.status}`;
    }

    console.error(`[API] Error (${response.status}):`, errorDetail);

    if (response.status === 401) {
        console.error('[API] Token expired or unauthorized');
        localStorage.removeItem('mochi_token');
        if (onTokenExpired) {
            onTokenExpired();
        }
        throw new Error('Token expired. Please login again.');
    }
};

/**
 * Maps backend blob format to frontend format
 */
const mapBackendBlob = (b) => {
    if (!b) return null;

    // Standardize time: ensure it has Z if it looks like UTC but lacks offset
    let time = b.created_at || b.time || new Date().toISOString();
    if (time && typeof time === 'string' && !time.includes('Z') && !time.includes('+')) {
        time += 'Z'; // Assume UTC if no timezone info present
    }

    // Map backend categories to frontend sentiment tags
    // backend results: "沉思紫/灰", "愈疗蓝/绿", "平静蓝/绿", etc.
    let sentimentTag = b.category || '愈疗蓝/绿';
    if (sentimentTag.startsWith('平静')) sentimentTag = '愈疗蓝/绿';

    return enrichBlob({
        id: b.id,
        sentimentTag: sentimentTag,
        label: b.title || b.label || '新记录',
        time: time,
        note: b.content || b.note || '',
        source: b.source || '手动记录',
        isDiscussed: !!b.is_discussed,
        color: b.color // Backend-driven color
    });
};

// Global helper for user to clear state manually if needed
if (typeof window !== 'undefined') {
    window.resetMochiSession = () => {
        localStorage.removeItem('mochi_token');
        window.location.reload();
    };
}

/**
 * Fetches the timeline (list of available dates/keys).
 * Uses /emotion-blobs/dates to get dates with blobs.
 * @returns {Promise<Array>} List of timeline items
 */
export const fetchTimeline = async () => {
    if (USE_MOCK) {
        // Return keys in chronological order (Oldest -> Newest aka Today)
        const keys = ['day5', 'day4', 'day3', 'yesterday', 'today'];
        return keys.map(key => {
            const data = MOCK_DATA[key];
            return {
                id: data.id,
                label: data.label,
                fullDate: data.fullDate,
                hasData: key === 'today' || (data.blobs && data.blobs.length > 0)
            };
        });
    }

    // Calculate date range: from 30 days ago to tomorrow (to include today)
    const now = new Date();
    const to = new Date(now);
    to.setUTCHours(0, 0, 0, 0);
    to.setUTCDate(to.getUTCDate() + 1); // Tomorrow UTC 00:00:00

    const from = new Date(now);
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - 30); // 30 days ago UTC 00:00:00

    const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString()
    });

    const response = await fetch(`${API_BASE_URL}/emotion-blobs/dates?${params}`, {
        headers: getHeaders()
    });
    if (!response.ok) {
        await handleApiError(response);
        throw new Error('Failed to fetch timeline');
    }
    const result = await response.json();
    const datesWithData = result.data || [];

    console.log('[API] Dates with data from backend:', datesWithData);

    // Convert backend dates to timeline format
    // IMPORTANT: Use UTC dates to avoid timezone issues
    const currentTime = new Date();
    const today = new Date(Date.UTC(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate()));

    // Create timeline items for the last 30 days (from oldest to newest)
    const timeline = [];
    for (let i = 29; i >= 0; i--) { // Start from 29 days ago, go to today (i=0)
        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() - i);
        const dateStr = date.toISOString();
        const dateOnly = dateStr.split('T')[0]; // YYYY-MM-DD

        // Check if this date has data from backend
        const hasData = datesWithData.some(d => d.startsWith(dateOnly));

        let id, label;
        if (i === 0) {
            id = 'today';
            label = 'Today';
        } else if (i === 1) {
            id = 'yesterday';
            label = 'Yesterday';
        } else {
            id = `day${i + 1}`;
            // Let the frontend handle the relative label (Mon 27, etc.)
            label = `Day ${i + 1}`;
        }

        timeline.push({
            id,
            label,
            fullDate: dateStr,
            hasData: i === 0 || hasData // Today always shows as having data
        });
    }

    console.log('[API] Generated timeline:', timeline);
    return timeline;
};

/**
 * Generate smart UI elements based on blob content
 */
const generateSmartUI = (blobs, isToday) => {
    if (!blobs || blobs.length === 0) {
        return {
            emoji: isToday ? '😇' : '😌',
            statusText: isToday ? '今天还没有记录呢' : '那天好像很安静',
            whisper: isToday ? '开始记录你的第一个情绪吧' : '那时候的你，在想什么呢？'
        };
    }

    // Count sentiments
    const counts = {};
    blobs.forEach(b => {
        counts[b.sentimentTag] = (counts[b.sentimentTag] || 0) + 1;
    });

    // Find dominant sentiment
    let dominant = '愈疗蓝/绿';
    let maxCount = 0;
    Object.entries(counts).forEach(([tag, count]) => {
        if (count > maxCount) {
            maxCount = count;
            dominant = tag;
        }
    });

    // Map to UI
    const mapping = {
        '能量橙/黄': { emoji: '⚡️', status: '能量满满的一天，效率很高', whisper: '这是你的高效时刻' },
        '波动粉/红': { emoji: '😰', status: '情绪起起伏伏，你始终能把自己接住', whisper: '听起来你现在需要一点点安静的空间...' },
        '沉思紫/灰': { emoji: '🤔', status: '有些深沉的思考，适合静心', whisper: '内心的声音值得被听见' },
        '愈疗蓝/绿': { emoji: '😌', status: '虽然有些波折，但最后还是找到了平静', whisper: '平静是最仁贵的财富' }
    };

    const config = mapping[dominant] || mapping['愈疗蓝/绿'];

    // Add variations for statusText
    const variations = [
        '情绪起起伏伏，你始终能把自己接住',
        '在各种情绪中穿梭，你做得很好',
        '今天的记忆罐里，装满了真实的瞬间',
        '世界很吵，但这里很安静',
        '每一颗碎片，都是成长的痕迹'
    ];

    // Use stable random based on blob count to avoid flickering
    const statusText = blobs.length > 2 ? variations[blobs.length % variations.length] : config.status;

    // Convert internal sentiment tags to PRD Mood Categories
    const categoryMap = {
        '能量橙/黄': '积极/能量',
        '波动粉/红': '敏感/波动',
        '沉思紫/灰': '沉思/疲惫',
        '愈疗蓝/绿': '治愈/清新'
    };

    return {
        emoji: config.emoji,
        statusText: statusText,
        whisper: config.whisper,
        moodCategory: categoryMap[dominant] || '治愈/清新'
    };
};

/**
 * Fetches daily evaluation from backend (AI summary)
 * GET /emotion-blobs/eval
 */
export const fetchDailyEval = async () => {
    if (USE_MOCK) {
        return {
            mood_category: "治愈/清新",
            emoji: "😌",
            status_text: "Mock: 每一天都值得被温柔对待"
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/emotion-blobs/eval`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            console.warn('[API] Daily eval fetch failed, status:', response.status);
            return null; // Fail gracefully
        }

        const result = await response.json();
        return result.data;
    } catch (err) {
        console.error('[API] Daily eval error:', err);
        return null; // Fail gracefully
    }
};

/**
 * Fetches details for a specific day.
 * Uses /emotion-blobs?date=xxx to get blobs for a specific date.
 * @param {string} dateId - The ID of the date (e.g., 'today', 'yesterday')
 * @returns {Promise<Object>} The daily status object
 */
export const fetchDailyStatus = async (dateId) => {
    if (USE_MOCK) {
        const data = MOCK_DATA[dateId];
        if (!data) throw new Error('Date not found');
        return data;
    }

    // We need to convert dateId to actual date
    // For now, we'll use the timeline to get the fullDate
    // In production, you might want to cache this mapping
    const timeline = await fetchTimeline();
    const timelineItem = timeline.find(item => item.id === dateId);

    if (!timelineItem) {
        throw new Error(`Date ${dateId} not found in timeline`);
    }

    console.log(`[API] Fetching daily status for ${dateId}, fullDate: ${timelineItem.fullDate}`);

    const params = new URLSearchParams({
        date: timelineItem.fullDate
    });

    const isToday = dateId === 'today';

    // Simplified: Only fetch blobs here. Eval is fired separately by the caller to decouple UI.
    const blobsResponse = await fetch(`${API_BASE_URL}/emotion-blobs?${params}`, { headers: getHeaders() });
    const evalData = null;

    if (!blobsResponse.ok) {
        await handleApiError(blobsResponse);
        throw new Error('Failed to fetch daily status');
    }
    const result = await blobsResponse.json();
    const rawBlobs = result.data?.blobs || (Array.isArray(result.data) ? result.data : []);
    const blobs = rawBlobs.map(mapBackendBlob);
    console.log(`[API] Received ${blobs.length} blobs for ${dateId}`);

    const smartUI = generateSmartUI(blobs, isToday);

    // 1. Override smartUI with backend daily summary if available (Old Format)
    if (result.data?.dailySummary) {
        const ds = result.data.dailySummary;
        if (ds.events || ds.emotions) {
            smartUI.statusText = ds.events || smartUI.statusText;
            smartUI.whisper = ds.emotions || smartUI.whisper;
        }
    }

    // 2. Override with new Eval Data if available (New Format)
    if (evalData) {
        console.log('[API] Applying Eval Data:', evalData);
        if (evalData.mood_category) smartUI.moodCategory = evalData.mood_category;
        if (evalData.emoji) smartUI.emoji = evalData.emoji;
        if (evalData.status_text) smartUI.statusText = evalData.status_text;
        // Note: 'reason' is ignored as per requirement
    }

    // Cache-based Unread Logic (only for today)
    if (isToday) {
        const unreadIds = getUnreadBlobIds();
        console.log(`[API] Unread blob IDs from cache:`, unreadIds);

        blobs.forEach(b => {
            // Mark as unread if ID is in cache
            b.isUnread = unreadIds.includes(String(b.id));
        });

        // Clear cache after comparison
        clearUnreadBlobIds();
    }

    // Construct the daily status object to match expected format
    return {
        id: dateId,
        label: timelineItem.label,
        fullDate: timelineItem.fullDate,
        emoji: smartUI.emoji,
        statusText: smartUI.statusText,
        moodCategory: smartUI.moodCategory, // Pass through to frontend
        blobs: blobs,
        whisper: { text: smartUI.whisper },
        archiveLabel: dateId !== 'today' && blobs.length > 0 ? {
            emotions: Array.from(new Set(blobs.map(b => `#${b.label}`))).slice(0, 3).join(' '),
            events: blobs.map(b => b.label).slice(0, 3).join(' | ')
        } : undefined
    };
};



/**
 * Register a new user
 */
export const register = async (phoneNumber) => {
    console.log(`Registering with ${phoneNumber}...`);
    if (USE_MOCK) return { success: true };

    const response = await fetch(`${API_BASE_URL}/user/register`, {
        method: 'POST',
        headers: getHeaders(false),
        body: JSON.stringify({
            username: phoneNumber,
            password: DEMO_PASSWORD
        })
    });
    if (!response.ok) throw new Error('Registration failed');
    const data = await response.json();

    // If registration returns a token, Save it immediately
    const token = data.token || data.data?.token || data.access_token;
    if (token) {
        console.log('[API] Token received during registration, saving...');
        localStorage.setItem('mochi_token', token);
    }

    return data;
};

/**
 * Mock/Real Login (with auto-register retry)
 */
export const login = async (phoneNumber) => {
    console.log(`Logging in with ${phoneNumber} and password ${DEMO_PASSWORD}...`);

    // Reset old token before logging in to ensure we don't send demo_token
    localStorage.removeItem('mochi_token');

    const attemptLogin = async () => {
        if (USE_MOCK) {
            const mockResponse = {
                userId: 'user_123',
                token: 'demo_token',
                username: phoneNumber
            };
            localStorage.setItem('mochi_token', mockResponse.token);
            return mockResponse;
        }

        const response = await fetch(`${API_BASE_URL}/user/login`, {
            method: 'POST',
            headers: getHeaders(false), // No Auth for login
            body: JSON.stringify({
                username: phoneNumber,
                password: DEMO_PASSWORD
            })
        });

        if (!response.ok) throw new Error(`Login failed: ${response.status}`);
        const data = await response.json();
        console.log('[API] Login Server Response:', data);

        // Try various common token keys
        const token = data.token || data.data?.token || data.access_token || data.accessToken;

        if (token) {
            console.log('[API] New token found, updating storage:', token);
            localStorage.setItem('mochi_token', token);
        } else {
            console.error('[API] Login succeeded but could not find token in response!', data);
        }

        return data;
    };

    try {
        const result = await attemptLogin();
        // 直接登录成功，用户是已有账户
        return { ...result, isNewUser: false };
    } catch (err) {
        // Only attempt registration if the error likely indicates "User Not Found" or "Wrong Password" (401)
        // Adjust this check based on actual backend behavior for "User not found"
        // Verified: Backend returns 401 for "用户名或密码错误"
        const isUserNotFound = err.message.includes('401') || err.message.includes('User not found');

        if (isUserNotFound) {
            console.warn('User not found, attempting auto-registration...');
            try {
                await register(phoneNumber);
                console.log('Registration success, retrying login...');
                const result = await attemptLogin();
                // 经过注册流程，这是新用户
                return { ...result, isNewUser: true };
            } catch (regErr) {
                console.error('Auto-registration or retry failed:', regErr);
                throw new Error('注册失败，请检查网络');
            }
        } else {
            // Re-throw other errors (500, Network, etc.)
            throw err;
        }
    }
};

/**
 * Create a new emotion blob
 * @param {string} content - The text content
 * @param {string} source - The source (e.g., '手动记录')
 */
export const createEmotionBlob = async (content, source = '手动记录') => {
    console.log(`Saving emotion blob: ${content} (${source})...`);

    // Only '手动记录' is currently supported by the backend
    const isSupported = source === '手动记录';

    if (USE_MOCK || !isSupported) {
        if (!isSupported && !USE_MOCK) {
            console.log(`Source '${source}' not yet supported by backend, using mock for now.`);
        }
        const newBlob = enrichBlob({
            id: Date.now(),
            sentimentTag: '波动粉/红',
            label: '新记录',
            time: new Date().toISOString(),
            note: content,
            source: source,
            isDiscussed: false,
            isUnread: true
        });

        // Cache the new blob ID for unread tracking
        addUnreadBlobId(newBlob.id);

        return newBlob;
    }

    const response = await fetch(`${API_BASE_URL}/emotion-blobs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content, source })
    });
    if (!response.ok) throw new Error('Failed to save emotion blob');
    const result = await response.json();

    // The backend returns { code, msg, data: { ...blob } }
    console.log('[API] Blob Created Response:', result);
    const createdBlob = mapBackendBlob(result.data || result);

    // Cache the new blob ID for unread tracking
    if (createdBlob && createdBlob.id) {
        addUnreadBlobId(createdBlob.id);
    }

    return createdBlob;
};

/**
 * Stream chat response from backend (or mock)
 * @param {Array} history - List of previous messages
 * @param {string} userMessage - The new user message
 * @param {Function} onChunk - Callback for each token/chunk received (text part)
 */
/**
 * Create a new chat session.
 * POST /chat/sessions
 * @param {string[]} emotion_blob_ids - List of emotion blob IDs to associate
 */
export const createChatSession = async (emotion_blob_ids = []) => {
    console.log('[API] Creating new chat session with blobs:', emotion_blob_ids);

    if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 500));
        return {
            id: `session_${Date.now()}`,
            created_at: new Date().toISOString(),
            is_ended: false,
            summary: '',
            emotion_blob_ids: emotion_blob_ids
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/chat/sessions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                emotion_blob_ids,
                emotionBlobIds: emotion_blob_ids // Double-safe: add camelCase alias
            })
        });

        if (!response.ok) {
            await handleApiError(response);
            throw new Error('Create session failed');
        }

        const result = await response.json();
        console.log('[API] New Chat Session Response:', result);
        const data = result.data || result;
        const session = Array.isArray(data) ? data[0] : data;

        if (session && !session.messages) {
            session.messages = [];
        }
        return session;
    } catch (err) {
        console.error('[API] Create Session Error:', err);
        throw err;
    }
};

/**
 * Fetch messages for a specific session.
 * GET /chat/sessions/{sessionId}/messages
 */
export const fetchSessionMessages = async (sessionId) => {
    console.log(`[API] Fetching messages for session: ${sessionId}`);

    if (USE_MOCK) {
        return []; // Typically handled by currentSession history in mock
    }

    try {
        const response = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/messages`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            await handleApiError(response);
            throw new Error('Fetch session messages failed');
        }

        const result = await response.json();
        return result.data || result;
    } catch (err) {
        console.error('[API] Fetch Messages Error:', err);
        throw err;
    }
};

/**
 * Enhanced streamChat to support Mochi backend format.
 * POST /chat/messages
 * @param {string} sessionId - Target session ID
 * @param {string} userMessage - Message text
 * @param {string[]} emotionBlobIds - Related blob IDs
 * @param {Function} onChunk - Callback for each tokens
 */
export const streamChat = async (sessionId, userMessage, emotionBlobIds = [], onChunk) => {
    console.log('[API] Stream Chat Request:', { sessionId, userMessage, emotionBlobIds });

    if (USE_MOCK) {
        // Mock Streaming Implementation
        const mockResponse = "我在听。感觉这个瞬间对你很重要呢，想再多分享一点吗？";
        const tokens = mockResponse.split('');
        for (let i = 0; i < tokens.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50)); // Random delay
            onChunk(tokens[i]);
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/chat/messages`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                sessionId,
                message: userMessage,
                emotionBlobIds,
                emotion_blob_ids: emotionBlobIds // Double-safe: add snake_case alias
            })
        });

        if (!response.ok) {
            await handleApiError(response);
            throw new Error('Chat stream failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('[API] Stream Reader: Done');
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            console.log('[API] Stream Raw Chunk Received:', chunk);
            buffer += chunk;

            const lines = buffer.split('\n');
            // Keep the last line in the buffer as it may be incomplete
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                console.log('[API] SSE line:', trimmed);

                // Standard SSE format: "data: <json>" or "data:<json>"
                if (trimmed.startsWith('data:')) {
                    // Extract the part after "data:" (ignoring first space if exists)
                    const dataPart = trimmed.slice(5).trimStart();
                    if (!dataPart) continue;

                    try {
                        const json = JSON.parse(dataPart);
                        if (json.content) {
                            console.log('[API] SSE Triggering onChunk with content:', json.content);
                            onChunk(json.content);
                        }
                    } catch (e) {
                        console.warn('[API] SSE line parsing error:', e, 'Data:', dataPart);
                    }
                }
            }
        }

    } catch (err) {
        console.error('[API] Stream Error:', err);
        throw err;
    }
};

/**
 * Fetch chat session (history) with pagination.
 * @param {number} limit - Number of sessions to return (default 10)
 * @param {string} beforeTime - RFC3339 timestamp to fetch sessions older than this
 */
export const fetchChatSessions = async (limit = 10, beforeTime = null) => {
    console.log(`[API] Fetching chat history (limit=${limit}, before=${beforeTime})`);

    // Real API implementation (L3.2)
    try {
        const url = `${API_BASE_URL}/chat/sessions?page=${beforeTime ? '2' : '1'}`;
        console.log(`[API] Fetching sessions from: ${url}`);

        const response = await fetch(url, {
            headers: getHeaders()
        });

        if (!response.ok) {
            await handleApiError(response);
            throw new Error('Fetch sessions failed');
        }

        const result = await response.json();
        console.log('[API] Chat Sessions Result:', result);
        const rawSessions = result.data?.sessions || result.data || result || [];
        const sessions = (Array.isArray(rawSessions) ? rawSessions : []).map(s => ({
            ...s,
            messages: s.messages || []
        }));

        return {
            sessions,
            hasMore: result.data?.total > (result.data?.page * result.data?.pageSize)
        };
    } catch (err) {
        console.error('[API] Fetch Sessions Error:', err);
        throw err;
    }
};

export default {
    fetchTimeline,
    fetchDailyStatus,
    login,
    register,
    createEmotionBlob,
    createChatSession,
    fetchSessionMessages,
    streamChat,
    fetchSessionMessages,
    streamChat,
    fetchChatSessions,
    fetchDailyEval,
    setTokenExpiredCallback
};
