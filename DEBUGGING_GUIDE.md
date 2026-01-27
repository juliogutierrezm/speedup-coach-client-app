# 🎯 GUÍA INTEGRAL DE DEBUGGING - COGNITO LOGIN FLOW

## RESUMEN EJECUTIVO

Esta es una guía **paso a paso** para hacer debugging observable del flujo de Cognito WITHOUT cambiar código.

### Lo que ya se hizo:
✅ Agregados logs `[DEBUG]` en el código (temporal)
✅ Instrumentados todos los puntos críticos del flow

### Qué necesitas hacer tú:
1. Leer y entender estos documentos
2. Ejecutar el flujo completo observando logs y Network
3. Documentar lo que observas
4. Reportar hallazgos exactos

---

## 📚 DOCUMENTOS DE REFERENCIA

Abre estos en orden:

### 1. [DEBUG_COGNITO_FLOW.md](./DEBUG_COGNITO_FLOW.md)
**Paso 1 → Paso 5 del flujo**
- Qué logs esperar en Console
- Qué anotar en cada punto
- Tabla de correlación frontend vs network

### 2. [NETWORK_REQUEST_ANALYSIS.md](./NETWORK_REQUEST_ANALYSIS.md)
**Análisis detallado de Network tab**
- Qué buscar en cada request
- Cómo decodificar tokens
- Tabla de diagnóstico

### 3. [COGNITO_CONSOLE_CHECKLIST.md](./COGNITO_CONSOLE_CHECKLIST.md)
**Validación en AWS Console (sin cambios)**
- User Status antes/después
- Grupos del usuario
- Cambios en Last Updated

---

## ⏱️ TIEMPO ESTIMADO

- **Lectura completa:** 20 minutos
- **Ejecución del flujo:** 5 minutos
- **Documentación de hallazgos:** 10 minutos
- **TOTAL:** ~35 minutos

---

## 🎬 CHECKLIST RÁPIDO

Antes de empezar:

- [ ] Acceso a la aplicación (usuario de test disponible)
- [ ] Acceso a AWS Console / Cognito
- [ ] VS Code o navegador de texto para anotar
- [ ] DevTools abierto (F12)
- [ ] Network tab listo
- [ ] Console limpia

---

## 🔄 FLUJO DE EJECUCIÓN

### Fase 1: SETUP (5 min)
1. Limpia logs en Console
2. Abre Network y activa "Preserve log"
3. Abre AWS Cognito Console en otra pestaña
4. Busca el usuario de test en Cognito
5. **Anota estado ACTUAL del usuario** (sección 2 de COGNITO_CONSOLE_CHECKLIST)

### Fase 2: EJECUTAR FLOW (10 min)
1. En la app, ejecuta LOGIN
2. Observa logs [DEBUG] en Console
3. Observa requests en Network
4. Ejecuta CAMBIO DE CONTRASEÑA
5. Observa logs posteriores y requests adicionales
6. **Copia todo lo que veas** (logs + network requests)

### Fase 3: VALIDAR EN COGNITO (5 min)
1. En AWS Console, ACTUALIZA la página del usuario
2. **Anota NUEVO estado** (sección 4 de COGNITO_CONSOLE_CHECKLIST)
3. Compara antes vs después

### Fase 4: CONSOLIDAR REPORTE (10 min)
1. Completa la sección "RESULTADO FINAL" en DEBUG_COGNITO_FLOW.md
2. Completa tablas en NETWORK_REQUEST_ANALYSIS.md
3. Completa tabla de resumen en COGNITO_CONSOLE_CHECKLIST.md
4. Escribe conclusión en sección "HALLAZGOS PRINCIPALES"

---

## 🚨 INDICADORES CRÍTICOS

Durante la ejecución, busca específicamente:

### ✅ INDICADOR GREEN (Flujo funciona)
```
RespondToAuthChallenge Response:
{
  "AuthenticationResult": {
    "AccessToken": "...",
    "IdToken": "...",
    "RefreshToken": "..."
  }
}
```
Y además:
```
[DEBUG] ✅ finalizeLogin | Setting authenticated state
[DEBUG] ✅ completeNewPassword SUCCESS
```

### ❌ INDICADOR RED 1 (Sin tokens)
```
RespondToAuthChallenge Response:
{
  "ChallengeName": "NEW_PASSWORD_REQUIRED",
  "Session": "..."
}
// ⚠️ NO hay AuthenticationResult
```
→ Cognito rechazó la respuesta al desafío

### ❌ INDICADOR RED 2 (Tokens pero sin grupos)
```
[DEBUG] ❌ finalizeLogin | User NOT in Client group | groups: []
```
→ IdToken no tiene `cognito:groups` o no incluye "Client"

### ❌ INDICADOR RED 3 (User Status no cambió)
```
Cognito Console:
Antes: User Status = FORCE_CHANGE_PASSWORD
Después: User Status = FORCE_CHANGE_PASSWORD  ← No cambió
```
→ Cognito no registró como completado el cambio

---

## 📋 TEMPLATE PARA TU REPORTE

Al terminar, documenta en un archivo `DEBUGGING_RESULTS.md`:

```markdown
# DEBUGGING RESULTS - Cognito Login Flow

## A. COGNITO DEVUELVE TOKENS?
- RespondToAuthChallenge Status: ____
- ¿Hay AuthenticationResult? SÍ / NO
- ¿Hay IdToken? SÍ / NO
- ¿Hay AccessToken? SÍ / NO

## B. FRONTEND ASUME AUTENTICACIÓN?
- completeNewPassword resolvió: SÍ / NO
- finalizeLogin se ejecutó: SÍ / NO
- fetchAuthSession devolvió tokens: SÍ / NO
- Usuario fue marcado como autenticado: SÍ / NO

## C. PUNTO EXACTO DE RUPTURA

### Si no hay tokens en RespondToAuthChallenge:
- Request fue enviado correctamente? SÍ / NO
- Payload incluía Session correcto? SÍ / NO
- ¿Qué error devolvió Cognito? ____

### Si hay tokens pero no se autentica:
- Tokens en Response: ✅
- IdToken tiene cognito:groups? SÍ / NO
- Usuario está en grupo Client? SÍ / NO
- User Status en Cognito cambió? SÍ / NO

## D. LOGS COMPLETOS

[Copia aquí TODOS los logs [DEBUG] de Console]

## E. REQUESTS EN NETWORK

### InitiateAuth
- Status: ____
- Response: `{ ChallengeName: "...", Session: "..." }`

### RespondToAuthChallenge
- Status: ____
- Response: `{ AuthenticationResult: {...} }` o error?

### Otros requests:
- ¿GetUser? SÍ / NO
- ¿IntrospectToken? SÍ / NO
- ¿Otros? ____

## F. CONCLUSIÓN

"El flujo se rompe en [PUNTO EXACTO] porque [RAZÓN ESPECÍFICA]"

Ejemplo:
"El flujo se rompe en RespondToAuthChallenge porque Cognito devuelve
 ChallengeName: NEW_PASSWORD_REQUIRED nuevamente (no acepta el cambio).
 Posible causa: contraseña no cumple política."

O:

"El flujo se rompe en finalizeLogin porque el IdToken no contiene el claim
 'cognito:groups', o el usuario no está en el grupo 'Client'. El frontend
 ejecuta signOut() automáticamente."
```

---

## 🎯 PREGUNTAS QUE RESPONDERÁ ESTE DEBUGGING

Después de completar todo, tendrás respuesta clara a:

1. **¿Cognito devuelve tokens después del cambio de contraseña?**
   - Dónde exactamente (InitiateAuth, RespondToAuthChallenge, otro)
   - En qué formato
   - Con qué claims/grupos

2. **¿Por qué el frontend no queda autenticado?**
   - ¿No hay tokens en absoluto?
   - ¿Hay tokens pero están "incompletos"?
   - ¿Frontend rechaza tokens válidos?

3. **¿Qué espera el frontend que Cognito no está haciendo?**
   - ¿Falta un claim específico?
   - ¿Falta asociación a grupo?
   - ¿Falta cambio de User Status?

4. **¿En qué exactamente se diferencia Cognito vs lo que el frontend espera?**
   - Request que falta
   - Response que es incompleta
   - Claim que falta en token
   - User Status que no cambió

---

## 🔗 CÓMO ESTO AYUDA A LA SIGUIENTE FASE

Una vez tengas este reporte claro:

- **Si falta claim/grupo:** Sabemos que hay que agregar atributos en Cognito o en User Pool settings
- **Si User Status no cambia:** Hay que verificar trigger Lambda o configuración de auto-confirm
- **Si Cognito no devuelve tokens:** El RespondToAuthChallenge no está siendo procesado correctamente
- **Si todo funciona en Cognito pero frontend rechaza:** Hay que ajustar la lógica de validación en `finalizeLogin()`

**Con este debugging, la solución será CLARA y ESPECÍFICA.**

---

## ✅ NEXT STEPS

1. **Lee en orden:** DEBUG_COGNITO_FLOW → NETWORK_REQUEST_ANALYSIS → COGNITO_CONSOLE_CHECKLIST
2. **Ejecuta el flujo** siguiendo instrucciones
3. **Anota todo observado**
4. **Documenta hallazgos** en DEBUGGING_RESULTS.md
5. **Comparte resultados** para análisis final

---

## ⚠️ RECUERDA

- **NO cambies nada** en el código o en Cognito Console
- **Solo observa y documenta**
- **Sé específico:** no "no funciona", sino "RespondToAuthChallenge devolvió X"
- **Incluye logs completos:** cópialo tal cual de Console
- **Captura network requests:** expande Request y Response para ver detalles

---

**Tiempo total estimado:** 35 minutos
**Resultado esperado:** Reporte claro de dónde y por qué se rompe el flujo

¡Adelante!

