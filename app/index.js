const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'students',
});

async function init() {
  await pool.query('CREATE TABLE IF NOT EXISTS entries (id SERIAL PRIMARY KEY, name TEXT, created_at TIMESTAMP DEFAULT now())');
}

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><title>Sample Form</title></head>
<body>
<h1>Sample Form</h1>
<form action="/submit" method="POST">
  <input name="name" placeholder="Your name" />
  <button type="submit">Submit</button>
</form>
<a href="/entries">View entries</a>
</body>
</html>`);
});

app.post('/submit', async (req, res) => {
  const name = req.body.name;
  if (name) {
    await pool.query('INSERT INTO entries(name) VALUES($1)', [name]);
  }
  res.redirect('/entries');
});

app.get('/entries', async (req, res) => {
  const result = await pool.query('SELECT name, created_at FROM entries ORDER BY id DESC');
  const list = result.rows.map(r => `<li>${r.name} (${r.created_at.toISOString()})</li>`).join('');
  res.send(`<!DOCTYPE html>
<html>
<head><title>Entries</title></head>
<body>
<h1>Entries</h1>
<ul>${list}</ul>
<a href="/">Go back</a>
</body>
</html>`);
});

init().then(() => {
  app.listen(8080, () => console.log('Server running on 8080'));
}).catch(err => {
  console.error('Failed to init DB', err);
  process.exit(1);
});
