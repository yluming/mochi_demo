/**
 * Mochi Blob Helpers
 * Utility functions for generating, enriching, and styling Emotion Blobs.
 */
import { SENTIMENT_PALETTES, PEARL_TINTS } from '../constants/visuals';

/**
 * Picks a random color from the specified sentiment palette.
 */
export const getRandomFromPalette = (tag) => {
    const palette = SENTIMENT_PALETTES[tag] || SENTIMENT_PALETTES['愈疗蓝/绿'];
    return palette[Math.floor(Math.random() * palette.length)];
};

/**
 * Assigns physical properties (radius, color) to a raw blob data object.
 */
export const enrichBlob = (blob) => ({
    ...blob,
    r: blob.r || (38 + Math.random() * 7),
    color: blob.color || getRandomFromPalette(blob.sentimentTag)
});

/**
 * Generates initial mock blobs for the demo.
 */
export const makeBlobs = () => [
    { id: 0, sentimentTag: '能量橙/黄', label: '心跳加速💗', time: '2025-11-09T12:20:00Z', note: '⏺️ 好球！！' },
    { id: 1, sentimentTag: '愈疗蓝/绿', label: '愉悦', time: '2025-11-09T13:00:00Z', note: '终于打羽毛球了！好爽～' },
    { id: 2, sentimentTag: '愈疗蓝/绿', label: '放松', time: '2025-11-09T14:00:00Z', note: '小小喝咖啡放松一下☕️' },
    { id: 3, sentimentTag: '沉思紫/灰', label: 'emo', time: '2025-11-09T10:00:00Z', note: '周一又上班了' },
    { id: 4, sentimentTag: '波动粉/红', label: '紧张', time: '2025-11-09T11:00:00Z', note: '今天好像有点紧张。老板不太满意哦' },
    { id: 5, sentimentTag: '能量橙/黄', label: '心跳加速💗', time: '2025-11-09T10:30:00Z', note: '⏺️你这个汇报的什么东西，重新想想…' },
].map(enrichBlob);

/**
 * Generates semi-transparent pearl blobs to fill the jar.
 */
export const makePearlBlobs = () => {
    return Array.from({ length: 16 }).map((_, i) => ({
        id: `pearl-${i}`,
        r: 10 + Math.random() * 8,
        color: PEARL_TINTS[Math.floor(Math.random() * PEARL_TINTS.length)],
        isPearl: true,
        label: '',
        note: '',
        time: ''
    }));
};
