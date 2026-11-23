(() => {
  async function applyContent() {
    if (!window.supabase || !window.MARCO_SUPABASE_URL || !window.MARCO_SUPABASE_PUBLISHABLE_KEY) return;
    const client = window.marcoSupabase || window.supabase.createClient(window.MARCO_SUPABASE_URL,window.MARCO_SUPABASE_PUBLISHABLE_KEY);
    const {data,error}=await client.from("site_content").select("content_key,content_type,value_ar,value_en");
    if(error){console.warn("Site content could not be loaded:",error.message);return;}
    const lang=document.documentElement.lang==="ar"?"ar":"en";
    (data||[]).forEach(item=>{
      const value=lang==="ar"?(item.value_ar||item.value_en):(item.value_en||item.value_ar);
      if(!value)return;
      document.querySelectorAll('[data-content-key="'+CSS.escape(item.content_key)+'"]').forEach(el=>{
        if(item.content_type==="image"){
          if(el.tagName==="IMG")el.src=value;
          else el.style.backgroundImage='url("'+value.replace(/["\\]/g,"")+'")';
        } else if(item.content_type==="icon") {
          el.textContent=value;
        } else {
          el.textContent=value;
        }
      });
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",applyContent);
  else applyContent();
})();