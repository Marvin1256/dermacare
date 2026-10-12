import React, { useState, useEffect, useRef } from "react";
import { defaultSpecialists } from "../data";
import { providerPaperTranslations } from "../registrationTranslations";
import { saveDocument } from "../services/firebaseSync";

export default function ProviderRegistrationPaper({
  accounts = [],
  currentLanguage = "en",
  onLanguageChange,
  onBackToLogin,
  onRegisterSuccess,
  formTemplates = []
}) {
  const [localLang, setLocalLang] = useState(currentLanguage || "en");

  useEffect(() => {
    if (currentLanguage) {
      setLocalLang(currentLanguage);
    }
  }, [currentLanguage]);

  const activeLang = localLang || currentLanguage || "en";
  const tr = providerPaperTranslations[activeLang] || providerPaperTranslations.en;

  const handleSelectLanguage = (lang) => {
    setLocalLang(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
  };

  const [currentStep, setCurrentStep] = useState(1);
  const [providerType, setProviderType] = useState("Individual");

  // Find matching template configured in Admin Portal
  const matchingTemplate = formTemplates?.find(
    (t) => t.providerType === providerType
  ) || formTemplates?.find(
    (t) => t.providerType === "Individual" || t.id === "TMPL-INDIV-01"
  );

  const standardProviderFieldIds = [
    "ind-1", "ind-2", "ind-phone", "ind-dob", "ind-gender", "ind-nin",
    "ind-3", "ind-4", "ind-expiry", "ind-5", "ind-qual", "ind-6",
    "ind-workplace", "ind-addr", "ind-district", "ind-fee", "ind-hours",
    "ind-7", "ind-bio", "ind-doc-lic", "ind-doc-cert", "ind-doc-id", "ind-doc-photo",
    "cli-1", "cli-email", "cli-phone", "cli-2", "cli-type", "cli-4",
    "cli-admin-email", "cli-3", "cli-district", "cli-5", "cli-6",
    "cli-fee", "cli-hours", "cli-lang", "cli-doc-permit", "cli-doc-id", "cli-doc-reg",
    "hos-1", "hos-email", "hos-phone", "hos-2", "hos-3", "hos-4",
    "hos-admin-email", "hos-addr", "hos-district", "hos-5", "hos-6",
    "hos-derm-count", "hos-emer", "hos-doc-lic", "hos-doc-acc", "hos-doc-dir"
  ];

  const dynamicAdminFields = (matchingTemplate?.fields || []).filter(
    (f) => !standardProviderFieldIds.includes(f.id)
  );

  const [formErrors, setFormErrors] = useState({});
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [ethicsAgreed, setEthicsAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submittedAccount, setSubmittedAccount] = useState(null);
  const [customFieldValues, setCustomFieldValues] = useState({});

  const handleCustomFieldChange = (fieldId, val) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldId]: val
    }));
    if (formErrors[fieldId]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  // File upload input refs
  const licenseInputRef = useRef(null);
  const boardCertInputRef = useRef(null);
  const nationalIdInputRef = useRef(null);

  // Uploaded documents state
  const [uploadedDocs, setUploadedDocs] = useState({
    license: null,
    boardCert: null,
    nationalId: null,
  });
  const [dragActiveSlot, setDragActiveSlot] = useState(null);

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${Math.round(kb)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const handleFileUpload = (slot, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const docInfo = {
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
        dataUrl: e.target?.result,
        uploadedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isUploaded: true,
      };
      setUploadedDocs((prev) => ({
        ...prev,
        [slot]: docInfo,
      }));
      if (slot === "license") handleFieldChange("licenseFile", file.name);
      if (slot === "boardCert") handleFieldChange("registrationFile", file.name);
      if (slot === "nationalId") handleFieldChange("nationalIdFile", file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDoc = (slot, e) => {
    if (e) e.stopPropagation();
    setUploadedDocs((prev) => ({
      ...prev,
      [slot]: null,
    }));
    if (slot === "license") handleFieldChange("licenseFile", "");
    if (slot === "boardCert") handleFieldChange("registrationFile", "");
    if (slot === "nationalId") handleFieldChange("nationalIdFile", "");
  };

  const handleLoadSampleDocs = (e) => {
    if (e) e.preventDefault();
    setUploadedDocs({
      license: {
        name: "medical_practicing_license_2026.pdf",
        size: "1.4 MB",
        type: "application/pdf",
        uploadedAt: "Sample Verified",
        isUploaded: true,
        dataUrl: null,
      },
      boardCert: {
        name: "board_registration_certificate.pdf",
        size: "840 KB",
        type: "application/pdf",
        uploadedAt: "Sample Verified",
        isUploaded: true,
        dataUrl: null,
      },
      nationalId: {
        name: "national_identification_card.pdf",
        size: "450 KB",
        type: "application/pdf",
        uploadedAt: "Sample Verified",
        isUploaded: true,
        dataUrl: null,
      },
    });
    handleFieldChange("licenseFile", "medical_practicing_license_2026.pdf");
    handleFieldChange("registrationFile", "board_registration_certificate.pdf");
    handleFieldChange("nationalIdFile", "national_identification_card.pdf");
  };

  const [formData, setFormData] = useState({
    // Shared
    name: "",
    email: "",
    phone: "",
    countryCode: "+256",
    password: "",
    confirmPassword: "",
    country: "Uganda",
    district: "Kampala",
    city: "",
    address: "",
    digitalSignature: "",

    // Individual Specialist
    specialization: "Dermatologist & Cutaneous Specialist",
    registrationNumber: "",
    licensingAuthority: "Uganda Medical and Dental Practitioners Council (UMDPC)",
    experience: "5",
    qualifications: "MBChB, MMed Dermatology, Fellowship in Cutaneous Surgery",
    hospitalAffiliation: "Yes",
    facilityAffiliatedName: "Mulago National Referral Hospital",
    consultationType: "Both",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    consultationHours: "09:00 AM - 05:00 PM",

    // Clinic / Hospital Facility
    hospitalCategory: "Specialist Dermatology Clinic",
    cmoName: "",
    boardPosition: "Chief Medical Officer",
    adminName: "",
    adminPhone: "",
    bedsCount: "25",
    doctorsCount: "6",
    dermoSpecialists: "3",
    departments: ["Outpatient Dermatology", "Dermatopathology", "Pediatric Skin Care", "Phototherapy Unit"],
    services: ["Clinical Consultation", "Dermoscopy", "Biopsy & Histology", "Cryotherapy", "Teledermatology Triage"],

    // Uploaded Verification Files (Mock official filings)
    licenseFile: "medical_practicing_license_2026.pdf",
    registrationFile: "board_registration_certificate.pdf",
    nationalIdFile: "national_identification_card.pdf",
  });

  const handleFieldChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "name" && !prev.digitalSignature) {
        updated.digitalSignature = value;
      }
      return updated;
    });

    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        if (Object.keys(next).length === 0) {
          setShowErrorNotification(false);
        }
        return next;
      });
    }
  };

  const validateStep2 = () => {
    const errs = {};
    if (!formData.name || !formData.name.trim()) {
      errs.name = tr.errName;
    }
    if (!formData.registrationNumber || !formData.registrationNumber.trim()) {
      errs.registrationNumber = tr.errLicense;
    }
    if (!formData.licensingAuthority || !formData.licensingAuthority.trim()) {
      errs.licensingAuthority = tr.errAuthority;
    }
    if (providerType === "Hospital" && (!formData.cmoName || !formData.cmoName.trim())) {
      errs.cmoName = tr.errCmo;
    }
    // Validate required dynamic fields configured from Admin Portal
    dynamicAdminFields.forEach((f) => {
      if (f.required && (!customFieldValues[f.id] || !String(customFieldValues[f.id]).trim())) {
        errs[f.id] = `${f.label} is required by administration.`;
      }
    });
    return errs;
  };

  const validateStep3 = () => {
    const errs = {};
    if (!formData.email || !formData.email.trim()) {
      errs.email = tr.errEmail;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = tr.errEmail;
    } else if (
      accounts.some(
        (acc) => acc.email.toLowerCase() === formData.email.trim().toLowerCase()
      )
    ) {
      errs.email = "An account with this email is already registered.";
    }
    if (!formData.phone || !formData.phone.trim()) {
      errs.phone = tr.errPhone;
    }
    if (!formData.password) {
      errs.password = tr.errPassword;
    } else if (formData.password.length < 8) {
      errs.password = tr.errPasswordLength;
    }
    if (!formData.confirmPassword) {
      errs.confirmPassword = tr.errConfirmPassword;
    } else if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = tr.errPasswordMatch;
    }
    return errs;
  };

  const validateStep4 = () => {
    const errs = {};
    if (!ethicsAgreed) {
      errs.ethics = tr.errEthics;
    }
    if (!formData.digitalSignature || !formData.digitalSignature.trim()) {
      errs.signature = tr.errSignature;
    }
    return errs;
  };

  const handleNext = (fromStep) => {
    if (fromStep === 1) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (fromStep === 2) {
      const errs = validateStep2();
      if (Object.keys(errs).length > 0) {
        setFormErrors(errs);
        setShowErrorNotification(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setFormErrors({});
      setShowErrorNotification(false);
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (fromStep === 3) {
      const errs = validateStep3();
      if (Object.keys(errs).length > 0) {
        setFormErrors(errs);
        setShowErrorNotification(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setFormErrors({});
      setShowErrorNotification(false);
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmitProviderPaper = (e) => {
    if (e) e.preventDefault();
    const s2 = validateStep2();
    const s3 = validateStep3();
    const s4 = validateStep4();
    const allErrors = { ...s2, ...s3, ...s4 };

    if (Object.keys(allErrors).length > 0) {
      setFormErrors(allErrors);
      setShowErrorNotification(true);
      if (Object.keys(s2).length > 0) setCurrentStep(2);
      else if (Object.keys(s3).length > 0) setCurrentStep(3);
      else setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const random10Digit = Math.floor(1e9 + Math.random() * 9e9).toString();
    const newAccount = {
      id: random10Digit,
      email: formData.email.trim(),
      passwordHash: formData.password,
      role: "specialist",
      status: "Pending", // Needs admin review for verified credentialing
      name: formData.name.trim(),
      phone: `${formData.countryCode} ${formData.phone.trim()}`,
      createdAt: new Date().toISOString(),
      country: formData.country,
      district: formData.district,
      city: formData.city.trim(),
      address:
        formData.address.trim() ||
        `${formData.district}, ${formData.country}`,
      providerType: providerType,
      specialization: formData.specialization,
      registrationNumber: formData.registrationNumber.trim(),
      licensingAuthority: formData.licensingAuthority.trim(),
      experience: `${formData.experience} Years`,
      qualifications: formData.qualifications,
      hospitalName:
        providerType === "Individual"
          ? formData.facilityAffiliatedName || "Derma Care Specialist Clinic"
          : formData.name,
      department:
        formData.departments && formData.departments.length > 0
          ? formData.departments.join(", ")
          : "Dermatology & Skin Surgery",
      position:
        providerType === "Individual"
          ? "Consultant Dermatologist"
          : formData.boardPosition || "Chief Medical Director",
      services: formData.services,
      workingDays: formData.workingDays,
      consultationHours: formData.consultationHours,
      consultationType: formData.consultationType,
      bio: `Board-credentialed healthcare ${providerType.toLowerCase()} certified with ${formData.licensingAuthority}. Specializing in clinical dermatology and cutaneous health triage.`,
      profilePic:
        providerType === "Individual"
          ? defaultSpecialists[0].profilePic
          : "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=300&q=80",
      digitalSignature: formData.digitalSignature.trim(),
      uploadedDocs: {
        license: formData.licenseFile,
        cert: formData.registrationFile,
        idDoc: formData.nationalIdFile,
      },
      customFields: customFieldValues,
      theme: "light",
      fontSize: "md",
      language: activeLang,
      subscription: "free",
    };

    setSubmittedAccount(newAccount);
    if (onRegisterSuccess) {
      onRegisterSuccess(newAccount);
    }
    saveDocument("accounts", newAccount.id, newAccount);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="provider_registration_page"
      className="min-h-screen w-full bg-slate-100 text-slate-800 flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900"
    >
      {/* Top Application Web Page Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo & System Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLogin}
              className="w-10 h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 flex items-center justify-center transition-colors cursor-pointer group"
              title={tr.returnToLogin}
            >
              <span className="material-symbols-outlined text-xl group-hover:-translate-x-0.5 transition-transform">
                arrow_back
              </span>
            </button>
            <div className="flex items-center gap-3.5">
              <div
                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 border border-emerald-300/80 flex items-center justify-center shrink-0 overflow-hidden shadow-md group cursor-pointer transition-all duration-300"
                style={{
                  boxShadow: "0 0 24px rgba(16, 185, 129, 0.6), inset 0 1.5px 2px rgba(255, 255, 255, 0.85)"
                }}
              >
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/40 to-transparent rotate-12 animate-liquid-sheen pointer-events-none" />
                <span className="material-symbols-outlined text-[28px] sm:text-[32px] fill text-white relative z-10 select-none drop-shadow-md">
                  health_and_safety
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-lg sm:text-xl tracking-wider text-slate-900">
                    DERMA CARE
                  </span>
                  <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                    {tr.boardBadge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold tracking-wide">
                  {tr.formSub}
                </p>
              </div>
            </div>
          </div>

          {/* Action Tools: Print & Language & Return */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Selector Dropdown & Quick Buttons */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 gap-1">
              <span className="material-symbols-outlined text-sm text-slate-500 ml-1">
                language
              </span>
              
              {/* Native Dropdown for explicit select interaction */}
              <select
                id="provider_form_language_select"
                aria-label="Language Selector"
                value={activeLang}
                onChange={(e) => handleSelectLanguage(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 py-1 px-1 outline-none cursor-pointer border-r border-slate-300 pr-1 mr-1"
              >
                <option value="en">English (EN)</option>
                <option value="lg">Luganda</option>
                <option value="sw">Kiswahili</option>
                <option value="fr">Français</option>
              </select>

              {/* Fast-switch buttons */}
              <div className="hidden sm:flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectLanguage("en")}
                  className={`px-2 py-1 text-xs font-bold rounded transition-all cursor-pointer ${
                    activeLang === "en"
                      ? "bg-white text-emerald-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLanguage("lg")}
                  className={`px-2 py-1 text-xs font-bold rounded transition-all cursor-pointer ${
                    activeLang === "lg"
                      ? "bg-white text-emerald-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Luganda
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLanguage("sw")}
                  className={`px-2 py-1 text-xs font-bold rounded transition-all cursor-pointer ${
                    activeLang === "sw"
                      ? "bg-white text-emerald-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Swahili
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLanguage("fr")}
                  className={`px-2 py-1 text-xs font-bold rounded transition-all cursor-pointer ${
                    activeLang === "fr"
                      ? "bg-white text-emerald-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Français
                </button>
              </div>
            </div>

            {/* Print Paper Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Print official application paperwork"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              {tr.printPaper}
            </button>

            {/* Back to Login Button */}
            <button
              type="button"
              onClick={onBackToLogin}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              {tr.backToLogin}
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Body: Credentialing Paper Sheet Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {submittedAccount ? (
          /* Submission Completed Receipt / Paper Certificate */
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl p-8 sm:p-12 max-w-3xl mx-auto animate-scale-up text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-emerald-700 via-teal-600 to-blue-700" />
            
            {/* Derma Care Official Emblem */}
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <div
                className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md border border-emerald-300/60"
                style={{
                  boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)"
                }}
              >
                <span className="material-symbols-outlined text-2xl">health_and_safety</span>
              </div>
              <span className="font-display font-black text-xl tracking-wider text-slate-900">DERMA CARE</span>
            </div>

            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <span className="material-symbols-outlined text-4xl">hourglass_top</span>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-block mb-2">
              {tr.reviewBadge}
            </span>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 mb-2">
              {tr.reviewTitle}
            </h1>
            <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6">
              {tr.reviewBio.replace("{name}", submittedAccount.name)}
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-left max-w-md mx-auto space-y-2.5 text-xs font-mono mb-8">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">{tr.summaryEntity}</span>
                <span className="font-bold text-slate-900">{submittedAccount.providerType}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">{tr.summaryPractitioner}</span>
                <span className="font-bold text-slate-900">{submittedAccount.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">{tr.summaryCouncilId}</span>
                <span className="font-bold text-slate-900">{submittedAccount.registrationNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">{tr.summaryLicensingBody}</span>
                <span className="font-bold text-slate-900">{submittedAccount.licensingAuthority}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">{tr.summaryEmail}</span>
                <span className="font-bold text-slate-900">{submittedAccount.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">{tr.summaryStatus}</span>
                <span className="font-bold text-amber-700 uppercase">{tr.statusReview}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs text-left mb-8 space-y-1">
              <strong className="block font-bold">{tr.nextStepTitle}</strong>
              <p>{tr.nextStep1}</p>
              <p>{tr.nextStep2}</p>
              <p>{tr.nextStep3}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">login</span>
                <span>{tr.returnPortalBtn}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>{tr.printApplicationBtn}</span>
              </button>
            </div>
          </div>
        ) : (
          /* THE OFFICIAL HEALTHCARE PROVIDER CREDENTIALING PAPER FORM */
          <div
            id="provider_paper_document"
            className="bg-white rounded-2xl border border-slate-300 shadow-2xl relative overflow-hidden transition-all duration-300"
          >
            {/* Top Paper Header Border / Binding Strip */}
            <div className="h-2.5 bg-gradient-to-r from-emerald-900 via-teal-700 to-blue-900" />

            {/* Document Watermark & Official Board Seal Letterhead */}
            <div className="p-6 sm:p-10 border-b border-slate-200 bg-linear-to-b from-slate-50/80 to-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
                <div className="flex items-center gap-4">
                  {/* Big Derma Care Official Brand Logo on Doctor Credentialing Document */}
                  <div
                    className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-emerald-900 via-emerald-700 to-teal-600 text-white flex flex-col items-center justify-center font-bold shadow-lg shrink-0 border-2 border-emerald-400/50 overflow-hidden"
                    style={{
                      boxShadow: "0 8px 24px rgba(6, 78, 59, 0.35), inset 0 2px 2px rgba(255, 255, 255, 0.5)"
                    }}
                  >
                    <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/30 to-transparent rotate-12 animate-liquid-sheen pointer-events-none" />
                    <span className="material-symbols-outlined text-3xl sm:text-4xl text-white relative z-10 drop-shadow-md">
                      health_and_safety
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-mono tracking-widest font-black uppercase text-emerald-200 mt-0.5 relative z-10">
                      DERMA CARE
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display font-extrabold text-sm sm:text-base tracking-wider text-emerald-900">
                        DERMA CARE MEDICAL REGISTRY
                      </span>
                      <span className="hidden md:inline-block px-2 py-0.5 text-[9px] font-black rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 uppercase tracking-widest">
                        ACCREDITED
                      </span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-black tracking-widest uppercase text-slate-600 block">
                      {tr.boardTitle}
                    </span>
                    <h1 className="font-display font-black text-xl sm:text-2xl text-slate-900 tracking-tight">
                      {tr.formTitle}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">
                      {tr.formSub}
                    </p>
                  </div>
                </div>

                {/* Document Metadata Barcode & Security Strip */}
                <div className="bg-slate-100/90 border border-slate-300 rounded-xl p-3 sm:text-right shrink-0 flex sm:flex-col justify-between items-center sm:items-end">
                  <div className="font-mono text-[10px] text-slate-500 tracking-wider">
                    |||| || ||||| | |||| ||| |||||
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-800">
                    {tr.docBarcode}
                  </div>
                  <div className="text-[9px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
                    {tr.auditBadge}
                  </div>
                </div>
              </div>

              {/* Official Instructions */}
              <div className="mt-4 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-700 text-base shrink-0 mt-0.5">
                  verified_user
                </span>
                <p className="leading-relaxed">
                  <strong>{tr.instructionsTitle}</strong> {tr.instructionsText}
                </p>
              </div>

              {/* Paper Step Navigation Tabs */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`pb-3 px-2 sm:px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentStep === 1
                      ? "border-emerald-800 text-emerald-900 font-black"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="truncate">{tr.step1Tab}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`pb-3 px-2 sm:px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentStep === 2
                      ? "border-emerald-800 text-emerald-900 font-black"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="truncate">{tr.step2Tab}</span>
                  {Object.keys(formErrors).some((k) =>
                    ["name", "registrationNumber", "licensingAuthority", "cmoName"].includes(k)
                  ) && (
                    <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const errs = validateStep2();
                    if (Object.keys(errs).length === 0) setCurrentStep(3);
                    else {
                      setFormErrors(errs);
                      setShowErrorNotification(true);
                    }
                  }}
                  className={`pb-3 px-2 sm:px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentStep === 3
                      ? "border-emerald-800 text-emerald-900 font-black"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="truncate">{tr.step3Tab}</span>
                  {Object.keys(formErrors).some((k) =>
                    ["email", "phone", "password", "confirmPassword"].includes(k)
                  ) && (
                    <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const s2 = validateStep2();
                    const s3 = validateStep3();
                    if (Object.keys(s2).length === 0 && Object.keys(s3).length === 0) {
                      setCurrentStep(4);
                    } else {
                      setFormErrors({ ...s2, ...s3 });
                      setShowErrorNotification(true);
                    }
                  }}
                  className={`pb-3 px-2 sm:px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentStep === 4
                      ? "border-emerald-800 text-emerald-900 font-black"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <span className="truncate">{tr.step4Tab}</span>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {showErrorNotification && Object.keys(formErrors).length > 0 && (
              <div className="mx-6 sm:mx-10 mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 animate-fade-in text-xs">
                <span className="material-symbols-outlined text-red-600 shrink-0 mt-0.5">
                  warning
                </span>
                <div>
                  <strong className="block font-bold mb-1">
                    {tr.errorBannerTitle}
                  </strong>
                  <ul className="list-disc pl-4 space-y-0.5 text-red-700">
                    {Object.values(formErrors).map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* FORM CONTAINER */}
            <form onSubmit={handleSubmitProviderPaper} className="p-6 sm:p-10 space-y-8">
              {/* STEP 1: ENTITY TYPE */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-200 pb-3">
                    <h2 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-800">domain</span>
                      {tr.sectionI_title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tr.sectionI_sub}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                      onClick={() => setProviderType("Individual")}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                        providerType === "Individual"
                          ? "bg-emerald-50/60 border-emerald-700 shadow-md ring-2 ring-emerald-700/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-2xl">
                          <span className="material-symbols-outlined">person_pin</span>
                        </div>
                        {providerType === "Individual" && (
                          <span className="material-symbols-outlined text-emerald-700 font-bold">
                            check_circle
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-base text-slate-900 mb-1">
                        {tr.typeIndividualTitle}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {tr.typeIndividualSub}
                      </p>
                    </div>

                    <div
                      onClick={() => setProviderType("Hospital")}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                        providerType === "Hospital"
                          ? "bg-emerald-50/60 border-emerald-700 shadow-md ring-2 ring-emerald-700/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-2xl">
                          <span className="material-symbols-outlined">domain</span>
                        </div>
                        {providerType === "Hospital" && (
                          <span className="material-symbols-outlined text-emerald-700 font-bold">
                            check_circle
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-base text-slate-900 mb-1">
                        {tr.typeHospitalTitle}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {tr.typeHospitalSub}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 flex items-center justify-between border-t border-slate-200">
                    <button
                      type="button"
                      onClick={onBackToLogin}
                      className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                      {tr.returnToLogin}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNext(1)}
                      className="px-6 py-3 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>{tr.proceedSectionII}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: CREDENTIALS & LICENSING */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-200 pb-3">
                    <h2 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-800">workspace_premium</span>
                      {tr.sectionII_title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tr.sectionII_sub}
                    </p>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {providerType === "Individual" ? tr.doctorNameLabel : tr.facilityNameLabel} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder={providerType === "Individual" ? tr.namePlaceholderDoc : tr.namePlaceholderFac}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all placeholder:text-slate-400 ${
                        formErrors.name
                          ? "bg-red-50/60 border-red-500 text-slate-900 focus:ring-2 focus:ring-red-400/20"
                          : "bg-white border-slate-300 text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                      }`}
                    />
                    {formErrors.name && (
                      <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">error</span>
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  {/* License & Board */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.licenseLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.registrationNumber}
                        onChange={(e) => handleFieldChange("registrationNumber", e.target.value)}
                        placeholder={tr.licensePlaceholder}
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all uppercase placeholder:normal-case placeholder:text-slate-400 ${
                          formErrors.registrationNumber
                            ? "bg-red-50/60 border-red-500 text-slate-900 focus:ring-2 focus:ring-red-400/20"
                            : "bg-white border-slate-300 text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                        }`}
                      />
                      {formErrors.registrationNumber && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">error</span>
                          {formErrors.registrationNumber}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.licensingBodyLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.licensingAuthority}
                        onChange={(e) => handleFieldChange("licensingAuthority", e.target.value)}
                        placeholder={tr.licensingBodyPlaceholder}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none"
                      />
                    </div>
                  </div>

                  {providerType === "Individual" ? (
                    /* Individual Specifics */
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            {tr.specializationLabel}
                          </label>
                          <select
                            value={formData.specialization}
                            onChange={(e) => handleFieldChange("specialization", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none cursor-pointer"
                          >
                            <option value="Dermatologist & Cutaneous Specialist">Dermatologist & Cutaneous Specialist</option>
                            <option value="Pediatric Dermatologist">Pediatric Dermatologist</option>
                            <option value="Dermatopathologist">Dermatopathologist</option>
                            <option value="Cosmetic Dermatologist & Laser Surgeon">Cosmetic Dermatologist & Laser Surgeon</option>
                            <option value="General Practitioner (Skin Triage Trained)">General Practitioner (Skin Triage Trained)</option>
                            <option value="Dermatology Clinical Nurse Specialist">Dermatology Clinical Nurse Specialist</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            {tr.experienceLabel}
                          </label>
                          <select
                            value={formData.experience}
                            onChange={(e) => handleFieldChange("experience", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none cursor-pointer"
                          >
                            <option value="1">1 {tr.experienceYear}</option>
                            <option value="3">3-4 {tr.experienceYears}</option>
                            <option value="5">5-9 {tr.experienceYears}</option>
                            <option value="10">10-15 {tr.experienceYears}</option>
                            <option value="15">15+ {tr.experienceYears}</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          {tr.qualificationsLabel}
                        </label>
                        <input
                          type="text"
                          value={formData.qualifications}
                          onChange={(e) => handleFieldChange("qualifications", e.target.value)}
                          placeholder={tr.qualificationsPlaceholder}
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Facility Specifics */
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            {tr.cmoLabel} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.cmoName}
                            onChange={(e) => handleFieldChange("cmoName", e.target.value)}
                            placeholder={tr.cmoPlaceholder}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none placeholder:text-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            {tr.facilityCategoryLabel}
                          </label>
                          <select
                            value={formData.hospitalCategory}
                            onChange={(e) => handleFieldChange("hospitalCategory", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none cursor-pointer"
                          >
                            <option value="Specialist Dermatology Clinic">Specialist Dermatology Clinic</option>
                            <option value="Private General Hospital">Private General Hospital</option>
                            <option value="National Referral Facility">National Referral Facility</option>
                            <option value="Medical Diagnostic Center">Medical Diagnostic Center</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Administrative & Dynamic Custom Fields from Admin Portal */}
                  {dynamicAdminFields.length > 0 && (
                    <div className="pt-4 border-t border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-800 text-lg">admin_panel_settings</span>
                          <div>
                            <h3 className="font-display font-bold text-sm text-slate-900">
                              Administrative & Practice Custom Requirements
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              Additional criteria configured in the Admin Portal for {providerType} onboarding.
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                          {dynamicAdminFields.length} Custom {dynamicAdminFields.length === 1 ? "Field" : "Fields"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {dynamicAdminFields.map((f) => (
                          <div key={f.id} className={`space-y-1.5 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                              {f.label} {f.required && <span className="text-red-500">*</span>}
                            </label>
                            {f.type === "select" ? (
                              <select
                                value={customFieldValues[f.id] || ""}
                                onChange={(e) => handleCustomFieldChange(f.id, e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                              >
                                <option value="">-- Select {f.label} --</option>
                                {(f.options || ["Option 1", "Option 2"]).map((opt, i) => (
                                  <option key={i} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : f.type === "textarea" ? (
                              <textarea
                                rows={3}
                                value={customFieldValues[f.id] || ""}
                                onChange={(e) => handleCustomFieldChange(f.id, e.target.value)}
                                placeholder={`Enter ${f.label.toLowerCase()}`}
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                              />
                            ) : f.type === "file" ? (
                              <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 text-center">
                                <span className="material-symbols-outlined text-emerald-600 text-lg">upload_file</span>
                                <p className="text-xs font-bold text-slate-700 mt-0.5">{customFieldValues[f.id] || "Click to attach document"}</p>
                                <input
                                  type="file"
                                  className="hidden"
                                  id={`file-custom-${f.id}`}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleCustomFieldChange(f.id, file.name);
                                  }}
                                />
                                <label
                                  htmlFor={`file-custom-${f.id}`}
                                  className="inline-block mt-2 px-3 py-1 bg-white border border-slate-200 text-emerald-700 text-xs font-bold rounded-lg cursor-pointer hover:bg-slate-100"
                                >
                                  {customFieldValues[f.id] ? "Replace File" : "Choose File"}
                                </label>
                              </div>
                            ) : (
                              <input
                                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                                value={customFieldValues[f.id] || ""}
                                onChange={(e) => handleCustomFieldChange(f.id, e.target.value)}
                                placeholder={`Enter ${f.label.toLowerCase()}`}
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                              />
                            )}
                            {formErrors[f.id] && (
                              <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">error</span>
                                {formErrors[f.id]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 flex items-center justify-between border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                      {tr.backToSectionI}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNext(2)}
                      className="px-6 py-3 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>{tr.proceedSectionIII}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: CONTACT & SECURITY */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-200 pb-3">
                    <h2 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-800">lock</span>
                      {tr.sectionIII_title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tr.sectionIII_sub}
                    </p>
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.emailLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => handleFieldChange("email", e.target.value)}
                        placeholder={tr.emailPlaceholder}
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all placeholder:text-slate-400 ${
                          formErrors.email
                            ? "bg-red-50/60 border-red-500 text-slate-900 focus:ring-2 focus:ring-red-400/20"
                            : "bg-white border-slate-300 text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                        }`}
                      />
                      {formErrors.email && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">error</span>
                          {formErrors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.phoneLabel} <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={formData.countryCode}
                          onChange={(e) => handleFieldChange("countryCode", e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-3 text-xs font-bold text-slate-800 outline-none focus:border-emerald-700 shrink-0 cursor-pointer"
                        >
                          <option value="+256">UG +256</option>
                          <option value="+254">KE +254</option>
                          <option value="+255">TZ +255</option>
                          <option value="+250">RW +250</option>
                          <option value="+1">US +1</option>
                          <option value="+44">UK +44</option>
                        </select>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => handleFieldChange("phone", e.target.value)}
                          placeholder={tr.phonePlaceholder}
                          className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all placeholder:text-slate-400 ${
                            formErrors.phone
                              ? "bg-red-50/60 border-red-500 text-slate-900 focus:ring-2 focus:ring-red-400/20"
                              : "bg-white border-slate-300 text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                          }`}
                        />
                      </div>
                      {formErrors.phone && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">error</span>
                          {formErrors.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.districtLabel}
                      </label>
                      <input
                        type="text"
                        value={formData.district}
                        onChange={(e) => handleFieldChange("district", e.target.value)}
                        placeholder={tr.districtPlaceholder}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.addressLabel}
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleFieldChange("address", e.target.value)}
                        placeholder={tr.addressPlaceholder}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Uploaded Verification Documents Proof Strip */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <span className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-emerald-800">attach_file</span>
                        {tr.docsTitle}
                      </span>
                      <button
                        type="button"
                        onClick={handleLoadSampleDocs}
                        className="normal-case text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                        title="Load official demo documents for fast testing"
                      >
                        <span className="material-symbols-outlined text-xs">auto_fix_high</span>
                        <span>Use Sample Documents</span>
                      </button>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* 1: Practicing License Upload Box (Selector 1) */}
                      <div
                        id="upload_box_license"
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragActiveSlot("license");
                        }}
                        onDragLeave={() => setDragActiveSlot(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActiveSlot(null);
                          if (e.dataTransfer.files?.[0]) {
                            handleFileUpload("license", e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => {
                          if (!uploadedDocs.license) {
                            licenseInputRef.current?.click();
                          }
                        }}
                        className={`relative rounded-xl transition-all ${
                          uploadedDocs.license
                            ? "p-3.5 bg-emerald-50/70 border border-emerald-300 shadow-xs flex flex-col justify-between"
                            : `p-4 border-2 border-dashed ${
                                dragActiveSlot === "license"
                                  ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20"
                                  : "border-slate-300 bg-white hover:border-emerald-600 hover:bg-slate-50/80"
                              } cursor-pointer flex flex-col items-center justify-center text-center group`
                        }`}
                      >
                        <input
                          type="file"
                          ref={licenseInputRef}
                          className="hidden"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileUpload("license", e.target.files[0]);
                            }
                          }}
                        />

                        {uploadedDocs.license ? (
                          <div className="w-full flex flex-col justify-between h-full">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-lg">description</span>
                                </div>
                                <div className="overflow-hidden">
                                  <span className="block text-xs font-bold text-slate-900 truncate">
                                    {tr.docLicense}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {uploadedDocs.license.size}
                                  </span>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                <span className="hidden xs:inline">{tr.docUploaded || "Uploaded"}</span>
                              </span>
                            </div>

                            <div className="bg-white/90 border border-emerald-200 rounded-lg p-2 my-1 text-xs font-mono text-emerald-950 font-medium truncate flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-emerald-700 shrink-0">file_present</span>
                              <span className="truncate">{uploadedDocs.license.name}</span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 mt-1 text-[11px]">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  licenseInputRef.current?.click();
                                }}
                                className="font-bold text-emerald-800 hover:text-emerald-950 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">sync</span>
                                {tr.replaceDoc || "Replace"}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveDoc("license", e)}
                                className="font-bold text-red-600 hover:text-red-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">delete</span>
                                {tr.removeDoc || "Remove"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800 flex items-center justify-center transition-colors mb-2">
                              <span className="material-symbols-outlined text-xl">upload_file</span>
                            </div>
                            <span className="block text-xs font-bold text-slate-800">
                              {tr.docLicense} <span className="text-red-500">*</span>
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                              {tr.clickToUpload}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {tr.fileFormatHint}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                licenseInputRef.current?.click();
                              }}
                              className="mt-2.5 px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">cloud_upload</span>
                              {tr.uploadFileBtn}
                            </button>
                          </>
                        )}
                      </div>

                      {/* 2: Board Certificate Upload Box (Selector 2) */}
                      <div
                        id="upload_box_council_cert"
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragActiveSlot("boardCert");
                        }}
                        onDragLeave={() => setDragActiveSlot(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActiveSlot(null);
                          if (e.dataTransfer.files?.[0]) {
                            handleFileUpload("boardCert", e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => {
                          if (!uploadedDocs.boardCert) {
                            boardCertInputRef.current?.click();
                          }
                        }}
                        className={`relative rounded-xl transition-all ${
                          uploadedDocs.boardCert
                            ? "p-3.5 bg-emerald-50/70 border border-emerald-300 shadow-xs flex flex-col justify-between"
                            : `p-4 border-2 border-dashed ${
                                dragActiveSlot === "boardCert"
                                  ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20"
                                  : "border-slate-300 bg-white hover:border-emerald-600 hover:bg-slate-50/80"
                              } cursor-pointer flex flex-col items-center justify-center text-center group`
                        }`}
                      >
                        <input
                          type="file"
                          ref={boardCertInputRef}
                          className="hidden"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileUpload("boardCert", e.target.files[0]);
                            }
                          }}
                        />

                        {uploadedDocs.boardCert ? (
                          <div className="w-full flex flex-col justify-between h-full">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-lg">verified</span>
                                </div>
                                <div className="overflow-hidden">
                                  <span className="block text-xs font-bold text-slate-900 truncate">
                                    {tr.docBoardCert}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {uploadedDocs.boardCert.size}
                                  </span>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                <span className="hidden xs:inline">{tr.docUploaded || "Uploaded"}</span>
                              </span>
                            </div>

                            <div className="bg-white/90 border border-emerald-200 rounded-lg p-2 my-1 text-xs font-mono text-emerald-950 font-medium truncate flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-emerald-700 shrink-0">file_present</span>
                              <span className="truncate">{uploadedDocs.boardCert.name}</span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 mt-1 text-[11px]">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  boardCertInputRef.current?.click();
                                }}
                                className="font-bold text-emerald-800 hover:text-emerald-950 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">sync</span>
                                {tr.replaceDoc || "Replace"}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveDoc("boardCert", e)}
                                className="font-bold text-red-600 hover:text-red-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">delete</span>
                                {tr.removeDoc || "Remove"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800 flex items-center justify-center transition-colors mb-2">
                              <span className="material-symbols-outlined text-xl">verified</span>
                            </div>
                            <span className="block text-xs font-bold text-slate-800">
                              {tr.docBoardCert} <span className="text-red-500">*</span>
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                              {tr.clickToUpload}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {tr.fileFormatHint}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                boardCertInputRef.current?.click();
                              }}
                              className="mt-2.5 px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">cloud_upload</span>
                              {tr.uploadFileBtn}
                            </button>
                          </>
                        )}
                      </div>

                      {/* 3: National ID Upload Box (Selector 3) */}
                      <div
                        id="upload_box_national_id"
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragActiveSlot("nationalId");
                        }}
                        onDragLeave={() => setDragActiveSlot(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActiveSlot(null);
                          if (e.dataTransfer.files?.[0]) {
                            handleFileUpload("nationalId", e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => {
                          if (!uploadedDocs.nationalId) {
                            nationalIdInputRef.current?.click();
                          }
                        }}
                        className={`relative rounded-xl transition-all ${
                          uploadedDocs.nationalId
                            ? "p-3.5 bg-emerald-50/70 border border-emerald-300 shadow-xs flex flex-col justify-between"
                            : `p-4 border-2 border-dashed ${
                                dragActiveSlot === "nationalId"
                                  ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20"
                                  : "border-slate-300 bg-white hover:border-emerald-600 hover:bg-slate-50/80"
                              } cursor-pointer flex flex-col items-center justify-center text-center group`
                        }`}
                      >
                        <input
                          type="file"
                          ref={nationalIdInputRef}
                          className="hidden"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileUpload("nationalId", e.target.files[0]);
                            }
                          }}
                        />

                        {uploadedDocs.nationalId ? (
                          <div className="w-full flex flex-col justify-between h-full">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-lg">badge</span>
                                </div>
                                <div className="overflow-hidden">
                                  <span className="block text-xs font-bold text-slate-900 truncate">
                                    {tr.docId}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {uploadedDocs.nationalId.size}
                                  </span>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                <span className="hidden xs:inline">{tr.docUploaded || "Uploaded"}</span>
                              </span>
                            </div>

                            <div className="bg-white/90 border border-emerald-200 rounded-lg p-2 my-1 text-xs font-mono text-emerald-950 font-medium truncate flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-emerald-700 shrink-0">file_present</span>
                              <span className="truncate">{uploadedDocs.nationalId.name}</span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 mt-1 text-[11px]">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  nationalIdInputRef.current?.click();
                                }}
                                className="font-bold text-emerald-800 hover:text-emerald-950 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">sync</span>
                                {tr.replaceDoc || "Replace"}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveDoc("nationalId", e)}
                                className="font-bold text-red-600 hover:text-red-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">delete</span>
                                {tr.removeDoc || "Remove"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800 flex items-center justify-center transition-colors mb-2">
                              <span className="material-symbols-outlined text-xl">badge</span>
                            </div>
                            <span className="block text-xs font-bold text-slate-800">
                              {tr.docId} <span className="text-red-500">*</span>
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                              {tr.clickToUpload}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {tr.fileFormatHint}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                nationalIdInputRef.current?.click();
                              }}
                              className="mt-2.5 px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">cloud_upload</span>
                              {tr.uploadFileBtn}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Passwords */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.passwordLabel} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={formData.password}
                          onChange={(e) => handleFieldChange("password", e.target.value)}
                          placeholder={tr.passwordPlaceholder}
                          className={`w-full pl-4 pr-11 py-3 rounded-xl border text-sm font-medium outline-none transition-all placeholder:text-slate-400 ${
                            formErrors.password
                              ? "bg-red-50/60 border-red-500 text-slate-900 focus:ring-2 focus:ring-red-400/20"
                              : "bg-white border-slate-300 text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {showPassword ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                      {formErrors.password && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">error</span>
                          {formErrors.password}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.confirmPasswordLabel} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          value={formData.confirmPassword}
                          onChange={(e) => handleFieldChange("confirmPassword", e.target.value)}
                          placeholder={tr.confirmPasswordPlaceholder}
                          className={`w-full pl-4 pr-11 py-3 rounded-xl border text-sm font-medium outline-none transition-all placeholder:text-slate-400 ${
                            formErrors.confirmPassword
                              ? "bg-red-50/60 border-red-500 text-slate-900 focus:ring-2 focus:ring-red-400/20"
                              : "bg-white border-slate-300 text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {showConfirmPassword ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                      {formErrors.confirmPassword && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">error</span>
                          {formErrors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 flex items-center justify-between border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                      {tr.backToSectionII}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNext(3)}
                      className="px-6 py-3 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>{tr.proceedSectionIV}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & ATTESTATION */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-200 pb-3">
                    <h2 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-800">fact_check</span>
                      {tr.sectionIV_title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tr.sectionIV_sub}
                    </p>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-slate-50 border border-slate-300 rounded-xl p-6 text-xs font-mono space-y-3">
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500 font-sans">{tr.summaryCategory}</span>
                      <span className="font-bold text-slate-900">{providerType}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500 font-sans">{tr.summaryName}</span>
                      <span className="font-bold text-slate-900">{formData.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500 font-sans">{tr.summaryLicense}</span>
                      <span className="font-bold text-slate-900">{formData.registrationNumber}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500 font-sans">{tr.summaryAuthority}</span>
                      <span className="font-bold text-slate-900">{formData.licensingAuthority}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500 font-sans">{tr.summaryEmail}</span>
                      <span className="font-bold text-slate-900">{formData.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">{tr.summarySpecialization}</span>
                      <span className="font-bold text-slate-900">{formData.specialization}</span>
                    </div>

                    {dynamicAdminFields.length > 0 && Object.keys(customFieldValues).length > 0 && (
                      <div className="pt-2 border-t border-slate-200 flex flex-col gap-1.5">
                        <span className="text-slate-500 font-sans block text-[10px] uppercase tracking-wider font-semibold">
                          Administrative Custom Criteria:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {dynamicAdminFields.map((f) => (
                            <div key={f.id} className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-slate-400 block text-[9px] uppercase font-bold">{f.label}:</span>
                              <span className="font-bold text-slate-800">{customFieldValues[f.id] || "—"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex flex-col gap-1">
                      <span className="text-slate-500 font-sans block text-[10px] uppercase tracking-wider font-semibold">
                        Attached Verification Documents:
                      </span>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <span className="px-2 py-1 rounded-md bg-emerald-100/90 text-emerald-900 font-bold text-[10px] flex items-center gap-1 border border-emerald-200">
                          <span className="material-symbols-outlined text-xs text-emerald-700">description</span>
                          <span className="truncate max-w-[140px]">{uploadedDocs.license?.name || formData.licenseFile || "License (Pending)"}</span>
                        </span>
                        <span className="px-2 py-1 rounded-md bg-emerald-100/90 text-emerald-900 font-bold text-[10px] flex items-center gap-1 border border-emerald-200">
                          <span className="material-symbols-outlined text-xs text-emerald-700">verified</span>
                          <span className="truncate max-w-[140px]">{uploadedDocs.boardCert?.name || formData.registrationFile || "Council Cert (Pending)"}</span>
                        </span>
                        <span className="px-2 py-1 rounded-md bg-emerald-100/90 text-emerald-900 font-bold text-[10px] flex items-center gap-1 border border-emerald-200">
                          <span className="material-symbols-outlined text-xs text-emerald-700">badge</span>
                          <span className="truncate max-w-[140px]">{uploadedDocs.nationalId?.name || formData.nationalIdFile || "National ID (Pending)"}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Professional Attestation Document Box */}
                  <div className="border-2 border-slate-300 rounded-2xl p-5 sm:p-6 bg-slate-50/70 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-emerald-800">gavel</span>
                        {tr.attestationHeader}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {tr.attestationDate}: {new Date().toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-serif">
                      {tr.attestationQuote}
                    </p>

                    {/* Checkbox */}
                    <div className="pt-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ethicsAgreed}
                          onChange={(e) => {
                            setEthicsAgreed(e.target.checked);
                            if (formErrors.ethics) {
                              setFormErrors((prev) => {
                                const next = { ...prev };
                                delete next.ethics;
                                return next;
                              });
                            }
                          }}
                          className="w-5 h-5 rounded border-slate-300 text-emerald-900 focus:ring-emerald-700 mt-0.5 cursor-pointer"
                        />
                        <span className="text-xs text-slate-800 font-semibold leading-relaxed">
                          {tr.ethicsAgreeText} <span className="text-red-500">*</span>
                        </span>
                      </label>
                      {formErrors.ethics && (
                        <p className="text-xs text-red-600 font-semibold mt-1 pl-8 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">error</span>
                          {formErrors.ethics}
                        </p>
                      )}
                    </div>

                    {/* Signature */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          {tr.signatureLabel} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.digitalSignature}
                          onChange={(e) => handleFieldChange("digitalSignature", e.target.value)}
                          placeholder={tr.signaturePlaceholder}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none"
                        />
                        {formErrors.signature && (
                          <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">error</span>
                            {formErrors.signature}
                          </p>
                        )}
                      </div>

                      {/* Visual Signature Card */}
                      <div className="bg-white border border-slate-300 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                          {tr.signaturePreview}
                        </span>
                        <div className="font-serif italic text-lg sm:text-xl text-emerald-950 font-bold tracking-wide py-1 border-b border-dashed border-slate-300">
                          {formData.digitalSignature || "Doctor Signature Preview"}
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1 font-mono">
                          <span>{tr.signatureTimestamp}: {new Date().toLocaleTimeString()}</span>
                          <span className="text-teal-700 font-bold flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">verified</span>
                            {tr.signatureValidated}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submission Action Bar */}
                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                      {tr.backToSectionIII}
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="px-4 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">print</span>
                        {tr.printPaper}
                      </button>
                      <button
                        type="submit"
                        className="flex-1 sm:flex-initial px-8 py-3.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                        <span>{tr.submitProviderPaperwork}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Official Document Footnote */}
            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
              <div>
                DERMA CARE MEDICAL REGISTRY • PROVIDER REGISTRATION CONTROL #DC-PRV-2026-BOARD
              </div>
              <div className="flex items-center gap-3">
                <span>LICENSURE VERIFICATION PORTAL</span>
                <span>•</span>
                <span>DATA INTEGRITY VERIFIED</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Page Footer */}
      <footer className="mt-8 py-6 border-t border-slate-200 bg-white/80 text-center text-xs text-slate-500 print:hidden">
        <p>© 2026 Derma Care Clinical Network. All rights reserved. Registered medical data protected under international tele-health regulations.</p>
      </footer>
    </div>
  );
}
