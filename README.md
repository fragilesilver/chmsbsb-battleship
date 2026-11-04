# CHMS BSB Battleship Royale Competition 🏆

An inter-year classroom Battle Royale tournament system developed for **Chung Hwa Middle School, Bandar Seri Begawan (CHMS BSB)**. **Year 7, Year 8, Year 9, and Year 10** play in sessions, normally two years at a time. Each year has its own game code and map and competes only against itself, earning ammunition, torpedoes, and airstrikes by answering **General ICT** questions.

Each year plays **3 rounds** with **accumulated scoring**. The top team from each year then meets in a **Grand Final** session for the overall title. One **event dashboard** runs and records everything, and one **hall screen** shows the battles in the current session.

---

## 🏆 Competition Structure & Pacing (35–40 Minutes)

The competition is structured to last at least **30 minutes** with continuous engagement, seamless transitions, and transparent scoring:

```
                  CHMS BSB BATTLE ROYALE COMPETITION WORKFLOW
                  
     STAGE 1: INTER-CLASS PRELIMINARIES (BEST OF 3 ACCUMULATED ROUNDS)
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  YEAR 7 POOL   │  │  YEAR 8 POOL   │  │  YEAR 9 POOL   │  │  YEAR 10 POOL  │
│  (R1, R2, R3)  │  │  (R1, R2, R3)  │  │  (R1, R2, R3)  │  │  (R1, R2, R3)  │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │                   │                   │
  Top Y7 Team         Top Y8 Team         Top Y9 Team        Top Y10 Team
   (Y7 Champ)          (Y8 Champ)          (Y9 Champ)         (Y10 Champ)
        │                   │                   │                   │
        └───────────────────┴─────────┬─────────┴───────────────────┘
                                      │
                         STAGE 2: GRAND FINALS SHOWDOWN
                    ┌───────────────────────────────────┐
                    │ Y7 Top vs Y8 Top vs Y9 Top vs Y10 │
                    │       4-Way Battle Royale         │
                    └─────────────────┬─────────────────┘
                                      │
                         🏆 ULTIMATE CHAMPION CROWNED
```

### Event Schedule
| Stage | Description | Duration |
|---|---|---|
| **Lobby & Briefing** | Students join on phones/laptops, pick avatars, form class crews | 3–4 mins |
| **Stage 1: Round 1** | Fleet placement + Battle Royale (Combat & ICT Questions) | 8 mins |
| **Stage 1: Round 2** | Fleet placement + Battle Royale (Scores accumulate) | 8 mins |
| **Stage 1: Round 3** | Final preliminary round (Finalizes accumulated scores) | 8 mins |
| **Qualifier Ceremony** | Announcement of Year 7, 8, 9, and 10 Champions | 2–3 mins |
| **Stage 2: Grand Finals** | 4-Way Championship Showdown (Y7 vs Y8 vs Y9 vs Y10) | 8–10 mins |
| **Podium & Awards** | Crowning the CHMS BSB Ultimate Champion | 2 mins |
| **Total Event Time** | **Complete School Competition Event** | **~38–42 minutes** |

---

## 📊 Accumulated Scoring Formula

Points accumulate across Rounds 1, 2, and 3:

$$\text{Total Score} = \text{Round 1 Points} + \text{Round 2 Points} + \text{Round 3 Points}$$

### 1. Academic Points (General ICT)
- **Easy Question**: `+10 pts` (Earns 1 shot)
- **Medium Question**: `+20 pts` (Earns 2 shots)
- **Hard Question**: `+30 pts` (Earns 3 shots)
- **Streak Bonus**: `+25 pts` (3 correct answers in a row, also awards Sonar or Airstrike)

### 2. Combat Points (Naval Warfare)
- **Hit on Enemy Ship**: `+25 pts`
- **Sinking a Patrol Boat (2 squares)**: `+50 pts`
- **Sinking a Submarine / Destroyer (3 squares)**: `+75 pts`
- **Sinking a Carrier (4 squares)**: `+100 pts`
- **Sinking a Battleship (5 squares)**: `+125 pts`
- **Wiping out an Enemy Fleet (Elimination)**: `+200 pts`

### 3. Round Survival & Placement Points
- **1st Place (Winner / Last Fleet Afloat)**: `+300 pts`
- **2nd Place**: `+200 pts`
- **3rd Place**: `+100 pts`
- **4th Place and below**: `+50 pts`

If the clock runs out or the teacher ends a round, fleets still afloat are ranked by round score, then by ships afloat, and take the top placement points.

---

## 💻 General ICT Question Bank

The default question bank (`data/ict-general.json`) has **160 questions** (128 multiple-choice + 32 typed torpedo questions), with 20 in each of these topics:

1. Hardware & Devices
2. Software & Operating Systems
3. Files, Data & Storage
4. Documents & Presentations
5. Spreadsheets
6. Databases
7. Networks & the Internet
8. Online Safety & Ethics

Every topic runs from easy to hard. In an event, each year sees its own mix of questions:

| Division | Easy | Medium | Hard |
|---|---|---|---|
| Year 7 | 60% | 30% | 10% |
| Year 8 | 50% | 35% | 15% |
| Year 9 | 35% | 40% | 25% |
| Year 10 | 25% | 40% | 35% |
| Grand Final | 34% | 33% | 33% |

The Year 9 Computer Studies, Computer Science 2210, pseudocode and Bahasa Melayu sets are still available in the question set list.

---

## 🚀 Setup & Launch Guide

Host the repository on GitHub Pages or any static web server:

| Role | Access URL | Purpose |
|---|---|---|
| **Students** | `https://fragilesilver.github.io/chmsbsb-battleship/` | Join game, pick crew, place ships, fire, earn shots |
| **Teacher** | `https://fragilesilver.github.io/chmsbsb-battleship/teacher.html` | Create an event or a single game, and run a game's control room |
| **Event dashboard** | `https://fragilesilver.github.io/chmsbsb-battleship/event.html?id=XXXX` | Run all years at once, see the bracket, standings and topic results, export results |
| **Hall screen** | `https://fragilesilver.github.io/chmsbsb-battleship/projector.html?event=XXXX` | All four battles side by side, with join codes and QR codes in the lobby |
| **One year's projector** | `https://fragilesilver.github.io/chmsbsb-battleship/projector.html?code=XXXX` | Full-screen map, match clock and leaderboard for one game |

### One-time Firebase setup for events
Event records are stored in a new `events` area of the database, so it needs its own rule. In the Firebase console, open **Realtime Database > Rules** and add an `events` entry beside your existing `games` entry, using the same `.read` and `.write` conditions. Keep your existing rules. Until this is done, creating an event shows an error; single games still work.

### Plan your devices first
On Firebase's free Spark plan, the whole database allows **100 simultaneous connections**. Every open tab counts, including the dashboard and hall screen, and a device past the limit can't connect at all.

| Set-up | Devices in a session (two years of about 105 students) | Free plan? |
|---|---|---|
| Groups of 3 sharing a device | About 70, plus the screens | Yes |
| Pairs sharing a device | About 105, plus the screens | No, over the limit |
| One device each | About 210, plus the screens | No, needs the Blaze plan |

The dashboard shows how many devices have joined the session and warns you from 85. Ask students to close extra tabs. Groups can type all their names when they join.

### Running a whole-school event
1. Open `teacher.html`. Keep the format as **Whole-school event**, name each year's teams, and click **Create event**. You land on the event dashboard. Note its Event ID so you can reopen it.
2. On the dashboard, tick **Playing now** on the years in this session. Years that aren't ticked have no action buttons and don't appear on the hall screen.
3. Click **Open hall screen** and put it on the projector. Each year scans its own QR code or types its own code.
4. Click **Open fleet placement**, then **Start battle**. These buttons act on every ticked year at once, and each ticked year's card has its own buttons too.
5. **Keep the dashboard open and visible during battles.** It runs free shots, the storm and the round clock. Only one open dashboard runs them; any others just show results.
6. Rounds end automatically when the clock runs out. Click **Start next round** for Rounds 2 and 3. Students don't need to re-enter a code.
7. After Round 3, click **Finalise and name champion**. For the next session, untick those years, tick the next two, and repeat from step 3. You can close the dashboard between sessions and reopen it with the Event ID.
8. When every year has a champion, click **Create the Grand Final**. The hall screen switches to the final and shows its code. Champion crews scan or type that code. A device that played in the crew's year rejoins its crew automatically (or uses its **Join the Grand Final** button if the page is still open). Any other device picks its crew from the list, so check that only champion crews join.
9. Use **Download standings**, **Download topics** and **Print results** for your records and prize-giving. Results by topic list the weakest topics first.

Each year can have up to 6 teams. Use **Control room** on a year's card for extra controls such as supply drops and bonus shots. That page shows every ship, so don't project it.

### Crew limits
Big crews would otherwise clear the map in about 2 minutes. An event therefore limits each **whole crew**, whatever its size. You can change these on the setup page, and 0 turns a limit off.

| Limit | Event default |
|---|---|
| Firing a shot | Once every 15 seconds |
| Launching a torpedo | Once every 60 seconds |
| Earning a power-up from a streak | Once every 120 seconds |

Students can still answer questions and score points while their crew waits. Keeping crews even is also off by default for events, because class crews differ in size.

### Running a single game
Choose **One game** (3 rounds and a final on one map) or **One casual game** as the format, then click **Create game**. Keep the control room tab open, because it runs that game's clocks.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, CSS3 with responsive grid layout and CSS Custom Properties.
- **Backend / Real-time Sync**: Firebase Realtime Database (with anonymous authentication and atomic transactions).
- **Sound Effects**: HTML5 Web Audio API synthesizer (zero external audio file dependencies).
- **QR Code Generation**: Client-side qrcode.js.

---

## 📜 Repository & Remote

Target repository:
```bash
https://github.com/fragilesilver/chmsbsb-battleship.git
```
Branch: `main`
