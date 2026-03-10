# 大屏可视化 Dashboard 设计与实现规范

---

## 一、项目架构设计

### 1.1 Vite 配置要点

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',   // CSS Modules 类名转驼峰
      generateScopedName: '[name]__[local]__[hash:base64:5]', // 生产环境可缩短为 [hash:base64:8]
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        // 按图表组件做代码分割，避免首屏加载全部 D3 模块
        manualChunks: {
          'd3-core':  ['d3-selection', 'd3-transition', 'd3-scale', 'd3-axis'],
          'd3-geo':   ['d3-geo', 'd3-geo-projection', 'topojson-client'],
          'd3-shape': ['d3-shape', 'd3-hierarchy'],
          'react-vendor': ['react', 'react-dom'],
          'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
        },
      },
    },
    chunkSizeWarningLimit: 300,   // 单 chunk 超 300 KB 报警
  },
  optimizeDeps: {
    include: ['d3-selection', 'd3-scale', 'd3-shape'], // 预构建常用 D3 子包
  },
});
```

D3 v7 已全面 ESM 化，推荐按需导入子包（`d3-scale`、`d3-shape` 等），不要 `import * as d3 from 'd3'`。

### 1.2 React + D3 职责分离原则

核心原则是将「React 负责生命周期与状态」和「D3 负责数据驱动的 DOM 操作」进行职责分离，通过自定义 Hook 做桥接。全局状态（联动筛选、数据缓存等）统一交由 Redux 管理，组件内部的瞬态值（动画中间帧、DOM ref 等）保留在 `useRef` 中，不进入 store。

---

## 二、屏幕适配与布局系统

### 2.1 适配策略对比

| 方案 | 原理 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|----------|
| **scale 等比缩放** | 对根容器做 `transform: scale()` | 还原度最高、实现最简单 | 非设计比例屏幕出现黑边 | 固定比例专用屏 |
| **vw/vh + rem** | 根字号与视口绑定 | 灵活、无黑边 | 极端比例下元素变形 | 多比例屏兼容 |
| **CSS Grid 区域** | `grid-template-areas` 定义语义区域 | 结构清晰、响应式友好 | 需要维护断点 | 企业级 Dashboard |
| **混合方案（推荐）** | scale 做整体缩放 + Grid 做内部布局 | 兼顾还原度与灵活性 | 实现稍复杂 | 生产环境首选 |

### 2.2 推荐混合方案实现

```tsx
// DashboardShell.tsx
import { useEffect, useRef, useState } from 'react';
import styles from './DashboardShell.module.css';

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scaleStyle, setScaleStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const resize = () => {
      const sw = window.innerWidth / DESIGN_WIDTH;
      const sh = window.innerHeight / DESIGN_HEIGHT;
      const scale = Math.min(sw, sh);               // 等比缩放，短边适配
      const translateX = (window.innerWidth - DESIGN_WIDTH * scale) / 2;
      const translateY = (window.innerHeight - DESIGN_HEIGHT * scale) / 2;

      setScaleStyle({
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        transformOrigin: '0 0',
      });
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className={styles.viewport}>
      <div ref={containerRef} style={scaleStyle}>
        {children}
      </div>
    </div>
  );
}
```

```css
/* DashboardShell.module.css */
.viewport {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0a0e27;
}
```

### 2.3 Grid 布局模板

```css
/* DashboardGrid.module.css */
/* 在 1920×1080 的设计坐标系内使用 Grid */
.grid {
  display: grid;
  width: 1920px;
  height: 1080px;
  padding: 16px;
  gap: 12px;
  grid-template-columns: 420px 1fr 420px;
  grid-template-rows: 72px 1fr 200px;
  grid-template-areas:
    "header  header  header"
    "left    center  right"
    "bottom  bottom  bottom";
}

.header  { grid-area: header; }
.left    { grid-area: left; }
.center  { grid-area: center; }
.right   { grid-area: right; }
.bottom  { grid-area: bottom; }
```

在左右面板内部再嵌套垂直方向的 `grid` 或 `flex` 来堆叠多个小图表组件。

---

## 三、可视化组件设计规范

### 3.1 React + D3 集成模式

大屏场景下推荐 **D3 接管 DOM** 模式——React 只提供容器 `<svg>` 或 `<div>`，D3 在 `useEffect` 中完成 selection 与 transition：

```tsx
// widgets/BarRace/useBarRace.ts
import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import 'd3-transition';   // 副作用导入，挂载 selection.transition()

export function useBarRace(
  data: BarItem[],
  { width, height, margin }: Dimensions
) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = select(svgRef.current);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x = scaleLinear()
      .domain([0, Math.max(...data.map(d => d.value))])
      .range([0, innerW]);
    const y = scaleBand()
      .domain(data.map(d => d.name))
      .range([0, innerH])
      .padding(0.2);

    const g = svg
      .selectAll<SVGGElement, null>('g.bindchart')
      .data([null])
      .join('g')
      .attr('class', 'bindchart')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // data join → enter / update / exit
    g.selectAll<SVGRectElement, BarItem>('rect')
      .data(data, d => d.name)
      .join(
        enter => enter.append('rect')
          .attr('y', d => y(d.name)!)
          .attr('height', y.bandwidth())
          .attr('x', 0)
          .attr('width', 0)
          .attr('rx', 4)
          .attr('fill', (_, i) => palette[i % palette.length])
          .call(e => e.transition().duration(800).attr('width', d => x(d.value))),
        update => update
          .call(u => u.transition().duration(600)
            .attr('y', d => y(d.name)!)
            .attr('width', d => x(d.value))),
        exit => exit
          .call(e => e.transition().duration(400).attr('width', 0).remove())
      );
  }, [data, width, height]);

  return svgRef;
}
```

```tsx
// widgets/BarRace/BarRace.tsx
import { useBarRace } from './useBarRace';
import { useContainerSize } from '../../hooks/useContainerSize';
import styles from './BarRace.module.css';

export default function BarRace({ data }: { data: BarItem[] }) {
  const [containerRef, { width, height }] = useContainerSize();
  const svgRef = useBarRace(data, {
    width, height,
    margin: { top: 20, right: 20, bottom: 30, left: 80 },
  });

  return (
    <div ref={containerRef} className={styles.container}>
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
}
```

```css
/* widgets/BarRace/BarRace.module.css */
.container {
  width: 100%;
  height: 100%;
}
```

### 3.2 useContainerSize Hook（响应式尺寸感知）

每个组件不应硬编码尺寸，而是通过 `ResizeObserver` 感知父容器变化：

```ts
// hooks/useContainerSize.ts
import { useRef, useState, useEffect } from 'react';

export function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}
```

### 3.3 组件设计清单

每个 widget 组件必须满足以下要求：

**视觉层面：**

- 标题区：默认显示**图标 + 标题**，图标使用统一的 icon 组件或 SVG symbol 引用，标题字号遵循 `tokens.fontSize.chartTitle`
- 数据为空时展示优雅的占位骨架屏（Skeleton）或"暂无数据"状态
- 色板统一引用全局 palette，不在组件内部硬编码颜色
- 字号使用设计 token，保证整屏文字层级一致
- 深色背景下文字/线条需保证 ≥ 4.5:1 的对比度

**交互层面（按需实现）：**

交互行为不是每个组件的默认要求，仅在业务明确提出时实现。以下为可选能力清单：

| 交互能力 | 说明 | 何时实现 |
|----------|------|----------|
| Hover 高亮 | 鼠标悬浮时当前元素提亮，其余降透明度 | 需要用户关注单条数据细节时 |
| Tooltip | 使用 `TooltipPortal` 全局浮层展示详情 | 数据维度多、标签无法直接显示时 |
| 点击选中 | 通过 Redux dispatch 广播选中项，触发跨视图联动 | 多视图联动场景 |
| Brush 刷选 | 拖拽选择范围，过滤关联图表 | 时间序列或数值范围筛选场景 |
| 动画过渡 | enter 800 ms / update 600 ms / exit 400 ms，easing 统一 `d3.easeCubicOut` | 默认建议开启，纯展示屏可关闭 |

**性能层面：**

- transition 期间不调用 `setState`，避免 React 重绘与 D3 过渡冲突
- 组件使用 `React.memo` 包裹，配合 Redux `useSelector` 精确订阅避免无关重渲染

---

## 四、跨视图交互与联动（Redux 方案）

### 4.1 联动架构

```
┌──────────────────────────────────────────────────────────────┐
│                     Redux Store                               │
│                                                               │
│   dashboardFilter slice                                       │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│   │  timeRange   │  │  category   │  │ brushExtent │         │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│          │                │                │                  │
│          ▼                ▼                ▼                  │
│   ┌───────────────────────────────────────────────┐          │
│   │    selectFilteredData (reselect memoized)      │          │
│   └───────────────────────────────────────────────┘          │
│          │                │                │                  │
│     BarChart          LineChart        ScatterPlot            │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Redux Slice 定义

```ts
// store/dashboardFilterSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface DashboardFilterState {
  timeRange: [number, number] | null;       // Unix ms 时间戳，可序列化
  selectedCategory: string | null;
  brushExtent: [number, number] | null;
  hoveredId: string | null;
}

const initialState: DashboardFilterState = {
  timeRange: null,
  selectedCategory: null,
  brushExtent: null,
  hoveredId: null,
};

const dashboardFilterSlice = createSlice({
  name: 'dashboardFilter',
  initialState,
  reducers: {
    setTimeRange(state, action: PayloadAction<[number, number] | null>) {
      state.timeRange = action.payload;
    },
    setCategory(state, action: PayloadAction<string | null>) {
      state.selectedCategory = action.payload;
    },
    setBrush(state, action: PayloadAction<[number, number] | null>) {
      state.brushExtent = action.payload;
    },
    setHover(state, action: PayloadAction<string | null>) {
      state.hoveredId = action.payload;
    },
    resetFilters() {
      return initialState;
    },
  },
});

export const {
  setTimeRange,
  setCategory,
  setBrush,
  setHover,
  resetFilters,
} = dashboardFilterSlice.actions;

export default dashboardFilterSlice.reducer;
```

### 4.3 Store 配置

```ts
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import dashboardFilterReducer from './dashboardFilterSlice';

export const store = configureStore({
  reducer: {
    dashboardFilter: dashboardFilterReducer,
    // 其他业务 slice ...
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // 关闭序列化检查（如果 timeRange 使用 Date 对象；用 Unix ms 则可保留默认）
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

```ts
// store/hooks.ts
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './index';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### 4.4 Selector 与 Reselect 缓存

使用 `createSelector` 做派生数据的 memoize，避免每次 render 都重新过滤：

```ts
// store/selectors.ts
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './index';

const selectFilter = (state: RootState) => state.dashboardFilter;
const selectRawData = (state: RootState) => state.dashboardData.items; // 假设数据也在 store 中

export const selectFilteredData = createSelector(
  [selectRawData, selectFilter],
  (items, filter) => {
    let result = items;

    if (filter.timeRange) {
      const [start, end] = filter.timeRange;
      result = result.filter(d => d.timestamp >= start && d.timestamp <= end);
    }
    if (filter.selectedCategory) {
      result = result.filter(d => d.category === filter.selectedCategory);
    }
    if (filter.brushExtent) {
      const [lo, hi] = filter.brushExtent;
      result = result.filter(d => d.value >= lo && d.value <= hi);
    }

    return result;
  }
);

export const selectHoveredId = (state: RootState) => state.dashboardFilter.hoveredId;
```

### 4.5 组件内使用联动

```tsx
// 某图表组件内
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectFilteredData, selectHoveredId } from '../../store/selectors';
import { setCategory, setHover } from '../../store/dashboardFilterSlice';

function SomeChart() {
  const dispatch = useAppDispatch();
  const data = useAppSelector(selectFilteredData);
  const hoveredId = useAppSelector(selectHoveredId);

  // D3 绑定中使用
  // .on('click', (_, d) => dispatch(setCategory(d.category)))
  // .on('mouseenter', (_, d) => dispatch(setHover(d.id)))
  // .on('mouseleave', () => dispatch(setHover(null)))
  // .attr('opacity', d => hoveredId && d.id !== hoveredId ? 0.3 : 1)
}
```

### 4.6 联动类型与实现手段

| 联动类型 | 触发动作 | 传递信息 | 实现方式 |
|----------|----------|----------|----------|
| **Hover 高亮联动** | 鼠标移入某元素 | `hoveredId` | dispatch `setHover` → 各图表 `useAppSelector(selectHoveredId)` 做样式切换 |
| **点击选中联动** | 单击某类目/柱 | `selectedCategory` | dispatch `setCategory` → `selectFilteredData` 自动过滤 |
| **Brush 范围联动** | 拖拽刷选区域 | `brushExtent` | D3 Brush 事件 → dispatch `setBrush` → 其他图表通过 selector 裁剪 |
| **时间范围联动** | 拖动时间滑块/选区 | `timeRange` | dispatch `setTimeRange` → 所有时序图表重新过滤 |
| **下钻联动** | 双击某区域 | 路由参数变化 | React Router searchParams + 数据层切换聚合粒度 |

### 4.7 Brush 联动示例

```ts
// interactions/bindBrush.ts
import { brushX, type D3BrushEvent } from 'd3-brush';
import { select } from 'd3-selection';

export function bindBrush(
  svgGroup: SVGGElement,
  xScale: d3.ScaleTime<number, number>,
  width: number,
  height: number,
  onBrush: (extent: [number, number] | null) => void   // Unix ms
) {
  const brush = brushX<unknown>()
    .extent([[0, 0], [width, height]])
    .on('end', (event: D3BrushEvent<unknown>) => {
      if (!event.selection) {
        onBrush(null);
        return;
      }
      const [x0, x1] = event.selection as [number, number];
      onBrush([xScale.invert(x0).getTime(), xScale.invert(x1).getTime()]);
    });

  select(svgGroup).call(brush);
}
```

在组件中调用：

```ts
bindBrush(groupEl, xScale, innerW, innerH, (extent) => {
  dispatch(setTimeRange(extent));
});
```

### 4.8 Tooltip 全局浮层

```tsx
// interactions/TooltipPortal.tsx
import { createPortal } from 'react-dom';
import { useAppSelector } from '../store/hooks';
import { selectHoveredId } from '../store/selectors';
import styles from './TooltipPortal.module.css';

export function TooltipPortal() {
  const hoveredId = useAppSelector(selectHoveredId);
  if (!hoveredId) return null;

  return createPortal(
    <div className={styles.tooltip}>
      {/* 根据 hoveredId 查找数据并渲染内容 */}
    </div>,
    document.body
  );
}
```

```css
/* interactions/TooltipPortal.module.css */
.tooltip {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  background: rgba(22, 27, 64, 0.95);
  border: 1px solid rgba(0, 180, 255, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
```

---

## 五、性能优化策略

### 5.1 React 层面优化

```
┌──────────────────────────────────────────────────────────┐
│                    避免不必要的重渲染                       │
├──────────────────────────────────────────────────────────┤
│ 1. React.memo 包裹每个 widget 组件                       │
│ 2. useMemo 缓存 D3 scale / 过滤后数据                    │
│ 3. useCallback 包裹 dispatch 回调                        │
│ 4. Redux useSelector 精确订阅，避免订阅整个 slice         │
│ 5. useRef 存 D3 selection，不触发 React 更新              │
│ 6. createSelector (Reselect) 做派生数据缓存              │
└──────────────────────────────────────────────────────────┘
```

**精确订阅示例——只订阅自己关心的字段，而非整个 filter 对象：**

```tsx
// ✅ 好：只有 hoveredId 变化时才触发重渲染
const hoveredId = useAppSelector(state => state.dashboardFilter.hoveredId);

// ❌ 差：filter 中任意字段变化都会触发重渲染
const filter = useAppSelector(state => state.dashboardFilter);
```

对于高频 hover 场景的额外优化——如果 hover 导致的重绘仍成为瓶颈，可以将 hover 状态保留在 React Context 或 `useRef` 中，不经过 Redux，以绕过 Redux 的 middleware 与 subscriber 通知链路：

```tsx
// 高频 hover 可用轻量 Context 替代 Redux
const HoverCtx = createContext<{
  hoveredId: string | null;
  setHover: (id: string | null) => void;
}>({ hoveredId: null, setHover: () => {} });
```

### 5.2 数据层优化

| 策略 | 做法 |
|------|------|
| 数据预聚合 | 后端按时间粒度（秒/分/时/日）预计算，前端不做大规模 reduce |
| 增量更新 | WebSocket 推送 diff，前端 merge 到现有数组，而非全量替换 |
| 虚拟化 | 表格型组件使用 `@tanstack/react-virtual`；仅渲染可视行 |
| Worker 计算 | 力导布局、大矩阵运算放入 Web Worker，不阻塞主线程 |
| 数据采样 | 散点图 > 10 K 条时，使用 LTTB 算法降采样到 2000 条 |
| Selector 缓存 | `createSelector` 链式组合，只有上游输入变化时才重新计算 |

### 5.3 动画性能

- 所有 D3 transition 使用 `requestAnimationFrame` 驱动（D3 默认行为）
- 不要在 transition 回调中 `setState` 或 `dispatch`，用 `useRef` 暂存中间值
- CSS transition 优先于 D3 transition，GPU 合成层更高效
- 地图 zoom/pan 使用 `will-change: transform` 提升至合成层
- 定时轮播（如动态排名）用 `setInterval` + D3 transition 配合，间隔 ≥ 2 s

### 5.4 D3 与 Redux 协作注意事项

D3 的 `transition` 和 `brush` / `zoom` 等行为在持续期间内会频繁触发回调。需要注意以下原则：

- **Brush / Zoom 回调节流**：`brush.on('brush', ...)` 会在拖拽每帧触发，应使用 `lodash.throttle` 或在 `on('end', ...)` 中 dispatch，避免每帧更新 store
- **transition 期间不 dispatch**：D3 transition 的中间帧不应触发 Redux action，否则导致 React 重渲染与 D3 动画冲突
- **批量 dispatch**：如果一次操作需要同时更新多个 filter 字段，使用 RTK 的单个 reducer 一次修改多个字段，或者使用 `batch()` 包裹多次 dispatch

---

## 六、主题与视觉规范

### 6.1 设计 Token

```ts
// theme/tokens.ts
export const tokens = {
  // ── 色彩 ──
  bg: {
    primary:   '#0a0e27',    // 主背景（深蓝黑）
    secondary: '#111638',    // 面板背景
    card:      '#161b40',    // 卡片背景
    hover:     '#1c2255',    // 悬浮态
  },
  border: {
    default:   'rgba(255,255,255,0.06)',
    active:    'rgba(0,180,255,0.4)',
  },
  text: {
    primary:   'rgba(255,255,255,0.90)',
    secondary: 'rgba(255,255,255,0.55)',
    muted:     'rgba(255,255,255,0.30)',
  },
  accent: {
    blue:   '#00b4ff',
    cyan:   '#00e5ff',
    green:  '#00e676',
    amber:  '#ffab00',
    red:    '#ff1744',
  },

  // ── 间距 ──
  spacing: {
    xs: 4,  sm: 8,  md: 12,  lg: 16,  xl: 24,  xxl: 32,
  },

  // ── 字号（px，设计稿 1920 基准）──
  fontSize: {
    kpiValue:   48,       // KPI 大数字
    kpiLabel:   14,       // KPI 标签
    chartTitle: 16,       // 图表标题（含图标）
    axisLabel:  12,       // 坐标轴标签
    axisTitle:  13,       // 坐标轴名称
    tooltip:    13,       // Tooltip 正文
    caption:    11,       // 辅助说明
  },

  // ── 圆角 ──
  radius: {
    sm: 4,  md: 8,  lg: 12,  xl: 16,
  },

  // ── 阴影 / 光晕 ──
  glow: {
    blue: '0 0 12px rgba(0,180,255,0.25)',
    card: '0 2px 8px rgba(0,0,0,0.4)',
  },
};
```

将 token 注入 CSS Modules 可使用的 CSS 变量，在入口样式中定义：

```css
/* styles/variables.css 或 global.css 中 :root 声明 */
:root {
  --bg-primary: #0a0e27;
  --bg-secondary: #111638;
  --bg-card: #161b40;
  --border-default: rgba(255,255,255,0.06);
  --border-active: rgba(0,180,255,0.4);
  --text-primary: rgba(255,255,255,0.90);
  --text-secondary: rgba(255,255,255,0.55);
  --accent-blue: #00b4ff;
  --accent-cyan: #00e5ff;
  --font-chart-title: 16px;
  --font-axis-label: 12px;
  --radius-md: 8px;
  --glow-card: 0 2px 8px rgba(0,0,0,0.4);
}
```

### 6.2 色板与 D3 色阶

```ts
// theme/scales.ts
import { scaleOrdinal } from 'd3-scale';

// 分类色板（最多 10 色）
export const categoryPalette = [
  '#00b4ff', '#00e676', '#ffab00', '#ff1744',
  '#7c4dff', '#00e5ff', '#ff6d00', '#d500f9',
  '#76ff03', '#f50057',
];

export const categoryScale = scaleOrdinal<string>().range(categoryPalette);

// 连续色板（蓝绿渐变）
export const sequentialPalette = ['#0a0e27', '#0d47a1', '#00b4ff', '#00e5ff', '#e0f7fa'];
```

### 6.3 面板与边框装饰（CSS Modules 写法）

```css
/* components/Panel.module.css */
.panel {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--glow-card);
  position: relative;
  overflow: hidden;
}

/* 四角装饰线 */
.panel::before,
.panel::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: var(--accent-cyan);
  border-style: solid;
}
.panel::before {
  top: -1px;
  left: -1px;
  border-width: 2px 0 0 2px;
}
.panel::after {
  bottom: -1px;
  right: -1px;
  border-width: 0 2px 2px 0;
}
```

### 6.4 图表标题组件

每个 widget 默认包含带图标的标题栏：

```tsx
// components/WidgetHeader.tsx
import styles from './WidgetHeader.module.css';

interface WidgetHeaderProps {
  icon: React.ReactNode;     // SVG 图标或 icon 组件
  title: string;
  extra?: React.ReactNode;   // 右侧附加内容（单位/时间范围等），可选
}

export default function WidgetHeader({ icon, title, extra }: WidgetHeaderProps) {
  return (
    <div className={styles.header}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.title}>{title}</span>
      {extra && <span className={styles.extra}>{extra}</span>}
    </div>
  );
}
```

```css
/* components/WidgetHeader.module.css */
.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 0 8px 0;
  border-bottom: 1px solid var(--border-default);
  margin-bottom: 8px;
}

.icon {
  display: flex;
  align-items: center;
  color: var(--accent-blue);
  font-size: 18px;
  flex-shrink: 0;
}

.title {
  font-size: var(--font-chart-title);
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.extra {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
```

---

## 七、数据接入与实时更新

### 7.1 数据获取模式

```tsx
// hooks/useDataFetch.ts
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDashboardData(endpoint: string, refreshInterval = 30_000) {
  const { data, error, isLoading, mutate } = useSWR(endpoint, fetcher, {
    refreshInterval,          // 轮询间隔
    dedupingInterval: 5000,   // 去重窗口
    revalidateOnFocus: false, // 大屏无焦点切换
  });

  return { data, error, isLoading, refresh: mutate };
}
```

数据拉取后可通过 `dispatch` 存入 Redux store，供各组件的 selector 消费：

```ts
const { data } = useDashboardData('/api/dashboard');

useEffect(() => {
  if (data) {
    dispatch(setDashboardData(data));
  }
}, [data, dispatch]);
```

### 7.2 WebSocket 增量推送

```ts
// hooks/useRealtimeStream.ts
import { useEffect, useRef, useCallback } from 'react';

export function useRealtimeStream<T>(
  url: string,
  onMessage: (patch: T) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const patch = JSON.parse(e.data) as T;
      onMessage(patch);
    };

    ws.onclose = () => {
      reconnectTimer.current = setTimeout(connect, 3000); // 自动重连
    };
  }, [url, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimer.current);
    };
  }, [connect]);
}
```

---

## 八、地图组件专项

### 8.1 地图渲染选型

| 方案 | 适用 | 特点 |
|------|------|------|
| D3 + SVG | 行政区划色彩映射 | 与其他 D3 图表风格统一 |
| D3 + Canvas | 热力图 / 大量标注点 | 性能更优 |
| Mapbox GL JS | 交互式瓦片地图 | 3D、街道级细节 |
| deck.gl | 海量轨迹 / 粒子 | GPU 加速 |

### 8.2 D3 地图核心实现

```ts
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

// 使用 TopoJSON 减小文件体积（相比 GeoJSON 减少 80%+）
const projection = geoMercator()
  .center([104.0, 35.5])     // 中国中心
  .scale(800)
  .translate([width / 2, height / 2]);

const pathGenerator = geoPath().projection(projection);

// 绑定省份路径
svg.selectAll('path.bindprovince')
  .data(provinces.features)
  .join('path')
  .attr('class', 'bindprovince')
  .attr('d', pathGenerator)
  .attr('fill', d => colorScale(dataMap.get(d.properties.name) ?? 0))
  .attr('stroke', 'rgba(0,180,255,0.3)')
  .attr('stroke-width', 0.5);
```

### 8.3 地理数据优化

- 使用 `topojson-simplify` 做几何简化，在大屏分辨率下 quantization 设为 1e5 即可
- 中国省界 TopoJSON 文件控制在 300 KB 以内
- 地图数据在 Vite 中作为静态 JSON 引入，开启 gzip 压缩后约 80 KB

---

## 九、无障碍与容错

### 9.1 无障碍（A11y）

虽然大屏通常不直接面向键盘/读屏器用户，但良好的语义化有助于测试和维护：

- SVG 图表为根 `<svg>` 添加 `role="img"` 和 `aria-label="图表描述"`
- KPI 数字使用 `aria-live="polite"` 让读屏器感知数值变化
- 色彩编码同时使用纹理/形状差异做冗余编码（色盲友好）

### 9.2 异常状态设计

每个组件需处理三种异常状态：

- **Loading**：骨架屏（带脉冲动画的灰色占位块）
- **Empty**：居中图标 + "暂无数据" 提示文案
- **Error**：居中警告图标 + 错误摘要 + 重试按钮

```tsx
// components/WidgetWrapper.tsx
import styles from './WidgetWrapper.module.css';

interface WidgetWrapperProps {
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
  children: React.ReactNode;
  onRetry?: () => void;
}

export default function WidgetWrapper({
  isLoading, error, isEmpty, children, onRetry,
}: WidgetWrapperProps) {
  if (isLoading) return <div className={styles.skeleton} />;
  if (error)     return <ErrorState message={error.message} onRetry={onRetry} />;
  if (isEmpty)   return <EmptyState />;
  return <>{children}</>;
}
```

```css
/* components/WidgetWrapper.module.css */
.skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--bg-card) 25%,
    rgba(255,255,255,0.04) 50%,
    var(--bg-card) 75%
  );
  background-size: 200% 100%;
  animation: pulse 1.5s ease-in-out infinite;
  border-radius: var(--radius-md);
}

@keyframes pulse {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 附录 A：常用 D3 子包速查

| 包名 | 用途 | 典型 API |
|------|------|----------|
| `d3-selection` | DOM 操作 | `select`, `selectAll`, `join` |
| `d3-scale` | 比例尺 | `scaleLinear`, `scaleOrdinal`, `scaleTime` |
| `d3-axis` | 坐标轴 | `axisBottom`, `axisLeft` |
| `d3-shape` | 图形生成 | `line`, `area`, `arc`, `pie`, `stack` |
| `d3-transition` | 动画 | `transition`, `duration`, `ease` |
| `d3-brush` | 刷选 | `brushX`, `brushY` |
| `d3-zoom` | 缩放平移 | `zoom`, `zoomIdentity` |
| `d3-geo` | 地理投影 | `geoMercator`, `geoPath` |
| `d3-hierarchy` | 层级数据 | `treemap`, `pack`, `tree` |
| `d3-force` | 力导布局 | `forceSimulation`, `forceLink` |
| `d3-delaunay` | Voronoi/Hit Test | `Delaunay.from` |

## 附录 B：性能检查清单

- [ ] 所有 widget 使用 `React.memo` 包裹
- [ ] D3 scale / 过滤数据用 `useMemo`
- [ ] Redux `useSelector` 精确订阅单个字段，而非整个 slice
- [ ] 高频 hover 酌情使用 Context 或 useRef 替代 Redux
- [ ] `createSelector` 缓存所有派生数据
- [ ] D3 transition 期间无 `setState` / `dispatch`
- [ ] Brush/Zoom 回调使用 `on('end')` 或节流处理
- [ ] 地图 TopoJSON 已简化 + gzip < 100 KB
- [ ] WebSocket 使用增量合并而非全量替换
- [ ] `ResizeObserver` 回调使用 `Math.floor` 避免亚像素抖动
- [ ] 首屏 JS 总量 < 500 KB (gzip)
- [ ] Lighthouse Performance ≥ 90

## 附录 C：联动信号流速查表（Redux 版）

```
用户操作                   Redux Action             消费组件行为
────────────────────────────────────────────────────────────────────
Hover 柱/点/区域     →  setHover(id)            → useSelector(selectHoveredId) 做样式切换
Click 类目/图例      →  setCategory(name)       → selectFilteredData 自动重算
Brush 时间轴         →  setTimeRange([a,b])     → selectFilteredData 裁剪时间域
Brush 数值轴         →  setBrush([x0,x1])       → selectFilteredData 过滤数值
双击下钻             →  URL searchParams        → 数据层切换聚合粒度
Reset 按钮           →  resetFilters()          → 所有过滤器清空，selector 返回全量
```
