document.addEventListener("DOMContentLoaded", () => {
  const { STORAGE_KEYS, demoTasks, readData, writeData } = BusinessFlowStorage;
  const list = document.querySelector("#task-list");
  const dialog = document.querySelector("#task-dialog");
  const form = document.querySelector("#task-form");
  let tasks = readData(STORAGE_KEYS.tasks, demoTasks);
  const labels = { todo: "A faire", progress: "En cours", done: "Terminee" };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
  function render() {
    const query = document.querySelector("#task-search").value.toLowerCase();
    const filter = document.querySelector("#task-filter").value;
    const visible = tasks.filter(
      (task) =>
        `${task.title} ${task.owner} ${task.project || ""}`.toLowerCase().includes(query) &&
        (filter === "all" || task.status === filter),
    );
    list.innerHTML = visible.length
      ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Tache</th><th>Responsable</th><th>Projet</th><th>Echeance</th><th>Statut</th><th>Action</th></tr></thead><tbody>${visible.map((task) => `<tr><td><strong>${escapeHtml(task.title)}</strong></td><td>${escapeHtml(task.owner)}</td><td>${escapeHtml(BusinessFlow.t(task.project || "—"))}</td><td>${task.dueDate ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(document.documentElement.lang) : "—"}</td><td><select class="task-status" data-id="${task.id}" aria-label="${BusinessFlow.t("Statut de")} ${escapeHtml(BusinessFlow.t(task.title))}" ${BusinessFlowAuth?.can("manageData") ? "" : "disabled"}><option value="todo" ${task.status === "todo" ? "selected" : ""}>A faire</option><option value="progress" ${task.status === "progress" ? "selected" : ""}>En cours</option><option value="done" ${task.status === "done" ? "selected" : ""}>Terminee</option></select></td><td><button class="icon-btn delete-task" data-id="${task.id}" aria-label="${BusinessFlow.t("Supprimer")} ${escapeHtml(BusinessFlow.t(task.title))}" ${BusinessFlowAuth?.can("manageData") ? "" : "disabled"}>×</button></td></tr>`).join("")}</tbody></table></div>`
      : '<div class="empty-state">Aucune tache ne correspond a votre recherche.</div>';
    list.querySelectorAll(".task-status").forEach((select) =>
      select.addEventListener("change", (event) => {
        const task = tasks.find(
          (item) => item.id === Number(event.target.dataset.id),
        );
        if (!task || !BusinessFlowAuth?.can("manageData")) return;
        task.status = event.target.value;
        writeData(STORAGE_KEYS.tasks, tasks);
        BusinessFlowStorage.logActivity("task.updated", `${task.title} · ${BusinessFlow.t(labels[task.status])}`);
        render();
      }),
    );
    list.querySelectorAll(".delete-task").forEach((button) =>
      button.addEventListener("click", () => {
        if (!BusinessFlowAuth?.can("manageData") || !window.confirm(BusinessFlow.t("Confirmer la suppression de cette tâche ?"))) return;
        tasks = tasks.filter((task) => task.id !== Number(button.dataset.id));
        writeData(STORAGE_KEYS.tasks, tasks);
        BusinessFlowStorage.logActivity("task.deleted", BusinessFlow.t("Tâche supprimée"));
        render();
      }),
    );
  }
  document
    .querySelector("#new-task")
    .addEventListener("click", () => dialog.showModal());
  form.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    if (!BusinessFlowAuth?.can("manageData")) return;
    const data = new FormData(form);
    tasks.unshift({
      id: Date.now(),
      title: String(data.get("title")).trim(),
      owner: String(data.get("owner")).trim(),
      status: data.get("status"),
      project: String(data.get("project") || "").trim(),
      dueDate: String(data.get("dueDate") || ""),
    });
    writeData(STORAGE_KEYS.tasks, tasks);
    BusinessFlowStorage.logActivity("task.created", String(data.get("title")).trim(), String(data.get("owner")).trim());
    form.reset();
    dialog.close();
    render();
  });
  document.querySelector("#task-search").addEventListener("input", render);
  document.querySelector("#task-filter").addEventListener("change", render);
  render();
});
