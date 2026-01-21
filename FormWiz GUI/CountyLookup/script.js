// Get DOM elements
const zipInput = document.getElementById('zipInput');
const searchBtn = document.getElementById('searchBtn');
const resultDiv = document.getElementById('result');
const errorDiv = document.getElementById('error');
const countyName = document.getElementById('countyName');
const countyDetails = document.getElementById('countyDetails');

// Handle search button click
searchBtn.addEventListener('click', handleSearch);

// Handle Enter key press
zipInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

// Only allow numbers in input
zipInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

function handleSearch() {
    const zipCode = zipInput.value.trim();
    
    // Hide previous results
    resultDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
    
    // Validate input
    if (!zipCode) {
        showError('Please enter a zip code');
        return;
    }
    
    if (zipCode.length !== 5) {
        showError('Please enter a valid 5-digit zip code');
        return;
    }
    
    // Lookup county (async)
    searchBtn.disabled = true;
    searchBtn.textContent = 'Looking up...';
    
    lookupCounty(zipCode).then(county => {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Lookup';
        
        if (county) {
            showResult(county, zipCode);
        } else {
            showError(`County not found for zip code ${zipCode}. Please verify it's a valid California zip code.`);
        }
    });
}

async function lookupCounty(zipCode) {
    // First, try local data lookup
    if (zipCodeToCounty[zipCode]) {
        return zipCodeToCounty[zipCode];
    }
    
    // If not found locally, try API fallback
    // Using SmartyStreets free API (requires free account) or GeoNames
    try {
        // Option 1: SmartyStreets (requires API key - free tier available)
        // const response = await fetch(`https://us-zipcode.api.smartystreets.com/lookup?zipcode=${zipCode}&auth-id=YOUR_AUTH_ID&auth-token=YOUR_AUTH_TOKEN`);
        
        // Option 2: GeoNames (free, no key needed for basic usage, but rate limited)
        const response = await fetch(`http://api.geonames.org/postalCodeSearchJSON?postalcode=${zipCode}&country=US&username=demo&maxRows=1`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.postalCodes && data.postalCodes.length > 0) {
                const result = data.postalCodes[0];
                const adminName1 = result.adminName1; // This is usually the state
                const adminName2 = result.adminName2; // This might be the county in some cases
                
                // For California, we need to check if this is a CA zip code
                if (adminName1 === 'California' || adminName1 === 'CA') {
                    // Try to extract county from adminName2 or placeName
                    // Note: GeoNames may not always have county, so this is a fallback
                    if (adminName2) {
                        return adminName2.replace(' County', '').trim();
                    }
                }
            }
        }
    } catch (error) {
        // API failed, return null to show error message
        console.log('API lookup failed:', error);
    }
    
    return null;
}

function showResult(county, zipCode) {
    countyName.textContent = county + ' County';
    countyDetails.textContent = `Zip code ${zipCode} is located in ${county} County, California`;
    
    // Get court information
    const courtInfo = getCourtFromZipCode(zipCode);
    const courtInfoDiv = document.getElementById('courtInfo');
    
    if (courtInfo && courtInfo.courtName) {
        let courtHTML = '<div class="court-details">';
        courtHTML += '<h3>📍 Small Claims Court</h3>';
        courtHTML += `<p class="court-name"><strong>${courtInfo.courtName}</strong></p>`;
        courtHTML += `<p class="court-address">${courtInfo.fullAddress}</p>`;
        if (courtInfo.phone) {
            courtHTML += `<p class="court-phone">📞 ${courtInfo.phone}</p>`;
        }
        
        // Show additional locations if available
        if (courtInfo.locations && courtInfo.locations.length > 0) {
            courtHTML += '<div class="additional-locations"><p class="locations-header">Other locations:</p>';
            courtInfo.locations.forEach(loc => {
                courtHTML += `<p class="location-item">${loc.name}<br>${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`;
                if (loc.phone) {
                    courtHTML += `<br>📞 ${loc.phone}`;
                }
                courtHTML += '</p>';
            });
            courtHTML += '</div>';
        }
        
        courtHTML += '</div>';
        courtInfoDiv.innerHTML = courtHTML;
    } else {
        courtInfoDiv.innerHTML = '<p class="court-error">⚠️ Court information not available for this county</p>';
    }
    
    resultDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
}

