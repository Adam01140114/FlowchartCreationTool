# Data Source Information

## Primary Data Source: U.S. Census Bureau

### Exact URL:
```
https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
```

### What This Is:
- **Source**: U.S. Census Bureau (official government agency)
- **Dataset**: ZCTA (Zip Code Tabulation Area) to County Relationship File
- **Year**: 2020 Census data (most recent)
- **Format**: Pipe-delimited text file (|)
- **Coverage**: All 50 states, territories, and Washington D.C.

### What ZCTA Means:
- **ZCTA** = Zip Code Tabulation Area
- These are the Census Bureau's approximation of U.S. Postal Service ZIP codes
- They're designed to match ZIP codes as closely as possible
- Based on Census blocks and actual mail delivery areas

### Data Structure:
The file contains these key columns:
- `GEOID_ZCTA5_20` - The 5-digit ZIP code (embedded in GEOID)
- `GEOID_COUNTY_20` - County identifier (first 2 digits = state FIPS code)
- `NAMELSAD_COUNTY_20` - Full county name (e.g., "Los Angeles County")

### How Our Script Processes It:

1. **Downloads** the file from Census Bureau server
2. **Parses** the pipe-delimited format
3. **Filters** for California only (state FIPS code = '06')
4. **Extracts** ZIP code from GEOID (last 5 digits)
5. **Cleans** county names (removes " County" suffix)
6. **Generates** JavaScript mapping file

### Why This Source?
✅ **Official** - Government data, highly reliable
✅ **Comprehensive** - Covers all active ZIP codes
✅ **Free** - No cost, no API key needed
✅ **Public Domain** - Can use freely
✅ **Regular Updates** - Census Bureau maintains it

### File Size:
- Full national file: ~15-20 MB
- Contains relationships for all ZIP codes in the U.S.
- Our script filters to only California (~1,800 ZIP codes)

### When to Update:
- Census data is updated every 10 years (2020, 2030, etc.)
- ZIP codes change more frequently, but Census data is still reliable
- You can run the update script anytime to get the latest file

### Alternative Sources (if needed):
See `DATA_SOURCES.md` for other options like:
- Row Zero dataset (easier CSV format)
- APIs (require keys, may have rate limits)

