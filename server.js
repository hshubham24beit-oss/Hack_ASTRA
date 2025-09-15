const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Block, Blockchain } = require("./blockchain");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

let voteChain = new Blockchain();
let elections = [];

// 🧠 In-memory voter store { email: { password, voterId } }
let registeredVoters = {};

// Generate random voterId
function generateVoterId() {
  return "VOTER-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

/* ==========================================================
   LOGIN ROUTE — checks email & password and gives voterId
   ========================================================== */
app.post("/login", (req, res) => {
  const { email, password, role } = req.body;

  if (role === "admin" && email === "admin@gmail.com" && password === "123") {
    return res.json({ success: true, role: "admin" });
  }
  if (role === "results" && email === "results@gmail.com" && password === "123") {
    return res.json({ success: true, role: "results" });
  }

  if (role === "voter") {
    if (!email || !password) {
      return res.json({ success: false, message: "Email and password are required" });
    }

    const existing = registeredVoters[email];
    if (!existing) {
      const newVoterId = generateVoterId();
      registeredVoters[email] = { password, voterId: newVoterId };
      return res.json({ success: true, role: "voter", voterId: newVoterId });
    } else {
      if (existing.password === password) {
        return res.json({ success: true, role: "voter", voterId: existing.voterId });
      } else {
        return res.json({ success: false, message: "Wrong password for this email" });
      }
    }
  }

  return res.json({ success: false, message: "Invalid credentials" });
});

/* ==========================================================
   GET all elections (only active based on date) for voter panel
   ========================================================== */
app.get("/elections", (req, res) => {
  const now = new Date();
  const active = elections.filter(e => {
    return new Date(e.startDate) <= now && now <= new Date(e.endDate);
  });
  res.json(active.map(e => ({
    id: e.id,
    title: e.title,
    candidates: e.candidates,
    published: e.published
  })));
});

/* ==========================================================
   Home page
   ========================================================== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ==========================================================
   Admin creates election
   ========================================================== */
app.post("/create-election", (req, res) => {
  const { title, candidates, startDate, endDate } = req.body;

  if (!title || !candidates || !startDate || !endDate) {
    return res.send("Please provide title, candidates, startDate, and endDate");
  }

  let candidateList = candidates;
  if (!Array.isArray(candidateList)) {
    candidateList = candidateList.split(",").map(c => c.trim());
  }

  const newElection = {
    id: Date.now().toString(),
    title,
    candidates: candidateList,
    votes: {},
    voted: [],
    published: false,
    startDate: new Date(startDate).toISOString(),
    endDate: new Date(endDate).toISOString()
  };

  candidateList.forEach(c => newElection.votes[c] = 0);
  elections.push(newElection);

  res.send(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8">
    <title>Success - VoteChain</title>
    <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <div class="result-message success">
        ✅ Election "<strong>${title}</strong>" created successfully!
        <br><br><a href="/">Go Back</a>
      </div>
    </body></html>
  `);
});

/* ==========================================================
   Voter casts vote
   ========================================================== */
app.post('/cast-vote', (req, res) => {
  const { voterId, candidate, electionId } = req.body;

  if (!voterId) {
    return res.send(`<div class="vote-message error">No voter ID provided. Please login first. <a href="/login.html">Login</a></div>`);
  }

  const election = elections.find(e => e.id === electionId);
  if (!election) {
    return res.send(`<div class="vote-message error">Invalid election selected. <a href="/voter.html">Back</a></div>`);
  }

  // Check election time validity
  const now = new Date();
  if (now < new Date(election.startDate) || now > new Date(election.endDate)) {
    return res.send(`<div class="vote-message error">This election is not active currently.</div>`);
  }

  if (election.voted.includes(voterId)) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Vote Error</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <div class="error-box">
          <h1>⚠️ Already Voted</h1>
          <p>You have already cast your vote in "<strong>${election.title}</strong>".</p>
          <a href="/voter.html" class="back-btn">Back to Voter Panel</a>
        </div>
      </body>
      </html>
    `);
  }

  if (!election.candidates.includes(candidate)) {
    return res.send(`<div class="vote-message error">Invalid candidate. <a href="/voter.html">Choose again</a></div>`);
  }

  election.votes[candidate] = (election.votes[candidate] || 0) + 1;
  election.voted.push(voterId);

  const newBlock = new Block(
    voteChain.chain.length,
    Date.now().toString(),
    { voterId: voterId, candidate, election: election.title },
    voteChain.getLatestBlock().hash
  );
  voteChain.addBlock(newBlock);

  res.send(`
    <!doctype html><html><head>
      <meta charset="utf-8"><title>Vote Cast</title>
      <link rel="stylesheet" href="/style.css">
      <meta http-equiv="refresh" content="3;url=/" />
    </head><body>
      <div class="vote-message success">
        ✅ Your vote for <strong>${candidate}</strong> in <strong>${election.title}</strong> is recorded.
        <br><br><a href="/">Back to Home</a>
      </div>
    </body></html>
  `);
});

/* ==========================================================
   Admin publishes election results
   ========================================================== */
app.post("/publish-results/:id", (req, res) => {
  const election = elections.find(e => e.id === req.params.id);
  if (!election) return res.send("Election not found");
  election.published = true;

  res.send(`
    <html><head>
      <meta charset="utf-8">
      <title>Published</title>
      <link rel="stylesheet" href="/style.css">
      <meta http-equiv="refresh" content="2;url=/" />
    </head>
    <body>
      <div class="result-message success">
        📢 Results for "<strong>${election.title}</strong>" have been published.
        <br><br><a href="/">Go Back</a>
      </div>
    </body></html>
  `);
});

/* ==========================================================
   Results page
   ========================================================== */
app.get("/results", (req, res) => {
  const published = elections.filter(e => e.published);

  if (!published.length) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Results - VoteChain</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body class="no-results">
        <h2>No results are published yet.</h2>
        <a href="/" class="back-link">🏠 Back to Home</a>
      </body>
      </html>
    `);
  }

  const allResults = published.map(e => `
    <div class="election-card">
      <h3>${e.title}</h3>
      <div class="candidate-list">
        ${e.candidates.map(c => `
          <div class="candidate">
            <span>${c}</span>
            <span class="vote-count">${e.votes[c]} votes</span>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Results - VoteChain</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <header class="navbar">
        <div class="brand">🏛️ VoteChain</div>
        <div class="nav-links">
          <a href="/">Home</a>
          <a href="admin.html">Admin Panel</a>
          <a href="voter.html">Voter Panel</a>
        </div>
      </header>

      <div class="content">
        <h1>📢 Published Election Results</h1>
        ${allResults}
        <h2>Blockchain Ledger</h2>
        <pre class="ledger">${JSON.stringify(voteChain.chain, null, 2)}</pre>
        <a href="/" class="back-link">🏠 Back to Home</a>
      </div>
    </body>
    </html>
  `);
});

/* ========================================================== */
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
