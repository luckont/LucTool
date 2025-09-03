const path = location.pathname.replace(/\/$/, '/');
document.querySelectorAll('.nav a').forEach(a => { if (a.getAttribute('href') === path) a.classList.add('active'); });