export const PAGE3_CONTENT = Object.freeze({
  ready: {
    number: '01',
    title: '擂鼓起势',
    description: '鼓点将唤醒舞台，开启铜梁火龙表演。',
    prompt: '点击战鼓，唤醒火龙舞台',
  },
  stage: {
    number: '01',
    title: '擂鼓起势',
    description: '鼓点唤醒舞台，舞龙队整队起龙。',
    prompt: '表演进行中',
  },
  pearl: {
    number: '02',
    title: '珠引龙行',
    description: '龙珠在前引导，火龙循珠而动，蓄势待发。',
    prompt: '表演进行中',
  },
  dragon: {
    number: '03',
    title: '人杆合一',
    description: '舞龙者协同持杆，龙身随鼓点起伏翻腾。',
    prompt: '表演进行中',
  },
  climax: {
    number: '04',
    title: '火树银花',
    description: '铁花凌空绽放，火龙穿行其间，表演进入高潮。',
    prompt: '表演进行中',
  },
  closing: {
    number: '05',
    title: '收龙纳福',
    description: '火龙归位，寓意纳吉迎祥、福佑安康。',
    prompt: '表演即将完成',
  },
  waits: {
    pearl: '再次击鼓，龙珠引路',
    dragon: '再次击鼓，舞龙起势',
    climax: '再次击鼓，进入火舞高潮',
  },
  progress: [
    { id: 'stage', label: '起势' },
    { id: 'pearl', label: '引龙' },
    { id: 'dragon', label: '舞龙' },
    { id: 'climax', label: '铁花' },
    { id: 'closing', label: '收势' },
  ],
  completion: '你已完成本次铜梁龙 AR 交互体验',
})
