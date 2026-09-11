# ZIP code -> county data: sources and method

`zipData.js` is generated. Never hand-edit it; run:

```bash
node build-zip-data.js                     # rebuild from ./sources
node build-zip-data.js --refresh-geonames  # re-download USPS ZIP list first
```

## Sources (all free, filtered to California and kept in `./sources`)

| File | What it gives us | Origin |
|---|---|---|
| `census_zcta_county_2020.txt` | Which counties each ZCTA (Census ZIP area) touches, with land area of each piece | https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt |
| `census_zcta_county_pop2010.txt` | Resident population of each ZCTA/county piece | https://www2.census.gov/geo/docs/maps-data/data/rel/zcta_county_rel_10.txt |
| `geonames_CA.txt` | Every USPS ZIP in California with its city and county, including PO-box and single-building ZIPs that have no ZCTA | https://download.geonames.org/export/zip/US.zip (CC BY 4.0) |

## Decision rule

1. ZCTA entirely inside one county: that county.
2. ZCTA split across counties: the county where most of the ZIP's residents live
   (2010 population share). Land area is a bad proxy in rural California, where a
   ZIP can be mostly empty land in one county and all its people in another.
3. ZIP with no ZCTA (PO box, unique ZIP): the USPS county from GeoNames.
4. ZIPs the USPS places outside California are dropped, even if a sliver of the
   Census area crosses the state line (89019, 89439, 97635 and three others).

Each entry in `zipCodeDetails` keeps every county the ZIP touches with its share,
so a form can ask the user to confirm when the top county is below 80%
(`isSplit` on the `getCourtFromZipCode` result). About 30 ZIPs are in that range.

## Why the old table was wrong

The previous generator kept whichever county appeared first in the Census file.
That mislabelled 83 ZIPs, including Cypress, La Habra and Seal Beach (Orange, not
Los Angeles), Redlands, Colton and Yucaipa (San Bernardino, not Riverside), Santa
Maria (Santa Barbara, not San Luis Obispo), Davis (Yolo, not Solano), Folsom
(Sacramento, not El Dorado) and Lancaster (Los Angeles, not Kern). It also had no
entry at all for the roughly 790 PO-box and unique ZIPs.

## Known limits

- Population shares are from the 2010 Census; county lines have not moved since,
  and ZIP boundaries shift slowly, so the majority county is stable.
- A ZIP-level lookup can never be exact for a split ZIP. Street-level geocoding
  is the only way to be certain; the `isSplit` flag tells you when it matters.
- Refresh GeoNames once or twice a year to pick up new ZIPs.
