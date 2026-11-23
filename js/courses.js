(() => {
 const client=window.supabase.createClient(window.MARCO_SUPABASE_URL,window.MARCO_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const $=id=>document.getElementById(id), grid=$("courseGrid"), message=$("courseMessage");
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function start(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){location.replace("login.html?next="+encodeURIComponent(location.href));return;}
  $("signOutBtn").onclick=async()=>{await client.auth.signOut();location.replace("login.html");};
  $("menuBtn").onclick=()=>$("nav").classList.toggle("active");
  const {data,error}=await client.from("courses").select("id,title_ar,title_en,description_ar,description_en,price_egp").eq("is_published",true).order("created_at",{ascending:false});
  if(error){grid.innerHTML='<div class="course-empty">تعذر تحميل الكورسات: '+esc(error.message)+'</div>';return;}
  if(!data?.length){grid.innerHTML='<div class="course-empty">لا توجد كورسات متاحة حاليًا. تابعنا قريبًا.</div>';return;}
  grid.innerHTML=data.map(c=>'<article class="course-card"><div class="course-cover">✦</div><div class="course-body"><h2>'+esc(c.title_ar)+'</h2><p>'+esc(c.description_ar||"كورس تدريبي من Marco Live Coach.")+'</p><div class="course-price">'+Number(c.price_egp).toLocaleString("ar-EG")+' جنيه</div><div class="receipt-area"><label>صورة إيصال إنستا باي</label><div style="padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:rgba(0,210,255,.07);color:var(--text);line-height:1.8"><strong>مهم قبل رفع الإيصال:</strong> عند أخذ Screenshot للتحويل، لازم يكون التاريخ ورقم Reference ظاهرين في الصورة. هتلاقي البيانات دي تحت كلمة <bdi dir="ltr">Show more</bdi> في تفاصيل التحويل داخل InstaPay. افتح <bdi dir="ltr">Show more</bdi> الأول، وبعدها خُد Screenshot كامل من غير قص.</div><input type="file" accept="image/jpeg,image/png,image/webp" data-receipt="'+esc(c.id)+'"><button class="btn btn-primary" type="button" data-buy="'+esc(c.id)+'">شراء الكورس وإرسال الإيصال</button></div></div></article>').join("");
 }
 grid.addEventListener("click",async e=>{
  const btn=e.target.closest("button[data-buy]");if(!btn)return;
  const id=btn.dataset.buy,file=grid.querySelector('input[data-receipt="'+CSS.escape(id)+'"]')?.files?.[0];
  if(!file){message.textContent="اختار صورة إيصال التحويل الأول.";return;}
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024){message.textContent="استخدم صورة JPG أو PNG أو WEBP بحد أقصى 8 ميجابايت.";return;}
  btn.disabled=true;message.textContent="جاري إنشاء طلب الشراء...";
  const {data:{user}}=await client.auth.getUser();
  const {data:purchase,error}=await client.from("course_purchases").insert({course_id:id,user_id:user.id,status:"awaiting_payment"}).select("id").single();
  if(error){btn.disabled=false;message.textContent=error.message.includes("one_active_course_purchase_per_user")?"لديك طلب شراء قائم أو اشتريت هذا الكورس بالفعل.": "تعذر إنشاء الطلب: "+error.message;return;}
  const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg",path=user.id+"/"+purchase.id+"."+ext;
  const {error:uploadError}=await client.storage.from("payment-receipts").upload(path,file,{upsert:false,contentType:file.type});
  if(uploadError){await client.rpc("cancel_course_purchase_upload",{p_purchase_id:purchase.id});btn.disabled=false;message.textContent="تعذر رفع الإيصال: "+uploadError.message;return;}
  const {error:submitError}=await client.rpc("submit_course_receipt",{p_purchase_id:purchase.id,p_receipt_path:path});
  if(submitError){await client.storage.from("payment-receipts").remove([path]);await client.rpc("cancel_course_purchase_upload",{p_purchase_id:purchase.id});btn.disabled=false;message.textContent="تعذر إرسال الإيصال للمراجعة: "+submitError.message;return;}
  message.textContent="تم إرسال طلب الشراء والإيصال. سيظهر الكورس في «كورساتي» بعد مراجعة الأدمن وتأكيد الدفع.";
  btn.textContent="تم إرسال الطلب";btn.disabled=true;
 });
 start();
})();