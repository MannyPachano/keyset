/* Sets the theme on <html> before the first paint. A real file rather than an
   inline script so a strict CSP can allow it with script-src 'self'. */
(function () {
  var KEY = 'keyset.theme';
  var root = document.documentElement;
  var os = function () {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  root.setAttribute('data-theme', saved === 'light' || saved === 'dark' ? saved : os());
})();
