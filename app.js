"use strict";

const BASE = location.pathname.replace(/(?:index\.html)?$/, "");
const $ = (id) => document.getElementById(id);
const LEVEL_NAMES = {1: "Baixa", 2: "Leve", 3: "Alta", 4: "Central"};
const STATUSES = [["planned", "Quero assistir"], ["watched", "Assistido"], ["skipped", "Deixar passar"]];
const state = {
  episodes: [], episodeKeys: new Set(), progress: {}, user: null, pendingRestore: null, busy: new Set(),
  filters: {season: {level: 4, status: "all", query: ""}, list: {level: 4, status: "all", query: ""}},
  view: "home", season: 0
};
let toastTimer;
const desktopMedia = window.matchMedia("(min-width: 941px)");
let sidebarCollapsed = false;
try { sidebarCollapsed = localStorage.getItem("spn_sidebar_collapsed") === "1"; } catch (_) { /* Private browsing may block storage. */ }

function syncSidebar() {
  $("app").querySelector(".app-layout").classList.toggle("sidebar-collapsed", sidebarCollapsed);
  const visible = desktopMedia.matches && !sidebarCollapsed;
  $("desktop-sidebar").inert = !visible;
  $("desktop-sidebar").setAttribute("aria-hidden", String(!visible));
  const expanded = desktopMedia.matches ? visible : !$("drawer").hidden;
  $("menu-toggle").setAttribute("aria-expanded", String(expanded));
  $("menu-toggle").setAttribute("aria-label", desktopMedia.matches ? visible ? "Ocultar temporadas" : "Mostrar temporadas" : expanded ? "Fechar menu de temporadas" : "Abrir menu de temporadas");
}

function message(value) {
  const toast = $("toast");
  toast.textContent = value;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function node(tag, className = "", value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}

function openAuthTab(tab) {
  $("login-form").hidden = tab !== "login";
  $("register-form").hidden = tab !== "register";
  $("tab-login").classList.toggle("active", tab === "login");
  $("tab-register").classList.toggle("active", tab === "register");
  $("auth-title").textContent = tab === "register" ? "Crie seu arquivo de caçadas." : "Sua próxima caçada começa aqui.";
}

function showAuth() {
  state.user = null;
  state.progress = {};
  state.pendingRestore = null;
  $("app").hidden = true;
  $("auth").hidden = false;
  $("login-password").value = "";
  $("register-password").value = "";
  $("register-note").textContent = "Sua conta e suas marcações ficarão neste navegador. Guarde um backup para usar em outro aparelho.";
  openAuthTab("login");
}

async function bootstrap() {
  try {
    if (!state.episodes.length) {
      const response = await fetch(`${BASE}episodes.json`);
      if (!response.ok) throw new Error("Não foi possível carregar o catálogo de episódios.");
      state.episodes = await response.json();
      state.episodeKeys = new Set(state.episodes.map((episode) => episode.key));
    }
    const profile = SPNStorage.activeProfile();
    if (!profile) { showAuth(); return; }
    state.progress = {...profile.progress};
    state.user = {username: profile.username};
    $("auth").hidden = true;
    $("app").hidden = false;
    $("account-name").textContent = state.user.username;
    renderSeasonNav();
    syncSidebar();
    renderRoute();
    SPNFolderBackup.status().catch(() => {});
  } catch (error) {
    showAuth();
    message(error.message || "Não foi possível carregar os episódios.");
  }
}

function normalize(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function route() {
  const suffix = decodeURI(location.hash.slice(1));
  const match = /^\/temporada\/([1-9]|1[0-5])$/.exec(suffix);
  if (match) return {view: "season", season: Number(match[1])};
  if (suffix === "/minha-lista") return {view: "list", season: 0};
  if (suffix === "/andamento") return {view: "progress", season: 0};
  if (suffix === "/ajustes") return {view: "settings", season: 0};
  return {view: "home", season: 0};
}
function seasonHref(season) { return `${BASE}#/temporada/${season}`; }
function closeDrawer() {
  $("drawer").hidden = true;
  $("drawer-backdrop").hidden = true;
  document.body.classList.remove("drawer-open");
  syncSidebar();
}
function navigate(url) {
  closeDrawer();
  if (location.pathname + location.hash !== url) history.pushState({}, "", url);
  renderRoute();
  window.scrollTo({top: 0, behavior: "auto"});
}

function renderSeasonNav() {
  for (const id of ["desktop-seasons", "drawer-seasons"]) {
    const nav = $(id);
    nav.replaceChildren();
    for (let season = 1; season <= 15; season++) {
      const link = node("a", "season-shortcut");
      link.href = seasonHref(season);
      link.dataset.link = "";
      link.dataset.season = String(season);
      link.append(node("span", "", `Temporada ${String(season).padStart(2, "0")}`), node("span", "shortcut-count", String(state.episodes.filter((episode) => episode.season === season).length)));
      nav.append(link);
    }
  }
}
function seasonEpisodes(season) { return state.episodes.filter((episode) => episode.season === season); }
function countStatus(episodes, status) { return episodes.filter((episode) => state.progress[episode.key] === status).length; }

function renderHome() {
  const grid = $("season-grid");
  const fragment = document.createDocumentFragment();
  for (let season = 1; season <= 15; season++) {
    const episodes = seasonEpisodes(season);
    const watched = countStatus(episodes, "watched");
    const card = node("a", "season-card");
    card.href = seasonHref(season);
    card.dataset.link = "";
    card.append(node("span", "season-number", String(season).padStart(2, "0")), node("strong", "", `Temporada ${season}`), node("span", "season-card-count", `${watched} de ${episodes.length} assistidos`));
    const track = node("span", "progress-track");
    const fill = node("span", "progress-fill");
    fill.style.width = `${watched / episodes.length * 100}%`;
    track.append(fill);
    card.append(track);
    fragment.append(card);
  }
  grid.replaceChildren(fragment);
}

function renderFilters(mode) {
  const filters = state.filters[mode];
  const statuses = mode === "list"
    ? [["all", "Minha lista"], ["planned", "Quero assistir"], ["watched", "Assistidos"], ["skipped", "Deixar passar"]]
    : [["all", "Todos"], ["unmarked", "Não marcados"], ["planned", "Quero assistir"], ["watched", "Assistidos"], ["skipped", "Deixar passar"]];
  const mount = $(`${mode}-filters`);
  mount.replaceChildren();
  const searchLabel = node("label", "search-label");
  searchLabel.append(node("span", "sr-only", "Buscar episódios"));
  const search = node("input", "search-field");
  search.type = "search";
  search.placeholder = "Buscar título, criatura ou sinopse…";
  search.autocomplete = "off";
  search.value = filters.query;
  search.dataset.search = mode;
  searchLabel.append(search);
  const lower = node("div", "filter-lower");
  const levels = node("div", "filter-group");
  levels.append(node("span", "filter-label", "ATÉ O NÍVEL"));
  const levelButtons = node("div", "chip-row");
  levelButtons.setAttribute("role", "group");
  levelButtons.setAttribute("aria-label", "Nível máximo da história principal");
  for (let level = 1; level <= 4; level++) {
    const button = node("button", `filter-chip level-chip${filters.level === level ? " active" : ""}`, String(level));
    button.type = "button";
    button.dataset.level = String(level);
    button.dataset.mode = mode;
    button.title = `Até o nível ${level}: ${LEVEL_NAMES[level]}`;
    button.setAttribute("aria-pressed", String(filters.level === level));
    levelButtons.append(button);
  }
  levels.append(levelButtons);
  const statusGroup = node("div", "filter-group status-group");
  statusGroup.append(node("span", "filter-label", "MARCAÇÃO"));
  const statusButtons = node("div", "chip-row status-chips");
  statusButtons.setAttribute("role", "group");
  statusButtons.setAttribute("aria-label", "Filtrar por marcação");
  for (const [value, label] of statuses) {
    const button = node("button", `filter-chip${filters.status === value ? " active" : ""}`, label);
    button.type = "button";
    button.dataset.filterStatus = value;
    button.dataset.mode = mode;
    button.setAttribute("aria-pressed", String(filters.status === value));
    statusButtons.append(button);
  }
  statusGroup.append(statusButtons);
  lower.append(levels, statusGroup);
  const clear = node("button", "clear-filters", "Limpar filtros");
  clear.type = "button";
  clear.dataset.clear = mode;
  clear.hidden = filters.level === 4 && filters.status === "all" && !filters.query;
  mount.append(searchLabel, lower, clear);
}

function episodeCard(episode) {
  const status = state.progress[episode.key] || "";
  const card = node("article", `episode-card${status === "watched" ? " watched" : ""}`);
  card.dataset.key = episode.key;
  const top = node("div", "episode-top");
  top.append(node("span", "episode-id", `T${String(episode.season).padStart(2, "0")} · EP ${String(episode.number).padStart(2, "0")}`));
  const level = node("span", `level-pill level-${episode.level}`, `NÍVEL ${episode.level} · ${LEVEL_NAMES[episode.level].toUpperCase()}`);
  level.title = `${LEVEL_NAMES[episode.level]}: proximidade com a história principal`;
  top.append(level);
  const title = node("h2", "episode-title", episode.title);
  if (episode.original_title !== episode.title) title.title = `Título original: ${episode.original_title}`;
  const summary = node("p", "episode-summary", episode.summary);
  const bottom = node("div", "episode-bottom");
  const actions = node("div", "status-actions");
  for (const [value, label] of STATUSES) {
    const button = node("button", `status-action${status === value ? " selected" : ""}`, label);
    button.type = "button";
    button.dataset.episodeStatus = value;
    button.dataset.key = episode.key;
    button.disabled = state.busy.has(episode.key);
    button.setAttribute("aria-pressed", String(status === value));
    button.setAttribute("aria-label", `${label}: ${episode.title}. Clique novamente para desmarcar.`);
    actions.append(button);
  }
  const source = node("a", "source-link", "Fonte ↗");
  source.href = episode.source_url;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  source.title = `Ficha de ${episode.title} no TVmaze`;
  bottom.append(actions, source);
  card.append(top, title, summary, bottom);
  return card;
}
function filtered(mode) {
  const filters = state.filters[mode];
  const query = normalize(filters.query.trim());
  return state.episodes.filter((episode) => {
    const status = state.progress[episode.key] || "";
    if (mode === "season" && episode.season !== state.season) return false;
    if (mode === "list" && !status) return false;
    if (episode.level > filters.level) return false;
    if (filters.status === "unmarked" && status) return false;
    if (filters.status !== "all" && filters.status !== "unmarked" && status !== filters.status) return false;
    return !query || normalize(`${episode.title} ${episode.original_title} ${episode.summary} ${episode.key} s${episode.season}e${episode.number}`).includes(query);
  });
}
function renderListing(mode) {
  const episodes = filtered(mode);
  const fragment = document.createDocumentFragment();
  episodes.forEach((episode) => fragment.append(episodeCard(episode)));
  $(`${mode}-episodes`).replaceChildren(fragment);
  $(`${mode}-empty`).hidden = episodes.length > 0;
  $(`${mode}-results`).textContent = `${episodes.length} ${episodes.length === 1 ? "episódio" : "episódios"}`;
}
function renderSeason() {
  $("season-title").textContent = `Temporada ${String(state.season).padStart(2, "0")}`;
  $("season-title").dataset.echo = $("season-title").textContent;
  const episodes = seasonEpisodes(state.season);
  $("season-progress").textContent = `${countStatus(episodes, "watched")} de ${episodes.length} assistidos`;
  renderFilters("season");
  renderListing("season");
}
function renderList() {
  $("list-count").textContent = `${Object.keys(state.progress).length} marcados`;
  renderFilters("list");
  renderListing("list");
}
function renderProgress() {
  const container = $("progress-summary");
  container.replaceChildren();
  for (const [status, label] of [["watched", "Assistidos"], ["planned", "Quero assistir"], ["skipped", "Deixar passar"]]) {
    const box = node("div", "stat-box");
    box.append(node("strong", "", String(countStatus(state.episodes, status))), node("span", "", label));
    container.append(box);
  }
  const rows = $("progress-seasons");
  rows.replaceChildren();
  for (let season = 1; season <= 15; season++) {
    const episodes = seasonEpisodes(season);
    const watched = countStatus(episodes, "watched");
    const link = node("a", "progress-row");
    link.href = seasonHref(season);
    link.dataset.link = "";
    link.append(node("strong", "", `Temporada ${String(season).padStart(2, "0")}`));
    const track = node("span", "progress-track");
    const fill = node("span", "progress-fill");
    fill.style.width = `${watched / episodes.length * 100}%`;
    track.append(fill);
    link.append(track, node("span", "progress-fraction", `${watched}/${episodes.length}`));
    rows.append(link);
  }
}
function renderSettings() {
  $("settings-user").textContent = state.user.username;
  SPNFolderBackup.status().then((status) => {
    $("backup-status").textContent = {
      connected: "Pasta autorizada: os backups em arquivo são atualizados quando você marca um episódio.",
      unselected: "Pasta não escolhida. O progresso é salvo neste navegador; escolha uma pasta se quiser arquivos automáticos.",
      unsupported: "Este navegador não permite escolher uma pasta. Use “Baixar arquivo” para guardar um backup.",
      "permission-needed": "A permissão da pasta não está ativa. Escolha uma pasta novamente se quiser usar backups automáticos."
    }[status] || "Não foi possível verificar a pasta.";
  });
}
function renderRoute() {
  if (!state.episodes.length) return;
  const current = route();
  state.view = current.view;
  state.season = current.season;
  for (const [view, id] of [["home", "home-view"], ["season", "season-view"], ["list", "list-view"], ["progress", "progress-view"], ["settings", "settings-view"]]) $(id).hidden = view !== state.view;
  document.querySelectorAll("[data-nav]").forEach((link) => link.classList.toggle("active", link.dataset.nav === (state.view === "season" ? "home" : state.view)));
  document.querySelectorAll(".season-shortcut").forEach((link) => {
    const active = state.view === "season" && Number(link.dataset.season) === state.season;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
  document.title = `${state.view === "season" ? `Temporada ${state.season}` : state.view === "list" ? "Minha lista" : state.view === "progress" ? "Andamento" : state.view === "settings" ? "Conta" : "Início"} · Supernatural`;
  if (state.view === "home") renderHome();
  if (state.view === "season") renderSeason();
  if (state.view === "list") renderList();
  if (state.view === "progress") renderProgress();
  if (state.view === "settings") renderSettings();
}
async function saveStatus(key, selected) {
  if (state.busy.has(key)) return;
  const status = state.progress[key] === selected ? "" : selected;
  state.busy.add(key);
  document.querySelectorAll(`.episode-card[data-key="${key}"] button`).forEach((button) => { button.disabled = true; });
  try {
    const profile = SPNStorage.saveProgress(state.user.username, key, status, state.episodeKeys);
    state.progress = {...profile.progress};
    renderRoute();
    message(status === "watched" ? "Marcado como assistido." : status === "planned" ? "Adicionado à sua lista." : status === "skipped" ? "Marcado para deixar passar." : "Marcação removida.");
    SPNFolderBackup.autoSave(SPNStorage.makeBackup(profile)).catch(() => {});
  } catch (error) {
    message(error.message || "Não foi possível guardar a marcação.");
  } finally {
    state.busy.delete(key);
    document.querySelectorAll(`.episode-card[data-key="${key}"] button`).forEach((button) => { button.disabled = false; });
  }
}

$("tab-login").addEventListener("click", () => openAuthTab("login"));
$("tab-register").addEventListener("click", () => openAuthTab("register"));
for (const mode of ["login", "register"]) {
  $(`${mode}-form`).addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const error = $(`${mode}-error`);
    error.hidden = true;
    button.disabled = true;
    const payload = {username: $(`${mode}-user`).value.trim(), password: $(`${mode}-password`).value};
    try {
      if (mode === "login") await SPNStorage.login(payload.username, payload.password);
      else {
        const profile = await SPNStorage.register(payload.username, payload.password);
        SPNFolderBackup.autoSave(SPNStorage.makeBackup(profile)).catch(() => {});
      }
      form.reset();
      await bootstrap();
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    } finally { button.disabled = false; }
  });
}
$("logout").addEventListener("click", () => {
  SPNStorage.logout();
  closeDrawer();
  showAuth();
});
function currentBackup() {
  const profile = SPNStorage.getProfile(state.user.username);
  if (!profile) throw new Error("Entre novamente para fazer backup.");
  return SPNStorage.makeBackup(profile);
}
function reportFolderResult(result) {
  if (result === "saved") message("Backup salvo na pasta autorizada.");
  else if (result === "denied") message("Acesso à pasta cancelado. Você pode tentar novamente quando quiser.");
  else if (result === "unsupported") message("Seu navegador não permite escolher pasta. Use ‘Baixar arquivo’ em Conta.");
  else if (result === "needs-choice") message("A pasta precisa de nova autorização. Use ‘Escolher pasta’ em Conta.");
  else if (result === "error") message("Não foi possível escrever na pasta. Tente novamente ou baixe o arquivo.");
  if (state.view === "settings") renderSettings();
}
$("quick-backup").addEventListener("click", () => {
  try {
    // saveByClick invoca o seletor sem esperar outra promessa, enquanto o clique ainda está ativo.
    SPNFolderBackup.saveByClick(currentBackup()).then(reportFolderResult, () => reportFolderResult("error"));
  } catch (error) { message(error.message); }
});
$("save-backup").addEventListener("click", () => {
  try { SPNFolderBackup.saveByClick(currentBackup()).then(reportFolderResult, () => reportFolderResult("error")); }
  catch (error) { message(error.message); }
});
$("choose-backup-folder").addEventListener("click", () => {
  const selection = SPNFolderBackup.chooseFolder();
  selection.then(async (result) => {
    if (result === "selected") result = await SPNFolderBackup.autoSave(currentBackup());
    reportFolderResult(result);
  }, () => reportFolderResult("error"));
});
$("download-backup").addEventListener("click", () => {
  try {
    const backup = currentBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2) + "\n"], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = SPNFolderBackup.filename(backup);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    message("Arquivo enviado ao gerenciador de downloads do navegador.");
  } catch (error) { message(error.message); }
});
$("import-backup").addEventListener("click", () => $("backup-file").click());
$("backup-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error("Arquivo muito grande para ser um backup deste guia.");
    const backup = SPNStorage.validateBackup(JSON.parse(await file.text()), state.episodeKeys);
    state.pendingRestore = backup;
    $("restore-details").textContent = `Backup de ${backup.username}: ${Object.keys(backup.progress).length} marcações. Confirmar vai substituir as marcações de ${state.user.username} neste navegador.`;
    $("restore-preview").hidden = false;
  } catch (error) { state.pendingRestore = null; $("restore-preview").hidden = true; message(error.message); }
});
$("cancel-restore").addEventListener("click", () => { state.pendingRestore = null; $("restore-preview").hidden = true; });
$("confirm-restore").addEventListener("click", () => {
  if (!state.pendingRestore) return;
  try {
    const profile = SPNStorage.restore(state.user.username, state.pendingRestore.progress, state.episodeKeys);
    state.progress = {...profile.progress};
    state.pendingRestore = null;
    $("restore-preview").hidden = true;
    renderRoute();
    SPNFolderBackup.autoSave(SPNStorage.makeBackup(profile)).catch(() => {});
    message("Marcações restauradas neste navegador.");
  } catch (error) { message(error.message); }
});
$("menu-toggle").addEventListener("click", () => {
  if (desktopMedia.matches) {
    sidebarCollapsed = !sidebarCollapsed;
    try { localStorage.setItem("spn_sidebar_collapsed", sidebarCollapsed ? "1" : "0"); } catch (_) { /* Preserve the in-page state. */ }
    syncSidebar();
    return;
  }
  $("drawer").hidden = false;
  $("drawer-backdrop").hidden = false;
  document.body.classList.add("drawer-open");
  syncSidebar();
  $("drawer-close").focus();
});
desktopMedia.addEventListener("change", () => { closeDrawer(); syncSidebar(); });
$("drawer-close").addEventListener("click", () => { closeDrawer(); $("menu-toggle").focus(); });
$("drawer-backdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("drawer").hidden) { closeDrawer(); $("menu-toggle").focus(); } });
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");
  if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    const destination = new URL(link.href);
    navigate(destination.pathname + destination.hash);
    return;
  }
  const level = event.target.closest("button[data-level]");
  const filterStatus = event.target.closest("button[data-filter-status]");
  const clear = event.target.closest("button[data-clear]");
  const action = event.target.closest("button[data-episode-status]");
  if (level) { state.filters[level.dataset.mode].level = Number(level.dataset.level); renderRoute(); }
  if (filterStatus) { state.filters[filterStatus.dataset.mode].status = filterStatus.dataset.filterStatus; renderRoute(); }
  if (clear) { state.filters[clear.dataset.clear] = {level: 4, status: "all", query: ""}; renderRoute(); }
  if (action) saveStatus(action.dataset.key, action.dataset.episodeStatus);
});
let searchTimer;
document.addEventListener("input", (event) => {
  if (!event.target.matches("input[data-search]")) return;
  const mode = event.target.dataset.search;
  clearTimeout(searchTimer);
  state.filters[mode].query = event.target.value;
  searchTimer = setTimeout(() => {
    if (state.view === mode) renderListing(mode);
    const clear = $(`${mode}-filters`).querySelector(".clear-filters");
    if (clear) clear.hidden = state.filters[mode].level === 4 && state.filters[mode].status === "all" && !state.filters[mode].query;
  }, 140);
});
window.addEventListener("popstate", () => { closeDrawer(); renderRoute(); });
window.addEventListener("hashchange", () => { closeDrawer(); renderRoute(); });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.user && !state.busy.size) bootstrap();
});
window.addEventListener("storage", () => {
  if (state.user && !state.busy.size) bootstrap();
});
bootstrap();
