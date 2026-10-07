(() => {
  function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) return [];
    const delimiter = [",", ";", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
    const parseLine = (line) => {
      const cells = [];
      let cell = "";
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"' && line[index + 1] === '"' && quoted) {
          cell += '"';
          index += 1;
        } else if (character === '"') quoted = !quoted;
        else if (character === delimiter && !quoted) {
          cells.push(cell.trim());
          cell = "";
        } else cell += character;
      }
      cells.push(cell.trim());
      return cells;
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).map((line) =>
      Object.fromEntries(parseLine(line).map((value, index) => [headers[index] || `column_${index + 1}`, value])),
    );
  }

  async function parseStructuredFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension === "csv") return parseCsv(await file.text());
    if (extension === "json") {
      const parsed = JSON.parse(await file.text());
      const rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.data) ? parsed.data : null;
      if (rows && rows.every((row) => row !== null && typeof row === "object" && !Array.isArray(row))) return rows;
      throw new Error("JSON must contain an array of records or a data array.");
    }
    if (extension === "xlsx") {
      if (!window.XLSX) throw new Error("XLSX reader is unavailable. Check the CDN connection.");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    }
    throw new Error("This is not a supported structured data file.");
  }

  window.BusinessFlowDataParser = { parseCsv, parseStructuredFile };
})();
