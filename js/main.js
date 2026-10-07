const pageLinks = [
  { key: "Dashboard", href: "dashboard.html", icon: "◈" },
  { key: "Entreprises", href: "companies.html", icon: "▦" },
  { key: "Taches", href: "tasks.html", icon: "✓" },
  { key: "Analytics", href: "analytics.html", icon: "⌁" },
  { key: "Assistant AI", href: "ai-assistant.html", icon: "✧" },
  { key: "Documents & ERP/CRM", href: "data.html", icon: "▤" },
  { key: "Membres", href: "members.html", icon: "♙" },
  { key: "Parametres", href: "settings.html", icon: "⚙" },
];

function getBasePath() {
  return window.location.pathname.includes("/pages/") ? "" : "pages/";
}

function getLanguage() {
  return localStorage.getItem("businessflow.language") || "fr";
}

function translate(key) {
  const language = getLanguage();
  const dictionary = window.BF_I18N?.[language] || window.BF_I18N?.fr || {};
  return dictionary[key] || key;
}

function applyLanguage(language) {
  const selected = ["fr", "en", "ar"].includes(language) ? language : "fr";
  localStorage.setItem("businessflow.language", selected);
  document.documentElement.lang = selected;
  document.documentElement.dir = selected === "ar" ? "rtl" : "ltr";
  document.title = translate(document.title);
  document.querySelectorAll("[data-language-selector]").forEach((select) => {
    select.value = selected;
  });
  translatePage(document.body);
  document.querySelectorAll("#sidebar").forEach(renderSidebar);
}

const originalText = new WeakMap();
const originalAttributes = new WeakMap();
function translatePage(root) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
  const dictionary = window.BF_I18N?.[getLanguage()] || {};
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const source = originalText.get(node);
    const normalized = source.trim().replace(/\s+/g, " ");
    if (!normalized || !dictionary[normalized]) return;
    const start = source.match(/^\s*/)?.[0] || "";
    const end = source.match(/\s*$/)?.[0] || "";
    node.nodeValue = `${start}${dictionary[normalized]}${end}`;
  });
  root.querySelectorAll?.("[placeholder], [aria-label], [title]").forEach((element) => {
    if (!originalAttributes.has(element)) originalAttributes.set(element, {});
    const sourceAttributes = originalAttributes.get(element);
    ["placeholder", "aria-label", "title"].forEach((attribute) => {
      if (sourceAttributes[attribute] === undefined) sourceAttributes[attribute] = element.getAttribute(attribute);
      const source = sourceAttributes[attribute];
      if (source && dictionary[source]) element.setAttribute(attribute, dictionary[source]);
    });
  });
}

function renderSidebar(sidebar) {
  if (!sidebar) return;
  const base = getBasePath();
  const current = window.location.pathname.split("/").pop() || "index.html";
  sidebar.innerHTML = `<a class="brand" href="${base}../index.html"><span class="brand-mark">↗</span>BusinessFlow <span class="brand-ai">AI</span></a><nav class="sidebar-nav" aria-label="${translate("Navigation applicative")}">${pageLinks.map((link) => `<a href="${base}${link.href}" class="${current === link.href ? "active" : ""}"><span>${link.icon}</span>${translate(link.key)}</a>`).join("")}</nav><div class="sidebar-foot"><strong>${translate("Plan Demo")}</strong><br><span>${translate("Votre espace est pret a grandir avec vous.")}</span></div>`;
}

function buildPreferences() {
  let controls = document.querySelector(".global-controls");
  if (!controls) {
    controls = document.createElement("div");
    controls.className = "global-controls";
    controls.innerHTML = `<button class="btn btn-secondary theme-toggle" type="button"></button><label class="language-control"><span class="visually-hidden">Langue</span><select data-language-selector aria-label="Langue"><option value="fr">🇫🇷 Français</option><option value="en">🇬🇧 English</option><option value="ar">🇹🇳 العربية</option></select></label>`;
  }
  controls.querySelector(".theme-toggle")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
  });
  controls.querySelector("[data-language-selector]")?.addEventListener("change", (event) => {
    localStorage.setItem("businessflow.language", event.target.value);
    window.location.reload();
  });
  return controls;
}

function updateThemeLabel(button) {
  const dark = document.documentElement.dataset.theme === "dark";
  button.textContent = dark ? `☀ ${translate("Light")}` : `☾ ${translate("Dark")}`;
  button.setAttribute("aria-label", dark ? translate("Passer au thème clair") : translate("Passer au thème sombre"));
}

function setTheme(theme) {
  const selected = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selected;
  localStorage.setItem("businessflow.theme", selected);
  document.querySelectorAll(".theme-toggle").forEach(updateThemeLabel);
}

function setupPreferences() {
  const controls = buildPreferences();
  const navActions = document.querySelector(".nav-actions");
  const userActions = document.querySelector(".header-user");
  const authPage = document.querySelector(".auth-page");
  if (navActions && !controls.isConnected) navActions.append(controls);
  else if (!controls.isConnected && userActions) userActions.append(controls);
  else if (!controls.isConnected && authPage) authPage.append(controls);
  else if (!controls.isConnected) document.body.append(controls);

  const theme = localStorage.getItem("businessflow.theme") || "light";
  setTheme(theme);
  const language = getLanguage();
  document.querySelectorAll("[data-language-selector]").forEach((select) => {
    select.value = language;
  });
  applyLanguage(language);
}

function setupMenus() {
  const navbar = document.querySelector("#main-navbar");
  document.querySelector(".menu-toggle")?.addEventListener("click", () => {
    navbar?.classList.toggle("nav-open");
  });
  const sidebar = document.querySelector("#sidebar");
  document.querySelector(".mobile-sidebar-toggle")?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
  });
}

function setupApplicationUser() {
  if (!document.querySelector(".app-shell")) return;
  const user = window.BusinessFlowAuth?.currentUser();
  document.querySelector(".notification")?.addEventListener("click", () => {
    const alerts = document.querySelector("#dashboard-alerts");
    if (alerts) alerts.scrollIntoView({ behavior: "smooth", block: "center" });
    else window.location.href = `${getBasePath()}dashboard.html#dashboard-alerts`;
  });
  const displayName = user?.name || translate("Visiteur de démonstration");
  const role = user?.role || "Invité";
  const initials = displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toLocaleUpperCase();
  document.querySelectorAll(".user-copy").forEach((element) => {
    if (element.tagName === "STRONG") element.textContent = displayName;
  });
  document.querySelectorAll(".avatar").forEach((element) => { element.textContent = initials; });
  document.querySelectorAll(".user-role").forEach((element) => { element.textContent = translate(role); });
  document.querySelectorAll(".app-header .header-user").forEach((userBar) => {
    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "btn btn-secondary logout-button";
    logout.textContent = user ? translate("Déconnexion") : translate("Connexion");
    logout.addEventListener("click", () => {
      if (user) window.BusinessFlowAuth.logout();
      else window.location.href = "login.html";
    });
    userBar.append(logout);
  });
  document.querySelectorAll("[data-permission]").forEach((element) => {
    const allowed = window.BusinessFlowAuth?.can(element.dataset.permission) || false;
    element.hidden = !allowed;
  });
}

function showMessage(element, message, type = "success") {
  if (!element) return;
  element.className = `notice ${type}`;
  element.textContent = message;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#sidebar").forEach(renderSidebar);
  setupMenus();
  setupPreferences();
  setupApplicationUser();
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) translatePage(node);
        else if (node.nodeType === Node.TEXT_NODE && node.parentElement) translatePage(node.parentElement);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

window.BusinessFlow = { showMessage, t: translate, setLanguage: applyLanguage, setTheme };
