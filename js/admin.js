(() => {
  const LOGIN_URL = "login.html";
  const client = window.supabase.createClient(
    window.MARCO_SUPABASE_URL,
    window.MARCO_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  const $ = (id) => document.getElementById(id);
  const list = $("slotList");
  const formMessage = $("formMessage");
  const listMessage = $("listMessage");
  const bookingList = $("bookingList");
  const bookingMessage = $("bookingMessage");
  let isAdmin = false;

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  async function guard() {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) {
      location.replace(LOGIN_URL + "?next=" + encodeURIComponent(location.href));
      return false;
    }
    $("adminEmail").textContent = session.user.email || "";
    const { data, error: roleError } = await client.rpc("is_marco_admin");
    if (roleError || data !== true) {
      document.body.innerHTML = '<main style="max-width:650px;margin:15vh auto;padding:30px;text-align:center"><h1>غير مصرح بالدخول</h1><p>هذا الحساب لا يمتلك صلاحية الأدمن.</p><a href="index.html">العودة للموقع</a></main>';
      return false;
    }
    isAdmin = true;
    return true;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("ar-EG", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value));
  }

  function whatsappUrl(phone, booking, slot) {
    let digits = String(phone || "").replace(/\\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = "20" + digits.slice(1);
    else if (/^1[0125]\\d{8}$/.test(digits)) digits = "20" + digits;
    if (!/^\\d{10,15}$/.test(digits) || digits.startsWith("0")) return "";
    const when = slot?.starts_at ? formatDate(slot.starts_at) : "الموعد المتفق عليه";
    const message = "أهلاً " + booking.customer_name + " 🌟\\n" +
      "تم تأكيد حجز جلستك مع Marco Live Coach بنجاح.\\n" +
      "موعد الجلسة: " + when + "\\n" +
      "نتشرف بيك ونتمنى لك تجربة موفقة!";
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(message);
  }

  async function loadSlots() {
    list.innerHTML = '<div class="admin-empty">جاري تحميل المواعيد...</div>';
    const { data, error } = await client.from("availability_slots")
      .select("id,starts_at,ends_at,price_egp,status,created_at")
      .order("starts_at", { ascending:true });
    if (error) {
      list.innerHTML = '<div class="admin-empty">تعذر تحميل المواعيد.</div>';
      listMessage.textContent = error.message;
      return;
    }
    listMessage.textContent = "";
    if (!data.length) {
      list.innerHTML = '<div class="admin-empty">لسه مفيش مواعيد. أضف أول موعد من النموذج.</div>';
      return;
    }
    list.innerHTML = data.map((slot) => {
      const statusLabel = slot.status === "available" ? "متاح" : slot.status === "closed" ? "مغلق" : slot.status === "pending" ? "بانتظار الدفع" : "محجوز";
      const toggleLabel = slot.status === "available" ? "إغلاق الموعد" : "فتح الموعد";
      const toggleDisabled = slot.status === "booked" || slot.status === "pending";
      const deleteDisabled = slot.status === "booked" || slot.status === "pending";
      return `<article class="slot-item">
        <div class="slot-meta">
          <strong>${escapeHtml(formatDate(slot.starts_at))}</strong>
          <small>ينتهي: ${escapeHtml(formatDate(slot.ends_at))} · ${Number(slot.price_egp).toLocaleString("en-US")} EGP</small>
          <span class="slot-status">${statusLabel}</span>
        </div>
        <div class="slot-actions">
          <button type="button" data-action="toggle" data-id="${escapeHtml(slot.id)}" ${toggleDisabled ? "disabled" : ""}>${toggleLabel}</button>
          <button type="button" class="danger" data-action="delete" data-id="${escapeHtml(slot.id)}" ${deleteDisabled ? "disabled" : ""}>حذف</button>
        </div>
      </article>`;
    }).join("");
  }

  $("slotForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    const startValue = $("slotStart").value;
    const endValue = $("slotEnd").value;
    const start = new Date(startValue);
    const end = new Date(endValue);
    const price = Number($("slotPrice").value);
    if (!(start < end) || !Number.isFinite(price) || price <= 0) {
      formMessage.textContent = "تأكد من صحة وقت البداية والنهاية والسعر.";
      return;
    }
    const button = $("addSlotBtn");
    button.disabled = true;
    formMessage.textContent = "جاري إضافة الموعد...";
    const { error } = await client.from("availability_slots").insert({
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      price_egp: price,
      status: "available"
    });
    button.disabled = false;
    if (error) {
      formMessage.textContent = "تعذر إضافة الموعد: " + error.message;
      return;
    }
    $("slotForm").reset();
    formMessage.textContent = "تمت إضافة الموعد بنجاح.";
    await loadSlots();
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || !isAdmin) return;
    const id = button.dataset.id;
    button.disabled = true;
    listMessage.textContent = "جاري تنفيذ العملية...";
    let result;
    if (button.dataset.action === "delete") {
      if (!confirm("هل أنت متأكد من حذف هذا الموعد؟")) {
        button.disabled = false;
        listMessage.textContent = "";
        return;
      }
      result = await client.from("availability_slots").delete().eq("id", id).neq("status", "booked");
    } else {
      const current = button.textContent.includes("إغلاق") ? "available" : "closed";
      result = await client.from("availability_slots").update({ status: current === "available" ? "closed" : "available" }).eq("id", id).neq("status", "booked");
    }
    button.disabled = false;
    if (result.error) listMessage.textContent = "تعذر تنفيذ العملية: " + result.error.message;
    else listMessage.textContent = "تم تنفيذ العملية.";
    await loadSlots();
  });

  async function loadBookings() {
    if (!bookingList) return;
    bookingList.innerHTML = '<div class="admin-empty">جاري تحميل طلبات الحجز...</div>';
    const { data, error } = await client.from("booking_requests")
      .select("id,customer_name,customer_email,customer_phone,session_type,details,status,created_at,payment_receipt_path,receipt_check_status,availability_slots(starts_at,ends_at,price_egp)")
      .order("created_at", { ascending:false });
    if (error) {
      bookingList.innerHTML = '<div class="admin-empty">تعذر تحميل طلبات الحجز.</div>';
      bookingMessage.textContent = error.message;
      return;
    }
    bookingMessage.textContent = "";
    if (!data || !data.length) {
      bookingList.innerHTML = '<div class="admin-empty">لا توجد طلبات حجز حتى الآن.</div>';
      return;
    }
    const labels = { awaiting_payment:"في انتظار الدفع", payment_review:"الدفع قيد المراجعة", confirmed:"تم التأكيد", rejected:"مرفوض" };
    const bookingCards = await Promise.all(data.map(async (booking) => {
      const slot = booking.availability_slots || {};
      const canReview = ["awaiting_payment", "payment_review"].includes(booking.status);
      let receiptLink = "";
      if (booking.payment_receipt_path) {
        const { data: signed, error: signedError } = await client.storage
          .from("payment-receipts")
          .createSignedUrl(booking.payment_receipt_path, 3600);
        if (!signedError && signed?.signedUrl) {
          receiptLink = `<a href="${escapeHtml(signed.signedUrl)}" target="_blank" rel="noopener noreferrer">عرض إيصال التحويل</a>`;
        } else {
          receiptLink = '<small>تعذر فتح إيصال التحويل.</small>';
        }
      } else {
        receiptLink = '<small>لم يتم رفع إيصال بعد.</small>';
      }
      return `<article class="slot-item">
        <div class="slot-meta">
          <strong>${escapeHtml(booking.customer_name)} · ${escapeHtml(booking.session_type)}</strong>
          <small>${escapeHtml(booking.customer_email)} · ${escapeHtml(booking.customer_phone)}</small>
          <small>الموعد: ${slot.starts_at ? escapeHtml(formatDate(slot.starts_at)) : "غير متاح"} · السعر: ${slot.price_egp == null ? "—" : Number(slot.price_egp).toLocaleString("en-US") + " EGP"}</small>
          ${booking.details ? `<small>التفاصيل: ${escapeHtml(booking.details)}</small>` : ""}
          ${receiptLink}
          <span class="slot-status">${labels[booking.status] || escapeHtml(booking.status)}</span>
        </div>
        ${canReview ? `<div class="slot-actions">
          <button type="button" data-booking-review="confirmed" data-id="${escapeHtml(booking.id)}">تأكيد الدفع والحجز</button>
          <button type="button" class="danger" data-booking-review="rejected" data-id="${escapeHtml(booking.id)}">رفض الطلب</button>
        </div>` : booking.status === "confirmed" ? `<div class="slot-actions">
          ${whatsappUrl(booking.customer_phone, booking, slot) ? `<a href="${escapeHtml(whatsappUrl(booking.customer_phone, booking, slot))}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:14px;background:#25D366;color:#07130b;font-weight:700;text-decoration:none">إرسال تأكيد الحجز على واتساب</a>` : `<small>رقم الهاتف غير صالح لفتح واتساب؛ راجع رقم العميل.</small>`}
        </div>` : ""}
      </article>`;
    }));
    bookingList.innerHTML = bookingCards.join("");
  }

  bookingList?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-booking-review]");
    if (!button || !isAdmin) return;
    const bookingId = button.dataset.id;
    const nextStatus = button.dataset.bookingReview;
    let rejectionReason = null;
    if (nextStatus === "rejected") {
      rejectionReason = prompt("اكتب سبب رفض الطلب:");
      if (rejectionReason === null) return;
      rejectionReason = rejectionReason.trim();
      if (!rejectionReason) {
        bookingMessage.textContent = "لازم تكتب سبب الرفض.";
        return;
      }
    } else if (!confirm("تأكيد وصول المبلغ وتأكيد الحجز نهائيًا؟")) {
      return;
    }

    button.disabled = true;
    bookingMessage.textContent = "جاري تحديث الطلب والموعد...";
    const { error } = await client.rpc("admin_review_booking", {
      p_booking_id: bookingId,
      p_status: nextStatus,
      p_rejection_reason: rejectionReason
    });
    if (error) {
      bookingMessage.textContent = "تعذر تحديث الطلب: " + error.message;
      await loadBookings();
      return;
    }
    bookingMessage.textContent = nextStatus === "confirmed"
      ? "تم تأكيد الدفع والحجز."
      : "تم رفض الطلب وإتاحة الموعد من جديد.";
    await loadSlots();
    await loadBookings();
  });

  $("refreshBtn").addEventListener("click", async () => { await loadSlots(); await loadBookings(); });
  $("signOutBtn").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) alert(error.message);
    else location.replace(LOGIN_URL);
  });

  guard().then((allowed) => { if (allowed) { loadSlots(); loadBookings(); } });
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") location.replace(LOGIN_URL);
  });
})();