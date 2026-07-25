const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
const maxTouchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints

export const IS_IOS_MOBILE = /iPad|iPhone|iPod/.test(userAgent)
  || (/\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1)

export const selectPageImageRoot = (desktopRoot, mobileRoot) =>
  IS_IOS_MOBILE ? mobileRoot : desktopRoot
