/**
 * Asistente virtual de NovaFit.
 *
 * No usa servicios externos ni claves: responde con reglas y con los datos
 * que ya muestra el dashboard (rutinas, nutrición y progreso).
 * Se carga en inicio.html (login) y en dashboard.html (panel Inicio).
 */
(function () {
  'use strict';

  if (document.getElementById('novaAssistant')) return;

  var body = document.body;

  function $(id) {
    return document.getElementById(id);
  }

  function textOf(id) {
    var element = $(id);
    return element ? element.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function isDashboard() {
    return !!$('nextRoutineText');
  }

  function routinesList() {
    var grid = $('routinesGrid');
    if (!grid) return [];

    var nodes = grid.querySelectorAll('.card h3');
    var values = [];

    for (var i = 0; i < nodes.length && values.length < 6; i++) {
      var value = nodes[i].textContent.replace(/\s+/g, ' ').trim();
      if (value && value !== 'Plan semanal') values.push(value);
    }

    return values;
  }

  function context() {
    return {
      dashboard: isDashboard(),
      name: textOf('heroName') || textOf('profileName'),
      nextRoutine: textOf('nextRoutineText'),
      streak: textOf('streakMetric'),
      workoutsMonth: textOf('workoutsMetric'),
      weeklyGoal: textOf('weeklyGoalMetric'),
      hydration: textOf('hydrationMetric'),
      calories: textOf('caloriesMetric'),
      protein: textOf('proteinMetric'),
      weight: textOf('weightMetric'),
      totalWorkouts: textOf('totalWorkoutsMetric'),
      consistency: textOf('consistencyMetric'),
      routines: routinesList()
    };
  }

  /* ------------------------- Respuestas ------------------------- */

  function answerNextRoutine(ctx) {
    if (!ctx.dashboard) {
      return {
        text: 'Cuando inicies sesión, en Inicio verás tu próxima rutina con su duración y nivel.',
        actions: [{ label: 'Ir a iniciar sesión', href: 'inicio.html' }]
      };
    }

    if (!ctx.nextRoutine || /no tienes rutinas/i.test(ctx.nextRoutine)) {
      return {
        text: 'Todavía no aparecen rutinas en tu cuenta.\n\nEntra a Rutinas para revisar si ya se crearon las de tu plan.',
        actions: [{ label: 'Ir a Rutinas', href: '#rutinas' }]
      };
    }

    return {
      text: 'Tu próxima rutina es:\n' + ctx.nextRoutine + '\n\nCuando la termines, entra a Rutinas y pulsa Comenzar para registrarla en tu progreso.',
      actions: [{ label: 'Ir a Rutinas', href: '#rutinas' }]
    };
  }

  function answerStreak(ctx) {
    if (!ctx.dashboard) {
      return {
        text: 'La racha cuenta los días consecutivos en los que registras al menos un entrenamiento. En tu panel Inicio ves la racha actual y tu mejor mes.'
      };
    }

    return {
      text: 'Llevas ' + (ctx.streak || '0 días') + ' de racha 🔥\n\nTu mejor racha del mes aparece en la tarjeta principal. Para no perderla, registra al menos un entrenamiento hoy.',
      actions: [{ label: 'Ver rutinas', href: '#rutinas' }]
    };
  }

  function answerWeekly(ctx) {
    if (!ctx.dashboard) {
      return {
        text: 'La meta semanal de NovaFit es completar 4 entrenamientos por semana. En Inicio ves tu avance con una barra de progreso.'
      };
    }

    return {
      text: 'Esta semana llevas ' + (ctx.weeklyGoal || '0 / 4') + ' entrenamientos.\n\nLa meta es 4 por semana. Si te falta poco, una sesión corta también cuenta.',
      actions: [{ label: 'Ir a Rutinas', href: '#rutinas' }]
    };
  }

  function answerHydration(ctx) {
    var current = ctx.dashboard && ctx.hydration
      ? 'Hoy registraste ' + ctx.hydration + '.\n\n'
      : '';

    return {
      text: current + 'La meta diaria es 2.0 L de agua.\n\nConsejo: ten una botella a la vista y bebe un vaso antes de cada comida. En Nutrición puedes registrar tu consumo.'
    };
  }

  function answerNutrition(ctx) {
    if (!ctx.dashboard) {
      return {
        text: 'En la sección Nutrición puedes ver las calorías, la proteína y el agua del día, además de agregar cada comida.',
        actions: [{ label: 'Ir a Nutrición', href: '#nutricion' }]
      };
    }

    return {
      text: 'Hoy llevas ' + (ctx.calories || '0') + ' kcal y ' + (ctx.protein || '0') + ' de proteína.\n\nLa referencia de tu plan es 1.900 kcal diarias. Si te falta proteína, añade huevo, pollo, atún, lentejas o yogur griego.',
      actions: [{ label: 'Ir a Nutrición', href: '#nutricion' }]
    };
  }

  function answerWeight(ctx) {
    if (!ctx.dashboard || !ctx.weight || ctx.weight === '—') {
      return {
        text: 'Aún no has registrado tu peso.\n\nEntra a Progreso y pulsa Registrar medición. Pésate siempre a la misma hora, preferiblemente por la mañana.',
        actions: [{ label: 'Ir a Progreso', href: '#progreso' }]
      };
    }

    return {
      text: 'Tu último peso registrado es ' + ctx.weight + '.\n\nSi quieres corregirlo, entra a Progreso y pulsa Editar peso. Para una nueva medición, usa Registrar medición.',
      actions: [{ label: 'Ir a Progreso', href: '#progreso' }]
    };
  }

  function answerConsistency(ctx) {
    if (!ctx.dashboard || !ctx.consistency) {
      return {
        text: 'La constancia mide qué porcentaje de tu meta mensual has cumplido. En Progreso ves tu porcentaje y el total de entrenamientos.'
      };
    }

    return {
      text: 'Tu constancia actual es ' + ctx.consistency + '.\n\nHas completado ' + (ctx.totalWorkouts || '0') + ' entrenamientos en total. La clave es mantener el ritmo, no entrenar de más un solo día.',
      actions: [{ label: 'Ver Progreso', href: '#progreso' }]
    };
  }

  function answerRoutineList(ctx) {
    if (!ctx.dashboard || !ctx.routines.length) {
      return {
        text: 'En Rutinas encontrarás tus planes con duración, nivel y progreso. Si aún no hay rutinas, se crean automáticamente al registrarte.',
        actions: [{ label: 'Ver Rutinas', href: '#rutinas' }]
      };
    }

    return {
      text: 'Estas son tus rutinas:\n• ' + ctx.routines.join('\n• ') +
        '\n\nAbre cada una para ver su duración y registrar cuando la completes.',
      actions: [{ label: 'Ir a Rutinas', href: '#rutinas' }]
    };
  }

  function answerCompleteRoutine() {
    return {
      text: 'Para registrar un entrenamiento:\n1. Entra a Rutinas.\n2. Elige la rutina que hiciste.\n3. Pulsa Comenzar (o Completada).\n\nSe sumará a tu racha, a tu meta semanal y a tu progreso.',
      actions: [{ label: 'Ir a Rutinas', href: '#rutinas' }]
    };
  }

  function answerAddMeal() {
    return {
      text: 'Para registrar una comida:\n1. Entra a Nutrición.\n2. Pulsa Agregar comida.\n3. Escribe el nombre y las calorías aproximadas.\n\nTambién puedes indicar la proteína en gramos para llevar un control más preciso.',
      actions: [{ label: 'Ir a Nutrición', href: '#nutricion' }]
    };
  }

  function answerMeasurement() {
    return {
      text: 'Para registrar tu peso:\n1. Entra a Progreso.\n2. Pulsa Registrar medición.\n3. Escribe tu peso en kg.\n\nVerás tu peso actual y la diferencia desde tu primera medición.',
      actions: [{ label: 'Ir a Progreso', href: '#progreso' }]
    };
  }

  function answerAvatar(ctx) {
    var intro = ctx.dashboard
      ? 'Para cambiar tu foto de perfil:\n1. Entra a Mi perfil.\n2. Pulsa Elegir foto.\n'
      : 'Cuando inicies sesión, entra a Mi perfil para cambiar tu foto:\n1. Pulsa Elegir foto.\n';

    return {
      text: intro + '3. Elige una imagen JPG, PNG o WebP de máximo 2 MB.\n\nTambién puedes pulsar Quitar foto para volver al avatar neutro.',
      actions: [{ label: ctx.dashboard ? 'Ir a Mi perfil' : 'Iniciar sesión', href: ctx.dashboard ? '#perfil' : 'inicio.html' }]
    };
  }

  function answerProfile(ctx) {
    return {
      text: 'Para actualizar tus datos:\n1. Entra a Mi perfil.\n2. Cambia tu nombre, objetivo o nivel.\n3. Pulsa Guardar cambios.\n\nTu objetivo y nivel ayudan a personalizar tus rutinas.',
      actions: [{ label: ctx.dashboard ? 'Ir a Mi perfil' : 'Iniciar sesión', href: ctx.dashboard ? '#perfil' : 'inicio.html' }]
    };
  }

  function answerSignup() {
    return {
      text: 'Crear tu cuenta es gratis:\n1. Pulsa Crear cuenta.\n2. Escribe tu nombre, correo y contraseña (mínimo 6 caracteres).\n3. Confirma el correo que te llegue.\n4. Inicia sesión y completa tu perfil.',
      actions: [{ label: 'Crear cuenta', href: 'registro.html' }]
    };
  }

  function answerForgot() {
    return {
      text: 'Para recuperar tu contraseña:\n1. En la pantalla de inicio de sesión pulsa ¿Olvidaste tu contraseña?\n2. Escribe tu correo.\n3. Abre el enlace o código que te llegue.\n4. Crea una contraseña nueva.',
      actions: [{ label: 'Recuperar contraseña', href: 'recuperar.html' }]
    };
  }

  function answerLogin() {
    return {
      text: 'Para entrar:\n1. Escribe tu correo y contraseña.\n2. Pulsa Iniciar sesión.\n\nSi te dice que debes confirmar el correo, revisa tu bandeja y la carpeta de spam.',
      actions: [{ label: 'Ir a iniciar sesión', href: 'inicio.html' }]
    };
  }

  function answerNoEmail() {
    return {
      text: 'El correo de confirmación puede tardar unos minutos.\n\nRevisa Spam y Promociones. Si sigue sin llegar, espera un poco: el servicio de correo limita los envíos por hora y pedir varios seguidos alarga la espera.\n\nCuando llegue, abre el enlace para activar tu cuenta.'
    };
  }

  function answerFree() {
    return {
      text: 'Sí, NovaFit es gratis. Puedes crear tu cuenta, ver rutinas, registrar comidas y seguir tu progreso sin pagar.'
    };
  }

  function answerAbout() {
    return {
      text: 'NovaFit es una plataforma de bienestar para entrenar con rutinas personalizadas, llevar tu nutrición, registrar tu progreso y mantener la motivación.\n\nTodo en un solo lugar y desde cualquier dispositivo.'
    };
  }

  function answerRoutines(ctx) {
    return {
      text: 'En Rutinas encuentras tus planes con duración y nivel. Cada rutina muestra su progreso y un botón para registrarla cuando la completes.\n\nSi eres principiante, empieza con las rutinas de nivel Principiante y descansa entre sesiones.',
      actions: [{ label: ctx.dashboard ? 'Ir a Rutinas' : 'Iniciar sesión', href: ctx.dashboard ? '#rutinas' : 'inicio.html' }]
    };
  }

  function answerNutritionGeneral(ctx) {
    return {
      text: 'En Nutrición llevas el control diario de calorías, proteína y agua.\n\nConsejos generales:\n• Incluye una fuente de proteína en cada comida.\n• Prefiere agua antes que bebidas azucaradas.\n• No saltes comidas para compensar un día malo.',
      actions: [{ label: ctx.dashboard ? 'Ir a Nutrición' : 'Iniciar sesión', href: ctx.dashboard ? '#nutricion' : 'inicio.html' }]
    };
  }

  function answerProgressGeneral(ctx) {
    return {
      text: 'En Progreso ves tu peso actual, cuántos entrenamientos llevas y tu porcentaje de constancia.\n\nRegistra una medición por semana y compara tendencias, no días sueltos.',
      actions: [{ label: ctx.dashboard ? 'Ir a Progreso' : 'Iniciar sesión', href: ctx.dashboard ? '#progreso' : 'inicio.html' }]
    };
  }

  function answerCommunity() {
    return {
      text: 'En Comunidad encuentras el reto de la semana, los miembros activos y tu posición en el ranking.\n\nCompletar el reto es una buena forma de mantener la motivación.'
    };
  }

  function answerBeginner() {
    return {
      text: 'Si estás empezando:\n• Elige rutinas de nivel Principiante.\n• Entrena 2 o 3 días por semana.\n• Prioriza la técnica antes que el peso.\n• Duerme bien y descansa entre sesiones.\n\nLa constancia importa más que la intensidad.'
    };
  }

  function answerPain() {
    return {
      text: 'Si sientes dolor agudo, mareo, falta de aire o molestia en el pecho, detente y consulta a un profesional de la salud.\n\nNovaFit no sustituye una valoración médica. Un dolor muscular leve y pasajero es normal; un dolor articular que aumenta, no.'
    };
  }

  function answerMotivation() {
    return {
      text: 'La constancia gana a la intensidad 💪\n\nNo necesitas una sesión perfecta: necesitas aparecer. Haz 15 minutos aunque no tengas ganas; casi siempre terminarás haciendo más.\n\nRegistra lo que hagas para ver tu avance.'
    };
  }

  function answerPrivacy() {
    return {
      text: 'Tu cuenta está protegida con Supabase Auth y cada usuario solo puede ver sus propios datos.\n\nNunca compartas tu contraseña ni uses la misma en otros sitios. NovaFit no te pedirá tu contraseña por chat.'
    };
  }

  function answerWho() {
    return {
      text: 'Soy Nova, el asistente virtual de NovaFit.\n\nNo soy una persona ni una IA conectada a internet: respondo con la información de la app y de tu cuenta.'
    };
  }

  function answerThanks() {
    return {
      text: '¡Con gusto! Si necesitas algo más, aquí estoy 🌿'
    };
  }

  function answerBye() {
    return {
      text: '¡Nos vemos! Sigue entrenando y recuerda registrar tu progreso 💪'
    };
  }

  function answerHelp() {
    return {
      text: 'Puedo ayudarte con:\n• Tu cuenta: registro, inicio de sesión y contraseña.\n• Rutinas y entrenamientos.\n• Nutrición e hidratación.\n• Progreso y peso.\n• Foto y datos del perfil.'
    };
  }

  function answerFallback() {
    return {
      text: 'No estoy seguro de haber entendido.\n\nPrueba con una pregunta como:\n• ¿Cuál es mi próxima rutina?\n• ¿Cómo voy esta semana?\n• ¿Cómo cambio mi foto?\n\nO elige una opción abajo.'
    };
  }

  /* ------------------------- Reglas ------------------------- */

  var RULES = [
    { keys: ['proxima rutina', 'siguiente rutina', 'rutina de hoy', 'entrenamiento de hoy', 'que entreno hoy', 'que hago hoy', 'que debo entrenar', 'entrenar hoy', 'rutina hoy'], answer: answerNextRoutine },
    { keys: ['racha', 'dias seguidos'], answer: answerStreak },
    { keys: ['meta semanal', 'objetivo semanal', 'meta de la semana', 'cuanto me falta', 'como voy', 'voy esta semana'], answer: answerWeekly },
    { keys: ['hidratacion', 'cuanta agua', 'beber agua', 'agua', 'litros'], answer: answerHydration },
    { keys: ['calorias', 'kcal', 'proteina', 'macros', 'comi'], answer: answerNutrition },
    { keys: ['peso', 'balanza', 'medicion'], answer: answerWeight },
    { keys: ['constancia', 'consistencia'], answer: answerConsistency },
    { keys: ['mis rutinas', 'lista de rutinas', 'que rutinas tengo', 'rutinas tengo', 'rutinas hay'], answer: answerRoutineList },
    { keys: ['completar rutina', 'marcar rutina', 'termine la rutina', 'registrar entrenamiento', 'registrar rutina'], answer: answerCompleteRoutine },
    { keys: ['agregar comida', 'registrar comida', 'anotar comida', 'comida'], answer: answerAddMeal },
    { keys: ['registrar medicion', 'registrar peso', 'agregar peso'], answer: answerMeasurement },
    { keys: ['foto', 'avatar', 'imagen de perfil', 'cambiar foto', 'quitar foto'], answer: answerAvatar },
    { keys: ['editar perfil', 'cambiar nombre', 'mis datos', 'actualizar perfil', 'perfil'], answer: answerProfile },
    { keys: ['crear cuenta', 'creo una cuenta', 'crear una cuenta', 'crear mi cuenta', 'como me registro', 'registrarme', 'registro', 'nueva cuenta', 'hacer cuenta', 'abrir cuenta'], answer: answerSignup },
    { keys: ['olvide', 'contrasena', 'recuperar', 'restablecer', 'reset'], answer: answerForgot },
    { keys: ['iniciar sesion', 'no puedo entrar', 'login', 'acceder', 'entrar'], answer: answerLogin },
    { keys: ['no llega', 'no recibi', 'correo de confirmacion', 'confirmar correo', 'verificar correo', 'spam', 'no me llego'], answer: answerNoEmail },
    { keys: ['gratis', 'precio', 'cuesta', 'costo', 'pagar', 'premium', 'suscripcion'], answer: answerFree },
    { keys: ['que es novafit', 'para que sirve', 'de que trata', 'novafit'], answer: answerAbout },
    { keys: ['nutricion', 'dieta', 'alimentacion', 'alimento'], answer: answerNutritionGeneral },
    { keys: ['progreso', 'avance', 'resultados'], answer: answerProgressGeneral },
    { keys: ['comunidad', 'reto', 'ranking', 'social'], answer: answerCommunity },
    { keys: ['principiante', 'primera vez', 'novato', 'empezar'], answer: answerBeginner },
    { keys: ['dolor', 'lesion', 'duele', 'molestia'], answer: answerPain },
    { keys: ['motivacion', 'desanimado', 'flojera', 'no quiero', 'cansado'], answer: answerMotivation },
    { keys: ['privacidad', 'seguridad', 'mis datos'], answer: answerPrivacy },
    { keys: ['quien eres', 'que eres', 'eres un bot', 'eres humana', 'tu nombre'], answer: answerWho },
    { keys: ['gracias', 'thanks'], answer: answerThanks },
    { keys: ['adios', 'chao', 'hasta luego', 'nos vemos', 'bye'], answer: answerBye },
    { keys: ['ayuda', 'que puedes hacer', 'opciones'], answer: answerHelp },
    { keys: ['rutina', 'ejercicio', 'entrenar', 'entrenamiento', 'gimnasio'], answer: answerRoutines },
    { keys: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'que tal'], answer: function (ctx) { return { text: greeting(ctx) }; } }
  ];

  function normalize(value) {
    var text = String(value || '').toLowerCase();
    if (text.normalize) text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return text.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  for (var index = 0; index < RULES.length; index++) {
    RULES[index]._keys = RULES[index].keys.map(normalize);
  }

  function findAnswer(value) {
    var text = normalize(value);
    var best = null;
    var bestScore = 0;

    for (var i = 0; i < RULES.length; i++) {
      var rule = RULES[i];
      var score = 0;

      for (var j = 0; j < rule._keys.length; j++) {
        if (text.indexOf(rule._keys[j]) !== -1) score += rule._keys[j].length;
      }

      if (score > bestScore) {
        bestScore = score;
        best = rule;
      }
    }

    return best ? best.answer(context()) : answerFallback();
  }

  function greeting(ctx) {
    var hour = new Date().getHours();
    var part = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    var name = ctx.name ? ', ' + ctx.name : '';

    return part + name + '. Soy Nova 🌿, tu asistente virtual.\n\n' +
      'Puedo ayudarte con tu cuenta, tus rutinas, tu nutrición y tu progreso. ¿Sobre qué quieres saber?';
  }

  var DEFAULT_CHIPS = isDashboard()
    ? ['Mi próxima rutina', '¿Cómo voy esta semana?', '¿Cuánta agua debo tomar?', 'Consejos de nutrición']
    : ['¿Cómo creo una cuenta?', 'Olvidé mi contraseña', '¿Qué es NovaFit?', '¿Es gratis?'];

  /* ------------------------- Interfaz ------------------------- */

  var root;
  var panel;
  var messages;
  var chipsBox;
  var input;
  var form;
  var launcher;
  var opened = false;
  var greeted = false;
  var typing = false;

  function build() {
    root = document.createElement('div');
    root.className = 'nova-assistant';
    root.id = 'novaAssistant';

    root.innerHTML = [
      '<div class="nova-assistant-panel" id="novaAssistantPanel" role="dialog" aria-label="Asistente virtual NovaFit">',
      '  <header class="nova-assistant-header">',
      '    <div class="nova-assistant-avatar" aria-hidden="true">🌿</div>',
      '    <div class="nova-assistant-info">',
      '      <strong>Nova · asistente virtual</strong>',
      '      <span class="nova-assistant-status"><i></i> En línea</span>',
      '    </div>',
      '    <button type="button" class="nova-assistant-close" id="novaAssistantClose" aria-label="Cerrar asistente">&times;</button>',
      '  </header>',
      '  <div class="nova-assistant-messages" id="novaAssistantMessages" role="log" aria-live="polite"></div>',
      '  <div class="nova-assistant-chips" id="novaAssistantChips"></div>',
      '  <form class="nova-assistant-form" id="novaAssistantForm">',
      '    <input id="novaAssistantInput" type="text" maxlength="300" autocomplete="off" placeholder="Escribe tu pregunta..." aria-label="Escribe tu mensaje">',
      '    <button type="submit" class="nova-assistant-send" aria-label="Enviar mensaje">',
      '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4Z"></path></svg>',
      '    </button>',
      '  </form>',
      '</div>',
      '<button type="button" class="nova-assistant-launcher" id="novaAssistantLauncher" aria-label="Abrir asistente virtual" aria-expanded="false">',
      '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"></path><path d="M8 9h8"></path><path d="M8 13h5"></path></svg>',
      '  <span class="nova-assistant-badge" aria-hidden="true">1</span>',
      '</button>'
    ].join('');

    body.appendChild(root);
    body.classList.add('has-assistant');

    panel = $('novaAssistantPanel');
    messages = $('novaAssistantMessages');
    chipsBox = $('novaAssistantChips');
    input = $('novaAssistantInput');
    form = $('novaAssistantForm');
    launcher = $('novaAssistantLauncher');

    $('novaAssistantClose').addEventListener('click', close);
    launcher.addEventListener('click', function () {
      if (opened) close();
      else open();
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      send(input.value);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && opened) close();
    });

    setChips(DEFAULT_CHIPS);
  }

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function addMessage(role, text, actions) {
    var bubble = document.createElement('div');
    bubble.className = 'nova-assistant-msg ' + role;

    var content = document.createElement('span');
    content.textContent = text;
    bubble.appendChild(content);

    if (actions && actions.length) {
      var box = document.createElement('div');
      box.className = 'nova-assistant-actions';

      actions.forEach(function (action) {
        var link = document.createElement('a');
        link.className = 'nova-assistant-action';
        link.href = action.href;
        link.textContent = action.label;
        link.addEventListener('click', close);
        box.appendChild(link);
      });

      bubble.appendChild(box);
    }

    messages.appendChild(bubble);
    scrollBottom();
  }

  function showTyping() {
    var bubble = document.createElement('div');
    bubble.className = 'nova-assistant-msg bot';
    bubble.id = 'novaAssistantTyping';
    bubble.innerHTML = '<span class="nova-assistant-typing"><span></span><span></span><span></span></span>';
    messages.appendChild(bubble);
    scrollBottom();
  }

  function hideTyping() {
    var bubble = $('novaAssistantTyping');
    if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
  }

  function send(value) {
    var clean = String(value || '').trim();
    if (!clean || typing) return;

    addMessage('user', clean);
    input.value = '';
    typing = true;
    showTyping();

    var delay = 420 + Math.min(650, clean.length * 10);

    window.setTimeout(function () {
      hideTyping();
      var answer = findAnswer(clean);
      addMessage('bot', answer.text, answer.actions);
      setChips(DEFAULT_CHIPS);
      typing = false;
    }, delay);
  }

  function setChips(labels) {
    chipsBox.innerHTML = '';

    labels.forEach(function (label) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'nova-assistant-chip';
      chip.textContent = label;
      chip.addEventListener('click', function () {
        send(label);
      });
      chipsBox.appendChild(chip);
    });
  }

  function open() {
    opened = true;
    root.classList.add('open');
    launcher.setAttribute('aria-expanded', 'true');

    if (!greeted) {
      greeted = true;
      addMessage('bot', greeting(context()));
    }

    window.setTimeout(function () {
      input.focus();
      scrollBottom();
    }, 120);
  }

  function close() {
    opened = false;
    root.classList.remove('open');
    launcher.setAttribute('aria-expanded', 'false');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
