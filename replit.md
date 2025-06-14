# replit.md

## Overview

VRipper is a Progressive Web App (PWA) for downloading images from ViperGirls forum threads. The application allows users to input ViperGirls thread URLs, specify page ranges, configure download options, and track download progress in real-time. As a PWA, it can be installed on mobile devices and works offline with cached resources.

## System Architecture

The application follows a monorepo structure with clear separation between client, server, and shared components:

- **Frontend**: React with TypeScript, using Vite as the build tool
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI Framework**: shadcn/ui components with Tailwind CSS
- **State Management**: TanStack Query for server state management
- **Development Environment**: Replit with Node.js 20 and PostgreSQL 16

### Directory Structure

```
├── client/          # React frontend application
├── server/          # Express.js backend server  
├── shared/          # Shared TypeScript schemas and types
├── migrations/      # Database migration files
└── downloads/       # Downloaded files storage
```

## Key Components

### Frontend Architecture
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **shadcn/ui** component library for consistent UI design
- **TanStack Query** for efficient server state management and caching
- **Wouter** for lightweight client-side routing
- **Tailwind CSS** for utility-first styling with custom design tokens

### Backend Architecture
- **Express.js** server with TypeScript
- **Drizzle ORM** for type-safe database operations
- **Custom scraper service** for ViperGirls thread parsing
- **Download manager** with concurrent download handling
- **File system storage** for downloaded images

### Database Schema
- **download_sessions**: Tracks download jobs with configuration and status
- **downloaded_images**: Individual image download records with progress tracking
- Uses PostgreSQL with Drizzle ORM for type-safe queries

## Data Flow

1. **URL Input**: User pastes ViperGirls thread URL
2. **URL Parsing**: Server extracts thread ID and detects current page
3. **Configuration**: User sets page range and download options
4. **Download Initiation**: Server creates download session and begins scraping
5. **Progress Tracking**: Real-time updates via polling for download status
6. **File Management**: Images stored locally with organized file structure

## External Dependencies

### Core Runtime Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **axios**: HTTP client for external requests
- **cheerio**: HTML parsing for web scraping
- **drizzle-orm**: Type-safe database ORM

### UI and Frontend
- **@radix-ui/**: Headless UI components for accessibility
- **@tanstack/react-query**: Server state management
- **class-variance-authority**: Component variant management
- **tailwindcss**: Utility-first CSS framework

### Development Tools
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production
- **vite**: Frontend build tool and dev server

## Deployment Strategy

### Development Environment
- **Replit Integration**: Configured for seamless Replit development
- **Hot Module Replacement**: Vite provides fast development feedback
- **Database**: PostgreSQL 16 module provisioned automatically
- **Port Configuration**: Server runs on port 5000, proxied to port 80

### Production Build Process
1. **Frontend Build**: Vite compiles React app to static assets
2. **Backend Build**: esbuild bundles Express server to single file
3. **Database Migration**: Drizzle handles schema synchronization
4. **Asset Serving**: Express serves static frontend files

### Environment Configuration
- **NODE_ENV**: Switches between development and production modes
- **DATABASE_URL**: PostgreSQL connection string (auto-provisioned in Replit)
- **File Storage**: Local filesystem for downloaded images

## Recent Changes

- June 14, 2025: Converted to Progressive Web App (PWA)
  - Added service worker for offline functionality
  - Created PWA manifest with app icons
  - Added install button component
  - Removed Google Drive integration to eliminate API dependencies
  - Simplified download location to local-only storage
  - Updated app branding to "VRipper"

- June 14, 2025: Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.