import React, { useState, useEffect } from "react";
import { translations } from "../data";
import { patientPaperTranslations } from "../registrationTranslations";
import { saveDocument } from "../services/firebaseSync";

export default function PatientRegistrationPaper({
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
  const tr = patientPaperTranslations[activeLang] || patientPaperTranslations.en;

  const handleSelectLanguage = (lang) => {
    setLocalLang(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
  };

  // Find Patient template configured from Admin Portal
  const patientTemplate = formTemplates?.find(
    (t) => t.providerType === "Patient" || t.id === "TMPL-PATIENT"
  );

  const standardPatientFieldIds = [
    "pat-name", "pat-email", "pat-phone", "pat-dob", "pat-gender",
    "pat-nationality", "pat-nin", "pat-country", "pat-district",
    "pat-address", "pat-emergency", "pat-concern", "pat-allergies",
    "pat-password", "pat-signature"
  ];

  const dynamicAdminFields = (patientTemplate?.fields || []).filter(
    (f) => !standardPatientFieldIds.includes(f.id)
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [formErrors, setFormErrors] = useState({});
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    countryCode: "+256",
    phone: "",
    dob: "",
    gender: "Male",
    nationality: "Uganda",
    nationalId: "",
    country: "Uganda",
    district: "Kampala",
    city: "",
    address: "",
    emergencyContact: "",
    primarySkinConcern: "General Rash / Irritation",
    knownAllergies: "None",
    password: "",
    confirmPassword: "",
    digitalSignature: "",
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

  const validateStep1 = () => {
    const errs = {};
    if (!formData.name || !formData.name.trim()) {
      errs.name = tr.errName;
    }
    if (!formData.email || !formData.email.trim()) {
      errs.email = tr.errEmail;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = tr.errEmailInvalid;
    } else if (
      accounts.some(
        (acc) => acc.email.toLowerCase() === formData.email.trim().toLowerCase()
      )
    ) {
      errs.email = tr.errEmailExists;
    }
    if (!formData.phone || !formData.phone.trim()) {
      errs.phone = tr.errPhone;
    }
    if (!formData.dob) {
      errs.dob = tr.errDob;
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

  const validateStep2 = () => {
    const errs = {};
    if (!formData.country || !formData.country.trim()) {
      errs.country = tr.errCountry;
    }
    if (!formData.district || !formData.district.trim()) {
      errs.district = tr.errDistrict;
    }
    if (!formData.city || !formData.city.trim()) {
      errs.city = tr.errCity;
    }
    // Validate any custom fields configured by admin that are marked required
    dynamicAdminFields.forEach((f) => {
      if (f.required && (!customFieldValues[f.id] || !String(customFieldValues[f.id]).trim())) {
        errs[f.id] = `${f.label} is required by administration.`;
      }
    });
    return errs;
  };

  const validateStep3 = () => {
    const errs = {};
    if (!termsAgreed) {
      errs.terms = tr.errTerms;
    }
    if (!formData.digitalSignature || !formData.digitalSignature.trim()) {
      errs.signature = tr.errSignature;
    }
    return errs;
  };

  const handleNextStep = (step) => {
    if (step === 1) {
      const errs = validateStep1();
      if (Object.keys(errs).length > 0) {
        setFormErrors(errs);
        setShowErrorNotification(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setFormErrors({});
      setShowErrorNotification(false);
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (step === 2) {
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
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSubmitPaper = (e) => {
    e.preventDefault();
    const errs1 = validateStep1();
    const errs2 = validateStep2();
    const errs3 = validateStep3();
    const allErrors = { ...errs1, ...errs2, ...errs3 };

    if (Object.keys(allErrors).length > 0) {
      setFormErrors(allErrors);
      setShowErrorNotification(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const uniquePatientId = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    const newAccount = {
      id: uniquePatientId,
      email: formData.email.trim(),
      passwordHash: formData.password,
      role: "patient",
      status: "Approved",
      name: formData.name.trim(),
      phone: `${formData.countryCode} ${formData.phone.trim()}`,
      dob: formData.dob,
      gender: formData.gender,
      nationality: formData.nationality,
      nationalId: formData.nationalId.trim(),
      country: formData.country,
      district: formData.district,
      city: formData.city.trim(),
      address: formData.address.trim(),
      emergencyContact: formData.emergencyContact.trim(),
      primarySkinConcern: formData.primarySkinConcern,
      knownAllergies: formData.knownAllergies.trim(),
      digitalSignature: formData.digitalSignature.trim(),
      customFields: customFieldValues,
      theme: "light",
      fontSize: "md",
      language: activeLang,
      subscription: "free",
      createdAt: new Date().toISOString(),
    };

    setSubmittedAccount(newAccount);
    if (onRegisterSuccess) {
      onRegisterSuccess(newAccount);
    }
    saveDocument("accounts", newAccount.id, newAccount);
  };

  return (
    <div
      id="patient_registration_page"
      className="min-h-screen w-full bg-slate-100 text-slate-800 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900"
    >
      {/* Top Application Web Page Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo & System Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLogin}
              className="w-10 h-10 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 flex items-center justify-center transition-colors cursor-pointer group"
              title={tr.returnToLogin}
            >
              <span className="material-symbols-outlined text-xl group-hover:-translate-x-0.5 transition-transform">
                arrow_back
              </span>
            </button>
            <div className="flex items-center gap-3.5">
              <div
                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-500 border border-blue-300/80 flex items-center justify-center shrink-0 overflow-hidden shadow-md group cursor-pointer transition-all duration-300"
                style={{
                  boxShadow: "0 0 24px rgba(37, 99, 235, 0.6), inset 0 1.5px 2px rgba(255, 255, 255, 0.85)"
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
                  <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wide">
                    EHR Portal
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
                id="patient_form_language_select"
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
                      ? "bg-white text-blue-900 shadow-xs"
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
                      ? "bg-white text-blue-900 shadow-xs"
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
                      ? "bg-white text-blue-900 shadow-xs"
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
                      ? "bg-white text-blue-900 shadow-xs"
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
              title="Print official paperwork"
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

      {/* Main Page Body: Paper Sheet Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {submittedAccount ? (
          /* Submission Completed Receipt / Paper Certificate */
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl p-8 sm:p-12 max-w-3xl mx-auto animate-scale-up text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-blue-700 via-indigo-600 to-emerald-600" />
            
            {/* Derma Care Official Emblem */}
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <div
                className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md border border-blue-300/60"
                style={{
                  boxShadow: "0 0 20px rgba(37, 99, 235, 0.4)"
                }}
              >
                <span className="material-symbols-outlined text-2xl">health_and_safety</span>
              </div>
              <span className="font-display font-black text-xl tracking-wider text-slate-900">DERMA CARE</span>
            </div>

            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <span className="material-symbols-outlined text-4xl">verified</span>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block mb-2">
              {tr.registeredBadge}{submittedAccount.id}
            </span>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 mb-2">
              {tr.filedTitle}
            </h1>
            <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6">
              {tr.filedBio.replace("{name}", submittedAccount.name)}
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-left max-w-md mx-auto space-y-2.5 text-xs font-mono mb-8">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">{tr.summaryName}</span>
                <span className="font-bold text-slate-900">{submittedAccount.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">{tr.summaryEmail}</span>
                <span className="font-bold text-slate-900">{submittedAccount.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">{tr.summaryPhone}</span>
                <span className="font-bold text-slate-900">{submittedAccount.phone}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">{tr.summaryDistrict}</span>
                <span className="font-bold text-slate-900">{submittedAccount.district}, {submittedAccount.country}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">{tr.summarySignature}</span>
                <span className="font-bold text-blue-900 font-serif italic text-sm">{submittedAccount.digitalSignature}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onRegisterSuccess && onRegisterSuccess(submittedAccount)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{tr.enterPortalBtn}</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>{tr.printReceiptBtn}</span>
              </button>
            </div>
          </div>
        ) : (
          /* THE OFFICIAL MEDICAL REGISTRATION PAPER FORM */
          <div
            id="medical_paper_document"
            className="bg-white rounded-2xl border border-slate-300 shadow-2xl relative overflow-hidden transition-all duration-300"
          >
            {/* Top Paper Header Border / Binding Strip */}
            <div className="h-2.5 bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-900" />

            {/* Document Watermark & Official Seal Letterhead */}
            <div className="p-6 sm:p-10 border-b border-slate-200 bg-linear-to-b from-slate-50/80 to-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
                <div className="flex items-center gap-4">
                  {/* Big Derma Care Official Brand Logo on Medical Intake Paper Document */}
                  <div
                    className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-blue-900 via-blue-700 to-indigo-600 text-white flex flex-col items-center justify-center font-bold shadow-lg shrink-0 border-2 border-blue-400/50 overflow-hidden"
                    style={{
                      boxShadow: "0 8px 24px rgba(30, 58, 138, 0.35), inset 0 2px 2px rgba(255, 255, 255, 0.5)"
                    }}
                  >
                    <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/30 to-transparent rotate-12 animate-liquid-sheen pointer-events-none" />
                    <span className="material-symbols-outlined text-3xl sm:text-4xl text-white relative z-10 drop-shadow-md">
                      health_and_safety
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-mono tracking-widest font-black uppercase text-blue-200 mt-0.5 relative z-10">
                      DERMA CARE
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display font-extrabold text-sm sm:text-base tracking-wider text-blue-900">
                        DERMA CARE CLINICAL ALLIANCE
                      </span>
                      <span className="hidden md:inline-block px-2 py-0.5 text-[9px] font-black rounded-md bg-blue-100 text-blue-900 border border-blue-200 uppercase tracking-widest">
                        OFFICIAL EHR
                      </span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-black tracking-widest uppercase text-slate-600 block">
                      {tr.republicHeader}
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
                    ||| | ||||| || |||| ||||| | ||
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-800">
                    {tr.docBarcode}
                  </div>
                  <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    {tr.securedBadge}
                  </div>
                </div>
              </div>

              {/* Official Instructions & Notice */}
              <div className="mt-4 p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-950 text-xs flex items-start gap-2.5">
                <span className="material-symbols-outlined text-blue-700 text-base shrink-0 mt-0.5">
                  description
                </span>
                <p className="leading-relaxed">
                  <strong>{tr.instructionsTitle}</strong> {tr.instructionsText}
                </p>
              </div>

              {/* Paper Section Navigation Tabs */}
              <div className="mt-6 flex flex-wrap sm:flex-nowrap border-b border-slate-200 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`pb-3 px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                    currentStep === 1
                      ? "border-blue-900 text-blue-900 font-black"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>{tr.step1Tab}</span>
                  {Object.keys(formErrors).some((k) =>
                    ["name", "email", "phone", "dob", "password", "confirmPassword"].includes(k)
                  ) && (
                    <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const errs = validateStep1();
                    if (Object.keys(errs).length === 0) setCurrentStep(2);
                    else {
                      setFormErrors(errs);
                      setShowErrorNotification(true);
                    }
                  }}
                  className={`pb-3 px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                    currentStep === 2
                      ? "border-blue-900 text-blue-900 font-black"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>{tr.step2Tab}</span>
                  {Object.keys(formErrors).some((k) =>
                    ["country", "district", "city"].includes(k)
                  ) && (
                    <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const errs = validateStep1();
                    if (Object.keys(errs).length === 0) setCurrentStep(3);
                    else {
                      setFormErrors(errs);
                      setShowErrorNotification(true);
                    }
                  }}
                  className={`pb-3 px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                    currentStep === 3
                      ? "border-blue-900 text-blue-900 font-black"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>{tr.step3Tab}</span>
                  {formErrors.terms && (
                    <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Notification Alert */}
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

            {/* FORM BODY CONTAINER */}
            <form onSubmit={handleSubmitPaper} className="p-6 sm:p-10 space-y-8">
              {/* SECTION 1: PERSONAL IDENTIFICATION */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-200 pb-3">
                    <h2 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-800">badge</span>
                      {tr.sectionI_title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tr.sectionI_sub}
                    </p>
                  </div>

                  {/* Legal Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {tr.fullNameLabel} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder={tr.fullNamePlaceholder}
                      className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all placeholder:text-slate-400 ${
                        formErrors.name
                          ? "bg-red-50/60 border-red-500 text-slate-900 focus:ring-2 focus:ring-red-400/20"
                          : "bg-white border-slate-300 text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                      }`}
                    />
                    {formErrors.name && (
                      <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">error</span>
                        {formErrors.name}
                      </p>
                    )}
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
                            : "bg-white border-slate-300 text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
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
                          className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-700 shrink-0 cursor-pointer"
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
                              : "bg-white border-slate-300 text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
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

                  {/* DOB, Gender & Nationality */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.dobLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.dob}
                        onChange={(e) => handleFieldChange("dob", e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all ${
                          formErrors.dob
                            ? "bg-red-50/60 border-red-500 text-slate-900 focus:ring-2 focus:ring-red-400/20"
                            : "bg-white border-slate-300 text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                        }`}
                      />
                      {formErrors.dob && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">error</span>
                          {formErrors.dob}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.genderLabel} <span className="text-red-500">*</span>
                      </label>
                      <div className="flex border border-slate-300 rounded-xl p-1 bg-slate-50 h-[46px]">
                        <button
                          type="button"
                          onClick={() => handleFieldChange("gender", "Male")}
                          className={`flex-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            formData.gender === "Male"
                              ? "bg-white text-blue-900 shadow-xs border border-slate-200"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {tr.genderMale}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFieldChange("gender", "Female")}
                          className={`flex-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            formData.gender === "Female"
                              ? "bg-white text-blue-900 shadow-xs border border-slate-200"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {tr.genderFemale}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.nationalIdLabel}
                      </label>
                      <input
                        type="text"
                        value={formData.nationalId}
                        onChange={(e) => handleFieldChange("nationalId", e.target.value)}
                        placeholder={tr.nationalIdPlaceholder}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-none uppercase placeholder:normal-case placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Password & Confirm Password */}
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
                              : "bg-white border-slate-300 text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
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
                              : "bg-white border-slate-300 text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
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

                  {/* Step 1 Actions */}
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
                      onClick={() => handleNextStep(1)}
                      className="px-6 py-3 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>{tr.proceedSectionII}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION 2: LOCATION & DEMOGRAPHICS */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-200 pb-3">
                    <h2 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-800">location_on</span>
                      {tr.sectionII_title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tr.sectionII_sub}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.countryLabel} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.country}
                        onChange={(e) => handleFieldChange("country", e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-none cursor-pointer"
                      >
                        <option value="Uganda">Uganda</option>
                        <option value="Kenya">Kenya</option>
                        <option value="Tanzania">Tanzania</option>
                        <option value="Rwanda">Rwanda</option>
                        <option value="Democratic Republic of Congo">DR Congo</option>
                        <option value="Other">Other Region</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.districtLabel} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.district}
                        onChange={(e) => handleFieldChange("district", e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-none cursor-pointer"
                      >
                        <option value="Kampala">Kampala</option>
                        <option value="Wakiso">Wakiso</option>
                        <option value="Mukono">Mukono</option>
                        <option value="Jinja">Jinja</option>
                        <option value="Mbarara">Mbarara</option>
                        <option value="Gulu">Gulu</option>
                        <option value="Mbale">Mbale</option>
                        <option value="Entebbe">Entebbe</option>
                        <option value="Nairobi">Nairobi</option>
                        <option value="Dar es Salaam">Dar es Salaam</option>
                        <option value="Kigali">Kigali</option>
                        <option value="Other">Other District</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.cityLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => handleFieldChange("city", e.target.value)}
                        placeholder={tr.cityPlaceholder}
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all placeholder:text-slate-400 ${
                          formErrors.city
                            ? "bg-red-50/60 border-red-500 text-slate-900 focus:ring-2 focus:ring-red-400/20"
                            : "bg-white border-slate-300 text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                        }`}
                      />
                      {formErrors.city && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">error</span>
                          {formErrors.city}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.emergencyContactLabel}
                      </label>
                      <input
                        type="tel"
                        value={formData.emergencyContact}
                        onChange={(e) => handleFieldChange("emergencyContact", e.target.value)}
                        placeholder={tr.emergencyContactPlaceholder}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {tr.addressLabel}
                    </label>
                    <textarea
                      rows={2}
                      value={formData.address}
                      onChange={(e) => handleFieldChange("address", e.target.value)}
                      placeholder={tr.addressPlaceholder}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-none placeholder:text-slate-400"
                    />
                  </div>

                  {/* Administrative & Dynamic Custom Fields from Admin Portal */}
                  {dynamicAdminFields.length > 0 && (
                    <div className="pt-4 border-t border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-blue-800 text-lg">admin_panel_settings</span>
                          <div>
                            <h3 className="font-display font-bold text-sm text-slate-900">
                              Administrative & Clinical Custom Requirements
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              Additional intake criteria configured in the Admin Portal.
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
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
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
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
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                              />
                            ) : f.type === "file" ? (
                              <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 text-center">
                                <span className="material-symbols-outlined text-blue-600 text-lg">upload_file</span>
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
                                  className="inline-block mt-2 px-3 py-1 bg-white border border-slate-200 text-blue-700 text-xs font-bold rounded-lg cursor-pointer hover:bg-slate-100"
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
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
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

                  {/* Step 2 Actions */}
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
                      onClick={() => handleNextStep(2)}
                      className="px-6 py-3 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>{tr.proceedSectionIII}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION 3: CLINICAL BASELINE, CONSENT & SIGNATURE */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-200 pb-3">
                    <h2 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-800">draw</span>
                      {tr.sectionIII_title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tr.sectionIII_sub}
                    </p>
                  </div>

                  {/* Primary Skin Concern & Allergies */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.primarySkinConcernLabel}
                      </label>
                      <select
                        value={formData.primarySkinConcern}
                        onChange={(e) => handleFieldChange("primarySkinConcern", e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-none cursor-pointer"
                      >
                        <option value="General Rash / Irritation">General Rash / Irritation</option>
                        <option value="Atopic Dermatitis / Eczema">Atopic Dermatitis / Eczema</option>
                        <option value="Acne Vulgaris / Facial Blemishes">Acne Vulgaris / Facial Blemishes</option>
                        <option value="Psoriasis / Dry Scaling Patches">Psoriasis / Dry Scaling Patches</option>
                        <option value="Hyperpigmentation & Dark Spots">Hyperpigmentation & Dark Spots</option>
                        <option value="Fungal Infection / Ringworm">Fungal Infection / Ringworm</option>
                        <option value="Suspicious Mole or Lesion">Suspicious Mole or Lesion</option>
                        <option value="Routine Preventive Skin Health Check">Routine Preventive Skin Health Check</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        {tr.knownAllergiesLabel}
                      </label>
                      <input
                        type="text"
                        value={formData.knownAllergies}
                        onChange={(e) => handleFieldChange("knownAllergies", e.target.value)}
                        placeholder={tr.knownAllergiesPlaceholder}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Official Attestation & Digital Signature Document Box */}
                  <div className="border-2 border-slate-300 rounded-2xl p-5 sm:p-6 bg-slate-50/70 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-blue-800">gavel</span>
                        {tr.attestationHeader}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {tr.attestationDate}: {new Date().toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-serif">
                      {tr.attestationQuote}
                    </p>

                    {/* Terms Checkbox */}
                    <div className="pt-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={termsAgreed}
                          onChange={(e) => {
                            setTermsAgreed(e.target.checked);
                            if (formErrors.terms) {
                              setFormErrors((prev) => {
                                const next = { ...prev };
                                delete next.terms;
                                return next;
                              });
                            }
                          }}
                          className="w-5 h-5 rounded border-slate-300 text-blue-900 focus:ring-blue-700 mt-0.5 cursor-pointer"
                        />
                        <span className="text-xs text-slate-800 font-semibold leading-relaxed">
                          {tr.termsAgreeText} <span className="text-red-500">*</span>
                        </span>
                      </label>
                      {formErrors.terms && (
                        <p className="text-xs text-red-600 font-semibold mt-1 pl-8 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">error</span>
                          {formErrors.terms}
                        </p>
                      )}
                    </div>

                    {/* Digital Signature Execution */}
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
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-none"
                        />
                        {formErrors.signature && (
                          <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">error</span>
                            {formErrors.signature}
                          </p>
                        )}
                      </div>

                      {/* Visual Signature Certificate Card */}
                      <div className="bg-white border border-slate-300 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                          {tr.signaturePreview}
                        </span>
                        <div className="font-serif italic text-lg sm:text-xl text-blue-950 font-bold tracking-wide py-1 border-b border-dashed border-slate-300">
                          {formData.digitalSignature || "Digital Signature Preview"}
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1 font-mono">
                          <span>{tr.signatureTimestamp}: {new Date().toLocaleTimeString()}</span>
                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
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
                      onClick={() => setCurrentStep(2)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                      {tr.backToSectionII}
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
                        className="flex-1 sm:flex-initial px-8 py-3.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                        <span>{tr.submitPatientPaperwork}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Official Document Footnote */}
            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
              <div>
                DERMA CARE TELEHEALTH NETWORK • DOCUMENT CONTROL ID #DC-PAT-2026-V4
              </div>
              <div className="flex items-center gap-3">
                <span>ENCRYPTED 256-BIT TRANSMISSION</span>
                <span>•</span>
                <span>MINISTRY OF HEALTH COMPLIANT</span>
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
