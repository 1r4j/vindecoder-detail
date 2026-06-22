// Mobile-specific optimizations and utilities

export function setupMobileOptimizations() {
  // Detect if device is mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  // Set data attributes for CSS
  document.documentElement.setAttribute('data-device-type', isMobile ? 'mobile' : 'desktop');
  if (isIOS) document.documentElement.setAttribute('data-os', 'ios');
  if (isAndroid) document.documentElement.setAttribute('data-os', 'android');

  // Prevent double-tap zoom on buttons and interactive elements
  if (isMobile) {
    document.addEventListener('touchstart', function() {}, false);
  }

  // Handle viewport height on mobile (address bar height changes)
  if (isMobile) {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
  }

  // Optimize performance: reduce animations on low-end devices
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mediaQuery.matches) {
    document.documentElement.style.scrollBehavior = 'auto';
  }

  // Handle safe area insets for notched devices
  if (CSS.supports('padding-top: max(0px)')) {
    document.documentElement.style.setProperty('--safe-area-top', 'max(0px, env(safe-area-inset-top))');
    document.documentElement.style.setProperty('--safe-area-bottom', 'max(0px, env(safe-area-inset-bottom))');
  }

  return {
    isMobile,
    isIOS,
    isAndroid
  };
}

// Detect if user prefers dark mode
export function detectDarkMode() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark;
}

// Utility to handle viewport changes
export function onViewportChange(callback) {
  let resizeTimeout;

  const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const isMobile = window.innerWidth <= 768;
      callback({ isMobile, width: window.innerWidth, height: window.innerHeight });
    }, 250);
  };

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);
    clearTimeout(resizeTimeout);
  };
}

// Optimize for touch devices
export function setupTouchOptimizations() {
  if (!('ontouchstart' in window)) {
    return;
  }

  // Add touch class to html for CSS selectors
  document.documentElement.classList.add('touch-device');

  // Handle fast click on mobile
  let lastClickTime = 0;
  document.addEventListener('click', (e) => {
    const now = Date.now();
    if (now - lastClickTime < 300) {
      e.preventDefault();
    }
    lastClickTime = now;
  }, true);
}

// Enable/disable text selection
export function setTextSelectable(enabled) {
  const root = document.documentElement;
  if (enabled) {
    root.classList.add('allow-select');
  } else {
    root.classList.remove('allow-select');
  }
}

// Improve scrolling performance
export function enableMomentumScrolling() {
  const scrollableElements = document.querySelectorAll('[data-scrollable]');
  scrollableElements.forEach(el => {
    el.style.webkitOverflowScrolling = 'touch';
  });
}

// Request fullscreen on mobile (for immersive experience)
export function requestFullscreen() {
  const elem = document.documentElement;
  const method = elem.requestFullscreen ||
    elem.webkitRequestFullscreen ||
    elem.mozRequestFullScreen ||
    elem.msRequestFullscreen;

  if (method) {
    method.call(elem);
  }
}

// Exit fullscreen
export function exitFullscreen() {
  if (document.fullscreenElement) {
    (document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen).call(document);
  }
}

// Handle keyboard visibility (mobile)
export function onKeyboardVisibility(callback) {
  let windowHeight = window.innerHeight;

  const handleResize = () => {
    const newHeight = window.innerHeight;
    const keyboardHeight = windowHeight - newHeight;
    const isVisible = keyboardHeight > 150;

    if (isVisible !== isKeyboardVisible) {
      isKeyboardVisible = isVisible;
      callback(isVisible, keyboardHeight);
    }
    windowHeight = newHeight;
  };

  let isKeyboardVisible = false;
  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
  };
}

// Improve form usability on mobile
export function optimizeFormForMobile() {
  const inputs = document.querySelectorAll('input, textarea, select');

  inputs.forEach(input => {
    // Auto-correct common mobile typos
    if (input.type === 'tel') {
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
    }

    // Improve email input on mobile
    if (input.type === 'email') {
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
    }

    // Add next/previous on mobile
    if (input.type === 'text' || input.type === 'email' || input.type === 'tel') {
      input.setAttribute('enterKeyHint', 'next');
    }

    // Focus handling for mobile
    input.addEventListener('focus', () => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

// Get device viewport info
export function getDeviceInfo() {
  const isPortrait = window.innerHeight > window.innerWidth;
  const isMobile = window.innerWidth <= 768;
  const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
  const isDesktop = window.innerWidth > 1024;

  return {
    isPortrait,
    isLandscape: !isPortrait,
    isMobile,
    isTablet,
    isDesktop,
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1
  };
}

// Network information utility
export function getNetworkInfo() {
  if ('connection' in navigator) {
    const conn = navigator.connection;
    return {
      effectiveType: conn.effectiveType,
      downlink: conn.downlink,
      rtt: conn.rtt,
      saveData: conn.saveData
    };
  }
  return null;
}

// Optimize for slow networks
export function optimizeForSlowNetwork() {
  const info = getNetworkInfo();
  if (info && (info.effectiveType === '4g' || info.effectiveType === '3g')) {
    // Reduce image quality or lazy load more aggressively
    document.documentElement.setAttribute('data-slow-network', 'true');
  }
}
