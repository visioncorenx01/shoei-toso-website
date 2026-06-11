/**
 * サービスセクション カルーセル
 */
(function () {
  var slider = document.querySelector('.service-slider');
  if (!slider) return;

  var slides = Array.prototype.slice.call(slider.querySelectorAll('.service-slide'));
  var dots = Array.prototype.slice.call(slider.querySelectorAll('.service-slider-dot'));
  var prevBtn = slider.querySelector('.service-slider-prev');
  var nextBtn = slider.querySelector('.service-slider-next');
  var viewport = slider.querySelector('.service-slider-viewport');
  var current = 0;
  var touchStartX = 0;
  var touchDeltaX = 0;

  function goTo(index) {
    var total = slides.length;
    current = (index + total) % total;

    slides.forEach(function (slide, i) {
      var isActive = i === current;
      slide.classList.toggle('is-active', isActive);
      slide.hidden = !isActive;
      slide.setAttribute('aria-label', (i + 1) + ' / ' + total);
    });

    dots.forEach(function (dot, i) {
      var isActive = i === current;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function goPrev() {
    goTo(current - 1);
  }

  function goNext() {
    goTo(current + 1);
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', goPrev);
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', goNext);
  }

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      goTo(i);
    });
  });

  if (viewport) {
    viewport.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches.length) return;
      touchStartX = e.touches[0].clientX;
      touchDeltaX = 0;
    }, { passive: true });

    viewport.addEventListener('touchmove', function (e) {
      if (!e.touches || !e.touches.length) return;
      touchDeltaX = e.touches[0].clientX - touchStartX;
    }, { passive: true });

    viewport.addEventListener('touchend', function () {
      if (Math.abs(touchDeltaX) < 40) return;
      if (touchDeltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
      touchDeltaX = 0;
    });
  }

  goTo(0);
})();
