# Frontend Dependencies

This project uses **npm** for package management. All dependencies are defined in `package.json`.

## Installation

```bash
npm install
```

## Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.2.0 | Core React library |
| `react-dom` | ^19.2.0 | React DOM rendering |
| `three` | ^0.182.0 | 3D graphics library for WebGL |
| `@react-three/fiber` | ^9.4.2 | React renderer for Three.js |
| `@react-three/drei` | ^10.7.7 | Useful helpers for react-three-fiber |
| `axios` | ^1.13.2 | HTTP client for API requests |
| `recharts` | ^3.6.0 | Charting library for data visualization |
| `d3` | ^7.9.0 | Data visualization and manipulation |
| `framer-motion` | ^12.23.26 | Animation library |
| `lucide-react` | ^0.562.0 | Icon library |
| `react-markdown` | ^10.1.0 | Markdown renderer |
| `remark-gfm` | ^4.0.1 | GitHub Flavored Markdown support |
| `react-draggable` | ^4.5.0 | Draggable components |
| `clsx` | ^2.1.1 | Utility for constructing className strings |
| `tailwind-merge` | ^3.4.0 | Merge Tailwind CSS classes |
| `uuid` | ^13.0.0 | UUID generation |

## Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^5.4.11 | Build tool and dev server |
| `@vitejs/plugin-react` | ^4.3.4 | Vite plugin for React |
| `tailwindcss` | ^4.1.18 | Utility-first CSS framework |
| `@tailwindcss/postcss` | ^4.1.18 | Tailwind PostCSS plugin |
| `postcss` | ^8.5.6 | CSS transformation tool |
| `autoprefixer` | ^10.4.23 | PostCSS plugin for vendor prefixes |
| `eslint` | ^9.39.1 | JavaScript linter |
| `@eslint/js` | ^9.39.1 | ESLint JavaScript config |
| `eslint-plugin-react-hooks` | ^7.0.1 | ESLint rules for React Hooks |
| `eslint-plugin-react-refresh` | ^0.4.24 | ESLint rules for React Fast Refresh |
| `@types/react` | ^19.2.5 | TypeScript types for React |
| `@types/react-dom` | ^19.2.3 | TypeScript types for React DOM |
| `globals` | ^16.5.0 | Global identifiers for ESLint |

## Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## Notes

- This project uses **Vite** as the build tool for fast development and optimized production builds
- **Three.js** and **React Three Fiber** power the 3D graph visualizations
- **Tailwind CSS** provides utility-first styling
- All dependencies are locked in `package-lock.json` for reproducible builds
