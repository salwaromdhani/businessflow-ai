document.addEventListener("DOMContentLoaded", () => {
  const { STORAGE_KEYS, readData, writeData } = BusinessFlowStorage;
  const storageKey = STORAGE_KEYS.imports;
  const fileInput = document.querySelector("#dataset-file");
  const form = document.querySelector("#import-form");
  const list = document.querySelector("#import-list");
  const results = document.querySelector("#analytics-results");
  const message = document.querySelector("#import-message");
  let imports = readData(storageKey, []);

  function notify(text, type = "success") {
    BusinessFlow.showMessage(message, text, type);
  }

  function formatSize(bytes) {
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
    );
  }

  function metricCard(label, value, detail = "") {
    return `<article class="card"><small class="muted">${escapeHtml(label)}</small><strong class="stat-number">${escapeHtml(value)}</strong>${detail ? `<small class="muted">${escapeHtml(detail)}</small>` : ""}</article>`;
  }

  function renderAnalysis() {
    const rows = imports.flatMap((item) => item.rows || []);
    if (!rows.length) {
      results.innerHTML = `<div class="empty-state">${BusinessFlow.t("En attente d’analyse")}</div>`;
      return;
    }
    const keys = Object.keys(rows[0] || {});
    const find = (tokens) => keys.find((key) => tokens.some((token) => key.toLocaleLowerCase().includes(token)));
    const revenueKey = find(["revenue", "sales", "amount", "total", "ca", "chiffre", "montant", "vente"]);
    const expenseKey = find(["expense", "cost", "depense", "dépense", "cout", "coût"]);
    const customerKey = find(["client", "customer", "company", "contact"]);
    const orderKey = find(["order", "commande", "invoice", "facture"]);
    const productKey = find(["product", "produit", "item", "article"]);
    const projectKey = find(["project", "projet"]);
    const taskKey = find(["task", "tache", "tâche"]);
    const dateKey = find(["date", "period", "mois", "month"]);
    const conversionKey = find(["conversion", "converted", "won", "gagn"]);
    const number = (value) => Number(String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
    const uniqueCount = (key) => new Set(rows.map((row) => row[key]).filter(Boolean)).size;
    const revenue = revenueKey ? rows.reduce((sum, row) => sum + number(row[revenueKey]), 0) : 0;
    const expenses = expenseKey ? rows.reduce((sum, row) => sum + number(row[expenseKey]), 0) : 0;
    const salesValues = revenueKey ? rows.map((row) => number(row[revenueKey])).filter((value) => value > 0).slice(-12) : [];
    const product = productKey ? Object.entries(rows.reduce((totals, row) => {
      const key = row[productKey];
      if (key) totals[key] = (totals[key] || 0) + (number(row[revenueKey]) || 1);
      return totals;
    }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] : "";
    const dates = dateKey ? new Set(rows.map((row) => row[dateKey]).filter(Boolean)).size : 0;
    const cards = [
      metricCard(BusinessFlow.t("Lignes"), rows.length),
      ...(revenueKey ? [metricCard(BusinessFlow.t("Revenus"), new Intl.NumberFormat(document.documentElement.lang, { style: "currency", currency: "TND", maximumFractionDigits: 0 }).format(revenue))] : []),
      ...(expenseKey ? [metricCard(BusinessFlow.t("Dépenses"), new Intl.NumberFormat(document.documentElement.lang, { style: "currency", currency: "TND", maximumFractionDigits: 0 }).format(expenses))] : []),
      metricCard(BusinessFlow.t("Ventes"), revenueKey ? rows.filter((row) => number(row[revenueKey]) > 0).length : BusinessFlow.t("Colonne non reconnue")),
      metricCard(BusinessFlow.t("Clients"), customerKey ? uniqueCount(customerKey) : BusinessFlow.t("Colonne non reconnue")),
      metricCard(BusinessFlow.t("Commandes"), orderKey ? uniqueCount(orderKey) : BusinessFlow.t("Colonne non reconnue")),
      metricCard(BusinessFlow.t("Croissance"), dates >= 2 ? BusinessFlow.t("Données historiques à comparer") : BusinessFlow.t("Périodes requises")),
      metricCard(BusinessFlow.t("Conversion"), conversionKey ? rows.filter((row) => /true|yes|won|converted|gagn|1/i.test(String(row[conversionKey]))).length : BusinessFlow.t("Colonne non reconnue")),
      metricCard(BusinessFlow.t("Produits"), product || (productKey ? uniqueCount(productKey) : BusinessFlow.t("Colonne non reconnue"))),
      metricCard(BusinessFlow.t("Projets"), projectKey ? uniqueCount(projectKey) : BusinessFlow.t("Colonne non reconnue")),
      metricCard(BusinessFlow.t("Tâches"), taskKey ? uniqueCount(taskKey) : BusinessFlow.t("Colonne non reconnue")),
      metricCard(BusinessFlow.t("Tendances et anomalies"), BusinessFlow.t("Backend requis"), BusinessFlow.t("Détection avancée non disponible en mode local.")),
    ];
    if (salesValues.length) {
      cards.push(`<article class="card" style="grid-column:1/-1"><strong>${BusinessFlow.t("Tendances et anomalies")}</strong><div class="chart-bars">${salesValues.map((value, index) => `<div class="chart-bar" style="height:${Math.max(8, value / Math.max(...salesValues) * 100)}%"><span>${index + 1}</span></div>`).join("")}</div><small class="muted">${BusinessFlow.t("Montants des lignes importées, en TND.")}</small></article>`);
    }
    results.innerHTML = cards.join("");
    window.dispatchEvent(new CustomEvent("businessflow:data-updated", { detail: { rows } }));
  }

  function render() {
    document.querySelector("#dataset-count").textContent = imports.length;
    list.innerHTML = imports.length
      ? imports.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.size)}</td><td>${item.rows.length}</td><td>${BusinessFlow.t("Données locales")}</td><td>${escapeHtml(item.uploadedBy || BusinessFlow.t("Visiteur de démonstration"))}</td><td>${new Date(item.importedAt).toLocaleString(document.documentElement.lang)}</td><td><span class="status done">${BusinessFlow.t("Importé localement")}</span></td><td><button class="icon-btn remove-import" type="button" data-id="${escapeHtml(item.id)}" aria-label="${BusinessFlow.t("Supprimer")} ${escapeHtml(item.name)}" ${BusinessFlowAuth?.can("manageData") ? "" : "disabled"}>×</button></td></tr>`).join("")
      : `<tr><td colspan="8" class="empty-state">${BusinessFlow.t("Aucun fichier importé.")}</td></tr>`;
    list.querySelectorAll(".remove-import").forEach((button) => button.addEventListener("click", () => {
      if (!BusinessFlowAuth?.can("manageData")) return;
      if (!window.confirm(BusinessFlow.t("Confirmer la suppression de cet import ?"))) return;
      const record = imports.find((item) => item.id === button.dataset.id);
      const next = imports.filter((item) => item.id !== button.dataset.id);
      writeData(storageKey, next);
      imports = next;
      BusinessFlowStorage.logActivity("dataset.deleted", record?.name || "ERP/CRM data");
      render();
      window.dispatchEvent(new CustomEvent("businessflow:data-updated"));
    }));
    renderAnalysis();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!BusinessFlowAuth?.can("manageData")) {
      notify(BusinessFlow.t("Connectez-vous avec un rôle Manager ou Admin pour importer des données."), "error");
      return;
    }
    const file = fileInput.files[0];
    if (!file) return notify(BusinessFlow.t("Sélectionner un fichier"), "error");
    if (file.size > 8 * 1024 * 1024) return notify(BusinessFlow.t("Les imports analytiques sont limités à 8 Mo dans le stockage navigateur."), "error");
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const rows = await BusinessFlowDataParser.parseStructuredFile(file);
      if (!rows.length) throw new Error(BusinessFlow.t("Le fichier ne contient aucune ligne de données."));
      const entry = {
        id: `${Date.now()}-${crypto.randomUUID()}`,
        name: file.name,
        size: formatSize(file.size),
        source: "local",
        uploadedBy: BusinessFlowAuth.currentUser().name,
        importedAt: new Date().toISOString(),
        rows,
      };
      const next = [entry, ...imports];
      writeData(storageKey, next);
      imports = next;
      BusinessFlowStorage.logActivity("dataset.imported", `${file.name} · ${rows.length} ${BusinessFlow.t("Lignes").toLowerCase()}`, entry.uploadedBy);
      BusinessFlow.showMessage(message, `${file.name} · ${rows.length} ${BusinessFlow.t("Lignes").toLowerCase()} · ${BusinessFlow.t("Données locales")}`, "success");
      form.reset();
      render();
      window.dispatchEvent(new CustomEvent("businessflow:data-updated"));
    } catch (error) {
      notify(error.message || BusinessFlow.t("Échec de l’import."), "error");
    } finally {
      button.disabled = false;
    }
  });

  render();
});
