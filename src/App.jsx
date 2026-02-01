import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Heart, MessageCircle, Radio, Signal, Wifi, Battery,
    ChevronRight, Settings, Send, User, Sparkles, X, ChevronLeft, Mic, Plus, Bell, PieChart
} from 'lucide-react'
import { formatToHHmm, formatToDate, formatToWeekday, formatToSessionTime, getTimeLabel, isDateToday } from './utils/timeUtils'
import { JAR_WIDTH, SENTIMENT_PALETTES, HEADER_GRADIENTS } from './constants/visuals'
import { makePearlBlobs, enrichBlob } from './utils/blobHelpers'
import api from './services/api'


const JarPhysics = ({ onSelect, height, blobs, newBlobIds, isArchive, isUnsealed, onUnseal, archiveData }) => {
    const startRef = useRef(performance.now());
    const [shimmerId, setShimmerId] = useState(null);
    const mouthX = JAR_WIDTH / 2;
    const mouthRange = 36;
    const [items, setItems] = useState(() => {
        const combined = [...(blobs || []), ...makePearlBlobs()];

        let initialItems = combined.map((b, i) => {
            const x = mouthX + (Math.random() * 2 - 1) * (b.isPearl ? JAR_WIDTH / 2 : mouthRange);
            // Initial Y for non-archive mode (falling down)
            const y = -30 - i * 30;

            const isNewest = newBlobIds && newBlobIds.has(b.id);

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
                release: isNewest ? 1200 : i * 100, // Significant delay for newest
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

    // Sync blobs with physics items
    const prevBlobsRef = useRef([]);
    useEffect(() => {
        if (!blobs) return;

        // Simple check to avoid infinite loops if 'blobs' prop reference changes but content is same
        const prevIds = prevBlobsRef.current.map(b => b.id).join(',');
        const currIds = blobs.map(b => b.id).join(',');
        if (prevIds === currIds && prevBlobsRef.current.length === blobs.length) {
            return;
        }
        prevBlobsRef.current = blobs;

        // Functional update to avoid direct mutation
        setItems(prevItems => {
            const currentBlobItems = prevItems.filter(it => !it.isPearl);
            const pearlItems = prevItems.filter(it => it.isPearl);

            // Counter for new items to stagger them
            let newCount = 0;
            const currentElapsed = performance.now() - startRef.current;

            const updatedBlobItems = blobs.map(blob => {
                // Match by ID OR by note (case-insensitive, trimmed) for optimistic transition
                const targetNote = (blob.note || "").trim().toLowerCase();
                const existing = currentBlobItems.find(it =>
                    String(it.id) === String(blob.id) ||
                    (it.isOptimistic && (it.note || "").trim().toLowerCase() === targetNote)
                );

                if (existing) {
                    // Inherit physics state from existing item (whether optimistic or already synced)
                    return { ...existing, ...blob, isOptimistic: false }; // Ensure isOptimistic is cleared
                } else {
                    // Stagger new items to prevent explosion
                    const delay = newCount * 150; // 150ms gap between each new item
                    newCount++;

                    const x = mouthX + (Math.random() * 2 - 1) * mouthRange;
                    return {
                        ...blob,
                        x,
                        y: -30,
                        vx: 0,
                        vy: 0,
                        active: false,
                        release: currentElapsed + delay
                    };
                }
            });

            return [...updatedBlobItems, ...pearlItems];
        });
    }, [blobs]);

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
                    filter: (isArchive && !isUnsealed) ? 'opacity(0.15) saturate(0.8)' : 'none',
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
                    {items.map((it, i) => {
                        const isNewest = newBlobIds && newBlobIds.has(it.id);
                        return (
                            <motion.g
                                key={it.id}
                                style={{
                                    x: it.x,
                                    y: it.y,
                                    scaleX: it.sx,
                                    scaleY: it.sy,
                                    cursor: it.isPearl ? 'default' : 'pointer'
                                }}
                                animate={
                                    isUnsealed ? { scale: [1, 1.15, 1] } :
                                        (isNewest ? { scale: [1, 1.08, 1] } : {})
                                }
                                transition={
                                    isUnsealed ? { duration: 0.5, ease: "backOut" } :
                                        (isNewest ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {})
                                }
                                onClick={() => !it.isPearl && onSelect(it)}
                            >
                                {/* Ripple Effect for Newest Blob */}
                                {isNewest && (
                                    <motion.circle
                                        r="32" // Slightly larger than blob radius (28)
                                        fill="none"
                                        stroke="rgba(255, 255, 255, 0.6)"
                                        strokeWidth="2"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: [0, 0.8, 0], scale: [0.8, 1.4, 1.6] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                                    />
                                )}
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
                        );
                    })}
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
                                {archiveData.archiveLabel ? (
                                    <>
                                        <div className="receipt-emotions" style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', marginBottom: '8px' }}>
                                            {archiveData.archiveLabel.emotions}
                                        </div>
                                        <div className="receipt-events" style={{ fontSize: '13px', color: '#6B7280' }}>
                                            {archiveData.archiveLabel.events}
                                        </div>
                                    </>
                                ) : (
                                    archiveData.events?.map((ev, idx) => (
                                        <div key={idx} className="receipt-event-item">
                                            {ev.text}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="receipt-grain"></div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- App Component ---
function App() {
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedBlob, setSelectedBlob] = useState(null);
    const [selectedDate, setSelectedDate] = useState('today');
    const dateRollerRef = useRef(null); // Ref for auto-scrolling to Today

    // API Data States
    const [timeline, setTimeline] = useState([]);
    const [dailyData, setDailyData] = useState(null);

    const [onboardingStep, setOnboardingStep] = useState(0); // 0: Welcome, 1: Expression, 2: Done
    const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);
    const [todayBlobs, setTodayBlobs] = useState([]); // Start with empty for fresh onboarding
    // const [todayBlobs, setTodayBlobs] = useState(makeBlobs()); // 原本的今日案例数据
    const [showTooltip, setShowTooltip] = useState(false); // Post-onboarding guide
    const [showReportDrawer, setShowReportDrawer] = useState(false);

    // Fetch Timeline on Mount & Persistence Check
    useEffect(() => {
        // Register token expiration callback
        api.setTokenExpiredCallback(() => {
            setIsLoggedIn(false);
            setShowLogin(true);
            setOnboardingStep(0);
            alert('登录已过期，请重新登录');
        });

        const token = localStorage.getItem('mochi_token');
        if (token && token.trim() !== 'demo token' && token.trim() !== 'demo_token') {
            console.log(`[Session] Active Session found: ${token.substring(0, 8)}...`);
            setIsLoggedIn(true);
            setShowLogin(false);
            // 有有效 token，直接跳过 onboarding 进入首页
            setOnboardingStep(2);
        } else {
            console.log('[Session] No valid session, showing login.');
            setIsLoggedIn(false);
            setShowLogin(true);
            setOnboardingStep(0); // 重置 onboarding 步骤
            if (token) localStorage.removeItem('mochi_token'); // Clean any garbage
        }
    }, []);

    // Auto-scroll to center the active item (Today or selected date)
    // We use a more robust version that tries again if the first attempt fails
    useEffect(() => {
        let attempts = 0;
        const maxAttempts = 5;

        const scrollToActive = (instant = false) => {
            if (dateRollerRef.current && timeline.length > 0) {
                const activeItem = dateRollerRef.current.querySelector('.roller-item.active');
                if (activeItem) {
                    activeItem.scrollIntoView({
                        behavior: instant ? 'auto' : 'smooth',
                        inline: 'center',
                        block: 'nearest'
                    });
                    return true;
                }
            }
            return false;
        };

        // First attempt: Instant scroll
        const success = scrollToActive(true);

        // Subsequent attempts: Smooth correction after layout stabilizes
        const timer = setInterval(() => {
            attempts++;
            const success = scrollToActive(attempts === 1 ? true : false);
            if (success || attempts >= maxAttempts) {
                clearInterval(timer);
            }
        }, 150);

        return () => clearInterval(timer);
    }, [timeline, selectedDate, currentPage]);

    // Reset to Today when returning to Home
    useEffect(() => {
        if (currentPage === 'home') {
            setSelectedDate('today');
        }
    }, [currentPage]);

    // Mouse Drag-to-Scroll logic for Desktop
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const scrollLeftRef = useRef(0);

    const handleMouseDown = (e) => {
        isDraggingRef.current = true;
        startXRef.current = e.pageX - dateRollerRef.current.offsetLeft;
        scrollLeftRef.current = dateRollerRef.current.scrollLeft;
        dateRollerRef.current.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
        const x = e.pageX - dateRollerRef.current.offsetLeft;
        const walk = (x - startXRef.current) * 1.5; // Scroll speed
        dateRollerRef.current.scrollLeft = scrollLeftRef.current - walk;
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        if (dateRollerRef.current) {
            dateRollerRef.current.style.cursor = 'grab';
        }
    };

    // Fetch Daily Data when selectedDate changes
    useEffect(() => {
        api.fetchDailyStatus(selectedDate).then(data => {
            setDailyData(data);
        }).catch(console.error);
    }, [selectedDate]);

    // Sync selectedBlob with todayBlobs for real-time updates (e.g. from optimistic to real)
    useEffect(() => {
        if (selectedBlob && !selectedBlob.isPearl) {
            const latest = todayBlobs.find(b => b.id === selectedBlob.id || (selectedBlob.isOptimistic && b.note === selectedBlob.note));
            if (latest && (latest.id !== selectedBlob.id || latest.label !== selectedBlob.label)) {
                setSelectedBlob(latest);
            }
        }
    }, [todayBlobs, selectedBlob]);

    // Archive sealed state (Ephemeral: resets when navigating or changing dates)
    const [isUnsealed, setIsUnsealed] = useState(false);

    // Reset unseal state when changing dates or pages
    useEffect(() => {
        setIsUnsealed(false);
    }, [selectedDate, currentPage]);

    const [isScanning, setIsScanning] = useState(false); // Device discovery modal
    const [pairingDevice, setPairingDevice] = useState(null); // Current device in setup flow
    const [onboardingInput, setOnboardingInput] = useState(''); // Textarea content for onboarding/manual
    const [entrySource, setEntrySource] = useState('手动记录'); // '手动记录', '对话提取', '录音记录'
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        const token = localStorage.getItem('mochi_token');
        if (!token) return false;
        // Strict check: if it's the old 'demo token' (with space) or 'demo_token' (with underscore), invalid it
        if (token.trim() === 'demo token' || token.trim() === 'demo_token') {
            console.warn('[Session] Detected legacy mock token on init, clearing...');
            localStorage.removeItem('mochi_token');
            return false;
        }
        return true;
    });

    // Fetch timeline when logged in
    useEffect(() => {
        if (isLoggedIn && timeline.length === 0) {
            console.log('[App] Logged in detected, fetching timeline...');
            api.fetchTimeline().then(setTimeline).catch(err => {
                console.error('[App] Failed to fetch timeline:', err);
                setTimeline([]);
            });
        }
    }, [isLoggedIn]);
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
    const recognitionRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const initialTextRef = useRef(''); // 记录录音开始前的文字
    const longPressTimerRef = useRef(null);
    const streamRef = useRef(null);
    const isRecordingRef = useRef(false); // Synchronous tracking for race conditions
    const isPointerDownRef = useRef(false); // Track if the pointer is actually down on the mic button

    // 启动语音监控与识别
    const startVoice = async (context, freshStart = false) => {
        if (isVoiceActive || recognitionRef.current || isRecordingRef.current) return;

        // Mark intentional start
        isRecordingRef.current = true;
        setVoiceContext(context);
        setIsVoiceActive(true);
        setIsProcessing(false);
        setInterimText('');

        if (freshStart) {
            if (context === 'onboarding') setOnboardingInput('');
            initialTextRef.current = '';
        }

        try {
            if (!freshStart) {
                initialTextRef.current = context === 'chat' ? chatInput : onboardingInput;
            }

            // Check cancellation before heavy lifting
            if (!isRecordingRef.current) {
                console.log('Voice startup cancelled (early)');
                setIsVoiceActive(false);
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Critical Check: Did user release the button while we were awaiting?
            if (!isRecordingRef.current) {
                console.log('Voice cancelled during startup (post-stream)');
                stream.getTracks().forEach(track => track.stop());
                setIsVoiceActive(false);
                return;
            }

            streamRef.current = stream;

            // 1. Audio Visualizer Setup
            // Close any existing AudioContext before creating a new one
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }

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
                if (!isRecordingRef.current) return; // Stop loop if cancelled
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
                recognition.interimResults = true;
                recognition.maxAlternatives = 1;
                recognition.continuous = true;

                recognition.onresult = (event) => {
                    let sessionTranscript = '';
                    for (let i = 0; i < event.results.length; ++i) {
                        sessionTranscript += event.results[i][0].transcript;
                    }
                    const updatedText = initialTextRef.current + sessionTranscript;

                    if (context === 'chat') {
                        setChatInput(updatedText);
                    } else if (context === 'onboarding') {
                        setOnboardingInput(updatedText);
                    }
                };

                recognition.onerror = (event) => {
                    console.error("Speech recognition error:", event.error);
                    stopVoice(); // Safe cleanup
                };

                // Final check before starting recognition
                if (isRecordingRef.current) {
                    recognition.start();
                    recognitionRef.current = recognition;
                }
            } else {
                console.warn("Speech recognition not supported in this browser.");
            }
        } catch (err) {
            console.error("Microphone access denied:", err);
            setIsVoiceActive(false);
            isRecordingRef.current = false;
        }
    };

    // 停止语音监控并结束识别
    const stopVoice = () => {
        setIsVoiceActive(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        // Close AudioContext only if it's not already closed
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        audioContextRef.current = null;

        // Stop all tracks in the stream to completely turn off the microphone
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        isRecordingRef.current = false;
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
    const micHandlers = (context, options = {}) => ({
        onPointerDown: (e) => {
            e.preventDefault();
            isPointerDownRef.current = true;
            // Start a timer. If held for 600ms, start recording.
            longPressTimerRef.current = setTimeout(() => {
                if (isPointerDownRef.current) {
                    startVoice(context, options.freshStart || false);
                    if (navigator.vibrate) navigator.vibrate(50);
                    longPressTimerRef.current = null; // Mark as fired
                }
            }, 600);
        },
        onPointerUp: (e) => {
            if (!isPointerDownRef.current) return;
            e.preventDefault();
            isPointerDownRef.current = false;

            // 1. If timer is still valid, it means we released BEFORE 600ms (Short click)
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current); // Cancel the pending start
                longPressTimerRef.current = null;
                console.log('Short press detected, triggering manual entry.');
                if (options.onStop) options.onStop(); // Trigger entry even on short click
            }
            // 2. If timer fired, we already started voice, so now we stop it.
            else {
                stopVoice();
                if (options.onStop) options.onStop();
            }
        },
        onPointerLeave: (e) => {
            if (!isPointerDownRef.current) return; // Only handle leave if button was being pressed
            isPointerDownRef.current = false;

            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            } else {
                stopVoice();
                if (options.onStop) options.onStop();
            }
        },
        onContextMenu: (e) => e.preventDefault(),
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

    // --- Derived State for View ---
    const isArchive = selectedDate !== 'today';
    const currentIsToday = selectedDate === 'today';

    const currentData = React.useMemo(() => {
        // For Today, we merge API blobs with any locally added ones (optimistic).
        // To prevent "ghost balls" falling from the top, we must ensure each unique event 
        // only appears once in the list, even if it's currently in both todayBlobs and dailyData.
        const serverBlobs = dailyData?.blobs || [];
        const localBlobs = (currentIsToday ? todayBlobs : []).filter(tb => {
            const tbNote = (tb.note || "").trim();
            return !serverBlobs.some(sb =>
                String(sb.id) === String(tb.id) ||
                (tb.isOptimistic && (sb.note || "").trim() === tbNote)
            );
        });
        const validBlobs = [...serverBlobs, ...localBlobs];

        // Extract display values from dailyData (or use defaults while loading)
        const {
            emoji = '🫠',
            statusText = 'Loading...',
            whisper = { text: '...' },
            archiveLabel = null,
            fullDate = new Date().toISOString(),
            moodCategory = '平静蓝/绿'
        } = dailyData || {};

        return {
            emoji,
            statusText,
            whisper,
            archiveLabel,
            fullDate,
            moodCategory,
            blobs: validBlobs.map(b => ({
                ...b,
                isDiscussed: discussedIds.has(b.id)
            }))
        };
    }, [dailyData, todayBlobs, currentIsToday, discussedIds]);

    const isHeaderEmpty = selectedDate === 'today' && todayBlobs.length === 0;
    const headerEmoji = isHeaderEmpty ? '\u2728' : currentData.emoji;
    const headerStatusIcon = <Sparkles size={14} />;

    // Prioritize Backend Gradient > Emoji Fallback (Direct string mapping)
    const categoryGradient = HEADER_GRADIENTS[currentData.moodCategory];
    const emojiGradient = EMOTION_COLORS[headerEmoji] || EMOTION_COLORS['default'];

    const headerBg = categoryGradient || emojiGradient;

    const headerStatusContent = !dailyData ? (
        // Loading State for Status Text
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '200px' }}>
            <div className="animate-pulse" style={{ height: '14px', width: '80%', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }} />
            <div className="animate-pulse" style={{ height: '12px', width: '60%', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }} />
        </div>
    ) : (
        isHeaderEmpty ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '14px', fontStyle: 'normal', fontWeight: 600, color: '#374151' }}>{"今天还没有记录呢"}</span>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>{"点击/长按 + 记录，把这一刻放进情绪罐头"}</span>
            </div>
        ) : (
            <span style={{ fontSize: '14px', fontStyle: 'normal' }}>{currentData.statusText}</span>
        )
    );

    // 切换日期时重置罐头动画（通过 key）。添加新碎片时不应重置，以便保持物理连续性。
    const jarKey = selectedDate;

    const [chatInput, setChatInput] = useState('');
    const [showEndCard, setShowEndCard] = useState(true); // Simulated: shows based on history
    const [chatSessions, setChatSessions] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [isTyping, setIsTyping] = useState(false);

    const chatEndRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inactivityTimerRef = useRef(null);
    const shouldAutoScrollRef = useRef(true); // Control auto-scroll behavior

    // --- 不活跃检测 (10分钟自动结项) ---
    const resetInactivityTimer = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

        // 仅在聊天页面、且有未关闭的会话时计时
        if (currentPage === 'chat' && chatSessions.length > 0) {
            const lastSession = chatSessions[chatSessions.length - 1];
            if (lastSession && !lastSession.isClosed) {
                inactivityTimerRef.current = setTimeout(() => {
                    console.log('[Inactivity] 10分钟未操作，自动结项');
                    handleEndSession();
                }, 10 * 60 * 1000); // 10分钟
            }
        }
    };

    // 每次会话更新或切换回聊天页时重置计时
    useEffect(() => {
        resetInactivityTimer();
        return () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, [chatSessions, currentPage]);

    // Initial History Load
    useEffect(() => {
        if (currentPage === 'chat' && chatSessions.length === 0) {
            const loadInitial = async () => {
                setIsLoadingHistory(true);
                try {
                    const data = await api.fetchChatSessions(10, null);
                    if (data.sessions && data.sessions.length > 0) {
                        setChatSessions(data.sessions);
                    }
                } catch (e) {
                    console.error("Failed to load initial history", e);
                } finally {
                    setIsLoadingHistory(false);
                }
            };
            loadInitial();
        }
    }, [currentPage /* run once when page becomes chat */]);

    // Auto-scroll to bottom when chat opens or sessions change
    useEffect(() => {
        if (currentPage === 'chat') {
            // Skip auto-scroll if we are loading history
            if (!shouldAutoScrollRef.current) {
                shouldAutoScrollRef.current = true; // Reset for next time
                return;
            }

            const scrollToBottom = () => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                // Fallback: manual scroll on container
                if (chatEndRef.current) {
                    chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                }
            };

            // Initial scroll
            const timer1 = setTimeout(scrollToBottom, 50);
            // Intermediate scroll (good for general transitions)
            const timer2 = setTimeout(scrollToBottom, 300);
            // Stronger scroll after animation definitely finishes (800ms for safety with springs)
            const timer3 = setTimeout(scrollToBottom, 800);

            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
                clearTimeout(timer3);
            };
        }
    }, [currentPage, chatSessions]);

    const handleChatScroll = async (e) => {
        const { scrollTop, scrollHeight } = e.currentTarget;

        // Trigger load when close to top (e.g. < 20px)
        if (scrollTop < 20 && !isLoadingHistory && hasMoreHistory && chatSessions.length > 0) {
            console.log('[App] Loading history triggered...');
            shouldAutoScrollRef.current = false; // Prevent auto-scroll to bottom on render
            setIsLoadingHistory(true);

            const prevScrollHeight = scrollHeight;

            try {
                // Find oldest session timestamp for cursor
                // Current chatSessions: [Oldest, ..., Newest]
                const oldestSession = chatSessions[0];
                const beforeTime = oldestSession?.startTime;

                // Fetch older sessions
                const data = await api.fetchChatSessions(10, beforeTime);

                if (data.sessions && data.sessions.length > 0) {
                    // Prepend new sessions
                    setChatSessions(prev => [...data.sessions, ...prev]);

                    // Restore scroll position after render
                    // We use setTimeout to allow React to commit the update
                    setTimeout(() => {
                        if (chatEndRef.current) {
                            const newScrollHeight = chatEndRef.current.scrollHeight;
                            const heightDiff = newScrollHeight - prevScrollHeight;
                            // Adjust scroll top to maintain visual position
                            chatEndRef.current.scrollTop = heightDiff;
                        }
                    }, 0);
                } else {
                    setHasMoreHistory(false);
                }
            } catch (err) {
                console.error("Failed to load history", err);
            } finally {
                setIsLoadingHistory(false);
            }
        }
    };

    const startNewSession = (initialMessages = [], relatedBlobId = null) => {
        const now = new Date();

        // 1. Auto-close previous active session if exists
        setChatSessions(prev => {
            const lastSession = prev[prev.length - 1];
            if (lastSession && !lastSession.isClosed) {
                const endCardContent = '\u8fd9\u4e00\u6bb5\u5bf9\u8bdd\u5148\u653e\u5728\u8fd9\u91cc\uff0c\u4f60\u4eca\u5929\u5df2\u7ecf\u5f88\u68d2\u4e86\u3002';
                const closedSession = { ...lastSession, isClosed: true, endCardContent, closedAt: now.toISOString() };
                const otherSessions = prev.slice(0, -1);

                // Add the new session after closing the previous one
                const messagesWithISO = initialMessages.map(m => ({
                    ...m,
                    timestamp: m.timestamp || now.toISOString()
                }));

                const newSession = {
                    id: Date.now(),
                    startTime: now.toISOString(),
                    messages: messagesWithISO,
                    relatedBlobIds: relatedBlobId ? [relatedBlobId] : []
                };

                return [...otherSessions, closedSession, newSession];
            } else {
                // Just add new session
                const messagesWithISO = initialMessages.map(m => ({
                    ...m,
                    timestamp: m.timestamp || now.toISOString()
                }));

                const newSession = {
                    id: Date.now(),
                    startTime: now.toISOString(),
                    messages: messagesWithISO,
                    relatedBlobIds: relatedBlobId ? [relatedBlobId] : []
                };
                return [...prev, newSession];
            }
        });
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

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const updatedHistory = chatSessions.length > 0 ? chatSessions[chatSessions.length - 1].messages : [];
        const userMsg = { type: 'user', text: chatInput, timestamp: new Date().toISOString() };

        // 1. Add User Message
        setChatSessions(prev => {
            const lastSession = prev[prev.length - 1];
            const otherSessions = prev.slice(0, -1);
            return [...otherSessions, { ...lastSession, messages: [...lastSession.messages, userMsg] }];
        });

        const currentInput = chatInput; // Capture current input
        setChatInput('');
        setIsTyping(true); // Show typing indicator while connecting

        try {
            // 2. Prepare for Stream: Create an empty AI message placeholder
            let isFirstChunk = true;

            await api.streamChat(updatedHistory, currentInput, (chunk) => {
                setChatSessions(prev => {
                    const lastSession = prev[prev.length - 1];
                    if (!lastSession) return prev;

                    const otherSessions = prev.slice(0, -1);
                    const messages = [...lastSession.messages];

                    if (isFirstChunk) {
                        setIsTyping(false); // Hide dots once first chunk arrives
                        // Add new AI message
                        messages.push({
                            type: 'ai',
                            text: chunk,
                            timestamp: new Date().toISOString()
                        });
                        isFirstChunk = false;
                    } else {
                        // Append to last AI message
                        const lastMsg = messages[messages.length - 1];
                        if (lastMsg.type === 'ai') {
                            messages[messages.length - 1] = {
                                ...lastMsg,
                                text: lastMsg.text + chunk
                            };
                        }
                    }

                    return [...otherSessions, { ...lastSession, messages }];
                });
            });
        } catch (err) {
            console.error('Streaming failed:', err);
            setIsTyping(false);
            // Optional: Add error message to chat
        }
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
            return [...otherSessions, { ...lastSession, isClosed: true, endCardContent, closedAt: new Date().toISOString() }];
        });

        requestEventMemoryExtraction(lastSnapshot);
    };

    // 模拟推送通知逻辑 (Push Notification Simulation)
    useEffect(() => {
        if (isLoggedIn && currentPage === 'home' && !pendingPush) {
            const timer = setTimeout(() => {
                const undiscussedIdsList = todayBlobs.filter(b => !discussedIds.has(b.id)).map(b => b.id);

                // Simulate: POST /api/notifications/suggest { undiscussedBlobIds: [...] }
                console.log('[Notification-API] Requesting suggestion with IDs:', undiscussedIdsList.length > 0 ? undiscussedIdsList : null);

                if (undiscussedIdsList.length > 0) {
                    // Randomly pick one as the "Backend choice"
                    const targetId = undiscussedIdsList[Math.floor(Math.random() * undiscussedIdsList.length)];
                    const target = todayBlobs.find(b => b.id === targetId);

                    setPendingPush({
                        id: target.id,
                        title: 'Mochi 刚才在想...',
                        body: `关于【${target.label}】的那个瞬间，想听你多说几句点... ✨`,
                        blob: target
                    });
                }
            }, 12000); // 12 seconds for demo purposes
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
        // CLEAR STORAGE
        localStorage.removeItem('mochi_token');
    };

    // Auto-clear 'new' highlight when leaving 'home' and update timestamp
    useEffect(() => {
        if (currentPage !== 'home') {
            setNewBlobIds(new Set()); // Clear all highlights locally
            api.updateLastHomeVisit(); // Tell backend (mock) we left the feed
        }
    }, [currentPage]);

    const [newBlobIds, setNewBlobIds] = useState(new Set()); // Track unread blobs for highlighting (Set of Strings)

    // Sync backend 'isUnread' status to local state
    // Use a ref to prevent infinite loops and fighting with local deletion
    const prevUnreadIdsRef = useRef('');
    useEffect(() => {
        if (currentData.blobs) {
            const backendUnread = currentData.blobs.filter(b => b.isUnread).map(b => b.id);
            const backendUnreadStr = backendUnread.sort().join(',');

            // Only update if the backend list *actually* changes (e.g. new fetch)
            // This prevents the effect from undoing a local 'delete' when currentData.blobs is just re-created reference
            if (backendUnreadStr !== prevUnreadIdsRef.current) {
                if (backendUnread.length > 0) {
                    setNewBlobIds(prev => {
                        const next = new Set(prev);
                        backendUnread.forEach(id => next.add(id));
                        return next;
                    });
                }
                prevUnreadIdsRef.current = backendUnreadStr;
            }
        }
    }, [currentData.blobs]);

    const handleOnboardingComplete = (firstExpression) => {
        if (firstExpression) {
            setIsOnboardingSaving(true);

            // 1. Call real API to save
            api.createEmotionBlob(firstExpression, entrySource)
                .then(serverBlob => {
                    if (serverBlob) {
                        console.log('[API] Saved successfully and categorized.');
                        setTodayBlobs(prev => [...prev, serverBlob]);
                        setNewBlobIds(prev => new Set(prev).add(serverBlob.id)); // Add manual one
                    }
                    setIsOnboardingSaving(false);
                    setOnboardingStep(2); // Success -> Step 2
                    setOnboardingInput('');
                })
                .catch(err => {
                    console.error('[API] Save Failed.', err);
                    setIsOnboardingSaving(false);
                    alert("保存失败，请重试");
                });

            // 仅在真实没有碎片（第一个）时弹出恭喜弹窗
            // 延迟 4 秒，因为现在要等后端返回后球掉落
            if (todayBlobs.length === 0) {
                setTimeout(() => {
                    setShowTooltip(true);
                    setTimeout(() => setShowTooltip(false), 8000);
                }, 4000);
            }
        } else {
            setOnboardingStep(2);
            setOnboardingInput('');
        }
        setEntrySource('手动记录'); // 重置为默认
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
                                    api.login(phoneNumber).then((result) => {
                                        setIsLoggedIn(true);
                                        // 新用户显示 onboarding（0），老用户直接跳过（2）
                                        setOnboardingStep(result.isNewUser ? 0 : 2);
                                    }).catch(err => alert('登录失败，请检查连接'));
                                } else {
                                    alert('请输入有效的手机号');
                                }
                            }}
                            style={{
                                width: '100%',
                                padding: '18px'
                            }}
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
                                    {!isOnboardingSaving && (
                                        <span onClick={() => { setOnboardingInput(''); setOnboardingStep(2); }} style={{ color: '#9CA3AF', fontSize: '14px', cursor: 'pointer' }}>跳过</span>
                                    )}
                                </div>
                                <div className="expression-input-area">
                                    <div style={{ position: 'relative' }}>
                                        <textarea
                                            className="expression-input"
                                            placeholder="累 / 开心 / 有点乱..."
                                            autoFocus
                                            disabled={isOnboardingSaving}
                                            value={onboardingInput}
                                            onChange={(e) => setOnboardingInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey && !isOnboardingSaving) {
                                                    e.preventDefault();
                                                    handleOnboardingComplete(onboardingInput);
                                                }
                                            }}
                                        />
                                        {!isOnboardingSaving && (
                                            <div
                                                className={`voice-trigger onboarding ${isVoiceActive && voiceContext === 'onboarding' ? 'recording' : ''}`}
                                                {...micHandlers('onboarding')}
                                            >
                                                <Mic size={20} />
                                            </div>
                                        )}
                                        <p className="placeholder-text" style={{ bottom: '-30px', textAlign: 'center' }}>
                                            {isOnboardingSaving ? "正在分类你的情绪..." : "模糊一点也没关系"}
                                        </p>
                                    </div>
                                    <button
                                        className="next-button"
                                        style={{
                                            width: '100%',
                                            marginTop: '60px',
                                            background: 'var(--primary)',
                                            opacity: isOnboardingSaving ? 0.7 : 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'opacity 0.3s ease-in-out'
                                        }}
                                        disabled={isOnboardingSaving}
                                        onClick={() => handleOnboardingComplete(onboardingInput)}
                                    >
                                        {isOnboardingSaving && (
                                            <div className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', flexShrink: 0 }} />
                                        )}
                                        {isOnboardingSaving ? "处理中..." : "放入情绪罐头"}
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
                                        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#111827' }}>{formatToDate(currentData.fullDate)}</h1>
                                        <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>{formatToWeekday(currentData.fullDate)}</p>
                                    </div>
                                    <div style={{ fontSize: '28px' }}>
                                        {!dailyData ? (
                                            <div className="animate-pulse" style={{ width: '32px', height: '32px', background: 'rgba(0,0,0,0.1)', borderRadius: '50%' }} />
                                        ) : (
                                            headerEmoji
                                        )}
                                    </div>
                                </div>
                                <div className="status-card" style={{ marginTop: 0 }}>
                                    <div className="mochi-whisper" style={{ marginTop: 0 }}>
                                        {headerStatusIcon}
                                        {headerStatusContent}
                                    </div>
                                </div>
                            </div>

                            {/* Time Roller - 动态映射且支持横向滚动 */}
                            <div
                                className="date-roller"
                                ref={dateRollerRef}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                style={{ cursor: timeline.length === 0 ? 'default' : 'grab' }}
                            >
                                {timeline.length === 0 ? (
                                    <>
                                        <div className="roller-spacer" />
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} style={{
                                                width: '60px',
                                                height: '24px',
                                                background: 'rgba(0,0,0,0.05)',
                                                borderRadius: '6px',
                                                flexShrink: 0
                                            }} className="animate-pulse" />
                                        ))}
                                        <div className="roller-spacer" />
                                    </>
                                ) : (
                                    <>
                                        <div className="roller-spacer" />
                                        {timeline.map((item) => {
                                            const isActive = selectedDate === item.id;

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`roller-item ${isActive ? 'active' : ''} ${!item.hasData ? 'disabled' : 'has-data'}`}
                                                    onClick={() => item.hasData && setSelectedDate(item.id)}
                                                >
                                                    {item.id === 'today' ? 'Today' : getTimeLabel(item.fullDate)}
                                                    {isActive && <div className="active-dot" />}
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>

                            <div className="jar-container">
                                {!dailyData ? (
                                    <div style={{
                                        height: 360,
                                        width: JAR_WIDTH,
                                        margin: '0 auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: 0.5
                                    }}>
                                        <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #E5E7EB', borderTopColor: '#A78BFA', borderRadius: '50%' }} />
                                    </div>
                                ) : (
                                    <JarPhysics
                                        key={jarKey}
                                        height={360}
                                        onSelect={(blob) => {
                                            setSelectedBlob(blob);
                                            // Clear highlight if viewing a new blob
                                            if (newBlobIds.has(blob.id)) {
                                                setNewBlobIds(prev => {
                                                    const next = new Set(prev);
                                                    next.delete(blob.id);
                                                    return next;
                                                });
                                            }
                                        }}
                                        blobs={currentData.blobs}
                                        newBlobIds={newBlobIds}
                                        isArchive={selectedDate !== 'today'}
                                        isUnsealed={isUnsealed}
                                        onUnseal={() => setIsUnsealed(true)}
                                        archiveData={currentData}
                                    />
                                )}
                            </div>

                            {/* Self-Discovery Entry Bar */}
                            <motion.div
                                className="discovery-bar-container"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                <button className="discovery-bar" onClick={() => setShowReportDrawer(true)}>
                                    <div className="discovery-bar-content">
                                        <div className="discovery-icon-bg">
                                            <PieChart size={14} color="#A78BFA" />
                                        </div>
                                        <div className="discovery-text">
                                            <span className="title">我的情绪总结</span>
                                            <span className="subtitle">当你留下很多碎片后，一些规律，会慢慢浮现。</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} color="#D1D5DB" />
                                </button>
                            </motion.div>

                            <div style={{ position: 'absolute', bottom: '84px', right: '16px', zIndex: 100 }}>
                                {/* Manual Entry - Long-press to record directly */}
                                <motion.button
                                    className={`home-fab ${isVoiceActive && voiceContext === 'onboarding' ? 'recording' : ''}`}
                                    whileHover={selectedDate === 'today' ? { scale: 1.05 } : {}}
                                    whileTap={selectedDate === 'today' ? { scale: 0.95 } : {}}
                                    {...(selectedDate === 'today' ? micHandlers('onboarding', { freshStart: true, onStop: () => setOnboardingStep(1) }) : {})}
                                    style={{
                                        background: isVoiceActive && voiceContext === 'onboarding'
                                            ? 'linear-gradient(135deg, #A78BFA, #818CF8)'
                                            : (selectedDate === 'today' ? 'white' : 'rgba(255, 255, 255, 0.4)'),
                                        width: '56px', height: '56px', borderRadius: '28px',
                                        boxShadow: selectedDate === 'today' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                                        border: selectedDate === 'today' ? 'none' : '1px solid rgba(0,0,0,0.05)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: selectedDate === 'today' ? 'pointer' : 'default',
                                        opacity: selectedDate === 'today' ? 1 : 0.6,
                                        position: 'relative',
                                        overflow: 'visible',
                                        touchAction: 'none'
                                    }}
                                >
                                    {isVoiceActive && voiceContext === 'onboarding' && (
                                        <motion.div
                                            layoutId="fab-pulse"
                                            initial={{ scale: 0.8, opacity: 0.5 }}
                                            animate={{ scale: 1.8, opacity: 0 }}
                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                            style={{
                                                position: 'absolute',
                                                inset: 0,
                                                borderRadius: '50%',
                                                background: 'rgba(167, 139, 250, 0.5)',
                                                zIndex: -1
                                            }}
                                        />
                                    )}
                                    <Plus
                                        size={24}
                                        color={isVoiceActive && voiceContext === 'onboarding' ? "#FFFFFF" : (selectedDate === 'today' ? "#6B7280" : "#9CA3AF")}
                                        style={{
                                            transform: isVoiceActive && voiceContext === 'onboarding' ? 'scale(1.2)' : 'scale(1)',
                                            transition: 'transform 0.2s ease, color 0.2s ease'
                                        }}
                                        className={isVoiceActive && voiceContext === 'onboarding' ? "animate-pulse" : ""}
                                    />
                                </motion.button>
                            </div>

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
                                onScroll={handleChatScroll}
                                style={{ padding: '24px 24px 24px 24px', paddingTop: '60px', display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, zIndex: 1 }}
                            >
                                {isLoadingHistory && (
                                    <div style={{ textAlign: 'center', padding: '10px', color: '#9CA3AF', fontSize: '12px' }}>
                                        Looking for memories...
                                    </div>
                                )}



                                {/* Dynamic Sessions */}
                                {chatSessions.map((session) => {
                                    // Determine if session is "historical" (not today)
                                    // Use closedAt if available, otherwise startTime
                                    const sessionTime = session.closedAt || session.startTime;
                                    const isHistory = !isDateToday(sessionTime);

                                    return (
                                        <div
                                            key={session.id}
                                            style={{
                                                marginBottom: '30px',
                                                opacity: isHistory ? 0.6 : 1,
                                                // filter: isHistory ? 'grayscale(0.8)' : 'none', // User requested only opacity
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            <div style={{ textAlign: 'center', margin: '20px 0', opacity: 0.8 }}>
                                                <p style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>{formatToSessionTime(session.startTime)}</p>
                                            </div>
                                            {session.messages.map((msg, i) => (
                                                <div key={i} className={`chat-bubble ${msg.type}`}>
                                                    {msg.text}
                                                    <span style={{ fontSize: '10px', opacity: 0.6, display: 'block', marginTop: '4px', textAlign: msg.type === 'user' ? 'right' : 'left' }}>
                                                        {formatToHHmm(msg.timestamp)}
                                                    </span>
                                                </div>
                                            ))}
                                            {session.isClosed && (
                                                <div>
                                                    <div className="saved-indicator" style={{ marginBottom: '0', marginTop: '16px' }}>
                                                        <div className="dot" />
                                                        <span>{`\u5df2\u5c01\u5b58\u4e8e ${formatToSessionTime(session.closedAt)}`}</span>
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
                                    );
                                })}



                                {isTyping && (
                                    <div key="typing" style={{ marginBottom: '30px' }}>
                                        <div className="chat-bubble ai" style={{ width: '60px', borderRadius: '24px 24px 24px 4px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            <div className="animate-bounce" style={{ width: '6px', height: '6px', background: '#9CA3AF', borderRadius: '50%', animationDelay: '0s' }} />
                                            <div className="animate-bounce" style={{ width: '6px', height: '6px', background: '#9CA3AF', borderRadius: '50%', animationDelay: '0.1s' }} />
                                            <div className="animate-bounce" style={{ width: '6px', height: '6px', background: '#9CA3AF', borderRadius: '50%', animationDelay: '0.2s' }} />
                                        </div>
                                    </div>
                                )}

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
                                onClick={() => {
                                    api.login(phoneNumber).then(res => {
                                        setIsLoggedIn(true);
                                        setShowLogin(false);
                                    });
                                }}
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
                                                <span style={{ fontSize: '10px', color: '#6B7280' }}>{selectedBlob.source || '来自设备'}</span>
                                            </div>
                                        </div>
                                        <X size={20} color="#9CA3AF" onClick={() => setSelectedBlob(null)} style={{ cursor: 'pointer' }} />
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>{formatToHHmm(selectedBlob.time)}</p>
                                    <p style={{
                                        fontSize: '15px',
                                        color: '#4B5563',
                                        marginTop: '12px',
                                        lineHeight: 1.6,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 6,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {selectedBlob.note}
                                    </p>

                                    {/* Chat about this button */}
                                    <button
                                        onClick={() => {
                                            startNewSession([
                                                { type: 'user', text: `我想聊聊“${selectedBlob.note}”这件事儿` },
                                                { type: 'ai', text: '我在听。感觉这个瞬间对你很重要呢，想再多分享一点吗？' }
                                            ], selectedBlob.id);
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

                {/* Post-Onboarding Modal */}
                {showTooltip && (
                    <div key="onboarding-success" className="modal-overlay" onClick={() => setShowTooltip(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 100 }}
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
                            <X
                                size={20}
                                color="#9CA3AF"
                                onClick={() => setShowTooltip(false)}
                                style={{ cursor: 'pointer', position: 'absolute', top: '16px', right: '16px' }}
                            />
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
                                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937', marginBottom: '8px' }}>
                                    恭喜你存储了第一个情绪碎片！
                                </h3>
                                <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
                                    每一个情绪瞬间都值得被倾听。<br />
                                    试着和 Mochi 聊聊这个瞬间吧～
                                </p>
                                <button
                                    onClick={() => {
                                        const latestBlob = todayBlobs[todayBlobs.length - 1];
                                        startNewSession([
                                            { type: 'user', text: `我想聊聊“${latestBlob.note}”这件事儿` },
                                            { type: 'ai', text: '我在听。感觉这个瞬间对你很重要呢，想再多分享一点吗？' }
                                        ], latestBlob.id);
                                        setDiscussedIds(prev => new Set([...prev, latestBlob.id]));
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
                                >
                                    💬 聊聊这个瞬间
                                </button>
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
                                { type: 'user', text: `我想聊聊“${pendingPush.blob.note}”这件事儿` },
                                { type: 'ai', text: `我在听。看到你刚才记录了【${pendingPush.blob.label}】，那个瞬间现在感觉好些了吗？` }
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

                {/* Report Drawer - Bottom up tray */}
                {showReportDrawer && (
                    <div key="report-drawer-overlay" className="modal-overlay report-overlay" onClick={() => setShowReportDrawer(false)} style={{ zIndex: 4000 }}>
                        <motion.div
                            className="report-drawer"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="drawer-handle" />
                            <div className="report-header">
                                <button className="close-drawer-btn" onClick={() => setShowReportDrawer(false)}>
                                    <X size={20} color="#9CA3AF" />
                                </button>
                                <h2 className="report-title">我的情绪总结</h2>
                                <p className="report-subtitle">当你留下很多碎片后，一些规律，会慢慢浮现。</p>
                            </div>

                            <div className="report-body" style={{ position: 'relative' }}>
                                <div className="report-watermark-layer">
                                    {[...Array(40)].map((_, i) => (
                                        <div key={i} className="report-watermark">示意图</div>
                                    ))}
                                </div>
                                {/* Section 1: Reaction Persona */}
                                <div className="report-section">
                                    <div className="section-label">反应方式画像</div>
                                    <div className="persona-card">
                                        <img
                                            src="/persona_illustration.png"
                                            alt="Persona Illustration"
                                            className="persona-illustration"
                                        />
                                        <div className="persona-badge">
                                            <Sparkles size={16} />
                                            <span>内耗型</span>
                                        </div>
                                        <div className="persona-desc">
                                            <p>情绪来时，我更容易：</p>
                                            <div className="persona-tags">
                                                <span className="p-tag active">反复想</span>
                                                <span className="p-tag">逃开</span>
                                                <span className="p-tag active">自己消化</span>
                                                <span className="p-tag">找人说</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Rhythm & Triggers */}
                                <div className="report-section">
                                    <div className="section-label">情绪节奏 × 触发源</div>
                                    <div className="rhythm-card larger">
                                        <div className="rhythm-graph-container">
                                            <div className="sentiment-labels">
                                                <span>开心</span>
                                                <span>平静</span>
                                                <span>低落</span>
                                            </div>
                                            <div className="rhythm-graph-mock">
                                                <svg viewBox="0 0 200 100" className="rhythm-svg">
                                                    {/* Baseline */}
                                                    <line x1="0" y1="50" x2="200" y2="50" stroke="#F3F4F6" strokeDasharray="4 2" />

                                                    {/* Sentiment Path */}
                                                    <path
                                                        d="M0,55 C15,55 25,10 45,15 C65,20 75,90 100,80 C125,70 135,20 160,25 C185,30 190,65 200,60"
                                                        fill="none"
                                                        stroke="url(#sentiment-grad)"
                                                        strokeWidth="4"
                                                        strokeLinecap="round"
                                                    />

                                                    <defs>
                                                        <linearGradient id="sentiment-grad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#FCA5A5" />
                                                            <stop offset="50%" stopColor="#A78BFA" />
                                                            <stop offset="100%" stopColor="#93C5FD" />
                                                        </linearGradient>
                                                    </defs>

                                                    {/* Data Points */}
                                                    <circle cx="45" cy="15" r="3.5" fill="#FCA5A5" />
                                                    <circle cx="100" cy="80" r="3.5" fill="#93C5FD" />
                                                    <circle cx="160" cy="25" r="3.5" fill="#FCA5A5" />
                                                </svg>
                                                <div className="rhythm-days">
                                                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="trigger-insight">
                                            本周你的情绪波动由于 <span className="highlight">#社交互动</span> 显著提升，但在 <span className="highlight">#周四深夜</span> 出现了短暂的低落期。
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Relationships & Care */}
                                <div className="report-section">
                                    <div className="section-label">关系与在意的人</div>
                                    <div className="relations-cloud-card">
                                        <div className="cloud-container">
                                            <div className="cloud-center">
                                                <div className="main-name">老妈</div>
                                            </div>
                                            <div className="cloud-tags">
                                                <span className="c-tag t1">关心</span>
                                                <span className="c-tag t2">琐事</span>
                                                <span className="c-tag t3">压力感</span>
                                                <span className="c-tag t4">唠叨</span>
                                                <span className="c-tag t5">温暖</span>
                                            </div>
                                        </div>
                                        <div className="relation-note">你把近 40% 的情绪，都花在了这些关系里。</div>
                                    </div>
                                </div>

                                {/* Section 4: Recovery Factors */}
                                <div className="report-section">
                                    <div className="section-label">反应方式 × 恢复因子</div>
                                    <div className="recovery-card">
                                        <div className="recovery-title">当我难受时，什么能让我好受些：</div>
                                        <div className="recovery-list">
                                            <div className="rec-item">
                                                <div className="rec-icon">📖</div>
                                                <div className="rec-text">独自去书店</div>
                                            </div>
                                            <div className="rec-item">
                                                <div className="rec-icon">🧘</div>
                                                <div className="rec-text">深度呼吸 5 分钟</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="report-footer-actions" style={{ marginTop: '12px' }}>
                                    <button className="action-btn primary" onClick={() => setShowReportDrawer(false)}>
                                        我知道了
                                    </button>
                                    <button className="action-btn secondary" onClick={() => {
                                        setShowReportDrawer(false);
                                        setCurrentPage('chat');
                                        startNewSession([{ type: 'user', text: '想听听你对我的近期总结' }]);
                                    }}>
                                        和 Mochi 聊聊总结
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    )
}

export default App