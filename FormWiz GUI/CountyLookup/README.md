# California Zip Code to County Lookup

A simple, beautiful web application that allows you to enter any California zip code and get the corresponding county name.

## Features

- Clean, modern user interface
- Real-time zip code validation
- Responsive design for mobile and desktop
- Fast lookup using local data

## How to Use

1. Open `index.html` in your web browser
2. Enter a 5-digit California zip code
3. Click "Lookup" or press Enter
4. The county name will be displayed

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and layout
- `script.js` - JavaScript functionality
- `zipData.js` - Zip code to county mapping data

## Testing

Try these example zip codes:
- 90001 - Los Angeles County
- 94102 - San Francisco County
- 92101 - San Diego County
- 92602 - Orange County
- 95814 - Sacramento County

## Getting Complete Zip Code Data

The biggest challenge is getting accurate zip code to county mappings. See `DATA_SOURCES.md` for detailed instructions on how to:

1. **Download official Census Bureau data** (Recommended - most accurate)
   ```bash
   python update_zip_data.py --download-census
   ```

2. **Process a CSV file** (Row Zero dataset)
   ```bash
   python update_zip_data.py --process-csv your_file.csv
   ```

3. **Use API fallback** (Already built-in for missing zip codes)

The current `zipData.js` file includes many zip codes, but for complete coverage, run the update script with official data sources.

## Note

The application uses a local dataset for fast lookups, with API fallback for missing zip codes. For the most complete data, update using the Census Bureau data source (see `DATA_SOURCES.md`).

