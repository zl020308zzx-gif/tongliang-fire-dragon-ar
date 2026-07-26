const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
const maxTouchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints

export const IS_IOS_MOBILE = /iPad|iPhone|iPod/i.test(userAgent)
  || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)

export const IS_ANDROID_MOBILE = /Android/i.test(userAgent)

export const IS_MOBILE_DEVICE = IS_IOS_MOBILE || IS_ANDROID_MOBILE

export const selectPageImageRoot = (desktopRoot, mobileRoot) =>
  IS_MOBILE_DEVICE ? mobileRoot : desktopRoot
