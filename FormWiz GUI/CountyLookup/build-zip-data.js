#!/usr/bin/env node
/**
 * Builds zipData.js: California ZIP code -> county.
 *
 * Sources (all free, all in ./sources, filtered to California rows):
 *   1. census_zcta_county_2020.txt  - Census 2020 ZCTA <-> county relationship
 *                                     (land area of each ZCTA/county piece).
 *      https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
 *   2. census_zcta_county_pop2010.txt - Census 2010 ZCTA <-> county relationship
 *                                     (population of each ZCTA/county piece).
 *      https://www2.census.gov/geo/docs/maps-data/data/rel/zcta_county_rel_10.txt
 *   3. geonames_CA.txt              - GeoNames US postal codes (USPS ZIPs incl.
 *                                     PO-box and unique ZIPs that have no ZCTA).
 *      https://download.geonames.org/export/zip/US.zip  (CC BY 4.0)
 *
 * Decision rule, per ZIP:
 *   a. ZCTA lies in exactly one county            -> that county.
 *   b. ZCTA spans several counties                -> county holding the most
 *      residents (2010 population share). Land area is a poor proxy in rural
 *      California; population is what matters for venue.
 *   c. ZIP has no ZCTA (PO box / unique ZIP)      -> GeoNames county.
 *   ZIPs whose USPS state is not CA are skipped, even if a sliver of the ZCTA
 *   crosses the state line (e.g. 89019 Amargosa Valley, NV).
 *
 * Usage:  node build-zip-data.js        (writes ./zipData.js)
 *         node build-zip-data.js --refresh-geonames   (re-downloads GeoNames first)
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'sources');
const OUT = path.join(__dirname, 'zipData.js');
const CA_FIPS = '06';

function readLines(file) {
    return fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
}

function cleanCounty(name) {
    return name
        .replace(/^City and County of /, '')
        .replace(/ County$/, '')
        .trim();
}

// ---------- 1. Census 2020: ZCTA -> [{county, fips, landArea}] ----------
function loadCensus2020() {
    const lines = readLines(path.join(SRC, 'census_zcta_county_2020.txt'));
    const header = lines[0].split('|');
    const col = (n) => header.indexOf(n);
    const iZ = col('GEOID_ZCTA5_20'), iC = col('GEOID_COUNTY_20'),
          iN = col('NAMELSAD_COUNTY_20'), iA = col('AREALAND_PART');
    const byZip = {};
    const fipsToName = {};
    for (const line of lines.slice(1)) {
        const c = line.split('|');
        const zcta = c[iZ], fips = c[iC];
        if (!zcta || !fips || !fips.startsWith(CA_FIPS)) continue;
        const county = cleanCounty(c[iN]);
        fipsToName[fips] = county;
        (byZip[zcta] = byZip[zcta] || []).push({ county, fips, landArea: Number(c[iA]) || 0 });
    }
    return { byZip, fipsToName };
}

// ---------- 2. Census 2010: ZCTA -> {countyFips: population} ----------
function loadCensus2010() {
    const lines = readLines(path.join(SRC, 'census_zcta_county_pop2010.txt'));
    const header = lines[0].split(',');
    const col = (n) => header.indexOf(n);
    const iZ = col('ZCTA5'), iS = col('STATE'), iG = col('GEOID'), iP = col('POPPT');
    const byZip = {};
    for (const line of lines.slice(1)) {
        const c = line.split(',');
        if (c[iS] !== CA_FIPS) continue;
        (byZip[c[iZ]] = byZip[c[iZ]] || {})[c[iG]] = Number(c[iP]) || 0;
    }
    return byZip;
}

// ---------- 3. GeoNames: ZIP -> {city, county} (CA only) ----------
function loadGeoNames() {
    const byZip = {};
    for (const line of readLines(path.join(SRC, 'geonames_CA.txt'))) {
        const c = line.split('\t');
        // country, zip, place, state name, state code, county name, county code, ...
        if (c[4] !== 'CA') continue;
        byZip[c[1]] = { city: c[2], county: cleanCounty(c[5] || '') };
    }
    return byZip;
}

function build() {
    const { byZip: census20, fipsToName } = loadCensus2020();
    const pop10 = loadCensus2010();
    const geo = loadGeoNames();

    const details = {};
    const stats = { single: 0, multi: 0, multiNoPop: 0, geoOnly: 0, skippedNonCA: 0, geoDisagree: [] };

    // a + b: every ZCTA that touches California
    for (const zip of Object.keys(census20)) {
        const parts = census20[zip];
        const g = geo[zip];
        if (!g) { stats.skippedNonCA++; continue; }   // USPS says this ZIP is not in CA

        let county, counties, method;
        if (parts.length === 1) {
            county = parts[0].county;
            counties = [{ county, share: 1 }];
            method = 'census-single-county';
            stats.single++;
        } else {
            const pops = pop10[zip];
            if (pops) {
                const total = Object.values(pops).reduce((s, p) => s + p, 0) || 1;
                counties = parts.map(p => ({ county: p.county, share: (pops[p.fips] || 0) / total }));
                method = 'census-population-majority';
                stats.multi++;
            } else {
                const total = parts.reduce((s, p) => s + p.landArea, 0) || 1;
                counties = parts.map(p => ({ county: p.county, share: p.landArea / total }));
                method = 'census-land-area-majority';
                stats.multiNoPop++;
            }
            counties.sort((a, b) => b.share - a.share);
            county = counties[0].county;
            if (g.county && g.county !== county) {
                stats.geoDisagree.push(`${zip} ${g.city}: chose ${county} (${Math.round(counties[0].share * 100)}%), USPS city is in ${g.county}`);
            }
        }
        details[zip] = { county, city: g.city, counties: counties.map(c => ({ county: c.county, share: Math.round(c.share * 1000) / 1000 })), method };
    }

    // c: USPS ZIPs with no ZCTA (PO boxes, unique ZIPs)
    for (const zip of Object.keys(geo)) {
        if (details[zip]) continue;
        const g = geo[zip];
        if (!g.county) continue;
        details[zip] = { county: g.county, city: g.city, counties: [{ county: g.county, share: 1 }], method: 'usps-geonames' };
        stats.geoOnly++;
    }

    // d: manual overrides for known source errors (sources/overrides.json)
    const overridesPath = path.join(SRC, 'overrides.json');
    if (fs.existsSync(overridesPath)) {
        const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
        for (const [zip, o] of Object.entries(overrides)) {
            if (zip.startsWith('_')) continue;
            const prev = details[zip];
            details[zip] = {
                county: o.county,
                city: o.city || (prev && prev.city) || '',
                counties: [{ county: o.county, share: 1 }],
                method: 'manual-override'
            };
            stats.overridden = (stats.overridden || 0) + 1;
            console.log(`  override ${zip}: ${prev ? prev.county : '(none)'} -> ${o.county} (${o.reason || 'no reason given'})`);
        }
    }

    // Sanity: every county must be one of the 58
    const known = new Set(Object.values(fipsToName));
    for (const [zip, d] of Object.entries(details)) {
        if (!known.has(d.county)) throw new Error(`Unknown county "${d.county}" for ZIP ${zip}`);
    }

    const zips = Object.keys(details).sort();
    const today = new Date().toISOString().slice(0, 10);
    let js = '';
    js += '// California ZIP code -> county mapping\n';
    js += `// Generated ${today} by build-zip-data.js - do not edit by hand.\n`;
    js += `// ${zips.length} ZIP codes: ${stats.single} single-county ZCTAs, ${stats.multi} split ZCTAs resolved by\n`;
    js += `// resident population, ${stats.geoOnly} PO-box/unique ZIPs from USPS (GeoNames).\n`;
    js += '// Sources: Census ZCTA-county relationship files (2020 area, 2010 population), GeoNames postal codes (CC BY 4.0).\n\n';

    js += '// Primary county for each ZIP (backward-compatible simple map).\n';
    js += 'const zipCodeToCounty = {\n';
    for (const zip of zips) js += `    '${zip}': '${details[zip].county}',\n`;
    js += '};\n\n';

    js += '// Full detail per ZIP: primary county, USPS city, every county the ZIP touches\n';
    js += '// with its share of residents (1 = entirely inside), and how it was decided.\n';
    js += 'const zipCodeDetails = {\n';
    for (const zip of zips) {
        const d = details[zip];
        const cs = d.counties.map(c => `{county:'${c.county}',share:${c.share}}`).join(',');
        js += `    '${zip}': {county:'${d.county}',city:${JSON.stringify(d.city)},counties:[${cs}],method:'${d.method}'},\n`;
    }
    js += '};\n\n';

    js += `/**
 * Normalise user input ('90210', '90210-1234', ' 90210 ') to a 5-digit ZIP, or null.
 */
function normalizeZip(input) {
    const m = String(input || '').trim().match(/^(\\d{5})(?:-?\\d{4})?$/);
    return m ? m[1] : null;
}

/**
 * Primary county for a ZIP, or null if it is not a California ZIP.
 */
function getCountyFromZip(input) {
    const zip = normalizeZip(input);
    return zip && zipCodeToCounty[zip] ? zipCodeToCounty[zip] : null;
}

/**
 * Every county a ZIP touches, most residents first: [{county, share}].
 * A ZIP whose top share is below ~0.8 is genuinely split; ask the user which
 * county they live in rather than assuming.
 */
function getCountiesForZip(input) {
    const zip = normalizeZip(input);
    return zip && zipCodeDetails[zip] ? zipCodeDetails[zip].counties : [];
}

if (typeof window !== 'undefined') {
    window.zipCodeToCounty = zipCodeToCounty;
    window.zipCodeDetails = zipCodeDetails;
    window.normalizeZip = normalizeZip;
    window.getCountyFromZip = getCountyFromZip;
    window.getCountiesForZip = getCountiesForZip;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { zipCodeToCounty, zipCodeDetails, normalizeZip, getCountyFromZip, getCountiesForZip };
}
`;

    fs.writeFileSync(OUT, js, 'utf8');
    console.log(`Wrote ${OUT}`);
    console.log(`  ${zips.length} ZIPs total`);
    console.log(`  ${stats.single} single-county, ${stats.multi} split (population), ${stats.multiNoPop} split (land area fallback), ${stats.geoOnly} USPS-only`);
    console.log(`  ${stats.skippedNonCA} ZCTAs skipped because USPS places the ZIP outside CA`);
    if (stats.geoDisagree.length) {
        console.log(`  ${stats.geoDisagree.length} split ZIPs where the USPS city's county differs from the population majority (kept population):`);
        for (const s of stats.geoDisagree) console.log('    ' + s);
    }
}

async function refreshGeoNames() {
    const https = require('https');
    const os = require('os');
    const zipPath = path.join(os.tmpdir(), 'geonames_US.zip');
    console.log('Downloading GeoNames US.zip ...');
    await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(zipPath);
        https.get('https://download.geonames.org/export/zip/US.zip', res => {
            if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
            res.pipe(file); file.on('finish', () => file.close(resolve));
        }).on('error', reject);
    });
    const { execSync } = require('child_process');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geonames-'));
    if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -Command "Expand-Archive -Force '${zipPath}' '${tmpDir}'"`);
    } else {
        execSync(`unzip -o -q "${zipPath}" -d "${tmpDir}"`);
    }
    const all = readLines(path.join(tmpDir, 'US.txt'));
    const ca = all.filter(l => l.split('\t')[4] === 'CA');
    fs.writeFileSync(path.join(SRC, 'geonames_CA.txt'), ca.join('\n') + '\n', 'utf8');
    console.log(`  saved ${ca.length} California rows to sources/geonames_CA.txt`);
}

(async () => {
    if (process.argv.includes('--refresh-geonames')) await refreshGeoNames();
    build();
})().catch(e => { console.error(e); process.exit(1); });
