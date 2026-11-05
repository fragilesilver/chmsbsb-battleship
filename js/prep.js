// Championship Prep page: plan ticks, year focus, practice hunt and revision quizzes.
// Runs entirely in the browser. It doesn't use Firebase, so it can't affect a game
// or use up any of the game's connections.

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

// Saved ticks are a convenience: the page must still work if storage is blocked.
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not saved on this device */ }
};

// ---------- 7-day plan ----------
const PLAN = [
  ["Day 1: Learn the game", "Read How the game works, then play the Practice hunt twice."],
  ["Day 2: Hardware and software", "Revise Hardware & Devices and Software & Operating Systems, then try their questions."],
  ["Day 3: Files and documents", "Revise Files, Data & Storage and Documents & Presentations, then try their questions."],
  ["Day 4: Spreadsheets", "Revise Spreadsheets. If you can, try the formulas in a real spreadsheet."],
  ["Day 5: Databases", "Revise Databases. Make sure you can explain record, field, query and primary key."],
  ["Day 6: Networks and safety", "Revise Networks & the Internet and Online Safety & Ethics, then try their questions."],
  ["Day 7: Crew practice", "Meet your group, agree your jobs, read the battle tips and retry the questions you got wrong."],
];
const PLAN_KEY = "chms-prep-plan";

function renderPlan() {
  const done = new Set(load(PLAN_KEY, []));
  const list = $("plan-list");
  const update = () => {
    const n = PLAN.filter((_, i) => done.has(i)).length;
    $("plan-progress").textContent = n === PLAN.length
      ? "All 7 days done. Your crew is ready!"
      : `${n} of ${PLAN.length} days done`;
  };
  PLAN.forEach(([title, task], i) => {
    const item = el("li", done.has(i) ? "done" : "");
    const label = el("label");
    const box = el("input");
    box.type = "checkbox";
    box.checked = done.has(i);
    box.addEventListener("change", () => {
      if (box.checked) done.add(i); else done.delete(i);
      item.classList.toggle("done", box.checked);
      save(PLAN_KEY, [...done]);
      update();
    });
    label.append(box, el("b", "", title), el("span", "", task));
    item.append(label);
    list.append(item);
  });
  update();
}

// ---------- year focus ----------
const YEARS = [
  { id: "Y7", name: "Year 7", mix: [60, 30, 10], focus: "Year 7 plays on Wednesday 18 November. Most questions are easy, so master Start here in every topic first. Then move on to Level up." },
  { id: "Y8", name: "Year 8", mix: [50, 35, 15], focus: "Year 8 plays on Wednesday 18 November. Half your questions are easy. Know Start here well, then spend most of your time on Level up." },
  { id: "Y9", name: "Year 9", mix: [35, 40, 25], focus: "Year 9 plays on Tuesday 10 November. Medium questions are the most common. Make Level up your main target, and learn Champion too." },
  { id: "Y10", name: "Year 10", mix: [25, 40, 35], focus: "Year 10 plays on Tuesday 10 November. Three in every four questions are medium or hard. Check Start here quickly, then concentrate on Level up and Champion." },
  { id: "final", name: "Grand Final", mix: [34, 33, 33], focus: "The Grand Final is on Wednesday 25 November. It has an even mix of easy, medium and hard, so every level matters. Revise all three." },
];
const YEAR_KEY = "chms-prep-year";

function renderYears() {
  const picker = $("year-picker");
  const mix = $("mix");
  const rows = {};
  const buttons = {};
  const choose = (id) => {
    const year = YEARS.find((y) => y.id === id);
    $("year-focus").textContent = year ? year.focus : "Pick your year above.";
    for (const y of YEARS) {
      buttons[y.id].setAttribute("aria-pressed", String(y.id === id));
      rows[y.id].classList.toggle("on", y.id === id);
    }
  };
  for (const y of YEARS) {
    const btn = el("button", "btn", y.name);
    btn.type = "button";
    btn.addEventListener("click", () => { save(YEAR_KEY, y.id); choose(y.id); });
    buttons[y.id] = btn;
    picker.append(btn);

    const row = el("div", "mix-row");
    const bar = el("div", "bar");
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", `${y.name}: ${y.mix[0]}% easy, ${y.mix[1]}% medium, ${y.mix[2]}% hard`);
    ["easy", "medium", "hard"].forEach((level, i) => {
      const part = el("span", level, String(y.mix[i]));
      part.style.width = `${y.mix[i]}%`;
      bar.append(part);
    });
    row.append(el("span", "mix-name", y.name), bar);
    rows[y.id] = row;
    mix.append(row);
  }
  choose(load(YEAR_KEY, null));
}

// ---------- practice hunt ----------
const SIZE = 6;
const LETTERS = "ABCDEF";
const SHIP_LENGTHS = [3, 2];
const FEWEST_SHOTS = SHIP_LENGTHS.reduce((a, b) => a + b, 0);
const nameOf = (r, c) => `${LETTERS[c]}${r + 1}`;

function placeShips() {
  const taken = new Set();
  return SHIP_LENGTHS.map((len) => {
    for (;;) {
      const across = Math.random() < 0.5;
      const r0 = Math.floor(Math.random() * (across ? SIZE : SIZE - len + 1));
      const c0 = Math.floor(Math.random() * (across ? SIZE - len + 1 : SIZE));
      const cells = Array.from({ length: len }, (_, i) => (across ? `${r0},${c0 + i}` : `${r0 + i},${c0}`));
      if (cells.every((k) => !taken.has(k))) {
        cells.forEach((k) => taken.add(k));
        return { len, cells, hits: new Set() };
      }
    }
  });
}

function setupHunt() {
  const board = $("hunt-board");
  const status = $("hunt-status");
  const shotsEl = $("hunt-shots");
  const pattern = $("hunt-pattern");
  const cells = {};
  let ships, shots;

  board.append(el("span"));
  for (const letter of LETTERS) board.append(el("span", "hunt-label", letter));
  for (let r = 0; r < SIZE; r++) {
    board.append(el("span", "hunt-label", String(r + 1)));
    for (let c = 0; c < SIZE; c++) {
      const cell = el("button", "hunt-cell");
      cell.type = "button";
      cell.dataset.key = `${r},${c}`;
      cell.addEventListener("click", () => fireAt(r, c));
      cells[cell.dataset.key] = cell;
      board.append(cell);
    }
  }

  const applyPattern = () => {
    for (const [key, cell] of Object.entries(cells)) {
      const [r, c] = key.split(",").map(Number);
      cell.classList.toggle("pattern", pattern.checked && (r + c) % 2 === 0);
    }
  };

  function start() {
    ships = placeShips();
    shots = 0;
    shotsEl.textContent = "0";
    status.textContent = "Tap any square to fire.";
    for (const [key, cell] of Object.entries(cells)) {
      const [r, c] = key.split(",").map(Number);
      cell.className = "hunt-cell";
      cell.textContent = "";
      cell.disabled = false;
      cell.setAttribute("aria-label", `Fire at ${nameOf(r, c)}`);
    }
    applyPattern();
  }

  function fireAt(r, c) {
    const key = `${r},${c}`;
    const cell = cells[key];
    const name = nameOf(r, c);
    shots++;
    shotsEl.textContent = String(shots);
    cell.disabled = true;
    const ship = ships.find((s) => s.cells.includes(key));
    if (!ship) {
      cell.classList.add("miss");
      cell.textContent = "○";
      cell.setAttribute("aria-label", `${name}: miss`);
      status.textContent = `${name}: miss.`;
      return;
    }
    ship.hits.add(key);
    cell.classList.add("hit");
    cell.textContent = "✕";
    cell.setAttribute("aria-label", `${name}: hit`);
    if (ship.hits.size < ship.len) {
      status.textContent = `${name}: hit! Try the squares next to it.`;
      return;
    }
    ship.cells.forEach((k) => { cells[k].classList.add("sunk"); });
    if (ships.every((s) => s.hits.size === s.len)) {
      Object.values(cells).forEach((b) => { b.disabled = true; });
      status.textContent = `Both ships sunk in ${shots} shots! The fewest possible is ${FEWEST_SHOTS}. Press New hunt to try again.`;
    } else {
      status.textContent = `${name}: you sank the ${ship.len}-square ship! One left.`;
    }
  }

  pattern.addEventListener("change", applyPattern);
  $("hunt-new").addEventListener("click", start);
  start();
}

// ---------- revision topics ----------
// These notes cover the competition's topics. The practice questions are written
// for this page and don't repeat questions from data/ict-general.json.
const TOPICS = [
  {
    name: "1. Hardware & Devices",
    start: [
      "Input devices send data in: keyboard, mouse, microphone, scanner, webcam.",
      "Output devices send information out: monitor, printer, speaker, projector.",
      "A touchscreen is both input and output.",
      "The CPU (Central Processing Unit) carries out instructions. It's often called the computer's brain.",
    ],
    level: [
      "RAM holds what's in use now, and loses it when the power goes off. We call that volatile.",
      "ROM keeps the start-up instructions even without power.",
      "An HDD has moving parts. An SSD uses flash memory with no moving parts, so it copes better with knocks.",
      "Know the special devices: barcode readers scan products, plotters draw large, precise plans, and sensors are input devices.",
    ],
    champ: [
      "Cache is small, very fast memory that keeps frequently used data close to the CPU.",
      "An embedded system is a computer built into a larger device for one job, such as in a washing machine.",
      "In a control system, a sensor measures and an actuator makes the physical movement.",
    ],
    quiz: [
      { level: "Easy", q: "Which of these stores data?", options: ["Speaker", "Webcam", "Hard disk", "Joystick"], answer: 2, explain: "A hard disk is a storage device. The others are input or output devices." },
      { level: "Medium", q: "A headset has earphones and a microphone. What kind of device is it?", options: ["Input only", "Output only", "Both input and output", "Storage"], answer: 2, explain: "The microphone is input, and the earphones are output." },
      { level: "Hard", q: "A computer slows down when many programs are open. Which upgrade is most likely to help?", options: ["A bigger monitor", "More RAM", "A louder speaker", "A longer cable"], answer: 1, explain: "Open programs are held in RAM, so more RAM lets more of them run smoothly." },
      { level: "Typed", q: "What does the U in USB stand for?", accept: ["universal"], explain: "USB stands for Universal Serial Bus." },
    ],
  },
  {
    name: "2. Software & Operating Systems",
    start: [
      "Hardware is the physical equipment. Software is the programs that tell it what to do.",
      "Operating systems include Windows, plus Android and iOS on phones and tablets.",
      "Applications do jobs for you: word processors, photo editors and web browsers such as Chrome.",
      "Installing sets a program up on your device. An icon is a small picture you click to open something.",
    ],
    level: [
      "An operating system manages files, memory and connected devices.",
      "System software runs the computer. Application software does tasks for the user.",
      "A device driver lets the operating system work with hardware such as a printer.",
      "A GUI lets you use windows, icons and menus. Utility software looks after the computer, such as a disk clean-up tool.",
      "Install updates, because they often fix bugs and security problems.",
    ],
    champ: [
      "Open-source software has source code that others can view and change.",
      "Web apps run in a browser, and their files are often stored online.",
      "Multitasking works because the operating system quickly shares processor time between programs.",
    ],
    quiz: [
      { level: "Easy", q: "Which of these is hardware?", options: ["Excel", "A printer", "Windows", "Chrome"], answer: 1, explain: "A printer is physical equipment. The others are software." },
      { level: "Medium", q: "What kind of software is an antivirus program?", options: ["A game", "A word processor", "Utility software", "Hardware"], answer: 2, explain: "Utility software helps to maintain and protect a computer." },
      { level: "Hard", q: "What does a software licence tell you?", options: ["How fast the program runs", "The rules for how you may use the software", "Where the computer was made", "How many files you own"], answer: 1, explain: "A licence sets out what you're allowed to do with the software." },
      { level: "Typed", q: "What short word means a fault in a program?", accept: ["bug", "a bug"], explain: "A bug is a fault in a program. Updates often fix them." },
    ],
  },
  {
    name: "3. Files, Data & Storage",
    start: [
      "8 bits make 1 byte. From smallest to largest: KB, MB, GB, TB.",
      "File extensions show the type: .jpg is a picture, .mp3 is sound, .xlsx is a spreadsheet.",
      "Folders group files. Save As saves with a new name or in a new place.",
      "USB flash drives are portable. Cloud storage keeps files on Internet servers.",
    ],
    level: [
      "A backup is a spare copy. Keep it somewhere separate, so a fire or theft can't destroy both.",
      "Compression makes files smaller, so they're quicker to send and easier to store.",
      "A PDF keeps its layout on most devices, so it's good for sharing finished work.",
      "Use clear file names, such as Y8_Science_Project. HD video uses far more storage than text.",
    ],
    champ: [
      "1 MB is about 1,000 KB, and 1 GB is about 1,000 MB.",
      "Lossy compression permanently removes some data, as JPEG photos do. Lossless keeps all of it, as ZIP files do.",
      "Binary uses only 0 and 1. In four digits, the place values are 8, 4, 2 and 1.",
    ],
    quiz: [
      { level: "Easy", q: "What does a .mp3 file usually contain?", options: ["Sound", "A spreadsheet", "A photo", "A slide show"], answer: 0, explain: ".mp3 is a common sound format." },
      { level: "Medium", q: "You need to email a folder of 20 photos. What should you do first to make it easier to send?", options: ["Rename the folder", "Compress it into a ZIP file", "Print the photos", "Change the wallpaper"], answer: 1, explain: "A ZIP file is one smaller file, which is easier to attach." },
      { level: "Hard", q: "What does the binary number 0110 equal in denary?", options: ["2", "4", "6", "110"], answer: 2, explain: "The place values are 8, 4, 2 and 1, so 4 + 2 = 6." },
      { level: "Typed", q: "How many bits are in 2 bytes? (type the number)", accept: ["16", "sixteen"], explain: "Each byte is 8 bits, and 2 × 8 = 16." },
    ],
  },
  {
    name: "4. Documents & Presentations",
    start: [
      "Use a word processor for letters, and PowerPoint or Google Slides for slide shows.",
      "Windows shortcuts: Ctrl + C copies, Ctrl + V pastes, Ctrl + Z undoes, Ctrl + S saves and Ctrl + P prints.",
      "Bold makes text thicker. A spell checker finds possible spelling mistakes.",
      "Each page of a presentation is called a slide.",
    ],
    level: [
      "Good slides have short points and high-contrast colours, such as dark text on white.",
      "Headers and footers repeat on every page, so page numbers go there.",
      "Justified text lines up along both margins.",
      "Cut removes the original. Copy leaves it in place.",
      "A transition is the effect shown when one slide changes to the next.",
    ],
    champ: [
      "Heading styles keep formatting consistent and let you create an automatic contents page.",
      "Mail merge combines one letter with a list of data to make personalised copies.",
      "Stretching a photo by one side changes its aspect ratio and distorts it.",
    ],
    quiz: [
      { level: "Easy", q: "Which Windows shortcut normally saves your work?", options: ["Ctrl + S", "Ctrl + X", "Ctrl + B", "Ctrl + I"], answer: 0, explain: "Ctrl + S saves. Make it a habit." },
      { level: "Medium", q: "Which feature shows how a document will look on paper before you use any?", options: ["Print preview", "Spell check", "Word count", "Find and replace"], answer: 0, explain: "Print preview shows the printed layout, so you can fix problems first." },
      { level: "Hard", q: "What does a slide master let you do?", options: ["Delete all your files", "Set the layout and style for many slides at once", "Check your spelling", "Send the slides by email"], answer: 1, explain: "Change the master, and every slide that uses it changes too." },
      { level: "Typed", q: "Which letter is used with Ctrl to select everything on Windows?", accept: ["a", "ctrl a", "ctrl+a", "ctrl + a"], explain: "Ctrl + A selects all." },
    ],
  },
  {
    name: "5. Spreadsheets",
    start: [
      "One box is a cell. Columns use letters and rows use numbers, so B3 is column B, row 3.",
      "Every formula starts with =.",
      "Use * to multiply and / to divide.",
      "SUM adds a group of numbers. Excel and Google Sheets are spreadsheet programs.",
    ],
    level: [
      "A range such as A1:A5 means all the cells from A1 to A5.",
      "AVERAGE finds the mean, MAX the highest, MIN the lowest, and COUNT how many numbers there are.",
      "Results update automatically when a number that the formula uses changes.",
      "Pie charts show parts of a whole. ##### usually means the column is too narrow.",
    ],
    champ: [
      "Relative references change when copied: =A1+B1 copied down a row becomes =A2+B2.",
      "$ fixes a reference: $A$1 doesn't change when copied.",
      "=IF(test, if true, if false) gives one of two results. Check tests such as >= carefully.",
      "Multiplication and division are done before addition and subtraction.",
    ],
    quiz: [
      { level: "Easy", q: "Which symbol divides in a spreadsheet formula?", options: ["/", "x", "#", "&"], answer: 0, explain: "=A1/B1 divides A1 by B1." },
      { level: "Medium", q: "What is A1:A5 called in a formula?", options: ["A slide", "A range", "A record", "A chart"], answer: 1, explain: "A range is a group of cells, written first cell : last cell." },
      { level: "Hard", q: "A1 is 3, A2 is 9 and A3 is 5. What does =MAX(A1:A3)-MIN(A1:A3) show?", options: ["4", "6", "9", "17"], answer: 1, explain: "The highest is 9 and the lowest is 3, so 9 − 3 = 6." },
      { level: "Typed", q: "Which function counts how many numbers are in a range? (five letters)", accept: ["count", "=count"], explain: "COUNT tells you how many cells contain numbers." },
    ],
  },
  {
    name: "6. Databases",
    start: [
      "A database is an organised collection of data, such as a school library system.",
      "A record is all the data about one person or thing. A field is one category, such as Date of Birth.",
      "Sorting puts data in order.",
      "Choose a suitable data type: text for names, date for dates, and Yes/No when only two answers are possible.",
    ],
    level: [
      "A query finds data that matches criteria. A filter shows only matching records, without deleting the rest.",
      "A primary key, such as Student ID, is unique for every record.",
      "Store phone numbers as text, to keep any leading zero.",
      "Validation checks that data is sensible. A range check rejects values outside set limits.",
    ],
    champ: [
      "Validation checks that data is reasonable. Verification checks that it was entered correctly, such as by double entry.",
      "Linking tables stores each fact once, which reduces repeated data and errors.",
      "AND needs both conditions to be true. OR needs at least one.",
    ],
    quiz: [
      { level: "Easy", q: "Which data type is best for the day a student joined the school?", options: ["Yes/No", "Date", "Picture", "Currency"], answer: 1, explain: "A date type stores dates and lets you sort them properly." },
      { level: "Medium", q: "A school code must be two letters and then four numbers. Which check tests this?", options: ["Format check", "Spell check", "Print preview", "Backup"], answer: 0, explain: "A format check makes sure that data follows a set pattern." },
      { level: "Hard", q: "Which criteria finds all students who are in Year 7 or in Year 8?", options: ["Year = 7 AND Year = 8", "Year = 7 OR Year = 8", "NOT Year = 7", "Year > 8"], answer: 1, explain: "One student can't be in both years, so AND would find nobody. OR finds both groups." },
      { level: "Typed", q: "What word means putting records in order, such as A to Z?", accept: ["sort", "sorting", "sorted"], explain: "Sorting arranges records in order." },
    ],
  },
  {
    name: "7. Networks & the Internet",
    start: [
      "A network connects devices so that they can share data and resources. Wi-Fi does this without a cable.",
      "www stands for World Wide Web. A URL is the address of a web page.",
      "Search engines, such as Google and Bing, find information on the web.",
      "Downloading brings a file to your device. Uploading sends one away. Email addresses always contain @.",
    ],
    level: [
      "A LAN covers a small area, such as a school. A WAN covers a large area, and the Internet is the largest.",
      "A router directs data between networks.",
      "HTTPS encrypts the connection, but it doesn't prove that a site can be trusted.",
      "Bandwidth is how much data can be transferred per second.",
      "The Internet is the global network. The Web is the pages reached over it. CC sends someone a copy of an email.",
    ],
    champ: [
      "DNS translates website names into IP addresses, like a phone book.",
      "Data is split into packets, which are put back together at the destination.",
      "Fibre-optic cables carry light, with less signal loss and higher speeds than copper over long distances.",
    ],
    quiz: [
      { level: "Easy", q: "You send a photo from your phone to a website. What is this called?", options: ["Uploading", "Downloading", "Scanning", "Printing"], answer: 0, explain: "Uploading sends data from your device. Downloading brings data to it." },
      { level: "Medium", q: "What is an IP address?", options: ["A number that identifies a device on a network", "A home address", "A type of password", "A printer setting"], answer: 0, explain: "Devices use IP addresses to find each other on a network." },
      { level: "Hard", q: "Video keeps stopping when a whole school streams at once. What is the most likely reason?", options: ["The screens are too bright", "The shared bandwidth is being used up", "The keyboards are too old", "The files have too many folders"], answer: 1, explain: "Everyone shares the available bandwidth, so each person gets less." },
      { level: "Typed", q: "What does the W in WAN stand for?", accept: ["wide"], explain: "WAN stands for Wide Area Network." },
    ],
  },
  {
    name: "8. Online Safety & Ethics",
    start: [
      "Use long, hard-to-guess passwords, keep them private, and log out of shared computers.",
      "Never share personal details with strangers online. Tell a trusted adult if something worries you.",
      "Cyberbullying uses technology to repeatedly hurt someone. Save the evidence and tell an adult.",
      "Viruses are harmful programs. Be suspicious of messages that promise prizes and ask you to click.",
    ],
    level: [
      "Phishing uses fake messages to trick people into giving personal details.",
      "Your digital footprint is the record of what you do and share online.",
      "Copyright protects creators' work. Plagiarism is presenting someone else's work as your own.",
      "Two-factor authentication adds a second proof of who you are, such as a code on your phone.",
      "Check information by comparing it with other trusted sources.",
    ],
    champ: [
      "Ransomware locks or encrypts files and demands payment. Good backups reduce the harm.",
      "A firewall monitors network traffic and blocks unauthorised access.",
      "Public Wi-Fi is riskier because others may be able to intercept unprotected data, so avoid sensitive logins on it.",
    ],
    quiz: [
      { level: "Easy", q: "A pop-up says your phone has a virus and tells you to tap a button. What should you do?", options: ["Tap it quickly", "Enter your password", "Close it and tell a trusted adult", "Send it to your friends"], answer: 2, explain: "Scary pop-ups are a common scam. Don't tap, and ask for help." },
      { level: "Medium", q: "Which is the best password habit?", options: ["Use one password for everything", "Use a different password for each account", "Use your name", "Share it with your best friend"], answer: 1, explain: "If one password is stolen, your other accounts stay safe." },
      { level: "Hard", q: "What does spyware do?", options: ["Secretly collects information about you", "Makes your Wi-Fi faster", "Backs up your files", "Checks your spelling"], answer: 0, explain: "Spyware is a type of malware that watches what you do without your permission." },
      { level: "Typed", q: "In 2FA, what does the F stand for?", accept: ["factor"], explain: "2FA stands for two-factor authentication." },
    ],
  },
];

function renderQuiz(topic) {
  const wrap = el("div", "quiz");
  wrap.append(el("h4", "", "Practice questions"));
  const score = el("p", "q-score", `0 of ${topic.quiz.length} answered`);
  let answered = 0, right = 0;
  const finish = (result, ok, explain) => {
    answered++;
    if (ok) right++;
    result.replaceChildren(el("b", ok ? "good" : "bad", ok ? "Correct! " : "Not quite. "), explain);
    score.textContent = answered === topic.quiz.length
      ? `You scored ${right} of ${topic.quiz.length}.`
      : `${answered} of ${topic.quiz.length} answered`;
  };
  for (const item of topic.quiz) {
    const box = el("div", "q");
    box.append(el("div", "q-level", item.level), el("p", "q-text", item.q));
    const result = el("p", "q-result");
    result.setAttribute("role", "status");
    if (item.options) {
      const opts = el("div", "q-options");
      const buttons = item.options.map((text, i) => {
        const btn = el("button", "btn", text);
        btn.type = "button";
        btn.addEventListener("click", () => {
          buttons.forEach((b) => { b.disabled = true; });
          buttons[item.answer].classList.add("right");
          if (i !== item.answer) btn.classList.add("wrong");
          finish(result, i === item.answer, item.explain);
        });
        return btn;
      });
      opts.append(...buttons);
      box.append(opts);
    } else {
      const form = el("form", "q-typed");
      form.autocomplete = "off";
      const input = el("input");
      input.setAttribute("aria-label", item.q);
      input.autocapitalize = "off";
      input.spellcheck = false;
      const go = el("button", "btn", "Launch");
      go.type = "submit";
      form.append(input, go);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const typed = input.value.trim().toLowerCase();
        if (!typed) return;
        input.disabled = true;
        go.disabled = true;
        const ok = item.accept.includes(typed);
        finish(result, ok, ok ? item.explain : `The answer is "${item.accept[0]}". ${item.explain}`);
      });
      box.append(form);
    }
    box.append(result);
    wrap.append(box);
  }
  wrap.append(score);
  return wrap;
}

function renderTopics() {
  const host = $("topics");
  for (const topic of TOPICS) {
    const details = el("details", "topic");
    details.append(el("summary", "", topic.name));
    const body = el("div", "topic-body");
    const tiers = el("div", "tiers");
    for (const [title, notes] of [["Start here", topic.start], ["Level up", topic.level], ["Champion", topic.champ]]) {
      const tier = el("section", "tier");
      const ul = el("ul");
      notes.forEach((note) => ul.append(el("li", "", note)));
      tier.append(el("h4", "", title), ul);
      tiers.append(tier);
    }
    body.append(tiers, renderQuiz(topic));
    details.append(body);
    host.append(details);
  }
}

renderPlan();
renderYears();
setupHunt();
renderTopics();
