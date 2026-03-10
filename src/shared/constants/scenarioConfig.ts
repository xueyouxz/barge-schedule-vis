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
export const ACTIVE_SCENARIO = SCENARIOS.default

/** 各数据文件的完整路径 */
export const DATA_PATHS = {
  bargeInfos: `${ACTIVE_SCENARIO.outputRoot}/barge_infos.json`,
  bargeRecords: `${ACTIVE_SCENARIO.outputRoot}/barge_records.json`,
  containerRecords: `${ACTIVE_SCENARIO.outputRoot}/container_records.csv`,
  portLocations: `${ACTIVE_SCENARIO.commonRoot}/port_locations.json`
} as const
