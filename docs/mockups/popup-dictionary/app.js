/* ============================================================
   app.js — state wiring, token clicks, dev controls, shortcuts
   ============================================================ */

import { createPopupState, rerenderPopup } from './popup.js?v=15';
import { createCreatorState, renderWorkspace, renderSettingsDialog } from './creator.js?v=12';
import { FIXTURES } from './fixtures.js?v=12';

const PREVIEW_MODES = ['desktop', 'tablet', 'mobile'];
const THEMES = ['dark', 'light'];
const VIEWS = ['popup', 'creator'];

const appState = {
  theme: 'dark',
  preview: 'desktop',
  view: 'popup',
  popupState: createPopupState(),
  creatorState: createCreatorState(),
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function init() {
  applyTheme(appState.theme);
  applyPreview(appState.preview);
  bindDevBar();
  bindContext();
  bindKeyboard();
  render();
}

function render() {
  const mount = $('#mount');
  mount.innerHTML = '';

  if (appState.view === 'popup') {
    renderPopupView(mount);
  } else {
    renderCreatorView(mount);
  }
}

function renderPopupView(mount) {
  const popupMount = document.createElement('div');
  popupMount.style.position = 'relative';
  popupMount.style.minHeight = '500px';
  mount.appendChild(popupMount);

  const callbacks = {
    onToggleEdit: () => {
      appState.popupState.editMode = !appState.popupState.editMode;
      rerenderPopup(popupMount, appState.popupState, callbacks);
    },
    onPanelToggle: () => rerenderPopup(popupMount, appState.popupState, callbacks),
    onSendToCreator: () => {
      appState.view = 'creator';
      appState.creatorState.popupState.fixtureKey = appState.popupState.fixtureKey;
      render();
    },
    onQuickAdd: () => {
      const dest = appState.popupState.config.srsDestination;
      if (dest === 'cell-memory') {
        showToast('Cell Memory stub: cannot add card', 'error');
      } else {
        showToast('Card added to Anki', 'success');
      }
    },
    onStatusChange: (s) => showToast(`Status: ${s}`),
    onImageToggle: () => rerenderPopup(popupMount, appState.popupState, callbacks),
  };

  // Position popup near center
  const popup = rerenderPopup(popupMount, appState.popupState, callbacks);
  popup.style.position = 'relative';
  popup.style.margin = 'var(--space-8) auto';
}

function renderCreatorView(mount) {
  const callbacks = {
    onToast: (msg, type) => showToast(msg, type),
    onQuickAdd: () => showToast('Card added to Anki', 'success'),
    onClose: () => {
      appState.view = 'popup';
      render();
    },
    onAdd: (dest) => {
      if (dest === 'cell-memory') {
        showToast('Cell Memory stub: cannot add card', 'error');
      } else {
        showToast('Card added to Anki', 'success');
      }
    },
    onSettingsOpen: () => {
      const overlay = renderSettingsDialog(mount, appState.creatorState, {
        onSettingsClose: () => {
          // Re-render workspace to reflect settings (e.g. boldTarget, sendCardTo)
          render();
        },
      });
      // Force open
      requestAnimationFrame(() => overlay.classList.add('is-open'));
    },
    onSettingsClose: () => render(),
  };

  renderWorkspace(mount, appState.creatorState, callbacks);

  // If settings should be open, render it
  if (appState.creatorState.settingsOpen) {
    const overlay = renderSettingsDialog(mount, appState.creatorState, {
      onSettingsClose: () => {
        appState.creatorState.settingsOpen = false;
        render();
      },
    });
    requestAnimationFrame(() => overlay.classList.add('is-open'));
  }
}

function bindDevBar() {
  // Theme
  $$('.js-theme').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.theme = btn.dataset.theme;
      applyTheme(appState.theme);
      $$('.js-theme').forEach((b) => b.classList.toggle('is-active', b.dataset.theme === appState.theme));
    });
  });

  // Preview
  $$('.js-preview').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.preview = btn.dataset.preview;
      applyPreview(appState.preview);
      $$('.js-preview').forEach((b) => b.classList.toggle('is-active', b.dataset.preview === appState.preview));
    });
  });

  // View
  $$('.js-view').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.view = btn.dataset.view;
      $$('.js-view').forEach((b) => b.classList.toggle('is-active', b.dataset.view === appState.view));
      render();
    });
  });

  // Fixture
  $$('.js-fixture').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.fixture;
      appState.popupState.fixtureKey = key;
      appState.creatorState.popupState.fixtureKey = key;
      $$('.js-fixture').forEach((b) => b.classList.toggle('is-active', b.dataset.fixture === key));
      render();
    });
  });
}

function bindContext() {
  $$('.token').forEach((tok) => {
    tok.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = tok.dataset.fixture;
      if (key) {
        appState.popupState.fixtureKey = key;
        appState.creatorState.popupState.fixtureKey = key;
        $$('.token').forEach((t) => t.classList.remove('is-active'));
        tok.classList.add('is-active');
        render();
      }
    });
  });
}

function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close settings if open, else close creator
      if (appState.creatorState.settingsOpen) {
        appState.creatorState.settingsOpen = false;
        render();
      } else if (appState.view === 'creator') {
        appState.view = 'popup';
        render();
      }
    }
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function applyPreview(mode) {
  const frame = $('#frame');
  frame.className = `preview-frame preview-frame--${mode}`;
}

function showToast(message, type = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast toast--${type} is-visible`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2500);
}

document.addEventListener('DOMContentLoaded', init);
