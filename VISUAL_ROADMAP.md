# 📊 DEBUGGING COGNITO FLOW - ROADMAP VISUAL

## 🎯 OBJETIVO FINAL
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Entender EXACTAMENTE qué está pasando en el flujo de       │
│  Cognito cuando el usuario cambia contraseña                │
│                                                              │
│  SIN cambiar código, sin cambiar Cognito, solo observar    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📈 FLUJO ESPERADO (VS ACTUAL)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO ESPERADO (✅)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuario inicia sesión                                      │
│     ↓                                                           │
│  2. Cognito responde: NEW_PASSWORD_REQUIRED                   │
│     ↓                                                           │
│  3. Usuario cambia contraseña                                  │
│     ↓                                                           │
│  4. Cognito devuelve AuthenticationResult (con tokens) ✅     │
│     ↓                                                           │
│  5. Frontend extrae usuario y grupos del token                │
│     ↓                                                           │
│  6. Frontend valida que usuario esté en grupo "Client" ✅     │
│     ↓                                                           │
│  7. Usuario queda autenticado ✅                              │
│     ↓                                                           │
│  8. App navega a /plans ✅                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   FLUJO ACTUAL (❌ SE ROMPE)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuario inicia sesión ✅                                  │
│     ↓                                                           │
│  2. Cognito responde: NEW_PASSWORD_REQUIRED ✅                │
│     ↓                                                           │
│  3. Usuario cambia contraseña ✅                              │
│     ↓                                                           │
│  4. Aquí se rompe ❌                                          │
│     ├─ ¿Cognito no devuelve tokens?                           │
│     ├─ ¿Tokens sin grupos?                                    │
│     ├─ ¿Usuarios no en grupo Client?                          │
│     └─ ¿Frontend rechaza aunque tokens sean válidos?          │
│     ↓                                                           │
│  5. Usuario NO queda autenticado ❌                           │
│     ↓                                                           │
│  6. App se queda en change-password ❌                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 PUNTOS DE OBSERVACIÓN CLAVE

```
┌─────────────────────────────────────────────────────────────────┐
│                  PUNTO 1: initSignIn()                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOG:  [DEBUG] 🔹 signIn START | email: usuario@ejemplo.com   │
│        [DEBUG] ✅ signIn RESULT | nextStep: ...               │
│        [DEBUG] 🔑 NEW_PASSWORD_REQUIRED detected              │
│                                                                 │
│  NETWORK: POST /api/...                                        │
│           Request:  { Username, Password, ... }               │
│           Response: { ChallengeName: "NEW_PASSWORD_REQUIRED",  │
│                       Session: "...",                          │
│                       ... }                                    │
│                                                                 │
│  VALIDAR: ✅ Usuario puede iniciar sesión                    │
│           ✅ Cognito devuelve desafío                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            PUNTO 2: completeNewPassword() [CRÍTICO]             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOG:  [DEBUG] 📤 confirmSignIn CALL                           │
│        [DEBUG] ✅ confirmSignIn RESULT                        │
│        [DEBUG] 📊 Session before finalizeLogin                │
│        [DEBUG] 📋 ID Token Claims:                            │
│                   { sub: \"...\",                            │
│                     email: \"...\",                          │
│                     groups: [\"Client\"],  ← CRÍTICO         │
│                     ... }                                      │
│                                                                 │
│  NETWORK: POST /api/...                                        │
│           Request:  { ChallengeName: \"NEW_PASSWORD_REQUIRED\",│
│                       Session: \"...\",                        │
│                       ChallengeResponse: { NEW_PASSWORD: ... } │
│                     }                                          │
│           Response: { AuthenticationResult: {  ← CRÍTICO       │
│                         AccessToken: \"...\",                │
│                         IdToken: \"...\",                    │
│                         RefreshToken: \"...\"                │
│                       }                                        │
│                     }                                          │
│                                                                 │
│  VALIDAR: ❓ ¿Hay AuthenticationResult?                      │
│           ❓ ¿IdToken tiene cognito:groups?                  │
│           ❓ ¿Groups contiene \"Client\"?                    │
│                                                                 │
│  RIESGO MÁXIMO: Este es el punto donde ocurre el problema    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│           PUNTO 3: finalizeLogin() [SEGUNDA CRÍTICA]            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOG:  [DEBUG] 📌 finalizeLogin START                          │
│        [DEBUG] 🔎 finalizeLogin | groups extracted: [...]    │
│        [DEBUG] ✅ finalizeLogin | Setting authenticated state │
│              O                                                  │
│        [DEBUG] ❌ finalizeLogin | User NOT in Client group    │
│                                                                 │
│  CÓDIGO CRÍTICO:                                               │
│        if (!groups.includes('Client')) {                      │
│          await this.signOut();  ← ❌ RECHAZA                 │
│          throw new Error('NOT_CLIENT');                       │
│        }                                                        │
│                                                                 │
│  VALIDAR: ✅ Grupos fueron extraídos correctamente            │
│           ✅ Contienen \"Client\"                             │
│           ✅ Frontend no rechaza                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│        PUNTO 4: AWS Cognito Console [VALIDACIÓN FINAL]          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ANTES:  User Status = FORCE_CHANGE_PASSWORD                  │
│          Groups: []                                            │
│                                                                 │
│  DESPUÉS: User Status = CONFIRMED  ← ¿Cambió?                 │
│           Groups: [\"Client\"]  ← ¿Aparece?                  │
│                                                                 │
│  VALIDAR: El cambio de contraseña fue aceptado por Cognito   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 CHECKLIST DE OBSERVACIÓN

```
┌──────────────────────────────────────────────────────────────┐
│  COGNITO RESPONDE REQUESTS?                                  │
├──────────────────────────────────────────────────────────────┤
│  □ InitiateAuth se ejecutó                                   │
│  □ RespondToAuthChallenge se ejecutó                         │
│  □ Otro (cuál): ___________________________                  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  COGNITO DEVUELVE TOKENS?                                    │
├──────────────────────────────────────────────────────────────┤
│  □ Sí, en RespondToAuthChallenge                             │
│  □ Sí, pero en otro lugar (cuál): __________________         │
│  □ No, RespondToAuthChallenge devolvió: ______________       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  TOKENS CONTIENEN INFORMACIÓN?                               │
├──────────────────────────────────────────────────────────────┤
│  □ AccessToken: sí / no                                      │
│  □ IdToken: sí / no                                          │
│  □ IdToken tiene cognito:groups: sí / no                    │
│  □ cognito:groups contiene \"Client\": sí / no              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  FRONTEND ACEPTA TOKENS?                                     │
├──────────────────────────────────────────────────────────────┤
│  □ completeNewPassword resolvió: sí / no                    │
│  □ finalizeLogin se ejecutó: sí / no                        │
│  □ Usuario marcado autenticado: sí / no                     │
│  □ App navegó a /plans: sí / no                             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  COGNITO CONFIRMA CAMBIO?                                    │
├──────────────────────────────────────────────────────────────┤
│  □ User Status cambió a CONFIRMED: sí / no                  │
│  □ Usuario asignado a grupo Client: sí / no                 │
│  □ Last Login se actualizó: sí / no                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 DIAGNÓSTICO RÁPIDO

```
┌────────────────────────────────────────────────────────────┐
│                    ¿DÓNDE ESTÁ EL PROBLEMA?                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  A. RespondToAuthChallenge devolvió ERROR                 │
│     └─ CAUSA: Cognito rechaza el cambio de contraseña    │
│     └─ SOLUCIÓN: Revisar Cognito User Pool settings      │
│                                                            │
│  B. RespondToAuthChallenge devolvió ChallengeName         │
│     (sin AuthenticationResult)                             │
│     └─ CAUSA: Cognito no acepta la respuesta             │
│     └─ SOLUCIÓN: Revisar formato de ChallengeResponse    │
│                                                            │
│  C. Hay AuthenticationResult PERO sin cognito:groups     │
│     └─ CAUSA: Cognito no mapea grupos en tokens         │
│     └─ SOLUCIÓN: Configurar User Pool para incluir grupos│
│                                                            │
│  D. Hay cognito:groups PERO sin \"Client\"              │
│     └─ CAUSA: Usuario no está en grupo Client           │
│     └─ SOLUCIÓN: Asignar usuario a grupo Client         │
│                                                            │
│  E. Todo existe PERO [DEBUG] finalizeLogin falla         │
│     └─ CAUSA: Frontend rechaza aunque tokens sean OK     │
│     └─ SOLUCIÓN: Revisar lógica de validación en código │
│                                                            │
│  F. Cognito acepta PERO User Status no cambió           │
│     └─ CAUSA: Cognito no procesa NEW_PASSWORD_REQUIRED  │
│     └─ SOLUCIÓN: Revisar Lambda trigger o auto-confirm  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 CÓMO INTERPRETAR LOS DATOS

```
┌─────────────────────────────────────────────────────────────┐
│                ESCENARIO 1: TODO FUNCIONA ✅                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. initSignIn() devuelve NEW_PASSWORD_REQUIRED      ✅   │
│  2. RespondToAuthChallenge Status: 200               ✅   │
│  3. Response contiene AuthenticationResult           ✅   │
│  4. IdToken tiene cognito:groups                     ✅   │
│  5. cognito:groups contiene \"Client\"               ✅   │
│  6. [DEBUG] finalizeLogin SUCCESS                    ✅   │
│  7. [DEBUG] navigating to /plans                     ✅   │
│  8. Cognito User Status cambió a CONFIRMED           ✅   │
│                                                             │
│  CONCLUSIÓN: El flujo funciona correctamente              │
│  ACCIÓN: No hay que hacer nada                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│          ESCENARIO 2: SIN TOKENS EN RESPONSE ❌            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. initSignIn() devuelve NEW_PASSWORD_REQUIRED      ✅   │
│  2. RespondToAuthChallenge Status: 200               ✅   │
│  3. Response: { ChallengeName: \"...\", Session: \"...\" } ❌ │
│     (Sin AuthenticationResult)                             │
│  4. [DEBUG] completeNewPassword ERROR               ❌   │
│                                                             │
│  CONCLUSIÓN: Cognito no acepta el cambio de contraseña    │
│  CAUSA PROBABLE: Error en Cognito Pool o User Attributes │
│  ACCIÓN: Investigar por qué RespondToAuthChallenge        │
│          rechaza la respuesta                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│       ESCENARIO 3: SIN cognito:groups EN TOKEN ❌          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. RespondToAuthChallenge devuelve tokens          ✅   │
│  2. accessToken existe                              ✅   │
│  3. idToken existe                                  ✅   │
│  4. [DEBUG] ID Token Claims: { groups: [] }        ❌   │
│     (Vacío, sin claim cognito:groups)                     │
│  5. [DEBUG] finalizeLogin | groups: []              ❌   │
│  6. [DEBUG] User NOT in Client group                ❌   │
│                                                             │
│  CONCLUSIÓN: IdToken no contiene cognito:groups          │
│  CAUSA PROBABLE: Cognito User Pool no mapea grupos        │
│  ACCIÓN: Configurar Cognito para incluir grupos en tokens│
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│     ESCENARIO 4: User Status no cambió en Cognito ❌      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Frontend reporta: completNewPassword SUCCESS    ✅   │
│  2. Tokens fueron devueltos por Cognito             ✅   │
│  3. Pero en Cognito Console:                               │
│     ANTES: User Status = FORCE_CHANGE_PASSWORD           │
│     DESPUÉS: User Status = FORCE_CHANGE_PASSWORD    ❌   │
│     (No cambió)                                            │
│                                                             │
│  CONCLUSIÓN: Cognito no registró como completo el        │
│              cambio de contraseña                          │
│  CAUSA PROBABLE: Lambda trigger no procesa correctamente  │
│  ACCIÓN: Revisar Cognito User Pool settings para         │
│          auto-confirm de NEW_PASSWORD_REQUIRED           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎬 TIMELINE ESPERADO DE EJECUCIÓN

```
Tiempo:     Actividad:                      Esperas:
────────────────────────────────────────────────────────
 0:00      Abres la aplicación
           └─ Pantalla de login

 0:30      Escribes email y contraseña
           └─ Haz clic en \"Iniciar Sesión\"

 1:00      Observas logs [DEBUG] 🔹 signIn START
           └─ Deberías ver NEW_PASSWORD_REQUIRED

 2:00      Escribes nueva contraseña
           └─ Haz clic en \"Cambiar Contraseña\"

 2:30      Observas logs [DEBUG] 📤 confirmSignIn CALL
           └─ Esperas más logs

 3:00      Observas logs [DEBUG] ✅ finalizeLogin OK
           O logs [DEBUG] ❌ finalizeLogin ERROR
           ├─ SI OK: App navega a /plans ✅
           └─ SI ERROR: App se queda en change-password ❌

 5:00      Actualizas Cognito Console
           └─ Comparas User Status (antes vs después)

10:00      Terminas recolección de datos
           └─ Tienes todos los logs anotados

15:00      Completas template de reporte
           └─ Documento: DEBUGGING_RESULTS.md

────────────────────────────────────────────────────────
 TOTAL:    ~35 minutos para debugging + reporte
```

---

## 📞 PRÓXIMO PASO

```
┌──────────────────────────────────────────────────┐
│  ABRIR: START_HERE_DEBUGGING.md                  │
│                                                  │
│  • Lee sección \"CHECKLIST RÁPIDO\"             │
│  • Lee sección \"FLUJO DE EJECUCIÓN\" (4 fases)│
│  • Tendrás 35 minutos para terminar            │
└──────────────────────────────────────────────────┘
```

---

**El debugging está 100% listo. Solo necesitas ejecutarlo.** 🚀

