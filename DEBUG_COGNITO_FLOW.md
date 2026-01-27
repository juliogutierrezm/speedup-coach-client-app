# 🔍 DEBUGGING COGNITO LOGIN FLOW

## OBJETIVO
Rastrear exactamente qué ocurre en cada paso del flujo de login y cambio de contraseña.

---

## 📋 LISTA DE VERIFICACIÓN - OBSERVACIÓN PASO A PASO

### PASO 1: ABRIR DEVTOOLS Y LIMPIAR LOGS
```
1. Abre DevTools (F12)
2. Ve a Console y limpia los logs (escriba clear())
3. Ve a Network y limpia la historia
4. Asegúrate de estar en la pestaña de Network tab
```

### PASO 2: INICIAR SESIÓN (LOGIN)

**En Console, verás logs como:**
```
[DEBUG] 🔹 signIn START | email: usuario@ejemplo.com
[DEBUG] ✅ signIn RESULT | nextStep: CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED | full result: { ... }
[DEBUG] 🔑 NEW_PASSWORD_REQUIRED detected | email: usuario@ejemplo.com
```

**Qué verificar en Network:**
- **Request 1: InitiateAuth**
  - Endpoint: `/` (Cognito endpoint)
  - Payload: `{ ClientId, Username, Password, AuthFlow: "USER_PASSWORD_AUTH" }`
  - Response Status: `200`
  - Response: `{ ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "...", ... }`
  - ⚠️ **IMPORTANTE:** ¿Hay `AuthenticationResult` en la response? (Tokens)
  
**Anota:**
- [ ] InitiateAuth se ejecutó
- [ ] Status de response: `____`
- [ ] ¿Devolvió AuthenticationResult? SÍ / NO
- [ ] ChallengeName: `____`

---

### PASO 3: CAMBIAR CONTRASEÑA

**En formulario, completa:**
- Nueva contraseña (ej: NuevaPass123)
- Confirmar contraseña

**Haz click en "Cambiar Contraseña"**

**En Console, verás logs como:**
```
[DEBUG] 🎬 onSubmit START | form valid: true | passwordsMatch: true
[DEBUG] 📤 onSubmit | Calling authService.completeNewPassword
[DEBUG] 🔑 completeNewPassword START | pendingChallenge: NEW_PASSWORD_REQUIRED | pendingEmail: usuario@ejemplo.com
[DEBUG] 📤 confirmSignIn CALL | challengeResponse: [password]
[DEBUG] ✅ confirmSignIn RESULT: { ... }
[DEBUG] → Checking fetchAuthSession BEFORE finalizeLogin
[DEBUG] 📊 Session before finalizeLogin | hasIdToken: true/false | hasAccessToken: true/false
```

**Qué verificar en Network:**
- **Request 2: RespondToAuthChallenge**
  - Endpoint: `/` (Cognito endpoint)
  - Payload: `{ ClientId, ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "...", ChallengeResponse: { "NEW_PASSWORD": "..." } }`
  - Response Status: `200`
  - Response: `{ AuthenticationResult: { AccessToken, IdToken, RefreshToken } }` ← **CRÍTICO**
  - ⚠️ **IMPORTANTE:** ¿Hay `AuthenticationResult` con tokens?

**Anota:**
- [ ] RespondToAuthChallenge se ejecutó
- [ ] Status de response: `____`
- [ ] ¿Devolvió AuthenticationResult con tokens? SÍ / NO
  - [ ] AccessToken: YES / NO
  - [ ] IdToken: YES / NO
  - [ ] RefreshToken: YES / NO

---

### PASO 4: VERIFICAR ESTADO DESPUÉS DEL CAMBIO

**En Console, verás logs como:**
```
[DEBUG] 📊 Session before finalizeLogin | hasIdToken: true | hasAccessToken: true
[DEBUG] 📋 ID Token Claims: {
  sub: "xxxxxxxx",
  email: "usuario@ejemplo.com",
  groups: ["Client"],
  tokenExpiry: 2026-01-26T...
}
[DEBUG] → calling finalizeLogin from completeNewPassword
[DEBUG] 📌 finalizeLogin START
[DEBUG] 📊 finalizeLogin | session tokens: { hasIdToken: true, hasAccessToken: true, hasRefreshToken: true }
[DEBUG] 🔎 finalizeLogin | groups extracted: ["Client"]
[DEBUG] 👤 finalizeLogin | getCurrentUser result | userId: xxxxxxxx | username: usuario@ejemplo.com
[DEBUG] ✅ finalizeLogin | Setting authenticated state | user: usuario@ejemplo.com | role: client
[DEBUG] ✅ completeNewPassword SUCCESS | authState: { authenticated: true, ... }
[DEBUG] 🎬 onSubmit START | ... Navigating to /plans
```

**En caso de ERROR, verás:**
```
[DEBUG] ❌ completeNewPassword ERROR: { name: "NOT_CLIENT", message: "..." }
[DEBUG] ❌ finalizeLogin | User NOT in Client group | groups: []
```

**Qué verificar en Network:**
- **Request 3 (Opcional): GetUser o introspect**
  - ¿Hay algún request adicional después de RespondToAuthChallenge?
  - ¿Qué endpoint es?

**Anota:**
- [ ] fetchAuthSession después de confirmSignIn devolvió tokens: SÍ / NO
- [ ] ID Token tiene grupos: `____`
- [ ] finalizeLogin se ejecutó exitosamente: SÍ / NO
- [ ] El usuario fue marcado como autenticado: SÍ / NO

---

### PASO 5: NAVEGACIÓN A PLANES

**En Console:**
```
[DEBUG] 📍 onSubmit | Navigating to /plans
```

**Esperado:** La app navega a `/plans` y carga datos del usuario

**Si NO ocurre:** Verás error en console o se queda en change-password

**Anota:**
- [ ] Navegación a /plans ocurrió: SÍ / NO
- [ ] Página cargó correctamente: SÍ / NO / BLANK
- [ ] ¿Hay errores en console? CUÁLES:

---

## 🔗 CORRELACIÓN NETWORK vs LOGS

**Completa esta tabla mientras haces el flujo:**

| Paso | Request | Status | ¿Tokens en Response? | Log Frontend | Resultado |
|------|---------|--------|---------------------|--------------|-----------|
| Login | InitiateAuth | `___` | SÍ / NO | `🔑 NEW_PASSWORD_REQUIRED` | OK / ERROR |
| Change Pass | RespondToAuthChallenge | `___` | SÍ / NO | `✅ confirmSignIn RESULT` | OK / ERROR |
| Finalize | (¿Cuál?) | `___` | SÍ / NO | `✅ finalizeLogin SUCCESS` | OK / ERROR |

---

## 🚨 SEÑALES DE ALERTA (QUÉ BUSCAR)

1. **RespondToAuthChallenge devuelve Status 200 PERO:**
   - ❌ Sin `AuthenticationResult`
   - ❌ Con `ChallengeName` todavía
   - ❌ Con `Session` todavía

2. **Tokens en Response PERO:**
   - ❌ `hasIdToken: false` en fetchAuthSession posterior
   - ❌ Cognito Console muestra User Status != "CONFIRMED"

3. **finalizeLogin FALLA porque:**
   - ❌ Grupos no incluyen "Client"
   - ❌ No se puede obtener usuario
   - ❌ ID Token no tiene claims

4. **RespondToAuthChallenge devuelve ERROR:**
   - ❌ `InvalidPasswordException`
   - ❌ `InvalidParameterException`
   - ❌ `ChallengeMismatchException`

---

## 📊 VALIDACIÓN EN COGNITO CONSOLE

**SIN CAMBIAR NADA**, ve a:
```
AWS Console → Cognito → User Pools → [Tu Pool]
→ Users and Groups → [Tu usuario]
```

**Anota ANTES del cambio de contraseña:**
- [ ] User Status: `____` (UNCONFIRMED / CONFIRMED / FORCE_CHANGE_PASSWORD / etc)
- [ ] Enabled: ✅ / ❌
- [ ] Email Verified: ✅ / ❌

**Anota DESPUÉS del cambio de contraseña:**
- [ ] User Status: `____` (¿cambió?)
- [ ] Enabled: ✅ / ❌
- [ ] Email Verified: ✅ / ❌
- [ ] Attributes: identidades asociadas

**En la pestaña "Groups":**
- [ ] ¿Usuario pertenece a "Client"? SÍ / NO
- [ ] ¿Qué grupos tiene? `____`

---

## 💾 RESULTADO FINAL DEL DEBUGGING

Una vez hayas seguido todos los pasos, documenta:

### A. ¿COGNITO DEVUELVE TOKENS EN ALGÚN PUNTO?
- **SÍ** → En RespondToAuthChallenge devolvió `AuthenticationResult` con AccessToken + IdToken
- **NO** → Cognito nunca devolvió tokens

### B. ¿EN QUÉ PASO EL FRONTEND ASUME AUTENTICACIÓN?
- En `completeNewPassword` → llama a `fetchAuthSession()`
- En `finalizeLogin` → intenta extraer grupos del IdToken
- En `onSubmit` del componente → cuando se navega a `/plans`

### C. ¿QUÉ REQUEST NO OCURRE Y DEBERÍA OCURRIR?
- Falta InitiateAuth: ❌
- Falta RespondToAuthChallenge: ❌
- Falta otro (cuál): `____`

### D. ¿DÓNDE EXACTAMENTE SE ROMPE?
Describe el punto exacto con:
- Request que falla / devuelve datos incorrectos
- Qué espera el frontend
- Qué devuelve Cognito
- Resultado: App se queda en change-password / error específico

---

## 🎯 EJEMPLO DE REPORTE COMPLETADO

```
A. ¿COGNITO DEVUELVE TOKENS?
   → SÍ, en RespondToAuthChallenge hay AuthenticationResult con tokens

B. ¿DÓNDE ASUME FRONTEND AUTENTICACIÓN?
   → En finalizeLogin, cuando intenta extraer grupos del IdToken

C. ¿QUÉ REQUEST FALTA?
   → Ninguno, todos los requests ocurren

D. ¿DÓNDE SE ROMPE?
   → En finalizeLogin, el IdToken NO tiene claim 'cognito:groups'
     o el usuario NO está en grupo 'Client'
     → La app ejecuta signOut() y lanza error "NOT_CLIENT"
     → Usuario se desautentica
```

---

**PRÓXIMO PASO:** Una vez tengas este reporte completo, compartir los hallazgos para decidir la solución.

