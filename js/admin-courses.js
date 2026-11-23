(() => {
 const client=window.supabase.createClient(window.MARCO_SUPABASE_URL,window.MARCO_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let allowed=false;
 async function guard(){const {data:{session}}=await client.auth.getSession();if(!session){location.replace("login.html?next="+encodeURIComponent(location.href));return false;}$("adminEmail").textContent=session.user.email||"";const {data,error}=await client.rpc("is_marco_admin");if(error||data!==true){document.body.innerHTML='<main style="max-width:650px;margin:15vh auto;padding:30px;text-align:center"><h1>غير مصرح بالدخول</h1><a href="index.html">العودة للموقع</a></main>';return false;}allowed=true;return true;}
 async function loadCourses(){
  const root=$("courseList");root.innerHTML='<div class="manage-empty">جاري التحميل...</div>';
  const {data,error}=await client.from("courses").select("*").order("created_at",{ascending:false});if(error){root.textContent=error.message;return;}
  if(!data?.length){root.innerHTML='<div class="manage-empty">لم تضف كورسات بعد.</div>';return;}
  root.innerHTML=data.map(c=>'<article class="manage-item"><strong>'+esc(c.title_ar)+'</strong><small>'+Number(c.price_egp).toLocaleString("en-US")+' EGP · '+(c.is_published?"منشور":"مسودة")+'</small><div class="manage-actions"><button data-publish="'+c.id+'" data-next="'+(!c.is_published)+'">'+(c.is_published?"إلغاء النشر":"نشر الكورس")+'</button><button data-add-lesson="'+c.id+'">إضافة درس</button></div><div class="video-upload" id="lessons-'+c.id+'"></div></article>').join("");
  for(const c of data)await loadLessons(c.id);
 }
 async function loadLessons(courseId){
  const target=$("lessons-"+courseId);if(!target)return;
  const {data,error}=await client.from("course_lessons").select("*").eq("course_id",courseId).order("sort_order",{ascending:true});
  if(error){target.textContent=error.message;return;}
  target.innerHTML=(data||[]).map(l=>'<div class="manage-item"><strong>'+esc(l.title_ar)+'</strong><small>'+(l.video_path?"الفيديو مرفوع":"لا يوجد فيديو")+' · '+(l.is_published?"منشور":"مخفي")+'</small><div class="manage-actions"><button data-lesson-publish="'+l.id+'" data-next="'+(!l.is_published)+'">'+(l.is_published?"إخفاء الدرس":"نشر الدرس")+'</button><button class="danger" data-lesson-delete="'+l.id+'" data-video="'+esc(l.video_path||"")+'">حذف الدرس</button></div><label>رفع / استبدال الفيديو<input type="file" accept="video/mp4,video/webm,video/quicktime" data-video-upload="'+l.id+'" data-course="'+courseId+'"></label></div>').join("")||'<small>لا توجد دروس بعد.</small>';
 }
 $("courseForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!allowed)return;const button=$("saveCourse");button.disabled=true;$("courseMessage").textContent="جاري إضافة الكورس...";
  const {data:{user}}=await client.auth.getUser();
  const {data:c,error}=await client.from("courses").insert({title_ar:$("titleAr").value.trim(),title_en:$("titleEn").value.trim()||null,description_ar:$("descriptionAr").value.trim()||null,description_en:$("descriptionEn").value.trim()||null,price_egp:Number($("priceEgp").value),created_by:user.id}).select("id").single();
  if(error){$("courseMessage").textContent="تعذر إضافة الكورس: "+error.message;button.disabled=false;return;}
  $("courseForm").reset();$("courseMessage").textContent="تم إنشاء الكورس كمسودة. أضف الدروس ثم انشره.";button.disabled=false;await loadCourses();
 });
 $("courseList").addEventListener("click",async e=>{
  const b=e.target.closest("button");if(!b||!allowed)return;
  if(b.dataset.publish){const {error}=await client.from("courses").update({is_published:b.dataset.next==="true"}).eq("id",b.dataset.publish);$("lessonMessage").textContent=error?error.message:"تم تحديث حالة النشر.";await loadCourses();return;}
  if(b.dataset.addLesson){const title=prompt("اكتب اسم الدرس بالعربي:");if(!title?.trim())return;const description=prompt("وصف الدرس (اختياري):")||"";const {data:{count}}=await client.from("course_lessons").select("*",{count:"exact",head:true}).eq("course_id",b.dataset.addLesson);const {error}=await client.from("course_lessons").insert({course_id:b.dataset.addLesson,title_ar:title.trim(),description_ar:description,sort_order:count||0,is_published:true});$("lessonMessage").textContent=error?error.message:"تمت إضافة الدرس.";await loadCourses();return;}
  if(b.dataset.lessonPublish){const {error}=await client.from("course_lessons").update({is_published:b.dataset.next==="true"}).eq("id",b.dataset.lessonPublish);$("lessonMessage").textContent=error?error.message:"تم تحديث الدرس.";await loadCourses();return;}
  if(b.dataset.lessonDelete){if(!confirm("حذف الدرس نهائيًا؟"))return;const path=b.dataset.video;if(path)await client.storage.from("course-videos").remove([path]);const {error}=await client.from("course_lessons").delete().eq("id",b.dataset.lessonDelete);$("lessonMessage").textContent=error?error.message:"تم حذف الدرس.";await loadCourses();}
 });
 $("courseList").addEventListener("change",async e=>{
  const input=e.target.closest("input[data-video-upload]");if(!input||!input.files[0]||!allowed)return;
  const file=input.files[0];if(!["video/mp4","video/webm","video/quicktime"].includes(file.type)){alert("استخدم MP4 أو WEBM أو MOV.");input.value="";return;}
  if(file.size>500*1024*1024){alert("حجم الفيديو أكبر من 500MB. قلل الحجم قبل الرفع.");input.value="";return;}
  const lessonId=input.dataset.videoUpload,courseId=input.dataset.course,ext=file.type==="video/webm"?"webm":file.type==="video/quicktime"?"mov":"mp4",path=courseId+"/"+lessonId+"."+ext;
  $("lessonMessage").textContent="جاري رفع الفيديو... اترك الصفحة مفتوحة حتى يكتمل الرفع.";
  const {error:uploadError}=await client.storage.from("course-videos").upload(path,file,{upsert:true,contentType:file.type});
  if(uploadError){$("lessonMessage").textContent="فشل رفع الفيديو: "+uploadError.message;return;}
  const {error:updateError}=await client.from("course_lessons").update({video_path:path}).eq("id",lessonId);
  $("lessonMessage").textContent=updateError?"تم رفع الفيديو لكن تعذر ربطه بالدرس: "+updateError.message:"تم رفع الفيديو وربطه بالدرس.";
  await loadCourses();
 });
 async function loadPurchases(){
  const root=$("purchaseList");root.innerHTML='<div class="manage-empty">جاري تحميل الطلبات...</div>';
  const {data,error}=await client.from("course_purchases").select("id,user_id,status,payment_receipt_path,created_at,receipt_check_status,courses(title_ar,price_egp)").order("created_at",{ascending:false});
  if(error){root.textContent=error.message;return;}if(!data?.length){root.innerHTML='<div class="manage-empty">لا توجد طلبات شراء.</div>';return;}
  root.innerHTML=await Promise.all(data.map(async p=>{
   let link='<small>لا يوجد إيصال</small>';if(p.payment_receipt_path){const {data:s}=await client.storage.from("payment-receipts").createSignedUrl(p.payment_receipt_path,3600);if(s?.signedUrl)link='<a href="'+esc(s.signedUrl)+'" target="_blank" rel="noopener noreferrer">عرض إيصال الدفع</a>';}
   const review=["awaiting_payment","payment_review"].includes(p.status);
   return '<article class="manage-item"><strong>'+esc(p.courses?.title_ar||"كورس")+'</strong><small>العميل: '+esc(p.user_id)+' · '+Number(p.courses?.price_egp||0).toLocaleString("en-US")+' EGP</small><small>الحالة: '+esc(p.status)+' · فحص الإيصال: '+esc(p.receipt_check_status)+'</small>'+link+(review?'<div class="manage-actions"><button data-review="confirmed" data-id="'+p.id+'">تأكيد الدفع وفتح الكورس</button><button class="danger" data-review="rejected" data-id="'+p.id+'">رفض الطلب</button></div>':"")+'</article>';
  })).join("");
 }
 $("purchaseList").addEventListener("click",async e=>{
  const b=e.target.closest("button[data-review]");if(!b||!allowed)return;let reason=null;if(b.dataset.review==="rejected"){reason=prompt("اكتب سبب رفض الدفع:");if(reason===null)return;if(!reason.trim()){alert("سبب الرفض مطلوب.");return;}}else if(!confirm("هل تحققت من وصول المبلغ وتريد فتح الكورس للعميل؟"))return;
  b.disabled=true;$("purchaseMessage").textContent="جاري تحديث الطلب...";
  const {error}=await client.rpc("admin_review_course_purchase",{p_purchase_id:b.dataset.id,p_status:b.dataset.review,p_rejection_reason:reason});
  $("purchaseMessage").textContent=error?"تعذر تحديث الطلب: "+error.message:(b.dataset.review==="confirmed"?"تم تأكيد الدفع وفتح الكورس للعميل.":"تم رفض طلب الشراء.");
  await loadPurchases();
 });
 $("refreshBtn").onclick=async()=>{await loadCourses();await loadPurchases();};
 $("signOutBtn").onclick=async()=>{await client.auth.signOut();location.replace("login.html");};
 $("menuBtn").onclick=()=>$("nav").classList.toggle("active");
 if(await guard()){await loadCourses();await loadPurchases();}
})();
