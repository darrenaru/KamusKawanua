// Global animation bootstrap (AOS + GSAP) for this static site.
// Safe to include on any page; it no-ops if libs/elements are missing.

(function () {
  "use strict";

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initAOS() {
    if (prefersReducedMotion) return;
    if (!window.AOS || typeof window.AOS.init !== "function") return;

    window.AOS.init({
      duration: 700,
      easing: "ease-out-cubic",
      once: true,
      offset: 80,
    });
  }

  function initGSAP() {
    if (prefersReducedMotion) return;
    if (!window.gsap) return;

    const tl = window.gsap.timeline({ defaults: { ease: "power2.out" } });

    // Landing page (index)
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

    // Login page
    const loginCard = document.querySelector(".login-card");
    if (loginCard) {
      tl.fromTo(
        loginCard,
        { y: 16, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 0.55 },
        0,
      );
    }

    // Admin layout pages
    const sidebar = document.querySelector(".sidebar");
    const main = document.querySelector(".main");
    if (sidebar && main) {
      tl.fromTo(
        sidebar,
        { x: -14, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.45 },
        0,
      ).fromTo(
        main,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45 },
        0.05,
      );
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAOS();
    initGSAP();
  });
})();

