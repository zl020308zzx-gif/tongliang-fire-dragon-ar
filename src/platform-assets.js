const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
const maxTouchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints
const userAgentDataMobile = typeof navigator !== 'undefined'
  && navigator.userAgentData?.mobile === true

export const IS_IOS_MOBILE = /iPad|iPhone|iPod/.test(userAgent)
  || (/\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1)

export const IS_MOBILE_DEVICE = userAgentDataMobile
  || IS_IOS_MOBILE
  || /Android|Mobile|Tablet|Silk|Kindle|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)

export const selectPageImageRoot = (desktopRoot, mobileRoot) =>
  IS_MOBILE_DEVICE ? mobileRoot : desktopRoot
