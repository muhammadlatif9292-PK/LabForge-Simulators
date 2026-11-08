# LabForge Simulators

> **Interactive virtual science laboratory and instrument simulator platform covering Physics, Chemistry, Optics, and Mechanics.**

LabForge is a modern, high-precision web-based laboratory platform engineered with React, TypeScript, and Vite. It provides interactive, physically accurate simulations of scientific apparatus, optical ray tracing, circuit systems, and chemical reactions for students, educators, and researchers.

---

## 🔬 Interactive Instrument Catalog

### 1. Optics Suite
- **Convex Lens**: Full ray tracing for converging lenses based on the Gaussian lens formula (\( \frac{1}{f} = \frac{1}{v} - \frac{1}{u} \)). Computes real and virtual images, focal bounds, and linear magnification.
- **Concave Lens**: Simulates diverging refraction with divergent ray extensions and erect, diminished virtual images.
- **Concave Mirror**: 6 discrete object positions with spherical mirror reflection calculations (\( \frac{1}{f} = \frac{1}{v} + \frac{1}{u} \)).
- **Convex Mirror**: Diverging spherical reflection with real-time field-of-view visualization.

### 2. Mechanics & Measurement
- **Simple Pendulum**: Solves the complete non-linear second-order differential equation \( \ddot{\theta} = -\frac{g}{L} \sin(\theta) \) using a 4th-Order Runge-Kutta (RK4) numerical integrator. Features live kinetic/potential energy conservation graphs and variable gravity presets (Earth, Moon, Mars, Jupiter).
- **Vernier Caliper**: Interactive caliper with precision main scale and sliding vernier scale (0.01 cm / 0.1 mm resolution), zero-error calibration, and object dimension measurement.

### 3. Electricity & Circuits
- **Ohm's Law Circuit**: Dynamic breadboard and schematic circuit builder with live resistor color coding, current/voltage dials, power dissipation calculation (\( P = VI \)), and real-time \( V-I \) characteristic curve plotting.

### 4. Chemistry Laboratory
- **Virtual Chem Lab**: Complete node-based chemical reaction canvas, solution mixing, acid-base titrations, color change engines, precipitate indicators, and 3D molecular visualization.
- **Digital pH Meter**: Buffer calibration, temperature compensation, and real-time pH calculation across standard acidic, neutral, and alkaline solutions.

---

## 🏛️ Architecture & Technologies

```text
LabForge-Simulators/
├── docs/                       # Architecture specifications and master blueprints
│   ├── LABFORGE_SPEC_v2.md     # Complete file specification v2.0.0
│   └── Labforge Master Blueprint Phase1.pdf
├── public/
│   └── diagrams/               # High-resolution SVG and PNG apparatus schematics
├── src/
│   ├── chem-lab/               # Chemistry Lab application & reaction engine
│   │   ├── ai/                 # AI analysis & predictive tutoring interfaces
│   │   ├── data/               # Chemical reagent definitions & reaction rules
│   │   ├── engine/             # ODE kinetics and chemical state solvers
│   │   ├── store/              # ChemLab state store
│   │   └── ui/                 # Canvas, molecule viewer, and lab UI components
│   ├── labforge/               # LabForge core instrument simulator suite
│   │   ├── instruments/        # Individual instrument simulation apps
│   │   ├── lib/                # Shared physics, numerical ODE solvers, ray optics
│   │   ├── registry/           # Instrument metadata, categorization, dynamic loaders
│   │   ├── shell/              # Portal UI, sidebar navigation, instrument grid
│   │   └── store/              # Zustand global instrument state store
│   ├── App.tsx                 # Root application wrapper
│   ├── main.tsx                # React entry point
│   └── index.css               # Design tokens and Tailwind styles
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Core Technologies
- **Framework**: [React 19](https://react.dev/) + [TypeScript 5.8](https://www.typescriptlang.org/)
- **Bundler & Tooling**: [Vite 6](https://vitejs.dev/) with Fast Refresh
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + CSS Design Tokens
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Physics & Math**: RK4 ODE Integrators, Thin-Lens Optics Engines, Custom Canvas 2D Vector Drawing
- **Visualization**: [Recharts](https://recharts.org/) & [ReactFlow](https://reactflow.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/muhammadlatif9292-PK/LabForge-Simulators.git
cd LabForge-Simulators

# Install dependencies
npm install

# Start local development server
npm run dev
```

### Production Build
```bash
# Compile and bundle for production
npm run build

# Preview production build locally
npm run preview
```

---

## 📄 License & Attribution

Designed and engineered by **Muhammad Hamad Latif** (`muhammadlatif9292@gmail.com`). All rights reserved.
