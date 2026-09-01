# SpeedUp Coach Client App

Estado actualizado y verificado en codigo: **11 de febrero de 2026**.

## 1) Proposito
Aplicacion cliente (rol `Client`) para consumir planes, sesiones, ejercicios y composicion corporal desde el backend de SpeedUp Coach.  
La app usa **Angular 19 standalone SPA** y autenticacion custom con **AWS Amplify/Cognito**.

## 2) Stack y librerias principales
- Angular 19 (`@angular/core`, `@angular/router`).
- AWS Amplify Auth (`aws-amplify/auth`) para login y sesiones Cognito.
- RxJS para estado y cache (`BehaviorSubject`, `Subject`, `shareReplay(1)`).
- Tailwind + PostCSS + SCSS.
- `ng-apexcharts`/`apexcharts` para graficas de composicion corporal.

## 3) Arquitectura actual
- Bootstrap cliente en `src/main.ts`:
  - Configura Amplify (`Amplify.configure(awsExports)`).
  - Arranca `AppComponent` con `appConfig`.
- `appConfig` (`src/app/app.config.ts`):
  - Router con `withEnabledBlockingInitialNavigation()`.
  - `provideHttpClient(withFetch(), withInterceptorsFromDi())`.
  - `provideAppInitializer` que ejecuta `AuthService.initAuth()`.
  - Registro de `AuthInterceptor`.
- `AppComponent`:
  - Muestra `SplashComponent` mientras `authStatus` sea `unknown`.
  - Renderiza `router-outlet` cuando auth ya se resolvio.

## 4) Rutas vigentes
Definidas en `src/app/app.routes.ts`.

Rutas publicas:
- `/login`
- `/change-password`
- `/forgot-password`
- `/unauthorized`

Rutas protegidas (layout + guards):
- `/plans`
- `/plans/:planId`
- `/plans/:planId/session/:sessionIndex`
- `/plans/:planId/session/:sessionIndex/exercise/:exerciseIndex`
- `/plans/:planId/session/:sessionIndex/exercise/:exerciseIndex/video`
- `/profile`
- `/body-composition`

Guardas:
- `AuthGuard`: exige sesion valida y grupo `Client`.
- `PublicOnlyGuard`: bloquea pantallas auth si ya hay sesion.
- `RoleGuard`: existe en el repo, pero **no esta conectado actualmente en rutas**.

## 5) Flujo de autenticacion e inicializacion
- `AuthService` maneja el estado con una maquina simple:
  - `unknown` -> `authenticated` o `unauthenticated`.
- `ClientLayoutComponent` observa `authStatus$`:
  - Cuando queda autenticado, dispara `ClientAppInitService.initClientData()`.
- `ClientAppInitService`:
  - Hace una sola carga post-auth a `/clients` (idempotente).
  - Controla `idle | loading | ready | error`.
  - Aplica tema al completar la carga.
  - Se resetea al volver a `unauthenticated`.
- `AuthInterceptor`:
  - Solo intercepta requests hacia `environment.apiBase`.
  - Adjunta `Authorization: Bearer <idToken>` para endpoints que lo requieren (hoy, `/clients`).
  - No hace navegacion ni side effects de UI.

## 6) Servicios y dominio de datos
- `ClientDataService`:
  - Endpoint principal: `${environment.apiBase}/clients`.
  - Fuente central para perfil, planes, metricas y tema.
  - Normaliza `sessions` y `progressions` cuando llegan serializados.
  - Cache en memoria con `shareReplay(1)` y limpieza explicita con `clearCache()`.
- `ThemeService`:
  - Normaliza y aplica tema tenant (colores, font stack, modo dark/light).
  - Expone `getTheme`, `saveTheme`, `getLogoUploadUrl`, `uploadLogoToS3`.
  - Maneja fallback de tema por defecto si no hay tema backend.

## 7) Pantallas funcionales
- `ClientPlansComponent`: lista planes, ordena por fecha y navega a detalle.
- `ClientPlanDetailComponent`: muestra sesiones, conteos, progresiones y navegacion a sesion.
- `ClientSessionExercisesComponent`: soporta items simples y grupos (superserie/circuito), con accesibilidad de teclado.
- `ClientExerciseDetailComponent`: descripcion, tecnica, errores comunes, grupos musculares.
- `ClientExerciseVideoComponent`: usa `preview_url`, luego `gif_url`, luego `thumbnail`.
- `ClientProfileComponent`: datos basicos del cliente (edad calculada, lesiones, entrenador).
- `ClientBodyCompositionComponent`: metricas + 4 graficas ApexCharts responsivas (peso, grasa, masa muscular, comparativo).
- Pantallas auth: `Login`, `ForgotPassword`, `ChangePassword`, `Unauthorized`.

## 8) Build y despliegue estatico
- Salida de build para despliegue:
  - `dist/speedup-coach-client/browser`
- Hosting objetivo:
  - AWS S3 + CloudFront con fallback SPA hacia `/index.html`

## 9) Entornos y endpoints
- `src/environments/environment.ts` (dev): API Gateway `/dev`.
- `src/environments/environment.prod.ts` (prod): API Gateway `/prod`.
- `src/environments/environment.test.ts`: usa endpoint `dev`.
- `src/aws-exports.ts`: configuracion de User Pool/App Client para flujo custom de login.

## 10) Scripts disponibles
- `npm start` -> `ng serve`
- `npm run build` -> `ng build`
- `npm run watch` -> build watch modo development
- `npm run test` -> `ng test`

## 11) Estado tecnico verificado hoy
Comandos ejecutados sobre este repo el **11 de febrero de 2026**:

1. `npm run build`
- Resultado: **OK**
- Observacion: warning de presupuesto en `src/app/layout/client-layout.component.scss` (excede el warning budget por ~1.42 kB).

2. `npm run test -- --watch=false --browsers=ChromeHeadless`
- Resultado: **OK**
- Total: **9 tests exitosos**.

## 12) Notas de mantenimiento actuales
- `proxy.conf.json` existe pero esta vacio (`{}`).
- `src/app/app.component.html` contiene markup legado que no se usa (el componente raiz usa template inline).
- Hay un `TODO` pendiente en `ClientDataService` para tipar `WorkoutSession.items`.

