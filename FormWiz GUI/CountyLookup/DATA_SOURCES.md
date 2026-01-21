# California Zip Code Data Sources

This document explains how to get accurate, comprehensive zip code to county mappings for California.

## Recommended Solutions (Best to Good)

### Option 1: Census Bureau Data (Best - Official Source) ⭐ RECOMMENDED

The U.S. Census Bureau provides official ZCTA (Zip Code Tabulation Area) to County relationship files.

**Steps:**
1. Run: `python update_zip_data.py --download-census`
2. The script will automatically download and process the data
3. This creates an accurate `zipData.js` file with official mappings

**Pros:**
- Official, authoritative source
- Free and publicly available
- Comprehensive coverage
- Regularly updated

**Cons:**
- ZCTAs are approximations of zip codes (but very close)

### Option 2: Row Zero Dataset (Good - Easy to Use)

Row Zero provides a comprehensive spreadsheet with zip codes, places, and counties.

**Steps:**
1. Visit: https://rowzero.com/datasets/zip-codes-to-places
2. Download the CSV file
3. Filter for California entries (state = 'CA')
4. Save as `ca_zipcodes.csv`
5. Run: `python update_zip_data.py --process-csv ca_zipcodes.csv`

**Pros:**
- Easy to download and use
- Includes other useful data (city, state, metro area)
- Well-maintained

**Cons:**
- Requires manual download step
- May have some inaccuracies

### Option 3: API Fallback (Built-in)

The website already includes API fallback functionality using GeoNames API.

**Current Implementation:**
- First checks local `zipData.js` file
- If not found, tries GeoNames API
- Free but rate-limited

**To Improve:**
- Get a free API key from SmartyStreets (more reliable)
- Or use other geocoding services

### Option 4: Manual CSV Processing

If you have a CSV file with zip codes and counties:

1. Format should be: `zip,county` or include columns like `zip`, `county`
2. Modify `update_zip_data.py` to match your CSV format
3. Run the processing function

## Quick Start

For the fastest setup with the most accurate data:

```bash
python update_zip_data.py --download-census
```

This will:
1. Download the latest Census Bureau data
2. Filter for California zip codes
3. Generate a complete `zipData.js` file
4. Ready to use immediately

## Verifying Your Data

Test with known zip codes:
- `90001` → Los Angeles County
- `93907` → Monterey County
- `94102` → San Francisco County
- `92101` → San Diego County

## Notes

- California has approximately 1,700+ active zip codes
- Some zip codes may span multiple counties (the data will use the primary county)
- Data should be updated periodically as new zip codes are added

