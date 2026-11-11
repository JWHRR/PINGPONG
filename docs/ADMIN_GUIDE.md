# Administrator Guide

Sign in at **/admin** with your administrator email and password. The dashboard has eight sections in the left menu (along the top on phones).

## Before the tournament

### 1. Tournament info
Under *Tournament info*, set the tournament name, tagline, the titles of the Table Tennis and Badminton events, start and end dates, location, organiser and description. These appear on the home page straight away.

### 2. Categories (one bracket each)
A category is a **sport + discipline + level**, for example *Table Tennis Singles — Beginner* or *Badminton Doubles — Open*. Each category gets its own separate bracket. Create, rename or reorder them under *Categories*. You can only delete a category that has no participants (typing its name confirms the delete).

### 3. Courts & tables
Add every playing area, for example *Table 1–3* and *Court 1–2*, and tag each with its sport. Inactive courts and tables can't be assigned to matches.

### 4. Register participants
Under *Participants* → **Register participant**:
- Choose the category and level.
- Singles: the player's name. Doubles: both partners' names. The display name defaults to "Player 1 / Player 2".
- Club, notes and an optional **seed** (1 = strongest). Seeded players are kept apart in the draw and receive the BYEs first.
- **Save & add another** speeds up bulk entry.

The system rejects duplicate names, a player entered twice in the same category (including inside a doubles pair) and duplicate seeds.

To move a player to a different level, edit them and change the category. You can't do this once they are part of a generated draw: discard the preview first, or regenerate the draw.

## Draws

Under *Draws*, pick the category:

1. **Generate random draw.** This creates a **preview** that only admins can see. The bracket size is the next power of two, and BYEs go to the top seeded positions and are spread evenly across both halves. A BYE is never paired with another BYE.
2. Review the preview. **Re-shuffle preview** draws again; **Discard** deletes it.
3. **Publish draw.** The bracket becomes public and results can be entered.

**Safety:** a published draw is never replaced by accident. *Regenerate draw* asks you to type the category name, creates a new preview, and the old draw stays live until you publish the new one, which needs the typed name again. Every draw ever generated, including replaced ones, stays in **Draw history** with its random seed and original slot list, which you can download as JSON for auditing.

If participants change after a preview was generated, publishing is blocked until you regenerate the preview.

## Running matches

Under *Matches & scores*, pick a category. Use the filters (Ready to play, Live, Completed, Awaiting players) and click a match to open it.

| Task | How |
|---|---|
| Schedule | Set date/time and court/table → **Save schedule**. Two matches can't share a court/table at the same time. |
| Start / live score | Type the game scores so far → **Start / live score**, then **Update live score** as play goes on. The public match center shows it live. |
| Validate result | Enter all games → the panel shows the result it will record (for example "Valid result — X wins 2–1") → **Validate result** → confirm. The winner moves into the next round automatically. |
| Walkover | Optional reason → **W/O → player**. The other player is eliminated. |
| Correct a result | Open the completed match, change the scores → **Save correction**. If the winner changes and the next-round match has already started or finished, you are warned and must confirm. Those later results are then reset. |
| Reset | **Reset** clears the result and removes the winner from the next round, after confirmation. |

### Score rules (checked by the server)
- Best of 3 games: the first to win 2 games wins the match, and there is no third game after a 2–0.
- **Table Tennis:** games to 11, win by 2 (12–10, 15–13…).
- **Badminton:** games to 21, win by 2, capped at 30 (30–29 is valid).

Invalid scores are refused with an explanation.

## Champion
Once the final is validated, a **Declare tournament champion** panel appears at the top of *Matches & scores*. Declaring sets the official champion, shows it everywhere (home page highlights, bracket and participant profiles) and **locks** that category's results. *Re-open for corrections* (typing the name confirms it) removes the lock.

## Audit log
*Audit log* records every action: who did it, when, scores, previous results, affected matches and draw seeds. Live score updates are hidden by default.

## Adding another administrator
1. Supabase → Authentication → Users → Add user.
2. SQL Editor: `insert into public.admins (user_id, email) select id, email from auth.users where email = 'new.admin@example.com';`

If someone who isn't an admin signs in, the dashboard shows this SQL ready to copy.
