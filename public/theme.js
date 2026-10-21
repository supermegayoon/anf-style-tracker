// Light / dark switch shared by index.html and guide.html. Loaded in <head> so the page paints in the right theme.
(function(){
  var K = 'anf-theme', root = document.documentElement;
  try { var v = localStorage.getItem(K); if (v === 'light' || v === 'dark') root.setAttribute('data-theme', v); } catch (e) {}
  function current(){ return root.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  function sync(){ var c = current(); document.querySelectorAll('[data-theme-set]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-set') === c)); }); }
  function set(t){ root.setAttribute('data-theme', t); try { localStorage.setItem(K, t); } catch (e) {} sync(); }
  document.addEventListener('click', function(e){ var b = e.target.closest && e.target.closest('[data-theme-set]'); if (b) set(b.getAttribute('data-theme-set')); });
  document.addEventListener('DOMContentLoaded', sync);
  if (window.matchMedia) { var m = matchMedia('(prefers-color-scheme: dark)'); (m.addEventListener ? m.addEventListener('change', sync) : m.addListener(sync)); }
  window.anfTheme = { current: current, set: set, sync: sync };
})();
