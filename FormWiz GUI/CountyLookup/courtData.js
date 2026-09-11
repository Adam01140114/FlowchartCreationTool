// California County to Small Claims Court Mapping
// The address is where small claims are FILED (not always the county's main courthouse).
// Every entry was verified 2026-09-11 against the court's official website ('source').
// 'note' explains venue quirks; 'locations' lists other courthouses that also take filings.

const countyToCourt = {
    'Alameda': {
        name: 'Alameda County Superior Court',
        address: '1225 Fallon Street',
        city: 'Oakland',
        state: 'CA',
        zip: '94612',
        phone: '(510) 891-6000',
        locations: [
            {
                name: 'Hayward Hall of Justice',
                address: '24405 Amador Street',
                city: 'Hayward',
                state: 'CA',
                zip: '94544',
                phone: '(510) 690-2700'
            }
        ],
        source: 'https://www.alameda.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Alpine': {
        name: 'Alpine County Superior Court',
        address: '14777 State Route 89',
        city: 'Markleeville',
        state: 'CA',
        zip: '96120',
        phone: '(530) 694-2113',
        source: 'https://www.alpine.courts.ca.gov/location/alpine-county-superior-court',
        verified: '2026-09-11'
    },
    'Amador': {
        name: 'Amador County Superior Court',
        address: '500 Argonaut Lane',
        city: 'Jackson',
        state: 'CA',
        zip: '95642',
        phone: '(209) 257-2603',
        source: 'https://amador.courts.ca.gov/general-information/contact-information',
        verified: '2026-09-11'
    },
    'Butte': {
        name: 'Butte County Superior Court - North Butte County Courthouse',
        address: '1775 Concord Avenue',
        city: 'Chico',
        state: 'CA',
        zip: '95928',
        phone: '(530) 532-7009',
        note: 'All civil and small claims filings are at Chico. Oroville (1 Court St) handles criminal and juvenile only.',
        source: 'https://www.butte.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Calaveras': {
        name: 'Calaveras County Superior Court',
        address: '400 Government Center Drive',
        city: 'San Andreas',
        state: 'CA',
        zip: '95249',
        phone: '(209) 754-9800',
        source: 'https://www.calaveras.courts.ca.gov/location/calaveras-superior-court',
        verified: '2026-09-11'
    },
    'Colusa': {
        name: 'Colusa County Superior Court',
        address: '532 Oak Street',
        city: 'Colusa',
        state: 'CA',
        zip: '95932',
        phone: '(530) 458-5149',
        source: 'https://www.colusa.courts.ca.gov/general-information/locations-contact-info',
        verified: '2026-09-11'
    },
    'Contra Costa': {
        name: 'Contra Costa County Superior Court',
        address: '725 Court Street',
        city: 'Martinez',
        state: 'CA',
        zip: '94553',
        phone: '(925) 608-1000',
        note: 'File in Martinez, Pittsburg, or Richmond depending on where the dispute arose.',
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
        ],
        source: 'https://contracosta.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Del Norte': {
        name: 'Del Norte County Superior Court',
        address: '450 H Street, Room 209',
        city: 'Crescent City',
        state: 'CA',
        zip: '95531',
        phone: '(707) 464-8115',
        source: 'https://www.delnorte.courts.ca.gov/general-information/location-contact',
        verified: '2026-09-11'
    },
    'El Dorado': {
        name: 'El Dorado County Superior Court - Cameron Park',
        address: '2927 Meder Road',
        city: 'Cameron Park',
        state: 'CA',
        zip: '95682',
        phone: '(530) 621-5047',
        locations: [
            {
                name: 'El Dorado County Superior Court - South Lake Tahoe',
                address: '1354 Johnson Boulevard',
                city: 'South Lake Tahoe',
                state: 'CA',
                zip: '96150',
                phone: '(530) 573-3075'
            }
        ],
        source: 'https://www.eldorado.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Fresno': {
        name: 'Fresno County Superior Court',
        address: '1100 Van Ness Avenue',
        city: 'Fresno',
        state: 'CA',
        zip: '93724',
        phone: '(559) 457-2000',
        source: 'https://www.fresno.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Glenn': {
        name: 'Glenn County Superior Court',
        address: '526 W. Sycamore Street',
        city: 'Willows',
        state: 'CA',
        zip: '95988',
        phone: '(530) 934-6446',
        source: 'https://www.glenn.courts.ca.gov/general-information/locations-contact-info',
        verified: '2026-09-11'
    },
    'Humboldt': {
        name: 'Humboldt County Superior Court',
        address: '421 I Street',
        city: 'Eureka',
        state: 'CA',
        zip: '95501',
        phone: '(707) 445-7256',
        note: 'Filings accepted at the Clerk\'s Office at 421 I St. Mailing address is 825 5th St, Eureka 95501.',
        source: 'https://www.humboldt.courts.ca.gov/general-information/contact-uslocations',
        verified: '2026-09-11'
    },
    'Imperial': {
        name: 'Imperial County Superior Court',
        address: '939 West Main Street',
        city: 'El Centro',
        state: 'CA',
        zip: '92243',
        phone: '(760) 482-2200',
        source: 'https://www.imperial.courts.ca.gov/location/el-centro-courthouse',
        verified: '2026-09-11'
    },
    'Inyo': {
        name: 'Inyo County Superior Court',
        address: '168 North Edwards Street',
        city: 'Independence',
        state: 'CA',
        zip: '93526',
        phone: '(760) 872-3038',
        locations: [
            {
                name: 'Inyo County Superior Court - Bishop',
                address: '301 West Line Street',
                city: 'Bishop',
                state: 'CA',
                zip: '93514',
                phone: '(760) 872-3038'
            }
        ],
        source: 'https://www.inyo.courts.ca.gov/divisions/small-claims-unlawful-detainers',
        verified: '2026-09-11'
    },
    'Kern': {
        name: 'Kern County Superior Court - Metro Justice Building',
        address: '1215 Truxtun Avenue',
        city: 'Bakersfield',
        state: 'CA',
        zip: '93301',
        phone: '(661) 610-6000',
        source: 'https://www.kern.courts.ca.gov/divisions/civil-and-small-claims',
        verified: '2026-09-11'
    },
    'Kings': {
        name: 'Kings County Superior Court',
        address: '1640 Kings County Drive',
        city: 'Hanford',
        state: 'CA',
        zip: '93230',
        phone: '(559) 582-1010',
        source: 'https://www.kings.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Lake': {
        name: 'Lake County Superior Court - Clearlake Division',
        address: '7000-A South Center Drive',
        city: 'Clearlake',
        state: 'CA',
        zip: '95422',
        phone: '(707) 994-6598',
        note: 'Small claims are filed and heard at the Clearlake Division, not Lakeport.',
        source: 'https://lake.courts.ca.gov/divisions/small-claims-information',
        verified: '2026-09-11'
    },
    'Lassen': {
        name: 'Lassen County Superior Court - Hall of Justice',
        address: '2610 Riverside Drive',
        city: 'Susanville',
        state: 'CA',
        zip: '96130',
        phone: '(530) 251-8205',
        source: 'https://www.lassen.courts.ca.gov/general-information/location-directions',
        verified: '2026-09-11'
    },
    'Los Angeles': {
        name: 'Los Angeles County Superior Court - Stanley Mosk Courthouse',
        address: '111 North Hill Street',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90012',
        phone: '(213) 830-0845',
        note: 'Small claims hubs: Stanley Mosk, Van Nuys, West Covina. Cases are assigned by ZIP code under Local Rule 2.3. Phone is the Self-Help call center.',
        source: 'https://www.lacourt.ca.gov/pages/lp/small-claims',
        verified: '2026-09-11'
    },
    'Madera': {
        name: 'Madera County Superior Court',
        address: '200 South G Street',
        city: 'Madera',
        state: 'CA',
        zip: '93637',
        phone: '(559) 416-5599',
        source: 'https://www.madera.courts.ca.gov/divisions/small-claims-court',
        verified: '2026-09-11'
    },
    'Marin': {
        name: 'Marin County Superior Court',
        address: '3501 Civic Center Drive, Room 113',
        city: 'San Rafael',
        state: 'CA',
        zip: '94903',
        phone: '(415) 444-7130',
        source: 'https://www.marin.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Mariposa': {
        name: 'Mariposa County Superior Court',
        address: '5088 Bullion Street',
        city: 'Mariposa',
        state: 'CA',
        zip: '95338',
        phone: '(209) 966-2005',
        source: 'https://www.mariposa.courts.ca.gov/general-information/location-contact-info',
        verified: '2026-09-11'
    },
    'Mendocino': {
        name: 'Mendocino County Superior Court',
        address: '100 North State Street, Room 107',
        city: 'Ukiah',
        state: 'CA',
        zip: '95482',
        phone: '(707) 468-2002',
        source: 'https://www.mendocino.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Merced': {
        name: 'Merced County Superior Court',
        address: '627 West 21st Street',
        city: 'Merced',
        state: 'CA',
        zip: '95340',
        phone: '(209) 725-4100',
        source: 'https://www.merced.courts.ca.gov/general-information/locations-contact-information',
        verified: '2026-09-11'
    },
    'Modoc': {
        name: 'Modoc County Superior Court - Barclay Justice Center',
        address: '205 South East Street',
        city: 'Alturas',
        state: 'CA',
        zip: '96101',
        phone: '(530) 233-6516',
        source: 'https://www.modoc.courts.ca.gov/general-information/location-and-contact-information',
        verified: '2026-09-11'
    },
    'Mono': {
        name: 'Mono County Superior Court',
        address: '278 Main Street',
        city: 'Bridgeport',
        state: 'CA',
        zip: '93517',
        phone: '(760) 932-5239',
        locations: [
            {
                name: 'Mono County Superior Court - Mammoth Lakes',
                address: '100 Thompsons Way',
                city: 'Mammoth Lakes',
                state: 'CA',
                zip: '93546',
                phone: '(760) 924-5444'
            }
        ],
        source: 'https://www.mono.courts.ca.gov/general-information/location-and-contact-information',
        verified: '2026-09-11'
    },
    'Monterey': {
        name: 'Monterey County Superior Court - Monterey Courthouse',
        address: '1200 Aguajito Road',
        city: 'Monterey',
        state: 'CA',
        zip: '93940',
        phone: '(831) 647-5800',
        note: 'All small claims are filed at the Monterey courthouse and heard in Marina.',
        source: 'https://www.monterey.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Napa': {
        name: 'Napa County Superior Court - Historic Courthouse',
        address: '825 Brown Street',
        city: 'Napa',
        state: 'CA',
        zip: '94559',
        phone: '(707) 299-1130',
        source: 'https://www.napa.courts.ca.gov/general-information/locations-contact-info',
        verified: '2026-09-11'
    },
    'Nevada': {
        name: 'Nevada County Superior Court',
        address: '201 Church Street',
        city: 'Nevada City',
        state: 'CA',
        zip: '95959',
        phone: '(530) 362-5328',
        source: 'https://www.nevada.courts.ca.gov/small-claims',
        verified: '2026-09-11'
    },
    'Orange': {
        name: 'Orange County Superior Court - Central Justice Center',
        address: '700 Civic Center Drive West',
        city: 'Santa Ana',
        state: 'CA',
        zip: '92701',
        phone: '(657) 622-6878',
        source: 'https://www.occourts.org/divisions/small-claims',
        verified: '2026-09-11'
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
        ],
        source: 'https://www.placer.courts.ca.gov/locations',
        verified: '2026-09-11'
    },
    'Plumas': {
        name: 'Plumas County Superior Court',
        address: '520 Main Street, Room 104',
        city: 'Quincy',
        state: 'CA',
        zip: '95971',
        phone: '(530) 283-6232',
        source: 'https://plumas.courts.ca.gov/general-information/location',
        verified: '2026-09-11'
    },
    'Riverside': {
        name: 'Riverside County Superior Court - Historic Courthouse',
        address: '4050 Main Street',
        city: 'Riverside',
        state: 'CA',
        zip: '92501',
        phone: '(951) 777-3147',
        source: 'https://www.riverside.courts.ca.gov/self-help/small-claims/filing-small-claims',
        verified: '2026-09-11'
    },
    'Sacramento': {
        name: 'Sacramento County Superior Court - Carol Miller Justice Center',
        address: '301 Bicentennial Circle, Room 200',
        city: 'Sacramento',
        state: 'CA',
        zip: '95826',
        phone: '(916) 875-7746',
        source: 'https://www.saccourt.ca.gov/small-claims/',
        verified: '2026-09-11'
    },
    'San Benito': {
        name: 'San Benito County Superior Court',
        address: '450 Fourth Street',
        city: 'Hollister',
        state: 'CA',
        zip: '95023',
        phone: '(831) 636-4057',
        source: 'https://www.sanbenito.courts.ca.gov/location/main-courthouse',
        verified: '2026-09-11'
    },
    'San Bernardino': {
        name: 'San Bernardino County Superior Court - San Bernardino Justice Center',
        address: '247 West Third Street',
        city: 'San Bernardino',
        state: 'CA',
        zip: '92415',
        phone: '(909) 708-8678',
        source: 'https://sanbernardino.courts.ca.gov/locations',
        verified: '2026-09-11'
    },
    'San Diego': {
        name: 'San Diego County Superior Court - Hall of Justice',
        address: '330 West Broadway, Room 225',
        city: 'San Diego',
        state: 'CA',
        zip: '92101',
        phone: '(619) 450-7275',
        source: 'https://www.sdcourt.ca.gov/sdcourt/smallclaims2/smallclaimslocations',
        verified: '2026-09-11'
    },
    'San Francisco': {
        name: 'San Francisco County Superior Court',
        address: '400 McAllister Street, Room 103',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        phone: '(415) 551-4000',
        source: 'https://sf.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'San Joaquin': {
        name: 'San Joaquin County Superior Court',
        address: '180 East Weber Avenue',
        city: 'Stockton',
        state: 'CA',
        zip: '95202',
        phone: '(209) 992-5555',
        source: 'https://sjcourts.org/court-location-and-contact/stockton-courthouse',
        verified: '2026-09-11'
    },
    'San Luis Obispo': {
        name: 'San Luis Obispo County Superior Court',
        address: '1035 Palm Street, Room 385',
        city: 'San Luis Obispo',
        state: 'CA',
        zip: '93408',
        phone: '(805) 781-5677',
        source: 'https://www.slo.courts.ca.gov/self-help/small-claims',
        verified: '2026-09-11'
    },
    'San Mateo': {
        name: 'San Mateo County Superior Court',
        address: '400 County Center',
        city: 'Redwood City',
        state: 'CA',
        zip: '94063',
        phone: '(650) 261-5100',
        source: 'https://sanmateo.courts.ca.gov/divisions/small-claims-division',
        verified: '2026-09-11'
    },
    'Santa Barbara': {
        name: 'Santa Barbara County Superior Court',
        address: '1100 Anacapa Street',
        city: 'Santa Barbara',
        state: 'CA',
        zip: '93101',
        phone: '(805) 882-4520',
        note: 'Anacapa Division serves south county only.',
        source: 'https://www.santabarbara.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Santa Clara': {
        name: 'Santa Clara County Superior Court',
        address: '191 North First Street',
        city: 'San Jose',
        state: 'CA',
        zip: '95113',
        phone: '(408) 882-2352',
        source: 'https://santaclara.courts.ca.gov/divisions/small-claims-division',
        verified: '2026-09-11'
    },
    'Santa Cruz': {
        name: 'Santa Cruz County Superior Court - Watsonville Courthouse',
        address: '1 Second Street',
        city: 'Watsonville',
        state: 'CA',
        zip: '95076',
        phone: '(831) 786-7200',
        note: 'All small claims are filed and heard at Watsonville.',
        source: 'https://www.santacruz.courts.ca.gov/divisions/small-claims-division',
        verified: '2026-09-11'
    },
    'Shasta': {
        name: 'Shasta County Superior Court',
        address: '1515 Court Street',
        city: 'Redding',
        state: 'CA',
        zip: '96001',
        phone: '(530) 245-6789',
        source: 'https://www.shasta.courts.ca.gov/divisions/small-claims-division',
        verified: '2026-09-11'
    },
    'Sierra': {
        name: 'Sierra County Superior Court',
        address: '100 Courthouse Square',
        city: 'Downieville',
        state: 'CA',
        zip: '95936',
        phone: '(530) 289-3698',
        source: 'https://www.sierra.courts.ca.gov/general-information/locations-contact-info',
        verified: '2026-09-11'
    },
    'Siskiyou': {
        name: 'Siskiyou County Superior Court',
        address: '411 Fourth Street',
        city: 'Yreka',
        state: 'CA',
        zip: '96097',
        phone: '(530) 842-0411',
        source: 'https://www.siskiyou.courts.ca.gov/general-information/location-contact-info',
        verified: '2026-09-11'
    },
    'Solano': {
        name: 'Solano County Superior Court - Old Solano Courthouse',
        address: '580 Texas Street',
        city: 'Fairfield',
        state: 'CA',
        zip: '94533',
        phone: '(707) 207-7335',
        note: 'Small claims are filed at the Old Solano Courthouse; hearings are at the Hall of Justice, 600 Union Ave.',
        source: 'https://solano.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Sonoma': {
        name: 'Sonoma County Superior Court - Civil and Family Law Courthouse',
        address: '3055 Cleveland Avenue',
        city: 'Santa Rosa',
        state: 'CA',
        zip: '95403',
        phone: '(707) 521-6610',
        source: 'https://sonoma.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Stanislaus': {
        name: 'Stanislaus County Superior Court - Turlock Courthouse',
        address: '300 Starr Avenue',
        city: 'Turlock',
        state: 'CA',
        zip: '95380',
        phone: '(209) 530-3100',
        note: 'Small claims are filed and heard at Turlock.',
        source: 'https://www.stanislaus.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Sutter': {
        name: 'Sutter County Superior Court',
        address: '1175 Civic Center Boulevard',
        city: 'Yuba City',
        state: 'CA',
        zip: '95993',
        phone: '(530) 822-3304',
        source: 'https://www.sutter.courts.ca.gov/general-information/location-contact-info',
        verified: '2026-09-11'
    },
    'Tehama': {
        name: 'Tehama County Superior Court',
        address: '1740 Walnut Street',
        city: 'Red Bluff',
        state: 'CA',
        zip: '96080',
        phone: '(530) 527-3563',
        source: 'https://www.tehama.courts.ca.gov/location/tehama-county-superior-court',
        verified: '2026-09-11'
    },
    'Trinity': {
        name: 'Trinity County Superior Court',
        address: '11 Court Street',
        city: 'Weaverville',
        state: 'CA',
        zip: '96093',
        phone: '(530) 623-1208',
        source: 'https://www.trinity.courts.ca.gov/general-information/locations-contact-info',
        verified: '2026-09-11'
    },
    'Tulare': {
        name: 'Tulare County Superior Court',
        address: '221 South Mooney Boulevard, Room 201',
        city: 'Visalia',
        state: 'CA',
        zip: '93291',
        phone: '(559) 730-5000',
        source: 'https://www.tulare.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Tuolumne': {
        name: 'Tuolumne County Superior Court',
        address: '12855 Justice Center Drive',
        city: 'Sonora',
        state: 'CA',
        zip: '95370',
        phone: '(209) 533-5563',
        source: 'https://www.tuolumne.courts.ca.gov/location/tuolumne-county-superior-court',
        verified: '2026-09-11'
    },
    'Ventura': {
        name: 'Ventura County Superior Court - Hall of Justice',
        address: '800 South Victoria Avenue',
        city: 'Ventura',
        state: 'CA',
        zip: '93009',
        phone: '(805) 289-8900',
        source: 'https://www.ventura.courts.ca.gov/small-claims.html',
        verified: '2026-09-11'
    },
    'Yolo': {
        name: 'Yolo County Superior Court',
        address: '1000 Main Street',
        city: 'Woodland',
        state: 'CA',
        zip: '95695',
        phone: '(530) 406-6704',
        source: 'https://www.yolo.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
    'Yuba': {
        name: 'Yuba County Superior Court',
        address: '215 Fifth Street, Suite 200',
        city: 'Marysville',
        state: 'CA',
        zip: '95901',
        phone: '(530) 740-1800',
        source: 'https://www.yuba.courts.ca.gov/divisions/small-claims',
        verified: '2026-09-11'
    },
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

