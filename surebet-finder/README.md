# 🎯 Surebet Finder

Detector de arbitraje deportivo (surebets) entre casas de apuestas, con
dashboard web, base de datos en Supabase y ejecución automática mediante
Vercel Cron.

## ⚠️ Léeme antes de nada — limitaciones importantes y honestas

1. **No se hace scraping directo de bet365, Winamax, Betway o William Hill.**
   Estas webs tienen protección anti-bot agresiva (Cloudflare, fingerprinting,
   JS rendering) y sus términos de servicio prohíben el scraping automatizado.
   Construir un scraper que evada esas protecciones no es algo que vaya a
   incluir, y tampoco te lo recomiendo: además del riesgo técnico, es
   probable que te cierren la cuenta si apuestas con ellas detectando
   patrones de arbitraje.

2. **Lo que SÍ hace este proyecto, de forma real y legal:**
   - Se conecta a **[The Odds API](https://the-odds-api.com)**, un agregador
     de cuotas con licencia legal sobre los datos de muchas casas (entre
     ellas, según región y deporte, bet365, William Hill, Betway y Betfair).
     Tiene plan gratuito (500 peticiones/mes).
   - Se conecta a la **API oficial y gratuita de Betfair**
     (developer.betfair.com) para leer cuotas reales del mercado de
     intercambio (Exchange).
   - Calcula matemáticamente si existe arbitraje entre las cuotas obtenidas,
     reparte el stake óptimo, y guarda todo en Supabase.
   - Muestra un dashboard web con las oportunidades activas.

3. **Winamax** no siempre está disponible en agregadores internacionales por
   ser un operador centrado en Francia/España. Si necesitas datos de
   Winamax, las opciones legales son: (a) revisar si tu cuenta de
   The Odds API la incluye para tu región/deporte, (b) contratar un
   proveedor de datos de cuotas con cobertura francesa (ej. Sportmonks,
   OddsJam), o (c) revisar manualmente su web pública de cuotas sin
   automatizar peticiones masivas, respetando sus términos de uso.

4. **El arbitraje deportivo no es ilegal** en la mayoría de jurisdicciones
   (es simplemente explotar diferencias de precio), pero **las casas de
   apuestas SÍ pueden limitar o cerrar cuentas** que detecten haciendo
   arbitraje sistemático. Usa esto bajo tu responsabilidad y comprueba la
   normativa de tu país.

---

## 🧱 Arquitectura

```
Next.js (App Router) ──> Vercel (hosting + cron)
        │
        ├── /api/fetch-odds  → obtiene cuotas (The Odds API + Betfair),
        │                      calcula arbitraje, guarda en Supabase
        ├── /api/surebets    → devuelve surebets activas al frontend
        └── /  (dashboard)   → tabla de oportunidades en tiempo real

Supabase (Postgres gratuito) ── almacena: bookmakers, events, odds, surebets
```

---

## 🚀 Despliegue paso a paso

### 1. Sube el proyecto a GitHub

```bash
unzip surebet-finder.zip
cd surebet-finder
git init
git add .
git commit -m "Initial commit: Surebet Finder"
gh repo create surebet-finder --public --source=. --push
# o hazlo manualmente desde github.com/new y luego:
# git remote add origin https://github.com/TU_USUARIO/surebet-finder.git
# git branch -M main
# git push -u origin main
```

### 2. Crea el proyecto en Supabase (gratis)

1. Ve a [supabase.com](https://supabase.com) → "New project".
2. Cuando esté listo, abre **SQL Editor** → **New query**, pega el
   contenido de `supabase/schema.sql` y ejecútalo.
3. Ve a **Project Settings → API** y copia:
   - `Project URL` → será `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → será `SUPABASE_SERVICE_ROLE_KEY` (¡no la expongas en el cliente!)

### 3. Consigue tu API key gratuita de The Odds API

1. Regístrate en [the-odds-api.com](https://the-odds-api.com) (plan free: 500 req/mes).
2. Copia tu API key → será `ODDS_API_KEY`.
3. Revisa qué bookmakers están disponibles para tu deporte/región en
   su [lista de bookmakers soportados](https://the-odds-api.com/sports-odds-data/bookmaker-apis.html).

### 4. (Opcional) Activa la API de Betfair

1. Regístrate como desarrollador en [developer.betfair.com](https://developer.betfair.com).
2. Crea una "Application Key" → será `BETFAIR_APP_KEY`.
3. Usa tu usuario/contraseña normal de Betfair como `BETFAIR_USERNAME` /
   `BETFAIR_PASSWORD` (el login interactivo basta para desarrollo; para
   producción a largo plazo, Betfair recomienda "certificate login").
4. Si no quieres usar Betfair, simplemente deja esas variables vacías:
   el proveedor se omite automáticamente sin romper nada.

### 5. Despliega en Vercel (gratis)

1. Ve a [vercel.com/new](https://vercel.com/new) e importa tu repo de GitHub.
2. En **Environment Variables**, añade todas las variables de `.env.example`
   con tus valores reales.
3. Despliega. Vercel detectará automáticamente que es un proyecto Next.js.
4. El archivo `vercel.json` ya configura un **Cron Job** que llama a
   `/api/fetch-odds` cada 30 minutos.

   > 📌 Nota: en el plan **Hobby (gratis)** de Vercel, los Cron Jobs están
   > limitados a una ejecución al día por cron. Si quieres ejecuciones
   > cada pocos minutos gratis, usa un servicio externo como
   > [cron-job.org](https://cron-job.org) (gratis) apuntando a:
   > `https://tu-proyecto.vercel.app/api/fetch-odds`
   > con la cabecera `Authorization: Bearer TU_CRON_SECRET`.

### 6. Prueba en local antes de desplegar (opcional)

```bash
npm install
cp .env.example .env.local
# edita .env.local con tus claves reales
npm run dev
# abre http://localhost:3000
```

Para forzar manualmente una búsqueda de surebets en local:

```bash
curl http://localhost:3000/api/fetch-odds \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

---

## 🔢 Cómo funciona el cálculo de arbitraje (resumen)

Para cada resultado posible de un partido (local / empate / visitante),
el sistema busca la **mejor cuota entre todas las casas**. Si la suma de
las probabilidades implícitas (`1 / cuota`) de la mejor combinación es
**menor que 1**, existe una surebet garantizada. El reparto de stake
óptimo se calcula proporcionalmente a la probabilidad implícita de cada
resultado, de forma que el beneficio sea idéntico sin importar qué
resultado ocurra. Toda la lógica está en `lib/arbitrage.ts`, comentada
línea a línea.

---

## 📂 Estructura del proyecto

```
surebet-finder/
├── app/
│   ├── api/
│   │   ├── fetch-odds/route.ts   # orquestador: obtiene cuotas + calcula + guarda
│   │   ├── surebets/route.ts     # API para el dashboard
│   │   └── providers/
│   │       ├── theoddsapi.ts     # proveedor real (agregador legal)
│   │       ├── betfair.ts        # proveedor real (API oficial Betfair)
│   │       └── types.ts
│   ├── page.tsx                  # dashboard
│   └── layout.tsx
├── components/
│   └── SurebetTable.tsx
├── lib/
│   ├── arbitrage.ts              # matemáticas del arbitraje
│   ├── normalize.ts              # emparejar el mismo partido entre fuentes
│   └── supabaseClient.ts
├── supabase/
│   └── schema.sql
├── vercel.json                   # configuración del cron
└── .env.example
```

## 🛣️ Posibles mejoras futuras

- Añadir más deportes/ligas (ahora mismo `ODDS_API_SPORT` apunta a uno solo;
  puedes llamar al endpoint varias veces con distintos sport keys).
- Soporte de mercados adicionales (hándicaps, over/under, etc.) ampliando
  `lib/arbitrage.ts`.
- Notificaciones por Telegram/Email cuando aparezca una surebet nueva
  (se puede añadir fácilmente dentro de `fetch-odds/route.ts`).
- Panel de histórico y estadísticas de rentabilidad media.
