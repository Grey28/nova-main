/* NovaFit | Generador de perfiles
   Lee únicamente información no médica guardada en este navegador.
   No lee novafit_fase3 ni muestra antecedentes, diagnósticos o medicamentos.

   Integración NovaFit:
   - Exige sesión iniciada.
   - Se muestra como primera pantalla tras el primer inicio de sesión.
   - Al continuar, guarda en el usuario (user_metadata) que ya lo completó.
   - Si no hay fases guardadas, usa los datos reales del perfil de Supabase.
*/
(() => {
  "use strict";

  const STORAGE_KEYS = {
    1: ["novafit_fase1", "novafit_phase1", "fase1"],
    2: ["novafit_fase2", "novafit_phase2", "fase2"],
    4: ["novafit_fase4", "novafit_phase4", "fase4"],
    5: ["novafit_fase5", "novafit_phase5", "fase5"],
    6: ["novafit_fase6", "novafit_phase6", "fase6"],
    7: ["novafit_fase7", "novafit_phase7", "fase7"]
  };

  const DONE_FLAG = "profile_generator_done";
  const DONE_STORAGE_PREFIX = "novafit_generator_done:";

  const $ = (id) => document.getElementById(id);
  const db = window.novaDb;

  let collected = [];
  let phasesCache = {};
  let generated = false;
  let currentUser = null;

  function parseStored(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`No se pudo leer ${key}.`, error);
      return null;
    }
  }

  function readPhases() {
    const phases = {};
    Object.entries(STORAGE_KEYS).forEach(([phase, keys]) => {
      for (const key of keys) {
        const value = parseStored(key);
        if (value && typeof value === "object" && Object.keys(value).length) {
          phases[phase] = value;
          break;
        }
      }
    });
    return phases;
  }

  // Convierte estructuras de respuestas comunes en pares etiqueta/valor.
  function flatten(value, path = "", output = []) {
    if (value === null || value === undefined || value === "") return output;
    if (Array.isArray(value)) {
      if (value.every(v => ["string", "number", "boolean"].includes(typeof v))) {
        output.push({ label: path, value: value.join(", ") });
      } else {
        value.forEach((item, index) => flatten(item, path ? `${path} ${index + 1}` : `Dato ${index + 1}`, output));
      }
      return output;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, val]) => {
        if (["timestamp", "fecha", "createdat", "updatedat", "phase", "fase"].includes(normalize(key))) return;
        flatten(val, path ? `${path} ${key}` : key, output);
      });
      return output;
    }
    output.push({ label: path || "Dato", value: String(value) });
    return output;
  }

  function normalize(text) {
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
  }

  function cleanLabel(label) {
    return String(label).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ")
      .replace(/\s+/g, " ").trim().replace(/^./, c => c.toUpperCase());
  }

  function findByKeywords(items, keywords) {
    return items.filter(item => {
      const key = normalize(item.label);
      return keywords.some(word => key.includes(normalize(word)));
    });
  }

  function uniqueValues(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = `${normalize(item.label)}:${normalize(item.value)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function formatValue(value) {
    return String(value).replace(/\btrue\b/gi, "Sí").replace(/\bfalse\b/gi, "No");
  }

  function renderItems(targetId, items, emptyText) {
    const target = $(targetId);
    if (!items.length) {
      target.className = "card-content empty";
      target.textContent = emptyText;
      return;
    }
    target.className = "card-content";
    target.innerHTML = `<div class="data-list">${items.slice(0, 8).map(item =>
      `<div class="data-item"><span>${escapeHTML(cleanLabel(item.label))}</span><strong>${escapeHTML(formatValue(item.value))}</strong></div>`
    ).join("")}</div>`;
  }

  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function renderTags(targetId, items, emptyText) {
    const target = $(targetId);
    if (!items.length) {
      target.className = "card-content empty";
      target.textContent = emptyText;
      return;
    }
    target.className = "card-content";
    target.innerHTML = `<div class="tag-list">${items.slice(0, 12).map(item =>
      `<span class="tag">${escapeHTML(formatValue(item.value))}</span>`
    ).join("")}</div>`;
  }

  function calculateBMI(items) {
    const weightItem = items.find(x => /peso/.test(normalize(x.label)));
    const heightItem = items.find(x => /altura|estatura/.test(normalize(x.label)));
    if (!weightItem || !heightItem) return null;
    const weight = parseFloat(String(weightItem.value).replace(",", "."));
    let height = parseFloat(String(heightItem.value).replace(",", "."));
    if (!Number.isFinite(weight) || !Number.isFinite(height) || weight <= 0 || height <= 0) return null;
    if (height > 3) height /= 100;
    if (height < 0.8 || height > 2.5) return null;
    return { value: (weight / (height * height)).toFixed(1), weight, height };
  }

  function getAllItems(phases) {
    const all = [];
    Object.entries(phases).forEach(([phase, data]) => {
      flatten(data, `Fase ${phase}`, all);
    });
    return uniqueValues(all);
  }

  // ---------------------------------------------------------
  // Integración con NovaFit (sesión y primer inicio de sesión)
  // ---------------------------------------------------------

  function generatorDoneInUser(user) {
    return !!(user && user.user_metadata && user.user_metadata[DONE_FLAG]);
  }

  function doneStorageKey(user) {
    return DONE_STORAGE_PREFIX + (user && user.id ? user.id : "anon");
  }

  function doneLocally(user) {
    try {
      return localStorage.getItem(doneStorageKey(user)) === "1";
    } catch (error) {
      return false;
    }
  }

  function saveDoneLocally(user) {
    try {
      localStorage.setItem(doneStorageKey(user), "1");
    } catch (error) {
      /* localStorage puede estar bloqueado; no es crítico. */
    }
  }

  async function markGeneratorDone() {
    saveDoneLocally(currentUser);
    if (db && currentUser) {
      try {
        const existing = (currentUser.user_metadata && typeof currentUser.user_metadata === 'object')
          ? currentUser.user_metadata
          : {};
        const merged = Object.assign({}, existing, { profile_generator_done: true });
        await db.auth.updateUser({ data: merged });
      } catch (error) {
        console.warn("[NovaFit] No se pudo guardar el estado del generador en Supabase.", error);
      }
    }
  }

  function goToDashboard() {
    window.location.href = "dashboard.html#inicio";
  }

  async function guardSession() {
    if (!window.NOVAFIT_CONFIGURED || !db) {
      window.location.replace("inicio.html");
      return false;
    }

    const result = await db.auth.getSession();
    if (result.error || !result.data.session) {
      window.location.replace("inicio.html");
      return false;
    }

    currentUser = result.data.session.user;
    return true;
  }

  // Si no hay fases guardadas, arma la fase 1 con datos reales del perfil.
  async function profileFallbackPhases() {
    if (!db || !currentUser) return {};

    const profileResult = await db
      .from("profiles")
      .select("full_name, goal, level, height_cm")
      .eq("id", currentUser.id)
      .maybeSingle();
    const profile = profileResult && !profileResult.error ? profileResult.data : null;

    const progressResult = await db
      .from("progress_entries")
      .select("weight_kg, recorded_at")
      .eq("user_id", currentUser.id)
      .order("recorded_at", { ascending: false })
      .limit(1);
    const latest = progressResult && !progressResult.error && progressResult.data
      ? progressResult.data[0]
      : null;

    const phase = {};
    if (profile) {
      if (profile.full_name) phase.nombre = profile.full_name;
      if (profile.goal) phase.objetivo = profile.goal;
      if (profile.level) phase.nivel_deportivo = profile.level;
      if (profile.height_cm) phase.altura_cm = profile.height_cm;
    }
    if (latest && latest.weight_kg) phase.peso_kg = latest.weight_kg;

    return Object.keys(phase).length ? { 1: phase } : {};
  }

  // ---------------------------------------------------------
  // Render del perfil
  // ---------------------------------------------------------

  function generate(phases) {
    phases = phases || phasesCache || readPhases();
    phasesCache = phases;

    collected = getAllItems(phases);
    const phaseCount = Object.keys(phases).length;

    $("phases-count").textContent = `${phaseCount}/7`;
    $("sync-status").textContent = phaseCount
      ? `Se encontraron datos en ${phaseCount} fase(s). La fase 3 se mantiene excluida.`
      : "No se encontraron respuestas guardadas. Revisa las claves de almacenamiento de tus fases.";
    $("profile-state").textContent = phaseCount ? "Generado" : "Incompleto";
    $("profile-badge").textContent = phaseCount ? "Perfil orientativo" : "Esperando datos";

    const goals = findByKeywords(collected, ["objetivo", "meta", "goal"]);
    const sport = findByKeywords(collected, ["experiencia", "nivel deportivo", "actividad fisica", "frecuencia", "entrenamiento", "deporte"]);
    const body = findByKeywords(collected, ["peso", "altura", "estatura", "cintura", "cadera", "pecho", "brazo", "pierna", "edad"]);
    const nutrition = findByKeywords(collected, ["alimentacion", "alimentación", "dieta", "comida", "nutric", "agua", "hidrat", "preferencia aliment"]);
    const recovery = findByKeywords(collected, ["sueno", "sueño", "descanso", "horas de dormir", "recuperacion", "recuperación", "calidad del sueno"]);
    const availability = findByKeywords(collected, ["disponibilidad", "horario", "tiempo", "ocupacion", "ocupación", "equipamiento", "equipo", "aplicaciones"]);

    const mainGoal = goals[0]?.value || "Pendiente";
    $("main-goal").textContent = mainGoal.length > 26 ? mainGoal.slice(0, 23) + "…" : mainGoal;
    $("sport-level").textContent = sport.find(x => /nivel|experiencia/.test(normalize(x.label)))?.value || "Pendiente";

    const bmi = calculateBMI(collected);
    const bodyItems = body.slice(0, 7).map(x => ({ label: x.label.replace(/^Fase \d+\s*/, ""), value: x.value }));
    if (bmi) bodyItems.push({ label: "IMC calculado", value: `${bmi.value} kg/m²` });
    renderItems("body-content", bodyItems, "No se encontraron medidas. Verifica que la fase 1 guarde sus respuestas en localStorage.");

    renderTags("sport-content", goals.concat(sport).slice(0, 12), "No se encontraron objetivos o datos deportivos. Verifica las fases 2 y 4.");
    renderTags("nutrition-content", nutrition, "No se encontraron preferencias o hábitos nutricionales en la fase 5.");
    renderTags("recovery-content", recovery, "No se encontraron datos de descanso en la fase 6.");
    renderTags("availability-content", availability, "No se encontraron datos de disponibilidad en la fase 7.");

    const rec = [];
    if (!phaseCount || phaseCount < 5) rec.push("Completa o conecta las fases de evaluación que aún no guardan respuestas para obtener un perfil más completo.");
    if (goals.length) rec.push(`Usa «${mainGoal}» como punto de partida para definir metas medibles y progresivas.`);
    if (sport.length) rec.push("Ajusta la carga de entrenamiento al nivel de experiencia reportado y aumenta la dificultad gradualmente.");
    if (availability.length) rec.push("Diseña una planificación que respete los horarios y los recursos realmente disponibles.");
    if (!bmi) rec.push("Cuando la fase 1 esté conectada, se podrán mostrar las medidas corporales disponibles. El IMC, si se calcula, será solo una referencia general y no un diagnóstico.");
    rec.push("Antes de recomendar o iniciar ejercicios, solicita la revisión profesional de la información de salud de la fase 3 por un canal seguro.");
    $("recommendation-content").innerHTML = `<ul>${rec.map(line => `<li>${escapeHTML(line)}</li>`).join("")}</ul>`;
    $("safety-content").innerHTML = `<p class="safe-note">La fase 3 no se ha leído. La aptitud para entrenar no puede determinarse con este resumen. Solicita una revisión profesional separada de los antecedentes y restricciones de salud antes de crear un plan.</p>`;

    generated = true;
  }

  function exportProfile() {
    if (!generated) generate(phasesCache);
    // Exporta solo campos no médicos y excluye expresamente la fase 3.
    const safeData = {
      app: "NovaFit",
      generatedAt: new Date().toISOString(),
      phasesIncluded: Object.keys(phasesCache),
      medicalPhaseExcluded: true,
      responses: collected,
      note: "Resumen orientativo. No contiene ni sustituye la evaluación médica."
    };
    const blob = new Blob([JSON.stringify(safeData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "novafit-perfil.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function bind() {
    $("generate-btn").addEventListener("click", () => generate());
    $("refresh-btn").addEventListener("click", () => generate());
    $("print-btn").addEventListener("click", () => { if (!generated) generate(phasesCache); window.print(); });
    $("export-btn").addEventListener("click", exportProfile);

    const continueBtn = $("continue-btn");
    if (continueBtn) {
      continueBtn.addEventListener("click", async () => {
        continueBtn.disabled = true;
        continueBtn.textContent = "Guardando…";
        await markGeneratorDone();
        goToDashboard();
      });
    }
  }

  async function init() {
    if (!(await guardSession())) return;

    bind();

    let phases = readPhases();
    if (!Object.keys(phases).length) {
      const fallback = await profileFallbackPhases();
      if (Object.keys(fallback).length) {
        phases = fallback;
        $("sync-status").textContent = "Mostrando los datos de tu perfil de NovaFit. Aún no hay fases de evaluación guardadas.";
      }
    }

    generate(phases);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
