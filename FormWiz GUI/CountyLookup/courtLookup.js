/**
 * Court Lookup Functions
 * Integrates zip code lookup with court information for small claims automation
 */

// Main function: Get court info from zip code
function getCourtFromZipCode(zipCode) {
    // First, get the county from zip code
    const county = zipCodeToCounty[zipCode];
    
    if (!county) {
        return null;
    }
    
    // Then get court info from county
    const courtInfo = getCourtByCounty(county);
    
    if (!courtInfo) {
        return {
            county: county,
            error: 'Court information not found for this county'
        };
    }
    
    return {
        county: county,
        courtName: courtInfo.name,
        address: courtInfo.address,
        city: courtInfo.city,
        state: courtInfo.state,
        zip: courtInfo.zip,
        phone: courtInfo.phone,
        fullAddress: formatCourtAddress(courtInfo),
        locations: courtInfo.locations || null
    };
}

// Function to get court info directly from county name
function getCourtFromCounty(countyName) {
    const courtInfo = getCourtByCounty(countyName);
    
    if (!courtInfo) {
        return null;
    }
    
    return {
        county: countyName,
        courtName: courtInfo.name,
        address: courtInfo.address,
        city: courtInfo.city,
        state: courtInfo.state,
        zip: courtInfo.zip,
        phone: courtInfo.phone,
        fullAddress: formatCourtAddress(courtInfo),
        locations: courtInfo.locations || null
    };
}

// Export for use in other scripts (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCourtFromZipCode,
        getCourtFromCounty,
        getCourtByCounty,
        formatCourtAddress
    };
}

