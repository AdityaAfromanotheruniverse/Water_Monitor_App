"""
Single source of truth for limits + health guidance.
Limits: BIS IS 10500:2012 (verify against the latest BIS revision before real use).

IMPORTANT: the guidance text below is general public-health style advice written for a
demo. Have a doctor / public-health professional review it before sending to real people.
It deliberately does NOT name specific drugs or doses.
"""

# key, label, unit, category, acceptable, permissible, min, max, step, default, decimals
RAW_PARAMS = [
    ("ph",       "pH",                     "",          "Physical",  None,  None,   4.0, 11.0,   0.1,    7.2,    1),
    ("turb",     "Turbidity",              "NTU",       "Physical",  1.0,   5.0,    0.0, 10.0,   0.1,    0.3,    1),
    ("tds",      "Total Dissolved Solids", "mg/L",      "Physical",  500,   2000,   0,   3000,   10,     200,    0),
    ("pb",       "Lead (Pb)",              "mg/L",      "Metals",    0.01,  0.01,   0.0, 0.03,   0.001,  0.003,  3),
    ("as",       "Arsenic (As)",           "mg/L",      "Metals",    0.01,  0.05,   0.0, 0.15,   0.001,  0.003,  3),
    ("hg",       "Mercury (Hg)",           "mg/L",      "Metals",    0.001, 0.001,  0.0, 0.003,  0.0001, 0.0003, 4),
    ("cd",       "Cadmium (Cd)",           "mg/L",      "Metals",    0.003, 0.003,  0.0, 0.009,  0.0001, 0.001,  4),
    ("cr",       "Chromium (Cr)",          "mg/L",      "Metals",    0.05,  0.05,   0.0, 0.15,   0.001,  0.01,   3),
    ("ni",       "Nickel (Ni)",            "mg/L",      "Metals",    0.02,  0.02,   0.0, 0.06,   0.001,  0.005,  3),
    ("fe",       "Iron (Fe)",              "mg/L",      "Metals",    1.0,   1.0,    0.0, 3.0,    0.01,   0.2,    2),
    ("cu",       "Copper (Cu)",            "mg/L",      "Metals",    0.05,  1.5,    0.0, 2.5,    0.01,   0.01,   2),
    ("mn",       "Manganese (Mn)",         "mg/L",      "Metals",    0.1,   0.3,    0.0, 0.6,    0.01,   0.02,   2),
    ("zn",       "Zinc (Zn)",              "mg/L",      "Metals",    5.0,   15.0,   0.0, 20.0,   0.1,    1.0,    1),
    ("al",       "Aluminium (Al)",         "mg/L",      "Metals",    0.03,  0.2,    0.0, 0.4,    0.001,  0.01,   3),
    ("f",        "Fluoride (F)",           "mg/L",      "Chemicals", 1.0,   1.5,    0.0, 3.0,    0.01,   0.4,    2),
    ("no3",      "Nitrate (NO3)",          "mg/L",      "Chemicals", 45,    45,     0,   100,    1,      15,     0),
    ("cn",       "Cyanide (CN)",           "mg/L",      "Chemicals", 0.05,  0.05,   0.0, 0.15,   0.001,  0.01,   3),
    ("ecoli",    "E. coli",                "CFU/100mL", "Pathogens", 0,     0,      0,   20,     1,      0,      0),
    ("coliform", "Total Coliform",         "CFU/100mL", "Pathogens", 0,     0,      0,   20,     1,      0,      0),
]

PARAMS = [
    dict(key=k, label=l, unit=u, cat=c, acc=a, perm=p, vmin=lo, vmax=hi,
         step=s, default=d, dec=dec, is_range=(k == "ph"))
    for (k, l, u, c, a, p, lo, hi, s, d, dec) in RAW_PARAMS
]
PARAM_BY_KEY = {p["key"]: p for p in PARAMS}

# short  -> used in SMS (keep it brief)
# what   -> what to do (WhatsApp)
# watch  -> symptoms to watch for (WhatsApp)
# urgent -> when to get medical help right away (WhatsApp)
ADVICE = {
    "ph": dict(
        short="Water pH is outside the safe range. Use packaged water for drinking.",
        what="Use packaged/alternate water for drinking and cooking until cleared. Boiling does not fix pH.",
        watch="Stomach upset, skin or eye irritation, metallic or soapy taste.",
        urgent="Persistent vomiting or severe stomach pain."),
    "turb": dict(
        short="Water is too cloudy and may carry germs. Filter and boil before drinking.",
        what="Let the water settle, filter through clean cloth, then boil for 1 minute at a rolling boil and cool it. Or use packaged water.",
        watch="Diarrhoea, vomiting, stomach cramps, fever.",
        urgent="Blood in stool, high fever, or signs of dehydration (very dry mouth, little urine, dizziness)."),
    "tds": dict(
        short="Water is too salty/mineral-rich. Use packaged water, esp. if you have BP/kidney issues.",
        what="Prefer packaged or RO-treated water. People with high blood pressure, heart or kidney disease should avoid this water.",
        watch="Salty or bitter taste, bloating, stomach upset.",
        urgent="Swelling of feet/face or breathlessness in people with heart or kidney disease."),
    "pb": dict(
        short="LEAD above limit. Do NOT drink or cook with tap water. Children/pregnant women most at risk.",
        what="Stop drinking and cooking with this water. Use packaged/alternate water. Boiling does NOT remove lead. Ask a doctor about a blood lead test for children and pregnant women.",
        watch="Stomach pain, constipation, headache, tiredness, irritability. In children: poor concentration or learning/behaviour changes.",
        urgent="Severe stomach pain, seizures, or confusion."),
    "as": dict(
        short="ARSENIC above limit. Do NOT drink or cook with tap water. Use packaged water.",
        what="Stop drinking and cooking with this water. Use packaged/alternate water. Boiling does NOT remove arsenic.",
        watch="Stomach pain, vomiting, diarrhoea; with long exposure: dark or rough skin patches, numbness in hands/feet.",
        urgent="Severe vomiting/diarrhoea, or chest pain or irregular heartbeat."),
    "hg": dict(
        short="MERCURY above limit. Do NOT drink or cook with tap water.",
        what="Stop drinking and cooking with this water. Use packaged/alternate water. Boiling does NOT remove mercury.",
        watch="Tremor, mood changes, mouth sores, numbness or tingling, kidney problems.",
        urgent="Severe stomach pain, trouble breathing, or confusion."),
    "cd": dict(
        short="CADMIUM above limit. Do NOT drink or cook with tap water.",
        what="Stop drinking and cooking with this water. Use packaged/alternate water. Boiling does NOT remove cadmium.",
        watch="Vomiting, diarrhoea, stomach cramps; with long exposure: kidney problems and bone pain.",
        urgent="Persistent vomiting or severe abdominal pain."),
    "cr": dict(
        short="CHROMIUM above limit. Do NOT drink or cook with tap water.",
        what="Stop drinking and cooking with this water. Use packaged/alternate water. Boiling does NOT remove chromium.",
        watch="Stomach pain, nausea, skin irritation or rash.",
        urgent="Vomiting blood or severe abdominal pain."),
    "ni": dict(
        short="NICKEL above limit. Avoid drinking; people with nickel allergy take extra care.",
        what="Use packaged/alternate water for drinking and cooking. Boiling does NOT remove nickel.",
        watch="Skin rash or itching (especially if nickel-allergic), nausea, stomach upset.",
        urgent="Swelling of lips/face or difficulty breathing."),
    "fe": dict(
        short="Iron above limit. Water may taste metallic and stain. Use alternate water for drinking.",
        what="Use alternate water for drinking. Do not use for infant formula. People with iron-overload conditions should check with their doctor.",
        watch="Metallic taste, nausea, stomach upset, constipation.",
        urgent="Severe vomiting or abdominal pain, especially in a child."),
    "cu": dict(
        short="COPPER above limit. Avoid drinking; infants are most at risk.",
        what="Use packaged/alternate water, especially for infants and young children. Boiling does NOT remove copper.",
        watch="Nausea, vomiting, stomach pain, diarrhoea, blue-green tint in water.",
        urgent="Repeated vomiting, or yellowing of eyes/skin."),
    "mn": dict(
        short="Manganese above limit. Do not use for infant formula; use alternate water for drinking.",
        what="Use packaged/alternate water for drinking, and especially for babies. Boiling does NOT remove manganese.",
        watch="Bitter taste, dark staining; with long exposure: tremor, muscle stiffness, memory or mood changes.",
        urgent="Sudden weakness, severe tremors, or confusion."),
    "zn": dict(
        short="Zinc above limit. Water may taste metallic. Use alternate water for drinking.",
        what="Use packaged/alternate water for drinking and cooking until cleared.",
        watch="Metallic taste, nausea, vomiting, stomach cramps.",
        urgent="Repeated vomiting or severe abdominal pain."),
    "al": dict(
        short="Aluminium above limit. Dialysis/kidney patients should NOT use this water.",
        what="Use alternate water for drinking. Kidney patients and anyone on dialysis should avoid this water and inform their nephrologist.",
        watch="Usually few short-term symptoms; kidney patients may notice tiredness, confusion or bone pain over time.",
        urgent="Confusion or sudden weakness in a dialysis patient."),
    "f": dict(
        short="FLUORIDE above limit. Use alternate water, esp. for children. Watch for teeth spots/joint pain.",
        what="Use packaged/alternate (defluoridated) water for drinking and cooking, especially for children. Boiling does NOT remove fluoride (it concentrates it). A diet rich in calcium (milk, curd, leafy greens), vitamin C and vitamin D is commonly advised; ask a doctor before taking any supplements.",
        watch="White or brown spots on teeth, stiff or painful joints, bone pain; short-term: nausea, vomiting, stomach pain.",
        urgent="Severe vomiting, abdominal pain, muscle cramps or weakness after drinking the water."),
    "no3": dict(
        short="NITRATE above limit. Do NOT use for babies under 6 months. Use packaged water.",
        what="Do not use this water for infant formula or for babies/pregnant women. Use packaged water. Boiling INCREASES nitrate concentration; do not boil to fix this.",
        watch="In babies: bluish lips/skin, fast breathing, unusual sleepiness or irritability.",
        urgent="A baby with blue or grey skin/lips: go to the nearest hospital immediately (call 108/112)."),
    "cn": dict(
        short="CYANIDE above limit. Do NOT drink or cook. Seek help if anyone feels unwell.",
        what="Stop all drinking and cooking use immediately. Use packaged/alternate water. Boiling does NOT make it safe.",
        watch="Headache, dizziness, nausea, fast breathing, weakness.",
        urgent="Confusion, fainting, or trouble breathing: call 108/112 immediately."),
    "ecoli": dict(
        short="E. coli (faecal contamination) detected. Boil water 1 min before use. Use ORS for diarrhoea.",
        what="Boil water at a rolling boil for at least 1 minute and let it cool, or use packaged water/chlorine tablets. Wash hands with safe water. For diarrhoea, drink ORS (oral rehydration solution) and plenty of safe fluids.",
        watch="Loose stools, stomach cramps, vomiting, fever, weakness.",
        urgent="Blood in stool, high fever, signs of dehydration, or any symptoms in infants, elderly or pregnant women."),
    "coliform": dict(
        short="Coliform bacteria detected. Boil water 1 min before use. Use ORS for diarrhoea.",
        what="Boil water at a rolling boil for at least 1 minute and let it cool, or use packaged water/chlorine tablets. For diarrhoea, drink ORS (oral rehydration solution) and plenty of safe fluids.",
        watch="Loose stools, stomach cramps, vomiting, fever.",
        urgent="Blood in stool, high fever, dehydration, or symptoms in infants, elderly or pregnant women."),
}

FOOTER = "General guidance, not a diagnosis. If anyone feels unwell, see a doctor. Emergency: 112 / 108."
