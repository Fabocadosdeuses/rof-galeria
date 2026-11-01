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
let selectedArtist = null;

$("year").textContent = new Date().getFullYear();

function status(id, message) {
  $(id).textContent = message;
}

function show(id) {
  $(id).classList.remove("hidden");
}

function hide(id) {
  $(id).classList.add("hidden");
}

function usernameEmail(name) {
  return name.trim().toLowerCase() + "@accounts.rof.invalid";
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

  if (!ready) return;

  const code = $("inviteCode").value.trim();

  if (!code) {
    status("inviteCodeStatus", "Introduz o código do convite.");
    return;
  }

  status("inviteCodeStatus", "A verificar o convite…");

  try {
    const { data, error } = await sb.functions.invoke("rof-accept-invite", {
      body: { action: "validate", code }
    });

    if (error || !data?.valid) {
      status("inviteCodeStatus", data?.error || "Convite inválido, expirado ou já utilizado.");
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
  } catch {
    status("inviteCodeStatus", "Não foi possível verificar o convite.");
  }
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
  $("password").autocomplete = "current-password";
  status("authStatus", "");
  show("authModal");
};

$("adminBtn").onclick = () => {
  if (currentProfile?.role === "admin") show("adminModal");
};

$("who").onclick = () => {
  if (currentProfile?.role === "admin") show("adminModal");
};

$("openInvitesBtn").onclick = () => {
  hide("adminModal");
  status("inviteResult", "");
  show("invitesModal");
};

$("openArtistsBtn").onclick = async () => {
  hide("adminModal");
  show("artistsModal");
  await loadArtists();
};

$("refreshArtistsBtn").onclick = loadArtists;

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
  await loadGallery();
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

  $("loginBtn").classList.toggle("hidden", logged);
}

async function loadProfile() {
  if (!sb) return;

  const { data: { user } } = await sb.auth.getUser();

  currentUser = user || null;
  currentProfile = null;

  if (user) {
    const { data, error } = await sb
      .from("profiles")
      .select("username,role,disabled")
      .eq("id", user.id)
      .maybeSingle();

    if (!error) currentProfile = data;

    if (!currentProfile || currentProfile.disabled) {
      const accountDisabled = currentProfile?.disabled === true;

      await sb.auth.signOut();
      currentUser = null;
      currentProfile = null;

      alert(
        accountDisabled
          ? "Esta conta está desativada."
          : "Não foi possível carregar o perfil."
      );
    }
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
          let storageCleanupFailed = !artwork.storage_path;

          if (artwork.storage_path) {
            try {
              const { error: storageError } = await sb.storage
                .from("artworks")
                .remove([artwork.storage_path]);

              storageCleanupFailed = !!storageError;
            } catch {
              storageCleanupFailed = true;
            }
          }

          await loadGallery();

          if (storageCleanupFailed) {
            alert(
              "A obra foi removida da galeria, mas não foi possível apagar a imagem do armazenamento. Verifica as permissões do bucket artworks."
            );
          }
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
    status("authStatus", "Usa 3–24 caracteres: letras sem acentos, números ou _.");
    return;
  }

  status("authStatus", "A verificar…");

  if (authMode === "login") {
    const { error } = await sb.auth.signInWithPassword({
      email: usernameEmail(username),
      password
    });

    if (error) {
      status("authStatus", "Não foi possível entrar. Confirma o nome e a palavra-passe.");
      return;
    }

    await loadProfile();

    if (!currentUser || !currentProfile) {
      status("authStatus", "Esta conta não tem acesso à galeria.");
      return;
    }

    hide("authModal");
    await loadGallery();
    return;
  }

  if (authMode === "register") {
    const code = $("invite").value.trim().toLowerCase();

    if (!code) {
      status("authStatus", "Falta o código de convite. Valida-o novamente.");
      return;
    }

    const { data, error } = await sb.functions.invoke("rof-accept-invite", {
      body: { action: "register", code, username, password }
    });

    if (error || !data?.username) {
      status(
        "authStatus",
        data?.error || "Não foi possível criar a conta. Confirma o convite."
      );
      return;
    }

    const { error: loginError } = await sb.auth.signInWithPassword({
      email: usernameEmail(username),
      password
    });

    if (loginError) {
      status("authStatus", "Conta criada! Entra agora com o teu nome e palavra-passe.");
      authMode = "login";
      $("authTitle").textContent = "Entrar na RØF";
      $("authDesc").textContent = "Acesso reservado aos artistas autorizados.";
      $("authSubmit").textContent = "Entrar";
      hide("inviteField");
      return;
    }

    await loadProfile();
    hide("authModal");
    await loadGallery();
    return;
  }

  status("authStatus", "Modo de autenticação inválido.");
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

  const upload = await sb.storage.from("artworks").upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (upload.error) {
    status("uploadStatus", "Erro ao carregar. Confirma as regras de armazenamento.");
    return;
  }

  const publicUrl = sb.storage.from("artworks").getPublicUrl(path).data.publicUrl;

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
    status("inviteResult", "Não foi possível gerar convite. Confirma a Edge Function.");
    return;
  }

  const code = typeof data === "string"
    ? data
    : data?.code ?? data?.invite_code;

  if (!code) {
    status("inviteResult", "Não encontrei o código do convite na resposta.");
    return;
  }

  status("inviteResult", "Código: " + code);

  try {
    await navigator.clipboard.writeText(code);
    status("inviteResult", "Código copiado: " + code);
  } catch {
    // O código permanece visível para cópia manual.
  }
};

/* Funções administrativas */

async function adminRequest(body) {
  const { data, error } = await sb.functions.invoke("rof-admin", { body });

  if (error) {
    throw new Error(data?.error || error.message || "Erro administrativo.");
  }

  if (data?.error) throw new Error(data.error);

  return data;
}

async function loadArtists() {
  const list = $("artistsList");
  list.textContent = "A carregar artistas…";

  try {
    const data = await adminRequest({ action: "list_artists" });
    list.innerHTML = "";

    if (!data.artists?.length) {
      list.textContent = "Ainda não existem artistas registados.";
      return;
    }

    data.artists.forEach(artist => {
      const row = document.createElement("div");
      row.className = "dash";

      const container = document.createElement("div");
      container.className = "artist-row";

      const info = document.createElement("div");

      const name = document.createElement("strong");
      name.textContent = "@" + artist.username;

      const state = document.createElement("div");
      state.className = "artist-state";
      state.textContent = artist.disabled ? "Conta desativada" : "Conta ativa";

      info.append(name, state);

      const edit = document.createElement("button");
      edit.className = "btn tiny";
      edit.textContent = "Gerir conta";
      edit.onclick = () => openArtistEditor(artist);

      container.append(info, edit);
      row.append(container);
      list.append(row);
    });
  } catch (error) {
    list.textContent = error.message;
  }
}

function openArtistEditor(artist) {
  selectedArtist = artist;

  $("editArtistId").value = artist.id;
  $("editArtistUsername").value = artist.username;
  $("editArtistName").textContent = "A gerir @" + artist.username;
  $("editArtistPassword").value = "";
  $("editArtistPasswordConfirm").value = "";

  $("toggleArtistDisabledBtn").textContent =
    artist.disabled ? "Reativar conta" : "Desativar conta";

  $("toggleArtistDisabledBtn").classList.toggle("danger", !artist.disabled);

  status("editArtistStatus", "");
  show("editArtistModal");
}

$("saveArtistUsernameBtn").onclick = async () => {
  const userId = $("editArtistId").value;
  const username = $("editArtistUsername").value.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    status("editArtistStatus", "Nome inválido. Usa 3–24 letras, números ou _.");
    return;
  }

  status("editArtistStatus", "A guardar…");

  try {
    await adminRequest({
      action: "change_username",
      user_id: userId,
      username
    });

    status("editArtistStatus", "Nome de utilizador atualizado.");
    await loadArtists();
  } catch (error) {
    status("editArtistStatus", error.message);
  }
};

$("saveArtistPasswordBtn").onclick = async () => {
  const userId = $("editArtistId").value;
  const password = $("editArtistPassword").value;
  const confirmation = $("editArtistPasswordConfirm").value;

  if (password.length < 8) {
    status("editArtistStatus", "A palavra-passe precisa de pelo menos 8 caracteres.");
    return;
  }

  if (password !== confirmation) {
    status("editArtistStatus", "As palavras-passe não coincidem.");
    return;
  }

  status("editArtistStatus", "A alterar palavra-passe…");

  try {
    await adminRequest({
      action: "change_password",
      user_id: userId,
      password
    });

    $("editArtistPassword").value = "";
    $("editArtistPasswordConfirm").value = "";
    status("editArtistStatus", "Palavra-passe alterada.");
  } catch (error) {
    status("editArtistStatus", error.message);
  }
};

$("toggleArtistDisabledBtn").onclick = async () => {
  const userId = $("editArtistId").value;
  const disabling = !selectedArtist?.disabled;

  if (!confirm(
    disabling
      ? "Desativar esta conta? As obras continuarão na galeria."
      : "Reativar esta conta?"
  )) return;

  status("editArtistStatus", "A atualizar conta…");

  try {
    await adminRequest({
      action: "set_disabled",
      user_id: userId,
      disabled: disabling
    });

    selectedArtist.disabled = disabling;

    $("toggleArtistDisabledBtn").textContent =
      disabling ? "Reativar conta" : "Desativar conta";

    status("editArtistStatus", disabling ? "Conta desativada." : "Conta reativada.");

    await loadArtists();
  } catch (error) {
    status("editArtistStatus", error.message);
  }
};

(async () => {
  if (!ready) {
    renderAuth();
    await loadGallery();
    return;
  }

  const { data: { session } } = await sb.auth.getSession();

  if (session) {
    await loadProfile();
  }

  renderAuth();
  await loadGallery();
})();
