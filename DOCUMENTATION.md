# SpeedUp Coach Client App

## Proposito del repositorio
Esta aplicacion cliente en Angular 19 ofrece la interfaz principal que ve un `Client` cuando trabaja con planes, sesiones y ejercicios asignados desde el backend central de SpeedUp Coach. Esta configurada para correr con Server Side Rendering (SSR) y autenticacion gestionada por AWS Amplify + Cognito, y aterriza sobre un API Gateway que expone los datos de clientes y temas.

## Tecnologias y librerias clave
- **Angular 19** con modulos standalone y SSR (`src/app`, `src/server.ts`).
- **AWS Amplify (Cognito)** para login, sesiones y atributos de usuario (`src/aws-exports.ts`, `src/app/services/auth.service.ts`).
- **Express + @angular/ssr** para servir la app renderizada en `dist/speedup-coach-client` y manejar rutas universales (`src/server.ts`).
- **RxJS** y patrones reactivos para cache de datos y estados compartidos (`BehaviorSubject`, `shareReplay`, `Subject`).
- **Tailwind/PostCSS** en `styles.scss` y `tailwind.config.js` para utilidades visuales.

## Rutas, autenticacion y layout
- `src/app/app.routes.ts` monta las rutas publicas (`/login`, `/callback`, `/unauthorized`) y anida `clientRoutes` debajo de `ClientLayoutComponent`.
- `AuthGuard` (`src/app/guards/auth.guard.ts`) valida la sesion antes de activar las rutas y fuerza el redirect al Hosted UI cuando hace falta.
- `AuthInterceptor` (`src/app/interceptors/auth.interceptor.ts`) adjunta el `Authorization: Bearer <token>` a cada llamada que toca `environment.apiBase` y evita tocar assets o endpoints publicos.
- `ClientLayoutComponent` (`src/app/layout/client-layout.component.ts`) carga temas por tenant, expone controles de drawer, muestra mensajes de estado y llama a `AuthService.signOut()`.

## Servicios de datos y tema
- `AuthService` gestiona el estado del usuario (`UserProfile`, roles `ADMIN`, `TRAINER`, `CLIENT`), refresca el token desde Amplify y expone helpers sincronicos para guards.
- `ClientDataService` es la unica fuente del backend para el perfil y los planes (`/clients`). Normaliza sesiones/planificaciones y cachea el resultado con `shareReplay(1)`.
- `ThemeService` consulta `/tenant/theme`, aplica tokens CSS al `<html>` y ofrece helpers para cargar logos prefirmados y guardar la configuracion del tenant.

## Experiencia del cliente
- **Planes (`/plans`)**: `ClientPlansComponent` lista los planes asignados, muestra numero de sesiones y abre `/plans/:planId`.
- **Detalle de plan**: `ClientPlanDetailComponent` muestra sesiones con contadores, musculos y progresiones, y navega a `/session/:index`.
- **Sesion**: `ClientSessionExercisesComponent` renderiza ejercicios ordenados, detecta superseries/circuitos, soporta accesibilidad y abre los detalles o el video del ejercicio.
- **Ejercicio**: `ClientExerciseDetailComponent` expone descripciones, tips y musculos secundarios; tambien ofrece un boton para ir al video asociado.
- **Video**: `ClientExerciseVideoComponent` reproduce el `preview_url`, `gif_url` o `thumbnail` de cada ejercicio en una vista dedicada.
- **Perfil**: `ClientProfileComponent` muestra nombre, edad calculada, lesiones listadas y nombre del entrenador.

Cada componente depende de `ClientDataService` y sigue patrones de carga (`isLoading`, `errorMessage`, `finalize`) para ofrecer estados consistentes.

## Utilidades compartidas
- `session-exercise.utils.ts` define `SessionExercise` y helpers (`flattenSessionItems`, `getSessionExerciseCount`, `hasFunctionalExercise`) para normalizar y contar ejercicios incluso cuando llegan drivers de superseries.

## Configuraciones de entorno y deployment
- `src/environments/environment.ts`, `.test.ts` y `.prod.ts` apuntan al mismo API Gateway (`https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/{dev|prod}`) y contienen la informacion de Cognito (dominio, `clientId`, `userPoolId`, `redirectUri`).
- `src/aws-exports.ts` repite la configuracion de Amplify usada por `AuthService` y debe mantenerse sincronizada con los valores de Cognito.

## Flujo de desarrollo y scripts
1. `npm install` instala dependencias Angular, Amplify y herramientas de testing.
2. `npm start` o `ng serve` inicia el servidor de desarrollo en modo cliente.
3. `ng build` genera el bundle para produccion.
4. `npm run build` es equivalente a `ng build` y prepara `dist/speedup-coach-client`.
5. `npm run test` ejecuta los tests unitarios con Karma/Jasmine.
6. `npm run serve:ssr:speedup-coach-client` arranca el SSR usando el handler de `src/server.ts`.

## Despliegue y SSR
- El artefacto final se publica debajo de `dist/speedup-coach-client`; `src/server.ts` sirve los assets estaticos con `express.static` y utiliza `AngularNodeAppEngine` para renderizar el resto.
- La ruta `/callback` recibe la respuesta de Cognito y `AuthService` reconstruye el perfil a partir de los tokens.

## Observabilidad y buenas practicas
- Los componentes y servicios registran errores con contexto (`[ClientPlans]`, `[ThemeService]`, etc.) y calculan tiempos transcurridos usando referencias de `performance.now()`.
- Se siguen patrones de guardado en `BehaviorSubject`/`Observable` para separar el estado (p.ej. `theme$`, `currentUser$`) de la UI.

Mantener esta documentacion actualizada ayuda a que quien vuelva a este repositorio entienda rapidamente el flujo de planes, sesiones, autenticacion y tema por tenant.
