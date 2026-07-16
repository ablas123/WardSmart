/**
 * CoreWard Pediatric Clinical Intelligence Module
 * Contains WHO/CDC growth score calculators, BNF drug dosing logic, 
 * and NICE Guidelines/Nelson's Pediatrics reference materials.
 */

// ---------------------------------------------------------------------------
// 1. GROWTH CALCULATORS (WHO & CDC)
// ---------------------------------------------------------------------------

export interface GrowthAssessment {
  waz: number; // Weight-for-Age Z-score
  haz: number; // Height-for-Age Z-score
  hcz: number; // Head-Circumference-for-Age Z-score
  weightPercentile: string;
  heightPercentile: string;
  weightStatus: string;
  heightStatus: string;
  headCircumStatus: string;
  malnutritionGrade: 'Normal' | 'Mild' | 'MAM' | 'SAM' | 'Stunted' | 'Wasted' | 'Overweight';
  malnutritionLabelAr: string;
  malnutritionLabelEn: string;
  nelsonCriteriaAr: string;
  nelsonCriteriaEn: string;
}

// Approximate Median Weight (kg) and SD (standard deviation) based on age in months and gender
// Based on WHO growth standards (0-60 months) and CDC growth charts (60+ months)
function getWHOWeightStats(ageMonths: number, gender: 'male' | 'female'): { median: number; sd: number } {
  const isMale = gender === 'male';
  let median = 3.3;
  let sd = 0.5;

  if (ageMonths <= 1) {
    median = isMale ? 4.3 : 4.0;
    sd = 0.6;
  } else if (ageMonths <= 3) {
    median = isMale ? 6.4 : 5.8;
    sd = 0.8;
  } else if (ageMonths <= 6) {
    median = isMale ? 7.9 : 7.3;
    sd = 0.9;
  } else if (ageMonths <= 12) {
    median = isMale ? 9.6 : 8.9;
    sd = 1.1;
  } else if (ageMonths <= 18) {
    median = isMale ? 10.9 : 10.2;
    sd = 1.2;
  } else if (ageMonths <= 24) {
    median = isMale ? 12.2 : 11.5;
    sd = 1.4;
  } else if (ageMonths <= 36) {
    median = isMale ? 14.3 : 13.9;
    sd = 1.7;
  } else if (ageMonths <= 48) {
    median = isMale ? 16.3 : 15.5;
    sd = 2.0;
  } else if (ageMonths <= 60) {
    median = isMale ? 18.3 : 18.0;
    sd = 2.4;
  } else {
    // Older kids (CDC aligned)
    const years = ageMonths / 12;
    median = 18.3 + (years - 5) * 2.8;
    sd = 2.4 + (years - 5) * 0.7;
  }

  return { median, sd };
}

function getWHOHeightStats(ageMonths: number, gender: 'male' | 'female'): { median: number; sd: number } {
  const isMale = gender === 'male';
  let median = 50.0;
  let sd = 2.0;

  if (ageMonths <= 1) {
    median = isMale ? 54.0 : 53.0;
    sd = 2.2;
  } else if (ageMonths <= 3) {
    median = isMale ? 61.4 : 59.8;
    sd = 2.4;
  } else if (ageMonths <= 6) {
    median = isMale ? 67.6 : 65.7;
    sd = 2.6;
  } else if (ageMonths <= 12) {
    median = isMale ? 75.7 : 74.0;
    sd = 3.0;
  } else if (ageMonths <= 18) {
    median = isMale ? 82.3 : 80.7;
    sd = 3.2;
  } else if (ageMonths <= 24) {
    median = isMale ? 87.8 : 86.4;
    sd = 3.5;
  } else if (ageMonths <= 36) {
    median = isMale ? 96.1 : 95.1;
    sd = 4.0;
  } else if (ageMonths <= 48) {
    median = isMale ? 103.3 : 102.7;
    sd = 4.5;
  } else if (ageMonths <= 60) {
    median = isMale ? 110.0 : 109.4;
    sd = 5.0;
  } else {
    // CDC
    const years = ageMonths / 12;
    median = 110.0 + (years - 5) * 6.0;
    sd = 5.0 + (years - 5) * 0.8;
  }

  return { median, sd };
}

function getWHOHeadCircStats(ageMonths: number, gender: 'male' | 'female'): { median: number; sd: number } {
  const isMale = gender === 'male';
  let median = 35.0;
  let sd = 1.1;

  if (ageMonths <= 1) {
    median = isMale ? 37.3 : 36.5;
    sd = 1.2;
  } else if (ageMonths <= 3) {
    median = isMale ? 40.5 : 39.5;
    sd = 1.3;
  } else if (ageMonths <= 6) {
    median = isMale ? 43.3 : 42.1;
    sd = 1.4;
  } else if (ageMonths <= 12) {
    median = isMale ? 46.1 : 44.9;
    sd = 1.5;
  } else if (ageMonths <= 18) {
    median = isMale ? 47.4 : 46.2;
    sd = 1.5;
  } else if (ageMonths <= 24) {
    median = isMale ? 48.3 : 47.2;
    sd = 1.6;
  } else if (ageMonths <= 36) {
    median = isMale ? 49.5 : 48.6;
    sd = 1.6;
  } else if (ageMonths <= 48) {
    median = isMale ? 50.3 : 49.5;
    sd = 1.7;
  } else if (ageMonths <= 60) {
    median = isMale ? 51.0 : 50.1;
    sd = 1.7;
  } else {
    // Over 5y, head circumference grows very slowly
    const years = ageMonths / 12;
    median = 51.0 + (years - 5) * 0.2;
    sd = 1.8;
  }

  return { median, sd };
}

// Convert Z-score to approximate percentile string
export function zScoreToPercentile(z: number): string {
  if (z <= -2.33) return "< 1st";
  if (z <= -1.88) return "3rd";
  if (z <= -1.64) return "5th";
  if (z <= -1.04) return "15th";
  if (z <= -0.67) return "25th";
  if (z <= 0) return "50th";
  if (z <= 0.67) return "75th";
  if (z <= 1.04) return "85th";
  if (z <= 1.64) return "95th";
  if (z <= 1.88) return "97th";
  return "> 99th";
}

export function assessChildGrowth(
  ageMonths: number,
  gender: 'male' | 'female',
  weightKg: number,
  heightCm?: number,
  headCircumCm?: number,
  standard: 'WHO' | 'CDC' = 'WHO'
): GrowthAssessment {
  // Compute Stats (WHO weight, height, HC stats)
  const wStats = getWHOWeightStats(ageMonths, gender);
  const hStats = getWHOHeightStats(ageMonths, gender);
  const hcStats = getWHOHeadCircStats(ageMonths, gender);

  // Apply minor adjustment factor for CDC (slightly higher medians in older children)
  const cdcFactorWeight = standard === 'CDC' ? 1.05 : 1.0;
  const cdcFactorHeight = standard === 'CDC' ? 1.02 : 1.0;

  const adjWeightMedian = wStats.median * cdcFactorWeight;
  const adjHeightMedian = hStats.median * cdcFactorHeight;

  // Z-Score = (Observed - Median) / SD
  const waz = (weightKg - adjWeightMedian) / wStats.sd;
  const haz = heightCm ? (heightCm - adjHeightMedian) / hStats.sd : 0;
  const hcz = headCircumCm ? (headCircumCm - hcStats.median) / hcStats.sd : 0;

  const weightPercentile = zScoreToPercentile(waz);
  const heightPercentile = heightCm ? zScoreToPercentile(haz) : "N/A";

  // Classify Weight Status
  let weightStatus = "Normal growth";
  if (waz < -3) weightStatus = "Severe Underweight / SAM";
  else if (waz < -2) weightStatus = "Moderate Underweight / MAM";
  else if (waz < -1) weightStatus = "Mild Underweight";
  else if (waz > 2) weightStatus = "Overweight";

  // Classify Height Status
  let heightStatus = "Normal stature";
  if (heightCm) {
    if (haz < -3) heightStatus = "Severe Stunting / Chronic Malnutrition";
    else if (haz < -2) heightStatus = "Moderate Stunting";
    else if (haz > 2) heightStatus = "Tall stature";
  }

  // Classify Head Circumference Status
  let headCircumStatus = "Normal Head Circumference";
  if (headCircumCm) {
    if (hcz < -2) headCircumStatus = "Microcephaly (صغر الرأس)";
    else if (hcz > 2) headCircumStatus = "Macrocephaly / Hydrocephalus (كبر الرأس)";
  }

  // Malnutrition Grade & Label (Nelson's Pediatrics criteria)
  let malnutritionGrade: GrowthAssessment['malnutritionGrade'] = 'Normal';
  let malnutritionLabelAr = "نمو سليم وطبيعي";
  let malnutritionLabelEn = "Normal harmonious growth";
  let nelsonCriteriaAr = "الوزن والطول يقعان ضمن المعدلات الطبيعية (بين -2 و +2 انحراف معياري).";
  let nelsonCriteriaEn = "Weight and height are within normal ranges (between -2 and +2 standard deviations).";

  if (waz < -3) {
    malnutritionGrade = 'SAM';
    malnutritionLabelAr = "سوء تغذية حاد شديد (SAM)";
    malnutritionLabelEn = "Severe Acute Malnutrition (SAM)";
    nelsonCriteriaAr = "المعايير المعتمدة (Nelson's Ch 63): انخفاض الوزن بالنسبة للعمر بمقدار < -3 انحراف معياري، أو وجود هزال سريري شديد، أو وذمات انتفاخية متناظرة. يستدعي علاج فوري ببروتوكول حليب F-75 ثم F-100 لتجنب متلازمة إعادة التغذية (Refeeding Syndrome).";
    nelsonCriteriaEn = "Nelson's Criteria (Ch 63): Weight-for-Age < -3 SD, or severe muscle wasting, or bilateral pitting edema. Requires immediate resuscitation using F-75 milk formulas and close monitoring to avoid Refeeding Syndrome.";
  } else if (waz < -2) {
    malnutritionGrade = 'MAM';
    malnutritionLabelAr = "سوء تغذية حاد متوسط (MAM)";
    malnutritionLabelEn = "Moderate Acute Malnutrition (MAM)";
    nelsonCriteriaAr = "المعايير المعتمدة: الوزن مقابل العمر بين -2 و -3 انحراف معياري. يحتاج مكملات غذائية مكثفة (RUTF) ومتابعة أسبوعية لمنع التدهور إلى سوء تغذية شديد.";
    nelsonCriteriaEn = "Standard Criteria: Weight-for-Age between -2 and -3 SD. Requires Ready-to-Use Therapeutic Foods (RUTF) and weekly monitoring to prevent degradation into SAM.";
  } else if (waz < -1) {
    malnutritionGrade = 'Mild';
    malnutritionLabelAr = "نقص وزن خفيف (At Risk)";
    malnutritionLabelEn = "Mild Underweight (At Risk)";
    nelsonCriteriaAr = "الوزن مقابل العمر يقع بين -1 و -2 انحراف معياري. يوصى بمراجعة الحمية وتدبير الإسهامات أو مشاكل الامتصاص مبكراً.";
    nelsonCriteriaEn = "Weight-for-Age between -1 and -2 SD. Indicates a warning zone. Early nutritional review and counseling are recommended.";
  } else if (haz < -2 && heightCm) {
    malnutritionGrade = 'Stunted';
    malnutritionLabelAr = "تقزم سري لقصور النمو (Stunting)";
    malnutritionLabelEn = "Nutritional Stunting";
    nelsonCriteriaAr = "الطول مقابل العمر يقل عن -2 انحراف معياري. يشير إلى سوء تغذية مزمن طويل الأمد أثر على الطول النموي للهيكل العظمي.";
    nelsonCriteriaEn = "Height-for-Age < -2 SD. Indicates chronic, long-term malnutrition leading to skeletal growth retardation.";
  } else if (waz > 2) {
    malnutritionGrade = 'Overweight';
    malnutritionLabelAr = "زيادة في الوزن / سمنة أطفال";
    malnutritionLabelEn = "Overweight / Pediatric Obesity";
    nelsonCriteriaAr = "الوزن مقابل العمر يتجاوز +2 انحراف معياري. يستوجب التدقيق في النظام الغذائي ومستويات نشاط الطفل.";
    nelsonCriteriaEn = "Weight-for-Age > +2 SD. Suggests pediatric overweight. Lifestyle, diet, and metabolic issues should be clinically screened.";
  }

  return {
    waz: parseFloat(waz.toFixed(2)),
    haz: parseFloat(haz.toFixed(2)),
    hcz: parseFloat(hcz.toFixed(2)),
    weightPercentile,
    heightPercentile,
    weightStatus,
    heightStatus,
    headCircumStatus,
    malnutritionGrade,
    malnutritionLabelAr,
    malnutritionLabelEn,
    nelsonCriteriaAr,
    nelsonCriteriaEn
  };
}


// ---------------------------------------------------------------------------
// 2. BNF FOR CHILDREN PEDIATRIC DRUG FORMULARY & CALCULATOR
// ---------------------------------------------------------------------------

export interface BnfDrug {
  id: string;
  nameAr: string;
  nameEn: string;
  standardPedDose: string; // Plain english description
  standardPedDoseAr: string; // Plain arabic description
  dosePerKgPerDose: number; // mg per kg for single dose (e.g. 15mg/kg)
  frequencyHours: number; // Dose interval (e.g. 6 hours)
  maxDailyDosePerKg: number; // Safety ceiling (e.g. 75mg/kg/day)
  availableSuspension?: {
    mg: number;
    ml: number;
  }[]; // Common pediatric suspension strengths (e.g. 120mg/5ml, 250mg/5ml)
  routesAr: string;
  routesEn: string;
  bnfWarningsAr: string;
  bnfWarningsEn: string;
}

export const bnfFormulary: BnfDrug[] = [
  {
    id: 'paracetamol',
    nameEn: 'Paracetamol (Acetaminophen)',
    nameAr: 'باراسيتامول (خافض حرارة)',
    standardPedDose: '15 mg/kg per dose every 4-6 hours (Max 75 mg/kg/day or 4 times daily)',
    standardPedDoseAr: '15 ملغ/كغ لكل جرعة كل 4 إلى 6 ساعات (الحد الأقصى 75 ملغ/كغ/يوم)',
    dosePerKgPerDose: 15,
    frequencyHours: 6,
    maxDailyDosePerKg: 75,
    availableSuspension: [
      { mg: 120, ml: 5 },
      { mg: 250, ml: 5 }
    ],
    routesAr: 'فموي (Oral)، تحاميل شرجية (Rectal)، أو وريدي (IV)',
    routesEn: 'Oral, Rectal, or Intravenous (IV)',
    bnfWarningsAr: 'يجب الحذر الشديد لمنع الجرعة الزائدة السامة للكبد. تأكد من فترات متباعدة لا تقل عن 4 ساعات. احذر عند دمجه مع أدوية برد أخرى.',
    bnfWarningsEn: 'Highly critical to prevent hepatotoxic overdose. Ensure minimum 4-hour intervals. Double check other paracetamol-containing products.'
  },
  {
    id: 'amoxicillin',
    nameEn: 'Amoxicillin (Broad-spectrum Penicillin)',
    nameAr: 'أموكسيسيلين (مضاد حيوي واسع المدى)',
    standardPedDose: '15 to 30 mg/kg per dose every 8 hours (or up to 90 mg/kg/day in severe otitis media)',
    standardPedDoseAr: '15 إلى 30 ملغ/كغ لكل جرعة كل 8 ساعات (أو جرعات عالية في التهاب الأذن الوسطى الحاد)',
    dosePerKgPerDose: 20,
    frequencyHours: 8,
    maxDailyDosePerKg: 90,
    availableSuspension: [
      { mg: 125, ml: 5 },
      { mg: 250, ml: 5 }
    ],
    routesAr: 'فموي (Oral)',
    routesEn: 'Oral suspension or capsules',
    bnfWarningsAr: 'ممنوع منعاً باتاً لمرضى حساسية البنسلين! راقب حدوث طفح جلدي أو إسهال شديد (التهاب القولون الغشائي الكاذب).',
    bnfWarningsEn: 'Strictly contraindicated in patients with known penicillin hypersensitivity! Monitor for rash or severe diarrhea (C. difficile risk).'
  },
  {
    id: 'ibuprofen',
    nameEn: 'Ibuprofen (NSAID)',
    nameAr: 'إيبوبروفين (مضاد التهاب ومسكن مائي)',
    standardPedDose: '10 mg/kg per dose every 6-8 hours (Max 30 mg/kg/day)',
    standardPedDoseAr: '10 ملغ/كغ لكل جرعة كل 6 إلى 8 ساعات (الحد الأقصى 30 ملغ/كغ/يوم)',
    dosePerKgPerDose: 10,
    frequencyHours: 6,
    maxDailyDosePerKg: 30,
    availableSuspension: [
      { mg: 100, ml: 5 }
    ],
    routesAr: 'فموي مع الطعام (Oral with food)',
    routesEn: 'Oral with or after food',
    bnfWarningsAr: 'يجب تجنبه في حالات الجفاف الشديد (خطر القصور الكلوي الحاد) وفي حالات الربو النشط (قد يسبب تشنج شعبي). يفضل إعطاؤه بعد الأكل لتجنب تهيج المعدة.',
    bnfWarningsEn: 'Avoid in severe dehydration (acute kidney injury risk) and active asthma (bronchospasm risk). Administer with or after food to prevent GI irritation.'
  },
  {
    id: 'ceftriaxone',
    nameEn: 'Ceftriaxone (3rd Gen Cephalosporin)',
    nameAr: 'سيف ترياكسون (مضاد حيوي جيل ثالث)',
    standardPedDose: '50 to 80 mg/kg once daily IV/IM (Up to 100 mg/kg/day for severe bacterial meningitis)',
    standardPedDoseAr: '50 إلى 80 ملغ/كغ حقنة وريدية أو عضلية مرة واحدة يومياً (تصل لـ 100 ملغ في التهاب السحايا)',
    dosePerKgPerDose: 75,
    frequencyHours: 24,
    maxDailyDosePerKg: 100,
    routesAr: 'حقن وريدي بطيء (IV infusion over 30 mins) أو عضلي (IM)',
    routesEn: 'Slow IV infusion over 30 minutes, or deep IM injection',
    bnfWarningsAr: 'تجنب خلطه أو إعطائه بالتزامن مع المحاليل المحتوية على الكالسيوم (مثل محلول رينجر لاكتات) في الأطفال حديثي الولادة لمنع ترسبات الكالسيوم القاتلة في الرئتين والكلى.',
    bnfWarningsEn: 'Do not co-administer or mix with calcium-containing solutions (e.g. Ringer\'s Lactate) in neonates to prevent fatal calcium-ceftriaxone precipitation.'
  },
  {
    id: 'gentamicin',
    nameEn: 'Gentamicin (Aminoglycoside)',
    nameAr: 'جنتاميسين (مضاد حيوي للانتانات الشديدة)',
    standardPedDose: '5 to 7.5 mg/kg IV once daily (Requires therapeutic drug monitoring)',
    standardPedDoseAr: '5 إلى 7.5 ملغ/كغ تسريب وريدي مرة واحدة يومياً (يستلزم قياس التركيز في الدم)',
    dosePerKgPerDose: 6,
    frequencyHours: 24,
    maxDailyDosePerKg: 7.5,
    routesAr: 'حقن وريدي بطيء (IV over 3-5 mins) أو تسريب وريدي',
    routesEn: 'Slow IV injection over 3-5 minutes, or IV infusion',
    bnfWarningsAr: 'سام للكلية وللعصب السمعي (Nephrotoxicity & Ototoxicity). تجنب استخدامه لأكثر من 5 أيام دون فحص مستويات الدواء في الدم وتصفية الكرياتينين.',
    bnfWarningsEn: 'Nephrotoxic and ototoxic risk. Strongly check pre/post levels if used beyond 3-5 days. Ensure adequate hydration and monitor renal function.'
  },
  {
    id: 'hydrocortisone',
    nameEn: 'Hydrocortisone (Solu-Cortef)',
    nameAr: 'هيدروكورتيزون (سوليو كورتيف)',
    standardPedDose: '2 to 4 mg/kg IV every 6 hours for acute asthma exacerbation or septic shock',
    standardPedDoseAr: '2 إلى 4 ملغ/كغ حقن وريدي كل 6 ساعات في نوبات الربو الحادة أو الصدمة الإنتانية',
    dosePerKgPerDose: 4,
    frequencyHours: 6,
    maxDailyDosePerKg: 16,
    routesAr: 'حقن وريدي مباشر (IV bolus) أو عضلي',
    routesEn: 'Direct slow IV bolus or IM injection',
    bnfWarningsAr: 'قد يسبب اضطراب في الكهارل (ارتفاع الصوديوم، هبوط البوتاسيوم) وارتفاع ضغط الدم وسكر الدم. راقب الاستجابة السريرية والضغط بدقة.',
    bnfWarningsEn: 'Can cause acute electrolyte shifts (sodium retention, hypokalemia) and glycemic spikes. Monitor blood pressure and capillary blood glucose.'
  }
];

export interface BnfCalculationResult {
  drugId: string;
  weightUsed: number;
  calculatedSingleDoseMg: number;
  calculatedDailyDoseMg: number;
  frequencyTextAr: string;
  frequencyTextEn: string;
  liquids?: {
    strengthText: string;
    doseMl: number;
  }[];
}

export function calculateBnfDose(drugId: string, weightKg: number): BnfCalculationResult | null {
  const drug = bnfFormulary.find(d => d.id === drugId);
  if (!drug) return null;

  const calculatedSingleDoseMg = parseFloat((drug.dosePerKgPerDose * weightKg).toFixed(1));
  const dosesPerDay = 24 / drug.frequencyHours;
  const calculatedDailyDoseMg = parseFloat((calculatedSingleDoseMg * dosesPerDay).toFixed(1));

  // Determine standard frequency wording
  let frequencyTextAr = `كل ${drug.frequencyHours} ساعات`;
  let frequencyTextEn = `Every ${drug.frequencyHours} hours`;
  if (drug.frequencyHours === 24) {
    frequencyTextAr = "مرة واحدة يومياً";
    frequencyTextEn = "Once daily";
  }

  // Calculate liquid volumes if suspensions are available
  const liquids = drug.availableSuspension?.map(susp => {
    // ml = (dose_mg / strength_mg) * strength_ml
    const doseMl = parseFloat(((calculatedSingleDoseMg / susp.mg) * susp.ml).toFixed(2));
    return {
      strengthText: `${susp.mg} mg / ${susp.ml} ml`,
      doseMl
    };
  });

  return {
    drugId,
    weightUsed: weightKg,
    calculatedSingleDoseMg,
    calculatedDailyDoseMg,
    frequencyTextAr,
    frequencyTextEn,
    liquids
  };
}


// ---------------------------------------------------------------------------
// 3. CLINICAL GUIDELINES REFERENCE LIBRARY (NICE & NELSON'S)
// ---------------------------------------------------------------------------

export interface ClinicalGuideline {
  id: string;
  titleAr: string;
  titleEn: string;
  source: string; // "NICE NG143" or "Nelson Pediatrics Ch 192" etc.
  synopsisAr: string;
  synopsisEn: string;
  stepsAr: string[];
  stepsEn: string[];
  warningAr: string;
  warningEn: string;
}

export const clinicalGuidelines: ClinicalGuideline[] = [
  {
    id: 'fever',
    titleEn: 'Pediatric Fever & Sepsis Assessment',
    titleAr: 'تقييم الحمى والإنتان لدى الأطفال',
    source: 'NICE Guideline NG143 & Nelson Ch 192',
    synopsisEn: 'A traffic-light risk-stratification system for children under 5 presenting with fever. Highly critical to detect early pediatric sepsis.',
    synopsisAr: 'نظام إشارة المرور السريري لتصنيف خطورة الأطفال تحت سن الـ 5 سنوات المصابين بالحمى لسرعة رصد الإنتان الدموي المبكر.',
    stepsEn: [
      'Green (Low Risk): Responsive, normal breathing, moist mucous membranes. Management: Home care, antipyretics, safety netting.',
      'Amber (Intermediate Risk): Pallor, not smiling, tachypnea (RR > 50 in 6-12m, > 40 in >12m), tachycardia, capillary refill time >= 3 seconds. Management: Active clinical review, monitor vitals closely.',
      'Red (High Risk): Grunting, chest indrawing, pale/mottled/blue skin, non-blanching rash (purpura), floppy, temperature >= 38C in babies < 3 months. Management: Urgent pediatric registrar alert, IV antibiotics within 1 hour for suspected sepsis.'
    ],
    stepsAr: [
      'الأخضر (خطورة منخفضة): الطفل متفاعل، تنفس طبيعي، الأغشية المخاطية رطبة. التدبير: علاج منزلي خافض حرارة وتثقيف الأهل.',
      'الأصفر (خطورة متوسطة): شحوب، عدم الابتسام، تسرع التنفس (معدل التنفس > 50 في الرضع 6-12 شهراً، > 40 للأكبر من سنة)، نبض متسرع، زمن عودة الامتلاء الشعري >= 3 ثوانٍ. التدبير: مراجعة سريرية نشطة مستمرة.',
      'الأحمر (خطورة عالية جداً): أنين صدري، سحب صدري غائر، جلد مبقع أو مزرق، طفح جلدي لا يزول بالضغط، خمول تام، حرارة >= 38 في الرضع أقل من 3 أشهر. التدبير: استدعاء فوري للأخصائي الاستشاري، محاليل وريدية ومضادات حيوية واسعة الطيف خلال ساعة واحدة.'
    ],
    warningEn: 'Do not use aspirin in children under 16 due to Reye Syndrome risk. Always check for non-blanching purpuric rashes.',
    warningAr: 'يمنع منعاً باتاً استخدام الأسبرين للأطفال تحت 16 عاماً خوفاً من متلازمة راي (Reye Syndrome) القاتلة. افحص الجلد دائماً لكشف الطفح النزفي.'
  },
  {
    id: 'asthma',
    titleEn: 'Acute Asthma & Bronchiolitis Management',
    titleAr: 'تدبير الربو الحاد والتهاب القشيبات',
    source: 'NICE NG166 & Nelson Pediatrics Ch 417',
    synopsisEn: 'Graded management of pediatric acute wheeze and airway obstruction according to severity and oxygenation needs.',
    synopsisAr: 'التدبير المتدرج لتضيق المسالك الهوائية والتصفير الصدري الحاد لدى الأطفال حسب الشدة ومستوى الأكسجين.',
    stepsEn: [
      'Mild-Moderate Exacerbation: SpO2 >= 92% in air, talking in sentences. Dose: Salbutamol inhaler via spacer 2-10 puffs, Oral Prednisolone (1-2 mg/kg).',
      'Severe Exacerbation: SpO2 < 92%, too breathless to talk/feed, accessory muscle use, RR > 40/min. Dose: Oxygen to keep SpO2 >= 94%, Nebulized Salbutamol (2.5-5mg) + Ipratropium Bromide, IV Hydrocortisone.',
      'Life-Threatening: Silent chest, cyanosis, exhaustion, poor respiratory effort. Dose: Emergency IV Magnesium Sulfate (40mg/kg), prepare for pediatric ICU admission.'
    ],
    stepsAr: [
      'نوبة خفيفة لمتوسطة: الأكسجين SpO2 >= 92%، الطفل يستطيع إكمال جمل. العلاج: بخاخ سالبوتمول عبر القمع الاستنشاقي (Spacer) 2-10 بخات، بريدنيزولون فموي (1-2 ملغ/كغ).',
      'نوبة شديدة: الأكسجين SpO2 < 92%، صعوبة شديدة في الكلام أو الرضاعة، سحب عضلي صدري واضح، معدل تنفس > 40. العلاج: أكسجين للحفاظ على SpO2 >= 94%، إرذاذ (Nebulizer) سالبوتمول + إبراتروبيوم بروميد، هيدروكورتيزون وريدي.',
      'نوبة مهددة للحياة: الصدر الصامت (Silent Chest) بدون تصفير مسموع لعدم كفاية دخول الهواء، زرقة، إرهاق تنفسي تام. العلاج: كبريتات المغنيسيوم وريدياً (Magnesium Sulfate 40mg/kg) بصفة عاجلة والتحضير للعناية المركزة.'
    ],
    warningEn: 'A silent chest is an ominous clinical sign indicating near-complete absence of airflow. Do not mistake silence for improvement!',
    warningAr: 'الصدر الصامت (Silent Chest) هو علامة خطر تسبق توقف التنفس وتدل على انعدام حركة الهواء تقريباً. لا تظن خطأً أن هدوء الصدر يعني التحسن!'
  },
  {
    id: 'gastroenteritis',
    titleEn: 'Acute Diarrhea & Dehydration Protocol',
    titleAr: 'بروتوكول النزلة المعوية الحادة والاجتفاف',
    source: 'NICE NG84 & Nelson Pediatrics Ch 362',
    synopsisEn: 'Fluid replacement strategies based on percentage body weight loss and clinical dehydration signs.',
    synopsisAr: 'استراتيجيات تعويض السوائل للنزلة المعوية بناءً على شدة الاجتفاف السريري وفقدان الوزن.',
    stepsEn: [
      'No Dehydration (< 3% loss): Normal behavior, immediate skin pinch return. Action: Continue regular feeds, give extra fluids (ORS 50ml/kg over 4 hours or after each watery stool).',
      'Clinical Dehydration (3-9% loss): Irritable, sunken eyes, dry tongue, skin pinch returns slowly (< 2s). Action: Active oral rehydration (ORS 50-100 ml/kg over 4 hours in small frequent sips).',
      'Shock/Severe Dehydration (> 9% loss): Lethargic, cold extremities, weak pulses, skin pinch returns very slowly (> 2s). Action: Emergency IV Fluid Bolus (0.9% Normal Saline 20 ml/kg over 10-20 minutes). Repeat if shock persists.'
    ],
    stepsAr: [
      'لا يوجد اجتفاف (أقل من 3%): الطفل متفاعل، ارتداد ثنية الجلد فوري. الإجراء: الاستمرار في الرضاعة الطبيعية، محلول الإرواء (ORS) 50 ملغ/كغ بعد كل إسهال مائي.',
      'اجتفاف سريري متوسط (3-9%): الطفل متهيج، غؤور العينين، اللسان جاف، ارتداد ثنية الجلد بطيء (أقل من ثانيتين). الإجراء: إرواء فموي نشط بمحلول الجفاف (ORS 50-100 مل/كغ على مدار 4 ساعات على رشفات صغيرة متكررة).',
      'اجتفاف شديد أو صدمة (> 9%): خمول تام وغيبوبة، برودة الأطراف، نبض خيطي ضعيف، ارتداد ثنية الجلد بطيء جداً (> ثانيتين). الإجراء: بولس إسعافي وريدي بمحلول سالين طبيعي 0.9% (Normal Saline 20 ml/kg خلال 10-20 دقيقة). أعد التقييم فوراً.'
    ],
    warningEn: 'Never use anti-diarrheal medications (e.g. Loperamide) in children; they trap toxins and can cause toxic megacolon.',
    warningAr: 'يُحظر تماماً استخدام مضادات الإسهال الشللية (مثل لوبيراميد) للأطفال لأنها تحبس السموم وتسبب توسع القولون السمي القاتل.'
  }
];

/**
 * Calculates Pediatric Early Warning Score (PEWS) dynamically.
 * Scores range from 0 (Normal) to 9 (Critical Danger).
 */
export function calculatePewsScore(temp: number, hr: number, rr: number, spo2: number, age: string): number {
  let score = 0;
  
  // 1. Temperature score
  if (temp >= 38.5 || temp <= 35.5) {
    score += 1;
  }
  
  // 2. Oxygen Saturation (SpO2)
  if (spo2 < 92) {
    score += 3;
  } else if (spo2 >= 92 && spo2 <= 94) {
    score += 1;
  }
  
  // 3. Heart Rate (bpm) - adjusted for age in months/years
  const isInfant = age.includes("شهر") || age.includes("أشهر") || age.includes("أسبوع") || age.includes("أسابيع") || age.toLowerCase().includes("month") || age.toLowerCase().includes("week");
  if (isInfant) {
    if (hr > 160 || hr < 80) {
      score += 2;
    } else if ((hr > 140 && hr <= 160) || (hr >= 80 && hr < 90)) {
      score += 1;
    }
  } else {
    if (hr > 140 || hr < 70) {
      score += 2;
    } else if ((hr > 120 && hr <= 140) || (hr >= 70 && hr < 80)) {
      score += 1;
    }
  }
  
  // 4. Respiratory Rate
  if (isInfant) {
    if (rr > 50 || rr < 20) {
      score += 2;
    } else if (rr > 40 && rr <= 50) {
      score += 1;
    }
  } else {
    if (rr > 40 || rr < 15) {
      score += 2;
    } else if (rr > 30 && rr <= 40) {
      score += 1;
    }
  }
  
  return score;
}

