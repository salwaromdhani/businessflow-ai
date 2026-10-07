document.addEventListener("DOMContentLoaded", () => {
  const storage = window.BusinessFlowStorage;
  const note = document.querySelector("#import-analytics-note");
  const kpis = document.querySelector("#import-analytics-kpis");
  const chart = document.querySelector("#import-analytics-chart");
  if (!storage || !note || !kpis || !chart) return;

  const normalize = (value) => String(value).toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
  const number = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    const cleaned = String(value ?? "").replace(/[^\d,.-]/g, "").trim();
    const normalized = cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
    return Number(normalized);
  };
  const money = (value) => new Intl.NumberFormat(document.documentElement.lang, {
    style: "currency",
    currency: "TND",
    maximumFractionDigits: 0,
  }).format(value);

  function render() {
    const imports = storage.readData(storage.STORAGE_KEYS.imports, []);
    const rows = imports.flatMap((item) => Array.isArray(item.rows) ? item.rows : []);
    if (!rows.length) {
      note.textContent = BusinessFlow.t("Importez un fichier CSV, XLSX ou JSON contenant des données commerciales pour voir les indicateurs calculés localement.");
      kpis.innerHTML = "";
      chart.innerHTML = `<div class="empty-state">${BusinessFlow.t("Aucune donnée importée à analyser.")}</div>`;
      return;
    }

    const keys = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
    const findKey = (pattern) => keys.find((key) => pattern.test(normalize(key)));
    const amountKey = findKey(/revenue|sales|amount|total|chiffre|montant|vente|prix|ca$/);
    const clientKey = findKey(/client|customer|company|contact/);
    const orderKey = findKey(/order|commande|invoice|facture/);
    const productKey = findKey(/product|produit|item|article/);
    const dateKey = findKey(/date|day|jour|period|periode|month|mois/);
    const amounts = amountKey ? rows.map((row) => number(row[amountKey])) : [];
    const validAmounts = amounts.filter((value) => Number.isFinite(value) && value >= 0);
    const revenue = validAmounts.reduce((sum, value) => sum + value, 0);
    const unique = (key) => key ? new Set(rows.map((row) => String(row[key] ?? "").trim()).filter(Boolean)).size : null;
    const clients = unique(clientKey);
    const orders = unique(orderKey);

    note.textContent = `${BusinessFlow.t("Analyse locale")} · ${rows.length} ${BusinessFlow.t(rows.length === 1 ? "ligne" : "lignes")} · ${imports.length} ${BusinessFlow.t(imports.length === 1 ? "import" : "imports")} · ${BusinessFlow.t("Résultats indicatifs ; backend non connecté.")}`;
    const card = (label, value) => `<article class="card"><small class="muted">${escapeHtml(label)}</small><strong class="stat-number">${escapeHtml(value)}</strong></article>`;
    kpis.innerHTML = card(BusinessFlow.t("Lignes analysées"), String(rows.length))
      + (amountKey ? card(BusinessFlow.t("Chiffre d’affaires reconnu"), money(revenue)) : "")
      + (clients !== null ? card(BusinessFlow.t("Clients identifiés"), String(clients)) : "")
      + (orders !== null ? card(BusinessFlow.t("Commandes identifiées"), String(orders)) : "");

    const grouped = new Map();
    if (amountKey && dateKey) {
      rows.forEach((row, index) => {
        const amount = amounts[index];
        const rawDate = row[dateKey];
        const date = new Date(rawDate);
        if (Number.isFinite(amount) && amount >= 0 && !Number.isNaN(date.getTime())) {
          const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          grouped.set(month, (grouped.get(month) || 0) + amount);
        }
      });
    }
    const series = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12);
    if (series.length) {
      const max = Math.max(...series.map(([, value]) => value), 1);
      chart.innerHTML = `<div class="chart-bars" role="img" aria-label="${BusinessFlow.t("Chiffre d’affaires par mois")}">${series.map(([month, value]) => `<div class="chart-bar" title="${escapeHtml(month)} · ${escapeHtml(money(value))}" style="height:${Math.max(8, value / max * 100)}%"><span>${escapeHtml(month.slice(5))}</span></div>`).join("")}</div>`;
    } else if (validAmounts.length) {
      const values = validAmounts.slice(-12);
      const max = Math.max(...values, 1);
      chart.innerHTML = `<div class="chart-bars" role="img" aria-label="${BusinessFlow.t("Valeurs reconnues")}">${values.map((value, index) => `<div class="chart-bar" title="${escapeHtml(money(value))}" style="height:${Math.max(8, value / max * 100)}%"><span>${index + 1}</span></div>`).join("")}</div><p class="muted">${BusinessFlow.t("Aucune colonne de date reconnue ; affichage des dernières valeurs importées.")}</p>`;
    } else {
      chart.innerHTML = `<div class="empty-state">${BusinessFlow.t("Aucune colonne de chiffre d’affaires ou de montant reconnue dans les imports.")}</div>`;
    }

    const productTotals = new Map();
    if (amountKey && productKey) {
      rows.forEach((row, index) => {
        const product = String(row[productKey] ?? "").trim();
        const amount = amounts[index];
        if (product && Number.isFinite(amount) && amount >= 0) productTotals.set(product, (productTotals.get(product) || 0) + amount);
      });
    }
    const products = [...productTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const insight = document.querySelector("#analytics-local-insights");
    if (insight) {
      insight.innerHTML = products.length
        ? `<h2>${BusinessFlow.t("Produits les plus performants")} <span class="pill">${BusinessFlow.t("Calcul local")}</span></h2><ol>${products.map(([name, value]) => `<li>${escapeHtml(name)} — ${escapeHtml(money(value))}</li>`).join("")}</ol>`
        : `<h2>${BusinessFlow.t("Insights de données")} <span class="pill">${BusinessFlow.t("Calcul local")}</span></h2><p class="muted">${BusinessFlow.t("Importez des colonnes produit et montant pour classer les produits. Aucun conseil IA n’est généré sans backend.")}</p>`;
    }
  }

  window.addEventListener("businessflow:data-updated", render);
  window.addEventListener("storage", (event) => {
    if (event.key === storage.STORAGE_KEYS.imports) render();
  });
  render();
});
