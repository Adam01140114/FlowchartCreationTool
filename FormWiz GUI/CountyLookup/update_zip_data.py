#!/usr/bin/env python3
"""
Script to download and process California zip code to county mappings.
This script can work with multiple data sources to create an accurate mapping.
"""

import json
import csv
import urllib.request
import sys

def download_rowzero_data():
    """
    Download zip code data from Row Zero (free dataset).
    Note: This requires manual download, but the script can process it.
    """
    print("Row Zero Dataset:")
    print("1. Visit: https://rowzero.com/datasets/zip-codes-to-places")
    print("2. Download the CSV file")
    print("3. Filter for California (state = 'CA')")
    print("4. Save as 'ca_zipcodes.csv' in this directory")
    print("5. Run: python update_zip_data.py --process-csv ca_zipcodes.csv")
    return None

def process_rowzero_csv(filename):
    """Process Row Zero CSV file into our JavaScript format."""
    zip_mapping = {}
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                zip_code = row.get('zip', '').strip()
                state = row.get('state', '').strip()
                county = row.get('county', '').strip()
                
                # Only process California zip codes
                if state.upper() == 'CA' and zip_code and county:
                    # Clean county name (remove "County" suffix if present)
                    county_clean = county.replace(' County', '').strip()
                    zip_mapping[zip_code.zfill(5)] = county_clean
        
        print(f"Processed {len(zip_mapping)} California zip codes from CSV")
        return zip_mapping
    except FileNotFoundError:
        print(f"Error: File '{filename}' not found.")
        return None
    except Exception as e:
        print(f"Error processing CSV: {e}")
        return None

def download_census_data():
    """
    Download Census Bureau ZCTA to County relationship file.
    This is a reliable official source.
    """
    # Census Bureau ZCTA to County relationship file
    url = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"
    
    print("Downloading Census Bureau data...")
    try:
        urllib.request.urlretrieve(url, "census_zcta_county.txt")
        print("Download complete. Processing...")
        return process_census_file("census_zcta_county.txt")
    except Exception as e:
        print(f"Error downloading Census data: {e}")
        return None

def process_census_file(filename):
    """Process Census Bureau ZCTA to County relationship file."""
    zip_mapping = {}
    california_fips = '06'  # California FIPS code
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='|')
            for row in reader:
                # Get ZCTA (zip code) from GEOID - format: "86000123456" where last 5 digits are zip
                zcta_geoid = row.get('GEOID_ZCTA5_20', '').strip()
                county_geoid = row.get('GEOID_COUNTY_20', '').strip()
                county_name = row.get('NAMELSAD_COUNTY_20', '').strip()
                
                # Extract zip code from ZCTA GEOID (last 5 digits)
                if zcta_geoid and len(zcta_geoid) >= 5:
                    zcta = zcta_geoid[-5:]
                else:
                    continue
                
                # Check if county is in California (first 2 digits of county GEOID = state FIPS)
                if county_geoid and len(county_geoid) >= 5:
                    state_fips_from_county = county_geoid[:2]
                else:
                    continue
                
                # Only process California (FIPS code 06)
                if state_fips_from_county == california_fips and zcta and county_name:
                    # Clean county name (remove " County" if present)
                    county_clean = county_name.replace(' County', '').replace(', California', '').strip()
                    # Use the zip code as key, but prefer existing if zip spans multiple counties
                    if zcta not in zip_mapping:
                        zip_mapping[zcta] = county_clean
                    # If zip spans counties, keep the first one (primary county)
        
        print(f"Processed {len(zip_mapping)} California zip codes from Census data")
        return zip_mapping
    except FileNotFoundError:
        print(f"Error: File '{filename}' not found.")
        return None
    except Exception as e:
        print(f"Error processing Census file: {e}")
        import traceback
        traceback.print_exc()
        return None

def generate_js_file(zip_mapping, output_file='zipData.js'):
    """Generate JavaScript file from zip code mapping."""
    if not zip_mapping:
        print("Error: No zip code data to write.")
        return False
    
    js_content = "// California Zip Code to County Mapping\n"
    js_content += "// Auto-generated from reliable data sources\n"
    js_content += f"// Contains {len(zip_mapping)} zip code mappings\n\n"
    js_content += "const zipCodeToCounty = {\n"
    
    # Sort zip codes for better organization
    sorted_zips = sorted(zip_mapping.items())
    
    for zip_code, county in sorted_zips:
        js_content += f"    '{zip_code}': '{county}',\n"
    
    js_content += "};\n"
    
    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"Generated {output_file} with {len(zip_mapping)} zip code mappings")
    return True

def main():
    print("=" * 60)
    print("California Zip Code to County Data Updater")
    print("=" * 60)
    print()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == '--process-csv' and len(sys.argv) > 2:
            csv_file = sys.argv[2]
            zip_mapping = process_rowzero_csv(csv_file)
            if zip_mapping:
                generate_js_file(zip_mapping)
        elif sys.argv[1] == '--download-census':
            zip_mapping = download_census_data()
            if zip_mapping:
                generate_js_file(zip_mapping)
        else:
            print("Usage:")
            print("  python update_zip_data.py --download-census")
            print("  python update_zip_data.py --process-csv <filename.csv>")
    else:
        print("Choose a data source:")
        print()
        print("Option 1: Census Bureau (Official, Recommended)")
        print("  python update_zip_data.py --download-census")
        print()
        print("Option 2: Row Zero Dataset (Requires manual download)")
        download_rowzero_data()
        print()
        print("Option 3: Use API fallback (See script.js for implementation)")

if __name__ == "__main__":
    main()

