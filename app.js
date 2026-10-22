// Configuração da RØF: preencher depois de criar o projeto Supabase.
const SUPABASE_URL = "https://yawijjityyryrvbyvbaz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_UAecJ2fj_d5ao4IPvtorgQ_PKug0e68";
const ready = !SUPABASE_URL.includes("COLOCA_AQUI") && !SUPABASE_ANON_KEY.includes("COLOCA_AQUI");
const sb = ready ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = id => document.getElementById(id);
let currentUser = null, currentProfile = null, authMode = "login";
$("year").textContent = new Date().getFullYear();

function status(id, msg){ $(id).textContent = msg; }
function show(id){ $(id).classList.remove("hidden"); }
function hide(id){ $(id).classList.add("hidden"); }
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>hide(b.dataset.close)));
$("loginBtn").onclick=()=>{ if(!ready){alert("Falta configurar o Supabase. Segue o README incluído no pacote.");return;} authMode="login"; $("authTitle").textContent="Entrar na RØF"; $("authDesc").textContent="Acesso reservado aos artistas autorizados."; $("authSubmit").textContent="Entrar"; hide("inviteField"); $("username").value="";$("password").value="";status("authStatus","");show("authModal");};
$("uploadBtn").onclick=()=>{ $("uploadForm").reset();status("uploadStatus","");show("uploadModal"); };
$("logoutBtn").onclick=async()=>{if(sb)await sb.auth.signOut();currentUser=null;currentProfile=null;renderAuth();loadGallery();};
function renderAuth(){
 const logged=!!currentUser;
 ["who","uploadBtn","logoutBtn"].forEach(id=>logged?show(id):hide(id));
 if(logged){$("who").textContent="@"+(currentProfile?.username||"artista");}
 $("loginBtn").classList.toggle("hidden",logged);
}
function usernameEmail(name){return name.trim().toLowerCase()+"@accounts.rof.invalid";}
async function loadProfile(){
 if(!sb)return;
 const {data:{user}}=await sb.auth.getUser();currentUser=user||null;currentProfile=null;
 if(user){const {data,error}=await sb.from("profiles").select("username,role").eq("id",user.id).maybeSingle();if(!error)currentProfile=data;}
 renderAuth();
}
async function loadGallery(){
 const g=$("gallery");
 if(!ready){g.innerHTML='<div class="empty"><strong>Pronta para receber as primeiras obras.</strong>O visual da RØF está preparado. Para contas, convites e publicações online, termina a configuração indicada no ficheiro README.</div>';return;}
 const {data,error}=await sb.from("artworks").select("id,title,credit,image_url,created_at,owner_id").order("created_at",{ascending:false});
 if(error){g.innerHTML='<div class="empty"><strong>A galeria está quase pronta.</strong>Confirma se executaste o SQL de instalação e configuraste o armazenamento.</div>';return;}
 if(!data?.length){g.innerHTML='<div class="empty"><strong>A primeira obra está à espera.</strong>Quando um artista publicar um desenho, ele aparecerá aqui.</div>';return;}
 g.innerHTML="";
 data.forEach(a=>{
   const card=document.createElement("article");card.className="art";
   const frame=document.createElement("div");frame.className="frame";
   const img=document.createElement("img");img.src=a.image_url;img.alt=a.title;img.loading="lazy";frame.append(img);
   const title=document.createElement("h3");title.textContent=a.title;
   card.append(frame,title);
   if(a.credit){const credit=document.createElement("p");credit.className="credit";credit.textContent="Por "+a.credit;card.append(credit);}
   if(currentUser && (currentUser.id===a.owner_id || currentProfile?.role==="admin")){
     const actions=document.createElement("div");actions.className="art-actions";
     const del=document.createElement("button");del.className="btn tiny";del.textContent="Apagar";
     del.onclick=async()=>{if(!confirm("Apagar esta obra da galeria?"))return;const {error}=await sb.from("artworks").delete().eq("id",a.id);if(error)alert("Não foi possível apagar: "+error.message);else loadGallery();};
     actions.append(del);card.append(actions);
   }
   g.append(card);
 });
 $("galleryInfo").textContent=`${data.length} ${data.length===1?"obra publicada":"obras publicadas"}.`;
 if(currentProfile?.role==="admin"){$("loginBtn").classList.add("hidden");}
}
$("authForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!ready)return;
 const username=$("username").value.trim().toLowerCase(),password=$("password").value;
 if(!/^[a-z0-9_]{3,24}$/.test(username)){status("authStatus","Usa 3–24 caracteres: letras sem acentos, números ou _ .");return;}
 status("authStatus","A verificar…");
 // Sign-in uses a username-shaped internal email. Account creation is intentionally disabled here;
 // invitations are handled through the server-side setup described in README.
 if(authMode==="login"){
   const {error}=await sb.auth.signInWithPassword({email:usernameEmail(username),password});
   if(error){status("authStatus","Não foi possível entrar. Confirma o nome e a palavra-passe.");return;}
   hide("authModal");await loadProfile();await loadGallery();
 }else{
   status("authStatus","Para criar contas com convite, segue a configuração de servidor descrita no README.");
 }
});
$("uploadForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!currentUser||!currentProfile){status("uploadStatus","Entra numa conta de artista primeiro.");return;}
 const file=$("artImage").files[0];if(!file)return;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)){status("uploadStatus","Usa JPG, PNG ou WebP.");return;}
 if(file.size>8*1024*1024){status("uploadStatus","A imagem tem de ter até 8 MB.");return;}
 status("uploadStatus","A carregar a imagem…");
 const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
 const path=`${currentUser.id}/${crypto.randomUUID()}.${ext}`;
 const up=await sb.storage.from("artworks").upload(path,file,{contentType:file.type,upsert:false});
 if(up.error){status("uploadStatus","Erro ao carregar. Confirma as regras de armazenamento.");return;}
 const pub=sb.storage.from("artworks").getPublicUrl(path).data.publicUrl;
 const {error}=await sb.from("artworks").insert({title:$("artTitle").value.trim(),credit:$("artCredit").value.trim()||null,image_url:pub,storage_path:path,owner_id:currentUser.id});
 if(error){await sb.storage.from("artworks").remove([path]);status("uploadStatus","Não foi possível publicar. Confirma as regras da base de dados.");return;}
 hide("uploadModal");loadGallery();
});
$("createInviteBtn").onclick=async()=>{
 if(!currentProfile||currentProfile.role!=="admin"){status("inviteResult","Só o administrador pode criar convites.");return;}
 status("inviteResult","A gerar convite…");
 const {data,error}=await sb.rpc("create_artist_invite");
 if(error){status("inviteResult","Não foi possível gerar convite. Confirma a configuração SQL.");return;}
 const code=data;status("inviteResult","Código: "+code+" — copia e envia à pessoa convidada.");
 try{await navigator.clipboard.writeText(code);status("inviteResult","Código copiado: "+code);}catch{}
};
(async()=>{if(!ready){renderAuth();loadGallery();return;}const {data:{session}}=await sb.auth.getSession();if(session)await loadProfile();renderAuth();loadGallery();})();
