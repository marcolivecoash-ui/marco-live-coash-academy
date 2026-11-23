
// Marco Live Coach - Main JavaScript

document.addEventListener("DOMContentLoaded", () => {
  // Language Switcher
  const langBtn = document.getElementById("langBtn");
  let currentLang = "en";

  function changeLanguage(lang) {
    currentLang = lang;

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-en][data-ar]").forEach((element) => {
      element.textContent =
        lang === "ar"
          ? element.getAttribute("data-ar")
          : element.getAttribute("data-en");
    });

    if (langBtn) {
      langBtn.textContent = lang === "ar" ? "English" : "العربية";
    }
  }

  if (langBtn) {
    langBtn.addEventListener("click", () => {
      changeLanguage(currentLang === "en" ? "ar" : "en");
    });
  }

  // Mobile Navigation
  const menuBtn = document.getElementById("menuBtn");
  const nav = document.getElementById("nav");

  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => {
      nav.classList.toggle("active");
      menuBtn.classList.toggle("active");
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("active");
        menuBtn.classList.remove("active");
      });
    });
  }

  // Set initial language
  changeLanguage("en");
});
