document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#settings-form");
  const message = document.querySelector("#settings-message");
  const user = BusinessFlowAuth?.currentUser();
  const profile = user || JSON.parse(localStorage.getItem("businessflow.profile") || "null");
  if (profile) {
    document.querySelector("#settings-first").value = profile.firstName || "";
    document.querySelector("#settings-last").value = profile.lastName || "";
    document.querySelector("#settings-email").value = profile.email || "";
    document.querySelector("#settings-role").value = BusinessFlow.t(profile.role || "Invité");
  }
  const workspace = BusinessFlowStorage?.readData(BusinessFlowStorage.STORAGE_KEYS.workspace, null)
    || { name: "Carthage Digital", city: "Tunis", currency: "TND" };
  if (workspace) {
    const name = document.querySelector(".workspace-chip strong");
    const details = document.querySelector(".workspace-chip small");
    if (name) name.textContent = `${workspace.name} · ${BusinessFlow.t(workspace.city || "Tunis")}`;
    if (details) details.textContent = `${workspace.currency || "TND"} · ${BusinessFlowAuth.currentMembers().length} ${BusinessFlow.t("Membres")}`;
  }
  const preferenceKey = "businessflow.preferences";
  let preferences = {};
  try {
    preferences = JSON.parse(localStorage.getItem(preferenceKey) || "{}");
  } catch (error) {
    console.warn("BusinessFlow: invalid preferences data.", error);
  }
  document.querySelectorAll("[data-preference]").forEach((control) => {
    const key = control.dataset.preference;
    control.checked = preferences[key] ?? control.checked;
    control.addEventListener("change", () => {
      preferences[key] = control.checked;
      localStorage.setItem(preferenceKey, JSON.stringify(preferences));
      document.body.classList.toggle("compact-mode", Boolean(preferences.compactMode));
      BusinessFlowStorage.logActivity("preference.updated", `${key} · ${control.checked ? "on" : "off"}`, user?.name);
      BusinessFlow.showMessage(message, BusinessFlow.t("Préférences enregistrées localement."), "success");
    });
  });
  document.body.classList.toggle("compact-mode", Boolean(preferences.compactMode));
  document.querySelector("#edit-workspace")?.addEventListener("click", () => {
    if (!BusinessFlowAuth.can("manageWorkspace")) {
      BusinessFlow.showMessage(message, BusinessFlow.t("Seul un administrateur peut modifier l’espace."), "error");
      return;
    }
    const current = BusinessFlowStorage.readData(BusinessFlowStorage.STORAGE_KEYS.workspace, null);
    if (!current) return;
    const name = window.prompt(BusinessFlow.t("Nom de l’espace de travail :"), current.name);
    if (!name?.trim()) return;
    const updated = { ...current, name: name.trim() };
    BusinessFlowStorage.writeData(BusinessFlowStorage.STORAGE_KEYS.workspace, updated);
    const chip = document.querySelector(".workspace-chip strong");
    if (chip) chip.textContent = `${updated.name} · ${BusinessFlow.t(updated.city || "Tunis")}`;
    BusinessFlowStorage.logActivity("workspace.updated", updated.name, user?.name);
    BusinessFlow.showMessage(message, BusinessFlow.t("Espace de travail mis à jour."), "success");
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const updated = BusinessFlowAuth.updateProfile({
        firstName: document.querySelector("#settings-first").value,
        lastName: document.querySelector("#settings-last").value,
      });
      document.querySelectorAll(".user-copy").forEach((element) => {
        if (element.tagName === "STRONG") element.textContent = updated.name;
      });
      BusinessFlow.showMessage(message, BusinessFlow.t("Profil mis à jour dans ce navigateur."), "success");
    } catch (error) {
      BusinessFlow.showMessage(message, error.message, "error");
    }
  });
});
