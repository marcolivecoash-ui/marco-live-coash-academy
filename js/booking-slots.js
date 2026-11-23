(() => {
  const root = document.getElementById("availableSlots");
  if (!root || !window.supabase || !window.MARCO_SUPABASE_URL || !window.MARCO_SUPABASE_PUBLISHABLE_KEY) return;
  const client = window.marcoSupabase || window.supabase.createClient(window.MARCO_SUPABASE_URL, window.MARCO_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.marcoSupabase = client;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
  const timeFmt = new Intl.DateTimeFormat("en-GB", { hour:"2-digit", minute:"2-digit", hour12:true });
  function labelFor(slot) {
    const start = new Date(slot.starts_at), end = new Date(slot.ends_at);
    return dateFmt.format(start) + " · " + timeFmt.format(start) + " – " + timeFmt.format(end) + " · " + Number(slot.price_egp).toLocaleString("en-US") + " EGP";
  }
  async function load() {
    root.innerHTML = '<div class="slot-empty">جاري تحميل المواعيد المتاحة...</div>';
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      root.innerHTML = '<div class="slot-empty">سجّل الدخول أولًا لعرض المواعيد المتاحة.</div>';
      return;
    }
    const { data, error } = await client.from("availability_slots")
      .select("id,starts_at,ends_at,price_egp")
      .eq("status","available").gte("starts_at",new Date().toISOString()).order("starts_at",{ascending:true});
    if (error) {
      root.innerHTML = '<div class="slot-empty">تعذر تحميل المواعيد: '+escapeHtml(error.message)+'</div>';
      return;
    }
    if (!data || !data.length) {
      root.innerHTML = '<div class="slot-empty">لا توجد مواعيد متاحة حاليًا. يرجى العودة لاحقًا.</div>';
      return;
    }
    root.innerHTML = data.map(slot => {
      const label = labelFor(slot);
      return '<label class="available-slot"><input type="radio" name="available_slot" value="'+escapeHtml(slot.id)+'" data-label="'+escapeHtml(label)+'" data-date="'+new Date(slot.starts_at).toISOString().slice(0,10)+'"><span class="available-slot-card"><strong>'+escapeHtml(dateFmt.format(new Date(slot.starts_at)))+'</strong><span>'+escapeHtml(timeFmt.format(new Date(slot.starts_at)))+' – '+escapeHtml(timeFmt.format(new Date(slot.ends_at)))+'</span><span class="slot-price">'+Number(slot.price_egp).toLocaleString("en-US")+' EGP</span></span></label>';
    }).join("");
  }
  root.addEventListener("change", event => {
    const radio = event.target.closest('input[name="available_slot"]');
    if (!radio) return;
    document.getElementById("selectedSlotId").value = radio.value;
    document.getElementById("selectedSlotLabel").value = radio.dataset.label;
    document.getElementById("date").value = radio.dataset.date;
    const msg = document.getElementById("slotSelectionMessage");
    msg.textContent = "تم اختيار الموعد: " + radio.dataset.label;
    document.getElementById("bookingForm").scrollIntoView({behavior:"smooth",block:"start"});
  });
  load();
})();
