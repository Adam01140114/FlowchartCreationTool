# Small Claims Court Data Integration

## Overview

This system provides automatic court name and address lookup for California small claims court automation. It works by:

1. **Zip Code → County** (using `zipData.js`)
2. **County → Court Info** (using `courtData.js`)
3. **Returns complete court details** (name, address, phone, etc.)

## Files

### Core Data Files
- `zipData.js` - Maps zip codes to counties (1,808 California zip codes)
- `courtData.js` - Maps counties to small claims court information (all 58 counties)
- `courtLookup.js` - Helper functions for court lookups

### Integration Files
- `integration-example.js` - Code examples for integrating into your website
- `script.js` - Original zip code lookup UI (you can adapt this)

## Quick Start

### 1. Include the required files in your HTML:

```html
<!-- Zip code to county mapping -->
<script src="zipData.js"></script>

<!-- County to court mapping -->
<script src="courtData.js"></script>

<!-- Lookup helper functions -->
<script src="courtLookup.js"></script>
```

### 2. Use the lookup function:

```javascript
// Get court info from zip code
const courtInfo = getCourtFromZipCode('93907');

// Returns:
{
    county: 'Monterey',
    courtName: 'Monterey County Superior Court',
    address: '240 Church Street',
    city: 'Salinas',
    state: 'CA',
    zip: '93901',
    phone: '(831) 755-5000',
    fullAddress: '240 Church Street, Salinas, CA 93901'
}
```

### 3. Auto-fill your form:

```javascript
// Example: Auto-fill form fields
function fillCourtFields(zipCode) {
    const court = getCourtFromZipCode(zipCode);
    
    document.getElementById('court_name').value = court.courtName;
    document.getElementById('court_address').value = court.fullAddress;
    // ... etc
}
```

## API Reference

### `getCourtFromZipCode(zipCode)`
Returns court information based on a zip code.

**Parameters:**
- `zipCode` (string) - 5-digit zip code

**Returns:**
```javascript
{
    county: 'Monterey',
    courtName: 'Monterey County Superior Court',
    address: '240 Church Street',
    city: 'Salinas',
    state: 'CA',
    zip: '93901',
    phone: '(831) 755-5000',
    fullAddress: '240 Church Street, Salinas, CA 93901',
    locations: [...] // Array of additional locations (if any)
}
```

**Returns `null` if zip code not found.**

### `getCourtFromCounty(countyName)`
Returns court information based on county name.

**Parameters:**
- `countyName` (string) - County name (e.g., 'Los Angeles', 'Monterey')

**Returns:** Same structure as `getCourtFromZipCode()`

### `getCourtByCounty(countyName)`
Returns raw court data object.

### `formatCourtAddress(courtInfo)`
Formats court address as a single string.

## Integration Examples

See `integration-example.js` for complete examples including:
- jQuery form filling
- Vanilla JavaScript form filling
- React hooks integration
- Handling multiple court locations

## Data Coverage

✅ **All 58 California counties** included
✅ **1,808 California zip codes** mapped to counties
✅ **Multiple locations** for counties with multiple courthouses
✅ **Complete addresses** including street, city, state, zip
✅ **Phone numbers** for all courts

## Important Notes

### Multiple Locations
Some counties have multiple courthouse locations. The `locations` array contains additional locations. For most counties, there's one primary location.

### Data Accuracy
Court addresses and phone numbers can change. You should:
- Verify critical information periodically
- Check official court websites if in doubt
- Update `courtData.js` if you find discrepancies

### County Name Formatting
County names in `courtData.js` match the format in `zipData.js`:
- "Los Angeles" (not "Los Angeles County")
- "Monterey" (not "Monterey County")
- Case-sensitive

## Updating Court Data

To update court information:

1. Open `courtData.js`
2. Find the county entry
3. Update the relevant fields:
   ```javascript
   'Monterey': {
       name: 'Monterey County Superior Court',
       address: '240 Church Street',
       city: 'Salinas',
       state: 'CA',
       zip: '93901',
       phone: '(831) 755-5000'
   }
   ```

## Testing

Test with these zip codes:
- `93907` → Monterey County → Monterey County Superior Court
- `90001` → Los Angeles County → Los Angeles County Superior Court
- `94102` → San Francisco County → San Francisco County Superior Court
- `92101` → San Diego County → San Diego County Superior Court

## Support

If you find errors or missing information:
1. Verify against official court websites
2. Update `courtData.js` directly
3. Consider creating a data update script similar to `update_zip_data.py`

