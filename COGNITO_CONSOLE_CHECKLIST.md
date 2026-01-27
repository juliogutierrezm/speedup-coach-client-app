# 🔐 VALIDACIÓN EN AWS COGNITO CONSOLE

## OBJETIVO
Observar el estado del usuario en Cognito ANTES y DESPUÉS del cambio de contraseña, sin hacer cambios.

---

## 📍 ACCESO A COGNITO CONSOLE

1. Ve a [AWS Console](https://console.aws.amazon.com/)
2. Busca **Cognito** en la barra de búsqueda
3. Haz clic en **Cognito**
4. Selecciona **User Pools**
5. Haz clic en tu Pool (probablemente algo como `speedup-pool` o similar)

---

## 📋 INFORMACIÓN REQUERIDA ANTES DE EMPEZAR

Para poder ubicar tu pool, anota primero:

**De `aws-exports.ts` en el proyecto:**
```typescript
// Busca en src/aws-exports.ts:
aws_user_pools_id = "region_poolid"
aws_user_pools_web_client_id = "clientid"
```

**Region:** `____` (ej: `us-east-1`)
**User Pool ID:** `____` (ej: `us-east-1_abcd1234`)
**Client ID:** `____`

---

## 🔍 PASO 1: UBICAR AL USUARIO EN COGNITO

Una vez dentro de tu User Pool:

1. Haz clic en **Users and Groups** (en el menú izquierdo)
2. Deberías ver una lista de usuarios
3. Busca el usuario que vamos a usar para el test (ej: `usuario@ejemplo.com`)
4. Haz clic en el usuario para abrir su detalle

---

## 📊 PASO 2: DOCUMENTAR ESTADO ANTES DEL CAMBIO

**Captura pantalla o anota estos datos:**

### Sección "General Settings"
- **Username:** `____`
- **User Status:** `____`
  - ¿Es **CONFIRMED**? ✅ / ❌
  - ¿Es **FORCE_CHANGE_PASSWORD**? ✅ / ❌
  - ¿Es **UNCONFIRMED**? ✅ / ❌
  - ¿Es otro? `____`

### Sección "Account Status"
- **Enabled:** ✅ / ❌
- **MFA required:** ✅ / ❌

### Sección "Email Verification"
- **Email:** `____`
- **Email Verified:** ✅ / ❌

### Sección "Groups"
En la pestaña **Groups** (o si hay un campo "User Groups"):
- ¿Pertenece a algún grupo? SÍ / NO
- Si SÍ, ¿cuáles?
  - [ ] Client
  - [ ] Trainer
  - [ ] Admin
  - [ ] Otro: `____`

---

## 🔐 PASO 3: EJECUTAR EL FLUJO DE CAMBIO DE CONTRASEÑA

**EN EL NAVEGADOR (cambiar de pestaña/ventana):**

1. Abre la aplicación
2. Login con `usuario@ejemplo.com` y contraseña actual
3. Deberías ver pantalla de "Cambiar Contraseña"
4. **En otra pestaña, manteniendo Cognito Console abierto:**
   - Abre DevTools (F12) en la pestaña de la app
   - Ve a Console y copia los logs de [DEBUG]
   - Ve a Network tab y observa los requests
   - Completa el cambio de contraseña

**Anota los logs de Console:**
```
[Copia aquí todos los logs [DEBUG]]
```

**Observa Network requests:**
- Request 1 (InitiateAuth): 
  - Status: `____`
  - ¿Devolvió ChallengeName? `____`

- Request 2 (RespondToAuthChallenge):
  - Status: `____`
  - ¿Devolvió AuthenticationResult? SÍ / NO
  - (Amplía la request y abre la pestaña "Response" para ver los detalles)

---

## 📊 PASO 4: DOCUMENTAR ESTADO DESPUÉS DEL CAMBIO

**Regresa a la pestaña de Cognito Console INMEDIATAMENTE DESPUÉS** del cambio (antes de cerrar la app).

**Actualiza la página** (o navega nuevamente al usuario si se cerró):
1. **Users and Groups** → busca el mismo usuario

**Anota los NUEVOS valores:**

### Sección "General Settings"
- **User Status:** `____` (¿CAMBIÓ?)
  - Antes: `____`
  - Después: `____`
  - ¿Es diferente? SÍ / NO

### Sección "Account Status"
- **Enabled:** ✅ / ❌ (¿cambió?)
- **MFA required:** ✅ / ❌

### Sección "Email Verification"
- **Email Verified:** ✅ / ❌ (¿cambió?)

### Sección "Groups"
- ¿Sigue perteneciendo a "Client"? SÍ / NO
- ¿Agregó o removió grupos? `____`

---

## 🔑 PASO 5: VERIFICAR ÚLTIMO CAMBIO DE CONTRASEÑA

En Cognito Console, busca en el usuario:

**Last Updated:** `____` (¿Dice hace poco?)
**Last Login:** `____` (¿Dice después del cambio?)

---

## 🎯 TABLA DE RESUMEN

| Campo | Antes del Cambio | Después del Cambio | ¿Cambió? |
|-------|------------------|--------------------|----------|
| User Status | `____` | `____` | SÍ / NO |
| Enabled | ✅ / ❌ | ✅ / ❌ | SÍ / NO |
| Email Verified | ✅ / ❌ | ✅ / ❌ | SÍ / NO |
| Groups | `____` | `____` | SÍ / NO |
| Last Updated | `____` | `____` | SÍ / NO |

---

## 🚨 SEÑALES DE ALERTA

### RED FLAG 1: User Status NO cambió a CONFIRMED
```
Antes: FORCE_CHANGE_PASSWORD
Después: FORCE_CHANGE_PASSWORD ← ❌ NO CAMBIÓ
```
→ Cognito NO reconoció el cambio de contraseña

### RED FLAG 2: El usuario NO está en grupo "Client"
```
Groups: [Empty] ← ❌
```
→ Por eso `finalizeLogin` falla con "NOT_CLIENT"

### RED FLAG 3: Last Login es viejo (antes del cambio)
```
Last Login: 2026-01-25 10:30 ← ❌ (hace más de 1 hora)
```
→ Cognito NO registró un login exitoso después del cambio

---

## 📋 CHECKLIST FINAL DE VALIDACIÓN

- [ ] Accedí a Cognito Console
- [ ] Ubicué al usuario correcto
- [ ] Documenté estado ANTES del cambio
- [ ] Ejecuté el flujo de cambio de contraseña
- [ ] Observé logs en DevTools Console
- [ ] Observé requests en Network tab
- [ ] Regresé a Cognito Console inmediatamente
- [ ] Documenté estado DESPUÉS del cambio
- [ ] Identifiqué si algo cambió (User Status, Groups, etc.)

---

## 💾 RESULTADO

Una vez termines, responde:

**1. ¿El User Status cambió de FORCE_CHANGE_PASSWORD a CONFIRMED?**
- SÍ → Cognito reconoció el cambio
- NO → El flujo NEW_PASSWORD_REQUIRED no está funcionando bien

**2. ¿El usuario está en grupo "Client"?**
- SÍ → Debería poder autenticarse
- NO → Por eso el frontend rechaza (error NOT_CLIENT)

**3. ¿El Last Login se actualizó con el timestamp del cambio de contraseña?**
- SÍ → Hubo un login exitoso
- NO → El usuario no se autenticó completamente

---

**Importante:** NO hagas cambios en Cognito Console. Solo observa y documenta.

