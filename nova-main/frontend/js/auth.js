/**
 * Autenticación de NovaFit con Supabase.
 * Se carga en las páginas de login, registro, recuperación y nueva contraseña.
 */
(function () {
  'use strict';

  var db = window.novaDb;
  var page = document.body.getAttribute('data-page');

  var ERROR_MESSAGES = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed': 'Debes confirmar tu correo antes de iniciar sesión.',
    'User already registered': 'Ya existe una cuenta con este correo.',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
    'New password should be different from the old password': 'La nueva contraseña debe ser diferente a la anterior.',
    'Email rate limit exceeded': 'Supabase alcanzó el límite de correos. Espera aproximadamente una hora o configura un servidor SMTP propio.',
    'Error sending confirmation email': 'No se pudo enviar el correo de confirmación. Revisa la configuración SMTP de Supabase: host, puerto, usuario, clave y remitente verificado.',
    'Error sending recovery email': 'No se pudo enviar el correo de recuperación. Revisa la configuración SMTP de Supabase.',
    'Error sending email': 'No se pudo enviar el correo. Revisa la configuración SMTP de Supabase.',
    'For security purposes, you can only request this once every 60 seconds': 'Por seguridad, espera 60 segundos antes de volver a intentarlo.',
    'Token has expired or is invalid': 'El código expiró o no es válido. Solicita uno nuevo.',
    'Auth session missing!': 'La sesión de recuperación expiró. Solicita un nuevo código.',
    'User not found': 'No encontramos una cuenta con ese correo.'
  };

  var ERROR_CODES = {
    over_email_send_rate_limit: 'Supabase alcanzó el límite de correos. Espera aproximadamente una hora o configura un servidor SMTP propio.',
    over_request_rate_limit: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
    email_not_confirmed: 'Debes confirmar tu correo antes de iniciar sesión.',
    user_already_exists: 'Ya existe una cuenta con este correo.',
    weak_password: 'La contraseña es demasiado débil. Usa al menos 6 caracteres.'
  };

  function translateError(error) {
    if (!error) return 'Ocurrió un error inesperado.';
    if (error.code && ERROR_CODES[error.code]) return ERROR_CODES[error.code];

    var message = error.message || String(error);
    var lower = message.toLowerCase();

    for (var key in ERROR_MESSAGES) {
      if (key.toLowerCase() === lower) return ERROR_MESSAGES[key];
    }

    return message;
  }

  function getMessageBox() {
    var box = document.querySelector('.auth-message');
    if (box) return box;

    var form = document.querySelector('form');
    if (!form || !form.parentNode) return null;

    box = document.createElement('p');
    box.className = 'auth-message';
    form.parentNode.insertBefore(box, form);
    return box;
  }

  function showMessage(text, type) {
    var box = getMessageBox();
    if (!box) return;
    box.textContent = text;
    box.setAttribute('data-type', type || 'error');
    box.hidden = false;
  }

  function clearMessage() {
    var box = document.querySelector('.auth-message');
    if (!box) return;
    box.hidden = true;
    box.textContent = '';
  }

  function setLoading(form, loading, label) {
    var button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (!button.getAttribute('data-original-label')) {
      button.setAttribute('data-original-label', button.textContent.trim());
    }

    button.disabled = loading;
    button.textContent = loading
      ? (label || 'Procesando...')
      : button.getAttribute('data-original-label');
  }

  function redirect(path) {
    window.location.href = path;
  }

  function requireSupabase() {
    if (window.NOVAFIT_CONFIGURED && db) return true;

    showMessage(
      'Supabase no está configurado. Abre frontend/js/supabase-config.js y coloca tu URL y tu anon key.',
      'error'
    );
    document.querySelectorAll('form button[type="submit"]').forEach(function (button) {
      button.disabled = true;
    });
    return false;
  }

  function redirectIfLoggedIn() {
    if (!db) return;
    db.auth.getSession().then(function (result) {
      if (result.data && result.data.session) {
        redirect('dashboard.html#inicio');
      }
    });
  }

  function initLogin() {
    var form = document.getElementById('loginForm');
    if (!form) return;

    redirectIfLoggedIn();

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearMessage();
      if (!requireSupabase()) return;

      var email = document.getElementById('loginEmail').value.trim();
      var password = document.getElementById('loginPassword').value;

      setLoading(form, true, 'Iniciando sesión...');
      var result = await db.auth.signInWithPassword({ email: email, password: password });
      setLoading(form, false);

      if (result.error) {
        showMessage(translateError(result.error), 'error');
        return;
      }

      redirect('dashboard.html#inicio');
    });
  }

  function initRegister() {
    var form = document.getElementById('registerForm');
    if (!form) return;

    redirectIfLoggedIn();

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearMessage();
      if (!requireSupabase()) return;

      var fullName = document.getElementById('registerName').value.trim();
      var email = document.getElementById('registerEmail').value.trim();
      var password = document.getElementById('registerPassword').value;

      if (password.length < 6) {
        showMessage('La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
      }

      setLoading(form, true, 'Creando cuenta...');
      var result = await db.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.NOVAFIT_BASE_URL + 'inicio.html'
        }
      });
      setLoading(form, false);

      if (result.error) {
        showMessage(translateError(result.error), 'error');
        return;
      }

      if (result.data && result.data.session) {
        redirect('dashboard.html#inicio');
        return;
      }

      showMessage(
        'Cuenta creada. Revisa tu correo y confirma tu cuenta para poder iniciar sesión.',
        'success'
      );
      form.reset();
    });
  }

  function initRecover() {
    var form = document.getElementById('recoverForm');
    if (!form) return;

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearMessage();
      if (!requireSupabase()) return;

      var email = document.getElementById('recoverEmail').value.trim();

      setLoading(form, true, 'Enviando...');
      var result = await db.auth.resetPasswordForEmail(email, {
        redirectTo: window.NOVAFIT_BASE_URL + 'verifcodigo.html'
      });
      setLoading(form, false);

      if (result.error) {
        showMessage(translateError(result.error), 'error');
        return;
      }

      sessionStorage.setItem('novafit_recovery_email', email);
      showMessage(
        'Si el correo está registrado, enviamos un código de recuperación. Revisa tu bandeja de entrada.',
        'success'
      );
      form.reset();
      setTimeout(function () { redirect('codigo.html'); }, 1800);
    });
  }

  function initCode() {
    var form = document.getElementById('codeForm');
    if (!form) return;

    var inputs = Array.prototype.slice.call(
      document.querySelectorAll('#codeInputs input')
    );

    inputs.forEach(function (input, index) {
      input.addEventListener('input', function () {
        input.value = input.value.replace(/\D/g, '').slice(0, 1);
        if (input.value && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      input.addEventListener('keydown', function (event) {
        if (event.key === 'Backspace' && !input.value && index > 0) {
          inputs[index - 1].focus();
        }
      });

      input.addEventListener('paste', function (event) {
        var clipboard = event.clipboardData || window.clipboardData;
        var text = clipboard ? clipboard.getData('text').replace(/\D/g, '').slice(0, 6) : '';
        if (!text) return;

        event.preventDefault();
        text.split('').forEach(function (character, position) {
          if (inputs[position]) inputs[position].value = character;
        });
        inputs[Math.min(text.length, inputs.length - 1)].focus();
      });
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearMessage();
      if (!requireSupabase()) return;

      var email = sessionStorage.getItem('novafit_recovery_email');
      var token = inputs.map(function (input) { return input.value.trim(); }).join('');

      if (token.length !== 6) {
        showMessage('Escribe los 6 dígitos del código.', 'error');
        return;
      }

      if (!email) {
        showMessage('No encontramos el correo de recuperación. Vuelve a solicitar el código.', 'error');
        return;
      }

      setLoading(form, true, 'Verificando...');
      var result = await db.auth.verifyOtp({
        email: email,
        token: token,
        type: 'recovery'
      });
      setLoading(form, false);

      if (result.error) {
        showMessage(translateError(result.error), 'error');
        return;
      }

      showMessage('Código verificado. Ahora crea tu nueva contraseña.', 'success');
      setTimeout(function () { redirect('verifcodigo.html'); }, 800);
    });
  }

  function initReset() {
    var form = document.getElementById('resetForm');
    if (!form) return;

    if (db) {
      db.auth.getSession().then(function (result) {
        if (!result.data || !result.data.session) {
          showMessage(
            'El enlace o código expiró. Solicita uno nuevo desde "Recuperar contraseña".',
            'error'
          );
        }
      });
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearMessage();
      if (!requireSupabase()) return;

      var password = document.getElementById('newPassword').value;
      var confirmation = document.getElementById('confirmPassword').value;

      if (password.length < 6) {
        showMessage('La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
      }

      if (password !== confirmation) {
        showMessage('Las contraseñas no coinciden.', 'error');
        return;
      }

      setLoading(form, true, 'Guardando...');
      var result = await db.auth.updateUser({ password: password });

      if (result.error) {
        setLoading(form, false);
        showMessage(translateError(result.error), 'error');
        return;
      }

      await db.auth.signOut();
      showMessage('Contraseña actualizada. Redirigiendo al inicio de sesión...', 'success');
      setTimeout(function () { redirect('inicio.html'); }, 1500);
    });
  }

  var initializers = {
    login: initLogin,
    register: initRegister,
    recover: initRecover,
    'verify-code': initCode,
    'reset-password': initReset
  };

  if (!requireSupabase()) return;

  var initialize = initializers[page];
  if (typeof initialize === 'function') initialize();
})();
