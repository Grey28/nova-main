# Integración de Supabase en NovaFit

Esta guía explica cómo conectar el frontend de NovaFit con Supabase como backend.

## 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com> y crea una cuenta.
2. Crea un proyecto nuevo (por ejemplo `novafit`).
3. Guarda la contraseña de la base de datos que te pide Supabase.

## 2. Crear las tablas y políticas

1. En el panel del proyecto ve a **SQL Editor**.
2. Abre el archivo `supabase/schema.sql` de este repositorio.
3. Copia todo su contenido, pégalo en el editor y pulsa **Run**.

Esto crea:

- `profiles`: perfil de cada usuario.
- `routines`: rutinas de entrenamiento.
- `workouts`: entrenamientos completados.
- `nutrition_logs`: comidas, calorías, proteína y agua.
- `progress_entries`: medidas de peso y grasa corporal.

También activa **RLS** (Row Level Security) para que cada usuario solo pueda ver y modificar sus propios datos, y crea un perfil con tres rutinas iniciales cada vez que alguien se registra.

## 3. Configurar las credenciales del frontend

1. En Supabase ve a **Project Settings > API**.
2. Copia:
   - **Project URL**
   - **anon public key**
3. Abre `frontend/js/supabase-config.js` y reemplaza los placeholders:

```js
window.NOVAFIT_SUPABASE = {
  url: 'https://tu-proyecto.supabase.co',
  anonKey: 'tu-anon-key'
};
```

> La `anon key` es pública y está pensada para usarse en el navegador.
> **Nunca** coloques la `service_role key` en el frontend.

## 4. Configurar las URLs de autenticación

En Supabase ve a **Authentication > URL Configuration**:

- **Site URL**: `http://localhost:5500`
- **Redirect URLs**:
  - `http://localhost:5500/frontend/**`
  - `http://localhost:5500/**`

Si vas a publicar el sitio, agrega también la URL real del dominio.

## 5. Configurar el correo de recuperación

NovaFit usa un código de 6 dígitos para recuperar la contraseña. Para que Supabase lo envíe:

1. Ve a **Authentication > Email Templates > Reset Password**.
2. Incluye la variable `{{ .Token }}` en el mensaje. Por ejemplo:

```html
<h2>Restablece tu contraseña de NovaFit</h2>
<p>Tu código de verificación es: <strong>{{ .Token }}</strong></p>
<p>También puedes usar este enlace: <a href="{{ .ConfirmationURL }}">Restablecer contraseña</a></p>
```

El enlace de `{{ .ConfirmationURL }}` redirige a `verifcodigo.html`, así que ambos caminos funcionan.

Si solo quieres probar rápido, también puedes desactivar la confirmación de correo en **Authentication > Providers > Email > Confirm email**.

## 6. Ejecutar el proyecto

Los archivos usan scripts clásicos por CDN, así que puedes abrirlos directamente; aun así, se recomienda servir el proyecto por HTTP para que las redirecciones de autenticación funcionen bien.

Desde la carpeta que contiene `frontend/` y `style/`:

```bash
cd nova-main/nova-main
python -m http.server 5500
```

Luego abre:

```text
http://localhost:5500/frontend/index.html
```

También puedes usar la extensión **Live Server** de VS Code sobre la carpeta del proyecto.

## 7. Probar el flujo

1. Abre `registro.html` y crea una cuenta.
2. Confirma el correo si la confirmación está activa.
3. Inicia sesión en `inicio.html`.
4. El dashboard redirige a `inicio.html` si no hay sesión activa.
5. En el dashboard puedes:
   - Ver y editar tu perfil.
   - Completar rutinas (registra entrenamientos).
   - Agregar comidas y calorías.
   - Registrar tu peso.
6. “Cerrar sesión” elimina la sesión de Supabase.

## Archivos de la integración

```text
frontend/js/supabase-config.js   -> URL y anon key
frontend/js/supabase-client.js   -> crea el cliente window.novaDb
frontend/js/auth.js              -> login, registro, recuperación y nueva contraseña
frontend/js/dashboard.js         -> sesión, perfil y datos del dashboard
supabase/schema.sql              -> tablas, índices, triggers y políticas RLS
style/auth.css                   -> mensajes y avisos de autenticación
```

## 8. Publicar en GitHub Pages

El repositorio incluye el workflow `.github/workflows/deploy-pages.yml`, que publica `frontend/` y `style/` mediante GitHub Actions.

1. En GitHub ve a **Settings > Pages**.
2. En **Build and deployment > Source**, selecciona **GitHub Actions**.
3. Haz push a la rama `main` o ejecuta el workflow manualmente desde **Actions**.

La URL del sitio será:

```text
https://grey28.github.io/nova-main/
```

Después de publicar, actualiza en Supabase **Authentication > URL Configuration**:

- **Site URL**: `https://grey28.github.io/nova-main/`
- **Redirect URLs**:
  - `https://grey28.github.io/nova-main/frontend/**`
  - `http://localhost:5500/frontend/**` (para desarrollo local)

Así funcionarán el registro, la confirmación por correo y la recuperación de contraseña tanto en local como en producción.
