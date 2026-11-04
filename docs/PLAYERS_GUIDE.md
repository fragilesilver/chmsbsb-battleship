# Player's Guide: Battleship Royale

Your crew shares one fleet on a big shared ocean with every other team. Earn shots by answering questions, hunt down the other fleets, and be the **last crew with a ship afloat**.

Playing a pseudocode set? Read the [Pseudocode Lesson](PSEUDOCODE_LESSON.md). It teaches everything the Earn shots, Torpedo and Code tabs use in that set.

---

## Contents

1. [Joining a game](#1-joining-a-game)
2. [Choosing your crew](#2-choosing-your-crew)
3. [Placing your fleet](#3-placing-your-fleet)
4. [Reading the chart](#4-reading-the-chart)
5. [The battle](#5-the-battle)
6. [Four ways to attack](#6-four-ways-to-attack)
7. [Power-ups](#7-power-ups)
   - [Crew roles](#crew-roles)
8. [The storm](#8-the-storm)
9. [Winning (and losing)](#9-winning-and-losing)
10. [Strategy tips](#10-strategy-tips)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Joining a game

1. Open the game link your teacher gives you (or scan the QR code on the projector).
2. Type the **4-letter game code** shown on the board, and your **first name**. If your group is sharing a device, type all your names.
3. **Pick your avatar.** This icon is painted on every ship you place, so your crew can see who put which ship where.
4. Press **Join game**.

If your page refreshes or your laptop sleeps, just open the link again. The game remembers you and puts you back with your crew.

---

## 2. Choosing your crew

Tap the team your teacher assigned you. Each team has its own colour, shown by the little flag (pennant) next to its name.

Your teacher can keep crews **even**: a crew can't get more than one player ahead of the smallest crew. They can also set a **maximum crew size**. A crew you can't join is greyed out and says why ("Full" or "Join a smaller crew first"). It opens again when the other crews catch up.

**Picked the wrong crew?** Press **Leave this crew** while you wait in the lobby, or **Leave ... and pick another crew** at the bottom of the placement panel. You can switch crews any time before the battle starts.

While you wait for your teacher to open fleet placement, you can still **change your avatar**.

---

## 3. Placing your fleet

Your crew shares **one fleet**. Everyone on your crew sees the same ships and can move them, so talk to each other!

Your **home waters** are the bright squares in your team's colour. Ships can only go there.

| To... | Do this |
|---|---|
| Choose a ship | Tap it in the list on the right |
| Turn it | Press **Rotate** (across ↔ down) |
| Place it | Tap the square where its **left end** (across) or **top end** (down) should go. A preview follows your pointer: dark means it fits, red means it doesn't |
| Move a placed ship | Tap it on the chart to pick it up, then tap its new spot |
| Place everything at random | Press **Random**. The ships are shared out between your crew's avatars |
| Finish | When every ship is placed, press **Lock in fleet**. Press **Unlock fleet** to change it again |

Your teacher chooses how many ships each team gets and how big the home waters are, so the ship list can change from game to game. Ships can't overlap, but they can touch.

If your crew hasn't locked in when the battle starts, you get a random fleet.

---

## 4. Reading the chart

Columns are **letters** along the top and rows are **numbers** down the side. A square is named column-then-row: **C7** means column C, row 7.

**Zooming:** use the **−**, **Fit** and **+** buttons above the chart. On a phone or tablet you can also **pinch with two fingers** on the chart. When zoomed in, drag with one finger to move around. The letters and numbers stay at the edges so you always know where you are. **Fit** shows the whole ocean again.

**On a phone** the chart stays pinned to the top of the screen while you scroll the panel underneath, so you can pick a square and press Fire without scrolling back up.

| You see | It means |
|---|---|
| Bright squares in your colour | Your home waters |
| Pale squares tinted in a team colour | That team's waters |
| Dashed lines | Borders between teams' waters |
| Striped squares | Open water that belongs to nobody |
| Greyed-out zone | A team that has been knocked out |
| Dark rounded bar with an avatar | A ship. You see your own ships, sunk ships and ships exposed by the storm. Other crews' ships stay hidden |
| Red **✕** | Hit! |
| Small circle | Miss |
| Brown ship with a grey avatar | Sunk |
| Ship with a dashed yellow outline | An enemy ship exposed by the storm |
| Purple diagonal stripes | The storm |
| Orange diamond | Your sonar found a ship here |
| Small grey dot | Your sonar found clear water here |

---

## 5. The battle

The panel at the top shows your crew's **shots**. They're shared by the whole crew, so if a teammate fires, the count goes down for everyone. A crew can hold up to **8** shots. When you're full, answering questions won't add any more, so spend some!

You get shots by:

- **answering questions** in the **Earn shots** tab
- **free shots**, which your teacher's timer hands to every crew every so often
- **bonus shots** your teacher gives out

When another team hits one of your ships, you'll see an **Incoming!** alert. The **Battle log** lists every hit, sink and knockout.

The **Sound on / Sound off** button at the top right mutes the game.

---

## 6. Four ways to attack

Your teacher can switch any of the Earn shots, Torpedo and Code tabs on or off, so you might not see all of them.

### Fire tab: a normal shot

1. Tap a square in **another team's** waters. It gets a red target ring.
2. Check the weapon is set to **Shot**.
3. Press **Fire**. This uses 1 shot.

You can't fire at your own waters, or at a square that's already been hit by anyone.

### Earn shots tab: answer questions

Answer multiple-choice questions to earn shots for your crew. Your teacher picks the question set, so the questions depend on the lesson. The *General ICT* set is the default for competitions. It covers hardware, software, files, documents, spreadsheets, databases, networks and online safety, and harder questions earn more shots. In a whole-school event, younger years see more easy questions and older years see more hard ones. The *Computer Science 2210 Revision (Ch 1-6)* set covers data representation, data transmission, hardware, software, the internet, and automated and emerging technologies. The notes below describe the pseudocode set. With a revision set there are no generated trace questions, and torpedoes use typed answers instead of code puzzles.

In the pseudocode set, about half come from the question bank (data types, loops, validation, test data, searching and sorting, and more). The other half are **brand-new trace questions made up on the spot**, so you'll rarely see the same one twice:

| Level | Reward |
|---|---|
| Easy | 1 shot |
| Medium | 2 shots |
| Hard | 3 shots |

Get it wrong and you'll see the explanation. Read it! You have to wait **10 seconds** before the next question.

Get **3 right in a row** and your crew earns a **power-up** (see below). A wrong answer resets your streak.

### Torpedo tab: solve the code, never miss

A torpedo is a **free shot** (it uses no shots) that **never misses**. When you load it, it locks on to a square of an enemy ship that hasn't been hit yet. Solve its code puzzle and it's a guaranteed hit.

1. Press **Load a torpedo**.
2. Solve the puzzle. Every torpedo gets one of three kinds at random:

   | Puzzle | What you do | Example answer |
   |---|---|---|
   | **Find the square** | Trace the code to find the square it outputs. You can also tap the square on the chart | `F7` |
   | **Predict the output** | Trace the code and type exactly what it outputs | `12`, `Hit`, `2 5` |
   | **Fill the gap** | One number in the code is replaced by **?**. Type a whole number that makes the program give the output shown | `4` |

3. Press **Launch**.

If you're right, the torpedo hits and you find out where. If another crew hit that square while you were thinking, the torpedo homes in on another enemy ship instead. If you're wrong, the torpedo is lost and you're shown the answer. Either way you wait for it to reload before loading another.

Answers aren't case-sensitive: `hit` and `HIT` both count. For **Fill the gap**, any number that gives the right output is accepted. See [Part 8 of the lesson](PSEUDOCODE_LESSON.md#8-reading-code-trace-tables) for how to trace.

### Code tab: write a program

Write pseudocode using `FIRE(column, row)` and press **Run**. Every `FIRE` launches a real shot and uses 1 of your shots.

```
FOR Row ← 1 TO 7 STEP 2
    FIRE("K", Row)
NEXT Row
```

This fires at K1, K3, K5 and K7.

- **Tap the chart** to add a `FIRE` line for that square.
- The **←** button types the assignment arrow. You can also type `<-`.
- If your code has a mistake, **nothing fires**, and the console tells you which line to fix.
- Squares that were already hit, or are in your own waters, are skipped and cost nothing.
- If you run out of shots partway through, the rest of the program's shots don't fire.

See [Part 9 of the lesson](PSEUDOCODE_LESSON.md#9-writing-code-that-fires) for firing patterns you can copy.

---

## 7. Power-ups

Your crew earns a power-up when anyone on the crew gets **3 questions right in a row**. It's a random choice between a sonar and an airstrike. Your teacher can also send a **supply drop** that gives every crew one of each.

To use one, go to the **Fire** tab, choose it as your weapon, tap a square, and press the button.

| Power-up | What it does | Cost |
|---|---|---|
| **Sonar** | Scans a **3 × 3** area around the square you pick. Squares hiding a ship get an **orange diamond** and clear squares get a **grey dot**. **Only your crew sees the result.** | 1 sonar |
| **Airstrike** | Hits the square you pick **and** the 4 squares above, below, left and right of it (a + shape). It skips your own waters and squares already hit. | 1 airstrike, no shots |

**Combo:** use a sonar first, then aim an airstrike or your shots at the diamonds.

### Crew roles

Your teacher can switch on **crew roles**. When fleet placement opens, one crew member is picked at random to be **captain**.

| Job | What you do | Correct answers earn |
|---|---|---|
| 👑 **Captain** | Places the fleet (nobody else can) and gives everyone a job from the **Your crew** list. Any job nobody has is the captain's. Can hand the captaincy to someone else with **Make captain** | Whatever their own job earns |
| 🎯 **Gunner** | The only one who can **fire shots** and run `FIRE` code. Picks targets from the crew's suggestions | Shots |
| 🧭 **Navigator** | Uses the crew's **sonar** | 1 sonar, then waits (15 seconds unless the teacher changes it) before earning the next |
| 🧪 **Scientist** | Calls in the crew's **airstrikes** | 1 airstrike, then waits (90 seconds unless the teacher changes it) before earning the next |
| ⚓ **Crew** | Earns shots and suggests targets to the gunner | Shots |

- **Everyone** can still launch **torpedoes**, which never miss.
- **Suggesting targets:** if you're not the gunner, tap a square and press **Suggest to the gunner**. Suggested squares get an orange badge on your crew's chart showing how many of you picked them, and they're listed under **Crew suggestions**. The gunner taps one to aim at it. In the **Code** tab, a non-gunner's program suggests its first 5 `FIRE` squares instead of firing.
- A small crew still has every job covered, because the captain does any job nobody else has. A crew of one does everything.
- With roles on, 3 right in a row doesn't give a random power-up. That's the navigator's and scientist's job.

---

## 8. The storm

As the battle goes on, a **storm** closes in from the **edges of the ocean**, one ring of squares at a time. The panel shows how long until it moves again.

**Any ship inside the storm is exposed.** Every crew can see it on their chart, marked with a dashed yellow outline. Exposed ships are easy targets!

---

## 9. Winning (and losing)

- A ship **sinks** when every one of its squares has been hit.
- A crew is **knocked out** when all of its ships have sunk. Its waters turn grey.
- The **last crew with a ship afloat wins.** Your teacher can also end the game at any time.
- In a tournament, a round also ends when the match clock runs out. The surviving crew with the highest round score wins that round.
- In a whole-school event, your year plays 3 rounds and the points add up. The top crew in each year gets a **Join the Grand Final** button after Round 3.

If your fleet is sunk, keep watching. The chart keeps updating until the end. When the game is over, every ship is revealed. Press **Join a new game** to play again.

---

## 10. Strategy tips

- **Keep your shots working.** You can't hold more than 8, so answering questions while full wastes the reward.
- **Share out the jobs.** One crew member answers questions while another fires, and a third traces torpedoes.
- **Don't fire at random.** Ships are at least 2 squares long, so fire at every other square (a checkerboard) until you hit something.
- **After a hit, go hunting.** Fire at the squares above, below, left and right of the hit until you find which way the ship lies.
- **Place ships away from the ocean's edge.** The storm starts at the outside edges, so ships nearer the middle of the ocean stay hidden longer.
- **Don't line up all your ships.** Spread them out and mix across and down.
- **Watch the battle log.** It shows who is attacking whom. A team that's losing ships fast is a good target to finish off.
- **Let code do the boring work.** A 3-line loop can sweep a whole row faster than tapping.

---

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| "No game with code ..." | Check the code on the board. The letter O and the number 0 aren't used, and neither are I and 1 |
| I can't click my ships during placement | Your crew locked in. Press **Unlock fleet** |
| A crew is greyed out | It's full, or it's ahead of the others. Join a smaller crew |
| I joined the wrong crew | Press **Leave this crew** before the battle starts |
| I can't place ships or fire | Crew roles are on: only the captain places ships and only the gunner fires. Suggest targets to your gunner instead |
| The chart is too small on my phone | Press **+** or pinch with two fingers. **Fit** zooms back out |
| The Fire button is greyed out | Pick a target square first, or your crew has run out of that weapon |
| The Fire button says "Crew reloading" | In a whole-school event, your whole crew can only fire once every few seconds. Keep answering questions while you wait: they still score points |
| I got "Your crew can launch a torpedo again in…" | In a whole-school event, your whole crew shares a torpedo limit. Agree who launches next |
| "Couldn't reach the game" | The internet may be slow, or too many devices are connected. Try again, or share a device with your group |
| "That's your own waters" | Aim at a square in another team's colour |
| My shots went down but I didn't fire | A teammate fired. Shots are shared by the crew |
| A tab has disappeared | Your teacher switched that mode off for now |
| No sound on the projector | Click once anywhere on the projector page |

Good hunting, Captain! ⚓

[Pseudocode Lesson →](PSEUDOCODE_LESSON.md) · [Back to the README](../README.md)
