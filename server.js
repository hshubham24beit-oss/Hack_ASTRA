// server.js
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Block, Blockchain } = require("./blockchain");

// ✅ create express app first
const app = express();
const PORT = 3000;

// ✅ middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// In-memory blockchain + election data
let voteChain = new Blockchain();
let election = { title: "", candidates: [] };
let votes = {};

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Admin creates election
// Admin creates election (styled response)
app.post("/create-election", (req, res) => {
  const title = req.body.title;
  let candidates = req.body.candidates;

  if (!title || !candidates) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Create Election - VoteChain</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <div class="result-message error">
          ❌ Please provide election title and candidates
          <br><br>
          <a href="/">Go Back</a>
        </div>
      </body>
      </html>
    `);
  }

  if (!Array.isArray(candidates)) candidates = [candidates];
  election = { title, candidates };
  votes = {};
  candidates.forEach(c => votes[c] = 0);

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Success - VoteChain</title>
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <div class="result-message success">
        ✅ Election "<strong>${title}</strong>" created successfully!
        <br><br>
        <a href="/">Go Back</a>
      </div>
    </body>
    </html>
  `);
});

// Voter casts vote
// Voter casts vote (styled response)
app.post("/cast-vote", (req, res) => {
  const { voterId, candidate } = req.body;

  if (!election.title) {
    return res.send(`
      <!doctype html><html><head>
        <meta charset="utf-8"><title>No Election - VoteChain</title>
        <link rel="stylesheet" href="/style.css">
        <meta http-equiv="refresh" content="4;url=/" />
      </head><body>
        <div class="vote-message error">
          <div><strong>Error:</strong> No active election. Ask admin to create one.</div>
          <a href="/">Go Back</a>
        </div>
      </body></html>
    `);
  }

  if (!election.candidates.includes(candidate)) {
    return res.send(`
      <!doctype html><html><head>
        <meta charset="utf-8"><title>Invalid Candidate - VoteChain</title>
        <link rel="stylesheet" href="/style.css">
        <meta http-equiv="refresh" content="4;url=/voter.html" />
      </head><body>
        <div class="vote-message error">
          <div><strong>Error:</strong> Invalid candidate selected.</div>
          <a href="/voter.html">Choose Again</a>
        </div>
      </body></html>
    `);
  }

  // record vote
  votes[candidate] = (votes[candidate] || 0) + 1;

  const newBlock = new Block(
    voteChain.chain.length,
    Date.now().toString(),
    { voterId: voterId || "anon", candidate },
    voteChain.getLatestBlock().hash
  );
  voteChain.addBlock(newBlock);

  // styled success response, with link to results (auto-redirect after 4s)
  res.send(`
    <!doctype html><html><head>
      <meta charset="utf-8"><title>Vote Cast - VoteChain</title>
      <link rel="stylesheet" href="/style.css">
      <meta http-equiv="refresh" content="4;url=/results" />
    </head><body>
      <div class="vote-message success">
        <div>✅ Your vote for <strong>${candidate}</strong> has been recorded.</div>
        <a href="/results">View Results Now</a>
      </div>
    </body></html>
  `);
});


// View results
// View results with styled HTML
app.get("/results", (req, res) => {
  const candidateResults = election.candidates.length
    ? election.candidates.map(c => `<div class="candidate"><strong>${c}</strong>: ${votes[c]}</div>`).join("")
    : "<p>No candidates</p>";

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
        <h1>Election Results: ${election.title || "No election created yet"}</h1>
        <div class="results-box">
          ${candidateResults}
        </div>
        <h2>Blockchain Ledger</h2>
        <pre class="ledger">${JSON.stringify(voteChain.chain, null, 2)}</pre>
        <p><a href="/">🏠 Back to Home</a></p>
      </main>
    </body>
    </html>
  `);
});


// Start server
// Send current election data as JSON
app.get("/election-data", (req, res) => {
  res.json(election);
});

// Redirect admin.html link to homepage
app.get("/admin.html", (req, res) => {
  res.redirect("/");
});


app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
