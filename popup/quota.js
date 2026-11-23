import { t } from '../i18n.js';
import { formatCount } from './lib/format.js';

export function createQuotaUi({ quotaLabel, quotaValue, quotaBar }) {
  async function load() {
    try {
      const quota = await chrome.runtime.sendMessage({ type: 'GET_QUOTA' });
      if (!quota || quota.error) throw new Error(quota?.error || 'No quota');

      if (quota?.period === 'none' || quota?.limit == null) {
        quotaLabel.textContent = t('popupQuotaLimit');
        quotaValue.textContent = t('popupQuotaNoLimit');
        quotaBar.style.width = '0%';
        return;
      }

      const used = quota?.charsUsed ?? 0;
      const limit = quota?.limit ?? 0;
      quotaLabel.textContent = t(
        quota?.period === 'day' ? 'popupQuotaUsedToday' : 'popupQuotaUsedMonth'
      );
      // Local counters roll over on UTC dates, not local midnight.
      quotaValue.title =
        quota?.period === 'day' ? t('popupQuotaResetDay') : t('popupQuotaResetMonth');
      quotaValue.textContent = `${formatCount(used)} / ${formatCount(limit)}`;
      const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
      quotaBar.style.width = `${percent}%`;
    } catch {
      quotaLabel.textContent = t('popupQuotaUsed');
      quotaValue.textContent = '… / …';
      quotaBar.style.width = '0%';
    }
  }

  return { load };
}
