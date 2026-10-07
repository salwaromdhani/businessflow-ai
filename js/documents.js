document.addEventListener("DOMContentLoaded", () => {
  const allowed = new Set(["pdf", "docx", "xlsx", "csv", "json", "txt"]);
  const form = document.querySelector("#document-form");
  const input = document.querySelector("#document-file");
  const list = document.querySelector("#document-list");
  const search = document.querySelector("#document-search");
  const typeFilter = document.querySelector("#document-type-filter");
  const message = document.querySelector("#document-message");
  const progressHolder = document.querySelector("#document-progress");
  const progressBar = document.querySelector("#document-progress-bar");
  const progressLabel = document.querySelector("#document-progress-label");
  const analysis = document.querySelector("#document-analysis");
  const previewDialog = document.querySelector("#document-dialog");
  const MAX_SIZE = 25 * 1024 * 1024;
  let documents = [];

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
  const formatSize = (size) => size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`;
  const canManage = () => window.BusinessFlowAuth?.can("manageDocuments") || false;

  async function extractText(file, extension) {
    if (extension === "txt") return file.text();
    if (extension === "csv" || extension === "json") return file.text();
    if (extension === "xlsx") return (await BusinessFlowDataParser.parseStructuredFile(file)).slice(0, 200).map((row) => Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(" | ")).join("\n");
    if (extension === "docx") {
      if (!window.mammoth) throw new Error(BusinessFlow.t("Le lecteur DOCX est indisponible. Le fichier reste stocké localement."));
      const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value;
    }
    if (extension === "pdf") {
      if (!window.pdfjsLib) throw new Error(BusinessFlow.t("Le lecteur PDF est indisponible. Le fichier reste stocké localement."));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages = [];
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 40); pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => item.str).join(" "));
      }
      return pages.join("\n").slice(0, 500000);
    }
    return "";
  }

  async function refresh() {
    try {
      documents = await BusinessFlowDocuments.list();
      render();
    } catch (error) {
      list.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
      BusinessFlow.showMessage(message, BusinessFlow.t("Impossible d’accéder au stockage des documents."), "error");
    }
  }

  function render() {
    const term = search.value.trim().toLocaleLowerCase();
    const selectedType = typeFilter.value;
    const visible = documents.filter((document) =>
      document.name.toLocaleLowerCase().includes(term)
      && (selectedType === "all" || document.type === selectedType),
    );
    list.innerHTML = visible.length
      ? visible.map((document) => `<tr><td><strong>${escapeHtml(document.name)}</strong></td><td>${escapeHtml(document.type)}</td><td>${escapeHtml(document.size)}</td><td>${escapeHtml(document.uploadedBy || BusinessFlow.t("Visiteur de démonstration"))}</td><td>${new Date(document.createdAt).toLocaleString(window.document.documentElement.lang)}</td><td><span class="status ${document.status === "ready" ? "done" : "progress"}">${BusinessFlow.t(document.status === "ready" ? "Disponible localement" : "Traitement en cours")}</span><progress class="row-progress" max="100" value="${document.progress}"></progress></td><td><button class="icon-btn view-document" data-id="${escapeHtml(document.id)}" type="button" aria-label="${BusinessFlow.t("Ouvrir")} ${escapeHtml(document.name)}">↗</button><button class="icon-btn summarize-document" data-id="${escapeHtml(document.id)}" type="button" aria-label="${BusinessFlow.t("Analyser avec l’IA")} ${escapeHtml(document.name)}">✧</button><button class="icon-btn delete-document" data-id="${escapeHtml(document.id)}" type="button" aria-label="${BusinessFlow.t("Supprimer")} ${escapeHtml(document.name)}" ${canManage() ? "" : "disabled"}>×</button></td></tr>`).join("")
      : `<tr><td colspan="7" class="empty-state">${BusinessFlow.t(documents.length ? "Aucun résultat pour ces filtres." : "Aucun document pour le moment.")}</td></tr>`;
    list.querySelectorAll(".view-document").forEach((button) => button.addEventListener("click", () => openDocument(button.dataset.id)));
    list.querySelectorAll(".summarize-document").forEach((button) => button.addEventListener("click", () => analyzeDocument(button.dataset.id)));
    list.querySelectorAll(".delete-document").forEach((button) => button.addEventListener("click", () => deleteDocument(button.dataset.id)));
  }

  async function openDocument(id) {
    const item = documents.find((document) => document.id === id);
    if (!item) return;
    document.querySelector("#document-dialog-title").textContent = item.name;
    const preview = document.querySelector("#document-preview");
    if (item.extractedText) preview.textContent = item.extractedText || BusinessFlow.t("Aucun texte lisible n’a été extrait.");
    else preview.textContent = `${BusinessFlow.t("Ce format n’a pas de texte extrait dans cette session.")}\n${item.size} · ${item.type}`;
    previewDialog.showModal();
  }

  async function analyzeDocument(id) {
    const item = documents.find((document) => document.id === id);
    if (!item) return;
    analysis.hidden = false;
    if (!window.BusinessFlowApi?.enabled) {
      analysis.className = "notice";
      analysis.textContent = BusinessFlow.t("L’analyse IA de documents n’est pas connectée. L’extraction de texte locale reste disponible avec le bouton d’ouverture.");
      return;
    }
    analysis.className = "notice";
    analysis.textContent = BusinessFlow.t("Analyse du document en cours…");
    try {
      const response = await BusinessFlowApi.analyzeDocument(id, "summarize-and-extract", { workspaceId: BusinessFlowAuth.currentUser()?.workspaceId });
      if (typeof response.summary !== "string" || !response.summary.trim()) throw new Error(BusinessFlow.t("Le service a renvoyé une analyse vide."));
      analysis.className = "notice success";
      analysis.textContent = response.summary;
    } catch (error) {
      analysis.className = "notice error";
      analysis.textContent = `${BusinessFlow.t("Échec de l’analyse du document.")} ${error.message}`;
    }
  }

  async function deleteDocument(id) {
    if (!canManage()) return;
    const item = documents.find((document) => document.id === id);
    if (!item || !window.confirm(`${BusinessFlow.t("Confirmer la suppression de")} « ${item.name} » ?`)) return;
    try {
      await BusinessFlowDocuments.remove(id);
      if (item.datasetId) {
        const imports = BusinessFlowStorage.readData(BusinessFlowStorage.STORAGE_KEYS.imports, []);
        BusinessFlowStorage.writeData(BusinessFlowStorage.STORAGE_KEYS.imports, imports.filter((entry) => entry.id !== item.datasetId));
        window.dispatchEvent(new CustomEvent("businessflow:data-updated"));
      }
      BusinessFlowStorage.logActivity("document.deleted", item.name, BusinessFlowAuth.currentUser()?.name);
      analysis.hidden = true;
      await refresh();
      BusinessFlow.showMessage(message, BusinessFlow.t("Document supprimé du stockage local."), "success");
    } catch (error) {
      BusinessFlow.showMessage(message, `${BusinessFlow.t("Échec de la suppression.")} ${error.message}`, "error");
    }
  }

  async function createStructuredImport(file, documentId, rows) {
    if (!["csv", "xlsx", "json"].includes(file.name.split(".").pop().toLowerCase())) return null;
    if (!rows.length) return null;
    const entry = {
      id: `dataset-${documentId}`,
      name: file.name,
      size: formatSize(file.size),
      source: "local",
      uploadedBy: BusinessFlowAuth.currentUser().name,
      importedAt: new Date().toISOString(),
      rows,
      documentId,
    };
    const imports = BusinessFlowStorage.readData(BusinessFlowStorage.STORAGE_KEYS.imports, []);
    BusinessFlowStorage.writeData(BusinessFlowStorage.STORAGE_KEYS.imports, [entry, ...imports]);
    return entry.id;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManage()) {
      BusinessFlow.showMessage(message, BusinessFlow.t("Connectez-vous avec le rôle Manager ou Admin pour ajouter un document."), "error");
      return;
    }
    const file = input.files[0];
    const extension = file?.name.split(".").pop().toLowerCase();
    if (!file || !allowed.has(extension)) {
      BusinessFlow.showMessage(message, BusinessFlow.t("Formats pris en charge : PDF, DOCX, XLSX, CSV, JSON et TXT."), "error");
      return;
    }
    if (file.size > MAX_SIZE) {
      BusinessFlow.showMessage(message, BusinessFlow.t("La taille maximale des documents en mode local est de 25 Mo."), "error");
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    progressHolder.hidden = false;
    progressBar.removeAttribute("value");
    progressLabel.textContent = BusinessFlow.t("Lecture du document…");
    BusinessFlow.showMessage(message, BusinessFlow.t("Enregistrement dans le stockage local…"), "notice");
    let datasetId = null;
    let documentId = null;
    try {
      const id = `doc-${crypto.randomUUID()}`;
      documentId = id;
      let extractedText = "";
      let extractionWarning = "";
      const currentUser = BusinessFlowAuth.currentUser();
      try {
        if (["csv", "xlsx", "json"].includes(extension)) {
          const rows = await BusinessFlowDataParser.parseStructuredFile(file);
          extractedText = rows.slice(0, 200).map((row) => Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(" | ")).join("\n");
          datasetId = await createStructuredImport(file, id, rows);
        } else {
          extractedText = await extractText(file, extension);
        }
      } catch (error) {
        extractionWarning = error.message;
      }
      progressLabel.textContent = BusinessFlow.t("Enregistrement local sécurisé…");
      await BusinessFlowDocuments.save({
        id,
        name: file.name,
        type: extension.toUpperCase(),
        size: formatSize(file.size),
        uploadedBy: currentUser.name,
        createdAt: new Date().toISOString(),
        status: "ready",
        progress: 100,
        blob: file,
        extractedText,
        datasetId,
      });
      BusinessFlowStorage.logActivity("document.uploaded", `${file.name} · ${formatSize(file.size)}`, currentUser.name);
      progressBar.value = 100;
      progressLabel.textContent = BusinessFlow.t("Document disponible");
      BusinessFlow.showMessage(message, extractionWarning
        ? `${BusinessFlow.t("Document enregistré. L’extraction de texte n’a pas abouti.")} ${extractionWarning}`
        : BusinessFlow.t("Document enregistré localement. L’analyse IA reste indisponible tant que le backend n’est pas connecté."), extractionWarning ? "error" : "success");
      form.reset();
      await refresh();
      window.dispatchEvent(new CustomEvent("businessflow:documents-updated"));
      window.dispatchEvent(new CustomEvent("businessflow:data-updated"));
    } catch (error) {
      if (datasetId) {
        const imports = BusinessFlowStorage.readData(BusinessFlowStorage.STORAGE_KEYS.imports, []);
        BusinessFlowStorage.writeData(BusinessFlowStorage.STORAGE_KEYS.imports, imports.filter((entry) => entry.id !== datasetId));
      }
      if (documentId) {
        try {
          await BusinessFlowDocuments.remove(documentId);
        } catch (cleanupError) {
          console.error("BusinessFlow: failed to roll back document upload.", cleanupError);
        }
      }
      BusinessFlow.showMessage(message, `${BusinessFlow.t("Échec de l’enregistrement du document.")} ${error.message}`, "error");
    } finally {
      submit.disabled = false;
      progressHolder.hidden = true;
    }
  });

  search.addEventListener("input", render);
  typeFilter.addEventListener("change", render);
  window.addEventListener("storage", (event) => {
    if (event.key === BusinessFlowStorage.STORAGE_KEYS.imports) window.dispatchEvent(new CustomEvent("businessflow:data-updated"));
  });
  refresh();
});
