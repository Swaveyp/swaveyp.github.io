/* Hidden admin gate: 3 clicks on the footer copyright within ~2s navigates
   to admin.html. No visible feedback; cursor stays default. */
(function () {
  var el = document.querySelector('.site-footer-copy');
  if (!el) return;
  var count = 0;
  var timer = null;
  function reset() { count = 0; timer = null; }
  el.addEventListener('click', function () {
    count += 1;
    if (timer) clearTimeout(timer);
    if (count >= 3) {
      reset();
      window.location.href = 'admin.html';
      return;
    }
    timer = setTimeout(reset, 2000);
  });
})();
