// (function(){
//   const root = document.documentElement;
//   const saved = localStorage.getItem('theme');
//   const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
//   const initial = saved || (systemPrefersLight ? 'light' : 'dark');
//   applyTheme(initial);

//   document.addEventListener('click', (e) => {
//     const btn = e.target.closest('#themeToggle');
//     if (!btn) return;
//     const next = (root.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
//     applyTheme(next);
//   });

//   const mo = new MutationObserver(updateToggleButton);
//   mo.observe(document.body, { childList: true, subtree: true });
//   document.addEventListener('DOMContentLoaded', updateToggleButton);

//   function applyTheme(mode){
//     root.setAttribute('data-theme', mode);
//     localStorage.setItem('theme', mode);
//     updateToggleButton();
//   }
//   function updateToggleButton(){
//     const btn = document.getElementById('themeToggle');
//     if (!btn) return;
//     const isLight = document.documentElement.getAttribute('data-theme') === 'light';
//     btn.setAttribute('aria-pressed', String(isLight));
//     const icon = btn.querySelector('.icon');
//     if (icon) icon.textContent = isLight ? '☀️' : '🌙';
//   }
// })();
