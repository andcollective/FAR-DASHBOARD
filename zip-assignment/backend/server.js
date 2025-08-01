const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');

const app = express();
const PORT = 3001;
const CSV_PATH = path.join(__dirname, '../zip3_rep.csv');

app.use(cors());
app.use(express.json());

// Helper: Read CSV and return as array of objects
function readZip3CSV() {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(CSV_PATH)
      .pipe(parse({ columns: true, trim: true }))
      .on('data', (row) => {
        // Remove leading quote from Zipcode if present
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 