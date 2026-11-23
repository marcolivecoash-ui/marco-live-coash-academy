document.addEventListener("DOMContentLoaded", () => {
  // Load Supabase and the shared auth guard on every protected page.
  const supabaseScript = document.createElement("script");
  supabaseScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  supabaseScript.onload = () => {
    const configScript = document.createElement("script");
    configScript.src = "js/supabase-config.js";
    configScript.onload = () => {
      const authScript = document.createElement("script");
      authScript.src = "js/auth.js";
      authScript.onload = () => {
        const editorScript = document.createElement("script");
        editorScript.src = "js/inline-editor.js";
        document.body.appendChild(editorScript);
      };
      document.body.appendChild(authScript);
    };
    document.body.appendChild(configScript);
  };
  supabaseScript.onerror = () => {
    document.documentElement.style.visibility = "visible";
    console.error("Could not load Supabase JS");
  };
  document.head.appendChild(supabaseScript);


  // Gentle reveal animations as sections enter the viewport.
  const motionTargets = document.querySelectorAll(
    ".hero .eyebrow, .hero h1, .hero p, .hero-buttons, .stat, .section-header, .card, .step, .highlight-box, .form-card, .contact-item, .cta"
  );
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
    motionTargets.forEach((element) => element.classList.add("reveal"));
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
    motionTargets.forEach((element) => revealObserver.observe(element));
  }

  const langBtn = document.getElementById("langBtn");
  const menuBtn = document.getElementById("menuBtn");
  const nav = document.getElementById("nav");
  // Persistent light/dark appearance control.
  const themeButton = document.createElement("button");
  themeButton.type = "button";
  themeButton.className = "theme-toggle";
  themeButton.id = "themeToggle";
  themeButton.setAttribute("aria-label", "Switch color theme");
  themeButton.title = "Switch color theme";
  const savedTheme = localStorage.getItem("marco-theme") || "dark";
  document.documentElement.dataset.theme = savedTheme;
  function syncThemeButton() {
    const light = document.documentElement.dataset.theme === "light";
    themeButton.textContent = light ? "☾" : "☀";
    themeButton.title = light ? "Switch to dark mode" : "Switch to light mode";
    themeButton.setAttribute("aria-label", themeButton.title);
  }
  const headerActions = document.querySelector(".site-header .header-actions");
  if (headerActions) {
    headerActions.insertBefore(themeButton, headerActions.firstChild);
    syncThemeButton();
    themeButton.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem("marco-theme", nextTheme);
      syncThemeButton();
    });
  }

  let currentLang = localStorage.getItem("marco-language") || "en";

  function changeLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    if (document.body) document.body.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-en][data-ar]").forEach((element) => {
      element.textContent = lang === "ar" ? element.dataset.ar : element.dataset.en;
    });
    if (langBtn) langBtn.textContent = lang === "ar" ? "English" : "العربية";
    localStorage.setItem("marco-language", lang);
  }

  if (langBtn) langBtn.addEventListener("click", () => changeLanguage(currentLang === "en" ? "ar" : "en"));
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => nav.classList.toggle("active"));
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => nav.classList.remove("active")));
  }

  const bookingForm = document.getElementById("bookingForm");
  if (bookingForm) {
    bookingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(bookingForm);
      const messageBox = document.getElementById("bookingMessage");
      const slotId = formData.get("slot_id");
      const receiptFile = formData.get("payment_receipt");
      const ar = currentLang === "ar";
      if (!slotId) {
        messageBox.textContent = ar ? "من فضلك اختار موعدًا متاحًا أولًا." : "Please select an available appointment first.";
        return;
      }
      if (!(receiptFile instanceof File) || !receiptFile.size) {
        messageBox.textContent = ar ? "من فضلك ارفع صورة إيصال التحويل." : "Please upload your transfer receipt.";
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(receiptFile.type)) {
        messageBox.textContent = ar ? "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP." : "Unsupported image type. Use JPG, PNG or WEBP.";
        return;
      }
      if (receiptFile.size > 8 * 1024 * 1024) {
        messageBox.textContent = ar ? "حجم الصورة يجب ألا يتجاوز 8 ميجابايت." : "The image must be 8 MB or smaller.";
        return;
      }
      const client = window.marcoSupabase;
      if (!client) {
        messageBox.textContent = ar ? "تعذر الاتصال بالخدمة. حدّث الصفحة وحاول مرة أخرى." : "The service is not ready. Refresh the page and try again.";
        return;
      }
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) {
        messageBox.textContent = ar ? "انتهت جلسة تسجيل الدخول. سجّل الدخول مرة أخرى." : "Your login session expired. Please sign in again.";
        return;
      }

      const submitButton = bookingForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      messageBox.textContent = ar ? "جاري إنشاء طلب الحجز..." : "Creating your booking request...";
      let bookingId = null;
      let receiptPath = null;
      let requestError = null;
      const { data: createdId, error: createError } = await client.rpc("book_marco_slot", {
        p_slot_id: slotId,
        p_customer_name: formData.get("name"),
        p_customer_email: formData.get("email"),
        p_customer_phone: formData.get("phone"),
        p_session_type: formData.get("session"),
        p_details: formData.get("details") || ""
      });
      if (createError || !createdId) {
        requestError = createError || new Error("Booking request was not created.");
      } else {
        bookingId = createdId;
        const extension = receiptFile.type === "image/png" ? "png" : receiptFile.type === "image/webp" ? "webp" : "jpg";
        receiptPath = userData.user.id + "/" + bookingId + "." + extension;
        messageBox.textContent = ar ? "تم إنشاء الطلب. جاري رفع إيصال التحويل..." : "Request created. Uploading your transfer receipt...";
        const { error: uploadError } = await client.storage.from("payment-receipts").upload(receiptPath, receiptFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: receiptFile.type
        });
        if (uploadError) {
          requestError = uploadError;
        } else {
          messageBox.textContent = ar ? "تم رفع الإيصال. جاري إرساله للمراجعة..." : "Receipt uploaded. Submitting it for review...";
          const { error: receiptError } = await client.rpc("submit_booking_receipt", {
            p_booking_id: bookingId,
            p_receipt_path: receiptPath
          });
          if (receiptError) {
            requestError = receiptError;
            await client.storage.from("payment-receipts").remove([receiptPath]);
          }
        }
        if (requestError) {
          await client.rpc("cancel_booking_upload", { p_booking_id: bookingId });
        }
      }

      submitButton.disabled = false;
      if (requestError) {
        messageBox.textContent = ar
          ? "تعذر إكمال طلب الحجز: " + requestError.message + " — لو تم إنشاء الطلب، حاول اختيار موعد آخر إذا لم يعد الموعد متاحًا."
          : "Could not complete your booking: " + requestError.message + ". If the slot is no longer available, please select another one.";
        return;
      }

      bookingForm.reset();
      document.getElementById("selectedSlotId").value = "";
      document.getElementById("selectedSlotLabel").value = "";
      document.getElementById("date").value = "";
      document.getElementById("availableSlots").innerHTML = '<div class="slot-empty">' + (ar ? "تم إرسال الإيصال للمراجعة. جاري تحديث المواعيد..." : "Receipt submitted for review. Refreshing appointments...") + '</div>';
      messageBox.textContent = ar
        ? "تم إرسال طلب الحجز وإيصال التحويل بنجاح. الطلب الآن قيد مراجعة الأدمن، ولم يتم تأكيد الحجز بعد."
        : "Your booking request and transfer receipt were submitted. The admin is reviewing the payment; your appointment is not confirmed yet.";
      const slotsScript = document.querySelector('script[src="js/booking-slots.js"]');
      if (slotsScript) {
        const refresh = document.createElement("script");
        refresh.src = "js/booking-slots.js";
        document.body.appendChild(refresh);
      }
    });
  }
  changeLanguage(currentLang);
});