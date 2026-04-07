# Major Pick'em 2026 🏌️

Masters Tournament daily pick'em for you and your boys.

---

## Setup (takes about 15 minutes)

### Step 1 — Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → New project
2. Name it `majorpickem`, set a DB password, pick a region near Dallas (US East)
3. Go to **SQL Editor** → paste the contents of `supabase-setup.sql` → Run
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 2 — Let everyone create their own account

No manual setup needed. Each person goes to the deployed site, clicks
**Create Account**, picks their own name and password, and enters the
invite code you set as `INVITE_CODE` in Step 3.

Just pick something simple like `masters2026` and drop it in the group chat.

### Step 3 — Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. In **Environment Variables**, add:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | From Supabase Project Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase Project Settings |
| `JWT_SECRET` | Any long random string (run `openssl rand -hex 32` in terminal) |

4. Deploy → done!

---

## During the Tournament (updating scores)

Go to **Supabase → Table Editor → golfer_scores** and manually update:
- `total_score` — overall score to par (negative = under par)
- `r1`, `r2`, `r3`, `r4` — individual round scores
- `position` — e.g. `"T3"`, `"1"`, `"CUT"`
- `status` — `active`, `cut`, or `wd`

Scores update live for all users within 2 minutes.

---

## How It Works

- **Pick deadline**: Picks lock at the first tee time each day
  - R1 (Thu Apr 10): 8:00 AM CT
  - R2 (Fri Apr 11): 8:00 AM CT
  - R3 (Sat Apr 12): 9:30 AM CT
  - R4 (Sun Apr 13): 9:30 AM CT
- **Visibility**: You can always see your own picks. Everyone else's picks
  are hidden until the round's deadline passes.
- **Scoring**: Sum of your 3 golfers' scores to par. Lowest wins.
- **Changing picks**: You can change your picks any time before the deadline.
