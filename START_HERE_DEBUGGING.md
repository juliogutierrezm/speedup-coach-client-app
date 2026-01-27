# 🔍 SETUP DE DEBUGGING - RESUMEN EJECUTIVO

## ✅ QUÉ SE HA HECHO

Se han instrumentado **logs observacionales** en el código sin cambiar la lógica:

### 1. **auth.service.ts** - Puntos de instrumentación:

✅ **signIn()**
- LOG: Inicio con email
- LOG: Resultado de signIn (qué devolvió)
- LOG: Si detectó NEW_PASSWORD_REQUIRED

✅ **completeNewPassword()**
- LOG: Inicio con estado pendiente
- LOG: Antes de llamar confirmSignIn
- LOG: Resultado de confirmSignIn
- LOG: Estado de fetchAuthSession POST-confirmSignIn
- LOG: Detalles de IdToken (claims, grupos, expiry)
- LOG: Si hubo error

✅ **finalizeLogin()** (CRÍTICO)
- LOG: Inicio
- LOG: Tokens disponibles (cuáles)
- LOG: Grupos extraídos del IdToken
- LOG: Verificación de grupo "Client"
- LOG: Usuario obtenido y perfil construido
- LOG: Marcado como autenticado

✅ **checkAuthState()**
- LOG: Inicio
- LOG: Si hay tokens
- LOG: Usuario y grupos
- LOG: Si se marcó como autenticado

### 2. **change-password.component.ts** - Puntos de instrumentación:

✅ **onSubmit()**
- LOG: Inicio (validez de formulario)
- LOG: Antes de llamar completeNewPassword
- LOG: Si completeNewPassword resolvió
- LOG: Si hubo error
- LOG: Navegación a /plans

---

## 📊 LOGS QUE VERÁS

```
[DEBUG] 🔹 signIn START | email: usuario@ejemplo.com
[DEBUG] ✅ signIn RESULT | nextStep: CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED
[DEBUG] 🔑 NEW_PASSWORD_REQUIRED detected

[DEBUG] 🎬 onSubmit START | form valid: true
[DEBUG] 📤 onSubmit | Calling authService.completeNewPassword
[DEBUG] 🔑 completeNewPassword START
[DEBUG] 📤 confirmSignIn CALL
[DEBUG] ✅ confirmSignIn RESULT
[DEBUG] 📊 Session before finalizeLogin | hasIdToken: true | hasAccessToken: true
[DEBUG] 📋 ID Token Claims: { sub: "...", email: "...", groups: ["Client"], tokenExpiry: ... }
[DEBUG] 📌 finalizeLogin START
[DEBUG] 🔎 finalizeLogin | groups extracted: ["Client"]
[DEBUG] ✅ finalizeLogin | Setting authenticated state
[DEBUG] ✅ completeNewPassword SUCCESS
```

---

## 🌐 REQUESTS A OBSERVAR EN NETWORK

### Request 1: InitiateAuth
```
POST /api/... 
Payload: { ClientId, Username, Password, AuthFlow: "USER_PASSWORD_AUTH" }
Response: { ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "...", ... }
```

### Request 2: RespondToAuthChallenge
```
POST /api/...
Payload: { ClientId, ChallengeName, Session, ChallengeResponse: { NEW_PASSWORD: "..." } }
Response: { AuthenticationResult: { AccessToken, IdToken, RefreshToken } } ← CRÍTICO
```

### Request 3+ (Opcional): GetUser, IntrospectToken, etc.

---

## 📋 DOCUMENTOS CREADOS PARA AYUDARTE

| Archivo | Propósito |
|---------|-----------|
| [DEBUG_COGNITO_FLOW.md](./DEBUG_COGNITO_FLOW.md) | Paso a paso del flujo: qué esperar en Console y Network |
| [NETWORK_REQUEST_ANALYSIS.md](./NETWORK_REQUEST_ANALYSIS.md) | Análisis detallado de cada request: payload, response, tokens |
| [COGNITO_CONSOLE_CHECKLIST.md](./COGNITO_CONSOLE_CHECKLIST.md) | Validación en AWS: User Status, grupos, cambios |
| [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) | Guía integral: cómo usar todo junto |

---

## 🎯 INSTRUCCIONES PARA EJECUTAR EL DEBUGGING

### Tiempo: 35 minutos

#### PASO 1: LECTURA (5 min)
1. Lee [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) - Resumen ejecutivo
2. Abre en pestañas los otros 3 documentos para referencia

#### PASO 2: SETUP (5 min)
1. Abre la app en un navegador
2. Abre DevTools (F12)
3. Abre AWS Cognito Console en otra pestaña
4. Ve a Users and Groups
5. Busca el usuario de test
6. **Anota el User Status ACTUAL** (ej: FORCE_CHANGE_PASSWORD)

#### PASO 3: EJECUTAR FLOW (10 min)
**En la aplicación:**
1. Inicia sesión (email + contraseña)
2. Deberías ver pantalla de cambio de contraseña

**En DevTools Console:**
- Verás logs [DEBUG] 🔹
- Anota qué dice exactamente

**En DevTools Network:**
- Mira InitiateAuth request/response
- Anota status y si tiene ChallengeName

**En la aplicación:**
3. Escribe nueva contraseña
4. Haz clic en "Cambiar Contraseña"

**En DevTools Console:**
- Verás logs [DEBUG] 📤 de confirmSignIn
- Anota resultado

**En DevTools Network:**
- Mira RespondToAuthChallenge request/response
- ⚠️ CRÍTICO: ¿Hay AuthenticationResult en response?
- Anota exactamente qué contiene

**En AWS Cognito Console:**
5. Actualiza la página del usuario (F5)
6. **Anota el User Status NUEVO** (¿cambió?)

#### PASO 4: DOCUMENTAR (10 min)
Completa la tabla "RESULTADO FINAL DEL DEBUGGING" en [DEBUG_COGNITO_FLOW.md](./DEBUG_COGNITO_FLOW.md)

Específicamente, responde:
- ¿RespondToAuthChallenge devolvió AuthenticationResult? **SÍ / NO**
- ¿El IdToken contiene cognito:groups? **SÍ / NO**
- ¿El usuario está en grupo Client? **SÍ / NO**
- ¿El User Status en Cognito cambió? **SÍ / NO**
- ¿En qué exacto punto se detiene el flujo? **[DESCRIBE AQUÍ]**

---

## 🚨 INDICADORES PARA SABER SI FUNCIONA O NO

### ✅ TODO OK - El flujo funciona:
```
1. RespondToAuthChallenge Status: 200
2. Response incluye AuthenticationResult con tokens ✅
3. [DEBUG] ✅ finalizeLogin | Setting authenticated state ✅
4. [DEBUG] ✅ completeNewPassword SUCCESS ✅
5. Usuario es marcado como autenticado ✅
6. Navega a /plans ✅
7. Cognito User Status cambió a CONFIRMED ✅
```

### ❌ PROBLEMA - Sin tokens:
```
RespondToAuthChallenge Status: 200
Response: { ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "..." }
⚠️ NO hay AuthenticationResult
→ Cognito no aceptó el cambio de contraseña
```

### ❌ PROBLEMA - Tokens pero sin grupo:
```
[DEBUG] ❌ finalizeLogin | User NOT in Client group | groups: []
→ IdToken no tiene claim 'cognito:groups'
→ Frontend ejecuta signOut()
```

### ❌ PROBLEMA - User Status no cambió:
```
Antes: FORCE_CHANGE_PASSWORD
Después: FORCE_CHANGE_PASSWORD ← No cambió
→ Cognito no registró cambio como exitoso
```

---

## 💡 QUÉ SE APRENDERÁ

Al terminar este debugging, tendrás clara:

**PREGUNTA 1:** ¿Cognito devuelve tokens después del cambio?
- **RESPUESTA ESPERADA:** "Sí, en RespondToAuthChallenge hay AuthenticationResult con [tipo de tokens]"
- **O:** "No, RespondToAuthChallenge devuelve [error/challenge pendiente]"

**PREGUNTA 2:** ¿Por qué no queda autenticado el usuario?
- **RESPUESTA ESPERADA:** "Porque el IdToken no contiene cognito:groups" 
- **O:** "Porque Cognito rechaza el cambio de contraseña"
- **O:** "Porque User Status no cambió a CONFIRMED"

**PREGUNTA 3:** ¿Qué asumiría el frontend que está en Cognito?
- **RESPUESTA ESPERADA:** "El frontend asume que IdToken tiene claim cognito:groups con 'Client'"
- **O:** "El frontend asume que Cognito marca el usuario como CONFIRMED"

---

## 📝 NOTAS IMPORTANTES

- ✅ **Sin cambios:** Solo logs temporales, sin modificar lógica
- ✅ **Reversible:** Los logs pueden quitarse después
- ✅ **Observable:** Todos los logs son específicos y nombrados con [DEBUG]
- ❌ **No es solución:** Esto SOLO muestra dónde está el problema
- ❌ **No modifica Cognito:** Solo observa estado

---

## 🎬 COMIENZA AQUÍ

1. Lee [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) para contexto completo
2. Abre los 3 documentos de referencia:
   - [DEBUG_COGNITO_FLOW.md](./DEBUG_COGNITO_FLOW.md)
   - [NETWORK_REQUEST_ANALYSIS.md](./NETWORK_REQUEST_ANALYSIS.md)
   - [COGNITO_CONSOLE_CHECKLIST.md](./COGNITO_CONSOLE_CHECKLIST.md)
3. Ejecuta el flujo siguiendo instrucciones
4. Documenta hallazgos
5. **Comparte resultados para análisis final**

---

**Tiempo total: 35 minutos**
**Resultado: Reporte claro de por qué falla el flujo de autenticación**

¡Adelante! 🚀

