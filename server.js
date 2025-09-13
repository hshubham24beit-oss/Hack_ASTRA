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

// Get all elections for voter panel (only titles + ids, not votes)
app.get("/elections", (req, res) => {
  res.json(elections.map(e => ({ id: e.id, title: e.title, candidates: e.candidates, published: e.published })));
});

// Home page
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
  candidates = candidates.map(c => c.trim()).filter(c => c);

  const newElection = {
    id: Date.now().toString(),
    title,
    candidates,
    votes: Object.fromEntries(candidates.map(c => [c, 0])),
    published: false  // 👈 initially not published
  };

  elections.push(newElection);

  res.send(`
    <html><head>
      <meta charset="utf-8">
      <title>Created</title>
      <link rel="stylesheet" href="/style.css">
      <meta http-equiv="refresh" content="2;url=/" />
    </head>
    <body>
      <div class="result-message success">
        ✅ Election "<strong>${title}</strong>" created successfully!
        <br><br><a href="/">Go Back</a>
      </div>
    </body></html>
  `);
});

// Voter casts vote
app.post("/cast-vote", (req, res) => {
  const { voterId, candidate, electionId } = req.body;

  const election = elections.find(e => e.id === electionId);
  if (!election) return res.send("Invalid election selected");
  if (!election.candidates.includes(candidate)) return res.send("Invalid candidate");

  election.votes[candidate] += 1;

  const newBlock = new Block(
    voteChain.chain.length,
    Date.now().toString(),
    { voterId: voterId || "anon", candidate, election: election.title },
    voteChain.getLatestBlock().hash
  );
  voteChain.addBlock(newBlock);

  // ❌ No view results link here
  res.send(`
    <html><head>
      <meta charset="utf-8">
      <title>Vote Cast</title>
      <link rel="stylesheet" href="/style.css">
      <meta http-equiv="refresh" content="2;url=/" />
    </head>
    <body>
      <div class="vote-message success">
        ✅ Your vote for <strong>${candidate}</strong> in <strong>${election.title}</strong> is recorded.
        <br><br><a href="/">Back to Home</a>
      </div>
    </body></html>
  `);
});

// Admin publishes election results
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

// Results page (shows only published elections)
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

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
