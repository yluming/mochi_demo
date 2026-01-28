import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Heart, MessageCircle, Radio, Signal, Wifi, Battery,
    ChevronRight, Settings, Send, User, Sparkles, X, ChevronLeft, Mic, Plus, Bell
} from 'lucide-react'

// --- 物理数据定义 ---
const makeBlobs = () => ([
    { id: 0, r: 42, color: '#F7AC52', label: '心跳加速💗', time: '12:20', note: '⏺️ 好球！！' },
    { id: 1, r: 38, color: '#FCA5A5', label: '愉悦', time: '13:00', note: '终于打羽毛球了！好爽～' },
    { id: 2, r: 40, color: '#34D399', label: '放松', time: '14:00', note: '小小喝咖啡放松一下☕️' },
    { id: 3, r: 44, color: '#60A5FA', label: 'emo', time: '10:00', note: '周一又上班了' },
    { id: 4, r: 40, color: '#A78BFA', label: '紧张', time: '11:00', note: '今天好像有点紧张。老板不太满意哦' },
    { id: 5, r: 38, color: '#F7AC52', label: '心跳加速💗', time: '10:30', note: '⏺️你这个汇报的什么东西，重新想想…' },
]);

const makePearlBlobs = () => {
    const pearlTints = ['#F9FAFB', '#F0F9FF', '#F5F3FF', '#F0FDF4', '#FFF1F2'];
    return Array.from({ length: 16 }).map((_, i) => ({
        id: `pearl-${i}`,
        r: 10 + Math.random() * 8,
        color: pearlTints[Math.floor(Math.random() * pearlTints.length)],
        isPearl: true,
        label: '',
        note: '',
        time: ''
    }));
};

const JAR_WIDTH = 340;

const JarPhysics = ({ onSelect, height, blobs, isArchive, isUnsealed, onUnseal, archiveData }) => {
    const startRef = useRef(performance.now());
    const [shimmerId, setShimmerId] = useState(null);
    const mouthX = JAR_WIDTH / 2;
    const mouthRange = 36;
    const [items] = useState(() => {
        const combined = [...(blobs || []), ...makePearlBlobs()];

        let initialItems = combined.map((b, i) => {
            const x = mouthX + (Math.random() * 2 - 1) * (b.isPearl ? JAR_WIDTH / 2 : mouthRange);
            // Initial Y for non-archive mode (falling down)
            const y = -30 - i * 30;

            return {
                ...b,
                x,
                y,
                vx: (Math.random() * 1.2 - 0.6),
                vy: 0,
                sx: 1,
                sy: 1,
                tsx: 1,
                tsy: 1,
                active: false,
                release: i * 100,
                settled: false,
            };
        });

        // Pre-simulate physics for Archive Mode to get a natural settled heap
        if (isArchive) {
            const SIM_STEPS = 600; // Enough steps to settle
            const g = 0.34;
            const damp = 0.96;
            const friction = 0.95;

            // Activate all immediately for simulation
            initialItems.forEach(it => {
                it.active = true;
                it.release = 0;
                // Randomize X slightly more for the pile
                it.x = mouthX + (Math.random() * 2 - 1) * 60;
                it.y = height / 2 - Math.random() * 100; // Start simpler for the fall
            });

            for (let s = 0; s < SIM_STEPS; s++) {
                for (let i = 0; i < initialItems.length; i++) {
                    const it = initialItems[i];
                    it.vy += g;
                    it.x += it.vx;
                    it.y += it.vy;

                    const left = it.r + 5;
                    const right = JAR_WIDTH - it.r - 5;
                    const floor = height - it.r - 10;

                    if (it.x < left) { it.x = left; it.vx *= -0.4; }
                    if (it.x > right) { it.x = right; it.vx *= -0.4; }
                    if (it.y > floor) {
                        it.y = floor;
                        const impact = Math.min(1.2, Math.abs(it.vy) / 6);
                        it.vy *= -0.2 * (0.6 + 0.4 * (1 - impact));
                        it.vx *= friction;
                    }
                }

                // Collisions
                for (let i = 0; i < initialItems.length; i++) {
                    for (let j = i + 1; j < initialItems.length; j++) {
                        const a = initialItems[i]; const b = initialItems[j];
                        const dx = b.x - a.x; const dy = b.y - a.y;
                        const dist = Math.hypot(dx, dy) || 0.001;
                        const min = a.r + b.r - 2;
                        if (dist < min) {
                            const overlap = (min - dist) / 2;
                            const nx = dx / dist; const ny = dy / dist;
                            a.x -= nx * overlap; a.y -= ny * overlap;
                            b.x += nx * overlap; b.y += ny * overlap;
                            const rvx = b.vx - a.vx; const rvy = b.vy - a.vy;
                            const vn = rvx * nx + rvy * ny;
                            if (vn < 0) {
                                const imp = -0.7 * vn;
                                a.vx -= imp * nx * 0.5; a.vy -= imp * ny * 0.5;
                                b.vx += imp * nx * 0.5; b.vy += imp * ny * 0.5;
                            }
                        }
                    }
                }
            }

            // Mark all as settled and stop velocity after sim
            initialItems.forEach(it => {
                it.vx = 0;
                it.vy = 0;
                it.settled = true;
            });
        }

        return initialItems;
    });
    const raf = useRef(null);
    const [, setFrame] = useState(0);

    // Shimmering Nudge Logic
    useEffect(() => {
        const interval = setInterval(() => {
            const undiscussed = items.filter(it => !it.isPearl && !it.isDiscussed);
            if (undiscussed.length > 0) {
                const target = undiscussed[Math.floor(Math.random() * undiscussed.length)];
                setShimmerId(target.id);
                setTimeout(() => setShimmerId(null), 2000); // Shimmer for 2 seconds
            }
        }, 8000); // Every 8 seconds
        return () => clearInterval(interval);
    }, [items]);

    useEffect(() => {
        const g = 0.34; // Reduced gravity for floatier feel
        const damp = 0.96; // Increased drag/damping
        const friction = 0.95;
        const settleEps = 0.02;

        const step = () => {
            const now = performance.now();
            const elapsed = now - startRef.current;

            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                if (!it.active && elapsed >= it.release) it.active = true;
                if (!it.active) continue;

                if (!it.settled) {
                    it.vy += g;
                    it.x += it.vx;
                    it.y += it.vy;
                }

                const left = it.r + 5;
                const right = JAR_WIDTH - it.r - 5;
                const floor = height - it.r - 10;

                if (it.x < left) { it.x = left; it.vx *= -0.4; }
                if (it.x > right) { it.x = right; it.vx *= -0.4; }
                if (it.y > floor) {
                    it.y = floor;
                    const impact = Math.min(1.2, Math.abs(it.vy) / 6);
                    it.vy *= -0.2 * (0.6 + 0.4 * (1 - impact));
                    it.vx *= friction;
                    it.tsx = 1 + 0.1 * impact;
                    it.tsy = 1 - 0.2 * impact;
                    if (Math.abs(it.vx) < settleEps && Math.abs(it.vy) < settleEps) {
                        it.vx = 0; it.vy = 0; it.settled = true; it.tsx = 1; it.tsy = 1;
                    }
                } else {
                    it.tsx = 1; it.tsy = 1;
                }
            }

            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const a = items[i]; const b = items[j];
                    if (!a.active || !b.active) continue;
                    const dx = b.x - a.x; const dy = b.y - a.y;
                    const dist = Math.hypot(dx, dy) || 0.001;
                    const min = a.r + b.r - 2;
                    if (dist < min) {
                        const overlap = (min - dist) / 2;
                        const nx = dx / dist; const ny = dy / dist;
                        a.x -= nx * overlap; a.y -= ny * overlap;
                        b.x += nx * overlap; b.y += ny * overlap;
                        const rvx = b.vx - a.vx; const rvy = b.vy - a.vy;
                        const vn = rvx * nx + rvy * ny;
                        if (vn < 0) {
                            const imp = -0.7 * vn; // Reduced bounciness for a 'softer' impact
                            a.vx -= imp * nx * 0.5; a.vy -= imp * ny * 0.5;
                            b.vx += imp * nx * 0.5; b.vy += imp * ny * 0.5;
                        }
                    }
                }
            }

            for (let i = 0; i < items.length; i++) {
                const it = items[i]; if (!it.active) continue;
                it.vx *= damp; it.vy *= damp;
                it.sx += (it.tsx - it.sx) * 0.2;
                it.sy += (it.tsy - it.sy) * 0.2;
            }

            setFrame(f => f + 1);
            raf.current = requestAnimationFrame(step);
        };

        // Only run physics if NOT in archive mode.
        // In archive mode, blobs are static (or animated via CSS/Framer only).
        if (!isArchive) {
            raf.current = requestAnimationFrame(step);
        }

        return () => cancelAnimationFrame(raf.current);
    }, [items, height, isArchive]);

    return (
        <div style={{ height, position: 'relative', width: JAR_WIDTH, margin: '0 auto' }}>
            <svg
                viewBox={`0 -60 ${JAR_WIDTH} ${height + 60}`}
                style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'visible',
                    filter: (isArchive && !isUnsealed) ? 'brightness(0.9) grayscale(0.15)' : 'none',
                    transition: 'filter 0.8s ease'
                }}
            >
                <defs>
                    <clipPath id="jarClip">
                        <rect x="0" y="0" width={JAR_WIDTH} height={height} rx="45" />
                    </clipPath>
                </defs>

                {/* 瓶身背景 - 降低不透明度使得更清透 */}
                <path
                    d={`
            M ${JAR_WIDTH / 2 - 55} 0 
            H 45 
            Q 0 0 0 45 
            V ${height - 45} 
            Q 0 ${height} 45 ${height} 
            H ${JAR_WIDTH - 45} 
            Q ${JAR_WIDTH} ${height} ${JAR_WIDTH} ${height - 45} 
            V 45 
            Q ${JAR_WIDTH} 0 ${JAR_WIDTH - 45} 0 
            H ${JAR_WIDTH / 2 + 55}
          `}
                    fill="rgba(255,255,255,0.4)"
                    stroke="#2D3748"
                    strokeWidth="3"
                />

                {/* 瓶盖和瓶颈部分 - 移到瓶身之后以建立层级 */}
                <g transform={`translate(${JAR_WIDTH / 2 - 70}, -50)`}>
                    <rect width="140" height="15" rx="4" fill="none" stroke="#2D3748" strokeWidth="2.5" />
                    <rect x="15" y="15" width="110" height="12" rx="2" fill="none" stroke="#2D3748" strokeWidth="2.5" />
                    {/* Flat Cap - History Mode */}
                    {isArchive && !isUnsealed && (
                        <motion.rect
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            width="140" height="20" rx="4"
                            fill="#2D3748"
                            transform="translate(0, -5)"
                        />
                    )}
                    <line x1="15" y1="27" x2="15" y2="50" stroke="#2D3748" strokeWidth="2.5" />
                    <line x1="125" y1="27" x2="125" y2="50" stroke="#2D3748" strokeWidth="2.5" />
                </g>

                {/* 玻璃高光滤镜 - 提升精致感 */}
                <path
                    d={`M 30 60 Q 60 40 100 50`}
                    fill="none"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="jar-gloss"
                />
                <path
                    d={`M ${JAR_WIDTH - 40} ${height - 80} V ${height - 40}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="jar-gloss"
                />

                <g clipPath="url(#jarClip)">
                    {items.map((it, i) => (
                        <motion.g
                            key={it.id}
                            style={{
                                x: it.x,
                                y: it.y,
                                scaleX: it.sx,
                                scaleY: it.sy,
                                cursor: it.isPearl ? 'default' : 'pointer'
                            }}
                            animate={isUnsealed ? { scale: [1, 1.15, 1] } : {}}
                            transition={{ duration: 0.5, ease: "backOut" }}
                            onClick={() => !it.isPearl && onSelect(it)}
                        >
                            <defs>
                                <radialGradient id={`grad-${it.id}`} cx="35%" cy="35%" r="65%">
                                    <stop offset="0%" stopColor={it.isDiscussed ? "#FFFFFF" : it.color} stopOpacity={it.isPearl ? "0.9" : (it.isDiscussed ? "0.7" : "0.95")} />
                                    <stop offset="100%" stopColor={it.color} stopOpacity={it.isPearl ? "0.6" : (it.isDiscussed ? "0.3" : "0.7")} />
                                </radialGradient>
                            </defs>
                            <ellipse
                                rx={it.r * 1.05}
                                ry={it.r * 0.95}
                                fill={`url(#grad-${it.id})`}
                                stroke={it.isPearl ? "rgba(255,255,255,0.4)" : (it.isDiscussed ? "rgba(255,255,255,0.6)" : "none")}
                                strokeWidth={it.isPearl ? "0.5" : (it.isDiscussed ? "2" : "0")}
                                style={{ transition: 'opacity 0.5s ease', opacity: it.isDiscussed ? 0.6 : 1 }}
                            />
                            {/* Shimmer Sparkles */}
                            {shimmerId === it.id && (
                                <g transform="scale(0.8)">
                                    <motion.circle
                                        cx={-it.r * 0.4} cy={-it.r * 0.2} r="3" fill="white"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
                                        transition={{ duration: 1, repeat: 1 }}
                                    />
                                    <motion.circle
                                        cx={it.r * 0.3} cy={it.r * 0.3} r="2" fill="white"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                                        transition={{ duration: 1, delay: 0.5, repeat: 1 }}
                                    />
                                </g>
                            )}
                            {it.isPearl && (
                                <ellipse
                                    cx={-it.r * 0.3}
                                    cy={-it.r * 0.3}
                                    rx={it.r * 0.3}
                                    ry={it.r * 0.2}
                                    fill="rgba(255, 255, 255, 0.6)"
                                />
                            )}
                        </motion.g>
                    ))}
                </g>
            </svg>

            {/* Receipt Label */}
            <AnimatePresence>
                {isArchive && !isUnsealed && (
                    <motion.div
                        className="receipt-label"
                        initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "calc(-50% - 20px)" }}
                        animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                        exit={{
                            opacity: 0,
                            scale: 0.8,
                            rotate: 15,
                            x: "20%",
                            y: "-150%",
                            transition: { duration: 0.6, ease: "easeIn" }
                        }}
                        onClick={onUnseal}
                    >
                        <div className="receipt-content">
                            <div className="receipt-list">
                                {archiveData.events?.map((ev, idx) => (
                                    <div key={idx} className="receipt-event-item">
                                        {ev.text}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="receipt-grain"></div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Mock Data ---
const MOCK_DATA = {
    today: {
        label: 'Today',
        dateStr: '2025年11月9日 星期一',
        emoji: '😇',
        statusTitle: '今日状态',
        statusText: '情绪起起伏伏，你始终能把自己接住',
        whisper: { icon: <Sparkles size={14} />, text: '听起来你现在需要一点点安静的空间...' },
        blobs: makeBlobs(),
    },
    yesterday: {
        id: 'yesterday',
        label: 'Sat 8',
        dateStr: '2025年11月8日 星期日',
        emoji: '😌',
        statusTitle: '昨日回看',
        statusText: '虽然有些波折，但最后还是找到了平静',
        whisper: { icon: <Radio size={14} />, text: '这是你昨天留下的记录' },
        emotionSummary: '平静而有力量',
        events: [
            { text: '🎧 随口记了一句有点累' },
            { text: '⚡️ 工作中有点不舒服' },
            { text: '� 后来慢慢安静下来' },
            { text: '🌙 写下了一点空空的感觉' }
        ],
        blobs: [
            { id: 10, r: 45, color: '#60A5FA', label: '疲惫', time: '22:30', note: '洗完澡感觉好多了', source: 'manual' },
            { id: 11, r: 38, color: '#A78BFA', label: '思考', time: '14:00', note: '关于未来的计划...', source: 'chat' },
        ]
    },
    thu7: {
        id: 'thu7',
        label: 'Thu 7',
        dateStr: '2025年11月7日 星期五',
        emoji: '😴',
        statusTitle: '历史记录',
        statusText: '那天你好像睡了很久...',
        whisper: { icon: <Sparkles size={14} />, text: '深度睡眠是最好的治愈' },
        emotionSummary: '深度修复中',
        events: [
            { text: '🛌 睡了一个长长的午觉' },
            { text: '✨ 感觉能量慢慢回来了' }
        ],
        blobs: [] // Empty date
    },
    wed6: {
        id: 'wed6',
        label: 'Wed 6',
        dateStr: '2025年11月6日 星期四',
        emoji: '⚡️',
        statusTitle: '历史记录',
        statusText: '能量满满的一天，效率很高',
        whisper: { icon: <Radio size={14} />, text: '这是你的高效时刻' },
        emotionSummary: '效率满分',
        events: [
            { text: '🔥 专注力非常棒的一天' },
            { text: '🍱 吃到了很好吃的便当' },
            { text: '📝 完成了所有计划事项' }
        ],
        blobs: [
            { id: 20, r: 40, color: '#FBBF24', label: '心流', time: '10:00', note: '专注工作的感觉真好', source: 'manual' }
        ]
    },
    tue5: {
        id: 'tue5',
        label: 'Tue 5',
        dateStr: '2025年11月5日 星期三',
        emoji: '🧘‍♂️',
        statusTitle: '历史记录',
        statusText: '平静如水，适合静坐',
        whisper: { icon: <Sparkles size={14} />, text: '内心的宁静最珍贵' },
        blobs: [] // Empty date
    }
};

function App() {
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedBlob, setSelectedBlob] = useState(null);
    const [selectedDate, setSelectedDate] = useState('today');
    const [onboardingStep, setOnboardingStep] = useState(0); // 0: Welcome, 1: Expression, 2: Done
    const [todayBlobs, setTodayBlobs] = useState([]); // Start with empty for fresh onboarding
    // const [todayBlobs, setTodayBlobs] = useState(makeBlobs()); // 原本的今日案例数据
    const [showTooltip, setShowTooltip] = useState(false); // Post-onboarding guide

    // Archive sealed state (Ephemeral: resets when navigating or changing dates)
    const [isUnsealed, setIsUnsealed] = useState(false);

    // Reset unseal state when changing dates or pages
    useEffect(() => {
        setIsUnsealed(false);
    }, [selectedDate, currentPage]);

    const [isScanning, setIsScanning] = useState(false); // Device discovery modal
    const [pairingDevice, setPairingDevice] = useState(null); // Current device in setup flow
    const [onboardingInput, setOnboardingInput] = useState(''); // Textarea content for onboarding/manual
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showLogin, setShowLogin] = useState(true);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [discussedIds, setDiscussedIds] = useState(new Set());
    const [pendingPush, setPendingPush] = useState(null);

    // 语音输入状态 (Global Voice State)
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [voiceContext, setVoiceContext] = useState(null); // 'home' | 'chat' | 'onboarding'
    const [voiceVolume, setVoiceVolume] = useState(0); // 0-100 for animation
    const [isProcessing, setIsProcessing] = useState(false); // Whether waiting for final STT
    const [interimText, setInterimText] = useState(''); // Real-time transcribed text
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const recognitionRef = useRef(null);
    const initialTextRef = useRef(''); // 记录录音开始前的文字

    // 启动语音监控与识别
    const startVoice = async (context) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setVoiceContext(context);
            setIsVoiceActive(true);
            setIsProcessing(false);
            setInterimText('');

            // 记录当前输入框的内容，作为“底色”
            initialTextRef.current = context === 'chat' ? chatInput : onboardingInput;

            // 1. Audio Visualizer Setup
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const updateVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
                setVoiceVolume(sum / bufferLength);
                animationFrameRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();

            // 2. Real Speech Recognition Setup
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.lang = 'zh-CN';
                recognition.interimResults = true; // 开启实时转写反馈
                recognition.maxAlternatives = 1;
                recognition.continuous = true;

                recognition.onresult = (event) => {
                    let sessionTranscript = '';
                    for (let i = 0; i < event.results.length; ++i) {
                        sessionTranscript += event.results[i][0].transcript;
                    }

                    // 组合：录音前的文字 + 本次录音的所有文字 (Cumulative for this session)
                    const updatedText = initialTextRef.current + sessionTranscript;

                    if (context === 'chat') {
                        setChatInput(updatedText);
                    } else if (context === 'onboarding') {
                        setOnboardingInput(updatedText);
                    }

                    // 如果有 final 结果，可以考虑自动停止（可选），但我们现在是长按逻辑，靠 onPointerUp 停止
                };

                recognition.onerror = (event) => {
                    console.error("Speech recognition error:", event.error);
                    setIsVoiceActive(false);
                };

                recognition.start();
                recognitionRef.current = recognition;
            } else {
                console.warn("Speech recognition not supported in this browser.");
            }
        } catch (err) {
            console.error("Microphone access denied:", err);
            alert("请授予麦克风权限以使用语音功能");
        }
    };

    // 停止语音监控并结束识别
    const stopVoice = () => {
        setIsVoiceActive(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();

        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    };

    const handleVoiceSuccess = (text) => {
        if (voiceContext === 'chat') {
            setChatInput(text);
        } else if (voiceContext === 'onboarding') {
            setOnboardingInput(text);
        } else if (voiceContext === 'home') {
            // Home context originally mapped here, but now we use transcription in onboarding
            const newBlob = {
                id: Date.now(),
                r: 38 + Math.random() * 8,
                color: BLOB_PALETTES[currentData.emoji]?.[0] || BLOB_PALETTES['default'][0],
                label: '语音心情',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                note: text,
                source: 'manual'
            };
            setTodayBlobs(prev => [...prev, newBlob]);
        }
    };

    // 长按录音处理器 (Long-press handlers)
    const micHandlers = (context) => ({
        onPointerDown: (e) => {
            e.preventDefault();
            startVoice(context);
        },
        onPointerUp: (e) => {
            e.preventDefault();
            stopVoice();
        },
        onPointerLeave: (e) => {
            if (isVoiceActive) stopVoice();
        },
        onContextMenu: (e) => e.preventDefault(), // 禁用右键菜单防止干扰长按
    });

    // 颜色配置表 (Emotion Colors) - 合并为 4 大类，绿色融入“治愈/清新”
    const EMOTION_COLORS = {
        '😇': 'linear-gradient(135deg, #A5F3FC, #E0F2FE)', // 治愈 - 蓝
        '😌': 'linear-gradient(135deg, #A5F3FC, #E0F2FE)',
        '🌿': 'linear-gradient(135deg, #A5F3FC, #BBF7D0)', // 清新 - 蓝绿
        '🤩': 'linear-gradient(135deg, #FDE68A, #FEF3C7)', // 能量 - 亮黄
        '⚡️': 'linear-gradient(135deg, #FDE68A, #FEF3C7)',
        '😴': 'linear-gradient(135deg, #DDD6FE, #F5F3FF)', // 沉思 - 香芋紫
        '🧘‍♂️': 'linear-gradient(135deg, #DDD6FE, #F5F3FF)',
        'default': 'linear-gradient(135deg, #F9A8D4, #FDF2F8)' // 敏感 - 玫瑰粉
    };

    // Blob 固定色池 (Emoji -> Palette)
    const BLOB_PALETTES = {
        '😇': ["#22D3EE", "#38BDF8", "#4ADE80", "#86EFAC"], // 蓝绿混合
        '😌': ["#22D3EE", "#38BDF8", "#4ADE80", "#86EFAC"],
        '🌿': ["#22D3EE", "#38BDF8", "#4ADE80", "#86EFAC"],
        '🤩': ["#FBBF24", "#F59E0B", "#F97316", "#FDE68A"],
        '⚡️': ["#FBBF24", "#F59E0B", "#F97316", "#FDE68A"],
        '😴': ["#C084FC", "#D8B4FE", "#A855F7", "#F3E8FF"],
        '🧘‍♂️': ["#C084FC", "#D8B4FE", "#A855F7", "#F3E8FF"],
        'default': ["#F472B6", "#FB7185", "#EC4899", "#FBCFE8"]
    };

    // 获取当前展示的数据 (Merge dynamic state for today)
    const currentData = {
        ...MOCK_DATA[selectedDate],
        blobs: (selectedDate === 'today' ? todayBlobs : MOCK_DATA[selectedDate].blobs).map(b => ({
            ...b,
            isDiscussed: discussedIds.has(b.id)
        }))
    };

    const isHeaderEmpty = selectedDate === 'today' && todayBlobs.length === 0;
    const headerEmoji = isHeaderEmpty ? '\u2728' : currentData.emoji;
    const headerStatusIcon = isHeaderEmpty ? <Sparkles size={14} /> : currentData.whisper.icon;
    const headerBg = EMOTION_COLORS[headerEmoji] || EMOTION_COLORS['default'];

    const headerStatusContent = isHeaderEmpty ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '14px', fontStyle: 'normal', fontWeight: 600, color: '#374151' }}>{"今天还没有记录呢"}</span>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>{"先把这一刻放进情绪罐头，Mochi 会帮你总结。"}</span>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{"点击 + 开始记录，也支持语音输入"}</span>
        </div>
    ) : (
        <span style={{ fontSize: '14px', fontStyle: 'normal' }}>{currentData.statusText}</span>
    );

    // 切换日期或数量变化时，重置罐头动画（通过 key）
    const jarKey = `${selectedDate}-${currentData.blobs.length}`;

    const [chatInput, setChatInput] = useState('');
    const [showEndCard, setShowEndCard] = useState(true); // Simulated: shows based on history
    const [chatSessions, setChatSessions] = useState([]);
    const chatEndRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom when chat opens or sessions change
    useEffect(() => {
        if (currentPage === 'chat') {
            const scrollToBottom = () => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                // Fallback: manual scroll on container
                if (chatEndRef.current) {
                    chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                }
            };

            // Initial scroll
            const timer1 = setTimeout(scrollToBottom, 50);
            // Stronger scroll after animation likely finishes
            const timer2 = setTimeout(scrollToBottom, 600);

            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        }
    }, [currentPage, chatSessions]);

    const startNewSession = (initialMessages = []) => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;

        const newSession = {
            id: Date.now(),
            timestamp: `${dateStr} · ${timeStr}`,
            messages: initialMessages
        };

        setChatSessions(prev => [...prev, newSession]);
    };

    // 切换到对话页时的自动引导 (Proactive Greeting)
    useEffect(() => {
        if (currentPage === 'chat' && chatSessions.length === 0) {
            // 稍作延迟，等页面切入动画完成
            const timer = setTimeout(() => {
                startNewSession([
                    { type: 'ai', text: '嗨！我是 Mochi。在这个安静的空间里，我会一直陪着你。今天过得怎么样？' }
                ]);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [currentPage, chatSessions]);

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;

        const userMsg = { type: 'user', text: chatInput };
        setChatSessions(prev => {
            const lastSession = prev[prev.length - 1];
            const otherSessions = prev.slice(0, -1);
            return [...otherSessions, { ...lastSession, messages: [...lastSession.messages, userMsg] }];
        });
        setChatInput('');

        // Mock a simple AI response after 1s
        setTimeout(() => {
            setChatSessions(prev => {
                const lastSession = prev[prev.length - 1];
                const otherSessions = prev.slice(0, -1);
                return [...otherSessions, {
                    ...lastSession, messages: [...lastSession.messages, {
                        type: 'ai',
                        text: '我在听。感觉这个瞬间对你很重要呢，想再多分享一点吗？'
                    }]
                }];
            });
        }, 1000);
    };


    const requestEventMemoryExtraction = (session) => {
        // TODO: replace with real API call to extract event memory
        console.log('[event-memory] extract after session end', session);
    };

    const handleEndSession = () => {
        if (chatSessions.length === 0) return;
        const lastSnapshot = chatSessions[chatSessions.length - 1];
        setChatSessions(prev => {
            const lastSession = prev[prev.length - 1];
            if (lastSession && lastSession.isClosed) return prev;
            const otherSessions = prev.slice(0, -1);
            const endCardContent = '\u8fd9\u4e00\u6bb5\u5bf9\u8bdd\u5148\u653e\u5728\u8fd9\u91cc\uff0c\u4f60\u4eca\u5929\u5df2\u7ecf\u5f88\u68d2\u4e86\u3002';
            return [...otherSessions, { ...lastSession, isClosed: true, endCardContent }];
        });

        requestEventMemoryExtraction(lastSnapshot);
    };

    // 模拟推送通知逻辑 (Push Notification Simulation)
    useEffect(() => {
        if (isLoggedIn && currentPage === 'home' && !pendingPush) {
            const timer = setTimeout(() => {
                const undiscussed = todayBlobs.filter(b => !discussedIds.has(b.id));
                if (undiscussed.length > 0) {
                    const target = undiscussed[Math.floor(Math.random() * undiscussed.length)];
                    setPendingPush({
                        id: target.id,
                        title: 'Mochi 刚才在想...',
                        body: `关于【${target.label}】的那个瞬间，想听你多说几句点... ✨`,
                        blob: target
                    });
                }
            }, 12000); // 12 seconds
            return () => clearTimeout(timer);
        }
    }, [isLoggedIn, currentPage, todayBlobs, discussedIds, pendingPush]);

    const handleLogout = () => {
        setIsLoggedIn(false);
        setCurrentPage('home');
        setShowLogin(true);
        // Reset to fresh state
        setPhoneNumber('');
        setTodayBlobs([]);
        setOnboardingStep(0);
        setChatSessions([]);
    };

    const handleOnboardingComplete = (firstExpression) => {
        if (firstExpression) {
            // Add new blob to the jar
            const newBlob = {
                id: Date.now(),
                r: 38 + Math.random() * 8,
                color: '#F472B6', // Pinkish for new manual entry
                label: '新记录',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                note: firstExpression,
                source: 'manual'
            };
            setTodayBlobs(prev => [...prev, newBlob]);

            // 仅在真实没有碎片（第一个）时弹出恭喜弹窗
            // 延迟 2 秒，让用户先看到首页和第一个 blob 掉落
            if (todayBlobs.length === 0) {
                setTimeout(() => {
                    setShowTooltip(true);
                    setTimeout(() => setShowTooltip(false), 8000);
                }, 2000); // 2 秒延迟
            }
        }
        setOnboardingStep(2); // 完成
        // Stay on current page (Home) instead of switching to chat
    };

    // 手机号登录页面 (Login View)
    if (!isLoggedIn) {
        return (
            <div className="app-container" style={{ background: 'var(--grad-header)' }}>
                <div className="nav-mimic" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 32px' }}>
                    <motion.div
                        className="onboarding-icon"
                        animate={{
                            y: [0, -10, 0],
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        style={{ fontSize: '72px', marginBottom: '40px' }}
                    >
                        ☁️
                    </motion.div>

                    <h1 className="onboarding-title" style={{ fontSize: '32px' }}>你好，Mochi</h1>
                    <p className="onboarding-desc" style={{ marginBottom: '60px', textAlign: 'center' }}>在这，放下一整天的情绪</p>

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                                color: '#9CA3AF', fontSize: '15px'
                            }}>+86</div>
                            <input
                                placeholder="输入手机号"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '18px 18px 18px 60px',
                                    borderRadius: '30px',
                                    border: 'none',
                                    background: 'rgba(255, 255, 255, 0.7)',
                                    backdropFilter: 'blur(10px)',
                                    WebkitBackdropFilter: 'blur(10px)',
                                    fontSize: '16px',
                                    outline: 'none',
                                    color: '#1F2937'
                                }}
                            />
                        </div>

                        <button
                            className="next-button"
                            onClick={() => {
                                if (phoneNumber.length >= 11) {
                                    setIsLoggedIn(true);
                                    setOnboardingStep(0);
                                } else {
                                    alert('请输入有效的手机号');
                                }
                            }}
                            style={{ width: '100%', padding: '18px' }}
                        >
                            开启旅程
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Onboarding 组件 (强制显示，直到用户完成 Step 2)
    if (onboardingStep < 2 && currentPage === 'home') {
        return (
            <div className="app-container" style={{ background: 'var(--grad-header)' }}>
                <div className="nav-mimic" />
                <AnimatePresence mode="wait">
                    {onboardingStep === 0 && (
                        <motion.div
                            key="welcome"
                            className="onboarding-container"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="onboarding-content">
                                <div className="onboarding-icon">🌱</div>
                                <h1 className="onboarding-title">Hello，我是 Mochi！</h1>
                                <p className="onboarding-desc">
                                    很高兴认识你。
                                </p>
                                <button className="next-button" onClick={() => setOnboardingStep(1)}>
                                    试着放下一段情绪
                                </button>
                            </div>
                        </motion.div>
                    )}
                    {onboardingStep === 1 && (
                        <motion.div
                            key="express"
                            className="onboarding-container"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="onboarding-content" style={{ width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h1 className="onboarding-title" style={{ fontSize: '24px', marginBottom: 0 }}>现在的感受...</h1>
                                    <span onClick={() => { setTodayBlobs(prev => [...prev]); setOnboardingStep(2); }} style={{ color: '#9CA3AF', fontSize: '14px', cursor: 'pointer' }}>跳过</span>
                                </div>
                                <div className="expression-input-area">
                                    <div style={{ position: 'relative' }}>
                                        <textarea
                                            className="expression-input"
                                            placeholder="累 / 开心 / 有点乱..."
                                            autoFocus
                                            value={onboardingInput}
                                            onChange={(e) => setOnboardingInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleOnboardingComplete(onboardingInput);
                                                }
                                            }}
                                        />
                                        <div
                                            className={`voice-trigger onboarding ${isVoiceActive && voiceContext === 'onboarding' ? 'recording' : ''}`}
                                            {...micHandlers('onboarding')}
                                        >
                                            <Mic size={20} />
                                        </div>
                                        <p className="placeholder-text" style={{ bottom: '-30px', textAlign: 'center' }}>模糊一点也没关系</p>
                                    </div>
                                    <button
                                        className="next-button"
                                        style={{ width: '100%', marginTop: '60px' }}
                                        onClick={() => handleOnboardingComplete(onboardingInput)}
                                    >
                                        放入情绪罐头
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="app-container">
            <div className="nav-mimic">
                <span>9:41</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <Signal size={14} />
                    <Wifi size={14} />
                    <Battery size={14} />
                </div>
            </div>

            <div className="page-wrapper">
                <AnimatePresence mode="wait">
                    {currentPage === 'home' && (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div
                                className="home-header"
                                style={{
                                    background: headerBg,
                                    transition: 'background 0.8s ease'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                                    <div>
                                        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#111827' }}>{currentData.dateStr.split(' ')[0]}</h1>
                                        <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>{currentData.dateStr.split(' ')[1]}</p>
                                    </div>
                                    <div style={{ fontSize: '28px' }}>{headerEmoji}</div>
                                </div>
                                <div className="status-card" style={{ marginTop: 0 }}>
                                    <div className="mochi-whisper" style={{ marginTop: 0 }}>
                                        {headerStatusIcon}
                                        {headerStatusContent}
                                    </div>
                                </div>
                            </div>

                            {/* Time Roller - 动态映射且支持横向滚动 */}
                            <div className="date-roller">
                                {Object.keys(MOCK_DATA).reverse().map((key) => {
                                    const data = MOCK_DATA[key];
                                    const hasData = key === 'today' || data.blobs.length > 0;
                                    const isActive = selectedDate === key;

                                    return (
                                        <div
                                            key={key}
                                            className={`roller-item ${isActive ? 'active' : ''} ${!hasData ? 'disabled' : 'has-data'}`}
                                            onClick={() => hasData && setSelectedDate(key)}
                                        >
                                            {data.label}
                                            {isActive && <div className="active-dot" />}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="jar-container">
                                <JarPhysics
                                    key={jarKey}
                                    height={360}
                                    onSelect={setSelectedBlob}
                                    blobs={currentData.blobs}
                                    isArchive={selectedDate !== 'today'}
                                    isUnsealed={isUnsealed}
                                    onUnseal={() => setIsUnsealed(true)}
                                    archiveData={currentData}
                                />
                            </div>

                            <div style={{ position: 'absolute', bottom: '84px', right: '16px', zIndex: 100 }}>
                                {/* Manual Entry - Disabled in History Mode */}
                                <motion.button
                                    className="home-fab"
                                    whileHover={selectedDate === 'today' ? { scale: 1.05 } : {}}
                                    whileTap={selectedDate === 'today' ? { scale: 0.95 } : {}}
                                    onClick={() => {
                                        if (selectedDate !== 'today') return;
                                        setOnboardingInput('');
                                        setOnboardingStep(1);
                                    }}
                                    style={{
                                        background: selectedDate === 'today' ? 'white' : 'rgba(255, 255, 255, 0.4)', // Semi-transparent
                                        width: '56px', height: '56px', borderRadius: '28px',
                                        boxShadow: selectedDate === 'today' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                                        border: selectedDate === 'today' ? 'none' : '1px solid rgba(0,0,0,0.05)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: selectedDate === 'today' ? 'pointer' : 'default',
                                        opacity: selectedDate === 'today' ? 1 : 0.6 // Reduce opacity
                                    }}
                                >
                                    <Plus size={24} color={selectedDate === 'today' ? "#6B7280" : "#9CA3AF"} />
                                </motion.button>
                            </div>

                            {/* Post-Onboarding Modal */}
                            {showTooltip && (
                                <div
                                    className="modal-overlay"
                                    onClick={() => setShowTooltip(false)}
                                    style={{ zIndex: 300 }}
                                >
                                    <motion.div
                                        initial={{ opacity: 0, y: 100 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 100 }}
                                        transition={{ type: 'spring', damping: 30, stiffness: 180, mass: 1.2 }}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(252, 231, 243, 0.9))',
                                            backdropFilter: 'blur(20px)',
                                            WebkitBackdropFilter: 'blur(20px)',
                                            borderRadius: '24px',
                                            padding: '32px 28px',
                                            maxWidth: '340px',
                                            width: '90%',
                                            boxShadow: '0 20px 60px rgba(167, 139, 250, 0.15)',
                                            border: '1px solid rgba(255, 255, 255, 0.8)',
                                            position: 'relative'
                                        }}
                                    >
                                        {/* Close button */}
                                        <X
                                            size={20}
                                            color="#9CA3AF"
                                            onClick={() => setShowTooltip(false)}
                                            style={{
                                                cursor: 'pointer',
                                                position: 'absolute',
                                                top: '16px',
                                                right: '16px'
                                            }}
                                        />

                                        {/* Content */}
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
                                            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937', marginBottom: '8px' }}>
                                                恭喜你存储了第一个记忆碎片！
                                            </h3>
                                            <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
                                                每一个情绪瞬间都值得被倾听。<br />
                                                试着和 Mochi 聊聊这个瞬间吧～
                                            </p>

                                            {/* CTA Button */}
                                            <button
                                                onClick={() => {
                                                    const latestBlob = todayBlobs[todayBlobs.length - 1];
                                                    startNewSession([
                                                        { type: 'user', text: `关于【${latestBlob.label}】...` },
                                                        { type: 'ai', text: '我在听。想聊聊这个瞬间吗？' }
                                                    ]);
                                                    setShowTooltip(false);
                                                    setCurrentPage('chat');
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 20px',
                                                    background: 'linear-gradient(135deg, #A78BFA, #818CF8)',
                                                    border: 'none',
                                                    borderRadius: '16px',
                                                    color: 'white',
                                                    fontSize: '15px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    boxShadow: '0 4px 12px rgba(167, 139, 250, 0.3)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                                                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                                            >
                                                💬 聊聊这个瞬间
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {currentPage === 'chat' && (
                        <motion.div
                            key="chat"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
                        >
                            {/* Ambient Background Mesh */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
                                background: 'radial-gradient(circle at 50% 30%, rgba(167, 139, 250, 0.08) 0%, rgba(255, 255, 255, 0) 70%)',
                                overflow: 'hidden'
                            }} />

                            <div className="chat-banner">
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #A78BFA, #FCA5A5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                                    boxShadow: '0 4px 12px rgba(167, 139, 250, 0.3)'
                                }}>
                                    🌙
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937' }}>Mochi</h2>
                                    <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '-2px' }}>Online</p>
                                </div>
                            </div>

                            <div
                                ref={chatEndRef}
                                style={{ padding: '24px 24px 24px 24px', paddingTop: '60px', display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, zIndex: 1 }}
                            >

                                {/* 模拟更早的历史记录 (Faded) - 12/1 */}
                                <div style={{ opacity: 0.5 }}>
                                    <div style={{ textAlign: 'center', margin: '20px 0', opacity: 0.6 }}>
                                        <p style={{ fontSize: '12px', color: '#9CA3AF' }}>2025/12/1 · 8:40 PM</p>
                                    </div>
                                    <div className="chat-bubble user" style={{ filter: 'grayscale(0.3)' }}>
                                        今天好累啊...
                                    </div>
                                    <div className="chat-bubble ai" style={{ filter: 'grayscale(0.3)' }}>
                                        抱抱你。发生什么事了吗？
                                    </div>
                                    <div className="chat-bubble user" style={{ filter: 'grayscale(0.3)' }}>
                                        没事，就是工作有点多。
                                    </div>
                                </div>

                                {/* 今日上午对话 - 12/2 8:40 AM */}
                                <div style={{ marginTop: '30px' }}>
                                    <div style={{ textAlign: 'center', margin: '20px 0', opacity: 0.8 }}>
                                        <p style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>2025/12/2 · 8:40 AM</p>
                                    </div>
                                    <div className="chat-bubble ai">
                                        早安！昨晚睡得怎么样？
                                    </div>
                                    <div className="chat-bubble user">
                                        还行，就是有点不想起床去上班。
                                    </div>
                                    <div className="chat-bubble ai">
                                        理解的，周一总是需要一点额外的动力。新的一周，慢慢来就好。
                                    </div>
                                </div>

                                {/* 第一段 Session 的 End Card */}
                                <div className="saved-indicator" style={{ marginBottom: '0', marginTop: '20px' }}>
                                    <div className="dot" />
                                    <span>已封存于 9:30 AM</span>
                                </div>

                                <div className="session-end-card" style={{ flexShrink: 0, marginBottom: '40px' }}>
                                    <div className="end-card-shine" />
                                    <p style={{ fontSize: '15px', color: '#4B5563', lineHeight: '1.6', marginBottom: '0' }}>
                                        这周的能量稍微低一点也没关系。<br />记得多喝点温水，下午见。
                                    </p>
                                </div>

                                {/* Dynamic Sessions */}
                                {chatSessions.map((session) => (
                                    <div key={session.id} style={{ marginBottom: '30px' }}>
                                        <div style={{ textAlign: 'center', margin: '20px 0', opacity: 0.8 }}>
                                            <p style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>{session.timestamp}</p>
                                        </div>
                                        {session.messages.map((msg, i) => (
                                            <div key={i} className={`chat-bubble ${msg.type}`}>
                                                {msg.text}
                                            </div>
                                        ))}
                                        {session.isClosed && (
                                            <div>
                                                <div className="saved-indicator" style={{ marginBottom: '0', marginTop: '16px' }}>
                                                    <div className="dot" />
                                                    <span>{`\u5df2\u5c01\u5b58\u4e8e ${session.timestamp}`}</span>
                                                </div>
                                                <div className="session-end-card" style={{ flexShrink: 0, marginTop: '12px' }}>
                                                    <div className="end-card-shine" />
                                                    <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.6', marginBottom: '0' }}>
                                                        {session.endCardContent}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Dummy element to anchor scroll to bottom */}
                                <div ref={messagesEndRef} style={{ height: '1px' }} />
                            </div>

                            {/* "今天到这儿" Button - Outside of scrollable container */}
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 24px', zIndex: 40 }}>
                                <button
                                    onClick={handleEndSession}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '20px',
                                        border: '1px solid rgba(167, 139, 250, 0.3)',
                                        background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.08), rgba(252, 165, 165, 0.05))',
                                        color: '#6B7280',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        letterSpacing: '0.3px',
                                        boxShadow: '0 4px 12px rgba(167, 139, 250, 0.08)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        backdropFilter: 'blur(10px)',
                                        WebkitBackdropFilter: 'blur(10px)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.background = 'linear-gradient(135deg, rgba(167, 139, 250, 0.12), rgba(252, 165, 165, 0.08))';
                                        e.target.style.boxShadow = '0 6px 16px rgba(167, 139, 250, 0.12)';
                                        e.target.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background = 'linear-gradient(135deg, rgba(167, 139, 250, 0.08), rgba(252, 165, 165, 0.05))';
                                        e.target.style.boxShadow = '0 4px 12px rgba(167, 139, 250, 0.08)';
                                        e.target.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {"✨ 今天先到这儿"}
                                </button>
                            </div>

                            {/* Input Container */}
                            <div className="chat-input-container">
                                <div
                                    className={`voice-trigger chat ${isVoiceActive && voiceContext === 'chat' ? 'recording' : ''}`}
                                    {...micHandlers('chat')}
                                >
                                    <Mic size={20} />
                                </div>
                                <input
                                    placeholder="分享你的感受..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSendMessage();
                                    }}
                                />
                                <button className="send-button" onClick={handleSendMessage}>
                                    <ChevronRight size={24} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {currentPage === 'device' && (
                        <motion.div
                            key="device"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="device-banner" style={{ paddingBottom: '32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h1 style={{ fontSize: '28px', fontWeight: 300, marginBottom: '4px' }}>我的环境</h1>
                                        <p style={{ fontSize: '14px', opacity: 0.8 }}>和 Mochi 的第 1 天</p>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <div
                                            onClick={() => setShowLogoutConfirm(true)}
                                            style={{
                                                width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '22px', border: '2px solid rgba(255,255,255,0.3)',
                                                cursor: 'pointer'
                                            }}
                                            title="点击退出登录"
                                        >👤</div>
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '-4px',
                                            right: '-4px',
                                            background: 'rgba(255,255,255,0.9)',
                                            color: 'var(--primary)',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }}>
                                            {phoneNumber.slice(-4) || '3721'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                className="device-card add-device"
                                onClick={() => setIsScanning(true)}
                                style={{
                                    border: '2px dashed rgba(167, 139, 250, 0.3)',
                                    background: 'rgba(167, 139, 250, 0.03)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '32px 0',
                                    cursor: 'pointer',
                                    marginBottom: '20px'
                                }}
                            >
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: 'white', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', marginBottom: '12px',
                                    boxShadow: '0 4px 12px rgba(167, 139, 250, 0.1)'
                                }}>
                                    <Plus size={24} color="#A78BFA" />
                                </div>
                                <span style={{ fontSize: '15px', fontWeight: 600, color: '#A78BFA' }}>添加新设备</span>
                                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>扫描附近的 Mochi 娃娃或戒指</p>
                            </div>

                            <div className="device-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <div className="soft-icon-bg">🧸</div>
                                        <div>
                                            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Mochi Soft</h3>
                                            <p style={{ fontSize: '13px', color: '#9CA3AF' }}>毛绒体</p>
                                        </div>
                                    </div>
                                    <div className="status-badge">
                                        <div className="status-dot" />
                                        <span className="status-text">已连接</span>
                                    </div>
                                </div>
                                <div className="stat-grid">
                                    <div className="stat-item"><div className="label">电量</div><div className="value">85%</div></div>
                                    <div className="stat-item"><div className="label">温度</div><div className="value">36°C</div></div>
                                    <div className="stat-item"><div className="label">震动</div><div className="value">柔和</div></div>
                                </div>
                            </div>

                            <div className="device-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <div className="ring-icon-bg">💍</div>
                                        <div>
                                            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Mochi Ring</h3>
                                            <p style={{ fontSize: '13px', color: '#9CA3AF' }}>智能戒指</p>
                                        </div>
                                    </div>
                                    <div className="status-badge">
                                        <div className="status-dot" />
                                        <span className="status-text">已连接</span>
                                    </div>
                                </div>
                                <div className="stat-grid">
                                    <div className="stat-item"><div className="label">电量</div><div className="value">92%</div></div>
                                    <div className="stat-item"><div className="label">心率</div><div className="value">72</div></div>
                                    <div className="stat-item"><div className="label">步数</div><div className="value">8.2k</div></div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="bottom-nav">
                <button onClick={() => setCurrentPage('home')} className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}>
                    <Heart fill={currentPage === 'home' ? 'currentColor' : 'none'} size={24} />
                    <span>情绪</span>
                </button>
                <button onClick={() => setCurrentPage('chat')} className={`nav-item ${currentPage === 'chat' ? 'active' : ''}`}>
                    <MessageCircle fill={currentPage === 'chat' ? 'currentColor' : 'none'} size={24} />
                    <span>对话</span>
                </button>
                <button onClick={() => setCurrentPage('device')} className={`nav-item ${currentPage === 'device' ? 'active' : ''}`}>
                    <Radio size={24} />
                    <span>设备</span>
                </button>
            </div>

            <AnimatePresence>
                {selectedBlob && (
                    <div key="selected-blob" className="modal-overlay" onClick={() => setSelectedBlob(null)}>
                        <motion.div
                            className="modal-content"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${selectedBlob.color}30` }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{selectedBlob.label}</h3>
                                            <div style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {selectedBlob.id % 2 === 0 ? <MessageCircle size={12} /> : <Radio size={12} />}
                                                <span style={{ fontSize: '10px', color: '#6B7280' }}>来自设备</span>
                                            </div>
                                        </div>
                                        <X size={20} color="#9CA3AF" onClick={() => setSelectedBlob(null)} style={{ cursor: 'pointer' }} />
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>{selectedBlob.time}</p>
                                    <p style={{ fontSize: '15px', color: '#4B5563', marginTop: '12px', lineHeight: 1.6 }}>{selectedBlob.note}</p>

                                    {/* Chat about this button */}
                                    <button
                                        onClick={() => {
                                            startNewSession([
                                                { type: 'user', text: `关于【${selectedBlob.label}】...` },
                                                { type: 'ai', text: '我在听。想聊聊这个瞬间吗？' }
                                            ]);
                                            setDiscussedIds(prev => new Set([...prev, selectedBlob.id]));
                                            setSelectedBlob(null);
                                            setCurrentPage('chat');
                                        }}
                                        style={{
                                            marginTop: '16px',
                                            width: '100%',
                                            padding: '10px 16px',
                                            background: 'rgba(167, 139, 250, 0.1)',
                                            border: 'none',
                                            borderRadius: '20px',
                                            color: '#7C3AED',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = 'rgba(167, 139, 250, 0.15)'}
                                        onMouseLeave={(e) => e.target.style.background = 'rgba(167, 139, 250, 0.1)'}
                                    >
                                        <MessageCircle size={16} />
                                        聊聊这个瞬间
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {isScanning && (
                    <div key="scanning" className="modal-overlay" onClick={() => setIsScanning(false)}>
                        <motion.div
                            className="modal-content"
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'white',
                                padding: '40px 24px',
                                borderTopLeftRadius: '32px',
                                borderTopRightRadius: '32px',
                                bottom: 0,
                                left: 0,
                                width: '100%',
                                maxWidth: '100%',
                                position: 'absolute'
                            }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ width: '40px', height: '4px', background: '#E5E7EB', borderRadius: '2px', margin: '-20px auto 30px auto' }} />
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>寻找 Mochi 设备...</h2>
                                <p style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '40px' }}>请确保你的设备已开启并靠近手机</p>

                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
                                    <div className="pulse-circle">
                                        <div className="pulse-ring" />
                                        <div className="pulse-dot">
                                            <Radio size={28} />
                                        </div>
                                    </div>
                                </div>

                                <div className="found-devices-list">
                                    <motion.div
                                        className="device-item"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 1.5 }}
                                        onClick={() => {
                                            setIsScanning(false);
                                            // Directly connect Ring (it's BLE only)
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <div style={{ fontSize: '24px' }}>💍</div>
                                            <div style={{ textAlign: 'left' }}>
                                                <h4 style={{ fontWeight: 600 }}>Mochi Ring</h4>
                                                <p style={{ fontSize: '12px', color: '#9CA3AF' }}>BLE 信号优</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={20} color="#D1D5DB" />
                                    </motion.div>

                                    <motion.div
                                        className="device-item"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 2.2 }}
                                        onClick={() => {
                                            setIsScanning(false);
                                            setPairingDevice({ type: 'soft', name: 'Mochi Soft' });
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <div style={{ fontSize: '24px' }}>🧸</div>
                                            <div style={{ textAlign: 'left' }}>
                                                <h4 style={{ fontWeight: 600 }}>Mochi Soft</h4>
                                                <p style={{ fontSize: '12px', color: '#9CA3AF' }}>BLE 信号中</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={20} color="#D1D5DB" />
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {pairingDevice && pairingDevice.type === 'soft' && (
                    <div key="pairing" className="modal-overlay">
                        <motion.div
                            className="modal-content"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            style={{ background: 'white', padding: '32px 24px', borderRadius: '24px' }}
                        >
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>连接 Wi-Fi</h2>
                            <p style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '24px', textAlign: 'center' }}>让 Mochi 能够时刻陪着你</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="input-field" style={{ background: '#F9FAFB', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                                    <label style={{ fontSize: '12px', color: '#9CA3AF' }}>选择网络</label>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                        <span style={{ fontWeight: 500 }}>Mochi_Office_5G</span>
                                        <Wifi size={16} color="#9CA3AF" />
                                    </div>
                                </div>

                                <input
                                    type="password"
                                    placeholder="输入 Wi-Fi 密码"
                                    style={{
                                        padding: '16px',
                                        borderRadius: '12px',
                                        border: '1px solid #E5E7EB',
                                        fontSize: '15px'
                                    }}
                                />

                                <button
                                    onClick={() => setPairingDevice(null)}
                                    style={{
                                        marginTop: '12px',
                                        background: 'linear-gradient(135deg, #A78BFA, #818CF8)',
                                        color: 'white',
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: 'none',
                                        fontWeight: 600,
                                        boxShadow: '0 4px 15px rgba(167, 139, 250, 0.3)'
                                    }}
                                >
                                    完成设置
                                </button>

                                <button
                                    onClick={() => setPairingDevice(null)}
                                    style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '14px' }}
                                >
                                    跳过，仅使用蓝牙
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {showLogoutConfirm && (
                    <div key="logout-confirm" className="modal-overlay" onClick={() => setShowLogoutConfirm(false)} style={{ zIndex: 1000 }}>
                        <motion.div
                            className="modal-content"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ padding: '32px', textAlign: 'center' }}
                        >
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👋</div>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>要暂时离开吗？</h2>
                            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px', lineHeight: 1.6 }}>
                                Mochi 会在这里等你回来。
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button
                                    onClick={() => {
                                        setShowLogoutConfirm(false);
                                        handleLogout();
                                    }}
                                    style={{
                                        background: '#FEE2E2',
                                        color: '#EF4444',
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: 'none',
                                        fontWeight: 600,
                                        width: '100%'
                                    }}
                                >
                                    确定退出
                                </button>
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    style={{
                                        background: '#F3F4F6',
                                        color: '#4B5563',
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: 'none',
                                        fontWeight: 600,
                                        width: '100%'
                                    }}
                                >
                                    再等等
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Simulated Push Notification Banner */}
                {pendingPush && (
                    <motion.div
                        key="push-banner"
                        initial={{ opacity: 0, y: -100 }}
                        animate={{ opacity: 1, y: 16 }}
                        exit={{ opacity: 0, y: -100 }}
                        onClick={() => {
                            startNewSession([
                                { type: 'ai', text: `嗨！看到你刚才记录了【${pendingPush.blob.label}】，那个瞬间现在感觉好些了吗？` }
                            ]);
                            setDiscussedIds(prev => new Set([...prev, pendingPush.id]));
                            setPendingPush(null);
                            setCurrentPage('chat');
                        }}
                        style={{
                            position: 'absolute',
                            top: '8px', left: '8px', right: '8px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(10px)',
                            padding: '12px 16px',
                            borderRadius: '16px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'center',
                            zIndex: 3000,
                            cursor: 'pointer',
                            border: '1px solid rgba(0,0,0,0.05)'
                        }}
                    >
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #A78BFA, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <Bell size={20} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937' }}>{pendingPush.title}</span>
                                <span style={{ fontSize: '10px', color: '#9CA3AF' }}>现在</span>
                            </div>
                            <p style={{ fontSize: '13px', color: '#4B5563', marginTop: '2px', lineHeight: 1.4 }}>{pendingPush.body}</p>
                        </div>
                        <X
                            size={16}
                            color="#9CA3AF"
                            onClick={(e) => {
                                e.stopPropagation();
                                setPendingPush(null);
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default App