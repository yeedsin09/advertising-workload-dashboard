# Supabase Step-by-Step Setup

## 1. Create project

Create a Supabase project and open the SQL Editor.

## 2. Run schema

Run:

```sql
-- file: supabase/schema.sql
```

The SQL creates:

- `workload_days`
- `workload_tasks`
- Row Level Security policies

## 3. Add environment variables

Copy:

```bash
.env.example
```

Rename to:

```bash
.env.local
```

Add:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 4. Run locally

```bash
npm install
npm run dev
```

## 5. First login test

Open the dashboard, create an account through Sign Up, then Sign In.

## 6. Save and load test

1. Paste sample reply.
2. Click Add This Reply.
3. Set Storage mode to Supabase.
4. Click Save Day.
5. Reset Data.
6. Click Load Day.

## 7. Deploy

For Vercel:

1. Push to GitHub.
2. Import repo in Vercel.
3. Add environment variables in Vercel Project Settings.
4. Deploy.
