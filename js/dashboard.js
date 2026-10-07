document.addEventListener("DOMContentLoaded", async () => {
  const storage = window.BusinessFlowStorage;
  if (!storage) return;
  const user = window.BusinessFlowAuth?.currentUser();
  const date = document.querySelector(".app-header .eyebrow");
  if (date) {
    const formatted = new Intl.DateTimeFormat(document.documentElement.lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
    date.textContent = `${formatted} · TND`;
  }
  const greeting = document.querySelector(".app-header h1");
  if (greeting && user) greeting.textContent = `${BusinessFlow.t("Bonjour")}, ${user.firstName} 👋`;

  const tasks = storage.readData(storage.STORAGE_KEYS.tasks, storage.demoTasks);
  const companies = storage.readData(storage.STORAGE_KEYS.companies, storage.demoCompanies);
  const imports = storage.readData(storage.STORAGE_KEYS.imports, []);
  const rows = imports.flatMap((item) => item.rows || []);
  const allKeys = Object.keys(rows[0] || {});
  const key = (tokens) => allKeys.find((name) => tokens.some((term) => name.toLocaleLowerCase().includes(term)));
  const revenueKey = key(["revenue", "sales", "amount", "total", "ca", "chiffre", "montant", "vente"]);
  const expensesKey = key(["expense", "cost", "depense", "dépense", "cout", "coût"]);
  const customerKey = key(["client", "customer", "company", "contact"]);
  const orderKey = key(["order", "commande", "invoice", "facture"]);
  const projectKey = key(["project", "projet"]);
  const dateKey = key(["date", "period", "month", "mois"]);
  const number = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value ?? "").replace(/[^\d,.-]/g, "").trim();
    const normalized = cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
    return Number(normalized) || 0;
  };
  const money = (amount) => new Intl.NumberFormat(document.documentElement.lang, { style: "currency", currency: "TND", maximumFractionDigits: 0 }).format(amount);
  const kpi = (name, value, detail) => {
    const card = document.querySelector(`[data-kpi="${name}"]`)?.closest(".stat-card");
    if (!card) return;
    card.querySelector(".stat-number").textContent = value;
    if (detail) card.querySelector(".stat-trend").textContent = detail;
  };

  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdue = openTasks.filter((task) => task.dueDate && new Date(`${task.dueDate}T23:59:59`) < new Date());
  kpi("tasks", openTasks.length, BusinessFlow.t("Tâches encore ouvertes"));
  kpi("customers", customerKey ? new Set(rows.map((row) => row[customerKey]).filter(Boolean)).size : companies.length, customerKey ? BusinessFlow.t("Clients dans les imports") : BusinessFlow.t("Entreprises du CRM local"));
  kpi("orders", orderKey ? new Set(rows.map((row) => row[orderKey]).filter(Boolean)).size : "—", orderKey ? BusinessFlow.t("Commandes importées") : BusinessFlow.t("Colonne de commandes requise"));
  kpi("projects", projectKey ? new Set(rows.map((row) => row[projectKey]).filter(Boolean)).size : new Set(tasks.map((task) => task.project).filter(Boolean)).size, projectKey ? BusinessFlow.t("Projets importés") : BusinessFlow.t("Projets liés aux tâches"));

  if (revenueKey && rows.length) {
    const revenue = rows.reduce((sum, row) => sum + number(row[revenueKey]), 0);
    kpi("revenue", money(revenue), `${rows.length} ${BusinessFlow.t("Lignes importées · TND")}`);
  }
  if (expensesKey && rows.length) {
    const expenses = rows.reduce((sum, row) => sum + number(row[expensesKey]), 0);
    kpi("expenses", money(expenses), BusinessFlow.t("Calculé depuis les imports · TND"));
  }

  let growth = null;
  if (dateKey && revenueKey) {
    const periods = new Map();
    rows.forEach((row) => {
      const parsed = new Date(row[dateKey]);
      if (Number.isNaN(parsed.getTime())) return;
      const period = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      periods.set(period, (periods.get(period) || 0) + number(row[revenueKey]));
    });
    const series = [...periods.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (series.length >= 2 && series.at(-2)[1] !== 0) growth = ((series.at(-1)[1] - series.at(-2)[1]) / Math.abs(series.at(-2)[1])) * 100;
    if (series.length) {
      const chart = document.querySelector("#dashboard-revenue-chart");
      const maxAmount = Math.max(...series.map(([, value]) => value), 1);
      if (chart) chart.innerHTML = series.slice(-12).map(([period, amount]) => `<div class="chart-bar" title="${period} · ${escapeHtml(money(amount))}" style="height:${Math.max(8, amount / maxAmount * 100)}%"><span>${period.slice(5)}</span></div>`).join("");
      const chartNote = document.querySelector("#dashboard-chart-note");
      if (chartNote) chartNote.textContent = `${BusinessFlow.t("Chiffre d’affaires par mois")} · TND`;
    }
  }
  kpi("growth", growth === null ? "—" : `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`, growth === null ? BusinessFlow.t("Deux périodes datées requises") : BusinessFlow.t("Variation entre les deux dernières périodes"));
  const overdueRatio = openTasks.length ? overdue.length / openTasks.length : 0;
  const dataCoverage = [revenueKey, expensesKey, customerKey, orderKey, dateKey].filter(Boolean).length;
  const health = rows.length ? Math.max(0, Math.round(dataCoverage * 20 - overdueRatio * 20)) : null;
  kpi("health", health === null ? "—" : `${health}/100`, health === null ? BusinessFlow.t("Importez des données pour une estimation") : BusinessFlow.t("Estimation locale · couverture des KPI et retards"));
  const insights = document.querySelector("#dashboard-local-insights");
  if (insights) {
    const facts = [];
    if (revenueKey && rows.length) facts.push(`${BusinessFlow.t("Chiffre d’affaires reconnu")} : ${money(rows.reduce((sum, row) => sum + number(row[revenueKey]), 0))}.`);
    facts.push(`${openTasks.length} ${BusinessFlow.t("Tâches encore ouvertes")}.`);
    if (overdue.length) facts.push(`${overdue.length} ${BusinessFlow.t("Tâches en retard")}.`);
    insights.textContent = facts.join(" ");
  }

  const activityContainer = document.querySelector("#recent-activity");
  const activityItems = storage.getActivity().slice(0, 5);
  activityContainer.innerHTML = activityItems.length
    ? activityItems.map((item) => `<div class="activity"><span class="activity-dot"></span><div class="activity-copy"><strong>${escapeHtml(item.detail)}</strong><small>${escapeHtml(item.actor)} · ${new Date(item.createdAt).toLocaleString(document.documentElement.lang)}</small></div></div>`).join("")
    : `<div class="empty-state">${BusinessFlow.t("Les activités réelles apparaîtront ici.")}</div>`;

  const alerts = document.querySelector("#dashboard-alerts");
  if (alerts) {
    alerts.innerHTML = (overdue.length
      ? overdue.map((task) => `<div class="activity"><span class="activity-dot" style="background:var(--danger)"></span><div class="activity-copy"><strong>${escapeHtml(task.title)}</strong><small>${BusinessFlow.t("En retard depuis")} ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(document.documentElement.lang)}</small></div></div>`).join("")
      : `<div class="empty-state">${BusinessFlow.t("Aucune tâche en retard.")}</div>`)
      + (!rows.length ? `<div class="notice">${BusinessFlow.t("Importez des données ERP/CRM pour calculer les indicateurs métier.")}</div>` : "");
  }
  const projects = document.querySelector("#dashboard-projects");
  if (projects) {
    const byProject = new Map();
    tasks.forEach((task) => {
      const name = task.project || BusinessFlow.t("Sans projet");
      byProject.set(name, (byProject.get(name) || 0) + 1);
    });
    projects.innerHTML = [...byProject.entries()].slice(0, 4).map(([name, count]) =>
      `<div class="activity"><span class="activity-dot"></span><div class="activity-copy"><strong>${escapeHtml(name)}</strong><small>${count} ${BusinessFlow.t("Tâches liées")}</small></div></div>`,
    ).join("") || `<div class="empty-state">${BusinessFlow.t("Aucun projet suivi.")}</div>`;
  }

  const recentDocuments = document.querySelector("#recent-documents");
  if (recentDocuments && window.BusinessFlowDocuments) {
    try {
      const documents = (await BusinessFlowDocuments.list()).slice(0, 5);
      recentDocuments.innerHTML = documents.length
        ? documents.map((document) => `<div class="activity"><span class="activity-dot"></span><div class="activity-copy"><strong>${escapeHtml(document.name)}</strong><small>${escapeHtml(document.type)} · ${escapeHtml(document.size)} · ${new Date(document.createdAt).toLocaleDateString(window.document.documentElement.lang)}</small></div><span class="status done">${BusinessFlow.t("Disponible localement")}</span></div>`).join("")
        : `<div class="empty-state">${BusinessFlow.t("Aucun document importé.")}</div>`;
    } catch (error) {
      recentDocuments.textContent = `${BusinessFlow.t("Impossible de charger les documents.")} ${error.message}`;
    }
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
    );
  }
});
