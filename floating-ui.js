(function () {
  'use strict';

  if (window.__inputTranslateFloatingUi) return;

  window.InputTranslate = window.InputTranslate || {};

  const TRANSLATE_ICON = `<svg width="32" height="32" viewBox="0 0 62 62" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_2003_14)">
<g filter="url(#filter0_d_2003_14)">
<path d="M37.2 2H10.8C5.93989 2 2 7.8203 2 15C2 22.1797 5.93989 28 10.8 28H37.2C42.0601 28 46 22.1797 46 15C46 7.8203 42.0601 2 37.2 2Z" fill="url(#paint0_linear_2003_14)"/>
</g>
<path d="M12.1399 23V8.45455H17.8785C18.9818 8.45455 19.9216 8.66525 20.6981 9.08665C21.4747 9.50331 22.0665 10.0833 22.4737 10.8267C22.8856 11.5653 23.0916 12.4176 23.0916 13.3835C23.0916 14.3494 22.8833 15.2017 22.4666 15.9403C22.0499 16.679 21.4463 17.2543 20.6555 17.6662C19.8695 18.0781 18.9178 18.2841 17.8004 18.2841H14.1427V15.8196H17.3033C17.8951 15.8196 18.3828 15.7178 18.7663 15.5142C19.1546 15.3059 19.4434 15.0194 19.6328 14.6548C19.8269 14.2855 19.924 13.8617 19.924 13.3835C19.924 12.9006 19.8269 12.4792 19.6328 12.1193C19.4434 11.7547 19.1546 11.473 18.7663 11.2741C18.3781 11.0705 17.8856 10.9688 17.2891 10.9688H15.2152V23H12.1399ZM26.6587 23.1989V20.6989H27.4471C27.8401 20.6989 28.1573 20.6515 28.3988 20.5568C28.6403 20.4574 28.832 20.313 28.9741 20.1236C29.1209 19.9295 29.244 19.688 29.3434 19.3991L29.5209 18.9233L24.2369 8.45455H27.4187L30.842 15.6136L33.7042 8.45455H36.8434L31.8292 20.1449C31.5877 20.6847 31.3012 21.1866 30.9698 21.6506C30.6431 22.1146 30.2241 22.4886 29.7127 22.7727C29.2013 23.0568 28.5479 23.1989 27.7525 23.1989H26.6587Z" fill="white"/>
<g filter="url(#filter1_d_2003_14)">
<path d="M42.375 32H17.625C12.3093 32 8 37.8203 8 45C8 52.1797 12.3093 58 17.625 58H42.375C47.6907 58 52 52.1797 52 45C52 37.8203 47.6907 32 42.375 32Z" fill="white"/>
</g>
<path d="M17.7876 53V38.4545H27.5888V40.9901H20.8629V44.456H27.0845V46.9915H20.8629V50.4645H27.6172V53H17.7876ZM42.1999 38.4545V53H39.5437L33.2156 43.8452H33.109V53H30.0337V38.4545H32.7326L39.011 47.6023H39.1389V38.4545H42.1999Z" fill="#2E5BFF"/>
<path d="M48.6053 15.1622C47.6391 15.4955 47.8806 16.7939 48.9676 17.0044C50.417 17.2852 53.3761 19.4257 54.8053 21.2504C58.1267 25.4438 57.865 31.4268 54.1812 35.8307C53.3962 36.7781 53.4566 36.8132 53.1546 34.813C52.9131 33.0585 52.6111 32.5321 51.8663 32.5321C50.8397 32.5321 50.6787 33.0234 51.041 35.1113C51.202 36.1465 51.4033 37.5852 51.4839 38.287C51.7053 40.3749 51.6046 40.3398 56.2747 39.3222C59.8578 38.5502 60.1799 38.3923 59.9383 37.5677C59.7572 36.9009 59.1332 36.8307 57.2208 37.2694C56.2949 37.4624 55.4897 37.6027 55.4494 37.5501C55.389 37.4975 55.691 37.0413 56.1137 36.5325C61.5688 29.9003 59.8578 20.8644 52.3092 16.4956C51.0007 15.7412 49.2293 14.9341 49.0683 15.0043C49.0683 15.0043 48.8469 15.0745 48.6053 15.1622Z" fill="#2E5BFF"/>
</g>
<defs>
<filter id="filter0_d_2003_14" x="-1" y="1" width="50" height="32" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dy="2"/>
<feGaussianBlur stdDeviation="1.5"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2003_14"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2003_14" result="shape"/>
</filter>
<filter id="filter1_d_2003_14" x="4" y="29" width="52" height="34" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dy="1"/>
<feGaussianBlur stdDeviation="2"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2003_14"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2003_14" result="shape"/>
</filter>
<linearGradient id="paint0_linear_2003_14" x1="2" y1="2" x2="24.7749" y2="40.5421" gradientUnits="userSpaceOnUse">
<stop stop-color="#4E7BFF"/>
<stop offset="1" stop-color="#2E5BFF"/>
</linearGradient>
<clipPath id="clip0_2003_14">
<rect width="62" height="62" fill="white"/>
</clipPath>
</defs>
</svg>`;
  const LOADING_ICON = `<svg class="input-translate-spinner" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="14 42"/></svg>`;

  function formatCount(value) {
    if (value === '…') return '…';
    if (value == null) return '∞';
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
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
      button.setAttribute('aria-label', 'Translate to English');
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', onTranslate);
      document.documentElement.appendChild(button);
    }

    function setTranslate(selectedChars, remaining, { showCounter = true } = {}) {
      ensureButton();
      button.disabled = false;

      if (!showCounter) {
        button.classList.remove('input-translate-btn--with-counter');
        button.innerHTML = TRANSLATE_ICON;
        button.title = 'Translate to English (Alt+Shift+T)';
        return;
      }

      const counter = `${formatCount(selectedChars)} / ${formatCount(remaining)}`;
      button.classList.add('input-translate-btn--with-counter');
      button.innerHTML = `${TRANSLATE_ICON}<span class="input-translate-counter">${counter}</span>`;
      button.title = `Translate to English (${counter} chars, Alt+Shift+T)`;
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
        button.classList.remove('input-translate-btn--with-counter');
        button.disabled = true;
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
