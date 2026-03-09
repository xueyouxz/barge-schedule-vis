import styles from './HomePage.module.css'

type ModuleItem = {
  title: string
  description: string
}

const coreModules: ModuleItem[] = [
  {
    title: '调度总览看板',
    description: '统一呈现船舶、航次、泊位和任务状态，支持按时间窗口快速定位调度压力点。'
  },
  {
    title: '时空可视化分析',
    description: '以时间轴与线路视图展示调度执行过程，辅助识别冲突、等待与资源利用率。'
  },
  {
    title: '计划评估与对比',
    description: '支持对不同调度方案进行关键指标对比，为运营决策提供量化依据。'
  },
  {
    title: '异常事件追踪',
    description: '记录延误、拥堵、设备异常等事件并关联上下游影响，提升调度闭环效率。'
  }
]

const nextSteps: string[] = [
  '梳理业务对象与指标口径（船舶、任务、航线、泊位、时段）。',
  '定义首页核心视图的信息架构与交互流程。',
  '按 feature 目录拆分数据接入、可视化组件和分析模块。',
  '建立模拟数据与 API 契约，支持后续联调。'
]

export default function HomePage() {
  return (
    <section className={styles.page}>
      <article className={styles.hero}>
        <p className={styles.eyebrow}>Barge Scheduling Visualization</p>
        <h1 className={styles.title}>驳船调度可视化分析系统</h1>
        <p className={styles.description}>
          当前已完成模板去品牌化初始化。本页作为业务首页占位，聚焦系统定位、核心能力与建设路线，后续可直接替换为真实业务看板。
        </p>
      </article>

      <section className={styles.panel}>
        <h2>系统定位</h2>
        <p>
          面向驳船调度场景，提供可视化态势展示、调度计划分析与执行追踪能力，帮助运营团队提升资源配置效率与计划可执行性。
        </p>
      </section>

      <section className={styles.panel}>
        <h2>规划中的核心模块</h2>
        <ul className={styles.moduleList}>
          {coreModules.map(item => (
            <li key={item.title} className={styles.moduleItem}>
              <p className={styles.moduleTitle}>{item.title}</p>
              <p className={styles.moduleDescription}>{item.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.panel}>
        <h2>下一步建设方向</h2>
        <ol className={styles.stepList}>
          {nextSteps.map(step => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </section>
  )
}
