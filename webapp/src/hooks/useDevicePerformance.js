import { useState, useEffect } from 'react';
import { usePlatform } from './usePlatform';
import { isAndroid } from '../utils/platform';

/**
 * Device performance class detection
 * Returns: 'low' | 'medium' | 'high'
 */
export function useDevicePerformance() {
  const platform = usePlatform();
  const [performanceClass, setPerformanceClass] = useState('medium');

  useEffect(() => {
    if (!isAndroid(platform)) {
      setPerformanceClass('high'); // iOS всегда high
      return;
    }

    // Определяем класс по характеристикам
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4; // GB

    if (cores >= 8 && memory >= 6) {
      setPerformanceClass('high');
    } else if (cores >= 4 && memory >= 3) {
      setPerformanceClass('medium');
    } else {
      setPerformanceClass('low');
    }
  }, [platform]);

  return performanceClass;
}
