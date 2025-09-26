export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

export function canUseCamera(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function shouldUseFallback(): boolean {
  // Some older browsers or specific mobile browsers might need fallback
  return !canUseCamera() || (isIOS() && parseInt(navigator.userAgent.match(/OS (\d+)/)?.[1] || '0') < 11);
}