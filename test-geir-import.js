// Test script for importing Geir Stølen's CSV data
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testGeirCsvImport() {
  try {
    console.log('Testing Geir CSV import...');
    
    // Read the CSV file
    const csvPath = './attached_assets/Geir Stølen_1757792082104.csv';
    const csvContent = fs.readFileSync(csvPath);
    
    // Create form data
    const formData = new FormData();
    formData.append('csvFile', csvContent, 'geir_stolen.csv');
    
    // Make the request
    const response = await axios.post(
      'http://localhost:5000/api/import-geir-csv',
      formData,
      {
        headers: {
          ...formData.getHeaders()
        }
      }
    );
    
    console.log('Import successful!');
    console.log('Response:', response.data);
    
    if (response.data.stats) {
      console.log('\nImport Statistics:');
      console.log(`  Total rows: ${response.data.stats.totalRows}`);
      console.log(`  Imported: ${response.data.stats.imported}`);
      console.log(`  Updated: ${response.data.stats.updated}`);
      console.log(`  Skipped: ${response.data.stats.skipped}`);
      console.log(`  Errors: ${response.data.stats.errors}`);
    }
    
  } catch (error) {
    console.error('Import failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testGeirCsvImport();