const STORAGE_KEYS = {
  tasks: "businessflow.tasks",
  companies: "businessflow.companies",
  profile: "businessflow.profile",
  imports: "businessflow.imports",
  users: "businessflow.users",
  session: "businessflow.session",
  activities: "businessflow.activities",
  workspace: "businessflow.workspace",
  members: "businessflow.members",
  notifications: "businessflow.notifications",
};

const demoTasks = [
  { id: 1, title: "Valider le devis TND-2407", owner: "Amel Ben Youssef", status: "progress", dueDate: "2026-10-05", project: "Déploiement Sfax" },
  { id: 2, title: "Relancer les prospects de Tunis", owner: "Yassine Trabelsi", status: "todo", dueDate: "2026-10-02", project: "Acquisition Q4" },
  { id: 3, title: "Préparer le rapport mensuel", owner: "Meriem Gharbi", status: "done", dueDate: "2026-10-01", project: "Pilotage finance" },
  { id: 4, title: "Confirmer la livraison à Sousse", owner: "Fares Ben Salem", status: "progress", dueDate: "2026-10-18", project: "Commandes octobre" },
];

const demoCompanies = [
  { id: 1, name: "Carthage Digital", sector: "Services numériques", city: "Tunis", members: 8, status: "Actif" },
  { id: 2, name: "Sahara Olive", sector: "Agroalimentaire", city: "Sfax", members: 14, status: "Actif" },
  { id: 3, name: "Cap Bon Distribution", sector: "Commerce", city: "Nabeul", members: 5, status: "Invite" },
  { id: 4, name: "Medina Conseil", sector: "Conseil", city: "Sousse", members: 6, status: "Actif" },
];

const demoMembers = [
  { id: "demo-amel", name: "Amel Ben Youssef", email: "amel@example.invalid", role: "Manager", status: "Actif", demo: true },
  { id: "demo-yassine", name: "Yassine Trabelsi", email: "yassine@example.invalid", role: "Collaborateur", status: "Actif", demo: true },
  { id: "demo-meriem", name: "Meriem Gharbi", email: "meriem@example.invalid", role: "Collaborateur", status: "Actif", demo: true },
];

function readData(key, fallback) {
  const saved = localStorage.getItem(key);
  if (!saved) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  try {
    const value = JSON.parse(saved);
    if (key === STORAGE_KEYS.tasks && Array.isArray(value)
      && value.some((item) => ["Brief campagne Q4", "Relancer les opportunites ouvertes", "Rapport mensuel"].includes(item.title))) {
      localStorage.setItem(key, JSON.stringify(demoTasks));
      return demoTasks;
    }
    if (key === STORAGE_KEYS.companies && Array.isArray(value)
      && value.some((item) => ["Nova Studio", "Maison Lune", "Orbital Conseil"].includes(item.name))) {
      localStorage.setItem(key, JSON.stringify(demoCompanies));
      return demoCompanies;
    }
    return value;
  } catch (error) {
    console.warn(`BusinessFlow: invalid local data for "${key}".`, error);
    return fallback;
  }
}

function writeData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getActivity() {
  return readData(STORAGE_KEYS.activities, []);
}

function logActivity(type, detail, actor) {
  const activity = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    detail,
    actor: actor || "Workspace",
    createdAt: new Date().toISOString(),
  };
  writeData(STORAGE_KEYS.activities, [activity, ...getActivity()].slice(0, 100));
  window.dispatchEvent(new CustomEvent("businessflow:activity", { detail: activity }));
  return activity;
}

window.BusinessFlowStorage = {
  STORAGE_KEYS,
  demoTasks,
  demoCompanies,
  demoMembers,
  readData,
  writeData,
  getActivity,
  logActivity,
};
