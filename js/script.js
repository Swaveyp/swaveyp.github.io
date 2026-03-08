!function(o) {
  "use strict";
  o(window).on("load", function() {
    o("#preloader").fadeOut("slow", function() { o(this).remove(); });
  });
  if (o(window).width() < 992) {
    o("#navigation .dropdown-toggle").on("click", function() {
      o(this).siblings(".dropdown-menu").animate({ height: "toggle" }, 300);
    });
  }
  if (o.fn.slick) {
    o(".testimonial-slider").slick({ infinite: true, arrows: false, autoplay: true, autoplaySpeed: 2000 });
    o(".clients-logo-slider").slick({ infinite: true, arrows: false, autoplay: true, autoplaySpeed: 2000, slidesToShow: 5, slidesToScroll: 1, responsive: [{ breakpoint: 1024, settings: { slidesToShow: 4, slidesToScroll: 1, infinite: true, dots: false } }, { breakpoint: 480, settings: { slidesToShow: 3, slidesToScroll: 1, arrows: false } }] });
    o(".company-gallery").slick({ infinite: true, arrows: false, autoplay: true, autoplaySpeed: 2000, slidesToShow: 5, slidesToScroll: 1, responsive: [{ breakpoint: 1024, settings: { slidesToShow: 4, slidesToScroll: 1, infinite: true, dots: false } }, { breakpoint: 667, settings: { slidesToShow: 3, slidesToScroll: 1, arrows: false } }, { breakpoint: 480, settings: { slidesToShow: 2, slidesToScroll: 1, arrows: false } }] });
  }
  new SmoothScroll('a[href*="#"]');
  o(window).scroll(function() {
    if (o(".counter").length !== 0) {
      var i = o(".counter").offset().top - window.innerHeight;
      if (o(window).scrollTop() > i) {
        o(".counter").each(function() {
          var el = o(this), count = el.attr("data-count");
          o({ countNum: el.text() }).animate({ countNum: count }, { duration: 1000, easing: "swing", step: function() { el.text(Math.floor(this.countNum)); }, complete: function() { el.text(this.countNum); } });
        });
      }
    }
    o(window).scrollTop() > 50 ? o(".navigation").addClass("sticky-header") : o(".navigation").removeClass("sticky-header");
  });
}(jQuery);
