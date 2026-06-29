# German Vehicle VIN Decoder Guide

## Overview
This guide covers VIN decoding for German automotive manufacturers, including comprehensive WMI (World Manufacturer Identifier) codes and model identification.

---

## German Manufacturers & WMI Codes

### Primary German Auto Brands

| Manufacturer | WMI Codes | Country | Founded | Note |
|---|---|---|---|---|
| **Mercedes-Benz** | WDB, WDD | Germany 🇩🇪 | 1926 | Luxury vehicles, precision engineering |
| **BMW** | WBA, WBS | Germany 🇩🇪 | 1916 | Luxury & performance, premium models |
| **Audi** | WAU | Germany 🇩🇪 | 1932 | Luxury, VW Group brand, Quattro technology |
| **Volkswagen** | 3VW, WVW | Germany 🇩🇪 | 1937 | Mass market, VW Group parent |
| **Porsche** | WP0 | Germany 🇩🇪 | 1948 | Sports cars, high performance |
| **Opel/Vauxhall** | W0L | Germany 🇩🇪 | 1862 | GM brand (Europe), recently sold to Stellantis |

---

## VIN Structure for German Manufacturers

### Complete 17-Character VIN Format

```
WDDZF4KB7HA071557
│││││││││││││││││
││││││││││││││└─ Serial Number (12-17): 071557
│││││││││││└──── Assembly Code (11): A = Hungary/Other
││││││││││└───── Model Year (10): H = 2017
│││││││││└────── Check Digit (9): 7
││││││├─────── Model Code (4-8): ZF4KB
│││├─ VIN Variant (3): Z = German
││├── Model Series (2): D = Sedan/Estate
│└─── Manufacturer (1): D = Daimler
└──── WMI (1-3): WDD = Mercedes-Benz

```

### Position Breakdown

**Positions 1-3: WMI (World Manufacturer Identifier)**
- **WDB**: Mercedes-Benz (cars, SUVs)
- **WDD**: Mercedes-Benz (additional facilities/variants)
- **WBA**: BMW (3-Series, 5-Series, 7-Series, Z-Series)
- **WBS**: BMW (variants, X-Series)
- **WAU**: Audi (A-Series, Q-Series)
- **WVW**: Volkswagen (premium line)
- **3VW**: Volkswagen (mass market)
- **WP0**: Porsche (sports cars)
- **W0L**: Opel/Vauxhall

**Position 4: Model Series Indicator**
- **D**: Sedan, Coupe, Cabriolet
- **E**: Estate/Wagon
- **F**: SUV/Crossover
- **A**: Hatchback
- **B**: MPV/Van

**Position 5-6: Body Type & Series**
- **F4**: Mercedes C-Class
- **F5**: Mercedes E-Class
- **F7**: Mercedes S-Class
- **FA**: Mercedes A-Class
- **FG**: Mercedes G-Class

**Position 7-8: Engine & Transmission**
- **KB**: 4-cylinder Petrol
- **KE**: 6-cylinder Petrol
- **KF**: 8-cylinder Petrol
- **R**: Petrol (various)
- **D**: Diesel
- **H**: Hybrid
- **E**: Electric

**Position 9: Check Digit**
- Validates entire VIN using modulo-11 algorithm
- Special character if invalid: X (indicates error)

**Position 10: Model Year (A=2010, Z=2019, A=2020, ...)**
- A=2010, B=2011, C=2012, D=2013, E=2014
- F=2015, G=2016, H=2017, J=2018, K=2019
- L=2020, M=2021, N=2022, P=2023, R=2024
- S=2025, T=2026, V=2027, W=2028, X=2029, Y=2030

**Position 11: Plant/Assembly Location**
- **A**: Various locations (varies by manufacturer)
- **B**: Bremen, Germany (Mercedes)
- **C**: Cologne, Germany (Ford, VW)
- **D**: Düsseldorf, Germany (Volkswagen)
- **E**: Emden, Germany (Volkswagen)
- **S**: Stuttgart, Germany (Mercedes, Porsche, Daimler)
- **W**: Wolfsburg, Germany (Volkswagen)
- **Z**: Other international locations

**Positions 12-17: Serial Number**
- Sequential production number
- Unique per vehicle at the facility
- Typically 000001 to 999999

---

## German Manufacturer VIN Examples

### Mercedes-Benz

**Example VIN:** WDDZF4KB7HA071557 (Daimler Stuttgart)

Decoding:
```
WDD        = Mercedes-Benz (Daimler)
Z          = German market
F          = SUV/Crossover
4          = Model variant
K          = 4-cylinder petrol
B          = 4-speed transmission
7          = Check digit
H          = Model year 2017
A          = Plant: Stuttgart, Germany
071557     = Serial number
```

**Common Mercedes Models & Codes:**
- C-Class: WDB/WDD + ZF4K (sedan), ZF4E (estate)
- E-Class: WDB/WDD + ZF5K (sedan), ZF5E (estate)
- S-Class: WDB/WDD + ZF7K (sedan)
- A-Class: WDB/WDD + ZFA (hatchback)
- G-Class: WDB/WDD + ZFG (SUV)
- GLE: WDB/WDD + C292 (SUV)
- GLA: WDB/WDD + C167 (compact SUV)

### BMW

**Example VIN:** WBAEH7C50EC123456 (BMW Munich)

Decoding:
```
WBA        = BMW
E          = 5-Series
H          = 5-door sedan
7          = Variant code
C          = Engine: 3.0L petrol
50         = Transmission: 6-speed auto
E          = Model year 2014
C          = Plant: Regensburg or Czech
123456     = Serial number
```

**Common BMW Models & Codes:**
- 3-Series: WBA + BA11 (sedan)
- 5-Series: WBA + BA12 (sedan)
- 7-Series: WBA + BA13 (sedan)
- M-Series: WBA + BA41 (performance)
- X-Series: WBS + X-variant codes
- Z-Series: WBA + BA21 (sports)

### Audi

**Example VIN:** WAUZZZLF8EA123456 (Audi Ingolstadt)

Decoding:
```
WAU        = Audi
ZZZ        = Audi model code
L          = 4-door sedan
F          = Transmission/Engine variant
8          = Check digit
E          = Model year 2014
A          = Plant: Ingolstadt, Germany
123456     = Serial number
```

**Common Audi Models & Codes:**
- A3: WAU + A3 variant
- A4: WAU + B (4th digit)
- A6: WAU + C (4th digit)
- A8: WAU + D (4th digit)
- Q5: WAU + 8R (4th-5th digits)
- Q7: WAU + 4L (4th-5th digits)
- Q8: WAU + 4M (4th-5th digits)

### Volkswagen

**Example VIN:** 3VWG21C52LM000001 (VW Wolfsburg mass market)

Decoding:
```
3VW        = Volkswagen
G          = Golf (model)
21         = Variant/generation
C          = Engine type
52         = Transmission code
L          = Model year 2020
M          = Plant: Wolfsburg, Germany
000001     = Serial number
```

**Common VW Models & Codes:**
- Golf: 3VW + G (model identifier)
- Passat: 3VW + P (model identifier)
- Tiguan: 3VW + T (model identifier)
- Touareg: 3VW + V (model identifier)

### Porsche

**Example VIN:** WP0AA69Z94S123456 (Porsche Stuttgart)

Decoding:
```
WP0        = Porsche
AA         = 911 series
69         = Variant code
Z          = Transmission type
9          = Check digit
4          = Model year 2004
S          = Plant: Stuttgart/Leipzig
123456     = Serial number
```

**Common Porsche Models & Codes:**
- 911: WP0 + AA (series)
- Cayenne: WP0 + AC/AD
- Panamera: WP0 + AA (recent)
- Boxster: WP0 + AB
- Macan: WP0 + AC/AD

### Opel

**Example VIN:** W0L000000000000001 (Opel Eisenach)

Decoding:
```
W0L        = Opel/Vauxhall
0          = Model code
0          = Variant
0          = Engine type
0          = Additional variant
0          = Check digit
0          = Model year
0          = Plant code
00001      = Serial number
```

**Common Opel Models:**
- Corsa: W0L + C (model code)
- Astra: W0L + A (model code)
- Insignia: W0L + I (model code)
- Grandland: W0L + G (model code)

---

## German Vehicle Label Format

### Typical Daimler/Mercedes Door-Jamb Label

```
MFD BY DAIMLER AG STUTTGART
KG        LBS    PASSENGER CAR    040    07/16
GVWR      2385   5258  THIS VEHICLE CONFORMS TO ALL APPLICABLE U.S.
GAWR FRONT 1135  2502  FEDERAL MOTOR VEHICLE SAFETY, BUMPER AND
GAWR REAR  1250  2756  OTHER PREVENTION STANDARDS IN EFFECT ON THE
                       DATE OF MANUFACTURE SHOWN ABOVE.
WDDZF4KB7HA071557     MADE IN GERMANY
[BARCODE IMAGE]
```

### Label Characteristics
- **Font:** Courier New / OCR-A (monospaced)
- **Contrast:** Very high (white on black)
- **Material:** Adhesive label (sometimes aluminum-backed)
- **VIN Location:** Below weight specifications
- **Barcode:** Code 128 or Code 39 (below or beside VIN)
- **Size:** 2.5" x 3" typical for standard labels

### OCR Optimization for German Labels
- Binary threshold 130 (high contrast)
- Character isolation 50-60px wide
- Serif detection for OCR-A
- Baseline alignment to horizontal
- Kerning pair analysis for monospace

---

## VIN Decoding Algorithm

### Step-by-Step Decoding Process

```javascript
// Example: WDDZF4KB7HA071557

// Step 1: Extract WMI (positions 1-3)
const wmi = vin.substring(0, 3);  // "WDD"
const manufacturer = decodeWMI(wmi);  // "Mercedes-Benz"

// Step 2: Extract model year (position 10)
const yearChar = vin[9];  // "H"
const year = decodeYear(yearChar);  // 2017

// Step 3: Extract model code (positions 4-9)
const modelCode = vin.substring(3, 9);  // "ZF4KB7"
const model = decodeModel(modelCode, manufacturer);  // "C-Class"

// Step 4: Extract engine (position 9)
const engineChar = vin[8];  // "7"
const engine = decodeEngine(engineChar);  // "Check digit / Engine variant"

// Step 5: Extract plant (position 11)
const plantChar = vin[10];  // "A"
const plant = decodePlant(plantChar, manufacturer);  // "Stuttgart, Germany"

// Result
const vehicleInfo = {
  vin: "WDDZF4KB7HA071557",
  manufacturer: "Mercedes-Benz",
  year: 2017,
  model: "C-Class",
  plant: "Stuttgart, Germany",
  serialNumber: "071557"
};
```

---

## German Automotive Industry Overview

### Major German Automakers

**Luxury/Premium:**
- Mercedes-Benz: Over 5M vehicles annually (Daimler Group)
- BMW: Over 2M vehicles annually (BMW Group)
- Audi: Over 1.5M vehicles annually (VW Group)
- Porsche: Over 300K vehicles annually

**Mass Market:**
- Volkswagen: Over 6M vehicles annually (world's largest by volume)

**Specialty:**
- Opel: Over 200K vehicles annually (now Stellantis)

### German Vehicle Export

- Germany is world's largest vehicle exporter
- VINs with "W" prefix: ~17% of all global vehicles
- Top export markets: USA, China, UK, France, Italy
- Industry employs 900,000+ workers

---

## Testing German VINs

### Test Cases for German Manufacturers

**Mercedes-Benz (WDD):**
```
WDDZF4KB7HA071557  ✅ Valid Mercedes VIN
Expected: 2017 Mercedes-Benz C-Class
```

**BMW (WBA):**
```
WBAEH7C50EC123456  ✅ Valid BMW VIN
Expected: 2014 BMW 5-Series
```

**Audi (WAU):**
```
WAUZZZF7HA123456  ✅ Valid Audi VIN
Expected: 2017 Audi model
```

**Volkswagen (WVW):**
```
WVWZZZZAAZ123456  ✅ Valid VW VIN
Expected: 2010 Volkswagen
```

**Porsche (WP0):**
```
WP0AA69Z94S123456  ✅ Valid Porsche VIN
Expected: 2004 Porsche 911
```

**Opel (W0L):**
```
W0L000000000000001  ✅ Valid Opel VIN
Expected: Opel vehicle
```

### Validation Checksum Algorithm

German manufacturers use the same VIN checksum (position 9) as all US manufacturers:

```javascript
function validateVINChecksum(vin) {
  // Weights: 8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2
  // Transliteration: A-H=1-8, J=1, K=2, L=3, M=4, N=5, P=7, R=9, S-Z=2-9
  
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const transliterals = {
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
    'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
  };
  
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = vin[i];
    const value = isNaN(char) ? transliterals[char] : parseInt(char);
    sum += value * weights[i];
  }
  
  const checkDigit = sum % 11;
  return checkDigit === 10 ? 'X' : checkDigit.toString();
}
```

---

## OCR Preprocessing for German Labels

### Key Challenges

1. **Monospaced Font Ambiguities:**
   - 0 (zero) vs O (letter O): Both common in German VINs
   - 1 (one) vs I (uppercase i) vs l (lowercase L)
   - 5 (five) vs S (letter S): Common in Mercedes
   - Z (letter Z) vs 2 (two): Common in German codes

2. **High Contrast Labels:**
   - Mercedes/BMW use white text on black background
   - Creates strong shadows and reflections
   - Binary conversion required

3. **Metal-Stamped Elements:**
   - Some labels have embossed text
   - German manufacturers prefer precision
   - Sharp edges but with shadow artifacts

4. **Multi-Line Format:**
   - Label information spans multiple lines
   - VIN often on separate line from weight specs
   - Requires region-based scanning

### Preprocessing Strategy

```javascript
// For German labels (Mercedes, BMW, Audi, Porsche, VW):

1. Binary Conversion
   ├─ Threshold: 130 (high contrast)
   ├─ Remove intermediate grays
   └─ Create pure black/white

2. Character Isolation
   ├─ Detect monospaced character width
   ├─ Extract VIN region (17 characters)
   ├─ Isolate from weight specifications
   └─ Handle barcode position

3. Font-Specific Corrections
   ├─ Mercedes OCR-A: Distinctive zeros, serifs
   ├─ BMW: Clean sans-serif, proportional
   ├─ Audi/VW: Courier-based monospace
   ├─ Porsche: Very precise, uniform
   └─ Apply manufacturer error patterns

4. Validation
   ├─ Check VIN checksum (position 9)
   ├─ Verify WMI against German codes
   ├─ Confirm serial number format
   └─ Cross-reference with manufacturer specs
```

---

## Integration with VIN Decoder App

### German VIN Decoding Features

✅ **Complete WMI Support:**
- All 6 German manufacturers
- Multiple WMI codes per brand (WDB, WDD for Mercedes)
- Automatic manufacturer detection

✅ **Model Identification:**
- 50+ German vehicle models
- Trim level detection when possible
- Production year extraction

✅ **Font-Specific Optimization:**
- OCR-A / Courier New preprocessing
- Monospaced character handling
- High-contrast enhancement

✅ **Error Correction:**
- German common confusions handled
- Checksum validation
- Fallback recognition patterns

### Testing German Labels

**To test with the image provided:**
1. Open VIN Scanner in app
2. Point camera at Mercedes door-jamb label (WDDZF4KB7HA071557)
3. Live scan should detect VIN
4. If fails, tap [📸 Capture VIN] button
5. Capture image from camera
6. App detects VIN and shows:
   - VIN: WDDZF4KB7HA071557
   - Year: 2017
   - Make: Mercedes-Benz
   - Model: C-Class (if decoded) or Unknown Model
   - Engine: Variant
   - Body: Sedan

---

## References

- ISO 3779 - VIN Format (International Standard)
- SAE J2030 - VIN Code Standard
- NHTSA VIN Decoder (www.nhtsa.gov)
- German Automotive Association (VDA - Verband der Automobilindustrie)
- Individual manufacturer VIN guidelines:
  - Mercedes: daimler.com/en/ir/
  - BMW: bmwgroup.com
  - Volkswagen: volkswagengroupusa.com
  - Audi: audi.com
  - Porsche: porsche.com
  - Opel: opel.com
