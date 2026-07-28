const SHEET_ID = '1N5tJAWJDXQCHLhH51npQCZJfBQ-k2C3f6U-dEhOJkuE';

const sheets = {
  'Stock List': 0,
  'Deliveries': 585933402,
  'Expiry Dates': 2107953271,
  'Stock Movements': 661,
  'Tasks': 1738506826,
  'Waste': 1943984893
};

async function checkSheets() {
  for (const [name, gid] of Object.entries(sheets)) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    try {
      const response = await fetch(url);
      const csvText = await response.text();
      const lines = csvText.split('\n');
      
      let headerLine = lines[0];
      if (name === 'Expiry Dates') {
        headerLine = lines[2];
      }
      
      const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      console.log(`\n${name} (gid=${gid}):`);
      console.log(`  Columns: ${headers.join(', ')}`);
    } catch (error) {
      console.log(`\n${name}: ERROR - ${error.message}`);
    }
  }
}

checkSheets();
