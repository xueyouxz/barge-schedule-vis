export interface SceneOption {
  id: string
  label: string
}

export interface ScenarioConfig {
  id: string
  label: string
  root: string
  outputRoot: string
  commonRoot: string
}

export interface DataPaths {
  bargeInfos: string
  bargeRecords: string
  containerRecords: string
  portLocations: string
}

export const SCENES_MANIFEST_PATH = '/data/scenes/index.json'
export const SCENES_ROOT = '/data/scenes'
export const COMMON_DATA_ROOT = '/data/common'

export function buildScenarioConfig(scene: SceneOption): ScenarioConfig {
  const root = `${SCENES_ROOT}/${scene.id}`

  return {
    ...scene,
    root,
    outputRoot: `${root}/output`,
    commonRoot: COMMON_DATA_ROOT
  }
}

export function buildDataPaths(scene: SceneOption | null): DataPaths | null {
  if (!scene) {
    return null
  }

  const config = buildScenarioConfig(scene)

  return {
    bargeInfos: `${config.outputRoot}/barge_infos.json`,
    bargeRecords: `${config.outputRoot}/barge_records.json`,
    containerRecords: `${config.outputRoot}/container_records.csv`,
    portLocations: `${config.commonRoot}/port_locations.json`
  }
}
