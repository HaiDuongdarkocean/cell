# 16. Theme Management System — Hệ thống Quản lý Theme

### 16.1 Triết lý Thiết kế Theme

Orca kết hợp hai phong cách thiết kế chính để tạo ra hệ thống theme linh hoạt và hiện đại:

**Light Mode (Cluely):**
- Radiant cloud-native aesthetic với ethereal gradients
- Frosted glass elements tạo cảm giác AI "trong" hệ thống
- Digital blue accent (#3c83f6) cho interactive elements
- Light surfaces với subtle shadows

**Dark Mode (Midnight Command Center):**
- Midnight command center feel với subtle translucency
- Glowing accents của blue, green, và violet
- Spacious, comfortable layout
- Frosted overlays trên dark canvas

**Nguyên tắc chung:**
- **Consistency:** Cùng component behavior, chỉ thay đổi màu sắc
- **Accessibility:** Đảm bảo WCAG AA contrast ratio cho cả hai mode
- **Performance:** CSS variables cho instant theme switching
- **Maintainability:** Token-based design system
- **Future-proof:** Dễ dàng thêm theme mới

### 16.2 Theme Architecture

#### 16.2.1 CSS Variables Structure

```css
:root {
  /* === Theme Identity === */
  --theme-name: 'cluely-light';
  --theme-mode: 'light';
  
  /* === Color Palette === */
  /* Primary Colors */
  --color-primary: #3c83f6;
  --color-primary-hover: #2b6ad9;
  --color-primary-active: #1a52b8;
  
  /* Background Colors */
  --color-canvas: #ffffff;
  --color-surface: #f3f8ff;
  --color-surface-elevated: #ffffff;
  --color-surface-overlay: rgba(255, 255, 255, 0.9);
  
  /* Text Colors */
  --color-text-primary: #000000;
  --color-text-secondary: #2e3038;
  --color-text-tertiary: #777a88;
  --color-text-inverse: #ffffff;
  
  /* Border Colors */
  --color-border: #e4e4e7;
  --color-border-subtle: #f1f5f9;
  --color-border-focus: #3c83f6;
  
  /* Status Colors */
  --color-success: #00ff26;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3c83f6;
  
  /* === Typography === */
  --font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-display: 'EB Garamond', 'Garamond', serif;
  --font-family-mono: 'JetBrains Mono', 'ui-monospace', monospace;
  
  /* Type Scale */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 24px;
  --text-2xl: 32px;
  --text-3xl: 42px;
  --text-4xl: 56px;
  --text-display: 80px;
  
  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
  
  /* === Spacing === */
  --spacing-0: 0;
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;
  
  /* === Border Radius === */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
  
  /* === Shadows === */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
  
  /* === Motion === */
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-in: cubic-bezier(0.3, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0, 1);
  
  /* === Z-Index === */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-fixed: 300;
  --z-modal-backdrop: 400;
  --z-modal: 500;
  --z-popover: 600;
  --z-tooltip: 700;
}

[data-theme="dark"] {
  /* === Theme Identity === */
  --theme-name: 'midnight-dark';
  --theme-mode: 'dark';
  
  /* === Color Palette === */
  /* Primary Colors */
  --color-primary: #8dd6ff;
  --color-primary-hover: #7bc8f7;
  --color-primary-active: #6ab4f4;
  
  /* Background Colors */
  --color-canvas: #0d1117;
  --color-surface: #151a22;
  --color-surface-elevated: #21262d;
  --color-surface-overlay: rgba(13, 17, 23, 0.9);
  
  /* Text Colors */
  --color-text-primary: #ffffff;
  --color-text-secondary: #f0f6fc;
  --color-text-tertiary: #9198a1;
  --color-text-inverse: #0d1117;
  
  /* Border Colors */
  --color-border: #21262d;
  --color-border-subtle: #283041;
  --color-border-focus: #8dd6ff;
  
  /* Status Colors */
  --color-success: #5fed83;
  --color-warning: #f59e0b;
  --color-error: #ff6b6b;
  --color-info: #8dd6ff;
}
```

#### 16.2.2 Theme Configuration Object (JavaScript)

```javascript
// src/theme/ThemeConfig.js

const THEME_CLUELY_LIGHT = {
  id: 'cluely-light',
  name: 'Cluely Light',
  mode: 'light',
  colors: {
    primary: '#3c83f6',
    primaryHover: '#2b6ad9',
    primaryActive: '#1a52b8',
    canvas: '#ffffff',
    surface: '#f3f8ff',
    surfaceElevated: '#ffffff',
    surfaceOverlay: 'rgba(255, 255, 255, 0.9)',
    textPrimary: '#000000',
    textSecondary: '#2e3038',
    textTertiary: '#777a88',
    textInverse: '#ffffff',
    border: '#e4e4e7',
    borderSubtle: '#f1f5f9',
    borderFocus: '#3c83f6',
    success: '#00ff26',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3c83f6'
  },
  typography: {
    fontFamilyPrimary: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontFamilyDisplay: "'EB Garamond', 'Garamond', serif",
    fontFamilyMono: "'JetBrains Mono', 'ui-monospace', monospace"
  },
  spacing: {
    '1': '4px',
    '2': '8px',
    '3': '12px',
    '4': '16px',
    '5': '20px',
    '6': '24px',
    '8': '32px',
    '10': '40px',
    '12': '48px',
    '16': '64px'
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '24px',
    full: '9999px'
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15)'
  }
};

const THEME_MIDNIGHT_DARK = {
  id: 'midnight-dark',
  name: 'Midnight Dark',
  mode: 'dark',
  colors: {
    primary: '#8dd6ff',
    primaryHover: '#7bc8f7',
    primaryActive: '#6ab4f4',
    canvas: '#0d1117',
    surface: '#151a22',
    surfaceElevated: '#21262d',
    surfaceOverlay: 'rgba(13, 17, 23, 0.9)',
    textPrimary: '#ffffff',
    textSecondary: '#f0f6fc',
    textTertiary: '#9198a1',
    textInverse: '#0d1117',
    border: '#21262d',
    borderSubtle: '#283041',
    borderFocus: '#8dd6ff',
    success: '#5fed83',
    warning: '#f59e0b',
    error: '#ff6b6b',
    info: '#8dd6ff'
  },
  typography: {
    fontFamilyPrimary: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontFamilyDisplay: "'EB Garamond', 'Garamond', serif",
    fontFamilyMono: "'JetBrains Mono', 'ui-monospace', monospace"
  },
  spacing: THEME_CLUELY_LIGHT.spacing,
  borderRadius: THEME_CLUELY_LIGHT.borderRadius,
  shadows: THEME_CLUELY_LIGHT.shadows
};

const AVAILABLE_THEMES = [
  THEME_CLUELY_LIGHT,
  THEME_MIDNIGHT_DARK
];

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    THEME_CLUELY_LIGHT,
    THEME_MIDNIGHT_DARK,
    AVAILABLE_THEMES
  };
}
```

### 16.3 Theme Manager Implementation (JavaScript)

```javascript
// src/theme/ThemeManager.js

class ThemeManager {
  constructor() {
    this.currentTheme = null;
    this.themeMode = 'auto';
    this.listeners = [];
    this.initialize();
  }

  initialize() {
    // Load available themes
    this.availableThemes = this.loadAvailableThemes();
    
    // Load saved theme preference
    this.loadFromStorage();
    
    // Setup system theme listener
    this.setupSystemThemeListener();
    
    // Apply initial theme
    if (!this.currentTheme) {
      this.currentTheme = this.availableThemes[0];
    }
    this.applyTheme(this.currentTheme);
  }

  loadAvailableThemes() {
    // This would normally import from ThemeConfig.js
    // For now, return the themes directly
    return [
      {
        id: 'cluely-light',
        name: 'Cluely Light',
        mode: 'light',
        colors: {
          primary: '#3c83f6',
          primaryHover: '#2b6ad9',
          primaryActive: '#1a52b8',
          canvas: '#ffffff',
          surface: '#f3f8ff',
          surfaceElevated: '#ffffff',
          surfaceOverlay: 'rgba(255, 255, 255, 0.9)',
          textPrimary: '#000000',
          textSecondary: '#2e3038',
          textTertiary: '#777a88',
          textInverse: '#ffffff',
          border: '#e4e4e7',
          borderSubtle: '#f1f5f9',
          borderFocus: '#3c83f6',
          success: '#00ff26',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3c83f6'
        },
        typography: {
          fontFamilyPrimary: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontFamilyDisplay: "'EB Garamond', 'Garamond', serif",
          fontFamilyMono: "'JetBrains Mono', 'ui-monospace', monospace"
        },
        spacing: {
          '1': '4px',
          '2': '8px',
          '3': '12px',
          '4': '16px',
          '5': '20px',
          '6': '24px',
          '8': '32px',
          '10': '40px',
          '12': '48px',
          '16': '64px'
        },
        borderRadius: {
          sm: '4px',
          md: '8px',
          lg: '12px',
          xl: '16px',
          '2xl': '24px',
          full: '9999px'
        },
        shadows: {
          sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
          md: '0 4px 6px rgba(0, 0, 0, 0.1)',
          lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
          xl: '0 20px 25px rgba(0, 0, 0, 0.15)'
        }
      },
      {
        id: 'midnight-dark',
        name: 'Midnight Dark',
        mode: 'dark',
        colors: {
          primary: '#8dd6ff',
          primaryHover: '#7bc8f7',
          primaryActive: '#6ab4f4',
          canvas: '#0d1117',
          surface: '#151a22',
          surfaceElevated: '#21262d',
          surfaceOverlay: 'rgba(13, 17, 23, 0.9)',
          textPrimary: '#ffffff',
          textSecondary: '#f0f6fc',
          textTertiary: '#9198a1',
          textInverse: '#0d1117',
          border: '#21262d',
          borderSubtle: '#283041',
          borderFocus: '#8dd6ff',
          success: '#5fed83',
          warning: '#f59e0b',
          error: '#ff6b6b',
          info: '#8dd6ff'
        },
        typography: {
          fontFamilyPrimary: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontFamilyDisplay: "'EB Garamond', 'Garamond', serif",
          fontFamilyMono: "'JetBrains Mono', 'ui-monospace', monospace"
        },
        spacing: {
          '1': '4px',
          '2': '8px',
          '3': '12px',
          '4': '16px',
          '5': '20px',
          '6': '24px',
          '8': '32px',
          '10': '40px',
          '12': '48px',
          '16': '64px'
        },
        borderRadius: {
          sm: '4px',
          md: '8px',
          lg: '12px',
          xl: '16px',
          '2xl': '24px',
          full: '9999px'
        },
        shadows: {
          sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
          md: '0 4px 6px rgba(0, 0, 0, 0.1)',
          lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
          xl: '0 20px 25px rgba(0, 0, 0, 0.15)'
        }
      }
    ];
  }

  loadFromStorage() {
    const savedThemeId = localStorage.getItem('orca-theme-id');
    const savedMode = localStorage.getItem('orca-theme-mode');

    if (savedThemeId) {
      const theme = this.availableThemes.find(t => t.id === savedThemeId);
      if (theme) {
        this.currentTheme = theme;
      }
    }

    if (savedMode) {
      this.themeMode = savedMode;
    }
  }

  setupSystemThemeListener() {
    if (window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleSystemThemeChange = (e) => {
        if (this.themeMode === 'auto') {
          const systemTheme = e.matches ? 'midnight-dark' : 'cluely-light';
          this.setTheme(systemTheme);
        }
      };

      darkModeQuery.addEventListener('change', handleSystemThemeChange);
    }
  }

  setTheme(themeId) {
    const theme = this.availableThemes.find(t => t.id === themeId);
    if (!theme) {
      console.warn(`Theme ${themeId} not found`);
      return;
    }

    this.currentTheme = theme;
    this.applyTheme(theme);
    this.saveToStorage();
    this.notifyListeners();
  }

  setThemeMode(mode) {
    this.themeMode = mode;
    
    if (mode === 'auto') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme = prefersDark ? 'midnight-dark' : 'cluely-light';
      this.setTheme(systemTheme);
    } else if (mode === 'light') {
      this.setTheme('cluely-light');
    } else if (mode === 'dark') {
      this.setTheme('midnight-dark');
    }

    localStorage.setItem('orca-theme-mode', mode);
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  getAvailableThemes() {
    return this.availableThemes;
  }

  getThemeMode() {
    return this.themeMode;
  }

  applyTheme(theme) {
    const root = document.documentElement;
    
    // Set theme attribute
    root.setAttribute('data-theme', theme.mode);
    
    // Apply CSS variables
    this.applyCSSVariables(theme);
  }

  applyCSSVariables(theme) {
    const root = document.documentElement;
    
    // Colors
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-primary-hover', theme.colors.primaryHover);
    root.style.setProperty('--color-primary-active', theme.colors.primaryActive);
    root.style.setProperty('--color-canvas', theme.colors.canvas);
    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-surface-elevated', theme.colors.surfaceElevated);
    root.style.setProperty('--color-surface-overlay', theme.colors.surfaceOverlay);
    root.style.setProperty('--color-text-primary', theme.colors.textPrimary);
    root.style.setProperty('--color-text-secondary', theme.colors.textSecondary);
    root.style.setProperty('--color-text-tertiary', theme.colors.textTertiary);
    root.style.setProperty('--color-text-inverse', theme.colors.textInverse);
    root.style.setProperty('--color-border', theme.colors.border);
    root.style.setProperty('--color-border-subtle', theme.colors.borderSubtle);
    root.style.setProperty('--color-border-focus', theme.colors.borderFocus);
    root.style.setProperty('--color-success', theme.colors.success);
    root.style.setProperty('--color-warning', theme.colors.warning);
    root.style.setProperty('--color-error', theme.colors.error);
    root.style.setProperty('--color-info', theme.colors.info);
    
    // Typography
    root.style.setProperty('--font-family-primary', theme.typography.fontFamilyPrimary);
    root.style.setProperty('--font-family-display', theme.typography.fontFamilyDisplay);
    root.style.setProperty('--font-family-mono', theme.typography.fontFamilyMono);
    
    // Spacing
    Object.entries(theme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });
    
    // Border Radius
    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });
    
    // Shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });
  }

  saveToStorage() {
    localStorage.setItem('orca-theme-id', this.currentTheme.id);
    localStorage.setItem('orca-theme-mode', this.themeMode);
  }

  subscribe(listener) {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentTheme));
  }

  reset() {
    this.setTheme('cluely-light');
    this.setThemeMode('auto');
  }
}

// Create singleton instance
const themeManager = new ThemeManager();

// Export for use in browser
if (typeof window !== 'undefined') {
  window.themeManager = themeManager;
}

// Export for Node.js modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = themeManager;
}
```

### 16.4 Theme Selector Component (HTML/CSS/JS)

#### 16.4.1 HTML Structure

```html
<!-- Theme Selector Component -->
<div class="theme-selector" id="themeSelector">
  <div class="theme-mode-selector">
    <button 
      class="mode-button" 
      data-mode="light" 
      aria-label="Light mode"
      title="Light mode"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    </button>
    <button 
      class="mode-button" 
      data-mode="dark" 
      aria-label="Dark mode"
      title="Dark mode"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </button>
    <button 
      class="mode-button" 
      data-mode="auto" 
      aria-label="Auto theme"
      title="Auto theme"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    </button>
  </div>

  <div class="theme-grid" id="themeGrid" style="display: none;">
    <!-- Theme cards will be generated by JavaScript -->
  </div>
</div>
```

#### 16.4.2 CSS Styles

```css
/* Theme Selector Styles */
.theme-selector {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.theme-mode-selector {
  display: flex;
  gap: var(--spacing-2);
  background: var(--color-surface);
  padding: var(--spacing-2);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.mode-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}

.mode-button:hover {
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
}

.mode-button.active {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--spacing-3);
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-canvas);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}

.theme-card:hover {
  border-color: var(--color-border-focus);
  transform: translateY(-2px);
}

.theme-card.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary);
}

.theme-preview {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
  border: 1px solid var(--color-border);
}

.theme-preview-primary {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.theme-name {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-primary);
  text-align: center;
}

/* Theme transition for smooth switching */
* {
  transition: 
    background-color var(--duration-normal) var(--ease-standard),
    color var(--duration-normal) var(--ease-standard),
    border-color var(--duration-normal) var(--ease-standard),
    box-shadow var(--duration-normal) var(--ease-standard);
}
```

#### 16.4.3 JavaScript Implementation

```javascript
// src/ui/ThemeSelector.js

class ThemeSelector {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.modeButtons = this.container.querySelectorAll('.mode-button');
    this.themeGrid = this.container.querySelector('#themeGrid');
    this.currentMode = 'auto';
    
    this.init();
  }

  init() {
    // Load current mode from localStorage
    const savedMode = localStorage.getItem('orca-theme-mode') || 'auto';
    this.currentMode = savedMode;
    
    // Set active mode button
    this.updateModeButtons();
    
    // Add event listeners
    this.modeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const mode = button.dataset.mode;
        this.setMode(mode);
      });
    });
    
    // Generate theme cards if in manual mode
    if (this.currentMode === 'manual') {
      this.generateThemeCards();
      this.themeGrid.style.display = 'grid';
    }
    
    // Listen for theme changes
    if (window.themeManager) {
      window.themeManager.subscribe((theme) => {
        this.updateThemeCards(theme);
      });
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    localStorage.setItem('orca-theme-mode', mode);
    
    // Update mode buttons
    this.updateModeButtons();
    
    // Handle theme switching
    if (mode === 'auto') {
      // Detect system preference
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme = prefersDark ? 'midnight-dark' : 'cluely-light';
      
      if (window.themeManager) {
        window.themeManager.setTheme(systemTheme);
      }
      
      // Hide theme grid
      this.themeGrid.style.display = 'none';
    } else if (mode === 'light') {
      if (window.themeManager) {
        window.themeManager.setTheme('cluely-light');
      }
      
      // Hide theme grid
      this.themeGrid.style.display = 'none';
    } else if (mode === 'dark') {
      if (window.themeManager) {
        window.themeManager.setTheme('midnight-dark');
      }
      
      // Hide theme grid
      this.themeGrid.style.display = 'none';
    } else if (mode === 'manual') {
      // Show theme grid
      this.generateThemeCards();
      this.themeGrid.style.display = 'grid';
    }
  }

  updateModeButtons() {
    this.modeButtons.forEach(button => {
      if (button.dataset.mode === this.currentMode) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  generateThemeCards() {
    if (!window.themeManager) return;
    
    const themes = window.themeManager.getAvailableThemes();
    const currentTheme = window.themeManager.getCurrentTheme();
    
    this.themeGrid.innerHTML = '';
    
    themes.forEach(theme => {
      const card = document.createElement('div');
      card.className = 'theme-card';
      if (currentTheme && currentTheme.id === theme.id) {
        card.classList.add('active');
      }
      
      card.innerHTML = `
        <div class="theme-preview" style="background-color: ${theme.colors.surface}; border-color: ${theme.colors.border}">
          <div class="theme-preview-primary" style="background-color: ${theme.colors.primary}"></div>
        </div>
        <span class="theme-name">${theme.name}</span>
      `;
      
      card.addEventListener('click', () => {
        if (window.themeManager) {
          window.themeManager.setTheme(theme.id);
        }
      });
      
      this.themeGrid.appendChild(card);
    });
  }

  updateThemeCards(currentTheme) {
    const cards = this.themeGrid.querySelectorAll('.theme-card');
    
    cards.forEach(card => {
      card.classList.remove('active');
      
      // Find theme name from card
      const themeName = card.querySelector('.theme-name').textContent;
      if (currentTheme && currentTheme.name === themeName) {
        card.classList.add('active');
      }
    });
  }
}

// Initialize theme selector when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const themeSelector = new ThemeSelector('themeSelector');
  
  // Make it globally accessible
  window.themeSelector = themeSelector;
});
```

### 16.5 Component Theme Integration

#### 16.5.1 Button Component

```html
<!-- Button Component -->
<button class="btn btn-primary">Primary Button</button>
<button class="btn btn-secondary">Secondary Button</button>
<button class="btn btn-ghost">Ghost Button</button>
<button class="btn btn-danger">Danger Button</button>
```

```css
/* Button Component Styles */
.btn {
  font-family: var(--font-family-primary);
  font-size: var(--text-base);
  font-weight: 500;
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.btn-primary:active:not(:disabled) {
  background-color: var(--color-primary-active);
}

.btn-secondary {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-surface-elevated);
}

.btn-ghost {
  background-color: transparent;
  color: var(--color-text-primary);
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--color-surface);
}

.btn-danger {
  background-color: var(--color-error);
  color: var(--color-text-inverse);
}

.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-sm {
  padding: var(--spacing-1) var(--spacing-3);
  font-size: var(--text-sm);
}

.btn-lg {
  padding: var(--spacing-3) var(--spacing-6);
  font-size: var(--text-lg);
}
```

#### 16.5.2 Card Component

```html
<!-- Card Component -->
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Card Title</h3>
  </div>
  <div class="card-body">
    <p class="card-text">Card content goes here.</p>
  </div>
</div>

<div class="card card-elevated">
  <div class="card-header">
    <h3 class="card-title">Elevated Card</h3>
  </div>
  <div class="card-body">
    <p class="card-text">Elevated card content.</p>
  </div>
</div>
```

```css
/* Card Component Styles */
.card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-normal) var(--ease-standard);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card-elevated {
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
}

.card-header {
  margin-bottom: var(--spacing-4);
}

.card-title {
  font-family: var(--font-family-primary);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.card-body {
  color: var(--color-text-secondary);
}

.card-text {
  font-family: var(--font-family-primary);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  margin: 0;
}
```

#### 16.5.3 Input Component

```html
<!-- Input Component -->
<div class="input-group">
  <label class="input-label" for="exampleInput">Email</label>
  <input 
    type="email" 
    id="exampleInput" 
    class="input" 
    placeholder="Enter your email"
  />
</div>

<div class="input-group">
  <label class="input-label" for="searchInput">Search</label>
  <div class="input-wrapper">
    <input 
      type="text" 
      id="searchInput" 
      class="input input-with-icon" 
      placeholder="Search..."
    />
    <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  </div>
</div>
```

```css
/* Input Component Styles */
.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.input-label {
  font-family: var(--font-family-primary);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-1);
}

.input {
  font-family: var(--font-family-primary);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background-color: var(--color-canvas);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-2) var(--spacing-3);
  transition: all var(--duration-fast) var(--ease-standard);
}

.input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 2px var(--color-border-focus);
}

.input::placeholder {
  color: var(--color-text-tertiary);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-icon {
  padding-right: var(--spacing-8);
}

.input-icon {
  position: absolute;
  right: var(--spacing-3);
  color: var(--color-text-tertiary);
  pointer-events: none;
}
```

### 16.6 Theme-Specific Considerations

#### 16.6.1 Light Mode (Cluely) Specifics

**Color Usage:**
- Primary action: Digital Blue (#3c83f6)
- Success: System Green (#00ff26) - use sparingly as accent
- Backgrounds: Sky Canvas (#f3f8ff) for subtle emphasis
- Gradients: Process Blue Gradient for hero sections

**Typography:**
- Headings: EB Garamond for sophisticated feel
- Body: Inter for modern clarity
- Display: Large sizes with tight letter-spacing

**Components:**
- Buttons: Pill-shaped (very large radius)
- Cards: 24px border radius, frosted glass effect
- Inputs: Bottom border only, transparent background

#### 16.6.2 Dark Mode (Midnight) Specifics

**Color Usage:**
- Primary action: Polar Blue (#8dd6ff) for interactive elements
- Success: Spring Green (#08872b) for primary actions
- Backgrounds: Deep Space (#0d1117) for main canvas
- Accents: Cosmic Violet (#8c93fb) for decorative elements

**Typography:**
- Headings: Inter for modern, technical feel
- Body: Inter for consistency
- Code: JetBrains Mono for technical content

**Components:**
- Buttons: 6px border radius, slightly rounded
- Cards: 24px border radius, frosted overlay effect
- Inputs: 8px border radius, transparent background

### 16.7 Accessibility & Theme

#### 16.7.1 Contrast Requirements

```javascript
// src/theme/ThemeValidator.js

function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}

function getContrastRatio(hex1, hex2) {
  const luminance1 = getLuminance(hex1);
  const luminance2 = getLuminance(hex2);
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
}

function validateThemeContrast(theme) {
  const issues = [];
  
  // Check primary contrast
  const primaryContrast = getContrastRatio(theme.colors.textInverse, theme.colors.primary);
  if (primaryContrast < 4.5) {
    issues.push(`Primary color contrast ratio ${primaryContrast.toFixed(2)}:1 is below WCAG AA requirement (4.5:1)`);
  }
  
  // Check text contrast
  const textContrast = getContrastRatio(theme.colors.textPrimary, theme.colors.canvas);
  if (textContrast < 4.5) {
    issues.push(`Text contrast ratio ${textContrast.toFixed(2)}:1 is below WCAG AA requirement (4.5:1)`);
  }
  
  // Check border contrast
  const borderContrast = getContrastRatio(theme.colors.border, theme.colors.canvas);
  if (borderContrast < 1.5) {
    issues.push(`Border contrast ratio ${borderContrast.toFixed(2)}:1 is below minimum requirement (1.5:1)`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
```

#### 16.7.2 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .theme-card:hover {
    transform: none !important;
  }
  
  .mode-button:hover {
    transform: none !important;
  }
}
```

### 16.8 i18n Integration

#### 16.8.1 Theme Names Translation

```javascript
// src/i18n/translations.js

const translations = {
  'en-US': {
    theme: {
      title: 'Theme',
      light: 'Light',
      dark: 'Dark', 
      auto: 'Auto',
      cluelyLight: 'Cluely Light',
      midnightDark: 'Midnight Dark',
      selectTheme: 'Select theme',
      themeMode: 'Theme mode'
    }
  },
  'vi-VN': {
    theme: {
      title: 'Giao diện',
      light: 'Sáng',
      dark: 'Tối',
      auto: 'Tự động',
      cluelyLight: 'Cluely Sáng',
      midnightDark: 'Midnight Tối',
      selectTheme: 'Chọn giao diện',
      themeMode: 'Chế độ giao diện'
    }
  }
};

function t(key, locale = 'en-US') {
  const keys = key.split('.');
  let value = translations[locale];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if not found
    }
  }
  
  return value;
}
```

### 16.9 Performance Considerations

#### 16.9.1 CSS Variable Performance

```css
/* Use CSS variables for performant theme switching */
.theme-transition {
  transition: 
    background-color var(--duration-normal) var(--ease-standard),
    color var(--duration-normal) var(--ease-standard),
    border-color var(--duration-normal) var(--ease-standard),
    box-shadow var(--duration-normal) var(--ease-standard);
}

/* Avoid expensive properties in transitions */
.no-transition-transform {
  /* Don't transition transform - can cause layout thrashing */
}
```

### 16.10 Testing & Validation

#### 16.10.1 Theme Testing Checklist

```javascript
// tests/theme.test.js

function testThemeManager() {
  console.log('Testing Theme Manager...');
  
  // Test 1: Initialize with default theme
  const manager = new ThemeManager();
  const defaultTheme = manager.getCurrentTheme();
  console.assert(defaultTheme.id === 'cluely-light', 'Default theme should be Cluely Light');
  
  // Test 2: Switch between themes
  manager.setTheme('midnight-dark');
  const darkTheme = manager.getCurrentTheme();
  console.assert(darkTheme.id === 'midnight-dark', 'Theme should switch to Midnight Dark');
  
  // Test 3: Theme mode switching
  manager.setThemeMode('light');
  console.assert(manager.getThemeMode() === 'light', 'Theme mode should be light');
  
  // Test 4: Persistence
  const newManager = new ThemeManager();
  console.assert(newManager.getCurrentTheme().id === 'midnight-dark', 'Theme preference should persist');
  
  // Test 5: Contrast validation
  const validationResult = validateThemeContrast(darkTheme);
  console.assert(validationResult.valid, 'Dark theme should pass contrast validation');
  
  console.log('All tests passed!');
}

// Run tests
testThemeManager();
```

### 16.11 Best Practices

| Do | Don't |
|---|---|
| ✅ Use CSS variables for all themeable properties | ❌ Hardcode colors in components |
| ✅ Test themes in both light and dark modes | ❌ Only test in one theme |
| ✅ Ensure WCAG AA contrast ratios | ❌ Ignore accessibility requirements |
| ✅ Use semantic color names (primary, surface) | ❌ Use literal color names (blue, dark-blue) |
| ✅ Provide smooth transitions between themes | ❌ Abrupt theme changes |
| ✅ Respect user's system theme preference | ❌ Force theme regardless of preference |
| ✅ Support reduced motion preferences | ❌ Heavy animations in all cases |
| ✅ Document theme-specific behaviors | ❌ Assume themes behave identically |

### 16.12 Troubleshooting

#### 16.12.1 Common Issues

**Issue:** Theme not applying correctly
- **Solution:** Ensure CSS variables are properly defined and applied to `:root`
- **Check:** Browser dev tools → Computed styles → verify variable values

**Issue:** Poor contrast in dark mode
- **Solution:** Use ThemeValidator to check contrast ratios
- **Fix:** Adjust color values in theme config

**Issue:** Performance degradation during theme switch
- **Solution:** Use CSS variables instead of JavaScript-based theming
- **Optimize:** Limit transitions to essential properties only

**Issue:** Theme preference not persisting
- **Solution:** Check localStorage functionality and quota limits
- **Debug:** Verify ThemeManager.saveToStorage() is called correctly

### 16.13 Conclusion

Hệ thống Theme Management của Orca cung cấp:

1. **Flexible Architecture:** Dễ dàng thêm theme mới
2. **Performance:** CSS variables cho instant switching
3. **Accessibility:** WCAG AA compliant contrast ratios
4. **User Control:** Light/dark/auto modes với custom themes
5. **Developer Experience:** Vanilla JavaScript implementation
6. **Future-Proof:** Extensible cho custom themes và presets

Hệ thống này đảm bảo trải nghiệm người dùng nhất quán across all platforms trong khi sử dụng HTML, CSS, và JavaScript thuần, không phụ thuộc vào framework phức tạp.