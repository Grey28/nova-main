/**
 * Dashboard de NovaFit conectado a Supabase.
 * Requiere supabase-js (CDN), supabase-config.js y supabase-client.js.
 */
(function () {
  'use strict';

  var db = window.novaDb;
  var $ = function (id) { return document.getElementById(id); };

  var currentUser = null;
  var routinesCache = [];
  var AVATAR_PLACEHOLDER = './assets/avatar-placeholder.svg';

  var GOALS = ['Mejorar condición física', 'Ganar masa muscular', 'Perder grasa'];
  var LEVELS = ['Principiante', 'Intermedio', 'Avanzado'];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clamp(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function localDateISO(date) {
    var value = date || new Date();
    var year = value.getFullYear();
    var month = String(value.getMonth() + 1).padStart(2, '0');
    var day = String(value.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function sum(rows, key) {
    return (rows || []).reduce(function (total, row) {
      return total + (Number(row[key]) || 0);
    }, 0);
  }

  function toast(message, type) {
    var element = document.getElementById('novaToast');
    if (!element) {
      element = document.createElement('div');
      element.id = 'novaToast';
      element.className = 'auth-toast';
      document.body.appendChild(element);
    }

    element.textContent = message;
    element.setAttribute('data-type', type || 'success');
    element.classList.add('show');
    clearTimeout(element._timeout);
    element._timeout = setTimeout(function () {
      element.classList.remove('show');
    }, 4000);
  }

  function bindLogout() {
    var link = $('logoutBtn');
    if (!link) return;

    link.addEventListener('click', async function (event) {
      event.preventDefault();
      try {
        await db.auth.signOut();
      } finally {
        window.location.replace('inicio.html');
      }
    });
  }

  function bindProfileForm() {
    var button = $('saveProfileBtn');
    if (!button) return;

    button.addEventListener('click', async function () {
      var fullName = $('profileNameInput').value.trim();
      var goal = $('profileGoal').value;
      var level = $('profileLevel').value;

      if (!fullName) {
        toast('Escribe tu nombre.', 'error');
        return;
      }

      button.disabled = true;
      var result = await db.from('profiles').upsert({
        id: currentUser.id,
        full_name: fullName,
        goal: goal,
        level: level,
        updated_at: new Date().toISOString()
      });
      button.disabled = false;

      if (result.error) {
        toast('No se pudo guardar el perfil: ' + result.error.message, 'error');
        return;
      }

      toast('Perfil actualizado.', 'success');
      await loadProfile();
      await loadSummary();
    });
  }

  function bindMealButton() {
    var button = $('addMealBtn');
    if (!button) return;

    button.addEventListener('click', async function () {
      var meal = window.prompt('Nombre de la comida (por ejemplo: Desayuno):');
      if (!meal || !meal.trim()) return;

      var caloriesRaw = window.prompt('Calorías aproximadas:');
      if (caloriesRaw === null) return;

      var calories = Number.parseInt(caloriesRaw, 10);
      if (!Number.isFinite(calories) || calories < 0) {
        toast('Calorías inválidas.', 'error');
        return;
      }

      var proteinRaw = window.prompt('Proteína en gramos (opcional):', '0');
      var protein = proteinRaw === null
        ? 0
        : Number.parseFloat(String(proteinRaw).replace(',', '.')) || 0;

      var result = await db.from('nutrition_logs').insert({
        user_id: currentUser.id,
        meal: meal.trim(),
        calories: calories,
        protein_g: protein,
        log_date: localDateISO()
      });

      if (result.error) {
        toast('No se pudo agregar la comida.', 'error');
        return;
      }

      toast('Comida registrada.', 'success');
      await Promise.all([loadNutrition(), loadSummary()]);
    });
  }

  function bindMeasurementButton() {
    var button = $('addMeasurementBtn');
    if (!button) return;

    button.addEventListener('click', async function () {
      var raw = window.prompt('Registra tu peso actual en kg:');
      if (raw === null) return;

      var weight = Number.parseFloat(String(raw).replace(',', '.'));
      if (!Number.isFinite(weight) || weight <= 0 || weight > 400) {
        toast('Peso inválido.', 'error');
        return;
      }

      var result = await db.from('progress_entries').insert({
        user_id: currentUser.id,
        weight_kg: weight
      });

      if (result.error) {
        toast('No se pudo registrar la medición.', 'error');
        return;
      }

      toast('Medición registrada.', 'success');
      await Promise.all([loadProgress(), loadSummary()]);
    });
  }

  function storageErrorMessage(message) {
    var text = String(message || '');
    var lower = text.toLowerCase();

    if (lower.indexOf('bucket not found') !== -1) {
      return 'No existe el bucket "avatars". Ejecuta supabase/storage-avatars.sql en el SQL Editor de Supabase.';
    }

    if (lower.indexOf('row-level security') !== -1 || lower.indexOf('permission') !== -1) {
      return 'El bucket existe pero faltan permisos. Ejecuta supabase/storage-avatars.sql en Supabase.';
    }

    if (lower.indexOf('payload too large') !== -1 || lower.indexOf('maximum') !== -1) {
      return 'La imagen es demasiado grande. El máximo es 2 MB.';
    }

    if (lower.indexOf('mime') !== -1) {
      return 'Formato no permitido. Usa JPG, PNG o WebP.';
    }

    return text;
  }

  function bindAvatarControls() {
    var input = $('avatarInput');

    if (input) {
      input.addEventListener('change', async function () {
        var file = input.files && input.files[0];
        if (!file) return;

        if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
          toast('Formato no válido. Usa JPG, PNG o WebP.', 'error');
          input.value = '';
          return;
        }

        if (file.size > 2 * 1024 * 1024) {
          toast('La imagen no puede superar 2 MB.', 'error');
          input.value = '';
          return;
        }

        var extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
        var path = currentUser.id + '/avatar.' + extension;

        var upload = await db.storage.from('avatars').upload(path, file, {
          upsert: true,
          cacheControl: '3600',
          contentType: file.type
        });

        if (upload.error) {
          toast('No se pudo subir la foto: ' + storageErrorMessage(upload.error.message), 'error');
          input.value = '';
          return;
        }

        var publicUrl = db.storage.from('avatars').getPublicUrl(path).data.publicUrl;
        var displayUrl = publicUrl + '?v=' + Date.now();
        var update = await db.from('profiles').update({
          avatar_url: displayUrl,
          updated_at: new Date().toISOString()
        }).eq('id', currentUser.id);

        if (update.error) {
          toast('No se pudo guardar la foto en el perfil.', 'error');
          input.value = '';
          return;
        }

        $('avatarImg').src = displayUrl;
        $('avatarPreview').src = displayUrl;
        toast('Foto de perfil actualizada.', 'success');
        input.value = '';
      });
    }

    var remove = $('removeAvatarBtn');

    if (remove) {
      remove.addEventListener('click', async function () {
        var update = await db.from('profiles').update({
          avatar_url: null,
          updated_at: new Date().toISOString()
        }).eq('id', currentUser.id);

        if (update.error) {
          toast('No se pudo quitar la foto.', 'error');
          return;
        }

        $('avatarImg').src = AVATAR_PLACEHOLDER;
        $('avatarPreview').src = AVATAR_PLACEHOLDER;
        toast('Foto de perfil eliminada.', 'success');
      });
    }
  }

  async function loadProfile() {
    var result = await db.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    var profile = result.data;

    if (!profile) {
      profile = {
        id: currentUser.id,
        full_name: (currentUser.user_metadata && currentUser.user_metadata.full_name) ||
          String(currentUser.email || '').split('@')[0],
        goal: GOALS[0],
        level: LEVELS[0]
      };
      await db.from('profiles').upsert(profile);
    }

    var name = profile.full_name || 'Usuario';
    var avatarUrl = profile.avatar_url || AVATAR_PLACEHOLDER;

    $('profileName').textContent = name;
    $('heroName').textContent = name.split(' ')[0];
    $('profilePlan').textContent = profile.level || 'Miembro';
    $('profileNameInput').value = name;
    $('profileEmailInput').value = currentUser.email || '';
    $('avatarImg').src = avatarUrl;
    $('avatarPreview').src = avatarUrl;
    $('profileGoal').value = GOALS.indexOf(profile.goal) !== -1 ? profile.goal : GOALS[0];
    $('profileLevel').value = LEVELS.indexOf(profile.level) !== -1 ? profile.level : LEVELS[0];
  }

  async function loadSummary() {
    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    var results = await Promise.all([
      db.from('workouts').select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id).gte('completed_at', monthStart),
      db.from('workouts').select('completed_at')
        .eq('user_id', currentUser.id).order('completed_at', { ascending: false }).limit(90),
      db.from('routines').select('*')
        .eq('user_id', currentUser.id).order('progress', { ascending: true })
        .order('created_at', { ascending: true }).limit(1),
      db.from('nutrition_logs').select('water_l')
        .eq('user_id', currentUser.id).eq('log_date', localDateISO())
    ]);

    var monthResult = results[0];
    var workoutsResult = results[1];
    var routinesResult = results[2];
    var nutritionResult = results[3];

    var workouts = workoutsResult.data || [];
    var monthCount = monthResult.count || 0;

    var doneDays = new Set(workouts.map(function (row) {
      return localDateISO(new Date(row.completed_at));
    }));

    var streak = 0;
    var cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    while (doneDays.has(localDateISO(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    var weekCount = workouts.filter(function (row) {
      return new Date(row.completed_at) >= monday;
    }).length;

    var weeklyGoal = 4;
    var weeklyPercent = clamp((weekCount / weeklyGoal) * 100);

    $('streakMetric').textContent = streak + (streak === 1 ? ' día' : ' días');
    $('workoutsMetric').textContent = String(monthCount);
    $('weeklyGoalMetric').textContent = weekCount + ' / ' + weeklyGoal;
    $('weeklyGoalBar').style.width = weeklyPercent + '%';

    var next = (routinesResult.data || [])[0];
    $('nextRoutineText').textContent = next
      ? next.name + ' · ' + (Number(next.duration_min) || 30) + ' min · Nivel ' +
        String(next.level || 'intermedio').toLowerCase()
      : 'Aún no tienes rutinas creadas.';

    var water = sum(nutritionResult.data, 'water_l');
    $('hydrationMetric').textContent = water.toFixed(1) + ' L';
    $('hydrationBar').style.width = clamp((water / 2) * 100) + '%';

    var consistency = clamp((monthCount / 12) * 100);
    $('consistencyMetric').textContent = consistency + '%';
    $('consistencyBar').style.width = consistency + '%';

    $('goalText').textContent = 'Tu meta semanal está al ' + weeklyPercent + '%.';
    $('goalBar').style.width = weeklyPercent + '%';
  }

  async function loadRoutines() {
    var grid = $('routinesGrid');
    if (!grid) return;

    var result = await db.from('routines').select('*')
      .eq('user_id', currentUser.id).order('created_at', { ascending: true });

    if (result.error) {
      grid.innerHTML = '<div class="card wide"><p class="muted">No se pudieron cargar las rutinas.</p></div>';
      toast('No se pudieron cargar las rutinas.', 'error');
      return;
    }

    routinesCache = result.data || [];

    if (!routinesCache.length) {
      grid.innerHTML = '<div class="card wide"><h3>Sin rutinas todavía</h3>' +
        '<p class="muted">Ejecuta el esquema de Supabase para obtener las rutinas iniciales.</p></div>';
      return;
    }

    var cards = routinesCache.map(function (routine) {
      var progress = clamp(routine.progress);
      return '<div class="card">' +
        '<h3>' + escapeHtml(routine.name) + '</h3>' +
        '<p class="muted">' + (Number(routine.duration_min) || 30) + ' min · ' +
        escapeHtml(routine.level || 'Intermedio') + '</p>' +
        '<div class="progress"><span style="width:' + progress + '%"></span></div>' +
        '<button class="btn" data-routine-id="' + escapeHtml(routine.id) + '">' +
        (progress >= 100 ? 'Completada' : 'Comenzar') + '</button>' +
        '</div>';
    }).join('');

    var planRows = routinesCache.slice(0, 3).map(function (routine, index) {
      return '<div class="list-item"><span>' + escapeHtml(routine.name) + '</span>' +
        '<span class="tag">' + (index === 0 ? 'Hoy' : 'Disponible') + '</span></div>';
    }).join('');

    grid.innerHTML = cards + '<div class="card wide"><h3>Plan semanal</h3>' +
      '<div class="list">' + planRows + '</div></div>';

    grid.querySelectorAll('[data-routine-id]').forEach(function (button) {
      button.addEventListener('click', function () {
        completeRoutine(button.getAttribute('data-routine-id'));
      });
    });
  }

  async function completeRoutine(id) {
    var routine = routinesCache.find(function (item) { return item.id === id; });
    if (!routine) return;

    var result = await db.from('workouts').insert({
      user_id: currentUser.id,
      routine_id: id,
      duration_min: Number(routine.duration_min) || 30
    });

    if (result.error) {
      toast('No se pudo registrar el entrenamiento.', 'error');
      return;
    }

    var nextProgress = clamp((Number(routine.progress) || 0) + 25);
    await db.from('routines').update({ progress: nextProgress })
      .eq('id', id).eq('user_id', currentUser.id);

    toast('Entrenamiento registrado.', 'success');
    await Promise.all([loadRoutines(), loadSummary(), loadProgress()]);
  }

  async function loadNutrition() {
    var result = await db.from('nutrition_logs').select('*')
      .eq('user_id', currentUser.id).eq('log_date', localDateISO())
      .order('created_at', { ascending: true });

    if (result.error) {
      toast('No se pudo cargar la nutrición.', 'error');
      return;
    }

    var rows = result.data || [];
    var calories = sum(rows, 'calories');
    var protein = sum(rows, 'protein_g');
    var water = sum(rows, 'water_l');

    $('caloriesMetric').textContent = calories.toLocaleString('es-CO');
    $('caloriesBar').style.width = clamp((calories / 1900) * 100) + '%';
    $('proteinMetric').textContent = protein.toFixed(0) + ' g';
    $('waterMetric').textContent = water.toFixed(1) + ' L';

    $('mealsList').innerHTML = rows.length
      ? rows.map(function (row) {
          return '<div class="list-item"><span>' + escapeHtml(row.meal || 'Comida') +
            '</span><span>' + (Number(row.calories) || 0) + ' kcal</span></div>';
        }).join('')
      : '<div class="list-item"><span class="muted">Sin comidas registradas hoy.</span>' +
        '<span class="muted">0 kcal</span></div>';
  }

  async function loadProgress() {
    var results = await Promise.all([
      db.from('progress_entries').select('*').eq('user_id', currentUser.id)
        .order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('progress_entries').select('*').eq('user_id', currentUser.id)
        .order('recorded_at', { ascending: true }).limit(1).maybeSingle(),
      db.from('workouts').select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
    ]);

    var latest = results[0].data;
    var first = results[1].data;
    var totalWorkouts = results[2].count || 0;

    $('totalWorkoutsMetric').textContent = String(totalWorkouts);

    if (latest && latest.weight_kg != null) {
      $('weightMetric').textContent = Number(latest.weight_kg).toFixed(1) + ' kg';

      if (first && first.weight_kg != null && first.id !== latest.id) {
        var difference = Number(latest.weight_kg) - Number(first.weight_kg);
        var sign = difference > 0 ? '+' : '';
        $('weightDelta').textContent = sign + difference.toFixed(1) + ' kg desde el inicio';
      } else {
        $('weightDelta').textContent = 'Primera medición registrada.';
      }
    } else {
      $('weightMetric').textContent = '—';
      $('weightDelta').textContent = 'Registra tu primera medición.';
    }
  }

  async function init() {
    if (!window.NOVAFIT_CONFIGURED || !db) {
      toast('Supabase no está configurado. Edita frontend/js/supabase-config.js.', 'error');
      return;
    }

    var result = await db.auth.getSession();
    if (result.error || !result.data.session) {
      window.location.replace('inicio.html');
      return;
    }

    currentUser = result.data.session.user;

    bindLogout();
    bindProfileForm();
    bindAvatarControls();
    bindMealButton();
    bindMeasurementButton();

    db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT') {
        window.location.replace('inicio.html');
      }
    });

    await Promise.all([
      loadProfile(),
      loadRoutines(),
      loadNutrition(),
      loadProgress(),
      loadSummary()
    ]);
  }

  init();
})();
