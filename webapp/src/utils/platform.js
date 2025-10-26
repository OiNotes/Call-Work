const PLATFORM_ALIASES = {
  android: 'android',
  android_x: 'android',
  iphone: 'ios',
  ipad: 'ios',
  ios: 'ios',
  macos: 'desktop',
  tdesktop: 'desktop',
  web: 'desktop',
  webk: 'desktop',
  webz: 'desktop',
  weba: 'desktop',
};

export function normalizePlatform(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return 'unknown';
  }

  const key = raw.toLowerCase();
  return PLATFORM_ALIASES[key] || key;
}

export function isAndroid(platform) {
  return normalizePlatform(platform) === 'android';
}

export function isIOS(platform) {
  return normalizePlatform(platform) === 'ios';
}

const SURFACE_PRESETS = {
  tabbar: {
    default: {
      background:
        'linear-gradient(180deg, rgba(23, 33, 43, 0.72) 0%, rgba(15, 15, 15, 0.94) 100%)',
      backdropFilter: 'blur(16px) saturate(180%)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow:
        '0 -4px 16px rgba(0, 0, 0, 0.36), 0 -8px 32px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    },
    android: {
      background: 'rgba(16, 16, 16, 0.96)',
      backdropFilter: 'none',
      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      boxShadow: '0 -3px 12px rgba(0, 0, 0, 0.5)',
    },
  },
  surfaceStrong: {
    default: {
      background:
        'linear-gradient(180deg, rgba(26, 26, 26, 0.95) 0%, rgba(15, 15, 15, 0.98) 100%)',
      backdropFilter: 'blur(40px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    },
    android: {
      background: 'rgba(20, 20, 20, 0.96)',
      backdropFilter: 'none',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    },
  },
  surfacePanel: {
    default: {
      background: 'rgba(20, 20, 20, 0.9)',
      backdropFilter: 'blur(18px) saturate(160%)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 22px 48px rgba(0, 0, 0, 0.45)',
    },
    android: {
      background: 'rgba(18, 18, 18, 0.94)',
      backdropFilter: 'none',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    },
  },
  overlay: {
    default: {
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
    },
    android: {
      background: 'rgba(0, 0, 0, 0.72)',
    },
  },
  glassCard: {
    default: {
      background: 'rgba(33, 33, 33, 0.6)',
      backdropFilter: 'blur(12px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 18px 44px rgba(0, 0, 0, 0.45)',
    },
    android: {
      background: 'rgba(28, 28, 28, 0.92)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      boxShadow: '0 14px 32px rgba(0, 0, 0, 0.55)',
    },
  },
  accentGlow: {
    default: {
      background: 'linear-gradient(135deg, rgba(255, 107, 0, 0.12) 0%, rgba(255, 140, 66, 0.08) 100%)',
      border: '1px solid rgba(255, 107, 0, 0.3)',
      boxShadow: '0 2px 8px rgba(255, 107, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    },
    android: {
      background: 'linear-gradient(135deg, rgba(255, 107, 0, 0.24) 0%, rgba(255, 140, 66, 0.14) 100%)',
      border: '1px solid rgba(255, 107, 0, 0.4)',
      boxShadow: '0 1px 6px rgba(255, 107, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
    },
  },
};

export function getSurfaceStyle(token, platform) {
  const preset = SURFACE_PRESETS[token];
  if (!preset) {
    return {};
  }

  const isAndroidPlatform = isAndroid(platform);
  return isAndroidPlatform ? preset.android : preset.default;
}

const SPRING_PRESETS = {
  sheet: {
    default: { type: 'spring', damping: 30, stiffness: 420, mass: 1 },
    android: { type: 'spring', damping: 28, stiffness: 250, mass: 0.85 },
  },
  quick: {
    default: { type: 'spring', stiffness: 380, damping: 25 },
    android: { type: 'spring', stiffness: 220, damping: 26 },
  },
  press: {
    default: { type: 'spring', stiffness: 380, damping: 32 },
    android: { type: 'spring', stiffness: 200, damping: 25 },
  },
};

export function getSpringPreset(token, platform) {
  const preset = SPRING_PRESETS[token];
  if (!preset) {
    return undefined;
  }
  return isAndroid(platform) ? preset.android : preset.default;
}

export function applyPlatformClasses(platform) {
  const normalized = normalizePlatform(platform);
  const html = document.documentElement;

  if (!html.classList.contains(`platform-${normalized}`)) {
    const previous = Array.from(html.classList).filter((cls) =>
      cls.startsWith('platform-')
    );
    previous.forEach((cls) => html.classList.remove(cls));
    html.classList.add(`platform-${normalized}`);
  }

  html.dataset.platform = normalized;
}
