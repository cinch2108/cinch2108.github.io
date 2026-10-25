// Consent banner. Ads never load unless the visitor opts in. Stored in localStorage only.
(function () {
  var KEY = 'lf-consent';
  var el = document.getElementById('consent'); if (!el) return;
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function show(focus) { el.classList.remove('hidden'); if (focus === true) { var b = document.getElementById('consentAccept'); b && b.focus(); } }
  function hide() { el.classList.add('hidden'); }
  function loadAds() {
    // AD LOADER STUB: add your ad network script here (and allow its origin in the CSP / _headers).
    // It only runs after the visitor clicks "Allow ads". Example:
    //   var s = document.createElement('script'); s.src = 'https://ads.example.com/tag.js'; s.async = true; document.head.appendChild(s);
    document.documentElement.dataset.ads = 'allowed';
  }
  document.getElementById('consentAccept').addEventListener('click', function () { set('ads'); hide(); loadAds(); });
  document.getElementById('consentReject').addEventListener('click', function () { set('essential'); hide(); document.documentElement.dataset.ads = 'off'; });
  var re = document.getElementById('consentReopen'); if (re) re.addEventListener('click', function () { show(true); });
  var v = get();
  if (v === 'ads') loadAds(); else if (!v) setTimeout(show, 1200);
})();
