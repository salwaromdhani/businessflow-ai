document.addEventListener("DOMContentLoaded", () => {
  const messages = document.querySelector("#chat-messages");
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#chat-input");
  const suggestions = document.querySelector(".suggestions");
  const currentUser = window.BusinessFlowAuth?.currentUser();
  const userInitials = currentUser?.name
    ?.split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase() || "BF";

  function addMessage(text, author) {
    const item = document.createElement("div");
    item.className = `chat-message ${author}`;
    const avatar = document.createElement("span");
    avatar.className = "chat-avatar";
    avatar.textContent = author === "assistant" ? "✧" : userInitials;
    const content = document.createElement("p");
    content.textContent = text;
    item.append(avatar, content);
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  async function getContext() {
    const storage = window.BusinessFlowStorage;
    const documents = window.BusinessFlowDocuments ? await window.BusinessFlowDocuments.list() : [];
    return {
      datasets: storage?.readData(storage.STORAGE_KEYS.imports, []).map(({ name, rows }) => ({ name, rows })),
      tasks: storage?.readData(storage.STORAGE_KEYS.tasks, storage.demoTasks),
      companies: storage?.readData(storage.STORAGE_KEYS.companies, storage.demoCompanies),
      documents: documents.map(({ name, type, extractedText }) => ({ name, type, extractedText: (extractedText || "").slice(0, 12000) })),
      source: "local-demo-data",
    };
  }

  function localAnswer(question, context) {
    const normalized = question.toLocaleLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "");
    const rows = context.datasets.flatMap((dataset) => dataset.rows || []);
    const t = (key) => BusinessFlow.t(key);
    if (/(task|tache|مهام|أولوي|اولوي)/i.test(normalized)) {
      const openTasks = context.tasks.filter((task) => task.status !== "done");
      return rows.length
        ? t("local.tasks").replace("{rows}", rows.length).replace("{count}", openTasks.length)
        : t("local.tasks.demo").replace("{count}", openTasks.length);
    }
    if (/(client|customer|عميل|عملاء)/i.test(normalized)) {
      const clientKey = Object.keys(rows[0] || {}).find((key) => /client|customer|company|contact/i.test(key));
      const amountKey = Object.keys(rows[0] || {}).find((key) => /revenue|sales|amount|total|chiffre|montant|vente|prix|ca$/i.test(key));
      const amount = (value) => Number(String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
      if (!clientKey) return t("local.noCustomers");
      const totals = new Map();
      rows.forEach((row) => {
        const customer = String(row[clientKey] || "").trim();
        if (customer) totals.set(customer, (totals.get(customer) || 0) + (amountKey ? amount(row[amountKey]) : 0));
      });
      const best = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!best) return t("local.noCustomers");
      return amountKey
        ? t("local.topCustomer").replace("{name}", best[0]).replace("{amount}", new Intl.NumberFormat(document.documentElement.lang, { style: "currency", currency: "TND", maximumFractionDigits: 0 }).format(best[1]))
        : t("local.customerCount").replace("{count}", totals.size);
    }
    if (/(product|produit|منتج|المنتجات)/i.test(normalized)) {
      const products = new Map();
      rows.forEach((row) => Object.entries(row).forEach(([key, value]) => {
        if (/product|produit|item|article/i.test(key) && value) products.set(value, (products.get(value) || 0) + 1);
      }));
      const top = [...products.entries()].sort((a, b) => b[1] - a[1])[0];
      return top ? t("local.topProduct").replace("{name}", top[0]).replace("{count}", top[1]) : t("local.noProducts");
    }
    if (/(revenue|sales|income|chiffre|revenu|vente|performance|evolu|trend|ايراد|مبيعات|اداء|تطور)/i.test(normalized)) {
      const values = rows.flatMap((row) => Object.entries(row).filter(([key]) => /revenue|sales|amount|total|chiffre|montant|vente/i.test(key)).map(([, value]) => Number(String(value).replace(/[^\d,.-]/g, "").replace(",", ".")))).filter(Number.isFinite);
      if (values.length) {
        const total = values.reduce((sum, value) => sum + value, 0);
        return t("local.revenue").replace("{amount}", new Intl.NumberFormat(document.documentElement.lang, { style: "currency", currency: "TND", maximumFractionDigits: 0 }).format(total)).replace("{count}", values.length);
      }
      return t("local.noRevenue");
    }
    if (/(document|resume|résum|summari|extract|ملف|مستند|لخص)/i.test(normalized)) {
      const document = context.documents.find((item) => item.extractedText);
      if (!document) return t("local.noDocumentText");
      const excerpt = document.extractedText.replace(/\s+/g, " ").trim().slice(0, 600);
      return `${t("local.documentExcerpt").replace("{name}", document.name)} ${excerpt}${document.extractedText.length > 600 ? "…" : ""} ${t("local.noAi")}`;
    }
    if (/(declin|baisse|anomal|risk|risque|تراجع|شذوذ|مخاطر)/i.test(normalized)) return rows.length
      ? t("local.risk").replace("{count}", rows.length)
      : t("local.noRiskData");
    return rows.length
      ? t("local.generic").replace("{rows}", rows.length).replace("{tasks}", context.tasks.length)
      : t("local.empty");
  }

  async function submit(question) {
    if (!question.trim()) return;
    addMessage(question, "user");
    input.value = "";
    input.disabled = true;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const typing = document.createElement("div");
    typing.className = "chat-message assistant";
    typing.innerHTML = '<span class="chat-avatar">✧</span><p><span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span></p>';
    messages.appendChild(typing);
    try {
      let reply;
      if (BusinessFlowApi.enabled) {
        const response = await BusinessFlowApi.chat(question, await getContext());
        if (typeof response.reply !== "string" || !response.reply.trim()) throw new Error("La réponse de l’API est vide ou invalide.");
        reply = response.reply;
      } else reply = localAnswer(question, await getContext());
      typing.remove();
      addMessage(reply, "assistant");
    } catch (error) {
      typing.remove();
      addMessage(`${BusinessFlow.t("local.serviceError")} ${error.message}`, "assistant");
    } finally {
      input.disabled = false;
      submitButton.disabled = false;
      input.focus();
    }
  }

  addMessage(BusinessFlow.t("local.welcome"), "assistant");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit(input.value);
  });
  suggestions?.querySelectorAll("[data-prompt]").forEach((button) =>
    button.addEventListener("click", () => submit(button.dataset.prompt)),
  );
});
