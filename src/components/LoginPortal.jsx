import { useState, useEffect } from "react";
import { translations, defaultSpecialists } from "../data";
import hospitalRoomBg from "../assets/images/derma_hospital_room_1790257705106.jpg";
import PatientRegistrationPaper from "./PatientRegistrationPaper";
import ProviderRegistrationPaper from "./ProviderRegistrationPaper";
import { findAccountInCloud, normalizePhone } from "../services/firebaseSync";
import { handleHorizontalWheel } from "../utils/scrollHelpers";

export default function LoginPortal({
  accounts,
  onRegister,
  onLoginSuccess,
  currentLanguage,
  onLanguageChange,
  formTemplates
}) {
  const t = translations[currentLanguage] || translations.en;
  const [activeTab, setActiveTab] = useState("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [authErrorType, setAuthErrorType] = useState(null);
  const [showContactAdminModal, setShowContactAdminModal] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerRole, setRegisterRole] = useState("patient");
  const [isVerifying, setIsVerifying] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");

  useEffect(() => {
    let interval;
    if (lockoutTimeLeft > 0) {
      interval = setInterval(() => {
        setLockoutTimeLeft((prev) => prev - 1);
      }, 1e3);
    } else if (lockoutTimeLeft === 0 && failedAttempts >= 7) {
      setFailedAttempts(0);
    }
    return () => clearInterval(interval);
  }, [lockoutTimeLeft, failedAttempts]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (lockoutTimeLeft > 0 || isVerifying) {
      if (lockoutTimeLeft > 0) {
        setErrorMessage(`Too many failed attempts. Please wait ${lockoutTimeLeft}s.`);
      }
      return;
    }
    if (!email || !password) {
      setErrorMessage("Please fill in all credentials.");
      return;
    }

    setErrorMessage("");
    setAuthErrorType(null);
    setSyncNotice("");

    const cleanInput = email.trim().toLowerCase();
    const trimmedPass = password.trim();

    // 1. Admin login verification
    if (cleanInput === "admin23@gmail.com" && trimmedPass === "1234567890") {
      const adminAcc = {
        id: "0000000001",
        email: "admin23@gmail.com",
        passwordHash: "1234567890",
        role: "admin",
        status: "Approved",
        name: "Super Admin",
        createdAt: new Date().toISOString()
      };
      if (activeTab !== "admin") setActiveTab("admin");
      onLoginSuccess(adminAcc);
      return;
    }

    if (activeTab === "admin") {
      triggerFailedAttempt();
      setAuthErrorType("wrong_password");
      setErrorMessage("Incorrect Administrator Email or Password. Please check your credentials or contact the system administrator.");
      return;
    }

    // 2. Identify candidate accounts in memory by Email, ID, Phone, or Name
    const phoneDigits = normalizePhone(email);
    const cleanNoSpaces = cleanInput.replace(/\s+/g, "");
    const matchesAccount = (acc) => {
      if (!acc) return false;
      const accEmail = acc.email ? String(acc.email).trim().toLowerCase() : "";
      const accId = acc.id ? String(acc.id).trim().toLowerCase() : "";
      const accIdNoSpaces = accId.replace(/\s+/g, "");
      const accName = acc.name ? String(acc.name).trim().toLowerCase() : "";
      const accNameNoSpaces = accName.replace(/\s+/g, "");
      const accPhone = acc.phone ? normalizePhone(acc.phone) : "";

      if (accEmail && accEmail === cleanInput) return true;
      if (accId && (accId === cleanInput || (cleanNoSpaces && accIdNoSpaces === cleanNoSpaces))) return true;
      if (accName && (accName === cleanInput || (cleanNoSpaces && accNameNoSpaces === cleanNoSpaces))) return true;
      if (phoneDigits && accPhone && (accPhone === phoneDigits || accPhone.endsWith(phoneDigits) || phoneDigits.endsWith(accPhone))) return true;
      return false;
    };

    let localCandidates = (accounts || []).filter(matchesAccount);

    const executeLogin = (account) => {
      if (account.status === "Pending") {
        setAuthErrorType("pending");
        setErrorMessage("Verification Status: Pending review by Admin. Credentials will activate immediately upon verification.");
        return;
      }
      if (account.status === "Declined") {
        setAuthErrorType("declined");
        setErrorMessage("Your account has been declined. Please contact administration support: +256 701 983247 / admin@dermacare.com");
        return;
      }

      if (account.role !== activeTab) {
        setActiveTab(account.role);
        setSyncNotice(`Found your verified account under ${account.role === "specialist" ? "Healthcare Specialist" : "Patient"} Portal. Logging you in...`);
        setTimeout(() => {
          onLoginSuccess(account);
        }, 350);
        return;
      }

      onLoginSuccess(account);
    };

    // A. Check if any local candidate in activeTab matches the entered password
    const activeTabPassMatch = localCandidates.find(
      (acc) => acc.role === activeTab && acc.passwordHash === trimmedPass
    );
    if (activeTabPassMatch) {
      executeLogin(activeTabPassMatch);
      return;
    }

    // B. Check if candidate with other role matches the entered password
    const otherRolePassMatch = localCandidates.find(
      (acc) => acc.passwordHash === trimmedPass
    );
    if (otherRolePassMatch) {
      executeLogin(otherRolePassMatch);
      return;
    }

    // C. Query Firestore in Cloud Database across all devices in real time
    setIsVerifying(true);
    try {
      const cloudAccount = await findAccountInCloud(cleanInput, trimmedPass, activeTab);

      if (cloudAccount) {
        // Sync to local application state
        if (onRegister) {
          onRegister(cloudAccount);
        }

        if (cloudAccount.passwordHash === trimmedPass) {
          executeLogin(cloudAccount);
          return;
        } else {
          triggerFailedAttempt();
          setAuthErrorType("wrong_password");
          setErrorMessage("Wrong password entered. Please re-enter your password, create an account if you are new, or contact the admin if you have forgotten your password.");
          return;
        }
      }
    } catch (cloudErr) {
      console.warn("Cloud account verification error:", cloudErr);
    } finally {
      setIsVerifying(false);
    }

    // D. If local candidates matched identifier but none matched password
    if (localCandidates.length > 0) {
      triggerFailedAttempt();
      setAuthErrorType("wrong_password");
      setErrorMessage("Wrong password entered. Please re-enter your password, create an account if you are new, or contact the admin if you have forgotten your password.");
      return;
    }

    // E. Not found anywhere
    triggerFailedAttempt();
    setAuthErrorType("account_not_found");
    setErrorMessage("No active account was found with this email, ID, or phone number. You can create a new account or contact the admin.");
  };

  const triggerFailedAttempt = () => {
    setFailedAttempts((prev) => {
      const next = prev + 1;
      if (next >= 7) {
        setLockoutTimeLeft(120);
      }
      return next;
    });
  };

  // When the user taps "As a Patient" or "As a Healthcare Provider",
  // they are navigated directly to the dedicated registration web pages
  // formatted as official clinical paperwork to fill in.
  if (isRegistering) {
    if (registerRole === "patient") {
      return (
        <PatientRegistrationPaper
          accounts={accounts}
          currentLanguage={currentLanguage}
          onLanguageChange={onLanguageChange}
          onBackToLogin={() => setIsRegistering(false)}
          onRegisterSuccess={(newAccount) => {
            onRegister(newAccount);
            onLoginSuccess(newAccount);
          }}
          formTemplates={formTemplates}
        />
      );
    }
    if (registerRole === "provider") {
      return (
        <ProviderRegistrationPaper
          accounts={accounts}
          currentLanguage={currentLanguage}
          onLanguageChange={onLanguageChange}
          onBackToLogin={() => setIsRegistering(false)}
          onRegisterSuccess={(newAccount) => {
            onRegister(newAccount);
          }}
          formTemplates={formTemplates}
        />
      );
    }
  }
  return <div id="login_portal_wrapper" className="min-h-screen w-full relative flex flex-col justify-between text-[#263746] overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">
      {/* Atmospheric Clinical Dermatology Background (Softened, blurred & ~25% faulty/textured) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-slate-950">
        <img
          src={hospitalRoomBg}
          alt="Dermatology Clinical Environment"
          className="w-full h-full object-cover object-center scale-105 blur-[3px] opacity-75"
        />
        {/* Soft ~25% contrast veil & vignette for atmospheric depth */}
        <div className="absolute inset-0 bg-slate-950/45" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(5,15,25,0.65)_100%)]" />
        {/* Subtle faulty scanline/sensor texture overlay (~25% fault effect) */}
        <div 
          className="absolute inset-0 opacity-[0.20]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0, 0, 0, 0.45) 4px)"
          }}
        />
      </div>

      {/* Main Foreground Container */}
      <div className="relative z-10 w-full min-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
        {/* Brand Welcome Banner Header */}
        <div id="brand_hero_side" className="w-full text-white pt-2 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div
                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 border-2 border-emerald-200/90 flex items-center justify-center shrink-0 overflow-hidden group cursor-pointer transition-all duration-300 animate-emerald-glow shadow-xl"
                style={{
                  backdropFilter: "blur(14px) contrast(130%) saturate(170%) brightness(108%)",
                  WebkitBackdropFilter: "blur(14px) contrast(130%) saturate(170%) brightness(108%)",
                  boxShadow: "0 0 32px rgba(16, 185, 129, 0.85), 0 0 64px rgba(5, 150, 105, 0.5), inset 0 2px 3px rgba(255, 255, 255, 0.9), inset 0 -2px 3px rgba(6, 78, 59, 0.5)"
                }}
              >
                {/* Luminous Liquid Shimmer Sweep */}
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/50 to-transparent rotate-12 animate-liquid-sheen pointer-events-none" />
                {/* Animated Floating Luminous Medical Icon */}
                <span className="material-symbols-outlined text-[36px] sm:text-[44px] fill text-white relative z-10 select-none animate-logo-icon drop-shadow-[0_2px_12px_rgba(6,78,59,0.95)]">
                  health_and_safety
                </span>
              </div>
              <div>
                <h1 className="font-display font-black text-2xl sm:text-3xl md:text-4xl tracking-wider text-white drop-shadow-lg leading-tight">DERMA CARE</h1>
                <p className="text-xs sm:text-sm font-bold text-sky-200 tracking-widest uppercase drop-shadow-sm flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  DERMATOLOGY TELEHEALTH PORTAL
                </p>
              </div>
            </div>

            {/* Language Selection Header Pill - Frosted Glass Appearance */}
            <div
              className="flex items-center gap-1.5 p-1.5 rounded-xl text-xs shadow-lg transition-all"
              style={{
                background: "rgba(255, 255, 255, 0.22)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: "1px solid rgba(255, 255, 255, 0.50)",
                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.25), inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.7)"
              }}
            >
              <span className="material-symbols-outlined text-white text-sm ml-1">language</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onLanguageChange("en")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${currentLanguage === "en" ? "bg-white text-slate-900 shadow-sm" : "text-white/85 hover:text-white hover:bg-white/20"}`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange("lg")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${currentLanguage === "lg" ? "bg-white text-slate-900 shadow-sm" : "text-white/85 hover:text-white hover:bg-white/20"}`}
                >
                  Luganda
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange("sw")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${currentLanguage === "sw" ? "bg-white text-slate-900 shadow-sm" : "text-white/85 hover:text-white hover:bg-white/20"}`}
                >
                  Swahili
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange("fr")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${currentLanguage === "fr" ? "bg-white text-slate-900 shadow-sm" : "text-white/85 hover:text-white hover:bg-white/20"}`}
                >
                  Français
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 max-w-3xl">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight text-white drop-shadow-md">
              {currentLanguage === "lg" ? "Embeera y'Eddiba ey'Okupimibwa ku Mikutu." : currentLanguage === "sw" ? "Ulinzi na Utunzaji wa Ngozi popote ulipo." : currentLanguage === "fr" ? "Soins dermatologiques de précision, partout." : "Precision Dermatology Care, Anywhere."}
            </h2>
            <p className="text-slate-100 text-xs sm:text-sm mt-1 leading-relaxed font-medium drop-shadow-sm">
              {currentLanguage === "lg" ? "Weegatte n'abasawo abakugu, laba lipoota ez'omulembe, era wejjanjabe n'obukuumi obukakafu." : currentLanguage === "sw" ? "Ungana na wataalamu bingi wa ngozi, fanya vipimo vya haraka vya AI, na udhibiti miadi yako salama." : currentLanguage === "fr" ? "Connectez-vous à des dermatologues agréés, accédez au triage IA et gérez vos ordonnances de façon sécurisée." : "Connect with leading skin specialists, upload images for triage AI summaries, and manage your health journey in one secure place."}
            </p>
          </div>
        </div>

        {/* Form Area Container */}
        <div id="form_container_side" className="w-full flex-1 flex flex-col justify-center py-4">
          {/* Dynamic Form Content Box - Authentic Glass Appearance */}
          <div
            id="login_card_inner"
            className="w-full max-w-2xl mx-auto rounded-3xl p-6 sm:p-8 transition-all duration-400 relative overflow-hidden group shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.16) 50%, rgba(255, 255, 255, 0.24) 100%)",
              backdropFilter: "blur(28px) saturate(190%) brightness(105%)",
              WebkitBackdropFilter: "blur(28px) saturate(190%) brightness(105%)",
              border: "1.5px solid rgba(255, 255, 255, 0.50)",
              boxShadow: "0 30px 60px -15px rgba(0, 0, 0, 0.50), inset 0 2px 3px 0 rgba(255, 255, 255, 0.85), inset 0 -1.5px 2px 0 rgba(255, 255, 255, 0.20), inset 1.5px 0 2px 0 rgba(255, 255, 255, 0.50)"
            }}
          >
            {/* Ambient Glass Reflections & Prism Shimmer */}
            <div className="pointer-events-none absolute -top-28 -left-28 w-80 h-80 rounded-full bg-white/20 blur-3xl z-0" />
            <div className="pointer-events-none absolute -bottom-28 -right-28 w-80 h-80 rounded-full bg-sky-200/20 blur-3xl z-0" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl z-0">
              <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/25 to-transparent rotate-12 animate-liquid-sheen" />
            </div>

            {/* =================== LOGIN MODE =================== */}
            <div id="login_form_block" className="space-y-6 animate-fade-in relative z-10">
              {/* Visual Clinical Banner Header */}
              <div className="relative h-28 sm:h-36 w-full rounded-2xl overflow-hidden bg-slate-900 border border-white/30 shadow-md">
                <img
                  src={hospitalRoomBg}
                  alt="Dermatology Examination Center"
                  className="w-full h-full object-cover object-center opacity-90 hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex items-end p-4">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-300 bg-sky-950/80 px-2.5 py-0.5 rounded-full border border-sky-400/30 inline-block mb-1">
                        Accredited Clinical Portal
                      </span>
                      <h3 className="font-display font-extrabold text-base sm:text-lg text-white">
                        Specialized Dermatology Care
                      </h3>
                    </div>
                    <span className="text-xs text-white bg-slate-900/80 px-2.5 py-1 rounded-lg font-semibold border border-white/20 hidden sm:inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Secure Triage
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div
                  className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 border border-emerald-300/80 flex items-center justify-center shrink-0 overflow-hidden shadow-lg animate-emerald-glow"
                  style={{
                    boxShadow: "0 0 20px rgba(16, 185, 129, 0.7), inset 0 1.5px 2px rgba(255, 255, 255, 0.85)"
                  }}
                >
                  <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/40 to-transparent rotate-12 animate-liquid-sheen pointer-events-none" />
                  <span className="material-symbols-outlined text-[28px] sm:text-[32px] fill text-white relative z-10 select-none animate-logo-icon drop-shadow-md">
                    health_and_safety
                  </span>
                </div>
                <div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight drop-shadow-sm">{t.loginTitle}</h2>
                  <p className="text-slate-200 font-medium text-xs sm:text-sm drop-shadow-xs">{t.loginSub}</p>
                </div>
              </div>

              {/* Login Role Tabs - Frosted glass pill style */}
              <div
                className="flex p-1.5 rounded-2xl transition-all overflow-x-auto overscroll-x-contain tabs-horizontal-scroll scrollbar-none"
                onWheel={handleHorizontalWheel}
                style={{
                  background: "rgba(255, 255, 255, 0.22)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(255, 255, 255, 0.45)",
                  boxShadow: "inset 0 1px 2px 0 rgba(255, 255, 255, 0.4)"
                }}
              >
                <button
                  id="tab_patient_login"
                  onClick={() => {
                    setActiveTab("patient");
                    setErrorMessage("");
                  }}
                  className={`flex-1 py-2.5 text-center font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer ${activeTab === "patient" ? "bg-white text-slate-900 shadow-md font-extrabold" : "text-white/85 hover:text-white hover:bg-white/20"}`}
                >
                  {t.patientTab}
                </button>
                <button
                  id="tab_specialist_login"
                  onClick={() => {
                    setActiveTab("specialist");
                    setErrorMessage("");
                  }}
                  className={`flex-1 py-2.5 text-center font-bold text-xs sm:text-sm rounded-xl transition-all duration-200 cursor-pointer ${
                    activeTab === "specialist"
                      ? "bg-white text-slate-900 shadow-md font-extrabold"
                      : "text-white/85 hover:text-white hover:bg-blue-600/50 hover:scale-[1.02] hover:shadow-md hover:shadow-blue-500/25"
                  }`}
                >
                  {t.specialistTab}
                </button>
                <button
                  id="tab_admin_login"
                  onClick={() => {
                    setActiveTab("admin");
                    setErrorMessage("");
                  }}
                  className={`flex-1 py-2.5 text-center font-bold text-xs sm:text-sm rounded-xl transition-all duration-200 cursor-pointer ${
                    activeTab === "admin"
                      ? "bg-white text-slate-900 shadow-md font-extrabold"
                      : "text-white/85 hover:text-white hover:bg-slate-950/85 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-black/50 hover:border hover:border-slate-700/60"
                  }`}
                >
                  {t.adminTab}
                </button>
              </div>

              {/* Cross-Device Cloud Sync Indicator */}
              <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white/10 backdrop-blur-md rounded-full text-[11px] font-semibold text-white/90 border border-white/20 shadow-xs mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Cloud Database Active • Accounts shared across all devices</span>
              </div>

              {/* Sync Redirect Notice */}
              {syncNotice && (
                <div
                  id="login_sync_notice"
                  className="p-3.5 bg-emerald-500/20 backdrop-blur-md border-2 border-emerald-400 rounded-xl text-emerald-100 text-xs font-bold shadow-md flex items-center gap-2.5 animate-pulse"
                >
                  <span className="material-symbols-outlined text-emerald-300 text-lg">check_circle</span>
                  <span>{syncNotice}</span>
                </div>
              )}

              {/* Red notification for wrong email/password or authentication error */}
              {errorMessage && (
                <div
                  id="login_error_alert"
                  className="p-4 bg-red-50 dark:bg-red-950/60 border-2 border-red-500 rounded-2xl text-red-900 dark:text-red-100 shadow-md space-y-3"
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-2xl">
                        {authErrorType === 'wrong_password' ? 'lock_reset' : 'error'}
                      </span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className="font-extrabold text-sm text-red-700 dark:text-red-300 flex items-center gap-1.5">
                        {authErrorType === 'wrong_password'
                          ? 'Wrong Password Entered'
                          : authErrorType === 'account_not_found'
                          ? 'Account Not Found'
                          : 'Authentication Notice'}
                      </h4>
                      <p className="text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">
                        {errorMessage}
                      </p>
                    </div>
                  </div>

                  {/* Quick Action buttons */}
                  <div className="pt-2 border-t border-red-200 dark:border-red-900/60 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      id="btn_error_create_account"
                      onClick={() => {
                        setIsRegistering(true);
                        setRegisterRole(activeTab === 'specialist' ? 'provider' : 'patient');
                        setErrorMessage('');
                        setAuthErrorType(null);
                      }}
                      className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">person_add</span>
                      Create an Account
                    </button>

                    <button
                      type="button"
                      id="btn_error_contact_admin"
                      onClick={() => setShowContactAdminModal(true)}
                      className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-slate-800 text-red-800 dark:text-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">support_agent</span>
                      Contact Admin (Forgot Password)
                    </button>
                  </div>
                </div>
              )}

              {/* Lockout Active */}
              {failedAttempts >= 7 && lockoutTimeLeft > 0 && (
                <div id="lockout_timer_alert" className="p-4 bg-error text-white rounded-lg flex items-center justify-between font-bold animate-pulse">
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined animate-spin">hourglass_empty</span>
                    Too many failed attempts. Locked!
                  </span>
                  <span>Try again in {lockoutTimeLeft}s</span>
                </div>
              )}

              {/* Actual Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-white mb-1.5 drop-shadow-xs" htmlFor="login_email">
                    {t.emailLabel}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">mail</span>
                    <input
                      id="login_email"
                      type="text"
                      autoComplete="username"
                      required
                      placeholder={activeTab === "admin" ? "admin23@gmail.com" : activeTab === "specialist" ? "doctor@clinic.com, Doctor ID, or Phone" : "Email, 10-digit ID, or Phone (+256...)"}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) {
                          setErrorMessage("");
                          setAuthErrorType(null);
                        }
                      }}
                      disabled={lockoutTimeLeft > 0 || isVerifying}
                      className="w-full pl-10 pr-4 py-3 bg-white/90 focus:bg-white border border-white/60 focus:border-[#315B7D] focus:ring-2 focus:ring-[#315B7D]/20 rounded-xl outline-none transition-all text-slate-900 font-medium shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm font-bold text-white drop-shadow-xs" htmlFor="login_password">
                      {t.passwordLabel}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowContactAdminModal(true)}
                      className="text-xs text-sky-300 hover:text-white hover:underline font-semibold transition-colors"
                    >
                      {t.forgotPassword}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">lock</span>
                    <input
                      id="login_password"
                      type={showLoginPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) {
                          setErrorMessage("");
                          setAuthErrorType(null);
                        }
                      }}
                      disabled={lockoutTimeLeft > 0 || isVerifying}
                      className="w-full pl-10 pr-11 py-3 bg-white/90 focus:bg-white border border-white/60 focus:border-[#315B7D] focus:ring-2 focus:ring-[#315B7D]/20 rounded-xl outline-none transition-all text-slate-900 font-sans font-medium shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A98A5] hover:text-[#315B7D] transition-colors p-1 flex items-center justify-center cursor-pointer"
                      title={showLoginPassword ? "Hide password" : "View password"}
                      aria-label={showLoginPassword ? "Hide password" : "View password"}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {showLoginPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  id="btn_login_submit"
                  type="submit"
                  disabled={lockoutTimeLeft > 0 || isVerifying}
                  className="w-full py-3.5 px-4 bg-[#315B7D] hover:bg-[#24465F] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(49,91,125,0.25)] hover:shadow-[0_6px_20px_rgba(49,91,125,0.35)] disabled:opacity-50 disabled:cursor-not-allowed h-12 cursor-pointer text-sm transition-all"
                >
                  {isVerifying ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      <span>Verifying across devices...</span>
                    </span>
                  ) : (
                    <>
                      {t.signIn}
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-white/20" />
                <span className="flex-shrink mx-4 text-xs text-slate-200 font-bold tracking-widest uppercase">{t.orCreateAccount}</span>
                <div className="flex-grow border-t border-white/20" />
              </div>

              {/* Bento style signup selections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  id="btn_signup_patient"
                  onClick={() => {
                    setIsRegistering(true);
                    setRegisterRole("patient");
                  }}
                  className="bg-white/20 hover:bg-gradient-to-r hover:from-slate-950 hover:to-slate-900 border border-white/35 hover:border-slate-600/80 p-4 rounded-2xl flex items-center group text-left cursor-pointer transition-all duration-300 ease-out shadow-sm hover:shadow-[0_14px_32px_-4px_rgba(0,0,0,0.7),0_0_24px_rgba(15,23,42,0.6)] hover:scale-[1.03] active:scale-[0.98] backdrop-blur-xs hover:ring-2 hover:ring-slate-500/50"
                >
                  <div className="w-12 h-12 bg-white/20 group-hover:bg-slate-800 text-white rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-all duration-300 shrink-0 border border-white/30 group-hover:border-slate-600 shadow-xs">
                    <span className="material-symbols-outlined fill text-2xl group-hover:text-white transition-colors">person</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white group-hover:text-white transition-colors">{t.patientOption || "As a Patient"}</h3>
                    <p className="text-xs text-slate-200 group-hover:text-slate-300 font-normal transition-colors">{t.patientSub}</p>
                  </div>
                </button>

                <button
                  id="btn_signup_provider"
                  onClick={() => {
                    setIsRegistering(true);
                    setRegisterRole("provider");
                  }}
                  className="bg-white/20 hover:bg-white/35 border border-white/35 hover:border-white/60 p-4 rounded-2xl flex items-center group text-left cursor-pointer transition-all shadow-sm backdrop-blur-xs"
                >
                  <div className="w-12 h-12 bg-white/20 text-white rounded-xl flex items-center justify-center mr-4 group-hover:scale-105 transition-transform shrink-0 border border-white/30">
                    <span className="material-symbols-outlined fill text-2xl">medical_services</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{t.providerOption || "As a Healthcare Provider"}</h3>
                    <p className="text-xs text-slate-200 font-normal">{t.providerSub}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div id="login_footer_lang" className="pt-4 border-t border-white/15 flex flex-col items-center gap-2 mt-4 text-blue-100">
          <div className="flex items-center gap-2 text-blue-200/80">
            <span className="material-symbols-outlined text-[18px]">language</span>
            <span className="text-xs font-bold uppercase tracking-wider">{t.selectLang}</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold">
            <button
    onClick={() => onLanguageChange("en")}
    className={`transition-colors ${currentLanguage === "en" ? "text-white underline decoration-2 underline-offset-4" : "text-blue-200/80 hover:text-white"}`}
  >
              English
            </button>
            <button
    onClick={() => onLanguageChange("lg")}
    className={`transition-colors ${currentLanguage === "lg" ? "text-white underline decoration-2 underline-offset-4" : "text-blue-200/80 hover:text-white"}`}
  >
              Luganda
            </button>
            <button
    onClick={() => onLanguageChange("sw")}
    className={`transition-colors ${currentLanguage === "sw" ? "text-white underline decoration-2 underline-offset-4" : "text-blue-200/80 hover:text-white"}`}
  >
              Swahili
            </button>
            <button
    onClick={() => onLanguageChange("fr")}
    className={`transition-colors ${currentLanguage === "fr" ? "text-white underline decoration-2 underline-offset-4" : "text-blue-200/80 hover:text-white"}`}
  >
              Français
            </button>
          </div>
        </div>

        {/* Contact Administrator Modal */}
        {showContactAdminModal && (
          <div
            id="contact_admin_modal_overlay"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70"
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/20">
                    <span className="material-symbols-outlined text-2xl">support_agent</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Contact Administrator</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Account Recovery & Password Assistance</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContactAdminModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 hover:text-slate-950 transition flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-xs text-red-800 dark:text-red-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-red-600">info</span>
                  Forgotten your password or cannot access your account?
                </p>
                <p className="leading-relaxed">
                  Our system administrator can verify your identity, reset your medical credentials, or assist with credential onboarding.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-xl">mail</span>
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Administrator Email</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">admin23@gmail.com</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="mailto:admin23@gmail.com?subject=DERMA%20CARE%20Account%20Password%20Recovery%20Request"
                      className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition"
                    >
                      Email
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText("admin23@gmail.com");
                        setCopiedEmail(true);
                        setTimeout(() => setCopiedEmail(false), 2000);
                      }}
                      className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
                      title="Copy email to clipboard"
                    >
                      {copiedEmail ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-xl">call</span>
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Support Hotline & WhatsApp</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">+256 701 983247</span>
                    </div>
                  </div>
                  <a
                    href="tel:+256701983247"
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    Call
                  </a>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl">schedule</span>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Clinical Desk Operations</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">24/7 Priority Medical Triage & System IT Desk</span>
                  </div>
                </div>
              </div>

              {/* Demo Quick Access Helper */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs space-y-1">
                <span className="font-bold text-blue-900 dark:text-blue-200 block">Default Demo Credentials:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-blue-800 dark:text-blue-300">
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg">
                    <span className="font-bold block">Patient</span>
                    marvinssozi23@gmail.com<br />
                    alex@example.com<br />
                    Pass: <code className="font-mono font-bold">alex123</code>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg">
                    <span className="font-bold block">Doctor</span>
                    sarah@clinic.com<br />
                    Pass: <code className="font-mono font-bold">sarah123</code>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg">
                    <span className="font-bold block">Admin</span>
                    admin23@gmail.com<br />
                    Pass: <code className="font-mono font-bold">1234567890</code>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowContactAdminModal(false);
                    setIsRegistering(true);
                    setRegisterRole(activeTab === 'specialist' ? 'provider' : 'patient');
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  Create New Account Instead
                </button>
                <button
                  type="button"
                  onClick={() => setShowContactAdminModal(false)}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>;
}
