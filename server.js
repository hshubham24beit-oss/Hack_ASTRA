// server.js
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Block, Blockchain } = require("./blockchain");

// Create app
const app = express();
const PORT = 3000;

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory data
let voteChain = new Blockchain();
let elections = []; // <- store multiple elections

// ========================== ROUTES ==========================

// Get all elections for voter panel
app.get("/elections", (req, res) => {
  res.json(elections);
});

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Admin creates election
app.post("/create-election", (req, res) => {
  const title = req.body.title;
  let candidates = req.body.candidates;

  if (!title || !candidates) {
    return res.send("Please provide title and candidates");
  }

  if (!Array.isArray(candidates)) candidates = [candidates];
  candidates = candidates.map(c => String(c).trim()).filter(c => c);

  if (candidates.length === 0) {
    return res.send("Please provide valid candidate names");
  }

  const newElection = {
    id: Date.now().toString(),
    title,
    candidates,
    votes: {}
  };

  candidates.forEach(c => (newElection.votes[c] = 0));

  elections.push(newElection);

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Success - VoteChain</title>
      <link rel="stylesheet" href="/style.css">
      <meta http-equiv="refresh" content="2;url=/" />
    </head>
    <body>
      <div class="result-message success">
        ✅ Election "<strong>${title}</strong>" created successfully!
        <br><br><a href="/">Go Back</a>
      </div>
    </body>
    </html>
  `);
});

// Voter casts vote
app.post("/cast-vote", (req, res) => {
  const { voterId, candidate, electionId } = req.body;

  const election = elections.find(e => e.id === electionId);
  if (!election) {
    return res.send("Invalid election selected");
  }

  if (!election.candidates.includes(candidate)) {
    return res.send("Invalid candidate for selected election");
  }

  election.votes[candidate] += 1;

  const newBlock = new Block(
    voteChain.chain.length,
    Date.now().toString(),
    { voterId: voterId || "anon", candidate, election: election.title },
    voteChain.getLatestBlock().hash
  );
  voteChain.addBlock(newBlock);

  res.send(`
    <!doctype html><html><head>
      <meta charset="utf-8"><title>Vote Cast - VoteChain</title>
      <link rel="stylesheet" href="/style.css">
      <meta http-equiv="refresh" content="3;url=/results" />
    </head><body>
      <div class="vote-message success">
        <div>✅ Your vote for <strong>${candidate}</strong> in <strong>${election.title}</strong> is recorded.</div>
        <a href="/results">View Results</a>
      </div>
    </body></html>
  `);
});

// View results of all elections
app.get("/results", (req, res) => {
  const allResults = elections.length
    ? elections
        .map(
          e => `
          <div class="election">
            <h3>${e.title}</h3>
            ${e.candidates
              .map(c => `<div>${c}: ${e.votes[c]}</div>`)
              .join("")}
          </div>`
        )
        .join("")
    : "<p>No elections created yet</p>";

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Results - VoteChain</title>
      <link rel="stylesheet" href="style.css">
    </head>
    <body>
      <header>
        <nav class="navbar">
          <a href="index.html" class="brand">🏛️ VoteChain</a>
          <div class="nav-links">
            <a href="admin.html">Admin Panel</a>
            <a href="voter.html">Voter Panel</a>
            <a href="/results">View Results</a>
          </div>
        </nav>
      </header>

      <main>
        <h1>All Election Results</h1>
        <div class="results-box">
          ${allResults}
        </div>
        <h2>Blockchain Ledger</h2>
        <pre class="ledger">${JSON.stringify(voteChain.chain, null, 2)}</pre>
        <p><a href="/">🏠 Back to Home</a></p>
      </main>
    </body>
    </html>
  `);
});

// redirect /admin.html to homepage (optional)
app.get("/admin.html", (req, res) => res.redirect("/"));

// Start server
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
