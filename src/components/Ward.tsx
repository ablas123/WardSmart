/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Patient, User, VitalRecord, Medication, SoapEntry, GrowthRecord, hasPermission } from '../types';
import { 
  Users, UserPlus, Search, Bed, Activity, Thermometer, Heart, AlertCircle, 
  Baby, ClipboardCheck, Sparkles, Plus, Trash2, CheckCircle2, ChevronRight,
  ShieldAlert, BookOpen, Clock, FileText, ArrowLeftRight, Check, X, Pill, Edit,
  HelpCircle, RefreshCw, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language, translations } from '../utils/translations';
import { 
  assessChildGrowth, 
  calculateBnfDose, 
  bnfFormulary, 
  clinicalGuidelines, 
  GrowthAssessment, 
  BnfCalculationResult,
  zScoreToPercentile
} from '../utils/pediatricIntel';

interface WardProps {
  patients: Patient[];
  teamMembers: User[];
  currentUser: User;
  onAddPatient: (patient: Patient) => void;
  onUpdatePatient: (patientId: string, updates: Partial<Patient>) => void;
  onAddAuditLog: (action: string, details: string) => void;
  lang?: Language;
}

export default function Ward({ patients, teamMembers, currentUser, onAddPatient, onUpdatePatient, onAddAuditLog, lang = 'ar' }: WardProps) {
  const t = translations[lang];
  const isEn = lang === 'en';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'vitals' | 'growth' | 'meds' | 'soap' | 'discharge'>('overview');
  
  // Admission Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Form states - Step 1: Basic
  const [admName, setAdmName] = useState('');
  const [admAge, setAdmAge] = useState('');
  const [admGender, setAdmGender] = useState<'male' | 'female'>('male');
  const [admBed, setAdmBed] = useState('');
  const [admSymptoms, setAdmSymptoms] = useState('');
  const [admInternId, setAdmInternId] = useState('');
  
  // Form states - Step 2: Clinical
  const [admTemp, setAdmTemp] = useState('37.0');
  const [admHr, setAdmHr] = useState('110');
  const [admRr, setAdmRr] = useState('28');
  const [admSystolic, setAdmSystolic] = useState('95');
  const [admDiastolic, setAdmDiastolic] = useState('60');
  const [admSpo2, setAdmSpo2] = useState('98');
  const [admWeight, setAdmWeight] = useState('');
  const [admAllergies, setAdmAllergies] = useState('');

  // Form states - Step 3: History & Initial Meds
  const [admPastHistory, setAdmPastHistory] = useState('');
  const [medsList, setMedsList] = useState<{ name: string; dosage: string; frequency: string }[]>([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('');

  // Add Vital Entry state
  const [isAddingVitals, setIsAddingVitals] = useState(false);
  const [newTemp, setNewTemp] = useState('37.0');
  const [newHr, setNewHr] = useState('100');
  const [newRr, setNewRr] = useState('24');
  const [newSystolic, setNewSystolic] = useState('95');
  const [newDiastolic, setNewDiastolic] = useState('60');
  const [newSpo2, setNewSpo2] = useState('98');
  const [vitalsAnalysisResult, setVitalsAnalysisResult] = useState<any | null>(null);
  const [loadingVitalsAnalysis, setLoadingVitalsAnalysis] = useState(false);

  // Diagnosis Suggestions state
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<any | null>(null);
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);

  // SOAP State
  const [soapS, setSoapS] = useState('');
  const [soapO, setSoapO] = useState('');
  const [soapA, setSoapA] = useState('');
  const [soapP, setSoapP] = useState('');

  // Edit Patient form states
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female'>('male');
  const [editBed, setEditBed] = useState('');
  const [editSymptoms, setEditSymptoms] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editAllergies, setEditAllergies] = useState('');
  const [editPastHistory, setEditPastHistory] = useState('');
  const [editInternId, setEditInternId] = useState('');
  const [editStatus, setEditStatus] = useState<'stable' | 'followup' | 'critical' | 'discharged'>('stable');

  // Weight, Height and Head Circumference entry states
  const [newWeight, setNewWeight] = useState('');
  const [newHeight, setNewHeight] = useState('');
  const [newHeadCircum, setNewHeadCircum] = useState('');
  const [growthStandard, setGrowthStandard] = useState<'WHO' | 'CDC'>('WHO');

  // Med state
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [selectedBnfDrugId, setSelectedBnfDrugId] = useState('');
  const [calculatedBnf, setCalculatedBnf] = useState<BnfCalculationResult | null>(null);

  // Guidelines reference modal state
  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);

  // Discharge notes
  const [dischargeNotes, setDischargeNotes] = useState('');

  const interns = teamMembers.filter(u => u.role === 'Intern');

  // Keep selectedPatient state in sync with the updated patients prop (e.g. after background synchronization)
  React.useEffect(() => {
    if (selectedPatient) {
      const latestPatient = patients.find(p => p.id === selectedPatient.id);
      if (latestPatient) {
        setSelectedPatient(latestPatient);
      }
    }
  }, [patients, selectedPatient?.id]);

  // Smart BNF dosage auto-calculator side-effect
  React.useEffect(() => {
    if (!selectedPatient || !selectedBnfDrugId) {
      setCalculatedBnf(null);
      return;
    }

    // Get child's current weight (from growthHistory), or default to 10kg
    const currentWeight = selectedPatient.growthHistory && selectedPatient.growthHistory.length > 0
      ? selectedPatient.growthHistory[selectedPatient.growthHistory.length - 1].weightKg
      : 10;

    const bnfDoseRes = calculateBnfDose(selectedBnfDrugId, currentWeight);
    setCalculatedBnf(bnfDoseRes);

    if (bnfDoseRes) {
      const drug = bnfFormulary.find(d => d.id === selectedBnfDrugId);
      if (drug) {
        setMedName(drug.nameEn);
        setMedDosage(`${bnfDoseRes.calculatedSingleDoseMg} mg`);
        setMedFreq(isEn ? bnfDoseRes.frequencyTextEn : bnfDoseRes.frequencyTextAr);
      }
    }
  }, [selectedBnfDrugId, selectedPatient?.id, isEn]);

  // Filter patients
  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.bedNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' 
      ? p.status !== 'discharged' 
      : statusFilter === 'all_with_discharged' 
      ? true 
      : p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle Admission wizard submit
  const handleAdmitPatient = () => {
    if (!admName || !admAge || !admBed || !admSymptoms) {
      setWizardError('يرجى ملء جميع الحقول المطلوبة الأساسية');
      return;
    }

    const assignedIntern = teamMembers.find(u => u.id === admInternId);
    
    // Construct Vitals History
    const initialVitals: VitalRecord[] = [{
      timestamp: new Date().toISOString(),
      temp: parseFloat(admTemp) || 37.0,
      heartRate: parseInt(admHr) || 100,
      respRate: parseInt(admRr) || 24,
      systolicBp: parseInt(admSystolic) || 90,
      diastolicBp: parseInt(admDiastolic) || 60,
      spo2: parseInt(admSpo2) || 98,
      author: currentUser.name
    }];

    // Construct Growth History
    const initialGrowth: GrowthRecord[] = admWeight ? [{
      ageMonths: parseFloat(admAge) ? parseFloat(admAge) * 12 : 12, // simple conversion
      weightKg: parseFloat(admWeight)
    }] : [];

    // Construct medications
    const initialMedications: Medication[] = medsList.map((m, idx) => ({
      id: `med-init-${idx}-${Date.now()}`,
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      status: 'active'
    }));

    const newPatient: Patient = {
      id: `p-${Date.now()}`,
      name: admName,
      age: admAge,
      gender: admGender,
      bedNumber: admBed,
      status: 'stable',
      admissionDate: new Date().toISOString().split('T')[0],
      assignedInternId: admInternId || 'unassigned',
      assignedInternName: assignedIntern ? assignedIntern.name : 'غير معين',
      symptoms: admSymptoms,
      diagnosis: 'قيد التشخيص والمراقبة',
      vitalsHistory: initialVitals,
      growthHistory: initialGrowth,
      medications: initialMedications,
      soapHistory: [],
      allergies: admAllergies || 'لا يوجد حساسية معروفة',
      pastHistory: admPastHistory || 'لا يوجد سوابق مرضية هامة',
      dischargeChecklist: [
        { id: `dc-${Date.now()}-1`, item: "استقرار العلامات الحيوية وتشبع الأكسجين > ٩٤٪ على هواء الغرفة لمدة ٢٤ ساعة متواصلة", completed: false },
        { id: `dc-${Date.now()}-2`, item: "الرضاعة والتغذية الفموية كافية ولا تسبب إرهاق تنفسي", completed: false },
        { id: `dc-${Date.now()}-3`, item: "عدم وجود صعوبة أو سحب تنفسي وربي", completed: false },
        { id: `dc-${Date.now()}-4`, item: "تدريب الوالدين على استخدام البخاخ والمراقبة المنزلية ورصد علامات الخطر", completed: false },
        { id: `dc-${Date.now()}-5`, item: "تحديد موعد المتابعة في العيادة الخارجية وتوقيع ملخص الخروج", completed: false }
      ],
      updatedAt: Date.now()
    };

    onAddPatient(newPatient);
    onAddAuditLog('تسجيل دخول مريض (قبول)', `تم قبول وتنويم الطفل المريض ${newPatient.name} في السرير ${newPatient.bedNumber}.`);
    
    // Reset wizard
    setIsWizardOpen(false);
    setWizardStep(1);
    setMedsList([]);
    setAdmName('');
    setAdmAge('');
    setAdmBed('');
    setAdmSymptoms('');
    setAdmWeight('');
    setAdmAllergies('');
    setAdmPastHistory('');
  };

  // Open edit patient modal
  const handleOpenEditModal = () => {
    if (!selectedPatient) return;
    setEditName(selectedPatient.name);
    setEditAge(selectedPatient.age);
    setEditGender(selectedPatient.gender);
    setEditBed(selectedPatient.bedNumber);
    setEditSymptoms(selectedPatient.symptoms);
    setEditDiagnosis(selectedPatient.diagnosis || '');
    setEditAllergies(selectedPatient.allergies || '');
    setEditPastHistory(selectedPatient.pastHistory || '');
    setEditInternId(selectedPatient.assignedInternId || 'unassigned');
    setEditStatus(selectedPatient.status);
    setIsEditingPatient(true);
  };

  // Save patient edits
  const handleSavePatientEdit = () => {
    if (!selectedPatient) return;
    if (!editName || !editAge || !editBed || !editSymptoms) {
      alert('يرجى تعبئة الحقول الأساسية المطلوبة: الاسم، العمر، السرير، والشكوى السريرية.');
      return;
    }

    const assignedIntern = teamMembers.find(u => u.id === editInternId);

    const updates: Partial<Patient> = {
      name: editName,
      age: editAge,
      gender: editGender,
      bedNumber: editBed,
      symptoms: editSymptoms,
      diagnosis: editDiagnosis,
      allergies: editAllergies,
      pastHistory: editPastHistory,
      assignedInternId: editInternId || 'unassigned',
      assignedInternName: assignedIntern ? assignedIntern.name : 'غير معين',
      status: editStatus,
      updatedAt: Date.now()
    };

    onUpdatePatient(selectedPatient.id, updates);
    setSelectedPatient({ ...selectedPatient, ...updates } as Patient);
    onAddAuditLog('تعديل الملف الطبي للمريض', `تم تحديث الملف الطبي وتفاصيل الطفل المريض ${editName} (سرير ${editBed}) بواسطة ${currentUser.name}.`);
    setIsEditingPatient(false);
  };

  // Add custom initial medication row
  const handleAddMedRow = () => {
    if (!newMedName || !newMedDosage || !newMedFreq) return;
    setMedsList([...medsList, { name: newMedName, dosage: newMedDosage, frequency: newMedFreq }]);
    setNewMedName('');
    setNewMedDosage('');
    setNewMedFreq('');
  };

  // Add vitals entry to current patient
  const handleAddVitals = () => {
    if (!selectedPatient) return;
    const record: VitalRecord = {
      timestamp: new Date().toISOString(),
      temp: parseFloat(newTemp) || 37.0,
      heartRate: parseInt(newHr) || 100,
      respRate: parseInt(newRr) || 24,
      systolicBp: parseInt(newSystolic) || 95,
      diastolicBp: parseInt(newDiastolic) || 60,
      spo2: parseInt(newSpo2) || 98,
      author: currentUser.name
    };

    // Calculate critical level triggers based on new vitals with recovery path to stable
    let newStatus: Patient['status'] = selectedPatient.status;
    if (record.spo2 < 92 || record.temp >= 39.5) {
      newStatus = 'critical';
    } else if (record.temp >= 38.0 || record.spo2 < 95) {
      newStatus = 'followup';
    } else {
      newStatus = 'stable';
    }

    const updatedVitals = [record, ...selectedPatient.vitalsHistory];
    onUpdatePatient(selectedPatient.id, {
      vitalsHistory: updatedVitals,
      status: newStatus,
      updatedAt: Date.now()
    });

    onAddAuditLog('إضافة علامات حيوية', `تم رصد علامات حيوية جديدة للمريض ${selectedPatient.name}. (حرارة: ${record.temp}، أكسجين: ${record.spo2}٪).`);
    
    // Refresh selected patient reference
    setSelectedPatient({
      ...selectedPatient,
      vitalsHistory: updatedVitals,
      status: newStatus
    });

    setIsAddingVitals(false);
    setVitalsAnalysisResult(null); // Clear old analysis
  };

  // Trigger Gemini Vitals Analysis
  const handleVitalsAnalysis = async () => {
    if (!selectedPatient || selectedPatient.vitalsHistory.length === 0) return;
    setLoadingVitalsAnalysis(true);
    try {
      const latestVitals = selectedPatient.vitalsHistory[0];
      const response = await fetch('/api/gemini/vitals-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitals: latestVitals,
          age: selectedPatient.age,
          symptoms: selectedPatient.symptoms
        })
      });
      if (response.ok) {
        const data = await response.json();
        setVitalsAnalysisResult(data);
      }
    } catch (e) {
      console.error('Error analyzing vitals with AI', e);
    } finally {
      setLoadingVitalsAnalysis(false);
    }
  };

  // Trigger Gemini Diagnosis Suggestions
  const handleDiagnosisSuggestions = async () => {
    if (!selectedPatient) return;
    setLoadingDiagnosis(true);
    try {
      const response = await fetch('/api/gemini/diagnosis-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: selectedPatient.symptoms,
          age: selectedPatient.age,
          medicalHistory: selectedPatient.pastHistory + " / الحساسية: " + selectedPatient.allergies
        })
      });
      if (response.ok) {
        const data = await response.json();
        setDiagnosisSuggestions(data);
      }
    } catch (e) {
      console.error('Error suggesting diagnosis', e);
    } finally {
      setLoadingDiagnosis(false);
    }
  };

  // Update specific checklist item
  const toggleChecklistItem = (itemId: string, currentVal: boolean) => {
    if (!selectedPatient) return;
    const updatedChecklist = selectedPatient.dischargeChecklist.map(item => 
      item.id === itemId ? { ...item, completed: !currentVal } : item
    );
    onUpdatePatient(selectedPatient.id, {
      dischargeChecklist: updatedChecklist,
      updatedAt: Date.now()
    });
    setSelectedPatient({
      ...selectedPatient,
      dischargeChecklist: updatedChecklist
    });
  };

  // SOAP submit
  const handleAddSoap = () => {
    if (!selectedPatient || !soapS || !soapO || !soapA || !soapP) return;
    const newEntry: SoapEntry = {
      id: `s-${Date.now()}`,
      timestamp: new Date().toISOString(),
      author: currentUser.name,
      role: currentUser.role,
      s: soapS,
      o: soapO,
      a: soapA,
      p: soapP
    };
    const updatedSoap = [newEntry, ...(selectedPatient.soapHistory || [])];
    onUpdatePatient(selectedPatient.id, {
      soapHistory: updatedSoap,
      updatedAt: Date.now()
    });
    setSelectedPatient({
      ...selectedPatient,
      soapHistory: updatedSoap
    });

    onAddAuditLog('إضافة SOAP الملاحظات', `تمت إضافة ملخص ملاحظات SOAP طبي للمريض ${selectedPatient.name}.`);
    
    // Clear form
    setSoapS('');
    setSoapO('');
    setSoapA('');
    setSoapP('');
  };

  // Add growth measurements and calculate WHO / CDC pediatric scores
  const handleAddWeight = () => {
    if (!selectedPatient || !newWeight) return;

    // Smart detection of patient age in months
    let ageMonths = 12; // Fallback
    const ageStr = selectedPatient.age.toLowerCase();
    
    if (ageStr.includes('year') || ageStr.includes('سنة') || ageStr.includes('سنوات')) {
      const yrs = parseFloat(ageStr) || 1;
      ageMonths = Math.round(yrs * 12);
    } else if (ageStr.includes('month') || ageStr.includes('شهر') || ageStr.includes('أشهر') || ageStr.includes('شهرا')) {
      ageMonths = Math.round(parseFloat(ageStr) || 12);
    } else {
      const val = parseFloat(ageStr);
      if (!isNaN(val)) {
        // If age value is less than 18, assume it might be months, otherwise years
        ageMonths = val < 18 ? Math.round(val) : Math.round(val * 12);
      }
    }

    const weightVal = parseFloat(newWeight);
    const heightVal = newHeight ? parseFloat(newHeight) : undefined;
    const hcVal = newHeadCircum ? parseFloat(newHeadCircum) : undefined;

    // Call WHO/CDC growth assessor
    const assessment = assessChildGrowth(
      ageMonths,
      selectedPatient.gender,
      weightVal,
      heightVal,
      hcVal,
      growthStandard
    );

    const record: GrowthRecord = {
      ageMonths,
      weightKg: weightVal,
      heightCm: heightVal,
      headCircumferenceCm: hcVal,
      wazScore: assessment.waz,
      hazScore: heightVal ? assessment.haz : undefined,
      hczScore: hcVal ? assessment.hcz : undefined,
      malnutritionGrade: assessment.malnutritionGrade,
      standard: growthStandard
    };

    const updatedGrowth = [...(selectedPatient.growthHistory || []), record];
    onUpdatePatient(selectedPatient.id, {
      growthHistory: updatedGrowth,
      updatedAt: Date.now()
    });

    setSelectedPatient({
      ...selectedPatient,
      growthHistory: updatedGrowth
    });

    onAddAuditLog(
      'تسجيل قياسات النمو',
      `تم تسجيل قياس نمو جديد للمريض ${selectedPatient.name} (وزن: ${weightVal} كغ، طول: ${heightVal || 'غير مسجل'} سم، محيط رأس: ${hcVal || 'غير مسجل'} سم، معيار: ${growthStandard}) - تقييم سوء التغذية: ${assessment.malnutritionLabelEn}`
    );

    setNewWeight('');
    setNewHeight('');
    setNewHeadCircum('');
  };

  // Add medication
  const handleAddMedication = () => {
    if (!selectedPatient || !medName || !medDosage || !medFreq) return;
    const newMed: Medication = {
      id: `m-${Date.now()}`,
      name: medName,
      dosage: medDosage,
      frequency: medFreq,
      status: 'active'
    };
    const updatedMeds = [...(selectedPatient.medications || []), newMed];
    onUpdatePatient(selectedPatient.id, {
      medications: updatedMeds,
      updatedAt: Date.now()
    });
    setSelectedPatient({
      ...selectedPatient,
      medications: updatedMeds
    });

    onAddAuditLog('وصف دواء', `تم وصف دواء جديد (${medName}) للمريض ${selectedPatient.name}.`);
    
    setMedName('');
    setMedDosage('');
    setMedFreq('');
  };

  // Change med status
  const handleUpdateMedStatus = (medId: string, status: Medication['status']) => {
    if (!selectedPatient) return;
    const updatedMeds = selectedPatient.medications.map(m => 
      m.id === medId ? { ...m, status } : m
    );
    onUpdatePatient(selectedPatient.id, {
      medications: updatedMeds,
      updatedAt: Date.now()
    });
    setSelectedPatient({
      ...selectedPatient,
      medications: updatedMeds
    });
  };

  // Confirm Discharge
  const handleDischargePatient = () => {
    if (!selectedPatient) return;
    const allChecked = selectedPatient.dischargeChecklist.every(item => item.completed);
    if (!allChecked) {
      alert('يجب إنهاء جميع نقاط القائمة المرجعية الطبية الإلزامية الخمسة قبل التسريح!');
      return;
    }

    onUpdatePatient(selectedPatient.id, {
      status: 'discharged',
      dischargedAt: new Date().toISOString(),
      dischargeNotes: dischargeNotes || 'تم التسريح بعد اكتمال العلاج الطبي المقرّر بنجاح واستقرار العلامات الحيوية.',
      updatedAt: Date.now()
    });

    onAddAuditLog('إنهاء تنويم (تسريح مريض)', `تم إنهاء تنويم وتسريح الطفل المريض ${selectedPatient.name} بنجاح بعد استكمال المتطلبات الطبية.`);
    
    setSelectedPatient(null);
    setDischargeNotes('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Sidebar: Patient Directory (4 cols) */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col h-[750px]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            دليل أطفال الجناح
          </h2>
          {hasPermission(currentUser.role, 'admit_patients') && (
            <button 
              onClick={() => {
                setWizardStep(1);
                setIsWizardOpen(true);
              }} 
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              تنويم طفل
            </button>
          )}
        </div>

        {/* Global Search and Status Filter */}
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="البحث عن اسم الطفل، سرير، تشخيص..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'النشطين' },
              { id: 'critical', label: '⚠️ حرج' },
              { id: 'followup', label: '🕒 متابعة' },
              { id: 'stable', label: '✅ مستقر' },
              { id: 'all_with_discharged', label: 'الجميع' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                  statusFilter === tab.id 
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Patients List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredPatients.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              لا توجد حالات تنويم تطابق خيارات التصفية الحالية.
            </div>
          ) : (
            filteredPatients.map(patient => (
              <div 
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient);
                  setDetailTab('overview');
                  setDiagnosisSuggestions(null);
                  setVitalsAnalysisResult(null);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedPatient?.id === patient.id
                    ? 'bg-blue-50/50 border-blue-300 shadow-xs'
                    : 'bg-white border-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="font-bold text-slate-800 text-xs block">{patient.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold ${
                    patient.status === 'critical' ? 'bg-red-100 text-red-800' :
                    patient.status === 'followup' ? 'bg-amber-100 text-amber-800' :
                    patient.status === 'stable' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {patient.status === 'critical' ? 'حرج' :
                     patient.status === 'followup' ? 'متابعة' :
                     patient.status === 'stable' ? 'مستقر' : 'تم تسريحه'}
                  </span>
                </div>

                <div className="grid grid-cols-3 text-[10px] text-slate-500 gap-1 mb-1">
                  <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5 text-slate-400" /> سرير: {patient.bedNumber}</span>
                  <span>عمر: {patient.age}</span>
                  <span className="text-right">{patient.gender === 'male' ? 'ذكر 👦' : 'أنثى 👧'}</span>
                </div>
                
                <div className="text-[10px] text-slate-400 truncate">
                  الشكوى: {patient.symptoms}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Panel: Patient Snapshot (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col h-[750px]">
        {selectedPatient ? (
          <div className="flex flex-col h-full">
            
            {/* Header: Patient Bio */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-lg md:text-xl font-bold text-slate-800">{selectedPatient.name}</h1>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${
                    selectedPatient.status === 'critical' ? 'bg-red-100 text-red-800' :
                    selectedPatient.status === 'followup' ? 'bg-amber-100 text-amber-800' :
                    selectedPatient.status === 'stable' ? 'bg-green-100 text-green-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {selectedPatient.status === 'critical' ? 'حالة حرجة جداً' :
                     selectedPatient.status === 'followup' ? 'متابعة مستمرة' :
                     selectedPatient.status === 'stable' ? 'حالة مستقرة' : 'تسريح طبي مكتمل'}
                  </span>
                </div>
                <div className="flex flex-wrap text-xs text-slate-500 gap-3">
                  <span>السرير: <span className="font-bold text-slate-700">{selectedPatient.bedNumber}</span></span>
                  <span>العمر: <span className="font-bold text-slate-700">{selectedPatient.age}</span></span>
                  <span>تاريخ الدخول: <span className="font-bold text-slate-700">{selectedPatient.admissionDate}</span></span>
                  <span>طبيب الامتياز: <span className="font-bold text-slate-700">{selectedPatient.assignedInternName}</span></span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleOpenEditModal}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all border border-slate-200"
                >
                  <Edit className="w-3.5 h-3.5 text-indigo-600" />
                  تعديل الملف الطبي
                </button>

                <button 
                  onClick={() => setIsAddingVitals(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all"
                >
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  رصد علامات جديدة
                </button>
              </div>
            </div>

            {/* Sub-Tabs Selector */}
            <div className="flex border-b border-slate-100 overflow-x-auto gap-1 mt-4">
              {[
                { id: 'overview', label: t.tabOverview, icon: BookOpen },
                { id: 'vitals', label: t.tabVitals, icon: Activity },
                { id: 'growth', label: t.tabGrowth, icon: Baby },
                { id: 'meds', label: t.tabMeds, icon: Pill },
                { id: 'soap', label: t.tabSoap, icon: FileText },
                { id: 'discharge', label: t.tabDischarge, icon: ClipboardCheck }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id as any)}
                    className={`flex items-center gap-1 px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                      detailTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content Tab Window */}
            <div className="flex-1 overflow-y-auto pt-6 pr-1">
              
              {/* Tab 1: Overview */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="text-xs text-slate-400 font-bold block mb-1">الشكوى السريرية الأساسية (Symptoms)</span>
                      <p className="text-xs text-slate-700 leading-relaxed font-semibold">{selectedPatient.symptoms}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-400 font-bold block">التشخيص الحالي (Diagnosis)</span>
                        <button 
                          onClick={handleDiagnosisSuggestions} 
                          disabled={loadingDiagnosis}
                          className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:underline"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          {loadingDiagnosis ? 'جاري التحليل...' : 'اقتراح تشخيص ذكي'}
                        </button>
                      </div>
                      <p className="text-xs text-slate-700 font-bold">{selectedPatient.diagnosis}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                      <span className="text-xs text-rose-500 font-bold block mb-1">⚠️ الحساسية والتحذيرات (Allergies)</span>
                      <p className="text-xs text-rose-900 font-semibold">{selectedPatient.allergies}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="text-xs text-slate-400 font-bold block mb-1">السوابق المرضية والعمليات (Past History)</span>
                      <p className="text-xs text-slate-700 font-semibold">{selectedPatient.pastHistory}</p>
                    </div>
                  </div>

                  {/* AI Diagnosis Suggestions Box */}
                  {diagnosisSuggestions && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-4"
                    >
                      <h3 className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-500 fill-indigo-100" />
                        التشخيصات التفريقية المقترحة بالذكاء الاصطناعي
                      </h3>
                      <div className="space-y-3">
                        {diagnosisSuggestions.suggestions?.map((item: any, idx: number) => (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-800">{item.diagnosisName}</span>
                              <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">{item.probability}%</span>
                            </div>
                            <p className="text-slate-600 text-[11px] leading-relaxed"><span className="font-semibold text-slate-800">العوامل الداعمة:</span> {item.supportingFactors}</p>
                            <p className="text-indigo-800 text-[11px] leading-relaxed font-medium"><span className="font-semibold">الخطوة التشخيصية التالية:</span> {item.nextDiagnosticStep}</p>
                            
                            <button 
                              onClick={() => {
                                onUpdatePatient(selectedPatient.id, { diagnosis: item.diagnosisName, updatedAt: Date.now() });
                                setSelectedPatient({ ...selectedPatient, diagnosis: item.diagnosisName });
                                onAddAuditLog('تحديث التشخيص', `تم اختيار واعتماد تشخيص (${item.diagnosisName}) للطفل المريض ${selectedPatient.name}.`);
                                setDiagnosisSuggestions(null);
                              }}
                              className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded-md mt-2 transition-all block w-max"
                            >
                              تثبيت هذا التشخيص للمريض
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Smart Guidelines suggestion & consult system */}
                  {(() => {
                    const patientComplaint = ((selectedPatient.symptoms || '') + ' ' + (selectedPatient.diagnosis || '') + ' ' + (selectedPatient.pastHistory || '')).toLowerCase();
                    
                    let matchedGuideline = null;
                    if (
                      patientComplaint.includes('fever') || patientComplaint.includes('temp') || patientComplaint.includes('heat') || 
                      patientComplaint.includes('pyrexia') || patientComplaint.includes('حرارة') || patientComplaint.includes('سخون') || 
                      patientComplaint.includes('حمى') || patientComplaint.includes('التهاب')
                    ) {
                      matchedGuideline = clinicalGuidelines.find(g => g.id === 'fever');
                    } else if (
                      patientComplaint.includes('asthma') || patientComplaint.includes('wheeze') || patientComplaint.includes('cough') || 
                      patientComplaint.includes('bronch') || patientComplaint.includes('ربو') || patientComplaint.includes('تصفير') || 
                      patientComplaint.includes('صدر') || patientComplaint.includes('سعال') || patientComplaint.includes('ضيق')
                    ) {
                      matchedGuideline = clinicalGuidelines.find(g => g.id === 'asthma');
                    } else if (
                      patientComplaint.includes('diarrhea') || patientComplaint.includes('vomit') || patientComplaint.includes('gastro') || 
                      patientComplaint.includes('dehydr') || patientComplaint.includes('إسهال') || patientComplaint.includes('استفراغ') || 
                      patientComplaint.includes('جفاف') || patientComplaint.includes('نزلة') || patientComplaint.includes('قيء')
                    ) {
                      matchedGuideline = clinicalGuidelines.find(g => g.id === 'gastroenteritis');
                    }

                    return (
                      <div className="space-y-4 pt-2">
                        {matchedGuideline && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <span className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 text-blue-500 fill-blue-100" />
                                  {isEn ? "Smart Guideline Match Detected" : "تم مطابقة دليل إرشادي ذكي تلقائياً"}
                                </span>
                                <h4 className="text-xs font-extrabold text-slate-800">
                                  {isEn ? matchedGuideline.titleEn : matchedGuideline.titleAr}
                                </h4>
                              </div>
                              <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                {matchedGuideline.source}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                              {isEn ? matchedGuideline.synopsisEn : matchedGuideline.synopsisAr}
                            </p>

                            <div className="space-y-2 bg-white p-3 rounded-xl border border-blue-50/50">
                              <span className="text-[10px] font-bold text-slate-400 block">
                                {isEn ? "Clinical Protocol Steps:" : "خطوات التدبير والبروتوكول السريري:"}
                              </span>
                              {(isEn ? matchedGuideline.stepsEn : matchedGuideline.stepsAr).map((step, sIdx) => {
                                const isRed = step.toLowerCase().includes('red') || step.includes('الأحمر');
                                const isAmber = step.toLowerCase().includes('amber') || step.includes('الأصفر');
                                const isGreen = step.toLowerCase().includes('green') || step.includes('الأخضر');
                                return (
                                  <div 
                                    key={sIdx} 
                                    className={`p-2.5 rounded-lg text-xs leading-relaxed font-medium ${
                                      isRed ? 'bg-red-50 text-red-900 border-l-4 border-red-500' :
                                      isAmber ? 'bg-amber-50 text-amber-900 border-l-4 border-amber-500' :
                                      isGreen ? 'bg-green-50 text-green-900 border-l-4 border-green-500' :
                                      'bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    {step}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="p-3 rounded-xl bg-red-50 text-red-950 border border-red-100 text-[11px] leading-relaxed">
                              <span className="font-bold text-red-800 block mb-0.5">⚠️ {isEn ? "Critical Safety Warnings:" : "تحذيرات سريرية بالغة الخطورة:"}</span>
                              {isEn ? matchedGuideline.warningEn : matchedGuideline.warningAr}
                            </div>
                          </motion.div>
                        )}

                        {/* Guidelines Consultation Library entry */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-0.5">
                            <span className="text-xs font-extrabold text-slate-700 block">
                              {isEn ? "NICE Guidelines & Nelson's Pediatrics Library" : "المكتبة السريرية المرجعية (NICE & Nelson)"}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {isEn ? "Consult complete protocols for Fever, Asthma/Bronchiolitis, and Gastroenteritis." : "تصفح ومراجعة بروتوكولات الإسعاف والتدبير الكاملة المعتمدة دولياً."}
                            </span>
                          </div>
                          <button
                            onClick={() => setIsGuidelinesModalOpen(true)}
                            className="bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 shrink-0"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                            {isEn ? "Open Guidelines Library" : "فتح مكتبة الأدلة السريرية"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab 2: Vitals History */}
              {detailTab === 'vitals' && (
                <div className="space-y-6">
                  {/* Latest Vitals Overview */}
                  {selectedPatient.vitalsHistory.length > 0 ? (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-bold text-slate-600">آخر العلامات الحيوية المرصودة</h3>
                        <button 
                          onClick={handleVitalsAnalysis} 
                          disabled={loadingVitalsAnalysis}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          {loadingVitalsAnalysis ? 'جاري المراجعة السريرية...' : 'تحليل العلامات بالذكاء الاصطناعي'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-center">
                          <Thermometer className="w-5 h-5 mx-auto text-red-500 mb-1" />
                          <span className="text-[10px] text-slate-400 block font-bold">الحرارة Temp</span>
                          <span className="text-sm font-bold text-slate-800">{selectedPatient.vitalsHistory[0].temp} °C</span>
                        </div>
                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-center">
                          <Heart className="w-5 h-5 mx-auto text-rose-500 mb-1" />
                          <span className="text-[10px] text-slate-400 block font-bold">النبض HR</span>
                          <span className="text-sm font-bold text-slate-800">{selectedPatient.vitalsHistory[0].heartRate} bpm</span>
                        </div>
                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-center">
                          <Activity className="w-5 h-5 mx-auto text-indigo-500 mb-1" />
                          <span className="text-[10px] text-slate-400 block font-bold">التنفس RR</span>
                          <span className="text-sm font-bold text-slate-800">{selectedPatient.vitalsHistory[0].respRate} rpm</span>
                        </div>
                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-center">
                          <Activity className="w-5 h-5 mx-auto text-green-500 mb-1" />
                          <span className="text-[10px] text-slate-400 block font-bold">الأكسجين SpO2</span>
                          <span className="text-sm font-bold text-slate-800">{selectedPatient.vitalsHistory[0].spo2} %</span>
                        </div>
                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-center">
                          <Activity className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                          <span className="text-[10px] text-slate-400 block font-bold">الضغط BP</span>
                          <span className="text-sm font-bold text-slate-800">{selectedPatient.vitalsHistory[0].systolicBp}/{selectedPatient.vitalsHistory[0].diastolicBp}</span>
                        </div>
                      </div>

                      {/* Vitals Trend SVG Chart */}
                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 mt-4">
                        <span className="text-[10px] text-slate-400 font-bold block mb-2">مخطط اتجاه معدل ضربات القلب (ضربة/دقيقة)</span>
                        <div className="h-28 flex items-end justify-between px-2 pt-4">
                          {selectedPatient.vitalsHistory.slice(0, 8).reverse().map((v, idx) => {
                            // Map heartRate range 60-160 to chart heights
                            const heightPercentage = Math.min(Math.max(((v.heartRate - 60) / 100) * 100, 15), 100);
                            return (
                              <div key={idx} className="flex flex-col items-center flex-1 group relative">
                                <span className="text-[9px] text-indigo-600 font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4">{v.heartRate}</span>
                                <div className="w-2.5 bg-blue-500 rounded-full transition-all duration-500" style={{ height: `${heightPercentage}%` }}></div>
                                <span className="text-[8px] text-slate-400 mt-1">{new Date(v.timestamp).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* AI Vitals Clinical Report */}
                      {vitalsAnalysisResult && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 mt-4 space-y-4"
                        >
                          <div className="flex justify-between items-center">
                            <h3 className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-indigo-500 fill-indigo-100" />
                              تقرير مراجعة العلامات الحيوية (AI Consult)
                            </h3>
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[9px] font-bold">PEWS Score: {vitalsAnalysisResult.pewsScore} / 9</span>
                          </div>

                          <div className="text-xs text-slate-700 leading-relaxed font-semibold bg-white p-3 rounded-xl border border-indigo-100/30">
                            {vitalsAnalysisResult.analysisText}
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] text-indigo-900 font-bold block">💡 التدابير السريرية المباشرة الموصى بها:</span>
                            {vitalsAnalysisResult.recommendations?.map((rec: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs text-indigo-950 font-medium bg-indigo-50/50 p-2 rounded-lg">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                <span>{rec}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Chronological logs */}
                      <div className="space-y-2 mt-6">
                        <span className="text-xs font-bold text-slate-400 block">سجل القراءات التاريخي</span>
                        <div className="space-y-1">
                          {selectedPatient.vitalsHistory.map((v, idx) => (
                            <div key={idx} className="text-xs p-3 rounded-lg bg-slate-50 flex justify-between items-center text-slate-600">
                              <span>قيد بواسطة: <span className="font-bold text-slate-700">{v.author}</span></span>
                              <div className="flex gap-3 text-[11px] font-semibold">
                                <span className="text-red-600">حرارة: {v.temp}</span>
                                <span className="text-rose-600">نبض: {v.heartRate}</span>
                                <span className="text-indigo-600">أكسجين: {v.spo2}٪</span>
                                <span>ضغط: {v.systolicBp}/{v.diastolicBp}</span>
                              </div>
                              <span className="text-[10px] text-slate-400">{new Date(v.timestamp).toLocaleString('ar-EG')}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-xs">لا يوجد سجل علامات حيوية حتى الآن.</div>
                  )}
                </div>
              )}

              {/* Tab 3: Growth Chart */}
              {detailTab === 'growth' && (
                <div className="space-y-6">
                  {/* Growth Input Form */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Baby className="w-4 h-4 text-blue-600" />
                      {t.growthTitle}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.weightKg} *</label>
                        <input 
                          type="number" 
                          step="0.01"
                          placeholder="e.g. 12.5"
                          value={newWeight}
                          onChange={(e) => setNewWeight(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.heightCm}</label>
                        <input 
                          type="number" 
                          step="0.1"
                          placeholder="e.g. 85.0"
                          value={newHeight}
                          onChange={(e) => setNewHeight(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.headCircum}</label>
                        <input 
                          type="number" 
                          step="0.1"
                          placeholder="e.g. 45.5"
                          value={newHeadCircum}
                          onChange={(e) => setNewHeadCircum(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.growthStandard}</label>
                        <select 
                          value={growthStandard}
                          onChange={(e: any) => setGrowthStandard(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none font-semibold text-slate-700"
                        >
                          <option value="WHO">{isEn ? "WHO (0-5 Years)" : "منظمة الصحة العالمية WHO"}</option>
                          <option value="CDC">{isEn ? "CDC (5-20 Years)" : "مراكز التحكم بالأمراض CDC"}</option>
                        </select>
                      </div>
                    </div>

                    <button 
                      onClick={handleAddWeight}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all shadow-xs flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      {t.calculateScores}
                    </button>
                  </div>

                  {/* Growth History & Assessment Cards */}
                  {selectedPatient.growthHistory && selectedPatient.growthHistory.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left: Progression & SVG curve */}
                      <div className="lg:col-span-7 space-y-6">
                        <div className="bg-white p-5 rounded-2xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-500 block mb-4">{t.growthHistoryChart}</span>
                          
                          <div className="h-44 flex items-end justify-between px-6 pt-4 border-b border-l border-slate-200 relative">
                            {/* Standard deviation bands lines overlays (just reference lines) */}
                            <div className="absolute left-0 right-0 border-t border-dashed border-red-200/50" style={{ bottom: '20%' }}></div>
                            <div className="absolute left-0 right-0 border-t border-dashed border-amber-200/50" style={{ bottom: '40%' }}></div>
                            <div className="absolute left-0 right-0 border-t border-dashed border-green-200/30" style={{ bottom: '60%' }}></div>
                            
                            {selectedPatient.growthHistory.map((g, idx) => {
                              // Simple scaling between 2kg and 25kg
                              const hPercent = Math.min(Math.max(((g.weightKg - 2) / 23) * 100, 10), 100);
                              return (
                                <div key={idx} className="flex flex-col items-center flex-1 group relative z-10">
                                  <span className="text-[10px] text-blue-600 font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 bg-white/90 shadow-2xs px-1 rounded">
                                    {g.weightKg} Kg (WAZ: {g.wazScore !== undefined ? g.wazScore : 'N/A'})
                                  </span>
                                  <div className="w-3 bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600" style={{ height: `${hPercent}%` }}></div>
                                  <span className="text-[9px] text-slate-400 mt-1.5">{isEn ? `${g.ageMonths}m` : `${g.ageMonths} ش`}</span>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="flex justify-center gap-4 mt-3 text-[10px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-300"></span> {isEn ? "Normal Range" : "النطاق الطبيعي"}</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300"></span> {isEn ? "Warning / MAM" : "تحذير / سوء تغذية متوسط"}</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300"></span> {isEn ? "Critical / SAM" : "خطر حرج / سوء تغذية شديد"}</span>
                          </div>
                        </div>

                        {/* Measurements logs table */}
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                <th className="p-3 text-center">{isEn ? "Age" : "العمر"}</th>
                                <th className="p-3 text-center">{isEn ? "Weight" : "الوزن"}</th>
                                <th className="p-3 text-center">{isEn ? "Height" : "الطول"}</th>
                                <th className="p-3 text-center">{isEn ? "HC" : "محيط الرأس"}</th>
                                <th className="p-3 text-center">WAZ Z-score</th>
                                <th className="p-3 text-center">HAZ Z-score</th>
                                <th className="p-3 text-center">{isEn ? "Grade" : "درجة سوء التغذية"}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedPatient.growthHistory.map((g, idx) => {
                                const isCritical = g.wazScore !== undefined && g.wazScore < -3;
                                const isWarning = g.wazScore !== undefined && g.wazScore < -2 && g.wazScore >= -3;
                                return (
                                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-3 text-center font-semibold text-slate-700">{g.ageMonths} {isEn ? "months" : "شهراً"}</td>
                                    <td className="p-3 text-center font-bold text-slate-900">{g.weightKg} kg</td>
                                    <td className="p-3 text-center text-slate-600">{g.heightCm ? `${g.heightCm} cm` : "-"}</td>
                                    <td className="p-3 text-center text-slate-600">{g.headCircumferenceCm ? `${g.headCircumferenceCm} cm` : "-"}</td>
                                    <td className={`p-3 text-center font-bold ${isCritical ? 'text-red-600 bg-red-50/30' : isWarning ? 'text-amber-600 bg-amber-50/20' : 'text-slate-700'}`}>
                                      {g.wazScore !== undefined ? g.wazScore : '-'}
                                    </td>
                                    <td className="p-3 text-center text-slate-600 font-semibold">{g.hazScore !== undefined ? g.hazScore : '-'}</td>
                                    <td className="p-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        g.malnutritionGrade === 'SAM' ? 'bg-red-100 text-red-800' :
                                        g.malnutritionGrade === 'MAM' ? 'bg-amber-100 text-amber-800' :
                                        g.malnutritionGrade === 'Mild' ? 'bg-yellow-100 text-yellow-800' :
                                        g.malnutritionGrade === 'Stunted' ? 'bg-orange-100 text-orange-800' :
                                        g.malnutritionGrade === 'Overweight' ? 'bg-purple-100 text-purple-800' :
                                        'bg-green-100 text-green-800'
                                      }`}>
                                        {g.malnutritionGrade || 'Normal'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right: Nelson Pediatrics & WHO active recommendations */}
                      <div className="lg:col-span-5 space-y-4">
                        {(() => {
                          // Get latest record
                          const latestRecord = selectedPatient.growthHistory[selectedPatient.growthHistory.length - 1];
                          // Re-assess child to fetch active text arrays
                          const details = assessChildGrowth(
                            latestRecord.ageMonths,
                            selectedPatient.gender,
                            latestRecord.weightKg,
                            latestRecord.heightCm,
                            latestRecord.headCircumferenceCm,
                            latestRecord.standard || 'WHO'
                          );

                          const grade = details.malnutritionGrade;
                          const isWarning = grade === 'MAM' || grade === 'Mild' || grade === 'Stunted' || grade === 'Overweight';
                          const isDanger = grade === 'SAM';

                          return (
                            <div className="space-y-4">
                              {/* Clinical score card */}
                              <div className={`p-5 rounded-2xl border ${
                                isDanger ? 'bg-red-50/40 border-red-200' :
                                isWarning ? 'bg-amber-50/30 border-amber-200' :
                                'bg-green-50/30 border-green-200'
                              } space-y-3`}>
                                <div className="flex justify-between items-center">
                                  <span className="text-[11px] text-slate-400 font-bold block">{t.scoresResult}</span>
                                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded shadow-2xs">
                                    {latestRecord.standard || 'WHO'}
                                  </span>
                                </div>
                                
                                <div className="space-y-1">
                                  <span className={`text-sm font-extrabold ${isDanger ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-green-700'}`}>
                                    {isEn ? details.malnutritionLabelEn : details.malnutritionLabelAr}
                                  </span>
                                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 pt-1">
                                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                                      <span>WAZ (Weight-for-Age):</span>
                                      <span className="font-extrabold text-slate-800 block text-sm mt-0.5">{details.waz} ({zScoreToPercentile(details.waz)})</span>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                                      <span>HAZ (Height-for-Age):</span>
                                      <span className="font-extrabold text-slate-800 block text-sm mt-0.5">{latestRecord.heightCm ? `${details.haz} (${zScoreToPercentile(details.haz)})` : "N/A"}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-[11px] text-slate-600 bg-white/60 p-3 rounded-xl leading-relaxed space-y-1">
                                  <span className="font-bold text-slate-800 block">
                                    {isEn ? "Nelson Pediatrics clinical guidelines:" : "المعايير المعتمدة لطب الأطفال (Nelson's Pediatrics):"}
                                  </span>
                                  <p>{isEn ? details.nelsonCriteriaEn : details.nelsonCriteriaAr}</p>
                                </div>
                              </div>

                              {/* Malnutrition Management protocol card */}
                              {isDanger && (
                                <div className="p-5 rounded-2xl bg-rose-900 text-white space-y-3 shadow-md">
                                  <h4 className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
                                    <AlertCircle className="w-4 h-4 text-rose-300" />
                                    {isEn ? "WHO Severe Malnutrition Resuscitation" : "بروتوكول إسعاف سوء التغذية الحاد الشديد"}
                                  </h4>
                                  <p className="text-[11px] text-rose-100 leading-relaxed">
                                    {isEn 
                                      ? "F-75 milk formulas MUST be used in initial stabilization phase (Days 1-7). Feed strictly every 2-3 hours. Do not use standard high-protein feeds early on to prevent refeeding death."
                                      : "يجب استخدام حليب F-75 حصرياً في مرحلة الاستقرار الأولى (الأيام 1-7). تغذية صارمة كل 2-3 ساعات ليلاً ونهاراً. يمنع تقديم أغذية عالية البروتين لتفادي الوفاة بمتلازمة إعادة التغذية."}
                                  </p>
                                  <div className="text-[10px] bg-rose-950/50 p-2.5 rounded-lg border border-rose-800 text-rose-200">
                                    <span className="font-bold block text-white mb-1">📋 {isEn ? "Key Monitoring Points:" : "النقاط الرقابية الرئيسية:"}</span>
                                    <ul className="list-disc pl-4 space-y-1">
                                      <li>{isEn ? "Screen capillary blood sugar for hypoglycemia (give 10% dextrose if < 3.0 mmol/L)" : "افحص سكر الدم بشكل دوري لتفادي نقص السكر (أعط دكستروز ١٠٪)"}</li>
                                      <li>{isEn ? "Keep warm - prevent hypothermia (skin-to-skin or blankets)" : "حافظ على دفء الطفل وتفادي هبوط الحرارة"}</li>
                                      <li>{isEn ? "Check serum electrolytes - do not give IV sodium or standard saline unless in shock" : "راقب الكهارل - يمنع إعطاء صوديوم وريدي لتجنب فشل القلب"}</li>
                                    </ul>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                      <Baby className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      {t.noPatients || "لا توجد قراءات نمو مسجلة للطفل حالياً."}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Medications */}
              {detailTab === 'meds' && (
                <div className="space-y-6">
                  {/* Prescribe Medication */}
                  {hasPermission(currentUser.role, 'write_notes') && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Pill className="w-4 h-4 text-blue-600" />
                          {t.medTitle}
                        </h3>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                          {isEn ? "BNF 2026 Aligned" : "متوافق مع BNF لعام ٢٠٢٦"}
                        </span>
                      </div>

                      {/* BNF Drug Selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block">{t.selectDrug}</label>
                        <select
                          value={selectedBnfDrugId}
                          onChange={(e) => setSelectedBnfDrugId(e.target.value)}
                          className="w-full max-w-md px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none font-semibold text-slate-700"
                        >
                          <option value="">-- {isEn ? "Custom/Manual Prescription" : "وصفة مخصصة أو يدوية"} --</option>
                          {bnfFormulary.map((drug) => (
                            <option key={drug.id} value={drug.id}>
                              {isEn ? drug.nameEn : `${drug.nameEn} (${drug.nameAr})`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Live BNF Pediatric Calculator Advice */}
                      {calculatedBnf && (() => {
                        const drug = bnfFormulary.find(d => d.id === selectedBnfDrugId);
                        if (!drug) return null;

                        // Check allergy conflict
                        const allergyStr = (selectedPatient.allergies || '').toLowerCase();
                        const drugNameEnLower = drug.nameEn.toLowerCase();
                        const drugNameArLower = drug.nameAr.toLowerCase();
                        
                        let hasAllergyConflict = 
                          allergyStr.includes(drugNameEnLower) || 
                          allergyStr.includes(drug.id) ||
                          (drug.id === 'amoxicillin' && (allergyStr.includes('penicillin') || allergyStr.includes('بنسلين') || allergyStr.includes('أموكسي'))) ||
                          (drug.id === 'ceftriaxone' && (allergyStr.includes('cephalosporin') || allergyStr.includes('سيفالوسبورين') || allergyStr.includes('بنسلين') || allergyStr.includes('penicillin')));

                        return (
                          <div className="space-y-3">
                            {/* Allergy warning flag */}
                            {hasAllergyConflict && (
                              <div className="p-4 rounded-xl bg-red-100 border border-red-200 text-red-900 text-xs font-bold flex items-center gap-2 animate-bounce">
                                <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0" />
                                <div>
                                  <span className="block font-extrabold">{t.alertAllergyConflict}</span>
                                  <span className="text-[10px] font-semibold block text-red-700">
                                    {isEn ? `Patient allergies document: "${selectedPatient.allergies}"` : `تنبيه الحساسية المسجل للمريض: "${selectedPatient.allergies}"`}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Dosage calculation info card */}
                            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5 text-xs">
                                <span className="text-[10px] text-blue-600 font-bold block uppercase">{t.suggestedBnfDose}</span>
                                <div className="text-slate-700 space-y-1">
                                  <p className="font-bold text-slate-900 text-sm">
                                    {calculatedBnf.calculatedSingleDoseMg} mg / dose
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {isEn ? "Total Daily Dose:" : "إجمالي الجرعة اليومية:"} <span className="font-bold text-slate-700">{calculatedBnf.calculatedDailyDoseMg} mg</span> per day ({calculatedBnf.frequencyTextEn})
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-semibold">
                                    {isEn ? "Formulary Standard Dosing:" : "المعيار المعتمد في BNF:"} <span className="text-blue-700">{isEn ? drug.standardPedDose : drug.standardPedDoseAr}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-1.5 text-xs">
                                <span className="text-[10px] text-indigo-600 font-bold block uppercase">{isEn ? "Suspension Volume equivalents:" : "مكافئات الحجم بالمليلتر للمحاليل السائلة:"}</span>
                                {calculatedBnf.liquids && calculatedBnf.liquids.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {calculatedBnf.liquids.map((liq, lIdx) => (
                                      <div key={lIdx} className="bg-white p-2 rounded-lg border border-slate-100 flex justify-between items-center font-semibold text-slate-700 text-[11px]">
                                        <span>{liq.strengthText}:</span>
                                        <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{liq.doseMl} ml</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-slate-400 text-[11px] italic">{isEn ? "Only available in tablet/vial formulation" : "متوفر فقط كحقن وريدية أو كبسولات جافة"}</p>
                                )}
                              </div>
                            </div>

                            {/* Safety Warnings & Route info */}
                            <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-100 text-xs text-slate-700 space-y-2">
                              <div className="flex gap-2">
                                <span className="font-bold text-amber-800">{t.refBnfInfo}</span>
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">{t.route}: {isEn ? drug.routesEn : drug.routesAr}</span>
                              </div>
                              <p className="text-[11px] leading-relaxed italic">{isEn ? drug.bnfWarningsEn : drug.bnfWarningsAr}</p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Manual Entry Inputs (auto-filled if BNF selected) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">{isEn ? "Medication Name" : "اسم الدواء"}</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Paracetamol" 
                            value={medName}
                            onChange={(e) => setMedName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none font-semibold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">{isEn ? "Dosage" : "الجرعة المقررة"}</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 150 mg" 
                            value={medDosage}
                            onChange={(e) => setMedDosage(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none font-semibold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">{isEn ? "Frequency" : "تكرار الجرعة"}</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Every 6 hours" 
                            value={medFreq}
                            onChange={(e) => setMedFreq(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none font-semibold text-slate-800"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          handleAddMedication();
                          setSelectedBnfDrugId('');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-1 shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        {t.prescribeButton}
                      </button>
                    </div>
                  )}

                  {/* Active Meds list */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500">{t.activeMedsList}</h3>
                    {selectedPatient.medications.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-100 rounded-2xl">{isEn ? "No active medications recorded." : "لم يتم وصف أي علاج لهذا المريض حتى الآن."}</div>
                    ) : (
                      <div className="space-y-2">
                        {selectedPatient.medications.map((m) => (
                          <div key={m.id} className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-100 shadow-3xs hover:border-slate-200 transition-all">
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-xl ${m.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                <Pill className="w-5 h-5" />
                              </div>
                              <div>
                                <span className="font-extrabold text-xs text-slate-800 block">{m.name}</span>
                                <span className="text-[10px] text-slate-500 block font-medium">
                                  {isEn ? "Dosage:" : "الجرعة:"} <span className="font-bold text-slate-700">{m.dosage}</span> | {isEn ? "Frequency:" : "التكرار:"} <span className="font-bold text-slate-700">{m.frequency}</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-1.5">
                              {m.status === 'active' ? (
                                <>
                                  <button 
                                    onClick={() => handleUpdateMedStatus(m.id, 'completed')}
                                    className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 text-[10px] font-bold rounded-lg transition-all hover:bg-green-100"
                                  >
                                    {isEn ? "Completed" : "مكتمل"}
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateMedStatus(m.id, 'paused')}
                                    className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-bold rounded-lg transition-all hover:bg-rose-100"
                                  >
                                    {isEn ? "Stop" : "إيقاف مؤقت"}
                                  </button>
                                </>
                              ) : (
                                <span className={`text-[10px] px-2.5 py-1 rounded-lg font-extrabold ${
                                  m.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {m.status === 'completed' ? (isEn ? "Completed" : "مكتمل") : (isEn ? "Stopped" : "موقوف مؤقتاً")}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 5: SOAP Notes */}
              {detailTab === 'soap' && (
                <div className="space-y-6">
                  {/* Create SOAP Note */}
                  {hasPermission(currentUser.role, 'write_notes') && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                      <h3 className="text-xs font-bold text-slate-700">تدوين ملاحظة SOAP تقدمية جديدة لليوم</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold block">S (المعطيات الشخصية الذاتية - Subjective)</label>
                          <textarea 
                            placeholder="شكاوى الأهل، الرضاعة، النوم، الحركة..."
                            value={soapS}
                            onChange={(e) => setSoapS(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold block">O (الملاحظات السريرية الموضوعية - Objective)</label>
                          <textarea 
                            placeholder="الفحص الطبي، أصوات الصدر، البطن، قياسات المراقبة..."
                            value={soapO}
                            onChange={(e) => setSoapO(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold block">A (التقييم الطبي الحالي - Assessment)</label>
                          <textarea 
                            placeholder="هل توجد أزمة تنفسية حادة؟ تحسن؟ تدهور؟ استقرار؟"
                            value={soapA}
                            onChange={(e) => setSoapA(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold block">P (الخطة العلاجية والسريرية المقررة - Plan)</label>
                          <textarea 
                            placeholder="تعديل الأدوية، طلب تحاليل إضافية، متابعة الجراحة..."
                            value={soapP}
                            onChange={(e) => setSoapP(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={handleAddSoap}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all block w-max"
                      >
                        حفظ الملاحظة الطبية ونشرها للقسم
                      </button>
                    </div>
                  )}

                  {/* SOAP Logs */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-500">مذكرات الـ SOAP التاريخية المسجلة</h3>
                    {!selectedPatient.soapHistory || selectedPatient.soapHistory.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs">لم يتم تدوين أي مذكرات SOAP لهذا المريض حتى الآن.</div>
                    ) : (
                      <div className="space-y-4">
                        {selectedPatient.soapHistory.map((item) => (
                          <div key={item.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 relative">
                            <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-200/50 pb-2">
                              <span>الكاتب: <span className="font-bold text-slate-700">{item.author} ({item.role})</span></span>
                              <span>تاريخ القيد: {new Date(item.timestamp).toLocaleString('ar-EG')}</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="font-bold text-indigo-700 block mb-0.5">Subjective (الشكوى الذاتية)</span>
                                <p className="text-slate-600 leading-relaxed">{item.s}</p>
                              </div>
                              <div>
                                <span className="font-bold text-indigo-700 block mb-0.5">Objective (الملاحظات الموضوعية)</span>
                                <p className="text-slate-600 leading-relaxed">{item.o}</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs border-t border-slate-100 pt-2">
                              <div>
                                <span className="font-bold text-indigo-700 block mb-0.5">Assessment (التقييم الطبي)</span>
                                <p className="text-slate-600 leading-relaxed font-semibold">{item.a}</p>
                              </div>
                              <div>
                                <span className="font-bold text-indigo-700 block mb-0.5">Plan (الخطة العلاجية)</span>
                                <p className="text-slate-600 leading-relaxed font-semibold text-blue-700">{item.p}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 6: Discharge Checklist */}
              {detailTab === 'discharge' && (
                <div className="space-y-6">
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-2 text-xs text-amber-800 leading-relaxed">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">⚠️ معايير الجودة لسلامة خروج أطفال التنويم</span>
                      يجب استيفاء والتحقق من المعايير السريرية الخمسة أدناه بالكامل قبل السماح بتسريح المريض طبياً وإنهاء منامته في القسم.
                    </div>
                  </div>

                  {/* Checklist render */}
                  <div className="space-y-2 border border-slate-100 p-4 rounded-xl bg-white">
                    {selectedPatient.dischargeChecklist.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => toggleChecklistItem(item.id, item.completed)}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-300 transition-all cursor-pointer"
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          item.completed 
                            ? 'bg-green-600 border-green-600 text-white' 
                            : 'border-slate-300 bg-white'
                        }`}>
                          {item.completed && <Check className="w-4 h-4" />}
                        </div>
                        <span className={`text-xs font-semibold ${item.completed ? 'text-green-800 line-through' : 'text-slate-700'}`}>
                          {item.item}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Discharge Form */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <span className="text-xs font-bold text-slate-700 block">ملخص الخروج والتوصيات المنزلية المكتوبة</span>
                    <textarea 
                      placeholder="اكتب التوصيات الطبية والمتابعة المنزلية بالتفصيل لملف الطفل الطبي..."
                      value={dischargeNotes}
                      onChange={(e) => setDischargeNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />

                    {hasPermission(currentUser.role, 'discharge_patients') ? (
                      <button 
                        onClick={handleDischargePatient}
                        disabled={!selectedPatient.dischargeChecklist.every(item => item.completed)}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs px-5 py-2.5 rounded-xl font-bold transition-all block w-full text-center shadow-xs"
                      >
                        توقيع الخروج وإنهاء تنويم الطفل
                      </button>
                    ) : (
                      <div className="text-center text-xs text-rose-600 font-bold py-2 bg-rose-50 border border-rose-100 rounded-xl">
                        تسريح المرضى وتوقيع الخروج الطبي متاح للمدير الطبي والاستشاريين فقط.
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-20 text-slate-400">
            <Baby className="w-16 h-16 text-slate-300 animate-bounce" />
            <h2 className="text-base font-bold text-slate-700">لم يتم اختيار أي طفل مريض حالياً</h2>
            <p className="text-xs text-slate-400 max-w-xs">يرجى الضغط على أحد بطاقات الأطفال المنومين على اليمين لمعاينة التفاصيل السريرية والتدابير الذكية.</p>
          </div>
        )}
      </div>

      {/* Add Vitals Modal */}
      <AnimatePresence>
        {isAddingVitals && selectedPatient && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-100 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800">رصد علامات حيوية جديدة لـ {selectedPatient.name}</h3>
                <button onClick={() => setIsAddingVitals(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">درجة الحرارة Temp (°C)</label>
                  <input type="number" step="0.1" value={newTemp} onChange={(e) => setNewTemp(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">معدل نبض القلب HR (bpm)</label>
                  <input type="number" value={newHr} onChange={(e) => setNewHr(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">معدل التنفس RR (breaths/m)</label>
                  <input type="number" value={newRr} onChange={(e) => setNewRr(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">تشبع الأكسجين SpO2 (%)</label>
                  <input type="number" value={newSpo2} onChange={(e) => setNewSpo2(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">ضغط الدم الانقباضي Systolic</label>
                  <input type="number" value={newSystolic} onChange={(e) => setNewSystolic(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">ضغط الدم الانبساطي Diastolic</label>
                  <input type="number" value={newDiastolic} onChange={(e) => setNewDiastolic(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button 
                  onClick={handleAddVitals}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all flex-1"
                >
                  حفظ القراءات وتحديث الحالة
                </button>
                <button 
                  onClick={() => setIsAddingVitals(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl font-bold transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admission Wizard Modal */}
      <AnimatePresence>
        {isWizardOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-2xl max-w-lg w-full border border-slate-100 shadow-xl space-y-4"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800">معالج قبول وتنويم طفل جديد (CoreWard Wizard)</h3>
                <button onClick={() => setIsWizardOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Steps Indicator */}
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                {[
                  { step: 1, label: 'البيانات الأساسية' },
                  { step: 2, label: 'الفحوصات الأولية' },
                  { step: 3, label: 'السجل المرضي' }
                ].map(s => (
                  <div key={s.step} className="flex items-center gap-1.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                      wizardStep === s.step 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : wizardStep > s.step
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}>
                      {s.step}
                    </span>
                    <span className={`text-[10px] font-bold ${wizardStep === s.step ? 'text-blue-600' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Wizard Content */}
              {wizardStep === 1 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">اسم الطفل الرباعي *</label>
                    <input type="text" placeholder="مثال: يوسف فهد المطيري" value={admName} onChange={(e) => setAdmName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">عمر الطفل بالسنوات/الأشهر *</label>
                      <input type="text" placeholder="مثال: ١٨ شهراً أو ٣ سنوات" value={admAge} onChange={(e) => setAdmAge(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">الجنس *</label>
                      <select value={admGender} onChange={(e) => setAdmGender(e.target.value as any)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <option value="male">ذكر 👦</option>
                        <option value="female">أنثى 👧</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">رقم السرير والرمز *</label>
                      <input type="text" placeholder="مثال: A2" value={admBed} onChange={(e) => setAdmBed(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">طبيب الامتياز المكلف بالمتابعة</label>
                      <select value={admInternId} onChange={(e) => setAdmInternId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <option value="">اختر طبيب الامتياز...</option>
                        {interns.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">الأعراض والشكوى السريرية *</label>
                    <textarea placeholder="اكتب الشكوى الحالية بالتفصيل..." value={admSymptoms} onChange={(e) => setAdmSymptoms(e.target.value)} rows={2} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">درجة الحرارة (°C)</label>
                      <input type="number" step="0.1" value={admTemp} onChange={(e) => setAdmTemp(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">معدل النبض HR (bpm)</label>
                      <input type="number" value={admHr} onChange={(e) => setAdmHr(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">معدل التنفس RR</label>
                      <input type="number" value={admRr} onChange={(e) => setAdmRr(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">انقباضي Systolic</label>
                      <input type="number" value={admSystolic} onChange={(e) => setAdmSystolic(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">انبساطي Diastolic</label>
                      <input type="number" value={admDiastolic} onChange={(e) => setAdmDiastolic(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">الأكسجين SpO2 (%)</label>
                      <input type="number" value={admSpo2} onChange={(e) => setAdmSpo2(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">الوزن الأولي (Kg)</label>
                      <input type="number" step="0.1" placeholder="مثال: 12.5" value={admWeight} onChange={(e) => setAdmWeight(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">الحساسية المفرطة المعروفة</label>
                      <input type="text" placeholder="مثال: بنسلين / خالية" value={admAllergies} onChange={(e) => setAdmAllergies(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">سوابق العمليات والأمراض المزمنة للطفل</label>
                    <textarea placeholder="اكتب السجل الطبي والأمراض السابقة..." value={admPastHistory} onChange={(e) => setAdmPastHistory(e.target.value)} rows={2} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                  </div>

                  <div className="space-y-2 border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">وصف الأدوية المبدئية عند الدخول</span>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="text" placeholder="اسم الدواء" value={newMedName} onChange={(e) => setNewMedName(e.target.value)} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs" />
                      <input type="text" placeholder="الجرعة" value={newMedDosage} onChange={(e) => setNewMedDosage(e.target.value)} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs" />
                      <input type="text" placeholder="التردد" value={newMedFreq} onChange={(e) => setNewMedFreq(e.target.value)} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs" />
                    </div>
                    <button onClick={handleAddMedRow} className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-md mt-1 transition-all">
                      + إضافة دواء في القائمة المبدئية
                    </button>

                    {medsList.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {medsList.map((m, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] bg-white px-2 py-1 rounded border text-slate-600">
                            <span>{m.name} ({m.dosage})</span>
                            <span>{m.frequency}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Wizard Error Block */}
              {wizardError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-100">
                  {wizardError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                {wizardStep > 1 && (
                  <button 
                    onClick={() => {
                      setWizardError(null);
                      setWizardStep(wizardStep - 1);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl font-bold transition-all"
                  >
                    السابق
                  </button>
                )}
                
                {wizardStep < 3 ? (
                  <button 
                    onClick={() => {
                      setWizardError(null);
                      setWizardStep(wizardStep + 1);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all flex-1"
                  >
                    المتابعة (التالي)
                  </button>
                ) : (
                  <button 
                    onClick={handleAdmitPatient}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all flex-1"
                  >
                    إتمام وحفظ قبول الطفل في الجناح 
                  </button>
                )}
                
                <button 
                  onClick={() => setIsWizardOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs px-4 py-2 rounded-xl transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Patient Modal */}
      <AnimatePresence>
        {isEditingPatient && selectedPatient && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-2xl max-w-lg w-full border border-slate-100 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Edit className="w-5 h-5 text-indigo-600" />
                  تعديل الملف الطبي للمريض: {selectedPatient.name}
                </h3>
                <button onClick={() => setIsEditingPatient(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-right" dir="rtl">
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">الاسم بالكامل *</label>
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">العمر (مثال: سنتين، أو 18 شهراً) *</label>
                    <input 
                      type="text" 
                      value={editAge} 
                      onChange={(e) => setEditAge(e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">الجنس *</label>
                    <select 
                      value={editGender} 
                      onChange={(e) => setEditGender(e.target.value as any)} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                    >
                      <option value="male">ذكر 👦</option>
                      <option value="female">أنثى 👧</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">رقم السرير *</label>
                    <input 
                      type="text" 
                      value={editBed} 
                      onChange={(e) => setEditBed(e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">تصنيف حالة المريض *</label>
                    <select 
                      value={editStatus} 
                      onChange={(e) => setEditStatus(e.target.value as any)} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                    >
                      <option value="stable">✅ مستقر (Stable)</option>
                      <option value="followup">🕒 متابعة دورية (Followup)</option>
                      <option value="critical">⚠️ حرج جداً (Critical)</option>
                      <option value="discharged">📤 تم تسريحه (Discharged)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">طبيب الامتياز المعين للمريض</label>
                  <select 
                    value={editInternId} 
                    onChange={(e) => setEditInternId(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="unassigned">غير معين</option>
                    {interns.map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">الشكوى السريرية الأساسية (Symptoms) *</label>
                  <textarea 
                    value={editSymptoms} 
                    onChange={(e) => setEditSymptoms(e.target.value)} 
                    rows={2} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none resize-none" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">التشخيص الحالي (Diagnosis)</label>
                  <input 
                    type="text" 
                    value={editDiagnosis} 
                    onChange={(e) => setEditDiagnosis(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-rose-500 font-bold block">⚠️ الحساسية والتحذيرات (Allergies)</label>
                    <input 
                      type="text" 
                      value={editAllergies} 
                      onChange={(e) => setEditAllergies(e.target.value)} 
                      className="w-full px-3 py-2 bg-rose-50/50 border border-rose-100 rounded-xl text-xs font-semibold focus:outline-none text-rose-900" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">السوابق الطبية والعمليات (Past History)</label>
                    <input 
                      type="text" 
                      value={editPastHistory} 
                      onChange={(e) => setEditPastHistory(e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none" 
                    />
                  </div>
                </div>

              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button 
                  onClick={handleSavePatientEdit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all flex-1"
                >
                  حفظ وتحديث الملف الطبي
                </button>
                <button 
                  onClick={() => setIsEditingPatient(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs px-4 py-2 rounded-xl transition-all font-bold"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
