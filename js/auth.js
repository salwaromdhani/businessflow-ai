document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.querySelector("#login-form");
  const registerForm = document.querySelector("#register-form");
  const message = document.querySelector("#auth-message");
  const t = (key) => window.BusinessFlow?.t(key) || key;

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    if (!form.reportValidity()) return;
    button.disabled = true;
    try {
      await BusinessFlowAuth.login(data.get("email"), data.get("password"), data.get("remember") === "on");
      BusinessFlow.showMessage(message, t("Connexion réussie. Redirection…"), "success");
      setTimeout(() => { window.location.href = "dashboard.html"; }, 400);
    } catch (error) {
      BusinessFlow.showMessage(message, error.message, "error");
      button.disabled = false;
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    if (!form.reportValidity()) return;
    if (data.get("password") !== data.get("confirmPassword")) {
      BusinessFlow.showMessage(message, t("Les mots de passe ne correspondent pas."), "error");
      return;
    }
    button.disabled = true;
    try {
      const user = await BusinessFlowAuth.register({
        firstName: data.get("firstName"),
        lastName: data.get("lastName"),
        company: data.get("company"),
        email: data.get("email"),
        password: data.get("password"),
      });
      BusinessFlow.showMessage(message, `${t("Espace administrateur créé")} · ${user.company} · ${t("Devise")} TND`, "success");
      setTimeout(() => { window.location.href = "dashboard.html"; }, 700);
    } catch (error) {
      BusinessFlow.showMessage(message, error.message, "error");
      button.disabled = false;
    }
  });
});
