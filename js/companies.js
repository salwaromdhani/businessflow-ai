document.addEventListener("DOMContentLoaded", () => {
  const { STORAGE_KEYS, demoCompanies, readData, writeData } =
    BusinessFlowStorage;
  const list = document.querySelector("#company-list");
  const message = document.querySelector("#company-message");
  let companies = readData(STORAGE_KEYS.companies, demoCompanies);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
  function render() {
    const query = document.querySelector("#company-search").value.toLowerCase();
    const visible = companies.filter(
      (company) =>
        `${company.name} ${company.sector} ${company.city || ""}`.toLowerCase().includes(query),
    );
    list.innerHTML =
      visible
        .map(
          (company) =>
            `<tr><td><strong>${escapeHtml(company.name)}</strong></td><td>${escapeHtml(BusinessFlow.t(company.sector))} · ${escapeHtml(BusinessFlow.t(company.city || "Tunisie"))}</td><td>${company.members}</td><td><span class="status ${company.status === "Actif" ? "done" : "todo"}">${escapeHtml(BusinessFlow.t(company.status))}</span></td><td><button class="icon-btn delete-company" data-id="${company.id}" aria-label="${BusinessFlow.t("Supprimer")} ${escapeHtml(company.name)}" ${BusinessFlowAuth?.can("manageMembers") ? "" : "disabled"}>×</button></td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="5" class="empty-state">Aucune entreprise trouvee.</td></tr>';
    list.querySelectorAll(".delete-company").forEach((button) =>
      button.addEventListener("click", () => {
        if (!BusinessFlowAuth?.can("manageMembers")) return;
        if (!window.confirm(BusinessFlow.t("Confirmer la suppression de cette entreprise ?"))) return;
        companies = companies.filter(
          (company) => company.id !== Number(button.dataset.id),
        );
        writeData(STORAGE_KEYS.companies, companies);
        BusinessFlowStorage.logActivity("company.deleted", `${BusinessFlow.t("Entreprise supprimée")} · ${button.dataset.id}`);
        render();
      }),
    );
  }
  document.querySelector("#company-search").addEventListener("input", render);
  document.querySelector("#new-company").addEventListener("click", () => {
    if (!BusinessFlowAuth?.can("manageMembers")) return BusinessFlow.showMessage(message, BusinessFlow.t("Votre rôle ne permet pas de gérer les entreprises."), "error");
    const name = prompt(BusinessFlow.t("Nom de l’entreprise :"));
    if (!name?.trim()) return;
    companies.push({
      id: Date.now(),
      name: name.trim(),
      sector: "Commerce",
      city: "Tunis",
      members: 1,
      status: "Invite",
    });
    writeData(STORAGE_KEYS.companies, companies);
    BusinessFlowStorage.logActivity("company.created", `${BusinessFlow.t("Entreprise ajoutée")} · ${name.trim()}`);
    render();
  });
  render();
});
