require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const mongoose = require("mongoose");
const { Block, Blockchain } = require("./blockchain");

const app = express();
const PORT = process.env.PORT || 3000;

/* ------------------------- CONNECT TO MONGODB ------------------------- */
mongoose.set("strictQuery", false);

const mongoURI =
  process.env.MONGO_URI ||
  "mongodb+srv://hshubham24beit_db_user:Shubham9769517001@cluster0.plupwfh.mongodb.net/votechain?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ------------------------- SCHEMAS ------------------------- */
const voterSchema = new mongoose.Schema({
  email: String,
  password: String,
  voterId: String,
});

const electionSchema = new mongoose.Schema({
  title: String,
  candidates: [String],
  votes: Object,
  voted: [String],
  published: { type: Boolean, default: false },
  startDate: Date,
  endDate: Date,
});

const Voter = mongoose.model("Voter", voterSchema);
const Election = mongoose.model("Election", electionSchema);

/* ------------------------- APP CONFIG ------------------------- */
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

let voteChain = new Blockchain();

/* ==========================================================
   LOGIN ROUTE
   ========================================================== */
app.post("/login", async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (role === "admin" && email === "admin@gmail.com" && password === "123")
      return res.json({ success: true, role: "admin" });

    if (role === "results" && email === "results@gmail.com" && password === "123")
      return res.json({ success: true, role: "results" });

    if (role === "voter") {
      if (!email || !password)
        return res.json({ success: false, message: "Email and password are required" });

      let voter = await Voter.findOne({ email });
      if (!voter) {
        voter = await Voter.create({
          email,
          password,
          voterId: "VOTER-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
        });
      } else if (voter.password !== password) {
        return res.json({ success: false, message: "Wrong password for this email" });
      }

      return res.json({ success: true, role: "voter", voterId: voter.voterId });
    }

    return res.json({ success: false, message: "Invalid credentials" });
  } catch (err) {
    next(err);
  }
});

/* ==========================================================
   GET ACTIVE ELECTIONS
   ========================================================== */


/* ==========================================================
   HOME PAGE
   ========================================================== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ==========================================================
   CREATE ELECTION
   ========================================================== */
app.post("/create-election", async (req, res, next) => {
  try {
    const { title, candidates, startDate, endDate } = req.body;

    if (!title || !candidates || !startDate || !endDate) {
      return res.send("Please provide title, candidates, startDate, and endDate");
    }app.get("/elections", async (req, res, next) => {
  try {
    // Get current UTC time
    const nowUTC = new Date();

    // Convert to IST by adding +5:30 (in ms)
    const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));

    const elections = await Election.find({
      startDate: { $lte: nowIST },
      endDate: { $gte: nowIST }
    });

    res.json(
      elections.map((e) => ({
        id: e._id.toString(),
        title: e.title,
        candidates: e.candidates,
        published: e.published,
        startDate: e.startDate,
        endDate: e.endDate
      }))
    );
  } catch (err) {
    next(err);
  }
});


    const candidateArray = Array.isArray(candidates)
      ? candidates
      : candidates.split(",").map((c) => c.trim());

    const votesObj = {};
    candidateArray.forEach((c) => (votesObj[c] = 0));

    await Election.create({
      title,
      candidates: candidateArray,
      votes: votesObj,
      voted: [],
      published: false,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

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
  } catch (err) {
    console.error("❌ Error creating election:", err);
    next(err);
  }
});

/* ==========================================================
   CAST VOTE
   ========================================================== */
app.post("/cast-vote", async (req, res, next) => {
  try {
    const { voterId, candidate, electionId } = req.body;

    const election = await Election.findById(electionId);
    if (!election)
      return res.send(`<div class="vote-message error">Invalid election. <a href="/voter.html">Back</a></div>`);

    if (election.voted.includes(voterId)) {
      return res.send(`
        <html><head><meta charset="utf-8">
        <link rel="stylesheet" href="/style.css">
        <title>Vote Error</title></head>
        <body><div class="error-box">
          <h1>⚠️ Already Voted</h1>
          <p>You have already cast your vote in "<strong>${election.title}</strong>".</p>
          <a href="/voter.html" class="back-btn">Back to Voter Panel</a>
        </div></body></html>
      `);
    }

    if (!election.candidates.includes(candidate))
      return res.send(`<div class="vote-message error">Invalid candidate. <a href="/voter.html">Choose again</a></div>`);

    // ✅ Increment votes safely
    election.votes[candidate] = (election.votes[candidate] || 0) + 1;
    election.markModified("votes");   // <-- VERY IMPORTANT
    election.voted.push(voterId);

    await election.save();

    // Add to blockchain
    const newBlock = new Block(
      voteChain.chain.length,
      Date.now().toString(),
      { voterId, candidate, election: election.title },
      voteChain.getLatestBlock().hash
    );
    voteChain.addBlock(newBlock);

    res.send(`
      <html><head><meta charset="utf-8"><title>Vote Cast</title>
      <link rel="stylesheet" href="/style.css">
      <meta http-equiv="refresh" content="3;url=/" /></head>
      <body><div class="vote-message success">
        ✅ Your vote for <strong>${candidate}</strong> in <strong>${election.title}</strong> is recorded.
        <br><br><a href="/">Back to Home</a>
      </div></body></html>
    `);
  } catch (err) {
    next(err);
  }
});


/* ==========================================================
   PUBLISH RESULTS
   ========================================================== */
app.post("/publish-results/:id", async (req, res, next) => {
  try {
    const election = await Election.findById(req.params.id);
    if (!election) return res.send("Election not found");

    election.published = true;
    await election.save();

    res.send(`
      <html><head><meta charset="utf-8">
        <title>Published</title>
        <link rel="stylesheet" href="/style.css">
        <meta http-equiv="refresh" content="2;url=/" />
      </head><body>
        <div class="result-message success">
          📢 Results for "<strong>${election.title}</strong>" have been published.
          <br><br><a href="/">Go Back</a>
        </div>
      </body></html>
    `);
  } catch (err) {
    next(err);
  }
});

/* ==========================================================
   VIEW ONLY VOTER'S OWN ELECTION RESULTS
   ========================================================== */
app.get("/my-results", async (req, res, next) => {
  try {
    const { voterId } = req.query;
    if (!voterId) return res.send("Missing voterId");

    const elections = await Election.find({ published: true, voted: voterId });
    if (!elections.length) {
      return res.send(`
        <html><head><meta charset="utf-8">
        <title>My Results - VoteChain</title>
        <link rel="stylesheet" href="/style.css"></head>
        <body class="no-results">
          <h2>You haven't voted in any published elections yet.</h2>
          <a href="/" class="back-link">🏠 Back to Home</a>
        </body></html>
      `);
    }

    const resultsHTML = elections.map(e => `
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
      <html><head><meta charset="utf-8">
        <title>My Results - VoteChain</title>
        <link rel="stylesheet" href="/style.css"></head>
      <body>
        <header class="navbar">
          <div class="brand">🏛️ VoteChain</div>
          <div class="nav-links">
            <a href="/">Home</a>
            <a href="voter.html">Voter Panel</a>
          </div>
        </header>
        <div class="content">
          <h1>📢 Your Election Results</h1>
          ${resultsHTML}
          <a href="/" class="back-link">🏠 Back to Home</a>
        </div>
      </body></html>
    `);
  } catch (err) {
    next(err);
  }
});

/* ==========================================================
   RESULTS PAGE
   ========================================================== */
app.get("/results", async (req, res, next) => {
  try {
    const published = await Election.find({ published: true });
    if (!published.length) {
      return res.send(`
        <html><head><meta charset="utf-8">
        <title>Results - VoteChain</title>
        <link rel="stylesheet" href="/style.css"></head>
        <body class="no-results">
          <h2>No results are published yet.</h2>
          <a href="/" class="back-link">🏠 Back to Home</a>
        </body></html>
      `);
    }

    const allResults = published
      .map(
        (e) => `
      <div class="election-card">
        <h3>${e.title}</h3>
        <div class="candidate-list">
          ${e.candidates
            .map(
              (c) => `
            <div class="candidate">
              <span>${c}</span>
              <span class="vote-count">${e.votes[c]} votes</span>
            </div>`
            )
            .join("")}
        </div>
      </div>
    `
      )
      .join("");

    res.send(`
      <html><head><meta charset="utf-8">
        <title>Results - VoteChain</title>
        <link rel="stylesheet" href="/style.css"></head>
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
        </body></html>
    `);
  } catch (err) {
    next(err);
  }
});

/* ------------------------- ERROR HANDLER ------------------------- */
app.use((err, req, res, next) => {
  console.error("❌ Internal Server Error:", err);
  res.status(500).send("Internal Server Error");
});

/* ========================================================== */
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
