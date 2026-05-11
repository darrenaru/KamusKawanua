// Global animation bootstrap (AOS + GSAP) for this static site.
// Safe to include on any page; it no-ops if libs/elements are missing.

(function () {
  "use strict";

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let aosInitialized = false;

  function refreshPageAOS() {
    if (!window.AOS || typeof window.AOS.refresh !== "function") return;
    try {
      window.AOS.refresh();
    } catch (e) {
      /* ignore */
    }
  }

  /** Admin pages that inject dynamic DOM (dataset cards, etc.). */
  window.refreshPageAOS = refreshPageAOS;

  function initAOS() {
    if (prefersReducedMotion) return;
    if (!window.AOS || typeof window.AOS.init !== "function") return;
    if (aosInitialized) {
      refreshPageAOS();
      return;
    }

    window.AOS.init({
      duration: 700,
      easing: "ease-out-cubic",
      once: true,
      offset: 100,
    });
    aosInitialized = true;
    refreshPageAOS();
  }

  /**
   * @returns {boolean} true if AOS init is deferred until after GSAP (admin layout), false if AOS can init immediately after this call.
   */
  function runGSAP() {
    if (prefersReducedMotion) return false;
    if (!window.gsap) return false;

    const sidebar = document.querySelector(".sidebar");
    const main = document.querySelector(".main");

    if (sidebar && main) {
      window.gsap
        .timeline({ defaults: { ease: "power2.out" } })
        .fromTo(
          sidebar,
          { x: -14, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.45 },
          0,
        )
        .fromTo(
          main,
          { y: 10, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.48,
            onComplete: () => {
              initAOS();
              refreshPageAOS();
              requestAnimationFrame(refreshPageAOS);
            },
          },
          0.05,
        );

      window.setTimeout(() => {
        if (!aosInitialized) {
          initAOS();
          refreshPageAOS();
        }
      }, 900);

      return true;
    }

    const tl = window.gsap.timeline({ defaults: { ease: "power2.out" } });

    const brandLogo = document.querySelector(".brand-logo");
    const languageTitle = document.querySelector(".language-title");
    const languageRow = document.querySelector(".language-row");
    const searchBox = document.querySelector(".search-box");

    if (brandLogo || languageTitle || languageRow || searchBox) {
      tl.fromTo(
        [brandLogo, languageTitle, languageRow, searchBox].filter(Boolean),
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.08 },
      );
    }

    const loginCard = document.querySelector(".login-card");
    if (loginCard) {
      tl.fromTo(
        loginCard,
        { y: 16, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 0.55 },
        0,
      );
    }

    return false;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const deferAOS = runGSAP();
    if (!deferAOS) {
      initAOS();
      requestAnimationFrame(refreshPageAOS);
    }
  });

  window.addEventListener("load", () => {
    refreshPageAOS();
    if (!aosInitialized && document.querySelector("[data-aos]")) {
      initAOS();
    }
  });
})();
