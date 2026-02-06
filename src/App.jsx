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
                release: isNewest ? 400 : i * 100, // Reduced delay from 1200 to 400 for snappier feel
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
        const prevSignature = prevBlobsRef.current.map(b => `${b.id}-${b.isDiscussed}`).join(',');
        const currSignature = blobs.map(b => `${b.id}-${b.isDiscussed}`).join(',');

        if (prevSignature === currSignature && prevBlobsRef.current.length === blobs.length) {
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

                    // Determine initial position based on context
                    let x, y, releaseTime, isActive;

                    if (isArchive) {
                        // Archive: Start at top (like makeBlobs) for simulation
                        // We will simulate them falling instantly below
                        x = mouthX + (Math.random() * 2 - 1) * 60;
                        y = height / 2 - Math.random() * 100; // Start bit lower to save sim time
                        releaseTime = 0;
                        isActive = true;
                    } else {
                        // Today: Start falling from mouth with delay
                        x = mouthX + (Math.random() * 2 - 1) * mouthRange;
                        y = -30;
                        releaseTime = currentElapsed + delay;
                        isActive = false;
                    }

                    return {
                        ...blob,
                        x, y,
                        vx: 0, vy: 0,
                        active: isActive,
                        release: releaseTime,
                        settled: false // Will be set to true after pre-sim if isArchive
                    };
                }
            });

            // If Archive and we have NEW items, run synchronous pre-simulation to settle them
            // We check newCount > 0 to avoid re-simulating and "exploding" already settled blobs on every click
            if (isArchive && newCount > 0) {
                const simSteps = 300; // ~5 seconds of sim checking
                const g = 0.34;
                const friction = 0.95;

                for (let s = 0; s < simSteps; s++) {
                    // Physics Step
                    for (let i = 0; i < updatedBlobItems.length; i++) {
                        const it = updatedBlobItems[i];
                        if (!it.active) continue;

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

                    // Simple Collisions
                    for (let i = 0; i < updatedBlobItems.length; i++) {
                        for (let j = i + 1; j < updatedBlobItems.length; j++) {
                            const a = updatedBlobItems[i]; const b = updatedBlobItems[j];
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
                                    const imp = -0.7 * vn;
                                    a.vx -= imp * nx * 0.5; a.vy -= imp * ny * 0.5;
                                    b.vx += imp * nx * 0.5; b.vy += imp * ny * 0.5;
                                }
                            }
                        }
                    }
                }

                // Stop them after sim and mark settled
                updatedBlobItems.forEach(it => {
                    it.vx = 0; it.vy = 0;
                    it.settled = true;
                });
            }

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
                                    cursor: it.isPearl ? 'default' : 'pointer',
                                    // Opacity handled by animate prop now
                                }}
                                initial={{ opacity: isArchive ? 1 : 0 }}
                                animate={{
                                    opacity: it.active ? 1 : 0,
                                    scale: isUnsealed ? [1, 1.15, 1] : (isNewest && it.active ? [1, 1.08, 1] : 1)
                                }}
                                transition={{
                                    opacity: { duration: 0.4 }, // Smooth fade-in when activated
                                    scale: isUnsealed ? { duration: 0.5, ease: "backOut" } :
                                        (isNewest ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {})
                                }}
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

// Helper to ensure sessions are always sorted [Oldest -> Newest] (corresponds to Top -> Bottom in UI)
const sortSessionsChronological = (sessions) => {
    return [...sessions].sort((a, b) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        // Fallback to ID comparison if timestamps are identical
        return String(a.id).localeCompare(String(b.id));
    });
};

// --- App Component ---
function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [chatSessions, setChatSessions] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [isInitialHistoryLoaded, setIsInitialHistoryLoaded] = useState(false);
    const chatSessionsCountRef = useRef(0);

    const [currentPage, setCurrentPage] = useState('home');
    const [selectedBlob, setSelectedBlob] = useState(null);
    const [selectedDate, setSelectedDate] = useState('today');
    const [onboardingStep, setOnboardingStep] = useState(0); // 0: Welcome, 1: Expression, 2: Done
    const [showLogin, setShowLogin] = useState(true);
    const [phoneNumber, setPhoneNumber] = useState('');

    const dateRollerRef = useRef(null); // Ref for auto-scrolling to Today

    // API Data States
    const [timeline, setTimeline] = useState([]);
    const [dailyData, setDailyData] = useState(null);
    const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);

    const [todayBlobs, setTodayBlobs] = useState(() => {
        // Hydrate from local storage to prevent data loss on refresh/nav
        try {
            const saved = localStorage.getItem('mochi_local_blobs');
            if (saved) {
                const { date, blobs } = JSON.parse(saved);
                // Simple check: Is it from "today" (Client time)?
                // Use a stable ISO date for comparison to avoid locale issues
                const todayStr = new Date().toISOString().split('T')[0];
                if (date === todayStr) {
                    console.log('[App] Restored local blobs:', blobs.length);
                    return blobs;
                }
            }
        } catch (e) {
            console.warn('[App] Failed to load local blobs', e);
        }
        return [];
    });




    const [isEvaluating, setIsEvaluating] = useState(false);

    // Periodic usage tracking (Buried point)
    useEffect(() => {
        if (!isLoggedIn) return;

        console.log('[App] Starting usage tracking (5m interval)');
        const interval = setInterval(() => {
            // Report 5 minutes of usage
            api.reportUsage(5).catch(() => { });
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [isLoggedIn]);

    // Fetch timeline when logged in
    useEffect(() => {
        if (isLoggedIn && timeline.length === 0) {
            console.log('[App] Logged in detected, fetching timeline...');
            api.fetchTimeline().then(setTimeline).catch(err => {
                console.error('[App] Failed to fetch timeline:', err);
                setTimeline([]);
            });
        }
    }, [isLoggedIn, timeline.length]);

    useEffect(() => {
        chatSessionsCountRef.current = chatSessions.length;
    }, [chatSessions.length]);

    // Periodically check if the date has changed to clear stale local blobs (for long-running app)
    useEffect(() => {
        const interval = setInterval(() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const saved = localStorage.getItem('mochi_local_blobs');
            if (saved) {
                try {
                    const { date } = JSON.parse(saved);
                    if (date !== todayStr) {
                        console.log('[App] New ISO day detected, clearing local blobs');
                        setTodayBlobs([]);
                    }
                } catch (e) { }
            }
        }, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    // Persist todayBlobs to local storage
    useEffect(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.setItem('mochi_local_blobs', JSON.stringify({
            date: todayStr,
            blobs: todayBlobs
        }));
    }, [todayBlobs]);
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
    // Auto-scroll to center the active item (Today or selected date)
    useEffect(() => {
        const scrollToActive = (instant = false) => {
            const container = dateRollerRef.current;
            if (container && timeline.length > 0) {
                const activeItem = container.querySelector('.roller-item.active');
                if (activeItem) {
                    const containerWidth = container.offsetWidth;
                    const itemLeft = activeItem.offsetLeft;
                    const itemWidth = activeItem.offsetWidth;
                    // Calculate center position
                    const targetScroll = itemLeft - (containerWidth / 2) + (itemWidth / 2);

                    container.scrollTo({
                        left: targetScroll,
                        behavior: instant ? 'auto' : 'smooth'
                    });
                    return true;
                }
            }
            return false;
        };

        // Use requestAnimationFrame for reliable execution after layout paint
        // Try immediately and for a few consecutive frames to handle re-mounts robustly
        let frameId;
        let attempts = 0;
        const maxAttempts = 60; // Increased to ~1s to cover transition delays

        const attemptScroll = () => {
            const success = scrollToActive(attempts === 0); // Instant on first try
            attempts++;

            if (!success && attempts < maxAttempts) {
                frameId = requestAnimationFrame(attemptScroll);
            }
        };

        attemptScroll();

        return () => {
            if (frameId) cancelAnimationFrame(frameId);
        };
    }, [timeline, selectedDate, currentPage, onboardingStep]);

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
        let isCancelled = false;
        // Reset data immediately on date change to trigger skeleton
        setDailyData(null);

        api.fetchDailyStatus(selectedDate).then(data => {
            if (isCancelled) return;

            // 1. Show blobs immediately (and any pre-generated summary if history)
            setDailyData(data);

            // 2. Global Cleanup: Any blob returned by the server can be safely removed from local cache,
            // even if it belongs to a different "day" (Fixes UTC midnight mismatch between 0-8 AM)
            if (data.blobs && data.blobs.length > 0) {
                const serverIds = new Set(data.blobs.map(b => String(b.id)));
                setTodayBlobs(prev => {
                    const filtered = prev.filter(tb => {
                        // Priority 1: ID check
                        const isDuplicateId = serverIds.has(String(tb.id));
                        if (isDuplicateId) return false;

                        // Priority 2: Precise Content Match for optimistic blobs
                        const tbNoteTrimmed = (tb.note || "").trim();
                        if (tbNoteTrimmed && tb.isOptimistic) {
                            const hasContentMatch = data.blobs.some(sb => (sb.note || "").trim() === tbNoteTrimmed);
                            if (hasContentMatch) return false;
                        }

                        return true;
                    });

                    if (filtered.length !== prev.length) {
                        console.log(`[App] Cleared ${prev.length - filtered.length} blobs from local cache (found on server for ${selectedDate})`);
                        return filtered;
                    }
                    return prev;
                });
            }

            const isToday = selectedDate === 'today';
            const hasBlobs = data.blobs && data.blobs.length > 0;

            // 2. Conditional & Decoupled Eval Fetch
            // We fetch eval for ANY day that has blobs, ensuring history also shows correct summaries.
            if (hasBlobs) {
                setIsEvaluating(true); // Show loading skeleton for text
                api.fetchDailyEval(selectedDate).then(evalData => {
                    if (isCancelled) return;
                    if (!evalData) {
                        setIsEvaluating(false);
                        return;
                    }
                    setDailyData(prev => prev ? ({
                        ...prev,
                        moodCategory: evalData.mood_category || prev.moodCategory,
                        emoji: evalData.emoji || prev.emoji,
                        statusText: evalData.status_text || prev.statusText
                    }) : prev);
                    setIsEvaluating(false);
                }).catch(err => {
                    console.warn('[App] Eval fetch failed:', err);
                    setIsEvaluating(false);
                });
            }
        }).catch(err => {
            if (!isCancelled) {
                console.error('[App] fetchDailyStatus failed:', err);
                // Don't set dummy data like '暂无记录' here, as that breaks the Skeleton loading UI.
                // Keeping dailyData as null allows showHeaderSkeleton to correctly show the pulsing skeleton.
            }
        });

        return () => {
            isCancelled = true;
        };
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
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [discussedIds, setDiscussedIds] = useState(new Set()); // Kept for simple local tracking if needed, but primary source is backend

    // Refetch data when returning to Home to sync discussed status
    useEffect(() => {
        if (currentPage === 'home' && isLoggedIn) {
            console.log('[App] Returned to home, refreshing daily status...');
            api.fetchDailyStatus('today').then(data => {
                if (data) setDailyData(data);
            }).catch(console.error);
        }
    }, [currentPage, isLoggedIn]);

    const [pendingDiscussion, setPendingDiscussion] = useState(null); // { blobId, note }

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

    // 录音触发处理器 (Mic Handlers)
    // 默认使用 'toggle' (点击开启/关闭)，首页 FAB 使用 'long-press'
    const micHandlers = (context, options = {}) => {
        const mode = options.mode || 'toggle';

        if (mode === 'long-press') {
            return {
                onPointerDown: (e) => {
                    e.preventDefault();
                    isPointerDownRef.current = true;
                    // Start a timer. If held for 300ms, start recording.
                    longPressTimerRef.current = setTimeout(() => {
                        if (isPointerDownRef.current) {
                            startVoice(context, options.freshStart || false);
                            if (navigator.vibrate) navigator.vibrate(50);
                            longPressTimerRef.current = null; // Mark as fired
                        }
                    }, 300); // Reduced delay to 300ms for more responsiveness
                },
                onPointerUp: (e) => {
                    if (!isPointerDownRef.current) return;
                    e.preventDefault();
                    isPointerDownRef.current = false;

                    // 1. If timer is still valid, it means we released BEFORE 300ms (Short click)
                    if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                        console.log('[App] Mic: Short press ignored in long-press mode.');
                        if (options.onStop) options.onStop();
                    }
                    // 2. If timer fired, we already started voice, so now we stop it.
                    else {
                        stopVoice();
                        if (options.onStop) options.onStop();
                    }
                },
                onPointerLeave: (e) => {
                    if (!isPointerDownRef.current) return;
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
            };
        }

        // Default: Toggle Mode
        return {
            onClick: (e) => {
                e.preventDefault();
                if (isVoiceActive && voiceContext === context) {
                    console.log('[App] Mic Toggle: Stopping voice');
                    stopVoice();
                    if (options.onStop) options.onStop();
                } else {
                    console.log('[App] Mic Toggle: Starting voice');
                    if (isVoiceActive) stopVoice();
                    startVoice(context, options.freshStart || false);
                    if (navigator.vibrate) navigator.vibrate(50);
                }
            },
            onContextMenu: (e) => e.preventDefault(),
        };
    };

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

        // Improve deduplication: 
        // 1. Filter out local blobs that have the same ID as any server blob
        // 2. Filter out local 'optimistic' blobs if they match a server blob's note/content (avoid dupes after sync)
        const localBlobs = (currentIsToday ? todayBlobs : []).filter(tb => {
            const tbNote = (tb.note || "").trim();
            // Check ID collision
            const hasIdCollision = serverBlobs.some(sb => String(sb.id) === String(tb.id));
            if (hasIdCollision) return false;

            // Check content duplication for optimistic blobs
            if (tb.isOptimistic) {
                const hasContentDuplicate = serverBlobs.some(sb => (sb.note || "").trim() === tbNote);
                if (hasContentDuplicate) return false;
            }
            return true;
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
                // Server state is truth, but we overlay discussedIds for zero-latency UX.
                isDiscussed: !!b.isDiscussed || discussedIds.has(String(b.id))
            }))
        };
    }, [dailyData, todayBlobs, currentIsToday, discussedIds]);

    const hasShownFirstBlobCongratsRef = useRef(localStorage.getItem('mochi_first_blob_congrats') === 'true');

    // --- First Fragment Congrats Logic (Centralized) ---
    useEffect(() => {
        // Trigger if:
        // 1. Logged in
        // 2. Haven't shown it before
        // 3. User has at least one blob today
        // 4. User has no historical data (excluding today in the timeline)
        if (isLoggedIn && !hasShownFirstBlobCongratsRef.current && (currentData.blobs || []).length > 0) {
            // Check if there is any historical data on other days
            const hasHistory = timeline.some(item => item.id !== 'today' && item.hasData);

            if (!hasHistory) {
                console.log('[App] First fragment detected! Triggering celebratory popup.');
                hasShownFirstBlobCongratsRef.current = true;
                localStorage.setItem('mochi_first_blob_congrats', 'true');

                // Show after a short delay for better UX (let the blob fall first)
                const timer = setTimeout(() => {
                    setShowTooltip(true);
                }, 4000);
                return () => clearTimeout(timer);
            }
        }
    }, [isLoggedIn, currentData.blobs.length, timeline.length]);

    // Fix: Check the computed blobs (currentData.blobs) instead of just local todayBlobs
    // This ensures that if we have server data for today, we don't show the empty slate.
    const isHeaderEmpty = selectedDate === 'today' && currentData.blobs.length === 0;
    const headerEmoji = isHeaderEmpty ? '\u2728' : currentData.emoji;
    const headerStatusIcon = <Sparkles size={14} />;

    // Prioritize Backend Gradient > Emoji Fallback (Direct string mapping)
    const categoryGradient = HEADER_GRADIENTS[currentData.moodCategory];
    const emojiGradient = EMOTION_COLORS[headerEmoji] || EMOTION_COLORS['default'];

    const headerBg = categoryGradient || emojiGradient;

    // Show skeleton if data is missing OR if we are actively evaluating the day's content
    const showHeaderSkeleton = !dailyData || isEvaluating;

    const headerStatusContent = showHeaderSkeleton ? (
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

    const chatEndRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inactivityTimerRef = useRef(null);
    const shouldAutoScrollRef = useRef(true); // Control auto-scroll behavior
    const isAnyTypewriterActiveRef = useRef(false); // Global flag for scroll behavior sync
    const activeTaskRef = useRef(0); // Sequence number for the current active chat task
    const isProcessingRef = useRef(false); // Synchronous lock for handleSendMessage

    // --- 不活跃检测 (10分钟自动结项) ---
    const resetInactivityTimer = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

        // 仅在聊天页面、且有未关闭的会话时计时
        if (currentPage === 'chat' && chatSessions.length > 0) {
            const lastSession = chatSessions[chatSessions.length - 1];
            if (lastSession && !lastSession.is_ended) {
                inactivityTimerRef.current = setTimeout(() => {
                    console.log('[Inactivity] 10分钟未操作，自动结项');
                    handleEndSession();
                }, 10 * 60 * 1000); // 10分钟
            }
        }
    };

    // 每次会话更新、输入变化或切换回聊天页时重置计时
    useEffect(() => {
        resetInactivityTimer();
        return () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, [chatSessions, currentPage, chatInput, isVoiceActive]);

    // Initial History Load
    useEffect(() => {
        if (currentPage === 'chat' && chatSessions.length === 0) {
            const loadInitial = async () => {
                setIsLoadingHistory(true);
                try {
                    const data = await api.fetchChatSessions(10, null);
                    if (data && data.sessions && data.sessions.length > 0) {
                        console.log(`[App] Initial sessions loaded: ${data.sessions.length}. Fetching messages...`);
                        // Populate each session with its messages
                        const sessionsWithMessages = await Promise.all(data.sessions.map(async (s) => {
                            try {
                                const msgs = await api.fetchSessionMessages(s.id);
                                return { ...s, messages: Array.isArray(msgs) ? msgs : [] };
                            } catch (err) {
                                console.error(`Failed to load messages for session ${s.id}`, err);
                                return { ...s, messages: [] };
                            }
                        }));

                        setChatSessions(prev => {
                            // Merge and de-duplicate by ID
                            const existingIds = new Set(prev.map(s => s.id));
                            const newHistory = sessionsWithMessages.filter(s => !existingIds.has(s.id));

                            // Combine and enforce chronological sort
                            return sortSessionsChronological([...prev, ...newHistory]);
                        });
                    }
                } catch (e) {
                    console.error("Failed to load initial history", e);
                } finally {
                    setIsLoadingHistory(false);
                    setIsInitialHistoryLoaded(true);
                }
            };
            loadInitial();
        }
    }, [currentPage /* run once when page becomes chat */]);

    // Auto-scroll to bottom when chat opens or sessions change
    useEffect(() => {
        if (currentPage === 'chat') {
            const scrollToBottom = (behavior = 'smooth') => {
                // Dual strategy for cross-browser reliability
                messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
                if (chatEndRef.current) {
                    chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                    // Some mobile browsers need multiple attempts if content is still rendering
                }
            };

            // Skip auto-scroll ONLY if specifically flagged by history loading
            if (!shouldAutoScrollRef.current) {
                console.log('[App] Auto-scroll skipped (history loading)');
                shouldAutoScrollRef.current = true; // Reset for next time
                return;
            }

            // If we are typing or typewriter is active, use 'auto' (instant) for better performance and sync
            const behavior = isTyping || isAnyTypewriterActiveRef.current ? 'auto' : 'smooth';

            // Attempt 1: Fast (50ms)
            const t1 = setTimeout(() => scrollToBottom(behavior), 50);

            // Attempt 2: Late (150ms) - Covers cases where dynamic bubbles render slightly late
            const t2 = setTimeout(() => scrollToBottom(behavior), 150);

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }
    }, [currentPage, chatSessions, isTyping]); // Also trigger on typing state change

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
                const beforeTime = oldestSession?.created_at;

                // Fetch older sessions
                const data = await api.fetchChatSessions(10, beforeTime);

                if (data.sessions && data.sessions.length > 0) {
                    console.log(`[App] Loaded ${data.sessions.length} more sessions. Fetching messages...`);
                    // Populate each new session with its messages
                    const sessionsWithMessages = await Promise.all(data.sessions.map(async (s) => {
                        try {
                            const msgs = await api.fetchSessionMessages(s.id);
                            return { ...s, messages: Array.isArray(msgs) ? msgs : [] };
                        } catch (err) {
                            console.error(`Failed to load messages for session ${s.id}`, err);
                            return { ...s, messages: [] };
                        }
                    }));
                    // Prepend new sessions (reverse because backend returns Newest First, and we want Oldest at index 0)
                    setChatSessions(prev => {
                        const existingIds = new Set(prev.map(s => s.id));
                        const newHistory = sessionsWithMessages.filter(s => !existingIds.has(s.id));
                        return sortSessionsChronological([...prev, ...newHistory]);
                    });

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

    const startNewSession = async (initialMessages = [], relatedBlobId = null) => {
        try {
            // 1. Call API to create a real session with optional blob association
            const sessionData = await api.createChatSession(relatedBlobId ? [relatedBlobId] : []);
            const realSessionId = sessionData.id;
            const now = new Date();

            // 2. Auto-close previous active session if exists
            setChatSessions(prev => {
                const now = new Date().toISOString();
                // 2. Identify and end orphans in background
                const orphans = prev.filter(s => !s.is_ended);
                setTimeout(() => {
                    orphans.forEach(o => performEndSession(o.id));
                }, 0);

                const updatedPrev = prev.map(s => s.is_ended ? s : {
                    ...s,
                    is_ended: true,
                    updated_at: now,
                    is_generating_card: true,
                    end_card_text: ''
                });

                // Create the new session object based on API data
                const newSession = {
                    ...sessionData,
                    messages: initialMessages.map(m => ({
                        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        chat_session_id: realSessionId,
                        type: m.type,
                        content: m.content,
                        created_at: m.created_at || now
                    }))
                };

                return sortSessionsChronological([...updatedPrev, newSession]);
            });

            return realSessionId;
        } catch (err) {
            console.error('[App] Failed to start new session:', err);
            // Fallback or error UI could be added here
        }
    };

    // 切换到对话页时的自动引导 (Proactive Greeting) - 仅在没有历史记录时触发
    useEffect(() => {
        if (currentPage === 'chat' && isInitialHistoryLoaded && chatSessions.length === 0 && !pendingDiscussion) {
            // 稍作延迟，等页面切入动画完成
            const timer = setTimeout(() => {
                // Final check via ref AND state to avoid race
                if (chatSessionsCountRef.current === 0 && !isTyping) {
                    console.log('[App] Proactive greeting triggered');
                    startNewSession([
                        { type: 'ai', content: '嗨！我是 Mochi。在这个安静的空间里，我会一直陪着你。今天过得怎么样？' }
                    ]);
                }
            }, 1000); // Slightly more delay to allow history to settle
            return () => clearTimeout(timer);
        }
    }, [currentPage, isInitialHistoryLoaded, chatSessions.length, pendingDiscussion, isTyping]);

    const handleSendMessage = async (overrideText = null, overrideBlobId = null) => {
        if (isProcessingRef.current) {
            console.log('[App] handleSendMessage IGNORED (Lock Active)');
            return;
        }
        isProcessingRef.current = true;
        console.log('[App] handleSendMessage START');

        const textValue = (typeof overrideText === 'string') ? overrideText : chatInput;
        if (!textValue.trim()) {
            isProcessingRef.current = false;
            return;
        }

        // Identify currently active session (Newest-Last)
        let activeSession = [...chatSessions].reverse().find(s => !s.is_ended);

        // STALE SESSION GUARD: If session is from a previous day, treat it as ended
        if (activeSession) {
            const isToday = isDateToday(activeSession.created_at);
            if (!isToday) {
                console.log('[App] Active session is stale (previous day). Forcing new session.');
                activeSession = null; // This will trigger lazy creation below
            }
        }

        const now = new Date().toISOString();
        const userMsg = {
            id: `msg_user_${Date.now()}`,
            chat_session_id: activeSession?.id || 'pending',
            type: 'user',
            content: textValue,
            created_at: now
        };

        // 1. Lazy Creation: If no active session exists OR we're discussing a specific blob
        if (!activeSession || overrideBlobId) {
            console.log('[App] Creating session for message:', overrideBlobId ? `discussion (id: ${overrideBlobId})` : 'lazy');
            try {
                setIsTyping(true); // Visual feedback while creating session
                const sessionData = await api.createChatSession(overrideBlobId ? [overrideBlobId] : []);

                // CRITICAL: Ensure overrideBlobId is in the local object even if backend didn't echo it back
                activeSession = {
                    ...sessionData,
                    messages: [],
                    emotion_blob_ids: overrideBlobId
                        ? [...new Set([...(sessionData.emotion_blob_ids || []), overrideBlobId])]
                        : (sessionData.emotion_blob_ids || [])
                };

                setChatSessions(prev => {
                    const mutexNow = new Date().toISOString();
                    // 2. Identify and end orphans directly in state update for consistency
                    const orphans = prev.filter(s => !s.is_ended);
                    if (orphans.length > 0) {
                        console.log(`[App] Cleaning up ${orphans.length} orphan sessions`);
                        // Fire-and-forget API calls
                        setTimeout(() => {
                            orphans.forEach(o => performEndSession(o.id));
                        }, 0);
                    }

                    const updatedPrev = prev.map(s => s.is_ended ? s : {
                        ...s,
                        is_ended: true,
                        updated_at: mutexNow,
                        is_generating_card: true,
                        end_card_text: ''
                    });

                    // Update the message's session ID since we just created it
                    const finalUserMsg = { ...userMsg, chat_session_id: activeSession.id };

                    return sortSessionsChronological([...updatedPrev, { ...activeSession, messages: [finalUserMsg] }]);
                });

                console.log('[App] New session created and message added:', activeSession.id);
            } catch (err) {
                console.error('[App] Failed to create session:', err);
                setIsTyping(false);
                return;
            }
        } else {
            // 2. Existing Session: Add User Message
            setChatSessions(prev => {
                const mutexNow = new Date().toISOString();
                // Match the ID and add message, while also forcing end on any OTHER orphans
                const updated = prev.map(s => {
                    if (String(s.id) === String(activeSession.id)) {
                        const finalUserMsg = { ...userMsg, chat_session_id: s.id };
                        return { ...s, messages: [...(s.messages || []), finalUserMsg] };
                    }
                    if (!s.is_ended) {
                        return { ...s, is_ended: true, updated_at: mutexNow };
                    }
                    return s;
                });
                return sortSessionsChronological(updated);
            });
        }

        const currentInput = textValue; // Capture current input
        if (typeof overrideText !== 'string') setChatInput('');
        setIsTyping(true); // Maintain typing indicator for connection

        // Unique ID for this specific task execution (to manage isTyping safely)
        const myTaskId = ++activeTaskRef.current;

        // Message-isolated typewriter state
        let myCharQueue = [];
        let isMyTypewriterPlaying = false;
        let streamDone = false;
        let lastReceivedFullText = "";

        const safeSetIsTyping = (val) => {
            if (activeTaskRef.current === myTaskId) {
                setIsTyping(val);
            }
        };

        try {
            // 3. Prepare for Stream: unique ID for this AI response
            const aiMsgId = `msg_ai_${Date.now()}_stream`;
            // CRITICAL: Capture session ID to avoid stale closure
            const targetSessionId = activeSession.id;
            console.log(`[App] Starting stream task ${myTaskId} for session: ${targetSessionId}`);

            const processQueue = async () => {
                if (isMyTypewriterPlaying) return;
                isMyTypewriterPlaying = true;
                isAnyTypewriterActiveRef.current = true;

                while (true) {
                    // Stop if a new task has superseded this one
                    if (activeTaskRef.current !== myTaskId && streamDone && myCharQueue.length === 0) {
                        break;
                    }

                    if (myCharQueue.length > 0) {
                        // If queue is getting long, take more characters at once to catch up
                        const burstSize = myCharQueue.length > 50 ? 5 : (myCharQueue.length > 10 ? 2 : 1);
                        const chars = myCharQueue.splice(0, burstSize).join('');

                        setChatSessions(prev => {
                            const updated = prev.map(s => {
                                // Robust ID comparison: session ID can be string or number from different sources
                                if (String(s.id) !== String(targetSessionId)) return s;

                                const msgs = [...(s.messages || [])];
                                const idx = msgs.findIndex(m => m.id === aiMsgId);
                                if (idx === -1) {
                                    console.log(`[App] Task ${myTaskId}: FIRST CHUNK received. Creating message ${aiMsgId} in session ${s.id}`);
                                    safeSetIsTyping(false); // Hide global typing indicator once we have a bubble
                                    msgs.push({
                                        id: aiMsgId,
                                        chat_session_id: s.id,
                                        type: 'ai',
                                        content: chars,
                                        created_at: new Date().toISOString()
                                    });
                                } else {
                                    msgs[idx] = { ...msgs[idx], content: msgs[idx].content + chars };
                                }
                                return { ...s, messages: msgs };
                            });

                            // Diagnostic: if no session matched, log it
                            if (!updated.some(s => String(s.id) === String(targetSessionId))) {
                                console.warn(`[App] Task ${myTaskId}: Typewriter FAILED to find session ${targetSessionId} to append content.`);
                            }

                            return updated;
                        });

                        // Adaptive delay
                        const delay = myCharQueue.length > 20 ? 10 : 30;
                        await new Promise(r => setTimeout(r, delay));
                    } else if (streamDone) {
                        break;
                    } else {
                        await new Promise(r => setTimeout(r, 100));
                    }
                }
                isMyTypewriterPlaying = false;
                if (activeTaskRef.current === myTaskId) isAnyTypewriterActiveRef.current = false;
                safeSetIsTyping(false);
            };

            // Start processing queue
            processQueue();

            await api.streamChat(targetSessionId, currentInput, activeSession.emotion_blob_ids || [], (newContent) => {
                console.log(`[App] Task ${myTaskId} Received Chunk:`, newContent);
                // Determine if this is a delta or a full rewrite
                let delta = "";
                if (newContent.startsWith(lastReceivedFullText)) {
                    delta = newContent.slice(lastReceivedFullText.length);
                } else {
                    // Backend is sending deltas directly (most common)
                    delta = newContent;
                }
                lastReceivedFullText = newContent; // For next check

                if (delta) {
                    myCharQueue.push(...Array.from(delta));
                    if (!isMyTypewriterPlaying) processQueue();
                }
            });
            streamDone = true;
        } catch (err) {
            console.error(`Streaming task ${myTaskId} failed:`, err);
            safeSetIsTyping(false);
            isMyTypewriterPlaying = false;
            if (activeTaskRef.current === myTaskId) isAnyTypewriterActiveRef.current = false;
        } finally {
            console.log(`[App] Task ${myTaskId} END`);
            isProcessingRef.current = false;
        }
    };

    // Auto-trigger discussion when arriving from home with a specific blob
    useEffect(() => {
        if (currentPage === 'chat' && pendingDiscussion && isInitialHistoryLoaded) {
            const { id, note } = pendingDiscussion;
            console.log('[App] Auto-triggering discussion for blob:', id);
            setPendingDiscussion(null); // Clear to prevent loops

            // Optimistically update the discussed state in dailyData
            if (dailyData?.blobs) {
                setDailyData(prev => ({
                    ...prev,
                    blobs: prev.blobs.map(b => b.id === id ? { ...b, isDiscussed: true } : b)
                }));
            }

            // Small delay to ensure any layout transitions have settled
            setTimeout(() => {
                handleSendMessage(`我想聊聊“${note}”这件事儿`, id);
            }, 300);
        }
    }, [currentPage, pendingDiscussion, isInitialHistoryLoaded]);


    const requestEventMemoryExtraction = (session) => {
        // TODO: replace with real API call to extract event memory
        console.log('[event-memory] extract after session end', session);
    };

    const performEndSession = async (sessionId) => {
        if (!sessionId) return;

        // Mark as ended locally first if not already
        setChatSessions(prev => prev.map(s => {
            if (s.id !== sessionId || s.is_ended) return s;
            return {
                ...s,
                is_ended: true,
                updated_at: new Date().toISOString(),
                is_generating_card: true,
                end_card_text: ''
            };
        }));

        try {
            const res = await api.endChatSession(sessionId);
            setChatSessions(prev => prev.map(s => {
                if (s.id !== sessionId) return s;
                return {
                    ...s,
                    is_ended: true,
                    is_generating_card: false,
                    end_card_text: res.text || '',
                    end_card_mode: res.mode,
                    updated_at: new Date().toISOString()
                };
            }));
        } catch (error) {
            console.error('[App] Failed to end session:', sessionId, error);
            setChatSessions(prev => prev.map(s => {
                if (s.id !== sessionId) return s;
                return { ...s, is_generating_card: false };
            }));
        }
    };

    const handleEndSession = () => {
        const lastSession = [...chatSessions].reverse().find(s => !s.is_ended);
        if (lastSession) performEndSession(lastSession.id);
    };



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

    // Auto-clear 'new' highlight when leaving 'home'
    useEffect(() => {
        if (currentPage !== 'home') {
            setNewBlobIds(new Set()); // Clear all highlights locally
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

                        // Immediately fetch updated Eval/Status (covers "First Blob" case)
                        api.fetchDailyStatus('today').then(data => {
                            console.log('[App] Refreshed daily status with new Eval');
                            setDailyData(data);
                        });
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
        } else {
            setOnboardingStep(2);
            setOnboardingInput('');
            localStorage.setItem('mochi_onboarded', 'true'); // Persist onboarding state
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
                                        api.reportLogin(); // 埋点：上报登录
                                        // Check local storage first (trusted on this device), then backend
                                        const hasOnboarded = localStorage.getItem('mochi_onboarded') === 'true';

                                        // Consider new ONLY if backend says so AND we haven't onboarded locally
                                        // This prevents loop if backend is flaky but user has used app on this device
                                        const isTrulyNew = result.isNewUser && !hasOnboarded;

                                        setOnboardingStep(isTrulyNew ? 0 : 2);
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
                                        {showHeaderSkeleton ? (
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
                                    {...(selectedDate === 'today' ? micHandlers('onboarding', { mode: 'long-press', freshStart: true, onStop: () => setOnboardingStep(1) }) : {})}
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
                                    // Use updated_at if ended, otherwise created_at
                                    const sessionTime = session.is_ended ? session.updated_at : session.created_at;
                                    const isHistory = !isDateToday(sessionTime);

                                    return (
                                        <div
                                            key={session.id}
                                            style={{
                                                marginBottom: '30px',
                                                opacity: isHistory ? 0.6 : 1,
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            <div style={{ textAlign: 'center', margin: '20px 0', opacity: 0.8 }}>
                                                <p style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>{formatToSessionTime(session.created_at)}</p>
                                            </div>
                                            {(session.messages || []).map((msg) => (
                                                <div key={msg.id} className={`chat-bubble ${msg.type}`}>
                                                    {/* Markdown-like rendering for bold and newlines */}
                                                    {(() => {
                                                        if (!msg.content) return null;
                                                        return msg.content.split('\n').map((line, lineIdx) => (
                                                            <div key={lineIdx} style={{ minHeight: line.trim() === '' ? '10px' : 'auto' }}>
                                                                {line.split(/(\*\*.*?\*\*)/g).map((part, partIdx) => {
                                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                                        return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                                                                    }
                                                                    return part;
                                                                })}
                                                            </div>
                                                        ));
                                                    })()}
                                                    <span style={{ fontSize: '10px', opacity: 0.6, display: 'block', marginTop: '4px', textAlign: msg.type === 'user' ? 'right' : 'left' }}>
                                                        {formatToHHmm(msg.created_at)}
                                                    </span>
                                                </div>
                                            ))}
                                            {session.is_ended && (session.messages || []).some(m => m.type === 'user') && (
                                                <div>
                                                    <div className="saved-indicator" style={{ marginBottom: '0', marginTop: '16px' }}>
                                                        <div className="dot" />
                                                        <span>{`已封存于 ${formatToSessionTime(session.updated_at)}`}</span>
                                                    </div>

                                                    {session.is_generating_card ? (
                                                        <div className="session-end-card" style={{ flexShrink: 0, marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '46px' }}>
                                                            <span style={{ fontSize: '13px', color: '#9CA3AF' }}>回顾一下我们的对话</span>
                                                            <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                                                                <div className="animate-bounce" style={{ width: '4px', height: '4px', background: '#9CA3AF', borderRadius: '50%', animationDelay: '0s' }} />
                                                                <div className="animate-bounce" style={{ width: '4px', height: '4px', background: '#9CA3AF', borderRadius: '50%', animationDelay: '0.15s' }} />
                                                                <div className="animate-bounce" style={{ width: '4px', height: '4px', background: '#9CA3AF', borderRadius: '50%', animationDelay: '0.3s' }} />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="session-end-card" style={{ flexShrink: 0, marginTop: '12px' }}>
                                                            <div className="end-card-shine" />
                                                            <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.6', marginBottom: '0' }}>
                                                                {(session.end_card_text && session.end_card_text.length > 0)
                                                                    ? session.end_card_text
                                                                    : (session.summary || "这次对话已经封存。Mochi 会一直在这儿陪着你。")}
                                                            </p>
                                                        </div>
                                                    )}
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

                            {/* "今天到这儿" Button - Enabled only when an active session exists and Mochi is silent */}
                            {(() => {
                                const currentActive = [...chatSessions].reverse().find(s => !s.is_ended);
                                const isDisabled = !currentActive || isTyping;

                                return (
                                    <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '8px 20px', zIndex: 40 }}>
                                        <button
                                            onClick={() => !isDisabled && handleEndSession()}
                                            disabled={isDisabled}
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: '16px',
                                                border: 'none',
                                                background: isDisabled
                                                    ? 'transparent'
                                                    : 'rgba(0, 0, 0, 0.03)',
                                                color: isDisabled ? 'transparent' : '#9CA3AF',
                                                fontSize: '12.5px',
                                                fontWeight: 400,
                                                letterSpacing: '0.2px',
                                                boxShadow: 'none',
                                                cursor: isDisabled ? 'default' : 'pointer',
                                                transition: 'all 0.2s ease',
                                                opacity: isDisabled ? 0 : 1,
                                                pointerEvents: isDisabled ? 'none' : 'auto'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (isDisabled) return;
                                                e.target.style.background = 'rgba(0, 0, 0, 0.06)';
                                                e.target.style.color = '#6B7280';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (isDisabled) return;
                                                e.target.style.background = 'rgba(0, 0, 0, 0.03)';
                                                e.target.style.color = '#9CA3AF';
                                            }}
                                        >
                                            {"✨ 先聊到这儿"}
                                        </button>
                                    </div>
                                );
                            })()}

                            {/* Input Container */}
                            <div className={`chat-input-container ${isTyping ? 'disabled' : ''}`}>
                                <div
                                    className={`voice-trigger chat ${(isVoiceActive && voiceContext === 'chat') ? 'recording' : ''} ${isTyping ? 'disabled' : ''}`}
                                    {...(!isTyping ? micHandlers('chat') : {})}
                                >
                                    <Mic size={20} />
                                </div>
                                <input
                                    placeholder={isTyping ? "Mochi 正在回复..." : "分享你的感受..."}
                                    value={chatInput}
                                    disabled={isTyping}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !isTyping) handleSendMessage();
                                    }}
                                />
                                <button
                                    className={`send-button ${isTyping ? 'disabled' : ''}`}
                                    onClick={() => !isTyping && handleSendMessage()}
                                    disabled={isTyping}
                                >
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

                            <button
                                onClick={() => {
                                    if (window.confirm('确定要清理缓存并更新 App 吗？将会重新加载页面。')) {
                                        localStorage.clear();
                                        sessionStorage.clear();
                                        window.location.reload(true);
                                    }
                                }}
                                style={{
                                    width: 'calc(100% - 40px)',
                                    margin: '12px 20px 32px 20px',
                                    padding: '16px',
                                    borderRadius: '16px',
                                    border: '1px solid #FECACA',
                                    background: '#FEF2F2',
                                    color: '#EF4444',
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                获取最新 app 更新
                            </button>
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
                                        onClick={async () => {
                                            const blobToDiscuss = { id: selectedBlob.id, note: selectedBlob.note };
                                            // Set pending discussion to trigger auto-send on chat page
                                            setPendingDiscussion(blobToDiscuss);
                                            // Optimistic UI update for the discussed state
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
                                            { type: 'user', content: `我想聊聊“${latestBlob.note}”这件事儿` },
                                            { type: 'ai', content: '我在听。感觉这个瞬间对你很重要呢，想再多分享一点吗？' }
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
                                    <button
                                        className="action-btn secondary"
                                        disabled={true}
                                        onClick={() => {
                                            setShowReportDrawer(false);
                                            setCurrentPage('chat');
                                            startNewSession([{ type: 'user', content: '想听听你对我的近期总结' }]);
                                        }}
                                    >
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