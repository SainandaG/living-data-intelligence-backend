# Living Data Intelligence — Frontend

The React/Vite frontend for the Living Data Intelligence Platform — a 3D interactive database visualization and AI analytics dashboard.

## 🛠️ Tech Stack

| Library | Version | Purpose |
|---|---|---|
| **React** | 18 | Component UI |
| **Vite** | Latest | Build tool & dev server |
| **Three.js** | Latest | 3D WebGL graph rendering |
| **Framer Motion** | Latest | Animations and transitions |
| **Tailwind CSS** | Latest | Styling |
| **Zustand** | Latest | State management |
| **Axios** | Latest | HTTP client with JWT refresh |
| **Vitest** | Latest | Unit testing |

## 📦 Setup

```bash
npm install
```

## 🚀 Development

```bash
npm run dev
```

Starts the dev server at **`http://localhost:5173`**.

Make sure the backend is running at `http://localhost:8001` before starting the frontend.

## 🏗️ Build

```bash
npm run build
```

Output is placed in `dist/`.

## 🧪 Tests

```bash
npm run test
```

## 🗂️ Key Components

| Component | Description |
|---|---|
| `ThreeGraph.jsx` | 3D force-directed graph (Three.js) |
| `AuthPage.jsx` | Login / Firebase sign-in page |
| `WorkOnDataModal.jsx` | ML analysis launcher |
| `DecisionBoard.jsx` | Decision Hub |
| `LatentSpaceOverlay.jsx` | Latent space dimensionality explorer |
| `AnomalyDashboard.jsx` | Real-time anomaly detection view |
| `TrafficDashboard` | API traffic monitoring |
| `NodeXRayPanel.jsx` | Deep table inspection |
| `ChatInterface.jsx` | AI natural language chat |
| `DashboardLayout.jsx` | Main application shell |

## 🔧 Environment

The frontend proxies API requests to the backend. Vite is configured to proxy `/api` to `http://localhost:8001`.

No `.env` file is needed for basic local development.

## 🐳 Docker

```bash
docker build -t ldi-frontend .
```

Uses multi-stage Nginx build. See `nginx.production.conf` for TLS/HTTPS production config.
