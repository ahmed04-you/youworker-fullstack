# YouWorker.AI Frontend - Deployment Guide

## ✅ Build Status

**Latest Build**: ✅ **SUCCESSFUL**

```
Route (app)                                 Size  First Load JS
┌ ○ /                                      124 B         102 kB
├ ○ /_not-found                            996 B         103 kB
├ ○ /analytics                            112 kB         262 kB
├ ○ /chat                                42.4 kB         202 kB
├ ○ /history                             2.73 kB         162 kB
├ ○ /ingest                              20.1 kB         179 kB
└ ○ /settings                            14.7 kB         174 kB
+ First Load JS shared by all             102 kB
```

All pages are pre-rendered as static content with excellent bundle sizes!

## 🚀 Quick Start

### Development

```bash
cd apps/frontend

# Install dependencies (already done)
npm install

# Start development server
npm run dev

# Server will run at http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start

# Server will run at http://localhost:3000
```

### Type Checking

```bash
# Run TypeScript type checker
npm run type-check
```

### Linting

```bash
# Run ESLint
npm run lint
```

## 🌍 Environment Configuration

### Required Environment Variables

Create a `.env.local` file in `apps/frontend/`:

```bash
# API Backend URL
NEXT_PUBLIC_API_URL=http://localhost:8001

# WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:8001/ws

# Application Name
NEXT_PUBLIC_APP_NAME=YouWorker.AI
```

### Production Environment

For production deployment, update the URLs:

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/ws
NEXT_PUBLIC_APP_NAME=YouWorker.AI
```

## 📦 Deployment Options

### Option 1: Docker Deployment

The project includes a Dockerfile for containerized deployment:

```bash
# Build Docker image
docker build -t youworker-frontend -f ops/docker/Dockerfile.frontend .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://api:8001 \
  -e NEXT_PUBLIC_WS_URL=ws://api:8001/ws \
  youworker-frontend
```

### Option 2: Vercel Deployment

Next.js is optimized for Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel

# Add environment variables in Vercel dashboard
```

### Option 3: Traditional Server

```bash
# Build the application
npm run build

# Copy build files to server
# .next/ directory and node_modules/

# Start with PM2 or similar
pm2 start npm --name "youworker-frontend" -- start
```

### Option 4: Static Export (if needed)

For static hosting (Nginx, Apache, etc.):

```bash
# Add to next.config.js:
# output: 'export'

npm run build
# Static files in out/ directory
```

## 🔧 Configuration

### Next.js Configuration

The `next.config.js` is optimized with:
- React Strict Mode enabled
- Image optimization
- API rewrites for proxy
- Package import optimization

### Tailwind Configuration

The `tailwind.config.ts` includes:
- Custom color palette
- Dark mode support
- Custom animations
- Component variants

### TypeScript Configuration

The `tsconfig.json` is configured with:
- Strict mode enabled
- Path aliases (@/*)
- Latest ES features
- JSX preservation

## 🔗 Integration with Backend

### Backend Requirements

The frontend expects the backend API to be running at the configured URL with the following endpoints:

**REST Endpoints:**
- `GET /sessions` - List chat sessions
- `GET /sessions/:id` - Get session details
- `GET /sessions/:id/messages` - Get messages
- `DELETE /sessions/:id` - Delete session
- `POST /ingest/upload` - Upload documents
- `GET /analytics/overview` - Analytics data
- `GET /health` - Health check

**WebSocket Endpoint:**
- `WS /ws` - Real-time chat connection

### CORS Configuration

Ensure backend CORS is configured to allow frontend origin:

```python
# Backend FastAPI CORS config
origins = [
    "http://localhost:3000",
    "https://yourdomain.com"
]
```

## 🎨 Customization

### Branding

To customize branding:

1. Replace logo: `public/youco-logo.png`
2. Update app name in `.env.local`
3. Modify colors in `tailwind.config.ts`
4. Update metadata in `app/layout.tsx`

### Theme Colors

Edit `app/globals.css` to customize theme colors:

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96.1%;
  /* etc. */
}
```

### Features Toggle

You can enable/disable features by modifying the navigation array in `components/sidebar.tsx`.

## 📊 Performance Monitoring

### Bundle Analysis

To analyze bundle size:

```bash
# Install analyzer
npm install --save-dev @next/bundle-analyzer

# Add to next.config.js and run
ANALYZE=true npm run build
```

### Performance Metrics

Current performance metrics:
- **Largest Bundle**: Analytics page (262 kB)
- **Smallest Bundle**: History page (162 kB)
- **Shared JS**: 102 kB (excellent code splitting)

### Optimization Tips

1. **Images**: Use Next.js Image component for automatic optimization
2. **Fonts**: Use next/font for optimized font loading
3. **Code Splitting**: Implemented via dynamic imports where needed
4. **Lazy Loading**: Charts and heavy components can be lazy loaded

## 🔒 Security Considerations

### Environment Variables

- Never commit `.env.local` to version control
- Use environment-specific variables for different deployments
- Sensitive data should only exist in backend

### API Security

- API key storage is client-side for development
- Production should use secure authentication (JWT, OAuth)
- WebSocket connections should use WSS in production

### Content Security Policy

Consider adding CSP headers in production:

```typescript
// In next.config.js
headers: async () => [{
  source: '/:path*',
  headers: [
    {
      key: 'Content-Security-Policy',
      value: "default-src 'self'; ..."
    }
  ]
}]
```

## 🐛 Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

**Type Errors:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**WebSocket Connection Issues:**
- Check NEXT_PUBLIC_WS_URL is correct
- Ensure backend WebSocket endpoint is accessible
- Check browser console for CORS errors

**Styling Issues:**
- Clear browser cache
- Verify Tailwind CSS is properly configured
- Check for conflicting CSS classes

## 📈 Monitoring & Analytics

### Production Monitoring

Recommended tools:
- **Vercel Analytics** - Built-in if deployed on Vercel
- **Google Analytics** - Add to `app/layout.tsx`
- **Sentry** - For error tracking
- **LogRocket** - For session replay

### Health Checks

The frontend can be monitored via:
- HTTP 200 on root path `/`
- Next.js built-in health endpoint

## 🔄 Updates & Maintenance

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all dependencies
npm update

# Update specific package
npm update next@latest

# Test after updates
npm run build
npm run type-check
```

### Version Control

Current versions:
- Next.js: 15.1.3
- React: 19.0.0
- TypeScript: 5.7.2

## 📱 Mobile App Considerations

The frontend is fully responsive and can be wrapped in:
- **React Native WebView** for mobile apps
- **Capacitor** for hybrid apps
- **Electron** for desktop apps

## 🎯 Production Checklist

Before deploying to production:

- [ ] Environment variables configured
- [ ] Build completes successfully
- [ ] Type checking passes
- [ ] Linting passes
- [ ] All pages accessible
- [ ] WebSocket connection works
- [ ] API endpoints responding
- [ ] Dark mode tested
- [ ] Mobile responsive verified
- [ ] Analytics integrated
- [ ] Error tracking setup
- [ ] Performance tested
- [ ] Security headers configured
- [ ] SSL/TLS enabled
- [ ] Monitoring active

## 🎉 Success!

Your YouWorker.AI frontend is ready for deployment! The application features:

✅ Modern, professional UI/UX
✅ Real-time chat with WebSocket
✅ Document ingestion with drag-and-drop
✅ Analytics dashboard with visualizations
✅ Chat history with search
✅ Comprehensive settings
✅ Dark/Light theme support
✅ Fully responsive design
✅ Type-safe with TypeScript
✅ Optimized bundle sizes
✅ Production-ready build

## 📞 Support

For issues or questions:
- Check the [FEATURES.md](./FEATURES.md) for feature documentation
- Check the [README.md](./README.md) for usage guidelines
- Review the backend [API.md](../../docs/API.md) for integration details

---

**Built with ❤️ using Next.js 16, React 19, and TypeScript**