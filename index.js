import bodyParser from "body-parser";
import express from "express";
import session from "express-session";
import pg from "pg";

const app = express();
const port = 3001;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "Harsh",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Session setup
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
}));

async function checkVisited(userId) {
  try {
    const result = await db.query(
      "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1;",
      [userId]
    );
    return result.rows.map(row => row.country_code);
  } catch (err) {
    console.error("Error checking visited countries:", err);
    return [];
  }
}

async function getCurrentUser(userId) {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    return result.rows[0];
  } catch (err) {
    console.error("Error fetching current user:", err);
    return null;
  }
}

app.get("/", async (req, res) => {
  const userId = req.session.userId || 1; // Default to 1 if not set
  const countries = await checkVisited(userId);
  const currentUser = await getCurrentUser(userId);
  
  if (!currentUser) {
    return res.status(500).send("Error loading user data");
  }
  
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: await db.query("SELECT * FROM users").then(result => result.rows),
    color: currentUser.color,
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const userId = req.session.userId;

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(400).send("Country not found");
    }

    const countryCode = result.rows[0].country_code;
    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
      [countryCode, userId]
    );

    res.redirect("/");
  } catch (err) {
    console.error("Error adding country:", err);
    res.status(500).send("Error adding country");
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    req.session.userId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const { name, color } = req.body;

  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
      [name, color]
    );

    req.session.userId = result.rows[0].id;
    res.redirect("/");
  } catch (err) {
    console.error("Error creating new user:", err);
    res.status(500).send("Error creating new user");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// Handle process exit to close the database connection
process.on('exit', () => {
  db.end();
  console.log('Database connection closed');
});
