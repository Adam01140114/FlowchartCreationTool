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
    e.target.value = e.target.value.replace(/[^0-9-]/g, '');
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
    
    if (!normalizeZip(zipCode)) {
        showError('Please enter a valid 5-digit zip code');
        return;
    }

    const county = lookupCounty(zipCode);
    if (county) {
        showResult(county, normalizeZip(zipCode));
    } else {
        showError(`County not found for zip code ${zipCode}. Please verify it's a valid California zip code.`);
    }
}

function lookupCounty(zipCode) {
    // Local data only. zipData.js already covers every USPS ZIP in California,
    // so a miss means the ZIP is not in California (or is not a ZIP at all).
    return getCountyFromZip(zipCode);
}

function showResult(county, zipCode) {
    countyName.textContent = county + ' County';
    countyDetails.textContent = `Zip code ${zipCode} is located in ${county} County, California`;
    
    // Get court information
    const courtInfo = getCourtFromZipCode(zipCode);
    if (courtInfo && courtInfo.isSplit) {
        const others = courtInfo.counties.slice(1).map(c => `${c.county} County (${Math.round(c.share * 100)}%)`).join(', ');
        countyDetails.textContent += `. This zip code straddles a county line: about ${Math.round(courtInfo.counties[0].share * 100)}% of its residents are in ${county} County, the rest in ${others}. Confirm which county the address is actually in.`;
    }
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

