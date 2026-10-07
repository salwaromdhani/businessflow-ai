document.addEventListener("DOMContentLoaded", () => {
  const list = document.querySelector("#member-list");
  const search = document.querySelector("#member-search");
  const roleFilter = document.querySelector("#member-role-filter");
  const dialog = document.querySelector("#invite-dialog");
  const form = document.querySelector("#invite-form");
  const message = document.querySelector("#invite-message");
  const current = BusinessFlowAuth.currentUser();

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
    );
  }

  function renderActivity() {
    const activity = BusinessFlowStorage.getActivity().slice(0, 12);
    const container = document.querySelector("#member-activity");
    container.innerHTML = activity.length
      ? activity.map((item) => `<div class="activity"><span class="activity-dot"></span><div class="activity-copy"><strong>${escapeHtml(item.detail)}</strong><small>${escapeHtml(item.actor)} · ${new Date(item.createdAt).toLocaleString(document.documentElement.lang)}</small></div></div>`).join("")
      : BusinessFlow.t("Aucune activité enregistrée.");
  }

  function render() {
    const members = BusinessFlowAuth.currentMembers();
    const term = search.value.trim().toLocaleLowerCase();
    const role = roleFilter.value;
    const visible = members.filter((member) =>
      `${member.name} ${member.email} ${member.role}`.toLocaleLowerCase().includes(term)
      && (role === "all" || member.role === role),
    );
    document.querySelector("#member-count").textContent = members.length;
    const canEditRoles = BusinessFlowAuth.can("manageWorkspace");
    list.innerHTML = visible.length
      ? visible.map((member) => `<tr><td><strong>${escapeHtml(member.name)}</strong>${member.id === current?.id ? ` · ${BusinessFlow.t("Vous")}` : ""}</td><td>${escapeHtml(member.email)}</td><td>${canEditRoles && !member.demo && member.id !== current?.id ? `<select class="member-role" data-id="${escapeHtml(member.id)}" aria-label="${BusinessFlow.t("Rôle de")} ${escapeHtml(member.name)}"><option ${member.role === "Admin" ? "selected" : ""}>Admin</option><option ${member.role === "Manager" ? "selected" : ""}>Manager</option><option ${member.role === "Collaborateur" ? "selected" : ""}>Collaborateur</option></select>` : BusinessFlow.t(member.role)}</td><td><span class="status done">${BusinessFlow.t(member.status || "Actif")}</span></td><td>${member.createdAt ? new Date(member.createdAt).toLocaleDateString(document.documentElement.lang) : BusinessFlow.t("Compte de démonstration")}</td><td>${canEditRoles && !member.demo && member.id !== current?.id ? `<button class="icon-btn remove-member" data-id="${escapeHtml(member.id)}" type="button" aria-label="${BusinessFlow.t("Supprimer")} ${escapeHtml(member.name)}">×</button>` : "—"}</td></tr>`).join("")
      : `<tr><td colspan="6" class="empty-state">${BusinessFlow.t("Aucun membre ne correspond à la recherche.")}</td></tr>`;
    document.querySelectorAll(".member-role").forEach((select) => select.addEventListener("change", () => {
      try {
        BusinessFlowAuth.updateMemberRole(select.dataset.id, select.value);
        BusinessFlowStorage.logActivity("members.updated", BusinessFlow.t("Rôle mis à jour"), current?.name);
        render();
        renderActivity();
      } catch (error) {
        BusinessFlow.showMessage(message, error.message, "error");
      }
    }));
    document.querySelectorAll(".remove-member").forEach((button) => button.addEventListener("click", () => {
      const member = members.find((item) => item.id === button.dataset.id);
      if (!member || !window.confirm(`${BusinessFlow.t("Confirmer la suppression de")} ${member.name} ?`)) return;
      try {
        BusinessFlowAuth.removeMember(member.id);
        render();
        renderActivity();
      } catch (error) {
        BusinessFlow.showMessage(message, error.message, "error");
      }
    }));
  }

  document.querySelector("#invite-member").addEventListener("click", () => {
    if (!BusinessFlowAuth.can("manageMembers")) {
      BusinessFlow.showMessage(message, BusinessFlow.t("Connectez-vous avec le rôle Admin ou Manager pour inviter un membre."), "error");
      return;
    }
    dialog.showModal();
  });
  document.querySelector("#close-invite").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const data = new FormData(form);
    try {
      const { user, temporaryPassword } = await BusinessFlowAuth.invite({
        name: data.get("name"),
        email: data.get("email"),
        role: data.get("role"),
      });
      BusinessFlow.showMessage(message, `${BusinessFlow.t("Compte local créé")} · ${user.email} · ${BusinessFlow.t("Mot de passe temporaire")}: ${temporaryPassword}`, "success");
      form.reset();
      render();
      renderActivity();
    } catch (error) {
      BusinessFlow.showMessage(message, error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
  search.addEventListener("input", render);
  roleFilter.addEventListener("change", render);
  window.addEventListener("businessflow:activity", renderActivity);
  render();
  renderActivity();
  if (!current) {
    const note = document.querySelector("#member-permission-note");
    note.hidden = false;
    note.textContent = BusinessFlow.t("Mode lecture seule. Créez un compte pour gérer vos propres membres.");
  }
});
