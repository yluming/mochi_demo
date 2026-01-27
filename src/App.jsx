import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Heart, MessageCircle, Radio, Signal, Wifi, Battery,
    ChevronRight, Settings, Send, User, Sparkles, X, ChevronLeft, Mic, Plus
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

const JAR_WIDTH = 340;

const JarPhysics = ({ onSelect, height, blobs }) => {
    const startRef = useRef(performance.now());
    const mouthX = JAR_WIDTH / 2;
    const mouthRange = 36;
    const [items] = useState(() => (blobs || makeBlobs()).map((b, i) => ({
        ...b,
        x: mouthX + (Math.random() * 2 - 1) * mouthRange,
        y: -30 - i * 40,
        vx: (Math.random() * 1.2 - 0.6),
        vy: 0,
        sx: 1,
        sy: 1,
        tsx: 1,
        tsy: 1,
        active: false,
        release: i * 250,
        settled: false,
    })));
    const raf = useRef(null);
    const [, setFrame] = useState(0);

    useEffect(() => {
        const g = 0.38;
        const damp = 0.985;
        const friction = 0.982;
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
                            const imp = -1.05 * vn;
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
        raf.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf.current);
    }, [items, height]);

    return (
        <div style={{ height, position: 'relative', width: JAR_WIDTH, margin: '0 auto' }}>
            <svg viewBox={`0 -60 ${JAR_WIDTH} ${height + 60}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
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
                        <g
                            key={it.id}
                            transform={`translate(${it.x},${it.y}) scale(${it.sx},${it.sy})`}
                            onClick={() => onSelect(it)}
                            style={{ cursor: 'pointer' }}
                        >
                            <defs>
                                <radialGradient id={`grad-${i}`} cx="35%" cy="35%" r="65%">
                                    <stop offset="0%" stopColor={it.color} stopOpacity="0.95" />
                                    <stop offset="100%" stopColor={it.color} stopOpacity="0.7" />
                                </radialGradient>
                            </defs>
                            <ellipse rx={it.r * 1.05} ry={it.r * 0.95} fill={`url(#grad-${i})`} />
                        </g>
                    ))}
                </g>
            </svg>
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
    const [todayBlobs, setTodayBlobs] = useState(makeBlobs()); // Dynamic state for today's blobs
    const [showTooltip, setShowTooltip] = useState(false); // Post-onboarding guide
    const [isScanning, setIsScanning] = useState(false); // Device discovery modal
    const [pairingDevice, setPairingDevice] = useState(null); // Current device in setup flow

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
        blobs: selectedDate === 'today' ? todayBlobs : MOCK_DATA[selectedDate].blobs
    };

    const headerBg = EMOTION_COLORS[currentData.emoji] || EMOTION_COLORS['default'];

    // 切换日期或数量变化时，重置罐头动画（通过 key）
    const jarKey = `${selectedDate}-${currentData.blobs.length}`;

    const [chatInput, setChatInput] = useState('');
    const [showEndCard, setShowEndCard] = useState(true); // Simulated: shows based on history
    const [chatSessions, setChatSessions] = useState([
        {
            id: 'legacy-session',
            timestamp: '2025/12/2 · 4:40 PM',
            messages: [
                { type: 'ai', text: '晚上好！《惊天魔盗团3》好看吗！感觉你的时候很激动耶！' },
                { type: 'user', text: '哈哈哈哈是的！群像戏真的很燃. ' },
                { type: 'ai', text: '就跟你上次看喜人2里面的群像一样，永远让人热泪盈眶🥹' },
                { type: 'user', text: '是的你懂我！' },
            ]
        }
    ]);
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

            // Show post-onboarding tooltip
            setShowTooltip(true);
            setTimeout(() => setShowTooltip(false), 8000);
        }
        setOnboardingStep(2); // 完成
        // Stay on current page (Home) instead of switching to chat
    };

    if (onboardingStep < 2) {
        return (
            <div className="app-container">
                <AnimatePresence mode="wait">
                    {onboardingStep === 0 && (
                        <motion.div
                            key="welcome"
                            className="onboarding-container"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
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
                                    <span onClick={() => { setOnboardingStep(2); setCurrentPage('chat'); }} style={{ color: '#9CA3AF', fontSize: '14px', cursor: 'pointer' }}>跳过</span>
                                </div>
                                <div className="expression-input-area">
                                    <div style={{ position: 'relative' }}>
                                        <textarea
                                            className="expression-input"
                                            placeholder="累 / 开心 / 有点乱..."
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleOnboardingComplete(e.target.value);
                                                }
                                            }}
                                        />
                                        <div className="voice-trigger onboarding">
                                            <Mic size={20} />
                                        </div>
                                        <p className="placeholder-text" style={{ bottom: '-30px', textAlign: 'center' }}>模糊一点也没关系</p>
                                    </div>
                                    <button
                                        className="next-button"
                                        style={{ width: '100%', marginTop: '60px' }}
                                        onClick={(e) => {
                                            const input = e.target.parentElement.querySelector('textarea').value;
                                            handleOnboardingComplete(input);
                                        }}
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
                                    <div style={{ fontSize: '28px' }}>{currentData.emoji}</div>
                                </div>
                                <div className="status-card" style={{ marginTop: 0 }}>
                                    <div className="mochi-whisper" style={{ marginTop: 0 }}>
                                        {currentData.whisper.icon}
                                        <span style={{ fontSize: '14px', fontStyle: 'normal' }}>{currentData.statusText}</span>
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
                                <JarPhysics key={jarKey} height={360} onSelect={setSelectedBlob} blobs={currentData.blobs} />
                            </div>

                            {/* Home FAB - Manual Entry */}
                            <motion.button
                                className="home-fab"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setOnboardingStep(1)} // Reuse input flow
                            >
                                <Plus size={24} color="#6B7280" />
                            </motion.button>

                            {/* Post-Onboarding Modal */}
                            {showTooltip && (
                                <div
                                    className="modal-overlay"
                                    onClick={() => setShowTooltip(false)}
                                    style={{ zIndex: 300 }}
                                >
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
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
                            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
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
                                style={{ padding: '24px 24px 90px 24px', paddingTop: '60px', display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, zIndex: 1 }}
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
                                    </div>
                                ))}

                                {/* Dummy element to anchor scroll to bottom */}
                                <div ref={messagesEndRef} style={{ height: '1px' }} />
                            </div>

                            <div className="chat-input-container">
                                <div className="voice-trigger chat">
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
                            <div className="device-banner">
                                <h1 style={{ fontSize: '28px', fontWeight: 300, marginBottom: '4px' }}>我的设备</h1>
                                <p style={{ fontSize: '14px', opacity: 0.8 }}>Mochi 生态系统</p>
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
                    <div className="modal-overlay" onClick={() => setSelectedBlob(null)}>
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
                    <div className="modal-overlay" onClick={() => setIsScanning(false)}>
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
                    <div className="modal-overlay">
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
            </AnimatePresence>
        </div>
    )
}

export default App
