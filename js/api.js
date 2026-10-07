const API_BASE_URL = "";
const API_ENABLED = false;

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`API ${path}: ${response.status}`);
  return response.json();
}

window.BusinessFlowApi = {
  enabled: API_ENABLED,
  chat: (message, context) =>
    postJson("/api/ai/chat", { message, context }),
  analyze: (datasetIds) =>
    postJson("/api/analytics/analyze", { datasetIds }),
  uploadDocument: async (file, onProgress = () => {}) => {
    const body = new FormData();
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
      xhr.open("POST", `${API_BASE_URL}/api/documents`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300
        ? resolve(JSON.parse(xhr.responseText))
        : reject(new Error(`API /api/documents: ${xhr.status}`));
      xhr.onerror = () => reject(new Error("Network error while uploading document."));
      xhr.send(body);
    });
  },
  getDocument: async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error(`API /api/documents/${id}: ${response.status}`);
    return response.blob();
  },
  deleteDocument: async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`API /api/documents/${id}: ${response.status}`);
    return response.json();
  },
  analyzeDocument: (id, task, context) =>
    postJson(`/api/ai/documents/${encodeURIComponent(id)}/analyze`, { task, context }),
  summarizeDocument: (id, text) =>
    postJson(`/api/ai/documents/${encodeURIComponent(id)}/summary`, { text }),
};
