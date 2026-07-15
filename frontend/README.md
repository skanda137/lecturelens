# LectureLens Frontend

Premium React-based frontend for transforming lectures into interactive visual knowledge maps.

## Features

- 🎨 Premium UI with glassmorphism and modern animations
- 📊 Interactive mind map visualization
- 🎥 Lecture upload and processing
- 🔍 Advanced search and filtering
- 📱 Fully responsive design
- ♿ Accessibility-focused (WCAG 2.1 AA)

## Tech Stack

- **React 18.3** - UI framework
- **TypeScript** - Type safety
- **Vite 6.3** - Build tool
- **Tailwind CSS 4** - Utility-first styling
- **Framer Motion 12** - Animations
- **Lucide React** - Icons
- **Radix UI** - Headless components

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install
# or
npm install
```

### Development

```bash
# Start dev server
pnpm dev
# or
npm run dev
```

Server runs at `http://localhost:5173`

### Build

```bash
# Build for production
pnpm build
# or
npm run build
```

Output is in the `dist/` folder.

### Preview

```bash
# Preview production build
pnpm preview
# or
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx              # Main application component
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/             # shadcn UI components
│   │   │   └── figma/          # Figma-specific components
│   │   └── lectureImport.ts    # Lecture data import utilities
│   ├── styles/
│   │   ├── index.css           # Main style entry
│   │   ├── globals.css         # Global styles
│   │   ├── theme.css           # Theme variables & utilities
│   │   ├── tailwind.css        # Tailwind directives
│   │   └── fonts.css           # Font declarations
│   └── main.tsx                # Entry point
├── index.html                  # HTML template
├── package.json               # Dependencies
├── vite.config.ts             # Vite configuration
├── postcss.config.mjs         # PostCSS configuration
└── .gitignore                 # Git ignore rules
```

## Key Pages

- **Dashboard** - Overview with statistics and recent lectures
- **Upload** - Drag-and-drop lecture upload with processing visualization
- **Mind Map** - Interactive knowledge visualization
- **Settings** - User preferences and account settings

## Styling

The project uses Tailwind CSS v4 with custom theme variables defined in `src/styles/theme.css`:

- Primary: `#6D5EF7` (Purple)
- Secondary: `#7C3AED` (Violet)
- Accent Blue: `#22C3FF`
- Accent Green: `#2DD4BF`

## Animations

All animations use Framer Motion with consistent spring physics:
- Spring stiffness: 300
- Spring damping: 30

Common animations: fade-in, slide-up, hover lift, scale, and scroll effects.

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader optimized
- High contrast mode support
- Semantic HTML throughout

## Contributing

1. Create a feature branch
2. Make your changes
3. Test in development
4. Submit a pull request

## License

See ATTRIBUTIONS.md in the root directory.
