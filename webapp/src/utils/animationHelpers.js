/**
 * GPU acceleration hints for smooth animations
 * Apply to all animated components on Android
 */
export const gpuAccelStyle = {
  transform: 'translateZ(0)',
  willChange: 'transform',
  contain: 'layout style paint',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
};

/**
 * Optimized style for modal containers
 */
export const modalContainerStyle = {
  ...gpuAccelStyle,
  contain: 'layout paint',
};

/**
 * Platform-aware GPU hints
 */
export const getPlatformAccelStyle = (isAndroid) => {
  return isAndroid ? gpuAccelStyle : { willChange: 'transform' };
};
