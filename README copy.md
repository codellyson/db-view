# DB Explorer

A lightweight PostgreSQL database explorer for quick data viewing.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL (pg)

## Project Structure

```
db-explorer/
├── app/
│   ├── api/          # API routes for database operations
│   ├── components/   # React components
│   ├── globals.css   # Global styles
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page
├── lib/              # Utility functions and database connections
└── types/            # TypeScript type definitions
```

## Features (To Build)

- [ ] Database connection management
- [ ] Table listing
- [ ] Browse table data
- [ ] Simple query executor
- [ ] Search and filter

## Environment Variables

Create a `.env.local` file:

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=your_database
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
```
