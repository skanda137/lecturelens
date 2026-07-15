# Frontend Development Quick Reference

## Project Located At
```
frontend/
```

## Quick Start Commands

```bash
# Navigate to frontend
cd frontend

# Install dependencies
pnpm install

# Start development
pnpm dev          # Runs at http://localhost:5173

# Build for production
pnpm build

# Preview build
pnpm preview
```

## Key Files

| File | Purpose |
|------|---------|
| `src/app/App.tsx` | Main application component |
| `src/styles/theme.css` | Design tokens & CSS variables |
| `vite.config.ts` | Build configuration |
| `package.json` | Dependencies |
| `index.html` | HTML template |

## Project Features

✅ **Arc-style animated sidebar** - Expands on hover  
✅ **Premium frosted glass topbar** - Modern navigation  
✅ **Dashboard with hero section** - Stats and quick actions  
✅ **Premium upload interface** - Drag-drop with processing  
✅ **Smooth animations** - Framer Motion throughout  
✅ **Responsive design** - Mobile-optimized  
✅ **Dark mode ready** - Theme support in place  

## Design System

```css
/* Colors */
Primary:        #6D5EF7 (Purple)
Secondary:      #7C3AED (Violet)
Accent Blue:    #22C3FF
Accent Green:   #2DD4BF
Success:        #10B981
Warning:        #F59E0B
```

## Component Locations

- **UI Components**: `src/app/components/ui/`
- **Custom Components**: `src/app/components/figma/`
- **Page Components**: `src/app/App.tsx` (all pages)
- **Utilities**: `src/app/lectureImport.ts`

## Directory Structure

```
frontend/src/
├── app/
│   ├── App.tsx                # Main app (all pages)
│   ├── lectureImport.ts       # Data utilities
│   └── components/
│       ├── ui/               # Shadcn UI components
│       └── figma/            # Custom components
├── styles/
│   ├── index.css             # Imports all styles
│   ├── theme.css             # CSS variables
│   ├── tailwind.css          # Tailwind directives
│   ├── globals.css           # Global styles
│   └── fonts.css             # Font declarations
└── main.tsx                  # Entry point
```

## Common Tasks

### Add a New Page
1. Create component in `App.tsx`
2. Add navigation link in sidebar
3. Add route logic in main app

### Update Theme
Edit `src/styles/theme.css`:
- Change CSS variable values
- Add new utilities
- Modify animations

### Add UI Component
1. Add to `src/app/components/ui/`
2. Import and use in components
3. Style with Tailwind + custom CSS

## Testing Locally

```bash
# Development
pnpm dev

# In browser
http://localhost:5173

# Test upload page
Click "Upload" in sidebar → Try sample or drag file

# Test processing
Click "Try Sample Lecture"
Watch animated progress indicators

# Test navigation
Click sidebar items to switch pages
```

## Build Pipeline

```
Source → Vite Build → Optimized Output
         ↓
   - TypeScript checked
   - JSX compiled
   - CSS processed
   - Assets bundled
   - Tree-shaking applied
   ↓
frontend/dist/
├── index.html        (0.73 KB)
├── assets/
│   ├── index-*.css   (19.40 KB gzipped)
│   └── index-*.js    (112.06 KB gzipped)
```

## Performance

| Metric | Value |
|--------|-------|
| Build Time | ~10.77s |
| CSS Bundle | 19.40 KB |
| JS Bundle | 112.06 KB |
| Total Size | ~131 KB |

## Dependencies Included

**Core Framework:**
- React 18.3.1
- React DOM 18.3.1
- React Router 7.13.0

**UI & Animation:**
- Framer Motion 12.23.24
- Lucide React 0.487.0
- Radix UI (multiple packages)

**Styling:**
- Tailwind CSS 4.1.12
- Tailwind Merge 3.2.0

**Utilities:**
- clsx 2.1.1
- date-fns 3.6.0
- sonner 2.0.3

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers

## Troubleshooting

**Port 5173 already in use:**
```bash
pnpm dev -- --port 3000
```

**Dependencies not installing:**
```bash
pnpm install --force
```

**Build failing:**
```bash
rm -rf dist node_modules
pnpm install
pnpm build
```

## Documentation

- **Full Guide**: [FRONTEND_SETUP_GUIDE.md](../FRONTEND_SETUP_GUIDE.md)
- **Frontend README**: [README.md](./README.md)
- **Design System**: [Guidelines](../guidelines/Guidelines.md)

## Environment

Create `.env.local`:
```env
VITE_API_URL=http://localhost:3000/api
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DARK_MODE=true
```

---

**Status**: ✅ Ready for Development  
**Last Build**: Successful (~10.77s)  
**Bundle Size**: 131 KB (gzipped)
