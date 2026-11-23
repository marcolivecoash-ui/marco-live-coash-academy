(() => {
  const client = window.supabase.createClient(
    window.MARCO_SUPABASE_URL,
    window.MARCO_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  let allowed = false;

  async function guard() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      location.replace("login.html?next=" + encodeURIComponent(location.href));
      return false;
    }
    $("adminEmail").textContent = session.user.email || "";
    const { data, error } = await client.rpc("is_marco_admin");
    if (error || data !== true) {
      document.body.innerHTML = '<main style="max-width:650px;margin:15vh auto;padding:30px;text-align:center"><h1>غير مصرح بالدخول</h1><a href="index.html">العودة للموقع</a></main>';
      return false;
    }
    allowed = true;
    return true;
  }

  async function loadLessons(courseId) {
    const target = $("lessons-" + courseId);
    if (!target) return;
    const { data, error } = await client.from("course_lessons")
      .select("*").eq("course_id", courseId).order("sort_order", { ascending: true });
    if (error) { target.textContent = error.message; return; }
    target.innerHTML = (data || []).map((lesson) =>
      '<div class="manage-item"><strong>' + esc(lesson.title_ar) + '</strong>' +
      '<small>' + (lesson.video_path ? "الفيديو مرفوع" : "لا يوجد فيديو") + " · " +
      (lesson.is_published ? "منشور" : "مخفي") + '</small>' +
      '<div class="manage-actions"><button data-lesson-publish="' + lesson.id +
      '" data-next="' + (!lesson.is_published) + '">' +
      (lesson.is_published ? "إخفاء الدرس" : "نشر الدرس") + '</button>' +
      '<button class="danger" data-lesson-delete="' + lesson.id +
      '" data-video="' + esc(lesson.video_path || "") + '">حذف الدرس</button></div>' +
      '<label>رفع / استبدال الفيديو<input type="file" accept="video/mp4,video/webm,video/quicktime" data-video-upload="' +
      lesson.id + '" data-course="' + courseId + '"></label></div>'
    ).join("") || "<small>لا توجد دروس بعد.</small>";
  }

  async function loadCourses() {
    const root = $("courseList");
    root.innerHTML = '<div class="manage-empty">جاري التحميل...</div>';
    const { data, error } = await client.from("courses").select("*").order("created_at", { ascending: false });
    if (error) { root.textContent = error.message; return; }
    if (!data || !data.length) {
      root.innerHTML = '<div class="manage-empty">لم تضف كورسات بعد.</div>';
      return;
    }
    root.innerHTML = data.map((course) =>
      '<article class="manage-item"><strong>' + esc(course.title_ar) + '</strong>' +
      '<small>' + Number(course.price_egp).toLocaleString("en-US") + " EGP · " +
      (course.is_published ? "منشور" : "مسودة") + '</small><div class="manage-actions">' +
      '<button data-publish="' + course.id + '" data-next="' + (!course.is_published) + '">' +
      (course.is_published ? "إلغاء النشر" : "نشر الكورس") + '</button>' +
      '<button data-add-lesson="' + course.id + '">إضافة درس</button></div>' +
      '<div class="video-upload" id="lessons-' + course.id + '"></div></article>'
    ).join("");
    for (const course of data) await loadLessons(course.id);
  }

  let purchaseFilter = "pending";
  let cachedPurchases = [];

  function renderPurchases() {
    const root = $("purchaseList");
    const groups = {
      pending: cachedPurchases.filter(p => ["awaiting_payment", "payment_review"].includes(p.status)),
      confirmed: cachedPurchases.filter(p => p.status === "confirmed"),
      rejected: cachedPurchases.filter(p => p.status === "rejected")
    };
    $("pendingCount").textContent = groups.pending.length;
    $("confirmedCount").textContent = groups.confirmed.length;
    $("rejectedCount").textContent = groups.rejected.length;
    document.querySelectorAll("[data-purchase-filter]").forEach(tab =>
      tab.classList.toggle("active", tab.dataset.purchaseFilter === purchaseFilter)
    );
    const selected = groups[purchaseFilter] || [];
    if (!selected.length) {
      root.innerHTML = '<div class="manage-empty">' +
        (purchaseFilter === "pending" ? "لا توجد طلبات معلقة." :
         purchaseFilter === "confirmed" ? "لا توجد طلبات مقبولة." : "لا توجد طلبات مرفوضة.") +
        '</div>';
      return;
    }
    root.innerHTML = selected.map(purchase => {
      const receipt = purchase.receiptHtml || '<small>لا يوجد إيصال مرفوع.</small>';
      const canReview = purchaseFilter === "pending";
      const statusLabel = purchase.status === "confirmed" ? "مقبول" :
        purchase.status === "rejected" ? "مرفوض" : "معلق";
      return '<article class="manage-item"><strong>' + esc(purchase.courses?.title_ar || "كورس") + '</strong>' +
        '<small>رقم العميل: ' + esc(purchase.user_id) + " · " +
        Number(purchase.courses?.price_egp || 0).toLocaleString("en-US") + ' EGP</small>' +
        '<small>الحالة: ' + statusLabel + " · فحص الإيصال: " +
        esc(purchase.receipt_check_status || "لم يتم الفحص") + '</small>' + receipt +
        (canReview ? '<div class="manage-actions"><button data-review="confirmed" data-id="' +
          purchase.id + '">تأكيد الدفع وفتح الكورس</button><button class="danger" data-review="rejected" data-id="' +
          purchase.id + '">رفض الطلب</button></div>' : "") + '</article>';
    }).join("");
  }

  async function loadPurchases() {
    const root = $("purchaseList");
    root.innerHTML = '<div class="manage-empty">جاري تحميل الطلبات...</div>';
    const { data, error } = await client.from("course_purchases")
      .select("id,user_id,status,payment_receipt_path,created_at,receipt_check_status,courses(title_ar,price_egp)")
      .order("created_at", { ascending: false });
    if (error) { root.textContent = error.message; return; }
    cachedPurchases = await Promise.all((data || []).map(async purchase => {
      let receiptHtml = '<small>لا يوجد إيصال مرفوع.</small>';
      if (purchase.payment_receipt_path) {
        const { data: signed, error: signedError } = await client.storage.from("payment-receipts")
          .createSignedUrl(purchase.payment_receipt_path, 3600);
        if (signed?.signedUrl) {
          const safeUrl = esc(signed.signedUrl);
          receiptHtml = '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:10px 0">' +
            '<img src="' + safeUrl + '" alt="إيصال الدفع" loading="lazy" style="display:block;max-width:100%;width:320px;max-height:420px;object-fit:contain;border:1px solid var(--border);border-radius:12px;background:#111;padding:5px">' +
            '<span>فتح الإيصال بالحجم الكامل</span></a>';
        } else {
          receiptHtml = '<small style="color:#ff9292">تعذر تحميل الإيصال: ' +
            esc(signedError?.message || "تحقق من صلاحيات Storage ومسار الملف") + '</small>';
        }
      }
      return { ...purchase, receiptHtml };
    }));
    renderPurchases();
  }

  $("courseForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!allowed) return;
    const button = $("saveCourse");
    button.disabled = true;
    $("courseMessage").textContent = "جاري إضافة الكورس...";
    const { data: { user } } = await client.auth.getUser();
    const { error } = await client.from("courses").insert({
      title_ar: $("titleAr").value.trim(),
      title_en: $("titleEn").value.trim() || null,
      description_ar: $("descriptionAr").value.trim() || null,
      description_en: $("descriptionEn").value.trim() || null,
      price_egp: Number($("priceEgp").value),
      created_by: user.id
    });
    button.disabled = false;
    if (error) {
      $("courseMessage").textContent = "تعذر إضافة الكورس: " + error.message;
      return;
    }
    $("courseForm").reset();
    $("courseMessage").textContent = "تم إنشاء الكورس كمسودة. أضف الدروس ثم انشره.";
    await loadCourses();
  });

  $("courseList").addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button || !allowed) return;
    if (button.dataset.publish) {
      const { error } = await client.from("courses")
        .update({ is_published: button.dataset.next === "true" }).eq("id", button.dataset.publish);
      $("lessonMessage").textContent = error ? error.message : "تم تحديث حالة النشر.";
      await loadCourses();
      return;
    }
    if (button.dataset.addLesson) {
      const title = prompt("اكتب اسم الدرس بالعربي:");
      if (!title || !title.trim()) return;
      const description = prompt("وصف الدرس (اختياري):") || "";
      const { count } = await client.from("course_lessons")
        .select("*", { count: "exact", head: true }).eq("course_id", button.dataset.addLesson);
      const { error } = await client.from("course_lessons").insert({
        course_id: button.dataset.addLesson, title_ar: title.trim(),
        description_ar: description, sort_order: count || 0, is_published: true
      });
      $("lessonMessage").textContent = error ? error.message : "تمت إضافة الدرس.";
      await loadCourses();
      return;
    }
    if (button.dataset.lessonPublish) {
      const { error } = await client.from("course_lessons")
        .update({ is_published: button.dataset.next === "true" }).eq("id", button.dataset.lessonPublish);
      $("lessonMessage").textContent = error ? error.message : "تم تحديث الدرس.";
      await loadCourses();
      return;
    }
    if (button.dataset.lessonDelete) {
      if (!confirm("حذف الدرس نهائيًا؟")) return;
      const path = button.dataset.video;
      if (path) await client.storage.from("course-videos").remove([path]);
      const { error } = await client.from("course_lessons").delete().eq("id", button.dataset.lessonDelete);
      $("lessonMessage").textContent = error ? error.message : "تم حذف الدرس.";
      await loadCourses();
    }
  });

  $("courseList").addEventListener("change", async (event) => {
    const input = event.target.closest("input[data-video-upload]");
    if (!input || !input.files[0] || !allowed) return;
    const file = input.files[0];
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      alert("استخدم MP4 أو WEBM أو MOV."); input.value = ""; return;
    }
    if (file.size > 500 * 1024 * 1024) {
      alert("حجم الفيديو أكبر من 500MB. قلل الحجم قبل الرفع."); input.value = ""; return;
    }
    const lessonId = input.dataset.videoUpload;
    const courseId = input.dataset.course;
    const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
    const path = courseId + "/" + lessonId + "." + ext;
    $("lessonMessage").textContent = "جاري رفع الفيديو... اترك الصفحة مفتوحة حتى يكتمل الرفع.";
    const { error: uploadError } = await client.storage.from("course-videos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      $("lessonMessage").textContent = "فشل رفع الفيديو: " + uploadError.message;
      return;
    }
    const { error: updateError } = await client.from("course_lessons")
      .update({ video_path: path }).eq("id", lessonId);
    $("lessonMessage").textContent = updateError
      ? "تم رفع الفيديو لكن تعذر ربطه بالدرس: " + updateError.message
      : "تم رفع الفيديو وربطه بالدرس.";
    await loadCourses();
  });

  document.querySelectorAll("[data-purchase-filter]").forEach(tab => {
    tab.addEventListener("click", () => {
      purchaseFilter = tab.dataset.purchaseFilter;
      renderPurchases();
    });
  });

  $("purchaseList").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-review]");
    if (!button || !allowed) return;
    let reason = null;
    if (button.dataset.review === "rejected") {
      reason = prompt("اكتب سبب رفض الدفع:");
      if (reason === null) return;
      if (!reason.trim()) { alert("سبب الرفض مطلوب."); return; }
    } else if (!confirm("هل تحققت من وصول المبلغ وتريد فتح الكورس للعميل؟")) return;
    button.disabled = true;
    $("purchaseMessage").textContent = "جاري تحديث الطلب...";
    const { error } = await client.rpc("admin_review_course_purchase", {
      p_purchase_id: button.dataset.id,
      p_status: button.dataset.review,
      p_rejection_reason: reason
    });
    $("purchaseMessage").textContent = error
      ? "تعذر تحديث الطلب: " + error.message
      : (button.dataset.review === "confirmed" ? "تم تأكيد الدفع وفتح الكورس للعميل." : "تم رفض طلب الشراء.");
    await loadPurchases();
  });

  $("refreshBtn").addEventListener("click", async () => {
    await loadCourses();
    await loadPurchases();
  });
  $("signOutBtn").addEventListener("click", async () => {
    await client.auth.signOut();
    location.replace("login.html");
  });
  $("menuBtn").addEventListener("click", () => $("nav").classList.toggle("active"));

  guard().then(async (ok) => {
    if (ok) { await loadCourses(); await loadPurchases(); }
  });
})();