
const SUPABASE_URL = "https://yawijjityyryrvbyvbaz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_UAecJ2fj_d5ao4IPvtorgQ_PKug0e68";

const ready =
  !SUPABASE_URL.includes("COLOCA_AQUI") &&
  !SUPABASE_ANON_KEY.includes("COLOCA_AQUI");

const sb = ready
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = id => document.getElementById(id);

let currentUser = null;
let currentProfile = null;
let authMode = "login";

$("year").textContent = new Date().getFullYear();

function status(id, msg) {
  $(id).textContent = msg;
}

function show(id) {
  $(id).classList.remove("hidden");
}

function hide(id) {
  $(id).classList.add("hidden");
}

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => hide(button.dataset.close));
});

$("inviteEntryBtn").onclick = () => {
  $("inviteCode").value = "";
  status("inviteCodeStatus", "");
  show("inviteModal");
};

$("inviteForm").addEventListener("submit", async event => {
  event.preventDefault();

  const code = $("inviteCode").value.trim();

  if (!code) {
    status("inviteCodeStatus", "Introduz o código do convite.");
    return;
  }

  status("inviteCodeStatus", "A verificar o convite…");

  const { data, error } = await sb.functions.invoke("rof-accept-invite", {
    body: { action: "validate", code }
  });

  if (error || !data?.valid) {
    status(
      "inviteCodeStatus",
      data?.error || "Convite inválido, expirado ou já utilizado."
    );
    return;
  }

  hide("inviteModal");

  authMode = "register";
  $("authTitle").textContent = "Criar conta de artista";
  $("authDesc").textContent = "Convite validado! Escolhe o teu nome e palavra-passe.";
  $("authSubmit").textContent = "Criar conta";
  $("invite").value = code;
  show("inviteField");
  $("username").value = "";
  $("password").value = "";
  $("password").autocomplete = "new-password";
  status("authStatus", "");
  show("authModal");
});

$("loginBtn").onclick = () => {
  if (!ready) {
    alert("Falta configurar o Supabase.");
    return;
  }

  authMode = "login";
  $("authTitle").textContent = "Entrar na RØF";
  $("authDesc").textContent = "Acesso reservado aos artistas autorizados.";
  $("authSubmit").textContent = "Entrar";
  hide("inviteField");
  $("username").value = "";
  $("password").value = "";
  status("authStatus", "");
  show("authModal");
};

$("adminBtn").onclick = () => {
  if (currentProfile?.role === "admin") {
    show("adminModal");
  }
};

$("who").onclick = () => {
  if (currentProfile?.role === "admin") {
    show("adminModal");
  }
};

$("uploadBtn").onclick = () => {
  $("uploadForm").reset();
  status("uploadStatus", "");
  show("uploadModal");
};

$("logoutBtn").onclick = async () => {
  if (sb) await sb.auth.signOut();

  currentUser = null;
  currentProfile = null;

  renderAuth();
  loadGallery();
};

function renderAuth() {
  const logged = !!currentUser;
  
$("inviteEntryBtn").classList.toggle("hidden", logged);
  
  ["who", "uploadBtn", "logoutBtn"].forEach(id => {
    logged ? show(id) : hide(id);
  });

  if (logged) {
    $("who").textContent = "@" + (currentProfile?.username || "artista");
  }

  $("adminBtn").classList.toggle(
    "hidden",
    !logged || currentProfile?.role !== "admin"
  );

  $("loginBtn").classList.toggle(
    "hidden",
    logged || currentProfile?.role === "admin"
  );
}

function usernameEmail(name) {
  return name.trim().toLowerCase() + "@accounts.rof.invalid";
}

async function loadProfile() {
  if (!sb) return;

  const { data: { user } } = await sb.auth.getUser();

  currentUser = user || null;
  currentProfile = null;

  if (user) {
    const { data, error } = await sb
      .from("profiles")
      .select("username,role")
      .eq("id", user.id)
      .maybeSingle();

    if (!error) currentProfile = data;
  }

  renderAuth();
}

async function loadGallery() {
  const gallery = $("gallery");

  if (!ready) {
    gallery.innerHTML =
      '<div class="empty"><strong>Pronta para receber as primeiras obras.</strong>Termina a configuração do Supabase.</div>';
    return;
  }

  const { data, error } = await sb
    .from("artworks")
    .select("id,title,credit,image_url,created_at,owner_id,storage_path")
    .order("created_at", { ascending: false });

  if (error) {
    gallery.innerHTML =
      '<div class="empty"><strong>A galeria está quase pronta.</strong>Confirma o SQL e as permissões do Supabase.</div>';
    return;
  }

  if (!data?.length) {
    gallery.innerHTML =
      '<div class="empty"><strong>A primeira obra está à espera.</strong>Quando um artista publicar um desenho, ele aparecerá aqui.</div>';
    $("galleryInfo").textContent = "0 obras publicadas.";
    return;
  }

  gallery.innerHTML = "";

  data.forEach(artwork => {
    const card = document.createElement("article");
    card.className = "art";

    const frame = document.createElement("div");
    frame.className = "frame";

    const img = document.createElement("img");
    img.src = artwork.image_url;
    img.alt = artwork.title;
    img.loading = "lazy";

    frame.append(img);

    const title = document.createElement("h3");
    title.textContent = artwork.title;

    card.append(frame, title);

    if (artwork.credit) {
      const credit = document.createElement("p");
      credit.className = "credit";
      credit.textContent = "Por " + artwork.credit;
      card.append(credit);
    }

    if (
      currentUser &&
      (currentUser.id === artwork.owner_id ||
        currentProfile?.role === "admin")
    ) {
      const actions = document.createElement("div");
      actions.className = "art-actions";

      const del = document.createElement("button");
      del.className = "btn tiny";
      del.textContent = "Apagar";

      del.onclick = async () => {
        if (!confirm("Apagar esta obra da galeria?")) return;

        const { error } = await sb
          .from("artworks")
          .delete()
          .eq("id", artwork.id);

        if (error) {
          alert("Não foi possível apagar: " + error.message);
        } else {
          await loadGallery();
        }
      };

      actions.append(del);
      card.append(actions);
    }

    gallery.append(card);
  });

  $("galleryInfo").textContent =
    `${data.length} ${data.length === 1 ? "obra publicada" : "obras publicadas"}.`;
}


$("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!ready) return;

  const username = $("username").value.trim().toLowerCase();
  const password = $("password").value;

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    status(
      "authStatus",
      "Usa 3–24 caracteres: letras sem acentos, números ou _."
    );
    return;
  }

  status("authStatus", "A verificar…");

  if (authMode === "login") {
    const { error } = await sb.auth.signInWithPassword({
      email: usernameEmail(username),
      password
    });

    if (error) {
      status(
        "authStatus",
        "Não foi possível entrar. Confirma o nome e a palavra-passe."
      );
      return;
    }

    hide("authModal");
    await loadProfile();
    await loadGallery();
    return;
  }

  if (authMode === "register") {
    const code = $("invite").value.trim().toLowerCase();

    if (!code) {
      status("authStatus", "Falta o código de convite. Valida-o novamente.");
      return;
    }

    const { data, error } = await sb.functions.invoke(
      "rof-accept-invite",
      {
        body: {
          action: "register",
          code,
          username,
          password
        }
      }
    );

    if (error || !data?.username) {
      status(
        "authStatus",
        data?.error ||
          "Não foi possível criar a conta. Confirma o convite e tenta novamente."
      );
      return;
    }

    const { error: loginError } = await sb.auth.signInWithPassword({
      email: usernameEmail(username),
      password
    });

    if (loginError) {
      status(
        "authStatus",
        "Conta criada! Entra agora com o teu nome e palavra-passe."
      );
      authMode = "login";
      $("authTitle").textContent = "Entrar na RØF";
      $("authDesc").textContent =
        "Acesso reservado aos artistas autorizados.";
      $("authSubmit").textContent = "Entrar";
      hide("inviteField");
      return;
    }

    hide("authModal");
    await loadProfile();
    await loadGallery();
    return;
  }

  status("authStatus", "Modo de autenticação inválido. Fecha esta janela e tenta novamente.");
});


$("uploadForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser || !currentProfile) {
    status("uploadStatus", "Entra numa conta de artista primeiro.");
    return;
  }

  const file = $("artImage").files[0];
  if (!file) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    status("uploadStatus", "Usa JPG, PNG ou WebP.");
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    status("uploadStatus", "A imagem tem de ter até 8 MB.");
    return;
  }

  status("uploadStatus", "A carregar a imagem…");

  const ext = file.type === "image/png"
    ? "png"
    : file.type === "image/webp"
      ? "webp"
      : "jpg";

  const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;

  const upload = await sb.storage
    .from("artworks")
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (upload.error) {
    status("uploadStatus", "Erro ao carregar. Confirma as regras de armazenamento.");
    return;
  }

  const publicUrl = sb.storage
    .from("artworks")
    .getPublicUrl(path).data.publicUrl;

  const { error } = await sb.from("artworks").insert({
    title: $("artTitle").value.trim(),
    credit: $("artCredit").value.trim() || null,
    image_url: publicUrl,
    storage_path: path,
    owner_id: currentUser.id
  });

  if (error) {
    await sb.storage.from("artworks").remove([path]);
    status("uploadStatus", "Não foi possível publicar. Confirma as regras da base de dados.");
    return;
  }

  hide("uploadModal");
  await loadGallery();
});

$("createInviteBtn").onclick = async () => {
  if (!currentProfile || currentProfile.role !== "admin") {
    status("inviteResult", "Só o administrador pode criar convites.");
    return;
  }

  status("inviteResult", "A gerar convite…");

  const { data, error } = await sb.functions.invoke("rof-invite-artist");

  if (error) {
    status(
      "inviteResult",
      "Não foi possível gerar convite. Confirma a Edge Function e as permissões."
    );
    return;
  }

  const code = typeof data === "string"
    ? data
    : data?.code ?? data?.invite_code;

  if (!code) {
    status("inviteResult", "A função respondeu, mas não encontrei o código do convite.");
    return;
  }

  status("inviteResult", "Código: " + code + " — copia e envia à pessoa convidada.");

  try {
    await navigator.clipboard.writeText(code);
    status("inviteResult", "Código copiado: " + code);
  } catch {
    // O código continua visível para ser copiado manualmente.
  }
};

(async () => {
  if (!ready) {
    renderAuth();
    loadGallery();
    return;
  }

  const { data: { session } } = await sb.auth.getSession();

  if (session) {
    await loadProfile();
  }

  renderAuth();
  await loadGallery();
})();
