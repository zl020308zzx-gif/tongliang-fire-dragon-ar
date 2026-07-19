export const PAGE2_HOTSPOTS = [
  {
    id: 'dragon-head',
    number: 1,
    title: '龙头',
    category: '造型核心',
    position: { x: 0.0854, y: 0.044, z: 0.01 },
    description: '铜梁火龙龙头集眼、角、口、须等造型于一体，既要保持威严神采，也要兼顾舞动时的重量和平衡。艺人通过竹篾骨架、纸扎和彩绘，让龙首在火光中呈现昂扬灵动的神态。',
    keywords: ['竹篾骨架', '神态塑造', '舞动平衡'],
  },
  {
    id: 'body-sections',
    number: 2,
    title: '龙身分节',
    category: '主体结构',
    position: { x: 0.04, y: 0.041, z: 0.01 },
    description: '火龙龙身由多个独立龙节连续组成。分节既赋予长躯清晰的鳞甲节奏，也让舞龙队伍能够完成盘旋、翻腾和穿插等动作。各节尺寸与重量需要保持相对均衡，才能形成连贯的龙身曲线。',
    keywords: ['连续龙节', '动态曲线', '重量均衡'],
  },
  {
    id: 'section-joints',
    number: 3,
    title: '节间连接',
    category: '活动连接',
    position: { x: 0.0036, y: 0.041, z: 0.01 },
    description: '节间连接承担传力与转向作用，需要在牢固和灵活之间取得平衡。连接过紧会限制龙身弯折，过松又会造成节奏脱节。传统制作通过绳结、套接等方式，使各龙节在快速舞动中保持连续。',
    keywords: ['柔性连接', '传力转向', '连续舞动'],
  },
  {
    id: 'control-poles',
    number: 4,
    title: '操控持杆',
    category: '表演装置',
    position: { x: -0.036, y: 0.043, z: 0.01 },
    description: '每一龙节下方的持杆把舞龙者的力量传递到龙身。表演者通过举、压、挑、摆等动作共同塑造火龙姿态。持杆位置、长度和握持方式会直接影响队伍配合、动作幅度与表演安全。',
    keywords: ['力量传递', '多人协作', '表演安全'],
  },
  {
    id: 'dragon-tail',
    number: 5,
    title: '龙尾',
    category: '收势结构',
    position: { x: -0.0817, y: 0.039, z: 0.01 },
    description: '龙尾位于整条火龙动作链的末端，负责延续并放大前方传来的运动节奏。轻巧而富有弹性的尾部能形成甩摆和回旋效果，使火龙的起伏更完整，也考验尾部舞者对整体速度的判断。',
    keywords: ['动作收势', '节奏延续', '轻巧弹性'],
  },
]

export function createPage2Progress(config, hotspots = PAGE2_HOTSPOTS) {
  const viewed = new Set()
  try {
    JSON.parse(localStorage.getItem(config.viewedKey) || '[]').forEach((id) => {
      if (hotspots.some((item) => item.id === id)) viewed.add(id)
    })
  } catch {
    // 隐私模式或旧数据损坏时从空进度继续。
  }

  const persist = () => {
    try {
      localStorage.setItem(config.viewedKey, JSON.stringify([...viewed]))
    } catch {
      // 存储失败不能阻塞探索。
    }
  }

  return {
    markViewed(id) {
      viewed.add(id)
      persist()
      return viewed.size
    },
    isViewed: (id) => viewed.has(id),
    getViewed: () => [...viewed],
    getCount: () => viewed.size,
    markCompleted() {
      try {
        localStorage.setItem(config.completedKey, 'true')
      } catch {
        // 存储失败不能阻塞完成反馈。
      }
    },
    isCompleted() {
      try {
        return localStorage.getItem(config.completedKey) === 'true'
      } catch {
        return false
      }
    },
  }
}
