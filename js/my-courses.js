(() => {
 const client=window.supabase.createClient(window.MARCO_SUPABASE_URL,window.MARCO_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const $=id=>document.getElementById(id),root=$("myCourses"),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function start(){
  const {data:{session}}=await client.auth.getSession();if(!session){location.replace("login.html?next="+encodeURIComponent(location.href));return;}
  $("signOutBtn").onclick=async()=>{await client.auth.signOut();location.replace("login.html");};$("menuBtn").onclick=()=>$("nav").classList.toggle("active");
  const {data:purchases,error}=await client.from("course_purchases").select("id,status,rejection_reason,created_at,courses(id,title_ar,description_ar)").order("created_at",{ascending:false});
  if(error){root.innerHTML='<div class="learn-empty">تعذر تحميل مشترياتك: '+esc(error.message)+'</div>';return;}
  if(!purchases?.length){root.innerHTML='<div class="learn-empty">لسه ما اشتريتش كورسات. <a href="courses.html" style="color:var(--cyan)">تصفح الكورسات</a></div>';return;}
  const cards=await Promise.all(purchases.map(async p=>{
   const c=p.courses||{},status=p.status==="confirmed"?"تم تأكيد الدفع":p.status==="payment_review"?"الإيصال قيد المراجعة":p.status==="rejected"?"الطلب مرفوض":"في انتظار الدفع";
   if(p.status!=="confirmed")return '<article class="learn-course"><h2>'+esc(c.title_ar||"كورس")+'</h2><p class="learn-muted">'+status+'</p>'+(p.rejection_reason?'<p>'+esc(p.rejection_reason)+'</p>':"")+'</article>';
   const {data:lessons,error:lessonError}=await client.from("course_lessons").select("id,title_ar,description_ar,video_path,sort_order").eq("course_id",c.id).eq("is_published",true).order("sort_order",{ascending:true});
   let lessonHtml='<p class="learn-muted">لا توجد دروس منشورة بعد.</p>';
   if(lessonError)lessonHtml='<p class="learn-muted">تعذر تحميل الدروس: '+esc(lessonError.message)+'</p>';
   else if(lessons?.length){lessonHtml=(await Promise.all(lessons.map(async l=>{
    let video="";if(l.video_path){const {data:signed,error:signedError}=await client.storage.from("course-videos").createSignedUrl(l.video_path,3600);if(!signedError&&signed?.signedUrl)video='<video controls controlsList="nodownload" preload="metadata" src="'+esc(signed.signedUrl)+'"></video>';else video='<p class="learn-muted">تعذر فتح الفيديو. حدّث الصفحة.</p>';}
    return '<div class="lesson"><h3>'+esc(l.title_ar)+'</h3>'+(l.description_ar?'<p class="learn-muted">'+esc(l.description_ar)+'</p>':"")+video+'</div>';
   }))).join("");}
   return '<article class="learn-course"><h2>'+esc(c.title_ar||"الكورس")+'</h2><p class="learn-muted">'+esc(c.description_ar||"")+'</p>'+lessonHtml+'</article>';
  }));
  root.innerHTML=cards.join("");
 }
 start();
})();