// California County to Small Claims Court Mapping
// Contains court name, address, phone, and other details for each county

const countyToCourt = {
    'Alameda': {
        name: 'Alameda County Superior Court',
        address: '1225 Fallon Street',
        city: 'Oakland',
        state: 'CA',
        zip: '94612',
        phone: '(510) 627-4700',
        locations: [
            {
                name: 'Hayward Hall of Justice',
                address: '24405 Amador Street',
                city: 'Hayward',
                state: 'CA',
                zip: '94544',
                phone: '(510) 670-5400'
            },
            {
                name: 'Wiley W. Manuel Courthouse',
                address: '661 Washington Street',
                city: 'Oakland',
                state: 'CA',
                zip: '94607',
                phone: '(510) 627-4700'
            }
        ]
    },
    'Alpine': {
        name: 'Alpine County Superior Court',
        address: '14777 State Route 89',
        city: 'Markleeville',
        state: 'CA',
        zip: '96120',
        phone: '(530) 694-2113'
    },
    'Amador': {
        name: 'Amador County Superior Court',
        address: '108 Court Street',
        city: 'Jackson',
        state: 'CA',
        zip: '95642',
        phone: '(209) 257-2626'
    },
    'Butte': {
        name: 'Butte County Superior Court',
        address: '1 Court Street',
        city: 'Oroville',
        state: 'CA',
        zip: '95965',
        phone: '(530) 532-7100',
        locations: [
            {
                name: 'Butte County Courthouse - Chico',
                address: '655 Oleander Avenue',
                city: 'Chico',
                state: 'CA',
                zip: '95926',
                phone: '(530) 879-6500'
            }
        ]
    },
    'Calaveras': {
        name: 'Calaveras County Superior Court',
        address: '891 Mountain Ranch Road',
        city: 'San Andreas',
        state: 'CA',
        zip: '95249',
        phone: '(209) 754-6500'
    },
    'Colusa': {
        name: 'Colusa County Superior Court',
        address: '532 Oak Street',
        city: 'Colusa',
        state: 'CA',
        zip: '95932',
        phone: '(530) 458-0500'
    },
    'Contra Costa': {
        name: 'Contra Costa County Superior Court',
        address: '725 Court Street',
        city: 'Martinez',
        state: 'CA',
        zip: '94553',
        phone: '(925) 608-1000',
        locations: [
            {
                name: 'Contra Costa County Superior Court - Richmond',
                address: '100 37th Street',
                city: 'Richmond',
                state: 'CA',
                zip: '94805',
                phone: '(510) 374-3023'
            },
            {
                name: 'Contra Costa County Superior Court - Pittsburg',
                address: '1000 Center Drive',
                city: 'Pittsburg',
                state: 'CA',
                zip: '94565',
                phone: '(925) 608-1000'
            }
        ]
    },
    'Del Norte': {
        name: 'Del Norte County Superior Court',
        address: '450 H Street',
        city: 'Crescent City',
        state: 'CA',
        zip: '95531',
        phone: '(707) 464-7219'
    },
    'El Dorado': {
        name: 'El Dorado County Superior Court',
        address: '495 Main Street',
        city: 'Placerville',
        state: 'CA',
        zip: '95667',
        phone: '(530) 621-6500',
        locations: [
            {
                name: 'El Dorado County Superior Court - South Lake Tahoe',
                address: '1354 Johnson Boulevard',
                city: 'South Lake Tahoe',
                state: 'CA',
                zip: '96150',
                phone: '(530) 573-3100'
            }
        ]
    },
    'Fresno': {
        name: 'Fresno County Superior Court',
        address: '1100 Van Ness Avenue',
        city: 'Fresno',
        state: 'CA',
        zip: '93721',
        phone: '(559) 457-2000'
    },
    'Glenn': {
        name: 'Glenn County Superior Court',
        address: '526 W. Sycamore Street',
        city: 'Willows',
        state: 'CA',
        zip: '95988',
        phone: '(530) 934-6400'
    },
    'Humboldt': {
        name: 'Humboldt County Superior Court',
        address: '825 5th Street',
        city: 'Eureka',
        state: 'CA',
        zip: '95501',
        phone: '(707) 445-7255'
    },
    'Imperial': {
        name: 'Imperial County Superior Court',
        address: '939 Main Street',
        city: 'El Centro',
        state: 'CA',
        zip: '92243',
        phone: '(760) 482-4300'
    },
    'Inyo': {
        name: 'Inyo County Superior Court',
        address: '168 North Edwards Street',
        city: 'Independence',
        state: 'CA',
        zip: '93526',
        phone: '(760) 878-0257'
    },
    'Kern': {
        name: 'Kern County Superior Court',
        address: '1415 Truxtun Avenue',
        city: 'Bakersfield',
        state: 'CA',
        zip: '93301',
        phone: '(661) 868-4900'
    },
    'Kings': {
        name: 'Kings County Superior Court',
        address: '1400 West Lacey Boulevard',
        city: 'Hanford',
        state: 'CA',
        zip: '93230',
        phone: '(559) 582-1010'
    },
    'Lake': {
        name: 'Lake County Superior Court',
        address: '255 North Forbes Street',
        city: 'Lakeport',
        state: 'CA',
        zip: '95453',
        phone: '(707) 263-2700'
    },
    'Lassen': {
        name: 'Lassen County Superior Court',
        address: '200 South Lassen Street',
        city: 'Susanville',
        state: 'CA',
        zip: '96130',
        phone: '(530) 251-8200'
    },
    'Los Angeles': {
        name: 'Los Angeles County Superior Court',
        address: '111 North Hill Street',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90012',
        phone: '(213) 974-5233',
        note: 'Multiple locations - check court website for nearest location'
    },
    'Madera': {
        name: 'Madera County Superior Court',
        address: '209 West Yosemite Avenue',
        city: 'Madera',
        state: 'CA',
        zip: '93637',
        phone: '(559) 675-7700'
    },
    'Marin': {
        name: 'Marin County Superior Court',
        address: '3501 Civic Center Drive',
        city: 'San Rafael',
        state: 'CA',
        zip: '94903',
        phone: '(415) 444-7040'
    },
    'Mariposa': {
        name: 'Mariposa County Superior Court',
        address: '5088 Bullion Street',
        city: 'Mariposa',
        state: 'CA',
        zip: '95338',
        phone: '(209) 966-2000'
    },
    'Mendocino': {
        name: 'Mendocino County Superior Court',
        address: '100 North State Street',
        city: 'Ukiah',
        state: 'CA',
        zip: '95482',
        phone: '(707) 463-4422'
    },
    'Merced': {
        name: 'Merced County Superior Court',
        address: '627 West 21st Street',
        city: 'Merced',
        state: 'CA',
        zip: '95340',
        phone: '(209) 725-4100'
    },
    'Modoc': {
        name: 'Modoc County Superior Court',
        address: '204 South Court Street',
        city: 'Alturas',
        state: 'CA',
        zip: '96101',
        phone: '(530) 233-6200'
    },
    'Mono': {
        name: 'Mono County Superior Court',
        address: '129 Bryant Street',
        city: 'Bridgeport',
        state: 'CA',
        zip: '93517',
        phone: '(760) 932-5440'
    },
    'Monterey': {
        name: 'Monterey County Superior Court',
        address: '240 Church Street',
        city: 'Salinas',
        state: 'CA',
        zip: '93901',
        phone: '(831) 755-5000'
    },
    'Napa': {
        name: 'Napa County Superior Court',
        address: '1111 Third Street',
        city: 'Napa',
        state: 'CA',
        zip: '94559',
        phone: '(707) 299-1100'
    },
    'Nevada': {
        name: 'Nevada County Superior Court',
        address: '201 Church Street',
        city: 'Nevada City',
        state: 'CA',
        zip: '95959',
        phone: '(530) 265-1293'
    },
    'Orange': {
        name: 'Orange County Superior Court',
        address: '700 Civic Center Drive West',
        city: 'Santa Ana',
        state: 'CA',
        zip: '92701',
        phone: '(657) 622-8000'
    },
    'Placer': {
        name: 'Placer County Superior Court',
        address: '10820 Justice Center Drive',
        city: 'Roseville',
        state: 'CA',
        zip: '95678',
        phone: '(916) 408-6000',
        locations: [
            {
                name: 'Placer County Superior Court - Auburn',
                address: '101 Maple Street',
                city: 'Auburn',
                state: 'CA',
                zip: '95603',
                phone: '(530) 889-6200'
            }
        ]
    },
    'Plumas': {
        name: 'Plumas County Superior Court',
        address: '520 Main Street',
        city: 'Quincy',
        state: 'CA',
        zip: '95971',
        phone: '(530) 283-6300'
    },
    'Riverside': {
        name: 'Riverside County Superior Court',
        address: '4050 Main Street',
        city: 'Riverside',
        state: 'CA',
        zip: '92501',
        phone: '(951) 777-3147'
    },
    'Sacramento': {
        name: 'Sacramento County Superior Court',
        address: '720 9th Street',
        city: 'Sacramento',
        state: 'CA',
        zip: '95814',
        phone: '(916) 874-5522'
    },
    'San Benito': {
        name: 'San Benito County Superior Court',
        address: '440 Fifth Street',
        city: 'Hollister',
        state: 'CA',
        zip: '95023',
        phone: '(831) 636-4030'
    },
    'San Bernardino': {
        name: 'San Bernardino County Superior Court',
        address: '351 North Arrowhead Avenue',
        city: 'San Bernardino',
        state: 'CA',
        zip: '92415',
        phone: '(909) 708-8686'
    },
    'San Diego': {
        name: 'San Diego County Superior Court',
        address: '330 West Broadway',
        city: 'San Diego',
        state: 'CA',
        zip: '92101',
        phone: '(619) 844-3000'
    },
    'San Francisco': {
        name: 'San Francisco County Superior Court',
        address: '400 McAllister Street',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        phone: '(415) 551-4000'
    },
    'San Joaquin': {
        name: 'San Joaquin County Superior Court',
        address: '222 East Weber Avenue',
        city: 'Stockton',
        state: 'CA',
        zip: '95202',
        phone: '(209) 468-2600'
    },
    'San Luis Obispo': {
        name: 'San Luis Obispo County Superior Court',
        address: '1035 Palm Street',
        city: 'San Luis Obispo',
        state: 'CA',
        zip: '93408',
        phone: '(805) 781-5670'
    },
    'San Mateo': {
        name: 'San Mateo County Superior Court',
        address: '400 County Center',
        city: 'Redwood City',
        state: 'CA',
        zip: '94063',
        phone: '(650) 261-5100'
    },
    'Santa Barbara': {
        name: 'Santa Barbara County Superior Court',
        address: '1100 Anacapa Street',
        city: 'Santa Barbara',
        state: 'CA',
        zip: '93101',
        phone: '(805) 568-2200'
    },
    'Santa Clara': {
        name: 'Santa Clara County Superior Court',
        address: '191 North First Street',
        city: 'San Jose',
        state: 'CA',
        zip: '95113',
        phone: '(408) 882-2100'
    },
    'Santa Cruz': {
        name: 'Santa Cruz County Superior Court',
        address: '701 Ocean Street',
        city: 'Santa Cruz',
        state: 'CA',
        zip: '95060',
        phone: '(831) 420-2200'
    },
    'Shasta': {
        name: 'Shasta County Superior Court',
        address: '1500 Court Street',
        city: 'Redding',
        state: 'CA',
        zip: '96001',
        phone: '(530) 245-6789'
    },
    'Sierra': {
        name: 'Sierra County Superior Court',
        address: '100 Courthouse Square',
        city: 'Downieville',
        state: 'CA',
        zip: '95936',
        phone: '(530) 289-3695'
    },
    'Siskiyou': {
        name: 'Siskiyou County Superior Court',
        address: '311 Fourth Street',
        city: 'Yreka',
        state: 'CA',
        zip: '96097',
        phone: '(530) 842-8126'
    },
    'Solano': {
        name: 'Solano County Superior Court',
        address: '600 Union Avenue',
        city: 'Fairfield',
        state: 'CA',
        zip: '94533',
        phone: '(707) 207-7300'
    },
    'Sonoma': {
        name: 'Sonoma County Superior Court',
        address: '600 Administration Drive',
        city: 'Santa Rosa',
        state: 'CA',
        zip: '95403',
        phone: '(707) 521-6500'
    },
    'Stanislaus': {
        name: 'Stanislaus County Superior Court',
        address: '800 11th Street',
        city: 'Modesto',
        state: 'CA',
        zip: '95354',
        phone: '(209) 530-3000'
    },
    'Sutter': {
        name: 'Sutter County Superior Court',
        address: '433 Second Street',
        city: 'Yuba City',
        state: 'CA',
        zip: '95991',
        phone: '(530) 822-3200'
    },
    'Tehama': {
        name: 'Tehama County Superior Court',
        address: '445 Oak Street',
        city: 'Red Bluff',
        state: 'CA',
        zip: '96080',
        phone: '(530) 527-3571'
    },
    'Trinity': {
        name: 'Trinity County Superior Court',
        address: '101 Court Street',
        city: 'Weaverville',
        state: 'CA',
        zip: '96093',
        phone: '(530) 623-1234'
    },
    'Tulare': {
        name: 'Tulare County Superior Court',
        address: '221 South Mooney Boulevard',
        city: 'Visalia',
        state: 'CA',
        zip: '93291',
        phone: '(559) 730-5000'
    },
    'Tuolumne': {
        name: 'Tuolumne County Superior Court',
        address: '2 South Green Street',
        city: 'Sonora',
        state: 'CA',
        zip: '95370',
        phone: '(209) 533-5555'
    },
    'Ventura': {
        name: 'Ventura County Superior Court',
        address: '800 South Victoria Avenue',
        city: 'Ventura',
        state: 'CA',
        zip: '93009',
        phone: '(805) 289-8000'
    },
    'Yolo': {
        name: 'Yolo County Superior Court',
        address: '725 Court Street',
        city: 'Woodland',
        state: 'CA',
        zip: '95695',
        phone: '(530) 406-6700'
    },
    'Yuba': {
        name: 'Yuba County Superior Court',
        address: '215 5th Street',
        city: 'Marysville',
        state: 'CA',
        zip: '95901',
        phone: '(530) 749-7700'
    }
};

// Helper function to get court info by county name
function getCourtByCounty(countyName) {
    return countyToCourt[countyName] || null;
}

// Helper function to format full address
function formatCourtAddress(courtInfo) {
    if (!courtInfo) return null;
    // Use the main court info, not locations (locations are additional locations)
    return `${courtInfo.address}, ${courtInfo.city}, ${courtInfo.state} ${courtInfo.zip}`;
}

// Helper function to get court name
function getCourtName(courtInfo) {
    return courtInfo ? courtInfo.name : null;
}

