# CHMS BSB Battleship Royale Competition 🏆

An inter-year classroom Battle Royale tournament system developed for **Chung Hwa Middle School, Bandar Seri Begawan (CHMS BSB)**. Teams in **Year 7, Year 8, Year 9, and Year 10** clash across a shared naval ocean, earning ammunition, torpedoes, and airstrikes by solving **Year 9 Computer Studies** problems.

The competition features a **Best of 3 Rounds** preliminary stage with **accumulated scoring**, culminating in an epic **Grand Finals** showdown where the top champions from Year 7, 8, 9, and 10 battle for the **Ultimate Winner** crown.

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
| **Stage 1: Round 1** | Fleet placement + Battle Royale (Combat & CS Questions) | 8 mins |
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

### 1. Academic Points (Year 9 Computer Studies)
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
- **4th Place**: `+50 pts`

---

## 💻 Year 9 Computer Studies Curriculum Topics

The default question bank (`data/cs-year9-topics.json`) features **107 curriculum-aligned questions** (85 MCQs + 22 typed torpedo questions) covering:

1. **Computer Systems & Hardware**: CPU architecture, Von Neumann model, ALU, Control Unit, Registers (PC, MAR, MDR, ACC), Fetch-Decode-Execute cycle, RAM vs ROM, Secondary Storage (Magnetic, Optical, SSD), Cache memory, Actuators, Embedded systems.
2. **Data Representation & Number Systems**: Binary, Denary, Hexadecimal conversions, 8-bit binary addition & overflow, Logical shifts, Storage units (bit to TB), ASCII vs Unicode, Pixel resolution, Colour depth, Sound sample rate, Lossy vs Lossless compression.
3. **Networks & Communication**: LAN vs WAN, Star / Bus / Mesh topologies, Routers, Switches, Hubs, MAC addresses, IP addresses (IPv4 vs IPv6), DNS, Packet switching, Client-Server model, Fibre optics.
4. **Cybersecurity, Safety & Ethics**: Malware (Viruses, Worms, Trojans, Ransomware, Spyware, Keyloggers), Phishing, Firewalls, Two-Factor Authentication (2FA), Strong passwords, Encryption (plaintext to ciphertext), Copyright, E-waste.
5. **Algorithms, Logic Gates & Programming Concepts**: Logic gates (AND, OR, NOT, NAND, XOR), Flowchart symbols (Input/Output parallelograms, Decision diamonds), Sequence, Selection (`IF-THEN-ELSE`), Iteration (`WHILE-DO`, `FOR-TO`, `REPEAT-UNTIL`), Variables, Data types, `DIV` and `MOD` arithmetic.

---

## 🚀 Setup & Launch Guide

Host the repository on GitHub Pages or any static web server:

| Role | Access URL | Purpose |
|---|---|---|
| **Students** | `https://fragilesilver.github.io/chmsbsb-battleship/` | Join game, pick crew, place ships, fire, earn shots |
| **Teacher** | `https://fragilesilver.github.io/chmsbsb-battleship/teacher.html` | Tournament setup, round manager, match clock, phase controls |
| **Hall / Class Projector** | `https://fragilesilver.github.io/chmsbsb-battleship/projector.html?code=XXXX` | Full-screen ocean radar, match countdown clock, live leaderboard |

### Teacher Tournament Management:
1. Open `teacher.html` and click **Create game** (Year 9 Computer Studies and 4 Divisions are selected by default).
2. Project `projector.html?code=XXXX` onto the screen. Students scan the QR code or enter the 4-letter code.
3. Click **Open fleet placement** $\rightarrow$ crews place their fleets on their phones.
4. Click **Start battle** $\rightarrow$ Round 1 begins with live match clock and real-time accumulated scoring.
5. When a round finishes, click **Start Round 2 of 3 (Keep Crews)** $\rightarrow$ the system seamlessly opens placement for Round 2 without students needing to re-enter room codes!
6. After Round 3 concludes, the system flags the top team from Year 7, 8, 9, and 10. Click **Launch Grand Finals** for the ultimate 4-way championship battle!

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
