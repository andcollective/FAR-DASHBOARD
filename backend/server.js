const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');

const app = express();
const PORT = 3001;
const CSV_PATH = path.join(__dirname, '../zip3_rep.csv');
const REP_CONTACT_CSV = path.join(__dirname, '../rep_contact.csv');
const DRAFTS_DIR = path.join(__dirname, '../drafts');
if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR);

app.use(cors());
app.use(express.json());

// Helper: Read CSV and return as array of objects
function readZip3CSV() {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(CSV_PATH)
      .pipe(parse({ columns: true, trim: true }))
      .on('data', (row) => {
        row.Zipcode = row.Zipcode.replace(/^'/, '');
        records.push(row);
      })
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

// Helper: Write array of objects to CSV
function writeZip3CSV(data) {
  return new Promise((resolve, reject) => {
    stringify(data, { header: true, columns: ['Zipcode', 'Sales_Rep'] }, (err, output) => {
      if (err) return reject(err);
      fs.writeFile(CSV_PATH, output, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

// Helper: Read rep contact CSV
function readRepContactCSV() {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(REP_CONTACT_CSV)
      .pipe(parse({ columns: true, trim: true }))
      .on('data', (row) => records.push(row))
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

// Helper: Write rep contact CSV
function writeRepContactCSV(data) {
  return new Promise((resolve, reject) => {
    stringify(data, { header: true, columns: ['Name', 'Email', 'Phone Number'] }, (err, output) => {
      if (err) return reject(err);
      fs.writeFile(REP_CONTACT_CSV, output, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

// GET all zip3 regions
app.get('/api/zip3', async (req, res) => {
  try {
    const data = await readZip3CSV();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create or update a zip3 region
app.post('/api/zip3', async (req, res) => {
  const { Zipcode, Sales_Rep } = req.body;
  if (!Zipcode || !Sales_Rep) {
    return res.status(400).json({ error: 'Zipcode and Sales_Rep are required.' });
  }
  try {
    let data = await readZip3CSV();
    const idx = data.findIndex((row) => row.Zipcode === Zipcode);
    if (idx !== -1) {
      data[idx].Sales_Rep = Sales_Rep;
    } else {
      data.push({ Zipcode, Sales_Rep });
    }
    await writeZip3CSV(data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a zip3 region
app.delete('/api/zip3/:zipcode', async (req, res) => {
  const { zipcode } = req.params;
  try {
    let data = await readZip3CSV();
    data = data.filter((row) => row.Zipcode !== zipcode);
    await writeZip3CSV(data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all reps
app.get('/api/reps', async (req, res) => {
  try {
    const data = await readRepContactCSV();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a new rep
app.post('/api/reps', async (req, res) => {
  const { Name, Email, 'Phone Number': PhoneNumber } = req.body;
  if (!Name || !Email || !PhoneNumber) {
    return res.status(400).json({ error: 'Name, Email, and Phone Number are required.' });
  }
  try {
    let data = await readRepContactCSV();
    if (data.find(r => r.Name === Name)) {
      return res.status(400).json({ error: 'Rep with this name already exists.' });
    }
    data.push({ Name, Email, 'Phone Number': PhoneNumber });
    await writeRepContactCSV(data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a rep
app.put('/api/reps/:name', async (req, res) => {
  const { name } = req.params;
  const { Email, 'Phone Number': PhoneNumber } = req.body;
  try {
    let data = await readRepContactCSV();
    const idx = data.findIndex(r => r.Name === name);
    if (idx === -1) {
      return res.status(404).json({ error: 'Rep not found.' });
    }
    if (Email) data[idx].Email = Email;
    if (PhoneNumber) data[idx]['Phone Number'] = PhoneNumber;
    await writeRepContactCSV(data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a rep
app.delete('/api/reps/:name', async (req, res) => {
  const { name } = req.params;
  try {
    let data = await readRepContactCSV();
    const newData = data.filter(r => r.Name !== name);
    if (newData.length === data.length) {
      return res.status(404).json({ error: 'Rep not found.' });
    }
    await writeRepContactCSV(newData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all drafts
app.get('/api/drafts', (req, res) => {
  fs.readdir(DRAFTS_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });
    const drafts = files.filter(f => f.endsWith('.json')).map(f => {
      const content = fs.readFileSync(path.join(DRAFTS_DIR, f), 'utf8');
      const { name, timestamp } = JSON.parse(content);
      return { id: f.replace('.json', ''), name, timestamp };
    });
    res.json(drafts);
  });
});

// Get a specific draft
app.get('/api/drafts/:id', (req, res) => {
  const file = path.join(DRAFTS_DIR, req.params.id + '.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Draft not found' });
  const content = fs.readFileSync(file, 'utf8');
  res.json(JSON.parse(content));
});

// Save a new draft
app.post('/api/drafts', (req, res) => {
  const { name, zip3Assignments, repsList } = req.body;
  if (!name || !zip3Assignments || !repsList) return res.status(400).json({ error: 'Missing fields' });
  const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '_' + Date.now();
  const draft = { name, timestamp: Date.now(), zip3Assignments, repsList };
  fs.writeFileSync(path.join(DRAFTS_DIR, id + '.json'), JSON.stringify(draft, null, 2));
  res.json({ success: true, id });
});

// Delete a draft
app.delete('/api/drafts/:id', (req, res) => {
  const file = path.join(DRAFTS_DIR, req.params.id + '.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Draft not found' });
  fs.unlinkSync(file);
  res.json({ success: true });
});

// Publish a draft (overwrite live CSVs)
app.post('/api/drafts/:id/publish', (req, res) => {
  const file = path.join(DRAFTS_DIR, req.params.id + '.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Draft not found' });
  const { zip3Assignments, repsList } = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Write zip3 assignments
  fs.writeFileSync(CSV_PATH, 'Zipcode,Sales_Rep\n' + zip3Assignments.map(r => `${r.Zipcode},${r.Sales_Rep}`).join('\n'));
  // Write reps
  fs.writeFileSync(REP_CONTACT_CSV, 'Name,Email,Phone Number\n' + repsList.map(r => `${r.Name},${r.Email},${r['Phone Number']}`).join('\n'));
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 