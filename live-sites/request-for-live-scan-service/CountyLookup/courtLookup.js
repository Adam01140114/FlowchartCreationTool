/**
 * Court Lookup Functions
 * ZIP code -> county (zipData.js) -> small claims court (courtData.js).
 *
 * Load order: zipData.js, courtData.js, then this file.
 */

// Threshold below which a ZIP is treated as genuinely split between counties.
// Ask the user which county they live in rather than silently picking one.
var SPLIT_ZIP_THRESHOLD = 0.8;

function buildCourtResult(county, extra) {
    const courtInfo = getCourtByCounty(county);
    const base = Object.assign({ county: county }, extra || {});
    if (!courtInfo) {
        return Object.assign(base, { error: 'Court information not found for this county' });
    }
    return Object.assign(base, {
        courtName: courtInfo.name,
        address: courtInfo.address,
        city: courtInfo.city,
        state: courtInfo.state,
        zip: courtInfo.zip,
        phone: courtInfo.phone,
        fullAddress: formatCourtAddress(courtInfo),
        note: courtInfo.note || null,
        locations: courtInfo.locations || null,
        source: courtInfo.source || null
    });
}

// Main function: get court info from a ZIP code ('90210' or '90210-1234').
// Returns null for anything that is not a California ZIP.
// Result also carries:
//   counties  - every county the ZIP touches, most residents first [{county, share}]
//   isSplit   - true when the top county holds < 80% of residents; offer a choice
function getCourtFromZipCode(zipCode) {
    const county = getCountyFromZip(zipCode);
    if (!county) {
        return null;
    }
    const counties = getCountiesForZip(zipCode);
    const isSplit = counties.length > 1 && counties[0].share < SPLIT_ZIP_THRESHOLD;
    return buildCourtResult(county, { counties: counties, isSplit: isSplit });
}

// Get court info directly from a county name ('Orange' or 'Orange County').
function getCourtFromCounty(countyName) {
    const county = String(countyName || '').replace(/\s+County$/i, '').trim();
    if (!getCourtByCounty(county)) {
        return null;
    }
    return buildCourtResult(county);
}

// Export for use in other scripts (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCourtFromZipCode,
        getCourtFromCounty,
        getCourtByCounty,
        formatCourtAddress,
        SPLIT_ZIP_THRESHOLD
    };
}
