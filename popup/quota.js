import { formatCount } from './lib/format.js';

export function createQuotaUi({ quotaLabel, quotaValue, quotaBar }) {
  async function load() {
    try {
      const quota = await chrome.runtime.sendMessage({ type: 'GET_QUOTA' });

      if (quota?.period === 'none' || quota?.limit == null) {
        quotaLabel.textContent = 'Limit';
        quotaValue.textContent = 'No limit';
        quotaBar.style.width = '0%';
        return;
      }

      const used = quota?.charsUsed ?? 0;
      const limit = quota?.limit ?? quota?.dailyLimit ?? 0;
      quotaLabel.textContent =
        quota?.period === 'day' ? 'Used today' : 'Used this month';
      quotaValue.textContent = `${formatCount(used)} / ${formatCount(limit)}`;
      const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
      quotaBar.style.width = `${percent}%`;
    } catch {
      quotaLabel.textContent = 'Used';
      quotaValue.textContent = '… / …';
      quotaBar.style.width = '0%';
    }
  }

  return { load };
}
