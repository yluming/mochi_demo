/**
 * Mochi API Service
 * Handles data fetching and authentication.
 * Currently supports a MOCK mode for development without a reliable backend.
 */
import { makeBlobs, enrichBlob } from '../utils/blobHelpers';

// Toggle this to switch between Mock Data and Real API
const USE_MOCK = true
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
    if (token === 'demo token' || token === 'demo_token') {
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
    return headers;
};

// Callback function to handle token expiration
let onTokenExpired = null;

export const setTokenExpiredCallback = (callback) => {
    onTokenExpired = callback;
};

// Helper function to handle API errors
const handleApiError = (response) => {
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

    return enrichBlob({
        id: b.id,
        sentimentTag: b.category || '波动粉/红',
        label: b.title || b.label || '新记录',
        time: time,
        note: b.content || b.note || '',
        source: b.source || '手动记录',
        isDiscussed: !!b.is_discussed
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
    to.setDate(to.getDate() + 1); // Tomorrow to ensure today is included
    to.setHours(0, 0, 0, 0);

    const from = new Date(now);
    from.setDate(from.getDate() - 30); // 30 days ago
    from.setHours(0, 0, 0, 0);

    const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString()
    });

    const response = await fetch(`${API_BASE_URL}/emotion-blobs/dates?${params}`, {
        headers: getHeaders()
    });
    if (!response.ok) {
        handleApiError(response);
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
    let dominant = '平静蓝/绿';
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
        '平静蓝/绿': { emoji: '😌', status: '虽然有些波折，但最后还是找到了平静', whisper: '平静是最仁贵的财富' }
    };

    const config = mapping[dominant] || mapping['平静蓝/绿'];

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
        '平静蓝/绿': '治愈/清新'
    };

    return {
        emoji: config.emoji,
        statusText: statusText,
        whisper: config.whisper,
        moodCategory: categoryMap[dominant] || '治愈/清新'
    };
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

    const response = await fetch(`${API_BASE_URL}/emotion-blobs?${params}`, {
        headers: getHeaders()
    });
    if (!response.ok) {
        handleApiError(response);
        throw new Error('Failed to fetch daily status');
    }
    const result = await response.json();
    const blobs = (result.data || []).map(mapBackendBlob);
    console.log(`[API] Received ${blobs.length} blobs for ${dateId}`);

    const isToday = dateId === 'today';
    const smartUI = generateSmartUI(blobs, isToday);

    // Timestamp-based Unread Logic
    if (isToday) {
        const lastVisitStr = localStorage.getItem('mochi_last_home_visit');
        const lastVisit = lastVisitStr ? new Date(lastVisitStr).getTime() : 0;

        blobs.forEach(b => {
            const blobTime = new Date(b.time).getTime();
            // If blob is newer than last visit, it is unread
            if (blobTime > lastVisit) {
                b.isUnread = true;
            }
        });
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
 * Updates the 'last home visit' timestamp.
 * Call this when leaving the home screen.
 */
export const updateLastHomeVisit = async () => {
    const now = new Date().toISOString();
    console.log('[API] Updating Last Home Visit:', now);
    localStorage.setItem('mochi_last_home_visit', now);
    if (USE_MOCK) return;
    // In real app: await fetch(`${API_BASE_URL}/user/visit`, { method: 'POST', body: { time: now } });
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
        // If login fails (user might not exist), try registering once
        console.warn('Login failed, attempting auto-registration...', err);
        try {
            await register(phoneNumber);
            console.log('Registration success, retrying login...');
            const result = await attemptLogin();
            // 经过注册流程，这是新用户
            return { ...result, isNewUser: true };
        } catch (regErr) {
            console.error('Auto-registration or retry failed:', regErr);
            throw new Error('登录及自动注册均失败，请检查后端状态或网络');
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
        return enrichBlob({
            id: Date.now(),
            sentimentTag: '波动粉/红',
            label: '新记录',
            time: new Date().toISOString(),
            note: content,
            source: source,
            isDiscussed: false,
            isUnread: true // Newer than last visit, so true
        });
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
    return mapBackendBlob(result.data || result);
};

/**
 * Stream chat response from backend (or mock)
 * @param {Array} history - List of previous messages
 * @param {string} userMessage - The new user message
 * @param {Function} onChunk - Callback for each token/chunk received (text part)
 */
export const streamChat = async (history, userMessage, onChunk) => {
    console.log('[API] Stream Chat Request:', userMessage);

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
        const response = await fetch(`${API_BASE_URL}/chat/stream`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                messages: [...history, { role: 'user', content: userMessage }]
            })
        });

        if (!response.ok) {
            handleApiError(response);
            throw new Error('Chat stream failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split('\n');
            // Keep the last line in the buffer as it may be incomplete
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                // Handle SSE format "data: ..."
                if (trimmed.startsWith('data: ')) {
                    const data = trimmed.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        // Compatible with standard LLM responses or Mochi backend
                        const content = json.content || json.choices?.[0]?.delta?.content || json.text;
                        if (content) onChunk(content);
                        else onChunk(data);
                    } catch (e) {
                        onChunk(data); // Raw text fallback
                    }
                } else {
                    // Fallback: If no "data:" prefix, assume raw text stream
                    onChunk(trimmed);
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

    if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 800)); // Simulate network delay

        // If no 'beforeTime', this is the initial load (latest sessions).
        // We defaults to returning the most recent history.
        const baseDate = beforeTime ? new Date(beforeTime) : new Date();

        // Generate fake historical sessions for demo
        const newSessions = Array.from({ length: limit }).map((_, i) => {
            const date = new Date(baseDate);
            // If initial load, start from yesterday (simulating history view)
            // If scrolling up, go back further from the cursor
            const offsetDays = beforeTime ? (i + 1) : i;

            // Set to fixed time (14:30) to avoid midnight crossover issues during late night testing
            date.setDate(date.getDate() - offsetDays);
            date.setHours(14, 30, 0, 0);

            // Ensure we don't accidentally create a future date if baseDate was "now"
            if (date > new Date()) {
                date.setDate(date.getDate() - 1);
            }

            return {
                id: `history_${Date.now()}_${i}_${offsetDays}`,
                startTime: date.toISOString(),
                closedAt: new Date(date.getTime() + 1000 * 60 * 30).toISOString(), // Ends at 15:00
                isClosed: true,
                endCardContent: `这是 ${offsetDays === 0 ? '今天' : offsetDays + ' 天前'} 的对话记录，那时候的你也很棒。`,
                messages: [
                    { type: 'user', text: `历史记录测试消息 (Day -${offsetDays}) ${i + 1}`, timestamp: date.toISOString() },
                    { type: 'ai', text: `也就是 ${date.toLocaleDateString()} 的事情了。`, timestamp: new Date(date.getTime() + 2000).toISOString() }
                ]
            };
        });

        // Reverse to keep chronological order (oldest -> new, but we generated new->old)
        return { sessions: newSessions.reverse(), hasMore: true };
    }

    // Real API implementation placeholder
    // const params = new URLSearchParams({ limit, ...(beforeTime ? { before: beforeTime } : {}) });
    // const res = await fetch(`${API_BASE_URL}/chat/sessions?${params}`);
    // return res.json();
};

export default {
    fetchTimeline,
    fetchDailyStatus,
    login,
    register,
    createEmotionBlob,
    streamChat,
    fetchChatSessions,
    setTokenExpiredCallback,
    updateLastHomeVisit
};
