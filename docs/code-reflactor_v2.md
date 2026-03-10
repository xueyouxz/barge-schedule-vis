# barge-schedule-vis 重构执行计划

> 每个步骤独立提交，步骤之间保证编译通过 + 功能正常。

---

## 步骤 1：清理 index.ts + 拍平单文件子文件夹

### 目标

删除冗余的 index.ts 转发文件，消灭只有一个文件的子目录，减少阅读跳转。

### 要做的工作

**删除以下 7 个 index.ts：**

| 文件                                                                       | 处理方式                                                                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `shared/components/WidgetHeader/index.ts`                                  | 删除。WidgetHeader.tsx 中已有具名导出，导入方直接 `import { WidgetHeader } from '@/shared/components/WidgetHeader/WidgetHeader'` |
| `shared/components/DashboardShell/index.ts`                                | 同上                                                                                                                             |
| `features/barge-cargo-gantt/components/BargeCargoGanttView/index.ts`       | 删除。feature 级 index.ts 改为直接指向 BargeCargoGanttView.tsx                                                                   |
| `features/port-cargo-mainline/components/PortCargoByMainlineView/index.ts` | 同上                                                                                                                             |
| `features/port-location-map/components/PortLocationMap/index.ts`           | 同上                                                                                                                             |
| `features/home/index.ts`                                                   | 删除。routes.tsx 已经直接 lazy import 文件路径                                                                                   |

**保留以下 3 个 index.ts（有实际聚合价值）：**

- `shared/theme/index.ts` — 聚合 4 个文件的多个导出
- `features/barge-cargo-gantt/index.ts` — 改为直接指向实现文件（跳过已删的组件级 index.ts）
- `features/port-cargo-mainline/index.ts` — 同上
- `features/port-location-map/index.ts` — 同上

**拍平单文件子目录：**

| 原路径                                                  | 移动到                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `barge-cargo-gantt/.../hooks/useBargeCargoGanttData.ts` | `barge-cargo-gantt/.../hooks/` 目录保留，但这是为步骤 4 做准备 |
| `barge-cargo-gantt/.../utils/transform.ts`              | `barge-cargo-gantt/.../utils/` 目录保留，同上                  |

**更新所有受影响的 import 路径：**

涉及文件：`HomePage.tsx`、`routes.tsx`、各 feature 的 index.ts，以及所有引用了被删 index.ts 的地方。全局搜索旧路径确认无遗漏。

**验证：** `pnpm run lint`

```bash
git commit -m "chore: 清理冗余 index.ts，拍平 port-cargo-mainline 单文件子目录"
```

---

## 步骤 2：统一数据路径配置

### 目标

将散布在三个 hook 中的硬编码数据路径集中管理，为后续切换数据集（场景）提供统一入口。

### 要做的工作

**新建 `shared/constants/scenarioConfig.ts`：**

```typescript
/**
 * 仿真场景数据路径配置。
 *
 * 切换场景时只需修改 ACTIVE_SCENARIO，所有视图组件自动读取对应路径。
 * 后续如需动态切换，可将此配置改为 React Context 或 Redux state。
 */

export interface ScenarioConfig {
  /** 场景标识 */
  id: string
  /** 场景输出目录根路径 */
  outputRoot: string
  /** 公共数据目录 */
  commonRoot: string
}

const SCENARIOS: Record<string, ScenarioConfig> = {
  default: {
    id: 'default',
    outputRoot: '/data/output/2026-01-13 17-20-38',
    commonRoot: '/data/common'
  }
  // 后续新增场景在此添加：
  // 'scenario-2': {
  //   id: 'scenario-2',
  //   outputRoot: '/data/output/2026-02-01 09-00-00',
  //   commonRoot: '/data/common',
  // },
}

/** 当前激活的场景 */
export const ACTIVE_SCENARIO = SCENARIOS['default']!

/** 各数据文件的完整路径 */
export const DATA_PATHS = {
  bargeInfos: `${ACTIVE_SCENARIO.outputRoot}/barge_infos.json`,
  bargeRecords: `${ACTIVE_SCENARIO.outputRoot}/barge_records.json`,
  containerRecords: `${ACTIVE_SCENARIO.outputRoot}/container_records.csv`,
  portLocations: `${ACTIVE_SCENARIO.commonRoot}/port_locations.json`
} as const
```

**修改各 hook 使用统一路径：**

- `useBargeCargoGanttData.ts`：删除文件顶部的 3 个 `DEFAULT_*_PATH` 常量，改为 `import { DATA_PATHS } from '@/shared/constants/scenarioConfig'`，fallback 值使用 `DATA_PATHS.bargeInfos` 等
- `usePortCargoByMainlineData.ts`：删除 `DEFAULT_CSV_FILES` 常量，改用 `DATA_PATHS.containerRecords`
- `PortLocationMap.tsx`：将 `'/data/common/port_locations.json'` 改为 `DATA_PATHS.portLocations`

**验证：** lint通过，数据加载正常，Network 面板中请求路径无变化。

```bash
git commit -m "refactor: 统一数据路径配置到 shared/constants/scenarioConfig"
```

---

## 步骤 3：提取共享解析函数

### 目标

消灭两个 feature 中重复实现的 `parseTeu` 和路由解析函数。

### 要做的工作

**新建 `shared/lib/parseUtils.ts`：**

从 `useBargeCargoGanttData.ts` 和 `usePortCargoByMainlineData.ts` 中提取以下两个函数：

- `parseTeu(value?: string): number` — 两处实现完全相同
- `extractRouteChain(route?: string): string[]` — 甘特图 hook 中叫 `extractRouteChain`，港口货量 hook 中内联在 `normalizeRouteLabel` 里，核心逻辑相同（正则 `/'([^']+)'/g` + 链式去重）

**修改两个 hook：**

- `useBargeCargoGanttData.ts`：删除本地的 `parseTeu` 和 `extractRouteChain`，改为从 `@/shared/lib/parseUtils` 导入。`resolveMainlinePort` 保留在本文件（只有甘特图用）。
- `usePortCargoByMainlineData.ts`：删除本地的 `parseTeu`，改为导入。`normalizeRouteLabel` 改为调用 `extractRouteChain` 后拼接 `' → '`。

**验证：** lint通过，两个视图数据渲染结果无变化。

```bash
git commit -m "refactor: 提取 parseTeu/extractRouteChain 到 shared/lib/parseUtils"
```

---

## 步骤 4：提取统一的视图加载状态组件

### 目标

三个视图组件各自内联了加载中、加载失败、暂无数据的展示逻辑，样式和结构相似但各写一份。提取为统一的共享组件，保证大屏上所有视图的状态展示风格一致。

### 要做的工作

**新建 `shared/components/ViewStateOverlay/ViewStateOverlay.tsx` + `.module.css`：**

```typescript
interface ViewStateOverlayProps {
  loading?: boolean
  error?: string | null
  empty?: boolean
  /** 自定义加载提示文案 */
  loadingText?: string
  /** 自定义空状态文案 */
  emptyText?: string
}
```

组件逻辑：按优先级渲染 loading → error → empty → null。样式统一使用 `--chart-text-muted`（loading/empty）和 `--chart-load`（error）色值，居中覆盖父容器。支持两种展示模式：

- **覆盖模式**（`position: absolute; inset: 0`）—— 适用于 PortLocationMap 这样内容区域需要被完全遮盖的场景
- **内联模式**（默认，`padding` 展示）—— 适用于 BargeCargoGanttView、PortCargoByMainlineView 这样在容器内显示提示文字的场景

可通过 `overlay` boolean prop 区分，默认 `false`（内联模式）。

**修改三个视图组件，替换内联的状态展示：**

| 组件                          | 当前实现                                                                                                                        | 替换为                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BargeCargoGanttView.tsx`     | `{loading && <div className={styles.loading}>正在加载仿真数据...</div>}` + `{error && <div className={styles.error}>...</div>}` | `<ViewStateOverlay loading={loading} error={error} loadingText="正在加载仿真数据..." />`                                                          |
| `PortCargoByMainlineView.tsx` | 三个 `if` 早返回（loading/error/empty 各返回不同 div）                                                                          | 在组件顶部 `if (loading \|\| error \|\| data.length === 0) return <ViewStateOverlay loading={loading} error={error} empty={data.length === 0} />` |
| `PortLocationMap.tsx`         | `{portsQuery.isLoading ? <div className={styles.statusMask}>...</div> : null}` + error 同理                                     | `<ViewStateOverlay overlay loading={portsQuery.isLoading} error={portsQuery.error?.message} loadingText="正在加载港口地图..." />`                 |

**删除各组件 CSS 中对应的状态样式类：**

- `BargeCargoGanttView.module.css`：删除 `.loading` 和 `.error`
- `PortCargoByMainlineView.module.css`：删除 `.state` 和 `.stateError`
- `PortLocationMap.module.css`：删除 `.statusMask`

**验证：** 三个视图分别触发 loading、error、空数据场景，确认展示效果一致且符合预期。

```bash
git commit -m "refactor: 提取 ViewStateOverlay 统一视图加载/错误/空状态展示"
```

---

## 步骤 5：移除 BargeCargoGanttView 高亮机制

### 目标

移除 `highlightPort` prop 及其对应的整套 Observer 高亮机制（`highlightUpdaterRef`、`highlightPortRef`、`isActivePort`、`hasHighlight`），所有元素始终以正常透明度渲染。

### 要做的工作

**修改 `BargeCargoGanttView.tsx`：**

- 从 props 中删除 `highlightPort`
- 删除 `highlightPortRef` 和 `highlightUpdaterRef` 两个 ref 声明
- 删除两个维护 ref 的 `useEffect`（`highlightPortRef.current = highlightPort` 和 `highlightUpdaterRef.current.forEach(fn => fn(highlightPort))`）
- 删除 `hasHighlight` 和 `isActivePort` 变量/函数
- 将所有 `const active = isActivePort(ev.port)` 替换为 `const active = true`（随后简化为直接使用 active 状态下的值）
- 删除所有 `highlightUpdaterRef.current.push(...)` 调用
- 移除 useEffect 依赖数组中的相关项
- 整体简化：所有条件 `active ? X : Y` 直接取 `X` 值

**修改 `types.ts`：**

- 从 `BargeCargoGanttViewProps` 中删除 `highlightPort?: string`

**修改 `HomePage.tsx`：**

- 从 `<BargeCargoGanttView>` 的 props 中移除 `highlightPort={activePort}`

**预估行数减少：** 约 50-60 行（分布在 highlightUpdaterRef.push 调用和条件表达式中）。

**验证：** 甘特图正常渲染，所有元素始终全透明度显示，点击港口/地图联动仍然正常工作（通过 selectedPort 影响 PortCargo 和 Map，与甘特图的高亮无关）。

```bash
git commit -m "refactor: 移除 BargeCargoGanttView 高亮机制，简化渲染逻辑"
```

---

## 步骤 6：BargeCargoGanttView 数据层拆分

### 目标

将 `useBargeCargoGanttData.ts`（270 行）中的纯数据转换函数提取到 `utils/` 下，hook 只保留 TanStack Query 编排。

### 要做的工作

**新建 `utils/ganttDataEnrich.ts`：**

从 `hooks/useBargeCargoGanttData.ts` 中搬出以下函数（含其辅助函数）：

- `parseRouteLegs(route?: string)` — route 字符串解析为运输段数组
- `enrichEventCargoDetails(dataset, containerRows, bargeIdToVesselVoyage)` — 货箱明细关联到甘特事件
- `buildEtdMarksFromContainerRows(rows, dataset)` — ETD 标记生成
- `parseSimTime(value?: string)` — 辅助函数，被上面两个函数使用
- `resolveMainlinePort(route, fallbackPort)` — 辅助函数（此函数中 `extractRouteChain` 已在步骤 3 提到 shared，这里改为导入）
- `ContainerRecordRow` 类型定义 — 随函数一起搬出

这些函数都是纯函数，不依赖 React hook，逻辑上围绕"用 CSV 数据丰富甘特图数据集"这一主题。

**精简 `hooks/useBargeCargoGanttData.ts`：**

剩余内容：

- import DATA_PATHS 和 fetchJson/fetchCsvRows
- import 从 ganttDataEnrich.ts 搬出的函数
- import buildBargeCargoGanttData from transform
- `useBargeCargoGanttData` hook 函数本身（TanStack Query 封装 + 调用顺序编排）

预计精简到约 60-70 行。

**验证：** 甘特图数据加载正常，tooltip/弹窗中的货箱明细数据无变化，ETD 虚线位置无变化。

```bash
git commit -m "refactor: 从 useBargeCargoGanttData 提取纯转换函数到 utils/ganttDataEnrich"
```

---

## 步骤 7：BargeCargoGanttView 组件内渲染拆分 + Tooltip 提取

### 目标

将 BargeCargoGanttView.tsx 主体 useEffect 中的 ~400 行渲染代码在文件内拆分为多个独立函数，并将 Tooltip 和 CargoDetailPopup 提取为独立组件文件。

### 7.1 Tooltip 提取

**新建 `BargeCargoGanttView/GanttTooltip.tsx`：**

包含两个组件，都在同一个文件中：

**`GanttTooltip`** — 替代当前 innerHTML 拼接的悬浮 tooltip：

- 接收 `event: GanttEvent | null`、`position: { x: number; y: number }`、`visible: boolean`
- 使用 React JSX 渲染，消灭 innerHTML XSS 风险
- 样式复用 BargeCargoGanttView.module.css 中已有的 `.tooltip` 类

**`CargoDetailPopup`** — 从主组件搬出的货箱明细弹出面板：

- 接收 `event`、`position`、`portColorMap`、`onClose`
- 将主组件中 `{selectedEvent && (<div className={styles.cargoPopup}>...)}` 整段 JSX 搬过来
- 样式复用已有的 `.cargoPopup*` 和 `.portBarChart*` CSS 类

### 7.2 主组件内渲染函数拆分

**在 `BargeCargoGanttView.tsx` 文件内，将巨型 useEffect 中的代码拆分为以下函数（定义在组件函数外部）：**

```typescript
/** 绘制时间轴色带和日期标签 */
function renderTimeAxis(
  axisG: d3.Selection,
  data: GanttDataset,
  pxPerHour: number,
  H: number,
  chart: ChartTokens
): void

/** 绘制 ETD 标记竖线 */
function renderEtdMarks(
  axisG: d3.Selection,
  data: GanttDataset,
  pxPerHour: number,
  H: number,
  chart: ChartTokens
): void

/** 绘制单艘船的完整行：港口背景带 + 航行线 + 圆环 + 装卸块 + 标签 */
function renderShipRow(
  svg: d3.Selection,
  ship: ShipRow,
  rowIndex: number,
  data: GanttDataset,
  layout: LayoutParams,
  portColorMap: Map,
  chart: ChartTokens,
  callbacks: { showTip; hideTip; openCargoDetail; onBarClick }
): Record<string, BlockPosition>

/** 绘制中转连线 */
function renderTransshipConnections(
  svg: d3.Selection,
  data: GanttDataset,
  layout: LayoutParams,
  blockPositions: Record,
  chart: ChartTokens
): void

/** SVG defs（渐变、箭头 marker） */
function renderDefs(defs: d3.Selection, chart: ChartTokens): void
```

关键设计决策：

- **`renderShipRow` 不再进一步拆**。港口背景带、航行圆环、装卸块共享 row 级局部变量（`rowY`、`sailY`、`areaG`），函数内部用注释分段标注 `// --- 港口驻留背景带 ---`、`// --- 航行段 + 圆环 ---`、`// --- 装卸块 ---` 即可。
- **布局计算不拆到单独文件**。在 useEffect 内部用 `useMemo` 或 useEffect 开头集中计算，用一个 `layout` 对象收纳所有派生值（`pxPerHour`、`rowH`、`sailY`、`maxBlockH` 等），传给各 render 函数。可以定义一个 `LayoutParams` 接口描述这些值。
- **所有 render 函数定义在同文件中，组件函数外部**，避免闭包捕获和重复创建。

### 7.3 修改主组件 useEffect

useEffect 精简为：

1. 计算布局参数 → 组装 `layout` 对象
2. 清空 SVG `svg.selectAll('*').remove()`
3. 调用 `renderDefs(defs, chart)`
4. 调用 `renderTimeAxis(axisG, ...)`
5. 调用 `renderEtdMarks(axisG, ...)`
6. 遍历 ships 调用 `renderShipRow(...)`，收集 blockPositions
7. 调用 `renderTransshipConnections(...)`

tooltip 和 popup 改为 React state 驱动 + GanttTooltip 组件渲染：

- 将 `showTip`/`hideTip` 改为 `setTooltipState` 调用
- 将 `openCargoDetail` 改为 `setPopupState` 调用
- JSX 中用 `<GanttTooltip ... />` 和 `<CargoDetailPopup ... />` 替代 `tooltipRef` + innerHTML + 内联 popup JSX

### 7.4 类型修正

在 `types.ts` 中：

- 新增 `PortSummaryEvent` 接口（聚合展示事件，非真实调度事件），替代当前用 `GanttEvent` + `type: 'loading' as const` 的 hack
- 新增 `InteractiveEvent = GanttEvent | PortSummaryEvent` 联合类型
- 从 `BargeCargoGanttViewProps` 中删除已在步骤 5 移除的 `highlightPort`（如尚未更新）

在 `renderShipRow` 中构造港口停靠区间事件时，使用 `PortSummaryEvent` 类型而非伪造的 `GanttEvent`。

### 7.5 预期文件行数

| 文件                    | 变更前 | 变更后                                                     |
| ----------------------- | ------ | ---------------------------------------------------------- |
| BargeCargoGanttView.tsx | 844 行 | ~350-400 行（render 函数定义 + useEffect 编排 + 状态管理） |
| GanttTooltip.tsx        | 不存在 | ~120 行（Tooltip + CargoDetailPopup）                      |

> 主组件虽然仍有 350-400 行，但结构是「若干清晰的 render 函数 + 一个精简的 useEffect 编排」，每个函数职责单一、可独立阅读。

**验证：** 甘特图完整渲染无差异，tooltip 悬浮正常，货箱明细弹窗正常，中转连线正常。

```bash
git commit -m "refactor: 拆分 BargeCargoGanttView 渲染函数，提取 GanttTooltip 组件"
```

---

## 步骤 8：HomePage 清理

### 目标

去掉 HomePage 对甘特图 feature 内部 hook 的深层导入，甘特图的错误展示完全由自身处理。

### 要做的工作

**修改 `HomePage.tsx`：**

- 删除 `import { useBargeCargoGanttData } from '@/features/barge-cargo-gantt/components/BargeCargoGanttView/hooks/useBargeCargoGanttData'`
- 删除 `const { error: ganttError } = useBargeCargoGanttData()`
- 删除甘特面板中的 `ganttError ? <div>...</div> :` 条件分支
- 甘特面板内容简化为直接渲染 `<BargeCargoGanttView>`（组件内部已有 loading/error 处理，步骤 4 已替换为 ViewStateOverlay）

**验证：** 编译通过，首页三个面板正常渲染，甘特图加载失败时在自身区域内展示错误信息。

```bash
git commit -m "refactor: HomePage 去掉跨 feature 深层导入，甘特错误处理下放"
```

---

## 最终文件结构

```
src/
├── app/                                         # 不变
├── assets/                                      # 不变
├── layouts/                                     # 不变
├── styles/                                      # 不变
│
├── shared/
│   ├── components/
│   │   ├── WidgetHeader/
│   │   │   ├── WidgetHeader.tsx                  （删除 index.ts）
│   │   │   └── WidgetHeader.module.css
│   │   ├── DashboardShell/
│   │   │   ├── DashboardShell.tsx                （删除 index.ts）
│   │   │   └── DashboardShell.module.css
│   │   └── ViewStateOverlay/                     ← 新增
│   │       ├── ViewStateOverlay.tsx
│   │       └── ViewStateOverlay.module.css
│   ├── constants/
│   │   ├── app.constants.ts
│   │   └── scenarioConfig.ts                     ← 新增
│   ├── lib/
│   │   ├── parseUtils.ts                         ← 新增
│   │   ├── colorUtils.ts
│   │   ├── dashboardFilterSlice.ts
│   │   ├── dateUtils.ts
│   │   ├── fetchUtils.ts
│   │   ├── formatUtils.ts
│   │   ├── hooks.ts
│   │   ├── portColors.ts
│   │   ├── store.ts
│   │   └── useContainerSize.ts
│   ├── theme/
│   │   └── index.ts                              （保留）
│   └── types/
│
├── features/
│   ├── home/
│   │   └── components/
│   │       ├── HomePage.tsx                       （修改：精简）
│   │       └── HomePage.module.css
│   │
│   ├── barge-cargo-gantt/
│   │   ├── index.ts                               （保留，直接指向实现文件）
│   │   └── components/
│   │       └── BargeCargoGanttView/
│   │           ├── BargeCargoGanttView.tsx          （重构：~350-400行）
│   │           ├── BargeCargoGanttView.module.css   （删除 .loading .error）
│   │           ├── GanttTooltip.tsx                 ← 新增 ~120行
│   │           ├── config.ts
│   │           ├── types.ts                         （修改：+PortSummaryEvent）
│   │           ├── hooks/
│   │           │   └── useBargeCargoGanttData.ts    （精简至 ~60行）
│   │           └── utils/
│   │               ├── transform.ts
│   │               └── ganttDataEnrich.ts           ← 新增 ~150行
│   │
│   ├── port-cargo-mainline/
│   │   ├── index.ts                               （保留，直接指向实现文件）
│   │   └── components/
│   │       └── PortCargoByMainlineView/
│   │           ├── PortCargoByMainlineView.tsx      （修改：替换状态展示）
│   │           ├── PortCargoByMainlineView.module.css（删除 .state .stateError）
│   │           ├── usePortCargoByMainlineData.ts    （从 hooks/ 上移）
│   │           ├── config.ts
│   │           └── types.ts
│   │
│   └── port-location-map/
│       ├── index.ts                               （保留）
│       └── components/
│           └── PortLocationMap/
│               ├── PortLocationMap.tsx              （修改：替换状态展示）
│               ├── PortLocationMap.module.css       （删除 .statusMask）
│               └── mapStyle.config.ts
```
