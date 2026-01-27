# Mochi AI UI Specification (v1.0)

本文档定义了 Mochi AI 应用程序的设计规范和 UI 组件标准。

## 1. 核心设计原则
*   **温暖与陪伴 (Warmth & Companionship)**: 使用柔和的圆角和粉彩色调。
*   **轻量感 (Lightness)**: 大量使用玻璃拟态 (Glassmorphism) 和阴影来营造层次。
*   **灵动交互 (Playful Interaction)**: 强调物理感交互（如情绪罐头）和丝滑的动画体验。

## 2. 基础规范 (Design Tokens)

### 2.1 色彩系统 (Colors)
| 变量名 | 颜色值 | 用途 |
| :--- | :--- | :--- |
| `--primary` | `#A78BFA` | 主品牌色 (紫色)，用于高亮、按钮、激活态 |
| `--primary-light` | `#F4E6FF` | 背景辅助色，极浅紫 |
| `--secondary` | `#FCA5A5` | 次要品牌色 (粉红)，用于情感表达、渐变 |
| `--accent` | `#F7AC52` | 强调色 (橙色)，用于特殊提醒、提示 |
| `--success` | `#4ADE80` | 成功态，用于设备连接状态 |
| `--text-main` | `#1F2937` | 主要文本色，高对比度 |
| `--text-dim` | `#6B7280` | 次要文本色，低对比度 |
| `--bg-main` | `#FFFFFF` | 卡片及容器主背景 |
| `--bg-body` | `#F3F4F6` | 页面外层背景 (Desktop 模式可见) |

### 2.2 渐变系统 (Gradients)
*   **Home Header**: `linear-gradient(135deg, #F4E6FF 0%, #FDE2E4 50%, #FFE5CF 100%)`
*   **Chat Banner**: `linear-gradient(135deg, #A78BFA 0%, #FCA5A5 100%)`
*   **Primary Button**: `linear-gradient(135deg, #A78BFA, #FCA5A5)`

### 2.3 字体系统 (Typography)
*   **Font Family**: `'Outfit', 'Noto Sans SC', sans-serif`
*   **H1 (Page Title)**: `24px / 600 / #111827`
*   **H2 (Section Header)**: `16px / 600 / #374151`
*   **Body (Main)**: `14px / 400 / #374151`
*   **Caption**: `12px / 400 / #6B7280`
*   **Label (Stat)**: `11px / 400 / #9CA3AF`

### 2.4 圆角系统 (Radius)
*   **Large (Header/Banner)**: `40px`
*   **Medium (Cards/Modals)**: `32px`
*   **Small (Items/Buttons)**: `20px`

## 3. 组件规范 (Components)

### 3.1 底部导航栏 (Bottom Nav)
*   **高度**: 自动适应 (Padding: 8px 24px 20px)
*   **样式**: 85% 白色背景 + 20px 高斯模糊
*   **交互**: 激活态颜色切换至 `--primary`并伴随 1.1x 缩放。

### 3.2 情绪罐头 (Jar Physics)
*   **宽度**: `340px` (固定)
*   **高度**: `280px` (固定)
*   **边框**: `3px solid #2D3748`
*   **材质**: `rgba(255, 255, 255, 0.6)`

### 3.3 聊天气泡 (Chat Bubbles)
*   **AI Bubble**: 白色背景, `#374151` 文本, 24px 圆角
*   **User Bubble**: 主色渐变, 白色文本, 24px 圆角

## 4. 物理反馈 (Animation Specs)
*   **页面切换**: `mode="wait"`, `opacity` & `y-axis` 位移。
*   **弹窗出现**: `scale(0.9) -> scale(1)`, `spring` 效果。
*   **按钮点击**: 移动端 Tap 态优化，移除系统默认高亮。
