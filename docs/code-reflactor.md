# barge-schedule-vis 重构执行计划

> 本文档是逐步执行的任务清单。每个阶段完成后，执行者在对应标题后标注 `✅ 已完成`。
> 每个阶段结尾有 git 操作指引，完成后提交对应的 commit。

---

## 阶段 0：P0 第三方库替换

### 0.1 新增依赖

已安装以下运行时依赖：

| 包名                      | 版本     | 替代目标                               |
| ------------------------- | -------- | -------------------------------------- |
| `@tanstack/react-query`   | ^5.90.21 | 手写 useEffect + fetch 数据获取模式    |
| `@tanstack/react-table`   | ^8.21.3  | 手写 DataTable 排序/过滤/分页逻辑      |
| `@tanstack/react-virtual` | ^3.13.21 | 手写虚拟滚动                           |
| `react-map-gl`            | ^8.1.0   | 手写 MapLibre GL 生命周期管理          |
| `maplibre-gl`             | ^5.19.0  | 通过 script 标签动态注入的 maplibre-gl |

已安装以下开发依赖：`@types/maplibre-gl`

### 0.2 变更文件清单

**新增文件：**

- `src/shared/lib/fetchUtils.ts` — 通用数据获取工具（fetchJson / fetchCsvRows / fetchJsonOptional），供所有 TanStack Query hook 使用
- `src/features/barge-cargo-gantt/components/CargoTablePanel/hooks/useContainerRecords.ts` — CargoTablePanel 的 CSV 数据获取 hook，替代其内嵌的 useEffect 加载逻辑
- `src/features/port-location-map/components/PortLocationMap/mapStyle.config.ts` — 从 PortLocationMap 中抽离的地图样式配置（getThemePalette / buildMapStyle / MAP_DEFAULTS），约 220 行纯配置

**修改文件：**

- `src/app/providers.tsx` — 新增 QueryClientProvider 包裹层（staleTime 5分钟, gcTime 10分钟, retry 1次）
- `src/features/barge-cargo-gantt/components/BargeCargoGanttView/hooks/useBargeCargoGanttData.ts` — 用 useQuery 替代 useEffect+useState 加载模式。所有业务转换函数逻辑完全保留不变，仅将加载壳替换为 queryFn。新增 error 返回字段。
- `src/features/port-cargo-mainline/components/PortCargoByMainlineView/hooks/usePortCargoByMainlineData.ts` — 同上模式替换。所有业务转换函数逻辑不变。
- `src/features/barge-cargo-gantt/components/CargoTablePanel/CargoTablePanel.tsx` — 删除内嵌 ContainerRecordRow 类型定义和 CSV 加载 useEffect，改为调用 useContainerRecords hook。
- `src/shared/components/DataTable/DataTable.tsx` — 使用 useReactTable (TanStack Table) 接管排序/过滤/分页核心逻辑，使用 useVirtualizer (TanStack Virtual) 替代手写虚拟滚动。外部接口不变。
- `src/features/port-location-map/components/PortLocationMap/PortLocationMap.tsx` — 用 react-map-gl 声明式组件完全重写。
- `src/vite-env.d.ts` — 删除旧的 Window.maplibregl 手动类型声明
- `package.json` — 自动更新 dependencies 和 devDependencies

### 0.3 不变的部分

- 所有 CSS Module 文件 — 样式不变
- `BargeCargoGanttView.tsx` 主渲染组件 — 不变（该组件的重构在阶段 4）
- `PortCargoByMainlineView.tsx` — 不变
- 所有 Page 组件 — 不变
- `transform.ts`、`types.ts`、`config.ts` — 不变
- 路由、布局、Redux store — 不变

### 0.4 验证步骤

执行者需要完成以下验证：

1. `pnpm install`（用 pnpm 重新同步 lockfile，因为当前变更通过 npm 安装）
2. `pnpm run build` 确认 TypeScript 编译通过
3. `pnpm run dev` 启动开发服务器，逐一验证：
   - 首页大屏三个视图正常渲染
   - 甘特图点击港口带弹出 CargoPopup
   - 地图标记点击联动、主题切换正常
   - 港口货量分布图渲染正常
   - `/barge-cargo-gantt` 页面 CargoTablePanel 搜索、排序、分页正常
   - 切换 light/dark 主题地图样式随之变化
4. 打开浏览器 Network 面板，确认同一个 `container_records.csv` 在页面间导航时不会重复请求（TanStack Query 缓存生效）

### 0.5 git 操作

```bash
git checkout -b refactor/p0-third-party-libs
git add -A
git commit -m "refactor: replace data fetching, DataTable, and PortLocationMap with third-party libs

- Replace useEffect+fetch pattern with @tanstack/react-query in all data hooks
- Replace hand-rolled DataTable sort/filter/pagination/virtual-scroll with @tanstack/react-table + @tanstack/react-virtual
- Replace imperative MapLibre GL lifecycle with react-map-gl declarative components
- Extract shared fetchUtils and mapStyle.config
- Extract useContainerRecords hook from CargoTablePanel
- Add QueryClientProvider to app providers
- Remove manual maplibre-gl script injection and Window type declarations"
git push origin refactor/p0-third-party-libs
# 创建 PR，合入 main 后进入阶段 1
```

---

## 阶段 1：主题系统修复——消除硬编码颜色

### 目标

审计发现项目中有 24 个硬编码颜色直接导致 dark 模式表现异常，另有多处颜色绕开了 `variables.css` 主题系统。本阶段分两步修复：先做零风险的纯替换，再扩展 CSS 变量体系。

### 1.1 纯替换：将现有 CSS 变量覆盖的硬编码替换掉

以下硬编码色值在 `variables.css` 中已有直接对应的变量，只需查找替换，不需要新增任何变量。

**做什么：**

| 文件                             | 行  | 当前值                   | 替换为                                        | 说明                          |
| -------------------------------- | --- | ------------------------ | --------------------------------------------- | ----------------------------- |
| `DashboardShell.module.css`      | 6   | `background: #fff`       | `background: var(--color-background)`         | 大屏视口底色，dark 下应为深色 |
| `DataTable.module.css`           | 119 | `background: #f7f9fb`    | `background: var(--chart-row-background-odd)` | 表格斑马纹                    |
| `BargeCargoGanttView.module.css` | 103 | `background: #eef2f5`    | `background: var(--chart-surface)`            | loading 遮罩背景              |
| `PortLocationMap.module.css`     | 64  | `border: 1px solid #fff` | `border: 1px solid var(--color-background)`   | marker 边框                   |
| `PortLocationMap.module.css`     | 145 | `background: #f7f9fb`    | `background: var(--chart-row-background-odd)` | 状态遮罩                      |
| `CargoTablePanel.module.css`     | 37  | `background: #fff`       | `background: var(--chart-surface)`            | .portTag 标签底色             |
| `CargoTablePanel.module.css`     | 82  | `background: #fff`       | `background: var(--chart-surface)`            | .badge 底色                   |
| `CargoTablePanel.module.css`     | 87  | `background: #fff`       | `background: var(--chart-surface)`            | .badgeType 底色               |
| `CargoTablePanel.module.css`     | 155 | `background: #fff`       | `background: var(--chart-surface)`            | .sectionTitleLoad 底色        |
| `CargoTablePanel.module.css`     | 160 | `background: #fff`       | `background: var(--chart-surface)`            | .sectionTitleUnload 底色      |
| `CargoTablePanel.module.css`     | 166 | `background: #fff`       | `background: var(--chart-surface)`            | .sectionTitleOnboard 底色     |
| `CargoTablePanel.module.css`     | 190 | `background: #fff`       | `background: var(--chart-surface)`            | .routeNode 底色               |

**不做什么：**

- 不新增 CSS 变量
- 不修改 `variables.css`
- 不修改任何 TS/TSX 文件

### 1.2 扩展变量体系：为缺失的语义角色新增主题变量

当前 `variables.css` 缺少若干语义变量，导致部分组件被迫自建私有颜色或硬编码。本步新增 6 个变量（各有 light/dark 两套值）。

**做什么：**

在 `variables.css` 的 `:root[data-theme='light']` 和 `:root[data-theme='dark']` 中分别添加：

```css
/* light */
--color-text-strong: #11161c;
--color-muted-strong: #55616d;
--color-border-strong: #b7c1ca;
--color-eyebrow-text: #2f6db2;
--color-eyebrow-dot: #2f6db2;
--chart-selected-row-fill: rgba(217, 122, 29, 0.1);

/* dark */
--color-text-strong: #f5f8fa;
--color-muted-strong: #c3ccd4;
--color-border-strong: #4a5568;
--color-eyebrow-text: #84ccff;
--color-eyebrow-dot: #38bdf8;
--chart-selected-row-fill: rgba(242, 154, 67, 0.12);
```

在 `tokens.ts` 的 `color` 对象中添加 `textStrong`、`mutedStrong`、`borderStrong`、`eyebrowText`、`eyebrowDot`；在 `chart` 对象中添加 `selectedRowFill`。同步更新 `theme.types.ts` 的类型定义。

**不做什么：**

- 不改变已有变量的值
- 不删除已有变量

### 1.3 HomePage：删除私有颜色体系，接入全局主题

HomePage 在 `.page` 选择器内定义了 9 个 `--home-*` 私有变量，全部硬编码为 light 模式值，导致首页大屏 dark 模式下完全不响应主题切换。

**做什么：**

删除 `HomePage.module.css` 中 `.page` 下的全部 `--home-*` 变量定义（9 行），逐一替换引用：

| 旧引用                      | 新引用                       |
| --------------------------- | ---------------------------- |
| `var(--home-text)`          | `var(--color-text)`          |
| `var(--home-text-strong)`   | `var(--color-text-strong)`   |
| `var(--home-muted)`         | `var(--color-muted)`         |
| `var(--home-muted-strong)`  | `var(--color-muted-strong)`  |
| `var(--home-blue)`          | `var(--chart-unload)`        |
| `var(--home-orange)`        | `var(--color-accent)`        |
| `var(--home-border)`        | `var(--chart-border)`        |
| `var(--home-border-strong)` | `var(--color-border-strong)` |
| `var(--home-panel-bg)`      | `var(--color-background)`    |

同时将 `.page` 中的 `background: #fff` 替换为 `background: var(--color-background)`。

**不做什么：**

- 不改变 HomePage 的布局结构（grid 模板、尺寸等）
- 不改变 HomePage.tsx 组件代码

### 1.4 ScreenPage：将独立天蓝色纳入主题

ScreenPage.module.css 中的 `.eyebrow` 使用了两个不存在于主题系统的天蓝色硬编码（`#84ccff`、`#38bdf8`）。

**做什么：**

替换 `ScreenPage.module.css` 中的硬编码：

```css
/* 替换前 */
.eyebrow {
  color: #84ccff;
}
.eyebrow::before {
  background: #38bdf8;
}

/* 替换后 */
.eyebrow {
  color: var(--color-eyebrow-text);
}
.eyebrow::before {
  background: var(--color-eyebrow-dot);
}
```

对于 `.eyebrow` 中的 `background: rgb(56 189 248 / 10%)` 和 `border: 1px solid rgb(96 165 250 / 22%)` 以及 `box-shadow`，改为使用 `color-mix`：

```css
background: color-mix(in srgb, var(--color-eyebrow-dot) 10%, transparent);
border: 1px solid color-mix(in srgb, var(--color-eyebrow-dot) 22%, transparent);
box-shadow: 0 0 10px color-mix(in srgb, var(--color-eyebrow-dot) 60%, transparent);
```

**不做什么：**

- 不修改 ScreenPage 的 JSX 结构（还没有创建 ScreenPage.tsx 组件，那是阶段 3 的事）

### 1.5 PortCargoByMainlineView：消除 JS 内联主题分支

**做什么：**

在 `PortCargoByMainlineView.tsx` 中，将：

```typescript
const selectedRowFill = theme === 'dark' ? 'rgba(242, 154, 67, 0.12)' : 'rgba(217, 122, 29, 0.10)'
```

替换为：

```typescript
const selectedRowFill = chart.selectedRowFill
```

这样所有颜色决策都下沉到 CSS 变量层，组件中不再出现 `theme === 'dark'` 颜色分支。

**不做什么：**

- 不修改该组件的其他逻辑
- 不修改 SVG 渲染结构

### 1.6 验证与提交

```bash
git checkout -b refactor/stage-1-theme-fix
# 建议分两个 commit：
# commit 1: 1.1 纯替换（零风险）
git add -A
git commit -m "fix(theme): replace hardcoded colors with existing CSS variables

- DashboardShell viewport background
- DataTable zebra stripe
- BargeCargoGanttView loading mask
- PortLocationMap marker border and status mask
- CargoTablePanel 7x #fff backgrounds (portTag, badge, sectionTitle, routeNode)"

# commit 2: 1.2–1.5 变量扩展 + 组件适配
git add -A
git commit -m "fix(theme): expand CSS variable system and integrate all components

- Add 6 new semantic variables to variables.css (light + dark)
- Replace HomePage 9 private --home-* variables with global theme refs
- Replace ScreenPage hardcoded sky-blue with --color-eyebrow-* variables
- Replace PortCargoByMainlineView inline theme branch with chart.selectedRowFill token
- Update tokens.ts and theme.types.ts"

git push origin refactor/stage-1-theme-fix
```

**关键验证点：**

- `pnpm run dev`，手动切换 light ↔ dark 主题，检查以下页面全部正确响应：
  - 首页大屏：背景、文字、面板边框、KPI 卡片颜色跟随主题
  - `/barge-cargo-gantt`：CargoTablePanel 中的标签、徽章、section 标题背景跟随主题
  - `/port-cargo-mainline`：选中行高亮色跟随主题
  - 三个子页面的 eyebrow 标签颜色跟随主题
- 确认 DashboardShell 视口在 dark 模式下为深色背景

---

## 阶段 2：基础工具层整理

### 目标

合并重复的 hook，提取分散在各组件中的通用工具函数到 shared 层。

### 2.1 合并 useContainerSize 和 useElementWidth

**做什么：**

- 保留 `shared/lib/useContainerSize.ts` 作为唯一实现
- 在该文件中导出 `useElementWidth` 作为便利别名（内部调用 useContainerSize，只返回 width）
- 删除 `shared/lib/useElementWidth.ts`
- 更新所有导入 `useElementWidth` 的文件（BargeCargoGanttPage、PortCargoByMainlinePage、PortLocationMapPage）指向新位置

**不做什么：**

- 不改变 hook 的返回值签名
- 不改变任何组件的使用方式

### 2.2 提取通用工具函数

**做什么：**

- 创建 `shared/lib/colorUtils.ts`，从 CargoTablePanel 中提取 `withAlpha` 和 `getReadableTextColor`
- 创建 `shared/lib/formatUtils.ts`，从 BargeCargoGanttView 中提取 `fmtDate`、`fmtDayLabel`、`fmtHours`，从 CargoTablePanel 中提取 `fmt`、`fmtNum`
- 创建 `shared/lib/dateUtils.ts`，从 CargoTablePanel 中提取 `parseDateTime`、`formatEventTimeRange`
- 将 CargoTablePanel 中的 `getEventTypeLabel` 移到 `features/barge-cargo-gantt/components/CargoTablePanel/utils.ts`（仅该 feature 使用）
- 更新原文件中的导入

**不做什么：**

- 不修改函数逻辑
- 不改变函数签名

### 2.3 增强 portColors 调色板

**做什么：**

- 将 `shared/lib/portColors.ts` 中的 `resolvePortColor` 从 2 色 hash 改为 10 色调色板
- 删除 `features/barge-cargo-gantt/components/BargeCargoGanttView/utils/portColors.ts`（仅 re-export 的 1 行文件），所有导入改为 `@/shared/lib/portColors`
- 在 `portColors.ts` 顶部添加注释，说明调色板颜色与 `variables.css` 中的 `--chart-load`、`--chart-unload` 等值需要手动保持同步

**不做什么：**

- 不改变 `resolvePortColor` 和 `buildPortColorMap` 的函数签名
- 不修改调用侧代码

### 2.4 验证与提交

```bash
git checkout -b refactor/stage-2-utils
pnpm run build  # 编译通过
pnpm run dev    # 视觉验证：港口颜色区分度提高，dark 模式下颜色仍然合理
git add -A
git commit -m "refactor: consolidate hooks, extract shared utils, enhance port color palette"
git push origin refactor/stage-2-utils
```

---

## 阶段 3：Page 骨架组件化

### 目标

消除三个 Page 组件中重复拼装 hero 区域的代码。

### 3.1 为 ScreenPage 创建组件

**做什么：**

- 创建 `shared/components/ScreenPage/ScreenPage.tsx`，封装 page + hero + heroGrid + metricGrid 的 JSX 骨架
- Props 为 `{ eyebrow, title, description, metrics: Array<{label, value}>, children }`
- 使用现有的 `ScreenPage.module.css`（阶段 1 已将其颜色接入主题系统，不再修改 CSS）
- 重构 BargeCargoGanttPage、PortCargoByMainlinePage、PortLocationMapPage 使用 ScreenPage 组件

**不做什么：**

- 不修改 CSS 样式（阶段 1 已完成主题修复）
- 不改变 HomePage（它有自己的布局系统）
- 不修改任何视图组件

### 3.2 统一 HomePage 的 ViewPanel

**做什么：**

- 为 ViewPanel 增加 `renderStatic` prop，支持不需要容器尺寸的场景
- 将地图面板（当前直接拼装 panelCard + WidgetHeader + panelBody）改为使用 ViewPanel + renderStatic
- 删除地图面板中重复的 JSX 结构

**不做什么：**

- 不修改 ViewPanel 的 render-prop 模式（甘特图和货量图继续使用 children 函数）
- 不修改 DashboardShell
- 不修改 HomePage.module.css（阶段 1 已完成主题修复）

### 3.3 验证与提交

```bash
git checkout -b refactor/stage-3-page-shell
pnpm run build
pnpm run dev  # 三个子页面视觉不变，首页地图面板视觉不变，light/dark 切换正常
git add -A
git commit -m "refactor: extract ScreenPage component, unify ViewPanel abstraction"
git push origin refactor/stage-3-page-shell
```

---

## 阶段 4：BargeCargoGanttView 拆分

### 目标

将 855 行的巨型甘特图组件拆分为职责单一的 renderer 模块和子组件。这是最高价值也是最高风险的阶段，分为 4 个子步骤逐步执行。

### 4.1 提取 SVG Defs 和时间轴渲染器

**做什么：**

- 创建 `renderers/types.ts`，定义 `RenderContext` 和 `HighlightUpdater` 类型
- 创建 `renderers/renderDefs.ts`，提取 SVG defs 定义（渐变、箭头 marker）
- 创建 `renderers/renderTimeAxis.ts`，提取时间轴色带、日期标签、ETD 标记线渲染
- 主组件的 useEffect 中改为调用这两个函数

**不做什么：**

- 不改变其他渲染逻辑
- 不改变 highlightUpdaterRef 模式
- 不提取 tooltip 和 popup（留到 4.2）

### 4.2 提取 React 子组件

**做什么：**

- 创建 `parts/GanttTooltip.tsx`，封装 tooltip 的 DOM 结构和显隐逻辑
- 创建 `parts/CargoPopup.tsx`，封装点击弹出的货箱明细窗（目前内联在 JSX 中的 cargoPopup 部分）
- 将主组件中内联的 tooltip HTML 模板和 popup JSX 替换为子组件引用

**不做什么：**

- 不修改 D3 渲染逻辑
- 不改变 tooltip 的定位方式（保持 clientX/clientY）

### 4.3 提取船舶轨道渲染器

**做什么：**

- 创建 `renderers/renderPortBands.ts` — 港口驻留背景带
- 创建 `renderers/renderCargoBlocks.ts` — 装卸矩形块
- 创建 `renderers/renderSailingDonut.ts` — 航行段圆环图
- 创建 `renderers/renderShipRow.ts` — 组合调用上述三个 renderer，负责单条船轨道的完整渲染
- 每个 renderer 返回 `HighlightUpdater[]`
- 主组件 useEffect 改为循环调用 `renderShipRow`

**不做什么：**

- 不修改渲染结果——每个像素必须与拆分前完全一致
- 不重构 highlightUpdaterRef 模式本身（仅将 push 操作移入各 renderer 内部）

### 4.4 提取中转连线渲染器 + 主组件最终瘦身

**做什么：**

- 创建 `renderers/renderTransshipLines.ts`
- 主组件 useEffect 最终结构变为：清空 SVG → renderDefs → renderTimeAxis → forEach renderShipRow → renderTransshipLines
- 主组件目标行数：120 行以内

**不做什么：**

- 不改变 useEffect 的依赖数组
- 不改变 highlightPort 的更新机制

### 4.5 验证与提交

每个子步骤（4.1–4.4）各提交一个 commit：

```bash
git checkout -b refactor/stage-4-gantt-split
# 4.1
git commit -m "refactor(gantt): extract renderDefs and renderTimeAxis"
# 4.2
git commit -m "refactor(gantt): extract GanttTooltip and CargoPopup components"
# 4.3
git commit -m "refactor(gantt): extract ship row renderers (portBands, cargoBlocks, sailingDonut)"
# 4.4
git commit -m "refactor(gantt): extract renderTransshipLines, finalize main component"
git push origin refactor/stage-4-gantt-split
```

**关键验证点：** 每个 commit 后都必须 `pnpm run dev` 验证甘特图渲染无差异——颜色、位置、交互、高亮联动全部一致。

---

## 阶段 5：CargoTablePanel 拆分

### 目标

降低 CargoTablePanel 的复杂度，分离列配置、section 子组件和工具函数。

### 5.1 提取列配置

**做什么：**

- 创建 `CargoTablePanel/columns.config.tsx`，将 `containerColumns` 的 useMemo 内容移入，导出为 `createContainerColumns(getPortTagStyle)` 工厂函数
- 将 `cargoMetricColumns` 和 `onboardColumns` 也移入（它们是静态常量）
- 主组件改为调用工厂函数

**不做什么：**

- 不改变列的定义内容
- 不修改 DataTable 的使用方式

### 5.2 提取 Section 子组件

**做什么：**

- 创建 `CargoMetricsSection.tsx`，封装装卸明细和在船货物两个 DataTable section
- 创建 `ContainerListSection.tsx`，封装货箱明细 DataTable（含 loading/error 状态展示）
- 主组件只负责布局编排

**不做什么：**

- 不改变数据流——所有 section 的 props 由主组件传入
- 不创建新的 state

### 5.3 验证与提交

```bash
git checkout -b refactor/stage-5-cargo-table
pnpm run build
pnpm run dev  # 验证 CargoTablePanel 搜索、排序、分页、section 展开全部正常，dark 模式下标签/徽章底色正确
git add -A
git commit -m "refactor(cargo-table): extract column config and section components"
git push origin refactor/stage-5-cargo-table
```

---

## 阶段 6：PortLocationMap 配置完善

### 目标

阶段 0 已完成地图组件重写和样式抽离，本阶段做收尾优化，包括地图配色与主题系统的对齐。

### 6.1 对齐 mapStyle.config.ts 与 variables.css

**做什么：**

- 审查 `mapStyle.config.ts` 中 `getThemePalette` 的颜色值与 `variables.css` 的对应关系
- 修正已发现的漂移：dark 模式的 `background: '#161c23'` 应与 `variables.css` 的 `--color-background: #11161c` 对齐（选择一个值统一）
- 在 `getThemePalette` 函数顶部添加同步注释，列出与 `variables.css` 的对应关系，提醒修改全局主题色时同步更新此处

**不做什么：**

- 不改变地图功能
- 不将 mapStyle 改为从 CSS 变量读取（MapLibre style spec 不支持 CSS 变量，硬编码是技术必要的）

### 6.2 调整 Popup 样式（如需要）

**做什么：**

- 如果 react-map-gl 的 Popup 渲染方式与原手动 innerHTML 在视觉上有差异，调整 CSS

**不做什么：**

- 不增加新功能

### 6.3 验证与提交

```bash
git checkout -b refactor/stage-6-map-cleanup
pnpm run build && pnpm run dev
git add -A
git commit -m "refactor(map): align map style palette with theme variables, add sync docs"
git push origin refactor/stage-6-map-cleanup
```

---

## 阶段 7：清理死代码和过时配置

### 目标

清理整个项目中不再使用的代码和过时的颜色配置。

### 7.1 清理 BargeCargoGanttView config.ts 死颜色

经审计确认，以下字段在 `config.ts` 之外全部无引用（BargeCargoGanttView 实际使用的颜色全部来自 `useTheme().tokens.chart`）。

**做什么：**

- 删除 `colors` 整个对象（10 个硬编码颜色值：load、unload、transship、sail、cargoBig、cargoNormal、cargoDanger、dayBandEven、dayBandOdd）
- 删除 `drawing.loadGradientTop`、`drawing.loadGradientBottom`、`drawing.unloadGradientTop`、`drawing.unloadGradientBottom`（4 个值，已由 CSS 变量 `--chart-load-gradient-*` / `--chart-unload-gradient-*` 接管）
- 删除 `axis.dayLabelColor`、`axis.borderColor`（2 个值，已由 `chart.axisLabelColor`、`chart.gridLineColor` token 接管）
- 删除 `portBand.palette` 整个数组（10 个值，已由 `shared/lib/portColors` 调色板替代）
- 删除 `portBand.fallbackColor`（1 个值，已由 `chart.portBandFallback` token 接管）

总计删除 27 个死颜色值。

**不做什么：**

- 不删除布局参数（labelWidth、rowHeight、headerHeight、blockHeight、blockRadius 等）
- 不删除仍在使用的绘制参数（etdDashArray、transshipDashArray、nonCargoLineWidth 等）
- 不删除 donut 配置（minOuterRadius、maxOuterRadius 等——仍在使用）
- 不删除 portBand 中仍在使用的参数（yInset、activeOpacity、inactiveOpacity、strokeWidth）

### 7.2 清理 token 间接层冗余（可选）

**做什么：**

- 评估 `shared/theme/tokens.ts` 中的 CSS 变量字符串映射是否仍有价值
- 如果 D3 渲染直接使用 `getComputedStyle` 读取 CSS 变量更简洁，则移除 tokens 间接层
- 如果评估后认为保留更好，则跳过此步

**不做什么：**

- 不改变主题切换机制
- 不改变 CSS 变量定义

### 7.3 验证与提交

```bash
git checkout -b refactor/stage-7-dead-code
pnpm run build && pnpm run dev  # 确认甘特图渲染完全不受影响
git add -A
git commit -m "chore: remove 27 dead color values from gantt config"
git push origin refactor/stage-7-dead-code
```

---

## 阶段 8：数据层缓存优化

### 目标

利用阶段 0 引入的 TanStack Query 进一步优化数据加载体验。

### 8.1 优化 QueryClient 配置

**做什么：**

- 根据实际使用情况调整 staleTime 和 gcTime
- 如果数据是静态仿真输出（不会变），可将 staleTime 设为 Infinity
- 为大文件（container_records.csv）添加 loading 状态的骨架屏

**不做什么：**

- 不引入 SSR
- 不引入 service worker 缓存

### 8.2 为 useBargeCargoGanttData 添加错误 UI

**做什么：**

- 在 BargeCargoGanttView 中使用新的 error 返回值（阶段 0 已添加 error 字段），展示错误提示
- 在 HomePage 的甘特图面板也展示错误状态

**不做什么：**

- 不修改数据转换逻辑

### 8.3 验证与提交

```bash
git checkout -b refactor/stage-8-data-cache
pnpm run build && pnpm run dev
git add -A
git commit -m "feat: optimize query caching and add error UI for gantt data"
git push origin refactor/stage-8-data-cache
```

---

## 附录 A：变更文件总览

```
src/
├── app/
│   └── providers.tsx                              [阶段0 修改]
├── features/
│   ├── barge-cargo-gantt/
│   │   └── components/
│   │       ├── BargeCargoGanttView/
│   │       │   ├── BargeCargoGanttView.module.css [阶段1 修复硬编码]
│   │       │   ├── config.ts                      [阶段7 清理死颜色]
│   │       │   ├── hooks/
│   │       │   │   └── useBargeCargoGanttData.ts  [阶段0 修改]
│   │       │   ├── renderers/                     [阶段4 新增]
│   │       │   │   ├── types.ts
│   │       │   │   ├── renderDefs.ts
│   │       │   │   ├── renderTimeAxis.ts
│   │       │   │   ├── renderShipRow.ts
│   │       │   │   ├── renderCargoBlocks.ts
│   │       │   │   ├── renderSailingDonut.ts
│   │       │   │   ├── renderPortBands.ts
│   │       │   │   └── renderTransshipLines.ts
│   │       │   ├── parts/                         [阶段4 新增]
│   │       │   │   ├── GanttTooltip.tsx
│   │       │   │   └── CargoPopup.tsx
│   │       │   └── utils/
│   │       │       └── portColors.ts              [阶段2 删除]
│   │       └── CargoTablePanel/
│   │           ├── CargoTablePanel.module.css      [阶段1 修复硬编码]
│   │           ├── CargoTablePanel.tsx             [阶段0 修改, 阶段5 拆分]
│   │           ├── columns.config.tsx              [阶段5 新增]
│   │           ├── CargoMetricsSection.tsx         [阶段5 新增]
│   │           ├── ContainerListSection.tsx        [阶段5 新增]
│   │           ├── hooks/
│   │           │   └── useContainerRecords.ts     [阶段0 新增]
│   │           └── utils.ts                       [阶段2 新增]
│   ├── port-cargo-mainline/
│   │   └── components/PortCargoByMainlineView/
│   │       ├── PortCargoByMainlineView.tsx        [阶段1 消除内联主题分支]
│   │       └── hooks/
│   │           └── usePortCargoByMainlineData.ts  [阶段0 修改]
│   ├── port-location-map/
│   │   └── components/PortLocationMap/
│   │       ├── PortLocationMap.module.css          [阶段1 修复硬编码]
│   │       ├── PortLocationMap.tsx                 [阶段0 修改]
│   │       └── mapStyle.config.ts                 [阶段0 新增, 阶段6 对齐]
│   └── home/
│       └── components/
│           ├── HomePage.module.css                [阶段1 删除私有变量]
│           └── HomePage.tsx                       [阶段3 修改]
├── shared/
│   ├── components/
│   │   ├── DashboardShell/
│   │   │   └── DashboardShell.module.css          [阶段1 修复硬编码]
│   │   ├── DataTable/
│   │   │   ├── DataTable.module.css               [阶段1 修复硬编码]
│   │   │   └── DataTable.tsx                      [阶段0 修改]
│   │   ├── ScreenPage/
│   │   │   ├── ScreenPage.module.css              [阶段1 修复硬编码]
│   │   │   └── ScreenPage.tsx                     [阶段3 新增]
│   │   └── WidgetHeader/
│   ├── lib/
│   │   ├── fetchUtils.ts                          [阶段0 新增]
│   │   ├── colorUtils.ts                          [阶段2 新增]
│   │   ├── dateUtils.ts                           [阶段2 新增]
│   │   ├── formatUtils.ts                         [阶段2 新增]
│   │   ├── portColors.ts                          [阶段2 修改]
│   │   ├── useContainerSize.ts                    [阶段2 修改]
│   │   └── useElementWidth.ts                     [阶段2 删除]
│   ├── theme/
│   │   ├── tokens.ts                              [阶段1 新增 token]
│   │   └── theme.types.ts                         [阶段1 更新类型]
│   └── types/
├── styles/
│   └── variables.css                              [阶段1 新增6个变量]
└── vite-env.d.ts                                  [阶段0 修改]
```

## 附录 B：编码规范

以下规范在所有阶段中执行：

1. **组件体积上限**：单个 `.tsx` 文件不超过 300 行。超过时拆分子组件或提取逻辑模块。
2. **D3 渲染器规范**：D3 命令式渲染代码封装为 `renderers/` 下的纯函数，接收 RenderContext，返回 HighlightUpdater[]。禁止在组件函数体内直接写 D3 append 链。
3. **配置分离**：超过 5 个字段的配置对象放在独立的 `*.config.ts` 文件中。
4. **Hook 返回值**：数据获取类 hook 统一返回 `{ data, loading, error }` 三元组。
5. **工具函数归属**：跨 feature 复用的放 `shared/lib/`，单 feature 内的放 feature 下的 `utils.ts`。
6. **依赖方向**：严格遵守 `shared → features → app`，不允许反向依赖。
7. **颜色使用规范**：所有组件的颜色必须来自 CSS 变量（`var(--xxx)`）或 theme tokens。禁止在 CSS Module 和 TSX 中硬编码 hex/rgb 色值。唯一例外是 `mapStyle.config.ts`（MapLibre 技术限制），但必须在文件头部注释中标明与 `variables.css` 的对应关系。

## 附录 C：阶段执行顺序与依赖

```
阶段 0
  ↓
阶段 1 ★主题修复（无前置依赖，应尽早执行以保证后续阶段在正确的主题基础上工作）
  ↓
阶段 2（无前置依赖，可与阶段 1 并行）
  ↓
阶段 3（依赖阶段 1 的 ScreenPage CSS 修复）
  ↓
阶段 4（依赖阶段 2 的 formatUtils 提取）
  ↓
阶段 5（依赖阶段 2 的 colorUtils/dateUtils 提取）
  ↓
阶段 6（依赖阶段 0 + 阶段 1 的变量体系扩展）
  ↓
阶段 7（依赖阶段 2 的 portColors 增强 + 阶段 4 的 renderer 提取）
  ↓
阶段 8（依赖阶段 0）
```

阶段 1 和阶段 2 可以并行执行（它们修改的文件不重叠）。阶段 6 和阶段 8 风险低，可在主线任务间隙穿插。

## 附录 D：主题变量完整清单（阶段 1 完成后的终态）

```css
/* ===== 通用语义变量 ===== */
--color-background          /* 页面/面板底色 */
--color-surface             /* 卡片/弹窗表面色 */
--color-surface-strong      /* 加深表面色 */
--color-shell-background    /* 大屏壳背景 */
--color-shell-glow-primary  /* 大屏辉光主色 */
--color-shell-glow-secondary/* 大屏辉光副色 */
--color-text                /* 主文字色 */
--color-text-strong         /* ★ 新增：加重文字色 */
--color-muted               /* 次要文字色 */
--color-muted-strong        /* ★ 新增：加重次要文字色 */
--color-accent              /* 强调色 */
--color-border              /* 默认边框色 */
--color-border-strong       /* ★ 新增：加重边框色 */
--color-eyebrow-text        /* ★ 新增：眉标文字色 */
--color-eyebrow-dot         /* ★ 新增：眉标圆点色 */

/* ===== 图表专用变量 ===== */
--chart-background / --chart-surface / --chart-border
--chart-text / --chart-text-muted / --chart-text-secondary
--chart-grid / --chart-grid-line-color / --chart-axis-label-color
--chart-day-band-even / --chart-day-band-odd
--chart-row-background-even / --chart-row-background-odd
--chart-sail / --chart-load / --chart-unload / --chart-transship
--chart-cargo-big / --chart-cargo-normal / --chart-cargo-danger
--chart-port-band-fallback
--chart-load-gradient-top / --chart-load-gradient-bottom
--chart-unload-gradient-top / --chart-unload-gradient-bottom
--chart-selected-row-fill   /* ★ 新增：选中行高亮填充 */

/* ===== 字体 ===== */
--font-display / --font-body
```
