const STORAGE_KEY = "classSchedulerDataV1";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_START_MIN = 8 * 60;
const DEFAULT_END_MIN = 20 * 60;
const MIN_START_MIN = 6 * 60;
const MAX_END_MIN = 22 * 60;
const STEP = 30;

const state = {
  classes: [],
};

const els = {
  form: document.getElementById("class-form"),
  list: document.getElementById("class-list"),
  calendar: document.getElementById("calendar"),
  status: document.getElementById("status"),
  importFile: document.getElementById("import-file"),
  exportJson: document.getElementById("export-json"),
  importJson: document.getElementById("import-json"),
  exportCsv: document.getElementById("export-csv"),
  importUniversityCsv: document.getElementById("import-university-csv"),
  shareLink: document.getElementById("share-link"),
  clearAll: document.getElementById("clear-all"),
  importUniversityFile: document.getElementById("import-university-file"),
};

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.style.color = isError ? "#ff5b6b" : "#9aa6b2";
}

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeClass(raw) {
  const startMin = Number(raw.startMin);
  const endMin = Number(raw.endMin);
  const validDays = Array.isArray(raw.days) ? raw.days.filter((d) => DAYS.includes(d)) : [];
  if (
    typeof raw.course !== "string" ||
    !raw.course.trim() ||
    !Number.isFinite(startMin) ||
    !Number.isFinite(endMin) ||
    endMin <= startMin ||
    !validDays.length
  ) {
    return null;
  }

  return {
    id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    course: raw.course.trim(),
    instructor: typeof raw.instructor === "string" ? raw.instructor.trim() : "",
    location: typeof raw.location === "string" ? raw.location.trim() : "",
    days: validDays,
    startMin,
    endMin,
    color: /^#[\da-fA-F]{6}$/.test(raw.color) ? raw.color : "#6f7eff",
  };
}

function formatTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

function overlaps(a, b) {
  return Math.max(a.startMin, b.startMin) < Math.min(a.endMin, b.endMin);
}

function annotateConflicts(classes) {
  return classes.map((c, i) => {
    const conflict = classes.some((other, j) => {
      if (i === j) return false;
      const shareDay = c.days.some((d) => other.days.includes(d));
      return shareDay && overlaps(c, other);
    });
    return { ...c, conflict };
  });
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.classes));
}

function load() {
  const fromHash = parseHashData();
  if (fromHash) {
    state.classes = fromHash;
    save();
    setStatus("Loaded shared schedule from URL.");
    return;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.classes = parsed.map(normalizeClass).filter(Boolean);
    }
  } catch {
    setStatus("Could not load saved data.", true);
  }
}

function renderList() {
  els.list.innerHTML = "";

  const classes = annotateConflicts(state.classes);

  classes.forEach((item) => {
    const li = document.createElement("li");
    li.className = "class-card";
    li.style.borderLeftColor = item.color;

    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.course + (item.conflict ? " ⚠ Conflict" : "");

    const scheduleMeta = document.createElement("div");
    scheduleMeta.className = "class-meta";
    scheduleMeta.textContent = `${item.days.join("/")} · ${formatTime(item.startMin)} - ${formatTime(item.endMin)}`;

    const infoMeta = document.createElement("div");
    infoMeta.className = "class-meta";
    infoMeta.textContent = `${item.location || "No location"} · ${item.instructor || "No instructor"}`;
    details.append(title, scheduleMeta, infoMeta);

    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.classes = state.classes.filter((c) => c.id !== item.id);
      save();
      rerender();
    });

    li.append(details, remove);
    els.list.appendChild(li);
  });

  if (!classes.length) {
    els.list.innerHTML = "<li class='class-meta'>No classes added yet.</li>";
  }
}

function renderCalendar() {
  const classes = annotateConflicts(state.classes);
  els.calendar.innerHTML = "";
  const range = getDisplayRange(classes);
  const startMin = range.startMin;
  const endMin = range.endMin;
  const columnCount = DAYS.length + 1;

  const grid = document.createElement("div");
  grid.className = "grid";

  const topLeft = document.createElement("div");
  topLeft.className = "cell header";
  topLeft.textContent = "Time";
  grid.appendChild(topLeft);

  for (const day of DAYS) {
    const d = document.createElement("div");
    d.className = "cell header";
    d.textContent = day;
    grid.appendChild(d);
  }

  const rows = (endMin - startMin) / STEP;
  for (let r = 0; r < rows; r++) {
    const mins = startMin + r * STEP;

    const timeCell = document.createElement("div");
    timeCell.className = "cell time";
    timeCell.textContent = formatTime(mins);
    grid.appendChild(timeCell);

    for (let d = 0; d < DAYS.length; d++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.day = DAYS[d];
      cell.dataset.row = String(r);
      grid.appendChild(cell);
    }
  }

  els.calendar.appendChild(grid);

  for (const c of classes) {
    for (const day of c.days) {
      const col = DAYS.indexOf(day);
      if (col === -1) continue;

      const startRow = Math.max(0, Math.floor((c.startMin - startMin) / STEP));
      const endRow = Math.min(rows, Math.ceil((c.endMin - startMin) / STEP));
      const span = Math.max(1, endRow - startRow);

      const rowIndex = 1 + startRow;
      const gridColIndex = 2 + col;
      const index = rowIndex * columnCount + (gridColIndex - 1);
      const cell = grid.children[index];
      if (!cell) continue;

      const block = document.createElement("div");
      block.className = `block ${c.conflict ? "conflict" : ""}`;
      block.style.background = `${c.color}bb`;
      block.style.height = `calc(${span * 48}px - 8px)`;
      const course = document.createElement("strong");
      course.textContent = c.course;
      const time = document.createElement("div");
      time.textContent = `${formatTime(c.startMin)}-${formatTime(c.endMin)}`;
      const location = document.createElement("div");
      location.textContent = c.location || "";
      block.append(course, time, location);
      cell.appendChild(block);
    }
  }
}

function getDisplayRange(classes) {
  if (!classes.length) {
    return { startMin: DEFAULT_START_MIN, endMin: DEFAULT_END_MIN };
  }
  const earliest = Math.min(...classes.map((c) => c.startMin));
  const latest = Math.max(...classes.map((c) => c.endMin));
  const paddedStart = Math.floor((earliest - STEP) / STEP) * STEP;
  const paddedEnd = Math.ceil((latest + STEP) / STEP) * STEP;
  return {
    startMin: clamp(paddedStart, MIN_START_MIN, DEFAULT_START_MIN),
    endMin: clamp(paddedEnd, DEFAULT_END_MIN, MAX_END_MIN),
  };
}

function rerender() {
  renderList();
  renderCalendar();
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const head = ["course", "instructor", "location", "days", "start", "end"];
  const rows = state.classes.map((c) => [
    c.course,
    c.instructor,
    c.location,
    c.days.join("/"),
    formatTime(c.startMin),
    formatTime(c.endMin),
  ]);
  const csv = [head, ...rows]
    .map((r) => r.map((v) => `"${String(v || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  download("schedule.csv", csv, "text/csv");
  setStatus("Exported CSV.");
}

function parseHashData() {
  if (!location.hash.startsWith("#data=")) return null;
  try {
    const raw = decodeURIComponent(location.hash.slice(6));
    const data = JSON.parse(atob(raw));
    if (!Array.isArray(data)) return null;
    return data.map(normalizeClass).filter(Boolean);
  } catch {
    setStatus("Could not load shared link data.", true);
    return null;
  }
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseDaysTimes(raw) {
  const input = (raw || "").toUpperCase();
  const map = [
    ["M", "Mon"],
    ["T", "Tue"],
    ["W", "Wed"],
    ["R", "Thu"],
    ["F", "Fri"],
    ["S", "Sat"],
    ["U", "Sun"],
  ];
  const days = map.filter(([abbr]) => input.includes(abbr)).map(([, day]) => day);

  const match = input.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/);
  if (!match || !days.length) return null;
  const to24 = (v) => {
    const [hm, suffix] = v.trim().split(/\s+/);
    let [h, m] = hm.split(":").map(Number);
    if (suffix === "PM" && h !== 12) h += 12;
    if (suffix === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  return { days, start: to24(match[1]), end: to24(match[2]) };
}

function importUniversityCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV has no data rows.");
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const pick = (...names) => headers.findIndex((h) => names.includes(h));
  const idxCourse = pick("course", "subject title", "title");
  const idxInstructor = pick("instructor", "instructor(s)");
  const idxLocation = pick("building & room", "location", "room");
  const idxDaysTimes = pick("days & times", "meeting time", "days/times");

  if (idxCourse === -1 || idxDaysTimes === -1) {
    throw new Error("CSV format missing required columns.");
  }

  const imported = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const schedule = parseDaysTimes(cols[idxDaysTimes] || "");
    if (!schedule) continue;
    const normalized = normalizeClass({
      id: crypto.randomUUID(),
      course: cols[idxCourse] || "Course",
      instructor: idxInstructor >= 0 ? cols[idxInstructor] : "",
      location: idxLocation >= 0 ? cols[idxLocation] : "",
      days: schedule.days,
      startMin: toMinutes(schedule.start),
      endMin: toMinutes(schedule.end),
      color: "#6f7eff",
    });
    if (normalized) imported.push(normalized);
  }
  return imported;
}

function copyShareLink() {
  const encoded = btoa(JSON.stringify(state.classes));
  const link = `${location.origin}${location.pathname}#data=${encodeURIComponent(encoded)}`;
  navigator.clipboard.writeText(link).then(
    () => setStatus("Share link copied to clipboard."),
    () => setStatus("Could not copy link. You can copy URL manually.", true),
  );
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const course = document.getElementById("course").value.trim();
  const instructor = document.getElementById("instructor").value.trim();
  const locationField = document.getElementById("location").value.trim();
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;
  const color = document.getElementById("color").value;

  const days = [...els.form.querySelectorAll("fieldset input:checked")].map((i) => i.value);

  if (!days.length) {
    setStatus("Select at least one day.", true);
    return;
  }

  if (toMinutes(end) <= toMinutes(start)) {
    setStatus("End time must be after start time.", true);
    return;
  }

  const nextClass = normalizeClass({
    id: crypto.randomUUID(),
    course,
    instructor,
    location: locationField,
    days,
    startMin: toMinutes(start),
    endMin: toMinutes(end),
    color,
  });
  if (!nextClass) {
    setStatus("Could not add class: invalid values.", true);
    return;
  }

  state.classes.push(nextClass);

  save();
  rerender();
  els.form.reset();
  document.getElementById("color").value = "#6f7eff";
  setStatus("Class added.");
});

els.exportJson.addEventListener("click", () => {
  download("schedule.json", JSON.stringify(state.classes, null, 2), "application/json");
  setStatus("Exported JSON.");
});

els.importJson.addEventListener("click", () => els.importFile.click());
els.importFile.addEventListener("change", async () => {
  const file = els.importFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("Invalid JSON format");
    state.classes = data.map(normalizeClass).filter(Boolean);
    save();
    rerender();
    setStatus("Imported JSON.");
  } catch {
    setStatus("Import failed: invalid JSON.", true);
  } finally {
    els.importFile.value = "";
  }
});

els.exportCsv.addEventListener("click", exportCSV);
els.importUniversityCsv.addEventListener("click", () => els.importUniversityFile.click());
els.importUniversityFile.addEventListener("change", async () => {
  const file = els.importUniversityFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = importUniversityCsv(text);
    if (!imported.length) throw new Error("No parsable rows");
    state.classes.push(...imported);
    save();
    rerender();
    setStatus(`Imported ${imported.length} classes from university CSV.`);
  } catch {
    setStatus("Could not import university CSV. Check column names and time format.", true);
  } finally {
    els.importUniversityFile.value = "";
  }
});
els.shareLink.addEventListener("click", copyShareLink);
els.clearAll.addEventListener("click", () => {
  state.classes = [];
  save();
  rerender();
  setStatus("Cleared all classes.");
});

load();
rerender();
