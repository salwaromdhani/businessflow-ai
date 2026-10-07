(() => {
  const storage = () => window.BusinessFlowStorage;
  const keys = () => storage().STORAGE_KEYS;
  const roleLabels = { Admin: "Admin", Manager: "Manager", Collaborateur: "Collaborateur", Invité: "Invité" };
  const permissions = {
    Admin: ["manageMembers", "manageDocuments", "manageWorkspace", "manageData", "viewAnalytics"],
    Manager: ["manageMembers", "manageDocuments", "manageData", "viewAnalytics"],
    Collaborateur: ["manageDocuments", "viewAnalytics"],
    Invité: ["viewAnalytics"],
  };

  function users() {
    return storage().readData(keys().users, []);
  }

  function currentUser() {
    const session = JSON.parse(localStorage.getItem(keys().session) || sessionStorage.getItem(keys().session) || "null");
    if (!session?.userId) return null;
    return users().find((user) => user.id === session.userId) || null;
  }

  function can(permission) {
    const user = currentUser();
    return Boolean(user && permissions[user.role]?.includes(permission));
  }

  function currentMembers() {
    const user = currentUser();
    const workspaceId = user?.workspaceId || "demo";
    const accounts = users().filter((item) => item.workspaceId === workspaceId)
      .map(({ passwordHash, salt, ...publicUser }) => ({ ...publicUser, status: "Actif" }));
    if (workspaceId !== "demo") return accounts;
    const stored = storage().readData(keys().members, storage().demoMembers);
    return [...stored, ...accounts.filter((member) => !stored.some((item) => item.id === member.id))];
  }

  async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
    if (!crypto.subtle) throw new Error("Web Crypto is unavailable. Use localhost or HTTPS to create demo accounts.");
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, material, 256);
    return {
      salt: Array.from(salt, (byte) => byte.toString(16).padStart(2, "0")).join(""),
      hash: Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    };
  }

  function fromHex(value) {
    return new Uint8Array(value.match(/.{1,2}/g).map((part) => parseInt(part, 16)));
  }

  async function register({ firstName, lastName, company, email, password }) {
    if (![firstName, lastName, company, email, password].every((value) => typeof value === "string" && value.trim())) {
      throw new Error("Tous les champs obligatoires doivent être remplis.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("Saisissez une adresse e-mail valide.");
    if (password.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
    const address = email.trim().toLowerCase();
    if (users().some((user) => user.email === address)) throw new Error("Cette adresse e-mail est déjà utilisée dans ce navigateur.");
    const credentials = await hashPassword(password);
    const workspaceId = `workspace-${crypto.randomUUID()}`;
    const user = {
      id: `user-${crypto.randomUUID()}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: address,
      role: "Admin",
      workspaceId,
      company: company.trim(),
      city: "Tunis",
      createdAt: new Date().toISOString(),
      ...credentials,
    };
    storage().writeData(keys().users, [...users(), user]);
    storage().writeData(keys().workspace, { id: workspaceId, name: user.company, currency: "TND", city: "Tunis", ownerId: user.id });
    storage().writeData(keys().session, { userId: user.id, createdAt: new Date().toISOString() });
    storage().logActivity("account.created", `${user.name} a créé l’espace ${user.company}.`, user.name);
    return user;
  }

  async function login(email, password, remember = false) {
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      throw new Error("Adresse e-mail ou mot de passe incorrect.");
    }
    const address = email.trim().toLowerCase();
    const user = users().find((item) => item.email === address);
    if (!user) throw new Error("Adresse e-mail ou mot de passe incorrect.");
    const credentials = await hashPassword(password, fromHex(user.salt));
    if (credentials.hash !== user.hash) throw new Error("Adresse e-mail ou mot de passe incorrect.");
    const session = { userId: user.id, createdAt: new Date().toISOString() };
    localStorage.removeItem(keys().session);
    sessionStorage.removeItem(keys().session);
    if (remember) storage().writeData(keys().session, session);
    else sessionStorage.setItem(keys().session, JSON.stringify(session));
    storage().logActivity("session.started", "Connexion à la plateforme.", user.name);
    return user;
  }

  function logout() {
    const user = currentUser();
    if (user) storage().logActivity("session.ended", "Déconnexion.", user.name);
    localStorage.removeItem(keys().session);
    sessionStorage.removeItem(keys().session);
    window.location.href = "login.html";
  }

  async function invite({ name, email, role }) {
    if (!can("manageMembers")) throw new Error("Votre rôle ne permet pas de gérer les membres.");
    if (![name, email, role].every((value) => typeof value === "string" && value.trim())) throw new Error("Tous les champs obligatoires doivent être remplis.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("Saisissez une adresse e-mail valide.");
    if (!["Manager", "Collaborateur"].includes(role)) throw new Error("Seuls les rôles Manager et Collaborateur peuvent être invités.");
    const address = email.trim().toLowerCase();
    if (users().some((user) => user.email === address)) throw new Error("Cette adresse e-mail possède déjà un compte local.");
    const temporaryPassword = `${crypto.randomUUID().slice(0, 8)}A!`;
    const inviter = currentUser();
    const workspace = storage().readData(keys().workspace, { id: inviter.workspaceId, name: inviter.company || "BusinessFlow" });
    const credentials = await hashPassword(temporaryPassword);
    const user = {
      id: `user-${crypto.randomUUID()}`,
      firstName: name.trim().split(/\s+/)[0],
      lastName: name.trim().split(/\s+/).slice(1).join(" "),
      name: name.trim(),
      email: address,
      role,
      workspaceId: workspace.id,
      company: workspace.name,
      city: workspace.city || "Tunis",
      createdAt: new Date().toISOString(),
      ...credentials,
    };
    storage().writeData(keys().users, [...users(), user]);
    storage().logActivity("member.invited", `${user.name} (${role}) a été ajouté à l’espace.`, inviter.name);
    return { user, temporaryPassword };
  }

  function updateMemberRole(userId, role) {
    if (!can("manageWorkspace")) throw new Error("Seul un administrateur peut modifier les rôles.");
    if (!["Manager", "Collaborateur"].includes(role)) throw new Error("Rôle non autorisé.");
    const inviter = currentUser();
    const member = users().find((item) => item.id === userId && item.workspaceId === inviter.workspaceId);
    if (!member || member.id === inviter.id) throw new Error("Membre introuvable ou opération non autorisée.");
    storage().writeData(keys().users, users().map((item) => item.id === userId ? { ...item, role } : item));
    storage().logActivity("member.role.updated", `${member.name} · ${role}`, inviter.name);
  }

  function removeMember(userId) {
    if (!can("manageWorkspace")) throw new Error("Seul un administrateur peut supprimer des membres.");
    const inviter = currentUser();
    const member = users().find((item) => item.id === userId && item.workspaceId === inviter.workspaceId);
    if (!member || member.id === inviter.id) throw new Error("Membre introuvable ou opération non autorisée.");
    storage().writeData(keys().users, users().filter((item) => item.id !== userId));
    storage().logActivity("member.removed", `${member.name} a été retiré de l’espace.`, inviter.name);
  }

  function updateProfile(patch) {
    const user = currentUser();
    if (!user) throw new Error("Connectez-vous pour modifier votre profil.");
    if (![patch.firstName, patch.lastName].every((value) => typeof value === "string" && value.trim())) throw new Error("Tous les champs obligatoires doivent être remplis.");
    const updated = { ...user, firstName: patch.firstName.trim(), lastName: patch.lastName.trim(), name: `${patch.firstName.trim()} ${patch.lastName.trim()}` };
    storage().writeData(keys().users, users().map((item) => item.id === user.id ? updated : item));
    storage().logActivity("profile.updated", "Profil mis à jour.", updated.name);
    return updated;
  }

  function roleLabel(role) {
    return roleLabels[role] || roleLabels.Invité;
  }

  window.BusinessFlowAuth = { currentUser, can, currentMembers, register, login, logout, invite, updateProfile, updateMemberRole, removeMember, roleLabel };
})();
