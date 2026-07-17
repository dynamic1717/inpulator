(function () {
  'use strict';

  const settingsApi = window.InputTranslate.settings;
  const enabledToggle = document.getElementById('enabled-toggle');
  const counterToggle = document.getElementById('counter-toggle');
  const quotaValue = document.getElementById('quota-value');
  const quotaBar = document.getElementById('quota-bar');

  function formatCount(value) {
    if (value == null) return '…';
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function applySettingsToUi(settings) {
    enabledToggle.checked = settings.enabled;
    counterToggle.checked = settings.showCharCounter;
  }

  async function loadQuota() {
    try {
      const quota = await chrome.runtime.sendMessage({ type: 'GET_QUOTA' });
      const used = quota?.charsUsed ?? 0;
      const limit = quota?.dailyLimit ?? 50000;
      quotaValue.textContent = `${formatCount(used)} / ${formatCount(limit)}`;
      const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
      quotaBar.style.width = `${percent}%`;
    } catch {
      quotaValue.textContent = '… / …';
      quotaBar.style.width = '0%';
    }
  }

  async function init() {
    const settings = await settingsApi.getSettings();
    applySettingsToUi(settings);
    await loadQuota();

    enabledToggle.addEventListener('change', async () => {
      const next = await settingsApi.setSettings({ enabled: enabledToggle.checked });
      applySettingsToUi(next);
    });

    counterToggle.addEventListener('change', async () => {
      const next = await settingsApi.setSettings({
        showCharCounter: counterToggle.checked,
      });
      applySettingsToUi(next);
    });

    settingsApi.subscribe(applySettingsToUi);
  }

  init();
})();
