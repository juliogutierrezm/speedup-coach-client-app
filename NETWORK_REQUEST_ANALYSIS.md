# 🌐 ANÁLISIS DETALLADO DE NETWORK REQUESTS

## OBJETIVO
Capturar y documentar exactamente qué envía y qué devuelve Cognito en cada request del flujo de login.

---

## 📌 SETUP INICIAL

1. Abre DevTools (F12) en tu navegador
2. Ve a la pestaña **Network**
3. Asegúrate de que "Preserve log" esté activado ✅
4. Filtra por **Fetch/XHR** para ver solo requests AJAX
5. Limpia la historia de network (icono papelera)

---

## 🔍 REQUEST 1: INITIATE AUTH (LOGIN)

**Cuándo ocurre:** Después de escribir email y contraseña, hacer clic en "Iniciar Sesión"

### Qué buscar en Network:
En la lista de requests, busca un request que:
- **Nombre:** Algo con `InitiateAuth` o simplemente `_` (un guion)
- **URL:** Cognitodomain.region.amazonaws.com o cloudfront domain
- **Método:** `POST`
- **Status:** `200` (esperado) o `400` / `401` (error)

### Capturar Detalles:

**Headers (pestaña "Headers"):**
```
Host: [anotar]
X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth
Content-Type: application/x-amz-json-1.1
```

**Request Payload (pestaña "Request" o "Payload"):**
```json
{
  "ClientId": "tu_client_id",
  "AuthFlow": "USER_PASSWORD_AUTH",
  "AuthParameters": {
    "USERNAME": "usuario@ejemplo.com",
    "PASSWORD": "contraseña_actual"
  }
}
```

**Anota:**
- [ ] ClientId: `____`
- [ ] USERNAME: `____`
- [ ] AuthFlow: `____`

### Response (pestaña "Response"):

**Si el resultado es NEW_PASSWORD_REQUIRED, verás:**
```json
{
  "ChallengeName": "NEW_PASSWORD_REQUIRED",
  "Session": "very_long_string_here...",
  "ChallengeParameters": {
    "userAttributes": {...},
    "requiredAttributes": ["email", "..."]
  }
  // ⚠️ SIN AuthenticationResult
}
```

**Anota:**
- [ ] ChallengeName: `____`
- [ ] ¿Hay AuthenticationResult? NO (esperado en este punto)
- [ ] Session existe? SÍ (necesario para siguiente request)
- [ ] Status: `____`

**Si hay error (ej: contraseña incorrecta), verás:**
```json
{
  "__type": "NotAuthorizedException",
  "message": "Incorrect username or password."
}
```

**Anota:**
- [ ] Error Type: `____`
- [ ] Error Message: `____`

---

## 🔑 REQUEST 2: RESPOND TO AUTH CHALLENGE (CAMBIO DE CONTRASEÑA)

**Cuándo ocurre:** Después de escribir la nueva contraseña y hacer clic en "Cambiar Contraseña"

### Qué buscar en Network:
Busca un request que:
- **Nombre:** Algo con `RespondToAuthChallenge`
- **URL:** Mismo dominio que Request 1
- **Método:** `POST`
- **Status:** `200` (esperado) o `400` / `500` (error)
- **Aparece DESPUÉS de InitiateAuth**

### Capturar Detalles:

**Headers (pestaña "Headers"):**
```
X-Amz-Target: AWSCognitoIdentityProviderService.RespondToAuthChallenge
Content-Type: application/x-amz-json-1.1
```

**Request Payload (pestaña "Request" o "Payload"):**
```json
{
  "ClientId": "tu_client_id",
  "ChallengeName": "NEW_PASSWORD_REQUIRED",
  "Session": "long_session_string_from_previous_response",
  "ChallengeResponse": {
    "NEW_PASSWORD": "NuevaContraseña123"
  }
}
```

**Anota:**
- [ ] ClientId: `____`
- [ ] ChallengeName: `____`
- [ ] Session: `____` (¿misma que en Request 1?)
- [ ] NEW_PASSWORD: `[password sent]`

### Response (pestaña "Response"):

**ESCENARIO A - ÉXITO (Con tokens):**
```json
{
  "AuthenticationResult": {
    "AccessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "IdToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "RefreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "TokenType": "Bearer",
    "ExpiresIn": 3600
  }
}
```

**Anota:**
- [ ] ¿Hay AuthenticationResult? **SÍ** (crítico)
- [ ] ¿Hay AccessToken? **SÍ**
- [ ] ¿Hay IdToken? **SÍ**
- [ ] ¿Hay RefreshToken? **SÍ**
- [ ] ExpiresIn: `____` segundos
- [ ] Status: `____` (debería ser 200)

**ESCENARIO B - FALLO (Sin tokens pero sin error claro):**
```json
{
  "ChallengeName": "NEW_PASSWORD_REQUIRED",
  "Session": "different_session_string",
  "ChallengeParameters": {...}
  // ⚠️ Todavía dice que falta NEW_PASSWORD
}
```

**Anota:**
- [ ] ¿Sigue pidiendo NEW_PASSWORD? **SÍ** (❌ rojo flag)
- [ ] ¿Se actualizó Session? **SÍ** (indica rechazo parcial)

**ESCENARIO C - ERROR EXPLÍCITO:**
```json
{
  "__type": "InvalidPasswordException",
  "message": "Password did not conform to policy: ..."
}
```

**Anota:**
- [ ] Error Type: `____`
- [ ] Error Message: `____`

---

## 🔄 REQUEST 3+: POST-AUTHENTICATION (OPCIONAL)

**Cuándo ocurre:** Inmediatamente después de RespondToAuthChallenge en el código frontend

### Qué esperar:

**El código llama a `fetchAuthSession()`, que podría generar:**
- **GetUser** (para verificar estado del usuario)
- **IntrospectToken** (para validar tokens)
- Nada (si Amplify solo usa tokens en localStorage)

### Si ocurre GetUser:

**Request:**
```json
{
  "AccessToken": "eyJ..."  // Token del Request anterior
}
```

**Response:**
```json
{
  "Username": "usuario@ejemplo.com",
  "UserAttributes": [
    { "Name": "email", "Value": "usuario@ejemplo.com" },
    { "Name": "cognito:groups", "Value": "Client" },
    { "Name": "sub", "Value": "uuid-here" },
    ...
  ]
}
```

**Anota:**
- [ ] ¿Hay UserAttributes? SÍ / NO
- [ ] ¿Incluye cognito:groups? SÍ / NO
- [ ] ¿Dice "Client"? SÍ / NO
- [ ] Status: `____`

---

## 🎯 TABLA DE CORRELACIÓN: ESPERAR vs OBSERVAR

| Paso | Request | Espera Payload | Espera Response | ¿Observó? | ¿Status OK? | ¿Tiene Tokens? |
|------|---------|---|---|---|---|---|
| Login | InitiateAuth | USER_PASSWORD_AUTH | ChallengeName: NEW_PASSWORD_REQUIRED | SÍ / NO | `____` | NO (esperado) |
| Change Pass | RespondToAuthChallenge | NEW_PASSWORD: xxx | AuthenticationResult + tokens | SÍ / NO | `____` | SÍ / NO |
| Post-Auth | GetUser (?) | AccessToken | UserAttributes + groups | SÍ / NO | `____` | N/A |

---

## 🔐 DECODIFICAR TOKENS JWT (PARA VERIFICAR CONTENIDO)

Si quieres ver qué contiene el AccessToken o IdToken, puedes:

### Opción 1: Usar jwt.io (No recomendado para datos sensibles)
1. Copia el token del Response
2. Ve a https://jwt.io
3. Pega en "Encoded"
4. Lee el JSON en "Decoded"

⚠️ **ADVERTENCIA:** jwt.io es un sitio público. Mejor usar opción 2.

### Opción 2: Usar consola del navegador
En DevTools Console, pega:
```javascript
// Función para decodificar JWT sin enviarlo a servidores
function decodeJWT(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

// Copia el IdToken del Response y pega aquí:
const idToken = "eyJ..."; 
console.log(decodeJWT(idToken));
```

**Anota qué ves en el payload:**
- [ ] `sub`: `____`
- [ ] `email`: `____`
- [ ] `cognito:groups`: `____`
- [ ] `email_verified`: `____`
- [ ] `custom:role`: `____` (si existe)

---

## 🚨 TABLA DE DIAGNÓSTICO

| Síntoma | Posible Causa | Qué Verificar |
|---------|--------------|---------------|
| RespondToAuthChallenge devuelve 200 PERO sin AuthenticationResult | Sesión expirada o rechazada | ¿Session string es igual? |
| RespondToAuthChallenge devuelve AuthenticationResult PERO frontend no se autentica | Tokens válidos pero `cognito:groups` no incluye "Client" | Decodifica IdToken, mira `cognito:groups` |
| RespondToAuthChallenge devuelve error `InvalidPasswordException` | Contraseña no cumple política | ¿Tiene mayúscula, minúscula, número? |
| RespondToAuthChallenge devuelve error `ChallengeMismatchException` | Session string incorrecto o expirado | ¿Session es la del InitiateAuth? |
| Request 2 no aparece en Network | Frontend no está llamando confirmSignIn | Verifica logs [DEBUG] en Console |

---

## 💾 RESULTADO DEL ANÁLISIS

Una vez captures toda esta información, responde:

**1. ¿RespondToAuthChallenge devolvió AuthenticationResult?**
- [ ] SÍ → Cognito otorgó tokens
- [ ] NO → Cognito rechazó el cambio de contraseña

**2. ¿Los tokens en Response incluyen grupos?**
- [ ] SÍ → Decodifica y verifica si tiene "Client"
- [ ] NO → IdToken no tiene claim `cognito:groups`

**3. ¿Hay un Request 3 (GetUser / GetAttributes)?**
- [ ] SÍ → Status y qué devolvió
- [ ] NO → Frontend solo confía en tokens anteriores

**4. ¿En qué punto exacto el flow se detiene?**
- [ ] En InitiateAuth (error login)
- [ ] En RespondToAuthChallenge (error cambio contraseña)
- [ ] Después (frontend rechaza aunque tokens existan)

---

**Próximo paso:** Correlacionar esto con los logs [DEBUG] en Console y documentar hallazgos principales.

