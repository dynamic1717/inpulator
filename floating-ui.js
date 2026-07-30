(function () {
  'use strict';

  if (window.__inputTranslateFloatingUi) return;

  window.InputTranslate = window.InputTranslate || {};

  const BUTTON_SIZE = 44;
  const RING_STROKE = 3;
  const RING_RADIUS = (BUTTON_SIZE - RING_STROKE) / 2;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  const LOADING_ICON = `<svg class="input-translate-spinner" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="14 42"/></svg>`;

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getShortLabel(id, fallback) {
    const languagesApi = window.InputTranslate.languages;
    if (languagesApi?.getShortLabel) return languagesApi.getShortLabel(id);
    const lang = languagesApi?.getLanguage?.(id);
    return lang?.shortLabel || fallback;
  }

  function getLanguageName(id, fallback) {
    return window.InputTranslate.languages?.getLanguage?.(id)?.name || fallback;
  }

  function buildTranslateIcon(sourceLanguage, targetLanguage) {
    const source = escapeXml(getShortLabel(sourceLanguage, 'РУ'));
    const target = escapeXml(getShortLabel(targetLanguage, 'EN'));

    return `<svg class="input-translate-icon" width="28" height="28" viewBox="0 0 62 62" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <style>
    .text{font:700 18px sans-serif}
  </style>
  <g clip-path="url(#clip0_2003_14)">
    <g filter="url(#filter0_d_2003_14)">
      <path d="M37.2 2H10.8C5.94 2 2 7.82 2 15s3.94 13 8.8 13h26.4c4.86 0 8.8-5.82 8.8-13S42.06 2 37.2 2" fill="url(#paint0_linear_2003_14)"/>
    </g>
    <text x="24" y="21" text-anchor="middle" class="text" fill="#fff">${source}</text>
    <g filter="url(#filter1_d_2003_14)">
      <path d="M42.375 32h-24.75C12.309 32 8 37.82 8 45s4.31 13 9.625 13h24.75C47.691 58 52 52.18 52 45s-4.31-13-9.625-13" fill="#fff"/>
    </g>
    <text x="30" y="51" text-anchor="middle" class="text" fill="#0e7c6b">${target}</text>
    <path d="M48.605 15.162c-.966.333-.724 1.632.363 1.842 1.449.281 4.408 2.422 5.837 4.246 3.322 4.194 3.06 10.177-.624 14.58-.785.948-.724.983-1.026-1.017-.242-1.755-.544-2.28-1.289-2.28-1.026 0-1.187.49-.825 2.578.161 1.036.362 2.474.443 3.176.221 2.088.12 2.053 4.79 1.035 3.584-.772 3.906-.93 3.664-1.754-.18-.667-.805-.737-2.717-.299-.926.193-1.731.334-1.772.281-.06-.052.242-.509.665-1.017 5.455-6.633 3.744-15.669-3.805-20.037-1.308-.755-3.08-1.562-3.24-1.492 0 0-.222.07-.464.158" fill="#0e7c6b"/>
  </g>
  <defs>
    <filter id="filter0_d_2003_14" x="-1" y="1" width="50" height="32" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
      <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset dy="2"/>
      <feGaussianBlur stdDeviation="1.5"/>
      <feComposite in2="hardAlpha" operator="out"/>
      <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"/>
      <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_2003_14"/>
      <feBlend in="SourceGraphic" in2="effect1_dropShadow_2003_14" result="shape"/>
    </filter>
    <filter id="filter1_d_2003_14" x="4" y="29" width="52" height="34" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
      <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset dy="1"/>
      <feGaussianBlur stdDeviation="2"/>
      <feComposite in2="hardAlpha" operator="out"/>
      <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0"/>
      <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_2003_14"/>
      <feBlend in="SourceGraphic" in2="effect1_dropShadow_2003_14" result="shape"/>
    </filter>
    <linearGradient id="paint0_linear_2003_14" x1="2" y1="2" x2="24.775" y2="40.542" gradientUnits="userSpaceOnUse">
      <stop stop-color="#14a08a"/>
      <stop offset="1" stop-color="#0e7c6b"/>
    </linearGradient>
    <clipPath id="clip0_2003_14">
      <path fill="#fff" d="M0 0h62v62H0z"/>
    </clipPath>
  </defs>
</svg>`;
  }

  function getUsageRatio(quota) {
    if (!quota || quota.limit == null || quota.limit <= 0) return null;
    const used =
      quota.charsUsed != null
        ? quota.charsUsed
        : quota.remaining != null
          ? Math.max(0, quota.limit - quota.remaining)
          : null;
    if (used == null) return null;
    return Math.min(1, Math.max(0, used / quota.limit));
  }

  function formatUsedPercent(ratio) {
    if (ratio == null) return null;
    const percent = ratio * 100;
    if (percent === 0) return '0%';
    if (percent < 0.01) return '<0.01%';
    if (percent < 1) return `${percent.toFixed(2)}%`;
    if (percent < 10) return `${percent.toFixed(1)}%`;
    return `${Math.round(percent)}%`;
  }

  function buildProgressRing(usageRatio) {
    const filledRatio = usageRatio == null ? 0 : usageRatio;
    const dashOffset = RING_CIRCUMFERENCE * (1 - filledRatio);
    const center = BUTTON_SIZE / 2;

    return `<svg class="input-translate-ring" width="${BUTTON_SIZE}" height="${BUTTON_SIZE}" viewBox="0 0 ${BUTTON_SIZE} ${BUTTON_SIZE}" aria-hidden="true">
  <circle class="input-translate-ring-track" cx="${center}" cy="${center}" r="${RING_RADIUS}"/>
  <circle class="input-translate-ring-progress" cx="${center}" cy="${center}" r="${RING_RADIUS}" stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${dashOffset}"/>
</svg>`;
  }

  function create({ onTranslate }) {
    let button = null;
    let toast = null;
    let toastTimer = null;

    function ensureButton() {
      if (button) return;

      button = document.createElement('button');
      button.id = 'input-translate-btn';
      button.type = 'button';
      button.setAttribute('aria-label', 'Перевести');
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', onTranslate);
      document.documentElement.appendChild(button);
    }

    function setTranslate({
      sourceLanguage = 'ru',
      targetLanguage = 'en',
      quota = null,
    } = {}) {
      ensureButton();
      button.disabled = false;

      const icon = buildTranslateIcon(sourceLanguage, targetLanguage);
      const targetName = getLanguageName(targetLanguage, targetLanguage);
      const pairLabel = `${getShortLabel(sourceLanguage, 'РУ')} → ${getShortLabel(targetLanguage, 'EN')}`;
      const usageRatio = getUsageRatio(quota);
      const usedPercent = formatUsedPercent(usageRatio);

      const ring = quota && quota.limit != null ? buildProgressRing(usageRatio) : '';

      button.innerHTML = `${ring}${icon}`;
      button.setAttribute('aria-label', `Перевести на ${targetName}`);
      button.title = usedPercent ? `${pairLabel} · ${usedPercent} used` : pairLabel;
    }

    return {
      contains(target) {
        if (!target) return false;
        return Boolean(button?.contains(target));
      },
      show(position) {
        ensureButton();
        button.style.left = `${position.x}px`;
        button.style.top = `${position.y}px`;
        button.hidden = false;
      },
      updatePosition(position) {
        if (!button) return;
        button.style.left = `${position.x}px`;
        button.style.top = `${position.y}px`;
      },
      setTranslate,
      setLoading() {
        ensureButton();
        button.innerHTML = LOADING_ICON;
        button.disabled = true;
        button.removeAttribute('title');
      },
      hide() {
        if (button) button.hidden = true;
      },
      showToast(message) {
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'input-translate-toast';
          document.documentElement.appendChild(toast);
        }
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          toast.hidden = true;
        }, 3000);
      },
    };
  }

  window.InputTranslate.floatingUi = { create };
  window.__inputTranslateFloatingUi = true;
})();
