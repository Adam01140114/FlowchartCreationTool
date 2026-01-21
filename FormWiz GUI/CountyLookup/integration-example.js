/**
 * Example Integration for Small Claims Court Automation
 * 
 * This shows how to integrate the zip code → county → court lookup
 * into your small claims paperwork automation system.
 */

// Example 1: Get court info from zip code (most common use case)
function autoFillCourtFromZipCode(zipCode) {
    const courtInfo = getCourtFromZipCode(zipCode);
    
    if (!courtInfo) {
        return {
            success: false,
            error: 'Could not find court information for this zip code'
        };
    }
    
    if (courtInfo.error) {
        return {
            success: false,
            error: courtInfo.error
        };
    }
    
    // Return formatted data ready to fill into your form
    return {
        success: true,
        county: courtInfo.county,
        courtName: courtInfo.courtName,
        courtAddress: courtInfo.fullAddress,
        // Individual fields if your form needs them separately
        fields: {
            'court_name': courtInfo.courtName,
            'court_address': courtInfo.address,
            'court_city': courtInfo.city,
            'court_state': courtInfo.state,
            'court_zip': courtInfo.zip,
            'court_phone': courtInfo.phone
        }
    };
}

// Example 2: Auto-fill a form element (jQuery example)
function fillCourtFormFromZipCode(zipCode, formSelector) {
    const courtInfo = getCourtFromZipCode(zipCode);
    
    if (!courtInfo || courtInfo.error) {
        alert('Court information not found. Please verify the zip code.');
        return false;
    }
    
    // Fill form fields (adjust selectors to match your form)
    $(formSelector + ' input[name="court_name"]').val(courtInfo.courtName);
    $(formSelector + ' input[name="court_address"]').val(courtInfo.address);
    $(formSelector + ' input[name="court_city"]').val(courtInfo.city);
    $(formSelector + ' input[name="court_state"]').val(courtInfo.state);
    $(formSelector + ' input[name="court_zip"]').val(courtInfo.zip);
    $(formSelector + ' input[name="court_phone"]').val(courtInfo.phone);
    
    return true;
}

// Example 3: Vanilla JavaScript form filling
function fillCourtFormNative(zipCode) {
    const courtInfo = getCourtFromZipCode(zipCode);
    
    if (!courtInfo || courtInfo.error) {
        console.error('Court info not found:', courtInfo?.error);
        return false;
    }
    
    // Get form elements and fill them
    const courtNameField = document.getElementById('court_name');
    const courtAddressField = document.getElementById('court_address');
    const courtCityField = document.getElementById('court_city');
    const courtStateField = document.getElementById('court_state');
    const courtZipField = document.getElementById('court_zip');
    const courtPhoneField = document.getElementById('court_phone');
    
    if (courtNameField) courtNameField.value = courtInfo.courtName;
    if (courtAddressField) courtAddressField.value = courtInfo.address;
    if (courtCityField) courtCityField.value = courtInfo.city;
    if (courtStateField) courtStateField.value = courtInfo.state;
    if (courtZipField) courtZipField.value = courtInfo.zip;
    if (courtPhoneField) courtPhoneField.value = courtInfo.phone;
    
    return true;
}

// Example 4: Get court info from county name (if user already knows county)
function autoFillCourtFromCounty(countyName) {
    const courtInfo = getCourtFromCounty(countyName);
    
    if (!courtInfo) {
        return {
            success: false,
            error: 'Court information not found for ' + countyName + ' County'
        };
    }
    
    return {
        success: true,
        county: courtInfo.county,
        courtName: courtInfo.courtName,
        courtAddress: courtInfo.fullAddress,
        fields: {
            'court_name': courtInfo.courtName,
            'court_address': courtInfo.address,
            'court_city': courtInfo.city,
            'court_state': courtInfo.state,
            'court_zip': courtInfo.zip,
            'court_phone': courtInfo.phone
        }
    };
}

// Example 5: React/Vue component integration pattern
function useCourtLookup(zipCode) {
    const [courtInfo, setCourtInfo] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    
    React.useEffect(() => {
        if (!zipCode || zipCode.length !== 5) {
            return;
        }
        
        setLoading(true);
        setError(null);
        
        // Synchronous lookup (fast with local data)
        const info = getCourtFromZipCode(zipCode);
        
        if (!info || info.error) {
            setError(info?.error || 'Court information not found');
            setCourtInfo(null);
        } else {
            setCourtInfo(info);
            setError(null);
        }
        
        setLoading(false);
    }, [zipCode]);
    
    return { courtInfo, loading, error };
}

// Example 6: Handle multiple locations (some counties have multiple courthouses)
function getCourtLocations(zipCode) {
    const courtInfo = getCourtFromZipCode(zipCode);
    
    if (!courtInfo || !courtInfo.locations) {
        return [courtInfo]; // Return single location as array
    }
    
    // Return primary location + additional locations
    const locations = [{
        name: courtInfo.courtName,
        address: courtInfo.address,
        city: courtInfo.city,
        state: courtInfo.state,
        zip: courtInfo.zip,
        phone: courtInfo.phone
    }];
    
    // Add additional locations
    courtInfo.locations.forEach(loc => {
        locations.push({
            name: loc.name,
            address: loc.address,
            city: loc.city,
            state: loc.state,
            zip: loc.zip,
            phone: loc.phone
        });
    });
    
    return locations;
}

// Example usage in your workflow:
// 1. User enters defendant's zip code
// 2. You call: const courtData = autoFillCourtFromZipCode(userZipCode);
// 3. You populate your form with courtData.fields
// 4. Done! Court name and address auto-filled

