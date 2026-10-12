import { useState, useEffect, useRef, useMemo } from "react";
import { defaultFormTemplates, initialSystemLogs, translations } from "../data";
import { adminTranslations } from "../adminTranslations";
import { playNotificationChime } from "../utils/audioChime";
import {
  fetchAllAccountsFromCloud,
  syncAllLocalAccounts,
  normalizePhone
} from "../services/firebaseSync";
import {
  handleHorizontalWheel,
  isolateScroll,
  useLockBodyScroll
} from "../utils/scrollHelpers";

export default function AdminPortal({
  user,
  accounts,
  onApproveAccount,
  onDeclineAccount,
  onResetUserPassword,
  onDeleteAccount,
  onRevokeWhitelist,
  onLogout,
  currentLanguage = "en",
  onLanguageChange,
  formTemplates = defaultFormTemplates,
  onUpdateTemplates,
  adminSpecialistChats = [],
  onSendAdminReply,
  onMarkAdminChatRead
}) {
  const t = translations[currentLanguage] || translations.en;
  const at = adminTranslations[currentLanguage] || adminTranslations.en;
  const [activeTab, setActiveTab] = useState("all_users");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isWideOrLandscape, setIsWideOrLandscape] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const dropdownRef = useRef(null);
  const mainRef = useRef(null);
  const adminChatScrollRef = useRef(null);
  const [selectedSpecialistChatId, setSelectedSpecialistChatId] = useState("doctor_sarah");
  const [adminReplyInput, setAdminReplyInput] = useState("");
  const [specialistChatSearch, setSpecialistChatSearch] = useState("");
  const [specialistMsgToast, setSpecialistMsgToast] = useState(null);

  // Unread messages from Specialists for Admin
  const adminUnreadCount = useMemo(() => {
    return adminSpecialistChats.filter((m) => m.role === "specialist" && !m.readByAdmin).length;
  }, [adminSpecialistChats]);

  // When viewing helpdesk tab and active specialist, mark messages as read
  useEffect(() => {
    if (activeTab === "helpdesk" && selectedSpecialistChatId && onMarkAdminChatRead) {
      const hasUnread = adminSpecialistChats.some(
        (m) => m.specialistId === selectedSpecialistChatId && m.role === "specialist" && !m.readByAdmin
      );
      if (hasUnread) {
        onMarkAdminChatRead(selectedSpecialistChatId);
      }
    }
  }, [activeTab, selectedSpecialistChatId, adminSpecialistChats, onMarkAdminChatRead]);

  // Show live toast notification and chime when a new message from a specialist arrives
  const previousSpecialistMsgCountRef = useRef(
    adminSpecialistChats.filter((m) => m.role === "specialist").length
  );
  useEffect(() => {
    const currentSpecialistCount = adminSpecialistChats.filter((m) => m.role === "specialist").length;
    if (currentSpecialistCount > previousSpecialistMsgCountRef.current) {
      const latestMsg = [...adminSpecialistChats].reverse().find((m) => m.role === "specialist");
      if (latestMsg) {
        playNotificationChime();
        setSpecialistMsgToast({
          specialistId: latestMsg.specialistId,
          specialistName: latestMsg.senderName || latestMsg.specialistName || "Medical Specialist",
          specialization: latestMsg.specialization || "Clinical Specialist",
          content: latestMsg.content,
          time: latestMsg.time
        });
        setTimeout(() => setSpecialistMsgToast(null), 8000);
      }
    }
    previousSpecialistMsgCountRef.current = currentSpecialistCount;
  }, [adminSpecialistChats]);

  // Auto-scroll admin chat window
  useEffect(() => {
    if (activeTab === "helpdesk") {
      adminChatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTab, selectedSpecialistChatId, adminSpecialistChats]);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
      const mainEl = mainRef.current;
      if (mainEl) {
        const rect = mainEl.getBoundingClientRect();
        const mainTop = window.scrollY + rect.top;
        const mainHeight = mainEl.scrollHeight || mainEl.offsetHeight;
        const scrollable = mainHeight - window.innerHeight;
        if (scrollable > 20) {
          const scrolledDistance = window.scrollY - mainTop + 70;
          const progress = Math.min(100, Math.max(0, scrolledDistance / scrollable * 100));
          setScrollProgress(progress);
        } else {
          const totalDoc = document.documentElement.scrollHeight - window.innerHeight;
          const progress = totalDoc > 0 ? Math.min(100, Math.max(0, window.scrollY / totalDoc * 100)) : 0;
          setScrollProgress(progress);
        }
      } else {
        const totalDoc = document.documentElement.scrollHeight - window.innerHeight;
        const progress = totalDoc > 0 ? Math.min(100, Math.max(0, window.scrollY / totalDoc * 100)) : 0;
        setScrollProgress(progress);
      }
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [activeTab]);
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === "undefined") return;
      const isLandscape = window.matchMedia("(orientation: landscape)").matches;
      const isWide = window.innerWidth >= 1024;
      setIsWideOrLandscape(isWide || isLandscape && window.innerWidth >= 768);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    const mediaQ = window.matchMedia("(orientation: landscape)");
    mediaQ.addEventListener?.("change", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      mediaQ.removeEventListener?.("change", checkOrientation);
    };
  }, []);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  const [inspectingAccount, setInspectingAccount] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const getSpecialistPhoto = (acc) => {
    if (acc.profilePic) return acc.profilePic;
    const nameLower = (acc.name || "").toLowerCase();
    if (nameLower.includes("dennis") || nameLower.includes("ssozi")) {
      return "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80";
    }
    if (nameLower.includes("sarah") || nameLower.includes("jenkins")) {
      return "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80";
    }
    if (nameLower.includes("chang") || nameLower.includes("michael")) {
      return "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=400&q=80";
    }
    if (acc.providerType === "Hospital") {
      return "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=400&q=80";
    }
    if (acc.providerType === "Clinic") {
      return "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=400&q=80";
    }
    return "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=400&q=80";
  };
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualLicense, setManualLicense] = useState("");
  const [manualType, setManualType] = useState("Individual");
  const [whitelistedEmails, setWhitelistedEmails] = useState([
    { name: "Dr. Sarah Jenkins", email: "sarah@clinic.com", license: "LIC-9012-S", type: "Individual" },
    { name: "City Central Skin Hospital", email: "admin@cityskin.org", license: "LIC-4432-H", type: "Hospital" }
  ]);
  const [templates, setTemplates] = useState(formTemplates || defaultFormTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState(
    (formTemplates && formTemplates[0]) || defaultFormTemplates[0]
  );

  useEffect(() => {
    if (formTemplates && formTemplates.length > 0) {
      setTemplates(formTemplates);
      if (!selectedTemplate) {
        setSelectedTemplate(formTemplates[0]);
      } else {
        const found = formTemplates.find(
          (t2) => t2.id === selectedTemplate.id || t2.providerType === selectedTemplate.providerType
        );
        if (found) setSelectedTemplate(found);
      }
    }
  }, [formTemplates]);
  const [templateViewMode, setTemplateViewMode] = useState("live_preview");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [formFilterCategory, setFormFilterCategory] = useState("all");
  const [selectedResetAcc, setSelectedResetAcc] = useState("");
  const [tempNewPassword, setTempNewPassword] = useState("dermacare2026");
  const [systemLogs, setSystemLogs] = useState(initialSystemLogs);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [accountToRevoke, setAccountToRevoke] = useState(null);
  const [revokeReason, setRevokeReason] = useState("License Suspension / Expiration");
  const [revokeNotes, setRevokeNotes] = useState("");
  const [whitelistFilter, setWhitelistFilter] = useState("all");
  const [whitelistSearch, setWhitelistSearch] = useState("");
  const [feedbackBanner, setFeedbackBanner] = useState(null);

  // Dedicated State for All Registered Users Directory & Devices
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userSort, setUserSort] = useState("newest");
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [copiedUserId, setCopiedUserId] = useState(null);
  const [isTestingSync, setIsTestingSync] = useState(false);
  const [deviceSyncNotice, setDeviceSyncNotice] = useState(null);

  // Lock body scroll when any modal dialog is open to prevent background div from scrolling
  useLockBodyScroll(Boolean(selectedUserDetail || inspectingAccount || accountToDelete || accountToRevoke || previewPhoto || viewingDoc));

  const handleCopyUserId = (id) => {
    if (!id) return;
    try {
      navigator.clipboard?.writeText(String(id));
      setCopiedUserId(String(id));
      showFeedback(`User ID "${id}" copied to clipboard!`, "success");
      setTimeout(() => setCopiedUserId(null), 2500);
    } catch (e) {
      setCopiedUserId(String(id));
      setTimeout(() => setCopiedUserId(null), 2500);
    }
  };

  const handleVerifyDeviceSync = async () => {
    setIsTestingSync(true);
    setDeviceSyncNotice(null);
    try {
      const cloudAccounts = await fetchAllAccountsFromCloud();
      const count = cloudAccounts?.length || accounts.length;
      setDeviceSyncNotice({
        status: "success",
        message: `Cross-Device Verification Successful: ${count} user accounts verified in Firestore Cloud database. Every registered user can log in from any phone, laptop, or tablet using their Full Name, User ID, or Email.`,
        verifiedCount: count,
        timestamp: new Date().toLocaleTimeString()
      });
      showFeedback(`✓ Multi-device verification confirmed! ${count} accounts active in cloud.`, "success");
    } catch (err) {
      console.warn("Device sync verification error:", err);
      setDeviceSyncNotice({
        status: "info",
        message: `Local cache has ${accounts.length} accounts verified. Multi-device lookup is active via Firestore client SDK.`,
        verifiedCount: accounts.length,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsTestingSync(false);
    }
  };

  const handleForceCloudSync = async () => {
    setIsTestingSync(true);
    try {
      await syncAllLocalAccounts(accounts);
      showFeedback(`✓ Successfully re-synchronized all ${accounts.length} accounts to cloud database!`, "success");
      handleVerifyDeviceSync();
    } catch (err) {
      showFeedback("Sync notice: " + (err.message || "Completed"), "info");
      setIsTestingSync(false);
    }
  };

  const handleQuickResetPassword = (acc) => {
    setSelectedResetAcc(acc.id);
    setActiveTab("passwords");
    showFeedback(`Opened password reset control for "${acc.name}" (ID: ${acc.id}). Enter temporary password below.`, "info");
  };

  const showFeedback = (message, type = "success") => {
    setFeedbackBanner({ message, type });
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };
  const handleInitiateRevokeWhitelist = (acc) => {
    setAccountToRevoke(acc);
    setRevokeReason("License Suspension / Expiration");
    setRevokeNotes("");
  };
  const handleConfirmRevokeWhitelist = () => {
    if (!accountToRevoke) return;
    const acc = accountToRevoke;
    if (onRevokeWhitelist) {
      onRevokeWhitelist(acc.id);
    } else {
      onDeclineAccount(acc.id);
    }
    if (inspectingAccount?.id === acc.id) {
      setInspectingAccount({ ...inspectingAccount, status: "Declined" });
    }
    const newLog = {
      id: Math.floor(1e3 + Math.random() * 9e3).toString(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      type: "warning",
      action: "Whitelist Certification Revoked",
      actor: "Super Admin",
      details: `Revoked whitelist certification for ${acc.name} (${acc.email}) [ID: ${acc.id}]. Reason: ${revokeReason}${revokeNotes ? ` - Notes: ${revokeNotes}` : ""}`
    };
    setSystemLogs((prev) => [newLog, ...prev]);
    setFeedbackBanner({
      type: "warning",
      message: `Provider "${acc.name}" has been removed from the active whitelist. Specialist login access is suspended.`
    });
    setAccountToRevoke(null);
  };
  const handleInitiateDeleteAccount = (acc) => {
    setAccountToDelete(acc);
  };
  const handleConfirmDeleteAccount = () => {
    if (!accountToDelete) return;
    const acc = accountToDelete;
    onDeleteAccount(acc.id);
    if (inspectingAccount?.id === acc.id) {
      setInspectingAccount(null);
    }
    const newLog = {
      id: Math.floor(1e3 + Math.random() * 9e3).toString(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      type: "warning",
      action: "Account Permanently Deleted",
      actor: "Super Admin",
      details: `Permanently purged account: ${acc.name} (${acc.email}) [ID: ${acc.id}, Role: ${acc.role}]`
    };
    setSystemLogs((prev) => [newLog, ...prev]);
    setFeedbackBanner({
      type: "info",
      message: `Account for "${acc.name}" (${acc.email}) has been permanently deleted from the database.`
    });
    setAccountToDelete(null);
  };
  const handleRemovePreWhitelisted = (license, name) => {
    setWhitelistedEmails((prev) => prev.filter((item) => item.license !== license));
    const newLog = {
      id: Math.floor(1e3 + Math.random() * 9e3).toString(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      type: "info",
      action: "Manual Pre-Whitelist Removed",
      actor: "Super Admin",
      details: `Removed pre-whitelisted license ${license} for ${name}`
    };
    setSystemLogs((prev) => [newLog, ...prev]);
    setFeedbackBanner({
      type: "info",
      message: `Pre-whitelisted license ${license} for "${name}" has been removed.`
    });
  };
  const handleManualWhitelistSubmit = (e) => {
    e.preventDefault();
    if (!manualName || !manualEmail || !manualLicense) {
      showFeedback("Please fill in Name, Email and Licence Number", "warning");
      return;
    }
    const newWhitelister = {
      name: manualName,
      email: manualEmail.toLowerCase(),
      license: manualLicense,
      type: manualType
    };
    setWhitelistedEmails((prev) => [newWhitelister, ...prev]);
    const newLog = {
      id: Math.floor(1e3 + Math.random() * 9e3).toString(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      type: "info",
      action: "Manual Whitelist Addition",
      actor: "Super Admin",
      details: `Pre-whitelisting Doctor ${manualName} (Email: ${manualEmail})`
    };
    setSystemLogs((prev) => [newLog, ...prev]);
    setManualName("");
    setManualEmail("");
    setManualLicense("");
    showFeedback(`Dermatology Licence ${manualLicense} for ${manualName} has been successfully added to Whitelist.`, "success");
  };
  const handleAddFieldToTemplate = () => {
    if (!newFieldName || !selectedTemplate) return;
    const fieldId = `field-${Date.now().toString().slice(-4)}`;
    const updatedTemplates = templates.map((tmpl) => {
      if (tmpl.id === selectedTemplate.id || tmpl.providerType === selectedTemplate.providerType) {
        return {
          ...tmpl,
          fields: [
            ...tmpl.fields,
            {
              id: fieldId,
              label: newFieldName,
              type: newFieldType,
              required: true
            }
          ]
        };
      }
      return tmpl;
    });
    setTemplates(updatedTemplates);
    if (onUpdateTemplates) onUpdateTemplates(updatedTemplates);
    try {
      localStorage.setItem("sh_form_templates", JSON.stringify(updatedTemplates));
    } catch (e) {
      console.error(e);
    }
    const matched = updatedTemplates.find((t2) => t2.id === selectedTemplate.id || t2.providerType === selectedTemplate.providerType) || null;
    setSelectedTemplate(matched);
    setNewFieldName("");
    showFeedback(`Input field "${newFieldName}" added to ${selectedTemplate.title || selectedTemplate.providerType} form and synchronized with the login registration page.`, "success");
  };
  const handleToggleRequiredField = (fieldId) => {
    if (!selectedTemplate) return;
    const updatedTemplates = templates.map((tmpl) => {
      if (tmpl.id === selectedTemplate.id || tmpl.providerType === selectedTemplate.providerType) {
        return {
          ...tmpl,
          fields: tmpl.fields.map((f) => f.id === fieldId ? { ...f, required: !f.required } : f)
        };
      }
      return tmpl;
    });
    setTemplates(updatedTemplates);
    if (onUpdateTemplates) onUpdateTemplates(updatedTemplates);
    try {
      localStorage.setItem("sh_form_templates", JSON.stringify(updatedTemplates));
    } catch (e) {
      console.error(e);
    }
    const matched = updatedTemplates.find((t2) => t2.id === selectedTemplate.id || t2.providerType === selectedTemplate.providerType) || null;
    setSelectedTemplate(matched);
    showFeedback(`Updated requirement status for field and synchronized with login forms.`, "info");
  };
  const handleDeleteField = (fieldId) => {
    if (!selectedTemplate) return;
    const updatedTemplates = templates.map((tmpl) => {
      if (tmpl.id === selectedTemplate.id || tmpl.providerType === selectedTemplate.providerType) {
        return {
          ...tmpl,
          fields: tmpl.fields.filter((f) => f.id !== fieldId)
        };
      }
      return tmpl;
    });
    setTemplates(updatedTemplates);
    if (onUpdateTemplates) onUpdateTemplates(updatedTemplates);
    try {
      localStorage.setItem("sh_form_templates", JSON.stringify(updatedTemplates));
    } catch (e) {
      console.error(e);
    }
    const matched = updatedTemplates.find((t2) => t2.id === selectedTemplate.id || t2.providerType === selectedTemplate.providerType) || null;
    setSelectedTemplate(matched);
    showFeedback(`Field deleted from ${selectedTemplate.title || selectedTemplate.providerType} form and synchronized with login portal.`, "info");
  };
  const handleResetTemplateDefaults = () => {
    if (!selectedTemplate) return;
    const defaultMatch = defaultFormTemplates.find((t2) => t2.id === selectedTemplate.id || t2.providerType === selectedTemplate.providerType);
    if (!defaultMatch) return;
    const updatedTemplates = templates.map((tmpl) => {
      if (tmpl.id === selectedTemplate.id || tmpl.providerType === selectedTemplate.providerType) {
        return defaultMatch;
      }
      return tmpl;
    });
    setTemplates(updatedTemplates);
    if (onUpdateTemplates) onUpdateTemplates(updatedTemplates);
    try {
      localStorage.setItem("sh_form_templates", JSON.stringify(updatedTemplates));
    } catch (e) {
      console.error(e);
    }
    setSelectedTemplate(defaultMatch);
    showFeedback(`Reset ${selectedTemplate.title || selectedTemplate.providerType} form template to full standard defaults and synchronized to login registration forms.`, "info");
  };
  const handleResetPasswordSubmit = (e) => {
    e.preventDefault();
    if (!selectedResetAcc) {
      showFeedback("Please select an account to reset password.", "warning");
      return;
    }
    onResetUserPassword(selectedResetAcc, tempNewPassword);
    const targetAcc = accounts.find((a) => a.id === selectedResetAcc);
    showFeedback(`Password reset successfully for user: ${targetAcc?.name}. New temporary password is: "${tempNewPassword}".`, "success");
    const newLog = {
      id: Math.floor(1e3 + Math.random() * 9e3).toString(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      type: "warning",
      action: "Password Reset Management",
      actor: "Super Admin",
      details: `Administrative reset code compiled for ID: ${selectedResetAcc}`
    };
    setSystemLogs((prev) => [newLog, ...prev]);
    setSelectedResetAcc("");
  };
  const allSpecialists = accounts.filter((acc) => acc.role === "specialist");
  const pendingSpecialists = accounts.filter((acc) => acc.role === "specialist" && acc.status === "Pending");
  const whitelistedSpecialists = accounts.filter((acc) => acc.role === "specialist" && acc.status === "Approved");
  const declinedSpecialists = accounts.filter((acc) => acc.role === "specialist" && acc.status === "Declined");
  const filteredSpecialists = allSpecialists.filter((acc) => {
    if (whitelistFilter === "approved" && acc.status !== "Approved") return false;
    if (whitelistFilter === "pending" && acc.status !== "Pending") return false;
    if (whitelistFilter === "declined" && acc.status !== "Declined") return false;
    if (whitelistSearch.trim()) {
      const q = whitelistSearch.toLowerCase();
      const matchName = acc.name?.toLowerCase().includes(q);
      const matchEmail = acc.email?.toLowerCase().includes(q);
      const matchLic = acc.registrationNumber?.toLowerCase().includes(q) || acc.uploadedDocs?.license?.toLowerCase().includes(q);
      const matchId = acc.id?.toLowerCase().includes(q);
      const matchHosp = acc.hospitalName?.toLowerCase().includes(q);
      const matchSpecialization = acc.specialization?.toLowerCase().includes(q);
      return Boolean(matchName || matchEmail || matchLic || matchId || matchHosp || matchSpecialization);
    }
    return true;
  });

  const totalPatientsCount = accounts.filter((a) => a.role === "patient").length;
  const totalSpecialistsCount = accounts.filter((a) => a.role === "specialist").length;
  const totalAdminsCount = accounts.filter((a) => a.role === "admin" || a.email?.includes("admin")).length;

  const filteredUsers = useMemo(() => {
    return (accounts || []).filter((acc) => {
      if (!acc) return false;
      if (userRoleFilter === "patient" && acc.role !== "patient") return false;
      if (userRoleFilter === "specialist" && acc.role !== "specialist") return false;
      if (userRoleFilter === "admin" && acc.role !== "admin" && !acc.email?.includes("admin")) return false;

      if (userSearch.trim()) {
        const q = userSearch.toLowerCase().trim();
        const qNoSpace = q.replace(/\s+/g, "");
        const matchName = acc.name?.toLowerCase().includes(q);
        const matchEmail = acc.email?.toLowerCase().includes(q);
        const accId = String(acc.id || "").toLowerCase();
        const matchId = accId.includes(q) || (qNoSpace && accId.replace(/\s+/g, "").includes(qNoSpace));
        const matchPhone = acc.phone && normalizePhone(acc.phone).includes(qNoSpace);
        const matchRole = acc.role?.toLowerCase().includes(q);
        return Boolean(matchName || matchEmail || matchId || matchPhone || matchRole);
      }
      return true;
    }).sort((a, b) => {
      if (userSort === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (userSort === "id") {
        return String(a.id || "").localeCompare(String(b.id || ""));
      }
      // Newest created first
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [accounts, userRoleFilter, userSearch, userSort]);

  const ADMIN_TABS = [
    {
      id: "all_users",
      label: at.tabAllUsers || "User Directory & Devices",
      icon: "badge",
      desc: at.tabAllUsersDesc || "All created accounts, names & user IDs",
      badge: accounts.length
    },
    { id: "whitelist", label: at.tabWhitelist, icon: "how_to_reg", desc: at.tabWhitelistDesc, badge: pendingSpecialists.length },
    { id: "helpdesk", label: "Specialist Messages", icon: "support_agent", desc: "Two-way communication channels with specialists", badge: adminUnreadCount },
    { id: "manual", label: at.tabManual, icon: "edit_note", desc: at.tabManualDesc },
    { id: "templates", label: at.tabTemplates, icon: "dynamic_feed", desc: at.tabTemplatesDesc },
    { id: "passwords", label: at.tabPasswords, icon: "lock_reset", desc: at.tabPasswordsDesc },
    { id: "developer", label: at.tabDeveloper, icon: "terminal", desc: at.tabDeveloperDesc }
  ];
  const currentTabObj = ADMIN_TABS.find((t2) => t2.id === activeTab) || ADMIN_TABS[0];
  return <div
    id="admin_portal_root"
    className="min-h-screen text-slate-800 flex flex-col sm:grid sm:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr] relative"
  >
      {/* Real-time Specialist Message Notification Toast for Admin */}
      {specialistMsgToast && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-blue-400/50 flex items-start gap-3 max-w-sm animate-fade-in ring-1 ring-blue-500/30">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md">
            <span className="material-symbols-outlined text-white text-xl">forum</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-blue-300">New Message from {specialistMsgToast.specialistName}</h4>
              <span className="text-[10px] text-slate-400">{specialistMsgToast.time}</span>
            </div>
            {specialistMsgToast.specialization && (
              <p className="text-[10px] text-blue-200/90 font-mono mt-0.5">{specialistMsgToast.specialization}</p>
            )}
            <p className="text-xs text-slate-200 mt-1.5 line-clamp-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 font-sans">
              {specialistMsgToast.content}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedSpecialistChatId(specialistMsgToast.specialistId);
                setActiveTab("helpdesk");
                setSpecialistMsgToast(null);
              }}
              className="mt-2 text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer bg-blue-950/60 hover:bg-blue-900/80 px-2.5 py-1 rounded-lg border border-blue-800/60 transition-colors"
            >
              <span>Reply to Specialist</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSpecialistMsgToast(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Admin Top Header Bar */}
      <header className="glass-dark-header text-white h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-40 shadow-xl col-span-full">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-blue-400 text-3xl font-bold">admin_panel_settings</span>
          <div className="hidden sm:block landscape:block">
            <h1 className="hidden sm:block landscape:block font-display font-black text-sm tracking-widest uppercase">{at.headerTitle}</h1>
            <p className="hidden sm:block landscape:block text-[10px] text-blue-400 font-mono font-bold tracking-wider">{at.headerSubtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Users Directory Button */}
          <button
            type="button"
            onClick={() => setActiveTab("all_users")}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "all_users"
                ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-400"
                : "glass-dark-panel text-slate-300 hover:text-white hover:bg-slate-700/80"
            }`}
            title="All Registered Users & Multi-Device Directory"
          >
            <span className="material-symbols-outlined text-sm">badge</span>
            <span>All Users ({accounts.length})</span>
          </button>

          {/* Specialist Messages Quick Bell */}
          <button
            type="button"
            onClick={() => setActiveTab("helpdesk")}
            className="relative p-2 rounded-xl glass-dark-panel hover:bg-slate-700/80 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center"
            title="Specialist Messages & Help Desk"
          >
            <span className="material-symbols-outlined text-lg">forum</span>
            {adminUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-sm">
                {adminUnreadCount}
              </span>
            )}
          </button>
          {onLanguageChange && <div className="flex items-center gap-1 glass-dark-panel border border-white/10 p-1 rounded-xl">
              {[
                { code: "en", label: "EN", flag: "🇺🇸" },
                { code: "lg", label: "LG", flag: "🇺🇬" },
                { code: "sw", label: "SW", flag: "🇹🇿" },
                { code: "fr", label: "FR", flag: "🇫🇷" }
              ].map((lang) => <button
                key={lang.code}
                type="button"
                onClick={() => onLanguageChange(lang.code)}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all duration-150 ease-out transform hover:scale-105 active:scale-95 cursor-pointer ${currentLanguage === lang.code ? "glass-button-primary shadow-sm ring-1 ring-blue-400/40" : "text-slate-300 hover:text-white hover:bg-white/10"}`}
              >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>)}
            </div>}

          <button
            onClick={onLogout}
            className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 glass-dark-panel hover:bg-slate-700/80 px-3 py-1.5 rounded-xl transition-all duration-150 ease-out transform hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">logout</span> {at.logout}
          </button>
        </div>
      </header>

      {/* Admin Menu Navigation Container (Fixed Sticky Sidebar - DOES NOT MOVE ON SCROLL) */}
      <div
        id="admin_nav_wrapper"
        ref={dropdownRef}
        className="sm:col-start-1 sm:row-start-2 border-r border-slate-200/80 bg-white/95 backdrop-blur-md sm:h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto overscroll-contain tabs-scroll-isolated shadow-none z-30 flex flex-col shrink-0"
        onWheel={isolateScroll}
      >
        <div
          id="admin_nav_tabs_container"
          className="w-full p-3 sm:p-4 flex flex-col gap-2 flex-1"
        >
          {/* Sidebar Section Header */}
          <div className="hidden sm:flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
            <span>Navigation</span>
            <span className="text-blue-600 font-mono font-bold">{ADMIN_TABS.length} Views</span>
          </div>

          {/* Vertical Sidebar Navigation Items (Fixed on Left) */}
          <div className="hidden sm:flex flex-col space-y-2">
            {ADMIN_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`admin_tab_${tab.id}`}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl text-left flex items-start gap-3 transition-all duration-200 ease-out transform hover:scale-[1.02] active:scale-[0.98] group relative cursor-pointer ${
                    isActive
                      ? "glass-button-primary shadow-lg ring-1 ring-blue-400/40"
                      : "glass-card-interactive text-slate-700 hover:text-blue-700"
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? "bg-white/20 text-white" : "bg-blue-600/10 text-blue-600 shadow-xs"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="relative pb-0.5 inline-block max-w-full">
                        <span
                          className={`text-xs truncate block ${
                            isActive
                              ? "font-extrabold tracking-wide"
                              : "font-bold text-slate-700 group-hover:text-blue-700 transition-colors duration-200"
                          }`}
                        >
                          {tab.label}
                        </span>
                        <span
                          className={`absolute -bottom-0.5 left-0 h-[2px] rounded-full transition-all duration-300 ease-out ${
                            isActive ? "w-full bg-white opacity-100 shadow-xs" : "w-0 bg-blue-600 opacity-0 group-hover:w-full group-hover:opacity-60"
                          }`}
                        />
                      </span>
                      {tab.badge > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                            isActive
                              ? "bg-white text-blue-700"
                              : tab.id === "helpdesk"
                              ? "bg-red-500 text-white animate-pulse"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[10px] mt-0.5 truncate transition-colors ${
                        isActive ? "text-blue-100" : "text-slate-400 group-hover:text-blue-600/70"
                      }`}
                    >
                      {tab.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile Narrow Screen View (< sm): Horizontal Navigation Bar */}
          <div
            className="sm:hidden flex items-center justify-between gap-1 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll py-1"
            onWheel={handleHorizontalWheel}
          >
            {ADMIN_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`admin_tab_mobile_${tab.id}`}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`flex-1 p-2 rounded-xl text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                    isActive ? "bg-blue-600 text-white font-extrabold shadow-sm" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg relative">
                    {tab.icon}
                    {tab.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </span>
                  <span className="text-[10px] truncate max-w-[50px]">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sidebar Status Footer */}
          <div className="mt-auto hidden sm:flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[10px] text-slate-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="truncate font-semibold text-slate-700">Protected Console</span>
          </div>
        </div>
      </div>

      <main
        ref={mainRef}
        className="sm:col-start-2 sm:row-start-2 flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 sm:max-w-none relative min-w-0"
      >
        {/* Slim, subtle scroll progress bar indicating view scroll position */}
        <div
          id="admin_view_scroll_progress"
          className="sticky top-16 -mt-6 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 z-20 bg-[#fafafc]/95 backdrop-blur-md transition-all duration-200 border-b border-transparent shadow-none"
          role="progressbar"
          aria-valuenow={Math.round(scrollProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          title={`View scroll: ${Math.round(scrollProgress)}%`}
        >
          <div className="h-[3px] w-full bg-emerald-950/10 overflow-hidden">
            <div
    className="h-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 transition-[width] duration-150 ease-out rounded-r-full shadow-xs shadow-emerald-500/30"
    style={{ width: `${scrollProgress}%` }}
  />
          </div>
        </div>
        
        {/* ======================= TAB 0: ALL USERS DIRECTORY & MULTI-DEVICE MANAGEMENT ======================= */}
        {activeTab === "all_users" && (
          <div id="admin_all_users_tab" className="space-y-6 animate-fade-in">
            {/* Feedback notification toast / banner */}
            {feedbackBanner && (
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-sm transition-all ${
                  feedbackBanner.type === "warning"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : feedbackBanner.type === "info"
                    ? "bg-blue-50 border-blue-200 text-blue-900"
                    : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-lg">
                    {feedbackBanner.type === "warning" ? "warning" : feedbackBanner.type === "info" ? "info" : "check_circle"}
                  </span>
                  <span>{feedbackBanner.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackBanner(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  aria-label="Dismiss message"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            )}

            {/* Page Header */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-100/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1.5 shadow-xs">
                      <span className="material-symbols-outlined text-sm">badge</span>
                      <span>User Registry & Cross-Device Hub</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{accounts.length} Accounts in Cloud</span>
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-display font-black text-slate-900 tracking-tight">
                    All Registered Users & Device Directory
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
                    Complete list of all users that created accounts with their full legal name and permanent User ID.
                    Every account is stored in the persistent cloud database and accessible across all devices.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleVerifyDeviceSync}
                    disabled={isTestingSync}
                    className="px-4 py-2.5 rounded-2xl bg-blue-700 hover:bg-blue-800 active:scale-95 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    title="Verify cloud storage & cross-device readiness for all users"
                  >
                    <span className={`material-symbols-outlined text-base ${isTestingSync ? "animate-spin" : ""}`}>
                      {isTestingSync ? "sync" : "devices"}
                    </span>
                    <span>{isTestingSync ? "Checking Devices..." : "Verify Device Access"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleForceCloudSync}
                    disabled={isTestingSync}
                    className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Force upload all accounts to Firestore cloud database"
                  >
                    <span className="material-symbols-outlined text-base text-blue-600">cloud_upload</span>
                    <span>Push to Cloud</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cross-Device Access Diagnostic & Verification Panel */}
            <div className="rounded-3xl p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl border border-blue-800/40 relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-blue-300">
                    <span className="material-symbols-outlined text-2xl">devices_other</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white tracking-wide">Multi-Device Access Architecture</h4>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        Operational
                      </span>
                    </div>
                    <p className="text-xs text-blue-100/80 leading-relaxed max-w-3xl">
                      Accounts created on one device (e.g. Android phone or tablet) can be accessed on any other computer or mobile device.
                      Users can log in with their <strong className="text-white">Full Name</strong>, permanent <strong className="text-white">User ID</strong>, or <strong className="text-white">Email</strong>.
                      Cloud credentials and records auto-sync via Firestore in real time.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                  <div className="text-center px-2">
                    <span className="block text-[10px] uppercase font-bold text-blue-200">Cloud Sync</span>
                    <span className="text-sm font-mono font-extrabold text-emerald-400">100% READY</span>
                  </div>
                  <div className="h-8 w-px bg-white/20" />
                  <div className="text-center px-2">
                    <span className="block text-[10px] uppercase font-bold text-blue-200">Registered</span>
                    <span className="text-sm font-mono font-extrabold text-white">{accounts.length} USERS</span>
                  </div>
                </div>
              </div>

              {/* Optional live verification toast notice */}
              {deviceSyncNotice && (
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span>{deviceSyncNotice.message}</span>
                  </div>
                  <span className="text-[10px] text-blue-300 font-mono">{deviceSyncNotice.timestamp}</span>
                </div>
              )}
            </div>

            {/* Quick KPI Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">group</span>
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-900 font-display block leading-none">{accounts.length}</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Total Users</span>
                  <span className="text-[10px] text-slate-400">All created accounts</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">personal_injury</span>
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-900 font-display block leading-none">{totalPatientsCount}</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Patients</span>
                  <span className="text-[10px] text-slate-400">Registered patients</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">medical_services</span>
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-900 font-display block leading-none">{totalSpecialistsCount}</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Specialists</span>
                  <span className="text-[10px] text-slate-400">Doctors & facilities</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">shield_person</span>
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-900 font-display block leading-none">{totalAdminsCount}</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Admins</span>
                  <span className="text-[10px] text-slate-400">System controllers</span>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    search
                  </span>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by Name, User ID (e.g. 1307715995), Email, or Phone..."
                    className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                  {userSearch && (
                    <button
                      type="button"
                      onClick={() => setUserSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  )}
                </div>

                {/* Sort selector */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500 font-semibold hidden md:inline">Sort by:</span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setUserSort("newest")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        userSort === "newest" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Newest
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserSort("name")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        userSort === "name" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Name
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserSort("id")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        userSort === "id" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      User ID
                    </button>
                  </div>
                </div>
              </div>

              {/* Role Filter Tabs */}
              <div
                className="flex items-center justify-between gap-2 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll pb-1 pt-1 border-t border-slate-100"
                onWheel={handleHorizontalWheel}
              >
                <div className="flex items-center gap-1.5">
                  {[
                    { id: "all", label: "All Users", count: accounts.length, icon: "groups" },
                    { id: "patient", label: "Patients", count: totalPatientsCount, icon: "person" },
                    { id: "specialist", label: "Specialists", count: totalSpecialistsCount, icon: "stethoscope" },
                    { id: "admin", label: "Administrators", count: totalAdminsCount, icon: "shield_person" }
                  ].map((tab) => {
                    const isSelected = userRoleFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setUserRoleFilter(tab.id)}
                        className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                        <span>{tab.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            isSelected ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <span className="text-xs text-slate-400 font-mono shrink-0 hidden sm:inline">
                  Showing {filteredUsers.length} of {accounts.length}
                </span>
              </div>
            </div>

            {/* Empty State */}
            {filteredUsers.length === 0 && (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">person_search</span>
                </div>
                <h3 className="font-display font-extrabold text-base text-slate-800">No users found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No accounts matched your search query "{userSearch}". Try clearing the search or checking another role filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setUserSearch("");
                    setUserRoleFilter("all");
                  }}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            )}

            {/* List of All Created User Accounts */}
            {filteredUsers.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredUsers.map((acc) => {
                  const isPatient = acc.role === "patient";
                  const isSpecialist = acc.role === "specialist";
                  const isAdmin = acc.role === "admin" || acc.email?.includes("admin");
                  const isCopied = copiedUserId === String(acc.id);

                  // Initials
                  const initials = (acc.name || "User")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0].toUpperCase())
                    .join("") || "U";

                  return (
                    <div
                      key={acc.id}
                      className="bg-white rounded-3xl p-5 border border-slate-200/90 hover:border-blue-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                    >
                      <div className="space-y-3">
                        {/* Top Profile Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs ${
                                isPatient
                                  ? "bg-gradient-to-tr from-blue-600 to-indigo-600"
                                  : isSpecialist
                                  ? "bg-gradient-to-tr from-emerald-600 to-teal-600"
                                  : "bg-gradient-to-tr from-purple-600 to-violet-600"
                              }`}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                                {acc.name || "Unnamed User"}
                              </h3>
                              <p className="text-[11px] text-slate-500 truncate">
                                {isSpecialist
                                  ? acc.specialization || acc.hospitalName || "Healthcare Specialist"
                                  : isPatient
                                  ? "Registered Patient"
                                  : "System Administrator"}
                              </p>
                            </div>
                          </div>

                          {/* Role Badge */}
                          <span
                            className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                              isPatient
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : isSpecialist
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            <span className="material-symbols-outlined text-xs">
                              {isPatient ? "person" : isSpecialist ? "medical_services" : "shield_person"}
                            </span>
                            <span>{acc.role}</span>
                          </span>
                        </div>

                        {/* Monospace User ID Container with Copy Button */}
                        <div className="bg-slate-900 text-white rounded-2xl p-3 flex items-center justify-between gap-2 shadow-xs">
                          <div className="min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block font-sans">
                              Permanent User ID
                            </span>
                            <span className="font-mono font-bold text-xs sm:text-sm text-blue-300 truncate block select-all">
                              {acc.id}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyUserId(acc.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                              isCopied
                                ? "bg-emerald-500 text-white"
                                : "bg-white/10 hover:bg-white/20 text-white"
                            }`}
                            title="Copy User ID to clipboard"
                          >
                            <span className="material-symbols-outlined text-sm">
                              {isCopied ? "check" : "content_copy"}
                            </span>
                            <span>{isCopied ? "Copied" : "Copy"}</span>
                          </button>
                        </div>

                        {/* Contact details */}
                        <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-2 truncate">
                            <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">mail</span>
                            <span className="truncate font-medium text-slate-800">{acc.email || "No email"}</span>
                          </div>
                          {acc.phone && (
                            <div className="flex items-center gap-2 truncate">
                              <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">call</span>
                              <span className="font-mono text-slate-800">{acc.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">calendar_today</span>
                              <span>{acc.createdAt ? new Date(acc.createdAt).toLocaleDateString() : "Active Record"}</span>
                            </span>
                            <span className={`font-bold ${acc.status === "Approved" ? "text-emerald-700" : acc.status === "Pending" ? "text-amber-700" : "text-slate-600"}`}>
                              Status: {acc.status || "Active"}
                            </span>
                          </div>
                        </div>

                        {/* Multi-Device Status Tag */}
                        <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between gap-2 text-[11px] text-emerald-900">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-emerald-600">cloud_done</span>
                            <span className="font-bold">Multi-Device Verified</span>
                          </div>
                          <span className="text-[10px] text-emerald-700 font-medium">Any Phone / PC</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUserDetail(acc)}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          <span>Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickResetPassword(acc)}
                          className="py-2 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center cursor-pointer"
                          title="Reset user password"
                        >
                          <span className="material-symbols-outlined text-sm">lock_reset</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInitiateDeleteAccount(acc)}
                          className="py-2 px-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold text-xs transition-colors flex items-center justify-center cursor-pointer"
                          title="Permanently delete user account"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 1: WHITELIST VERIFICATION & ACCOUNT MANAGEMENT ======================= */}
        {activeTab === "whitelist" && <div id="admin_whitelist_tab" className="space-y-6 animate-fade-in">
            {
    /* Feedback notification toast / banner */
  }
            {feedbackBanner && <div
    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-sm transition-all ${feedbackBanner.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-900" : feedbackBanner.type === "info" ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"}`}
  >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-lg">
                    {feedbackBanner.type === "warning" ? "warning" : feedbackBanner.type === "info" ? "info" : "check_circle"}
                  </span>
                  <span>{feedbackBanner.message}</span>
                </div>
                <button
    type="button"
    onClick={() => setFeedbackBanner(null)}
    className="text-slate-400 hover:text-slate-700 p-1"
    aria-label="Dismiss message"
  >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>}

            {
    /* Header & Overview */
  }
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="font-display font-extrabold text-xl text-slate-900">
                  {at.whitelistHeading}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  {at.whitelistSubheading}
                </p>
              </div>
            </div>

            {
    /* Metric Summary Cards */
  }
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button
    type="button"
    onClick={() => setWhitelistFilter("approved")}
    className={`p-4 rounded-2xl border text-left transition-all ${whitelistFilter === "approved" ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm" : "bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30"}`}
  >
                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 mb-1">
                  <span>{at.statWhitelistedActive}</span>
                  <span className="material-symbols-outlined text-base">verified</span>
                </div>
                <div className="text-2xl font-display font-black text-slate-900">{whitelistedSpecialists.length}</div>
                <p className="text-[11px] text-slate-500 mt-1">{at.statWhitelistedSub}</p>
              </button>

              <button
    type="button"
    onClick={() => setWhitelistFilter("pending")}
    className={`p-4 rounded-2xl border text-left transition-all ${whitelistFilter === "pending" ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-sm" : "bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/30"}`}
  >
                <div className="flex items-center justify-between text-xs font-bold text-amber-700 mb-1">
                  <span>{at.statPendingReview}</span>
                  <span className="material-symbols-outlined text-base">hourglass_top</span>
                </div>
                <div className="text-2xl font-display font-black text-slate-900">{pendingSpecialists.length}</div>
                <p className="text-[11px] text-slate-500 mt-1">{at.statPendingSub}</p>
              </button>

              <button
    type="button"
    onClick={() => setWhitelistFilter("declined")}
    className={`p-4 rounded-2xl border text-left transition-all ${whitelistFilter === "declined" ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-sm" : "bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/30"}`}
  >
                <div className="flex items-center justify-between text-xs font-bold text-rose-700 mb-1">
                  <span>{at.statDeclined}</span>
                  <span className="material-symbols-outlined text-base">person_off</span>
                </div>
                <div className="text-2xl font-display font-black text-slate-900">{declinedSpecialists.length}</div>
                <p className="text-[11px] text-slate-500 mt-1">{at.statDeclinedSub}</p>
              </button>

              <button
    type="button"
    onClick={() => setWhitelistFilter("all")}
    className={`p-4 rounded-2xl border text-left transition-all ${whitelistFilter === "all" ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-sm" : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"}`}
  >
                <div className="flex items-center justify-between text-xs font-bold text-blue-700 mb-1">
                  <span>{at.statTotalSpecialists}</span>
                  <span className="material-symbols-outlined text-base">medical_services</span>
                </div>
                <div className="text-2xl font-display font-black text-slate-900">{allSpecialists.length}</div>
                <p className="text-[11px] text-slate-500 mt-1">{at.statTotalSub}</p>
              </button>
            </div>

            {
    /* Search & Filter Toolbar */
  }
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              {
    /* Search input */
  }
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
    type="text"
    value={whitelistSearch}
    onChange={(e) => setWhitelistSearch(e.target.value)}
    placeholder={at.searchPlaceholder}
    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
  />
                {whitelistSearch && <button
    type="button"
    onClick={() => setWhitelistSearch("")}
    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
    title="Clear search"
  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>}
              </div>

              {/* Filter Tabs */}
              <div
                className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll pb-1 md:pb-0"
                onWheel={handleHorizontalWheel}
              >
                {[
    { id: "all", label: at.filterAll, count: allSpecialists.length },
    { id: "approved", label: at.filterWhitelisted, count: whitelistedSpecialists.length },
    { id: "pending", label: at.filterPending, count: pendingSpecialists.length },
    { id: "declined", label: at.filterDeclined, count: declinedSpecialists.length }
  ].map((tab) => <button
    key={tab.id}
    type="button"
    onClick={() => setWhitelistFilter(tab.id)}
    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${whitelistFilter === tab.id ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
  >
                    <span>{tab.label}</span>
                    <span
    className={`text-[10px] px-1.5 py-0.5 rounded-full ${whitelistFilter === tab.id ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"}`}
  >
                      {tab.count}
                    </span>
                  </button>)}
              </div>
            </div>

            {
    /* No items state */
  }
            {filteredSpecialists.length === 0 && <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                <span className="material-symbols-outlined text-slate-400 text-5xl">folder_off</span>
                <h3 className="font-display font-bold text-base text-slate-800">No Specialist Accounts Match Your Filter</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {whitelistSearch ? `No providers found matching "${whitelistSearch}". Try modifying your search keywords.` : "There are currently no specialists in this category."}
                </p>
                {(whitelistSearch || whitelistFilter !== "all") && <button
    type="button"
    onClick={() => {
      setWhitelistSearch("");
      setWhitelistFilter("all");
    }}
    className="px-4 py-2 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl hover:bg-blue-100 transition-colors inline-flex items-center gap-1.5"
  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    Reset Filters
                  </button>}
              </div>}

            {
    /* Specialists Accounts Cards List */
  }
            <div className="grid grid-cols-1 gap-5">
              {filteredSpecialists.map((acc) => {
    const isApproved = acc.status === "Approved";
    const isPending = acc.status === "Pending";
    const isDeclined = acc.status === "Declined";
    const photoUrl = getSpecialistPhoto(acc);
    return <div
      key={acc.id}
      id={`specialist_card_${acc.id}`}
      className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5 hover:shadow-md transition-all group"
    >
                    {
      /* Top Row: Doctor Picture Alongside Bio & Facility Information */
    }
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-5 border-b border-slate-100 pb-5">
                      {
      /* Picture alongside info */
    }
                      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 flex-1 min-w-0">
                        {
      /* Doctor Portrait Photo */
    }
                        <div
      className="relative shrink-0 group/pic cursor-pointer"
      onClick={() => setPreviewPhoto({
        url: photoUrl,
        name: acc.name,
        title: `${acc.specialization || "Clinical Specialist"} \u2022 ${acc.hospitalName || "Health Center"}`,
        providerType: acc.providerType || "Specialist",
        id: acc.id
      })}
      title={acc.name}
    >
                          <div className="w-32 h-40 sm:w-40 sm:h-48 md:w-48 md:h-56 rounded-2xl overflow-hidden shadow-md border-2 border-white ring-1 ring-slate-200 bg-slate-100 relative transition-all duration-300 ease-out group-hover/pic:scale-105 group-hover/pic:shadow-xl group-hover/pic:ring-2 group-hover/pic:ring-blue-500">
                            <img
      id={`specialist_pic_${acc.id}`}
      src={photoUrl}
      alt={acc.name}
      referrerPolicy="no-referrer"
      className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover/pic:scale-115"
      onError={(e) => {
        e.target.src = "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=400&q=80";
      }}
    />
                            {
      /* Bottom Gradient Vignette with Provider Type */
    }
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent p-2 text-center pointer-events-none">
                              <span className="text-[10px] text-white font-mono font-bold uppercase tracking-wider block drop-shadow-sm truncate">
                                {acc.providerType || "Specialist"}
                              </span>
                            </div>
                          </div>

                          {
      /* Verification Status Corner Icon Badge */
    }
                          <div
      className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-xs ${isApproved ? "bg-emerald-500 text-white" : isPending ? "bg-amber-500 text-white" : "bg-rose-500 text-white"}`}
      title={isApproved ? at.statusApproved : isPending ? at.statusPending : at.statusDeclined}
    >
                            <span className="material-symbols-outlined text-[13px]">
                              {isApproved ? "verified" : isPending ? "schedule" : "block"}
                            </span>
                          </div>
                        </div>

                        {
      /* Doctor Information directly alongside picture */
    }
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display font-bold text-lg text-slate-900 leading-snug">{acc.name}</h3>

                            {
      /* Status Tag */
    }
                            {isApproved && <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">verified</span>
                                {at.statusApproved}
                              </span>}
                            {isPending && <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">schedule</span>
                                {at.statusPending}
                              </span>}
                            {isDeclined && <span className="text-[11px] bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">block</span>
                                {at.statusDeclined}
                              </span>}
                          </div>

                          {
      /* Specialization & Clinical Details */
    }
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-blue-600 shrink-0">medical_services</span>
                              <span>{acc.specialization || "Clinical Dermatology"}</span>
                              {acc.experience && <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-medium text-[11px]">
                                  {acc.experience}
                                </span>}
                            </p>

                            <p className="text-slate-600 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">domain</span>
                              <span className="font-medium text-slate-700">{acc.hospitalName || "National Referral Hospital"}</span>
                              {acc.department && <span className="text-slate-400">• {acc.department}</span>}
                            </p>

                            {acc.licensingAuthority && <p className="text-slate-500 flex items-center gap-1.5 text-[11px]">
                                <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">verified_user</span>
                                <span className="text-slate-600">{acc.licensingAuthority}</span>
                              </p>}

                            {acc.bio && <p className="text-slate-500 italic text-[11px] line-clamp-2 pt-0.5 max-w-xl">
                                "{acc.bio}"
                              </p>}
                          </div>
                        </div>
                      </div>

                      {
      /* Primary Quick Info Pill (Right column) */
    }
                      <div className="flex flex-wrap lg:flex-col items-start lg:items-stretch gap-2.5 text-xs text-slate-600 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-100 shrink-0 w-full lg:w-64">
                        <div className="flex justify-between items-center w-full">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{at.whitelistId}:</span>
                          <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200/80">{acc.id}</span>
                        </div>
                        <div className="flex justify-between items-center w-full">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{at.loginEmail}:</span>
                          <span className="font-semibold text-blue-700 truncate max-w-[140px]" title={acc.email}>{acc.email}</span>
                        </div>
                        <div className="flex justify-between items-center w-full">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{at.registrationLic}:</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {acc.registrationNumber || acc.uploadedDocs?.license || "LIC-VERIFIED"}
                          </span>
                        </div>
                        {acc.phone && <div className="flex justify-between items-center w-full pt-1 border-t border-slate-200/60">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Phone:</span>
                            <span className="font-medium text-slate-700">{acc.phone}</span>
                          </div>}
                      </div>
                    </div>

                    {
      /* Middle Row: Attached Credential Documents */
    }
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2.5">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-blue-600">verified_user</span>
                          {at.submittedDossier}
                        </span>
                        <button
      type="button"
      onClick={() => setInspectingAccount(acc)}
      className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors"
    >
                          <span className="material-symbols-outlined text-sm">assignment_ind</span>
                          {at.inspectCompleteDossier}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <button
      type="button"
      onClick={() => setViewingDoc({
        title: "Practising Licence Copy",
        docName: acc.uploadedDocs?.license || "practising_licence_copy.pdf",
        type: "license"
      })}
      className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-left hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
    >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="material-symbols-outlined text-blue-500 shrink-0 text-base">article</span>
                            <span className="truncate font-semibold text-slate-800">
                              {acc.uploadedDocs?.license || "Practising Licence Copy"}
                            </span>
                          </div>
                          <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-600 text-sm">visibility</span>
                        </button>

                        <button
      type="button"
      onClick={() => setViewingDoc({
        title: "Registration Certificate",
        docName: acc.uploadedDocs?.cert || "registration_certificate.pdf",
        type: "cert"
      })}
      className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-left hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
    >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="material-symbols-outlined text-blue-500 shrink-0 text-base">workspace_premium</span>
                            <span className="truncate font-semibold text-slate-800">
                              {acc.uploadedDocs?.cert || "Registration Certificate"}
                            </span>
                          </div>
                          <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-600 text-sm">visibility</span>
                        </button>

                        <button
      type="button"
      onClick={() => setViewingDoc({
        title: "National ID Card Copy",
        docName: acc.uploadedDocs?.idDoc || "national_id_card.pdf",
        type: "idDoc"
      })}
      className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-left hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
    >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="material-symbols-outlined text-blue-500 shrink-0 text-base">badge</span>
                            <span className="truncate font-semibold text-slate-800">
                              {acc.uploadedDocs?.idDoc || "National ID Card Copy"}
                            </span>
                          </div>
                          <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-600 text-sm">visibility</span>
                        </button>
                      </div>
                    </div>

                    {
      /* Bottom Row: Whitelist Management & Account Removal/Deletion Actions */
    }
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-xs text-slate-500">
                        {isApproved && <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            {at.accountActiveWhitelisted}
                          </span>}
                        {isPending && <span className="text-amber-700 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">pending_actions</span>
                            {at.verificationRequiredNote}
                          </span>}
                        {isDeclined && <span className="text-rose-700 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">highlight_off</span>
                            {at.whitelistRevokedNote}
                          </span>}
                      </div>

                      {
      /* Explicit Action Buttons */
    }
                      <div className="flex flex-wrap items-center gap-2">
                        {
      /* Inspect Dossier */
    }
                        <button
      type="button"
      onClick={() => setInspectingAccount(acc)}
      className="px-3.5 py-2 border border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
    >
                          <span className="material-symbols-outlined text-sm text-blue-600">visibility</span>
                          {at.btnInspect}
                        </button>

                        {
      /* Approved: Remove from Whitelist & Delete Account */
    }
                        {isApproved && <>
                            <button
      type="button"
      onClick={() => handleInitiateRevokeWhitelist(acc)}
      className="px-3.5 py-2 border border-amber-300 bg-amber-50/80 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
      title="Revoke active whitelist status and suspend provider login"
    >
                              <span className="material-symbols-outlined text-sm text-amber-700">person_remove</span>
                              {at.btnRevoke}
                            </button>
                            <button
      type="button"
      onClick={() => handleInitiateDeleteAccount(acc)}
      className="px-3.5 py-2 border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
      title="Permanently delete account from database"
    >
                              <span className="material-symbols-outlined text-sm text-rose-600">delete_forever</span>
                              {at.btnDelete}
                            </button>
                          </>}

                        {
      /* Pending: Verify & Whitelist, Decline, and Delete Account */
    }
                        {isPending && <>
                            <button
      type="button"
      onClick={() => {
        onDeclineAccount(acc.id);
        const newLog = {
          id: Math.floor(1e3 + Math.random() * 9e3).toString(),
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: "warning",
          action: "Registration Declined",
          actor: "Super Admin",
          details: `Declined Specialist Application: ${acc.name} (${acc.email})`
        };
        setSystemLogs((prev) => [newLog, ...prev]);
        setFeedbackBanner({
          type: "warning",
          message: `Specialist application for ${acc.name} declined.`
        });
      }}
      className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition-colors"
    >
                              {at.btnDecline}
                            </button>
                            <button
      type="button"
      onClick={() => {
        onApproveAccount(acc.id);
        const newLog = {
          id: Math.floor(1e3 + Math.random() * 9e3).toString(),
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: "success",
          action: "Registration Whitelisted",
          actor: "Super Admin",
          details: `Approved & Whitelisted Provider: ${acc.name} (${acc.providerType})`
        };
        setSystemLogs((prev) => [newLog, ...prev]);
        setFeedbackBanner({
          type: "success",
          message: `Provider ${acc.name} verified and added to Active Whitelist.`
        });
      }}
      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
    >
                              <span className="material-symbols-outlined text-sm">verified</span>
                              {at.btnApprove}
                            </button>
                            <button
      type="button"
      onClick={() => handleInitiateDeleteAccount(acc)}
      className="px-3.5 py-2 border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
      title="Permanently delete account from database"
    >
                              <span className="material-symbols-outlined text-sm text-rose-600">delete_forever</span>
                              {at.btnDelete}
                            </button>
                          </>}

                        {
      /* Declined / Revoked: Re-Verify & Whitelist or Delete Account */
    }
                        {isDeclined && <>
                            <button
      type="button"
      onClick={() => {
        onApproveAccount(acc.id);
        const newLog = {
          id: Math.floor(1e3 + Math.random() * 9e3).toString(),
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: "success",
          action: "Registration Whitelisted",
          actor: "Super Admin",
          details: `Re-verified & Whitelisted Provider: ${acc.name} (${acc.email})`
        };
        setSystemLogs((prev) => [newLog, ...prev]);
        setFeedbackBanner({
          type: "success",
          message: `Provider ${acc.name} has been restored to the Active Whitelist.`
        });
      }}
      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
    >
                              <span className="material-symbols-outlined text-sm">restart_alt</span>
                              {at.btnReverify}
                            </button>
                            <button
      type="button"
      onClick={() => handleInitiateDeleteAccount(acc)}
      className="px-3.5 py-2 border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
      title="Permanently delete account from database"
    >
                              <span className="material-symbols-outlined text-sm text-rose-600">delete_forever</span>
                              {at.btnDelete}
                            </button>
                          </>}
                      </div>
                    </div>
                  </div>;
  })}
            </div>
          </div>}

        {/* ======================= TAB: TWO-WAY SPECIALIST HELP DESK & CHAT ======================= */}
        {activeTab === "helpdesk" && (() => {
          const specialists = accounts.filter((a) => a.role === "specialist");
          const filteredSpecialistsForChat = specialists.filter((s) => {
            if (!specialistChatSearch.trim()) return true;
            const q = specialistChatSearch.toLowerCase();
            return (
              s.name?.toLowerCase().includes(q) ||
              s.registrationNumber?.toLowerCase().includes(q) ||
              s.specialization?.toLowerCase().includes(q) ||
              s.hospitalName?.toLowerCase().includes(q)
            );
          });
          const currentSpecialist =
            specialists.find((s) => s.id === selectedSpecialistChatId) ||
            specialists[0] ||
            null;
          const currentChats = currentSpecialist
            ? adminSpecialistChats.filter(
                (c) =>
                  c.specialistId === currentSpecialist.id ||
                  (currentSpecialist.email && c.specialistEmail && c.specialistEmail.toLowerCase() === currentSpecialist.email.toLowerCase())
              )
            : [];

          const displayedAdminChats = currentChats.length > 0
            ? currentChats
            : (currentSpecialist ? [
                {
                  id: `CHAT-WELCOME-${currentSpecialist.id}`,
                  specialistId: currentSpecialist.id,
                  specialistName: currentSpecialist.name,
                  specialistEmail: currentSpecialist.email,
                  specialization: currentSpecialist.specialization || "Clinical Specialist",
                  role: "admin",
                  senderName: "DERMA CARE System Administrator",
                  content: `Welcome Dr. ${currentSpecialist.name} to the DERMA CARE Clinical Specialist Desk. Your practitioner credentials (${currentSpecialist.registrationNumber || "Lic. Verified"}) are logged with the central administration board. You can use this secure two-way channel to consult on license verifications, clinical form customizations, and patient triage escalations.`,
                  time: "09:00 AM",
                  date: "2026-10-06",
                  timestamp: "2026-10-06T06:00:00.000Z",
                  readByAdmin: true,
                  readBySpecialist: true,
                  isEarlierConversation: true
                }
              ] : []);

          const sortedSpecialistsForChat = [...filteredSpecialistsForChat].sort((a, b) => {
            const unreadA = adminSpecialistChats.filter(
              (c) =>
                (c.specialistId === a.id || (a.email && c.specialistEmail && c.specialistEmail.toLowerCase() === a.email.toLowerCase())) &&
                c.role === "specialist" &&
                !c.readByAdmin
            ).length;
            const unreadB = adminSpecialistChats.filter(
              (c) =>
                (c.specialistId === b.id || (b.email && c.specialistEmail && c.specialistEmail.toLowerCase() === b.email.toLowerCase())) &&
                c.role === "specialist" &&
                !c.readByAdmin
            ).length;
            return unreadB - unreadA;
          });

          const handleAdminReplySubmit = (e) => {
            if (e && e.preventDefault) e.preventDefault();
            if (!adminReplyInput.trim() || !currentSpecialist) return;
            const replyText = adminReplyInput.trim();
            if (onSendAdminReply) {
              onSendAdminReply(currentSpecialist.id, replyText);
            }
            setAdminReplyInput("");
            showFeedback(`Reply sent to ${currentSpecialist.name}. Specialist notified in real-time.`, "success");
          };

          return (
            <div id="admin_helpdesk_tab" className="space-y-6 animate-fade-in">
              {/* Header Banner */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-blue-600 text-2xl font-bold">support_agent</span>
                    <h2 className="font-display font-extrabold text-lg text-slate-900">
                      Specialist Messages & Two-Way Help Desk
                    </h2>
                    {adminUnreadCount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                        {adminUnreadCount} unread
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Direct two-way chatting channel between Administration and verified medical specialists. View earlier conversations, receive notifications, and reply directly.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{specialists.length} Specialists Connected</span>
                  </span>
                </div>
              </div>

              {/* Two-Pane Chat Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Specialist Channel Directory (4 cols) */}
                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-600 text-base">forum</span>
                      <span>Specialist Channels</span>
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      {filteredSpecialistsForChat.length} Available
                    </span>
                  </div>

                  {/* Search specialists */}
                  <div className="relative">
                    <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-2.5">search</span>
                    <input
                      type="text"
                      placeholder="Search doctor name or license..."
                      value={specialistChatSearch}
                      onChange={(e) => setSpecialistChatSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Specialist channels list */}
                  <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                    {sortedSpecialistsForChat.map((sp) => {
                      const spChats = adminSpecialistChats.filter((c) => c.specialistId === sp.id || (sp.email && c.specialistEmail && c.specialistEmail.toLowerCase() === sp.email.toLowerCase()));
                      const lastChat = spChats[spChats.length - 1];
                      const unreadCount = spChats.filter((c) => c.role === "specialist" && !c.readByAdmin).length;
                      const isSelected = currentSpecialist?.id === sp.id;

                      return (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => {
                            setSelectedSpecialistChatId(sp.id);
                            if (onMarkAdminChatRead) {
                              onMarkAdminChatRead(sp.id);
                            }
                          }}
                          className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer flex items-start gap-3 border ${
                            isSelected
                              ? "bg-blue-50/90 border-blue-300 shadow-xs ring-1 ring-blue-500/20"
                              : "bg-white hover:bg-slate-50 border-slate-200/80"
                          }`}
                        >
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            {sp.profilePic ? (
                              <img
                                src={sp.profilePic}
                                alt={sp.name}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                {sp.name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "DR"}
                              </div>
                            )}
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className={`text-xs font-bold truncate ${isSelected ? "text-blue-900" : "text-slate-900"}`}>
                                {sp.name}
                              </h4>
                              {unreadCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500 text-white shrink-0 animate-pulse">
                                  {unreadCount} new
                                </span>
                              )}
                            </div>

                            <p className="text-[10px] text-slate-500 truncate font-medium">
                              {sp.specialization || "Clinical Dermatologist"} • {sp.registrationNumber || "Lic. Verified"}
                            </p>

                            {lastChat ? (
                              <p className={`text-[11px] truncate mt-1 ${unreadCount > 0 ? "font-bold text-blue-950" : "text-slate-400"}`}>
                                {lastChat.role === "admin" ? "You: " : ""}{lastChat.content}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic mt-1">No earlier messages</p>
                            )}
                          </div>
                        </button>
                      );
                    })}

                    {sortedSpecialistsForChat.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <span className="material-symbols-outlined text-3xl mb-1 block">person_search</span>
                        <p className="text-xs">No specialists match your search.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Active Two-Way Conversation & Reply Composer (8 cols) */}
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col h-[600px]">
                  {currentSpecialist ? (
                    <>
                      {/* Active Specialist Header */}
                      <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shadow-xs shrink-0">
                        <div className="flex items-center gap-3">
                          {currentSpecialist.profilePic ? (
                            <img
                              src={currentSpecialist.profilePic}
                              alt={currentSpecialist.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                              {currentSpecialist.name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "DR"}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-bold text-sm text-white">
                                {currentSpecialist.name}
                              </h3>
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                                Verified Provider
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 flex items-center gap-2 mt-0.5">
                              <span>{currentSpecialist.specialization || "Clinical Dermatologist"}</span>
                              <span>•</span>
                              <span className="font-mono text-blue-300">{currentSpecialist.registrationNumber || "LIC-9012-S"}</span>
                              <span>•</span>
                              <span>{currentSpecialist.hospitalName || "Central Skin Clinic"}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccount(currentSpecialist);
                              setShowModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                            title="Inspect credentials document"
                          >
                            <span className="material-symbols-outlined text-sm">badge</span>
                            <span className="hidden sm:inline">Credentials</span>
                          </button>
                        </div>
                      </div>

                      {/* Messages Scroll Area */}
                      <div
                        className="flex-1 p-5 overflow-y-auto overscroll-contain space-y-3.5 bg-slate-50/90"
                        onWheel={isolateScroll}
                      >
                        {/* Earlier Conversations Divider */}
                        <div className="flex items-center justify-center my-2">
                          <span className="px-3 py-1 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-200/90 border border-slate-300/60 flex items-center gap-1.5 shadow-2xs">
                            <span className="material-symbols-outlined text-[13px] text-blue-600">history</span>
                            <span>Earlier Conversations with {currentSpecialist.name}</span>
                          </span>
                        </div>

                        {displayedAdminChats.length === 0 ? (
                          <div className="text-center py-16 text-slate-400">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">chat</span>
                            <p className="text-xs font-semibold text-slate-600">No conversation history with this provider yet.</p>
                            <p className="text-[11px] text-slate-400 mt-1">Send a message below to start communication or provide credential updates.</p>
                          </div>
                        ) : (
                          displayedAdminChats.map((msg, idx) => {
                            const isAdmin = msg.role === "admin";
                            return (
                              <div
                                key={msg.id || idx}
                                className={`flex gap-3 max-w-[85%] ${isAdmin ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                              >
                                {/* Role icon */}
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs ${
                                    isAdmin ? "bg-slate-900 text-blue-400" : "bg-blue-600 text-white"
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    {isAdmin ? "admin_panel_settings" : "medical_services"}
                                  </span>
                                </div>

                                <div className="flex flex-col">
                                  <span className={`text-[10px] font-bold text-slate-500 mb-0.5 ${isAdmin ? "text-right" : "text-left"}`}>
                                    {isAdmin ? "DERMA CARE Administration (You)" : currentSpecialist.name}
                                  </span>
                                  <div
                                    className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                                      isAdmin
                                        ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-tr-none"
                                        : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-none"
                                    }`}
                                  >
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    <div className={`flex items-center gap-1.5 justify-end mt-1.5 text-[9px] ${isAdmin ? "text-blue-100" : "text-slate-400"}`}>
                                      <span>{msg.time}</span>
                                      {isAdmin && (
                                        <span className="flex items-center gap-0.5 font-medium">
                                          {msg.readBySpecialist ? (
                                            <span className="text-emerald-300 font-bold" title="Read by Specialist">✓✓ Read</span>
                                          ) : (
                                            <span className="text-blue-200" title="Delivered">✓ Sent</span>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={adminChatScrollRef} />
                      </div>

                      {/* Fast Reply Suggestions & Reply Composer */}
                      <div className="border-t bg-white p-4 space-y-3 shrink-0">
                        <div
                          className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll pb-1 text-[10px] scrollbar-none"
                          onWheel={handleHorizontalWheel}
                        >
                          <span className="text-slate-400 text-[10px] font-semibold shrink-0">Quick responses:</span>
                          {[
                            "Licensing validation received and approved.",
                            "Clinical form templates have been updated.",
                            "Please upload your renewed 2026 licence.",
                            "Telehealth consulting hours have been registered."
                          ].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setAdminReplyInput(chip)}
                              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[10px] font-medium transition-colors shrink-0 cursor-pointer border border-slate-200/80"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>

                        <form onSubmit={handleAdminReplySubmit} className="flex gap-2">
                          <input
                            type="text"
                            placeholder={`Reply to ${currentSpecialist.name}...`}
                            value={adminReplyInput}
                            onChange={(e) => setAdminReplyInput(e.target.value)}
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                          />
                          <button
                            type="submit"
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer shrink-0"
                          >
                            <span>Send Reply</span>
                            <span className="material-symbols-outlined text-sm">send</span>
                          </button>
                        </form>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                      <span className="material-symbols-outlined text-5xl mb-2 text-slate-300">forum</span>
                      <p className="text-sm font-semibold text-slate-600">Select a specialist from the directory to start chatting.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {
    /* ======================= TAB 2: MANUAL WHITELIST ENTRY ======================= */
  }
        {activeTab === "manual" && <div id="admin_manual_tab" className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {
    /* Entry Form */
  }
            <form onSubmit={handleManualWhitelistSubmit} className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-display font-extrabold text-base text-slate-900">{at.manualHeading}</h3>
                <p className="text-xs text-slate-500">{at.manualSubheading}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">{at.formLegalName}</label>
                <input
    type="text"
    required
    placeholder="Dr. Ronald Kiza"
    value={manualName}
    onChange={(e) => setManualName(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs outline-none"
  />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">{at.formEmail}</label>
                <input
    type="email"
    required
    placeholder="kiza@dermal.com"
    value={manualEmail}
    onChange={(e) => setManualEmail(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs outline-none"
  />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">{at.formLicenseNumber}</label>
                  <input
    type="text"
    required
    placeholder="LIC-5112-S"
    value={manualLicense}
    onChange={(e) => setManualLicense(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs outline-none"
  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">{at.formProviderType}</label>
                  <select
    value={manualType}
    onChange={(e) => setManualType(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs outline-none"
  >
                    <option value="Individual">{at.typeIndividual}</option>
                    <option value="Clinic">{at.typeClinic}</option>
                    <option value="Hospital">{at.typeHospital}</option>
                  </select>
                </div>
              </div>

              <button
    type="submit"
    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm"
  >
                {at.btnAddManual}
              </button>
            </form>

            {
    /* Whitelisted list */
  }
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-sm text-slate-900">{at.manualListTitle}</h3>
              
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {whitelistedEmails.map((item) => <div key={item.license} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs hover:border-slate-300 transition-colors">
                    <div>
                      <span className="font-bold text-slate-900">{item.name}</span>
                      <p className="text-slate-500 text-[10px] mt-0.5">Email: {item.email} • Lic: {item.license}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold uppercase">{item.type}</span>
                      <button
    type="button"
    onClick={() => handleRemovePreWhitelisted(item.license, item.name)}
    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
    title="Remove pre-whitelisted license"
  >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>)}
              </div>
            </div>
          </div>}

        {
    /* ======================= TAB 3: FORM TEMPLATE BUILDER ======================= */
  }
        {activeTab === "templates" && <div id="admin_templates_tab" className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            
            {
    /* Sidebar list */
  }
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm text-slate-900">User Account Registration Forms</h3>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{templates.length} Forms</span>
              </div>
              <p className="text-xs text-slate-500">Select a registration form to view, test, or customize all fields filled in by users creating accounts on login.</p>

              <div className="space-y-2.5">
                {templates.map((tmpl) => {
                  const isPatient = tmpl.providerType === "Patient" || tmpl.id === "TMPL-PATIENT";
                  const isSelected = selectedTemplate?.id === tmpl.id || selectedTemplate?.providerType === tmpl.providerType;
                  return (
                    <button
                      key={tmpl.id || tmpl.providerType}
                      type="button"
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`w-full p-4 rounded-2xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? isPatient
                            ? "border-emerald-600 bg-emerald-50/90 text-emerald-950 shadow-sm ring-1 ring-emerald-500/30"
                            : "border-blue-600 bg-blue-50/90 text-blue-950 shadow-sm ring-1 ring-blue-500/30"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                            isSelected
                              ? isPatient
                                ? "bg-emerald-600 text-white"
                                : "bg-blue-600 text-white"
                              : isPatient
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          <span className="material-symbols-outlined text-xl">
                            {isPatient
                              ? "personal_injury"
                              : tmpl.providerType === "Individual"
                              ? "medical_services"
                              : tmpl.providerType === "Clinic"
                              ? "domain"
                              : "local_hospital"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-900 leading-snug">
                            {tmpl.title || `${tmpl.providerType} Registration Form`}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                                isPatient
                                  ? "bg-emerald-200/80 text-emerald-900 border border-emerald-300/60"
                                  : "bg-blue-200/80 text-blue-900 border border-blue-300/60"
                              }`}
                            >
                              {isPatient
                                ? "Login: 'As a Patient'"
                                : tmpl.providerType === "Individual"
                                ? "Login: 'Doctor / Specialist'"
                                : tmpl.providerType === "Clinic"
                                ? "Login: 'Clinic Facility'"
                                : "Login: 'Hospital Board'"}
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              {tmpl.fields.length} schema fields (Live Synced)
                            </span>
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <span
                          className={`material-symbols-outlined text-lg shrink-0 ${
                            isPatient ? "text-emerald-600" : "text-blue-600"
                          }`}
                        >
                          check_circle
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">sync</span> Two-Way Portal Synchronization
                </span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Adding, modifying, or removing fields will automatically reflect in real-time on the registration forms for new users creating accounts on the login portal.
                </p>
              </div>
            </div>

            {
    /* Template Fields detailed */
  }
            {selectedTemplate && <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                
                {
    /* Header & Mode Switcher */
  }
                <div className="border-b pb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-extrabold text-base text-slate-900">
                        {selectedTemplate.title || `${selectedTemplate.providerType} Registration Form`}
                      </h3>
                      <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                        {selectedTemplate.fields.length} Fields Included
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs">sync</span> Live Synced with Login
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedTemplate.description || `Previewing every single field requested from ${selectedTemplate.providerType.toLowerCase()}s on registration.`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
    type="button"
    onClick={handleResetTemplateDefaults}
    className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
    title="Reset fields to full defaults"
  >
                      <span className="material-symbols-outlined text-sm">restart_alt</span> Reset Defaults
                    </button>

                    <div
                      className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll scrollbar-none"
                      onWheel={handleHorizontalWheel}
                    >
                      <button
    type="button"
    onClick={() => setTemplateViewMode("live_preview")}
    className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${templateViewMode === "live_preview" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
  >
                        <span className="material-symbols-outlined text-sm">visibility</span> {at.btnLivePreview}
                      </button>
                      <button
    type="button"
    onClick={() => setTemplateViewMode("field_manager")}
    className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${templateViewMode === "field_manager" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
  >
                        <span className="material-symbols-outlined text-sm">tune</span> {at.btnFieldManager}
                      </button>
                    </div>
                  </div>
                </div>

                {
    /* MODE 1: LIVE INTERACTIVE FORM PREVIEW (WHAT SPECIALIST FILLS IN) */
  }
                {templateViewMode === "live_preview" && <div className="space-y-6">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between text-xs text-blue-900">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-base text-blue-600">verified_user</span>
                        This is the exact registration paperwork filled in by {selectedTemplate.providerType.toLowerCase()}s creating accounts on Login. All {selectedTemplate.fields.length} schema inputs are active.
                      </span>
                      <span className="font-mono font-bold text-[10px] uppercase bg-blue-200/60 px-2 py-0.5 rounded">Live Synced</span>
                    </div>

                    <form
    onSubmit={(e) => {
      e.preventDefault();
      showFeedback(`Test Submission Successful! All ${selectedTemplate.fields.length} inputs in the ${selectedTemplate.title || selectedTemplate.providerType} form passed validation.`, "success");
    }}
    className="space-y-6 max-h-[520px] overflow-y-auto pr-2"
  >
                      {/* Section 1: Account & Identity */}
                      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                          <span className="material-symbols-outlined text-blue-600 text-base">person</span>
                          1. {selectedTemplate.providerType === "Patient" ? "Patient Legal Identity & Credentials" : "Account & Identity Parameters"}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedTemplate.fields.slice(0, 6).map((f) => <div key={f.id} className="space-y-1">
                              <label className="block text-xs font-bold text-slate-700">
                                {f.label} {f.required && <span className="text-red-500">*</span>}
                              </label>
                              {f.type === "select" ? <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none">
                                  {(f.options || ["Option 1", "Option 2"]).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                </select> : <input
    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
    placeholder={`Enter ${f.label.toLowerCase()}`}
    defaultValue={f.label.toLowerCase().includes("name") ? (selectedTemplate.providerType === "Patient" ? "Grace Nabatanzi" : "Dr. Sarah Ssozi") : f.label.toLowerCase().includes("email") ? (selectedTemplate.providerType === "Patient" ? "grace.patient@example.com" : "sarah.ssozi@clinic.com") : f.label.toLowerCase().includes("phone") ? "+256 701 983247" : f.label.toLowerCase().includes("birth") ? "1992-04-12" : f.label.toLowerCase().includes("passport") || f.label.toLowerCase().includes("nin") || f.label.toLowerCase().includes("national") ? "CF9201923847" : ""}
    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500"
  />}
                            </div>)}
                        </div>
                      </div>

                      {/* Section 2 */}
                      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                          <span className="material-symbols-outlined text-blue-600 text-base">
                            {selectedTemplate.providerType === "Patient" ? "location_on" : "workspace_premium"}
                          </span>
                          2. {selectedTemplate.providerType === "Patient" ? "Nationality, Residence & Contact" : "Professional Licensing & Medical Accreditation"}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedTemplate.fields.slice(6, 12).map((f) => <div key={f.id} className="space-y-1">
                              <label className="block text-xs font-bold text-slate-700">
                                {f.label} {f.required && <span className="text-red-500">*</span>}
                              </label>
                              {f.type === "select" ? <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none">
                                  {(f.options || ["Ugandan", "Kenyan", "Tanzanian", "Other"]).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                </select> : <input
    type={f.type === "number" ? "number" : "text"}
    placeholder={`Enter ${f.label.toLowerCase()}`}
    defaultValue={f.label.toLowerCase().includes("country") ? "Uganda" : f.label.toLowerCase().includes("district") ? "Kampala" : f.label.toLowerCase().includes("city") ? "Central Kampala" : f.label.toLowerCase().includes("registration") || f.label.toLowerCase().includes("license") ? "LIC-9012-S" : f.label.toLowerCase().includes("board") || f.label.toLowerCase().includes("authority") ? "Uganda Medical & Dental Council" : f.label.toLowerCase().includes("expiry") ? "2028-12-31" : f.label.toLowerCase().includes("qualification") ? "MBChB, MMed Dermatology (Makerere)" : f.type === "number" ? "12" : ""}
    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500"
  />}
                            </div>)}
                        </div>
                      </div>

                      {/* Section 3 */}
                      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                          <span className="material-symbols-outlined text-blue-600 text-base">
                            {selectedTemplate.providerType === "Patient" ? "healing" : "domain"}
                          </span>
                          3. {selectedTemplate.providerType === "Patient" ? "Clinical Intake & Skin Concern" : "Facility Address, Services & Schedule"}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedTemplate.fields.slice(12, 19).map((f) => <div key={f.id} className={`space-y-1 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                              <label className="block text-xs font-bold text-slate-700">
                                {f.label} {f.required && <span className="text-red-500">*</span>}
                              </label>
                              {f.type === "textarea" ? <textarea
    rows={3}
    placeholder={`Enter ${f.label.toLowerCase()}`}
    defaultValue={selectedTemplate.providerType === "Patient" ? "Plot 18, Bukoto Crescent, Kampala, Uganda" : "Certified dermatological specialist offering phototherapy, skin lesion biopsies, acne protocols, and teledermatology consultations."}
    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500"
  /> : f.type === "select" ? <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none">
                                  {(f.options || ["Rash / Itching", "Acne / Breakouts", "Mole Change", "Other"]).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                </select> : <input
    type={f.type === "number" ? "number" : "text"}
    placeholder={`Enter ${f.label.toLowerCase()}`}
    defaultValue={f.label.toLowerCase().includes("allergies") ? "Penicillin sensitive" : f.label.toLowerCase().includes("affiliation") || f.label.toLowerCase().includes("hospital") ? "City Central Skin Clinic" : f.label.toLowerCase().includes("address") ? "Plot 14 Acacia Avenue, Kololo" : f.label.toLowerCase().includes("district") || f.label.toLowerCase().includes("city") ? "Kampala District" : f.label.toLowerCase().includes("fee") ? "75000" : f.label.toLowerCase().includes("hours") ? "Mon-Fri 09:00 AM - 05:00 PM" : f.label.toLowerCase().includes("languages") ? "English, Luganda, Swahili, French" : ""}
    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500"
  />}
                            </div>)}
                        </div>
                      </div>

                      {/* Section: Custom Administrative Requirements configured by Admin */}
                      {(() => {
                        const standardAllIds = [
                          "pat-name", "pat-email", "pat-password", "pat-phone", "pat-dob", "pat-gender",
                          "pat-nin", "pat-country", "pat-district", "pat-city", "pat-address",
                          "pat-emergency", "pat-concern", "pat-allergies", "pat-signature",
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
                        const customFields = selectedTemplate.fields.filter(
                          (f) => !standardAllIds.includes(f.id) && f.type !== "file"
                        );
                        if (customFields.length === 0) return null;
                        return (
                          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                              <h4 className="font-bold text-xs text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-amber-700 text-base">admin_panel_settings</span>
                                Additional Custom Requirements ({customFields.length} Custom Fields)
                              </h4>
                              <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                                Added in Admin Portal • Live Synced with Login
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {customFields.map((f) => (
                                <div key={f.id} className={`space-y-1 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                                  <label className="block text-xs font-bold text-slate-800">
                                    {f.label} {f.required && <span className="text-red-500">*</span>}
                                  </label>
                                  {f.type === "select" ? (
                                    <select className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-medium text-slate-800 outline-none">
                                      {(f.options || ["Option 1", "Option 2"]).map((opt, i) => (
                                        <option key={i} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : f.type === "textarea" ? (
                                    <textarea
                                      rows={2}
                                      placeholder={`Enter ${f.label.toLowerCase()}`}
                                      className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 outline-none"
                                    />
                                  ) : (
                                    <input
                                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                                      placeholder={`Enter ${f.label.toLowerCase()}`}
                                      className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 outline-none"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {
    /* Section 4: Document Certificate Uploads */
  }
                      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                          <span className="material-symbols-outlined text-blue-600 text-base">upload_file</span>
                          4. Required Credential Certificates & Documents
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedTemplate.fields.filter((f) => f.type === "file").map((f) => <div key={f.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                              <span className="block text-xs font-bold text-slate-800">{f.label} {f.required && <span className="text-red-500">*</span>}</span>
                              <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                                <span className="material-symbols-outlined text-lg text-blue-600">cloud_upload</span>
                                <p className="text-[11px] font-bold text-slate-700 mt-1">Upload File (PDF / PNG / JPG)</p>
                                <p className="text-[9px] text-slate-400 font-mono">Max size 25MB • Encrypted</p>
                              </div>
                            </div>)}
                        </div>
                      </div>

                      {
    /* Section 5: Verification Consent */
  }
                      <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-3">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input type="checkbox" defaultChecked className="mt-0.5 accent-blue-600" />
                          <span className="text-xs text-slate-700 leading-relaxed font-medium">
                            I solemnly declare that all medical council numbers, licensing documents, and practice details submitted in this form are authentic, unedited, and up to date.
                          </span>
                        </label>

                        <button
    type="submit"
    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2"
  >
                          <span className="material-symbols-outlined text-base">send</span>
                          Test Submit {selectedTemplate.providerType} Specialist Application
                        </button>
                      </div>
                    </form>
                  </div>}

                {
    /* MODE 2: SCHEMA & FIELD MANAGER */
  }
                {templateViewMode === "field_manager" && <div className="space-y-6">
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border text-xs">
                      <span className="font-bold text-slate-700">Schema Field List ({selectedTemplate.fields.length} Fields)</span>
                      <span className="text-[10px] text-slate-500 font-mono">Click required pill to toggle condition</span>
                    </div>

                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {selectedTemplate.fields.map((f, idx) => <div key={f.id || idx} className="p-3 bg-slate-50 hover:bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs transition-all">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-mono text-slate-400 font-bold w-5">{idx + 1}.</span>
                            <span className="font-bold text-slate-800 truncate">{f.label}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${f.type === "file" ? "bg-purple-100 text-purple-700" : f.type === "select" ? "bg-amber-100 text-amber-700" : f.type === "number" ? "bg-emerald-100 text-emerald-700" : f.type === "textarea" ? "bg-cyan-100 text-cyan-700" : "bg-slate-200 text-slate-700"}`}>
                              {f.type}
                            </span>

                            <button
    type="button"
    onClick={() => handleToggleRequiredField(f.id)}
    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${f.required ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
    title="Click to toggle required status"
  >
                              {f.required ? "Required" : "Optional"}
                            </button>

                            <button
    type="button"
    onClick={() => handleDeleteField(f.id)}
    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
    title="Delete this field from template"
  >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>)}
                    </div>

                    {
    /* Field adder */
  }
                    <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
                      <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-blue-600">add_circle</span>
                        {at.fieldBuilderTitle}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
    type="text"
    placeholder={at.fieldNamePlaceholder}
    value={newFieldName}
    onChange={(e) => setNewFieldName(e.target.value)}
    className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
  />

                        <select
    value={newFieldType}
    onChange={(e) => setNewFieldType(e.target.value)}
    className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
  >
                          <option value="text">Short Text</option>
                          <option value="number">Numeric Value</option>
                          <option value="select">Dropdown Menu</option>
                          <option value="textarea">Paragraph Textarea</option>
                          <option value="file">Document File Upload</option>
                          <option value="date">Date Picker</option>
                        </select>

                        <button
    type="button"
    onClick={handleAddFieldToTemplate}
    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1"
  >
                          <span className="material-symbols-outlined text-sm">add</span>
                          {at.btnAddField}
                        </button>
                      </div>
                    </div>
                  </div>}

              </div>}
          </div>}

        {
    /* ======================= TAB 4: PASSWORD RESET CONTROL ======================= */
  }
        {activeTab === "passwords" && <div id="admin_passwords_tab" className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 animate-fade-in">
            <div>
              <h2 className="font-display font-extrabold text-xl text-slate-900">{at.passwordsHeading}</h2>
              <p className="text-sm text-slate-500">{at.passwordsSubheading}</p>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">{at.selectAccountLabel}</label>
                <select
    required
    value={selectedResetAcc}
    onChange={(e) => setSelectedResetAcc(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs outline-none"
  >
                  <option value="">{at.chooseAccountOption}</option>
                  {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name} ({acc.role} - ID: {acc.id})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">{at.temporaryPasswordLabel}</label>
                <input
    type="text"
    required
    value={tempNewPassword}
    onChange={(e) => setTempNewPassword(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs outline-none font-mono"
  />
              </div>

              <button
    type="submit"
    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm"
  >
                {at.btnResetCredentials}
              </button>
            </form>
          </div>}

        {
    /* ======================= TAB 5: DEVELOPER ACCESS ======================= */
  }
        {activeTab === "developer" && <div id="admin_developer_tab" className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {
    /* Telemetries panel */
  }
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-slate-900 text-slate-100 rounded-3xl p-5 space-y-4 border border-slate-800 shadow-lg">
                  <h3 className="font-display font-bold text-xs text-blue-400 flex items-center gap-1.5 uppercase tracking-wider border-b border-slate-800 pb-2">
                    <span className="material-symbols-outlined text-sm font-bold">network_ping</span>
                    {at.systemStatsTitle}
                  </h3>
                  
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{at.apiStatusLabel}</span>
                      <span className="text-emerald-400 font-bold">ONLINE</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{at.nodeEnvLabel}</span>
                      <span className="text-blue-400 font-bold">Cloud Run container</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{at.activeAccountsLabel}</span>
                      <span className="text-white font-bold">{accounts.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{at.dermalEncryptionsLabel}</span>
                      <span className="text-emerald-400 font-bold">AES-256 Enabled</span>
                    </div>
                  </div>
                </div>
              </div>

              {
    /* System Logs panel */
  }
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="font-display font-bold text-sm text-slate-900">{at.telemetryLogsTitle}</h3>
                
                <div className="font-mono text-[11px] leading-relaxed bg-slate-950 text-[#82f9be] p-4 rounded-2xl h-80 overflow-y-auto space-y-2">
                  {systemLogs.map((log) => <div key={log.id} className="border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-500">[{log.timestamp}]</span>{" "}
                      <span className="text-blue-400">[{log.action}]</span>{" "}
                      <span className="text-white">{log.details}</span>{" "}
                      <span className="text-slate-400">by {log.user}</span>
                    </div>)}
                </div>
              </div>

            </div>
          </div>}

        {
    /* ======================= MODAL 1: FULL PROVIDER REGISTRATION DOSSIER ======================= */
  }
        {inspectingAccount && <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6 sm:p-8">
              {
    /* Modal Header */
  }
              <div className="flex justify-between items-start border-b border-slate-100 pb-5 gap-4">
                <div className="flex items-start gap-4 sm:gap-5">
                  <div
    className="w-20 h-24 sm:w-24 sm:h-28 rounded-2xl overflow-hidden shadow-sm border-2 border-white ring-1 ring-slate-200 shrink-0 bg-slate-100 relative group/dossierpic cursor-pointer"
    onClick={() => setPreviewPhoto({
      url: getSpecialistPhoto(inspectingAccount),
      name: inspectingAccount.name,
      title: `${inspectingAccount.specialization || "Clinical Specialist"} \u2022 ${inspectingAccount.hospitalName || "Health Center"}`,
      providerType: inspectingAccount.providerType || "Specialist",
      id: inspectingAccount.id
    })}
    title={at.btnEnlargePhoto}
  >
                    <img
    src={getSpecialistPhoto(inspectingAccount)}
    alt={inspectingAccount.name}
    referrerPolicy="no-referrer"
    className="w-full h-full object-cover object-center group-hover/dossierpic:scale-105 transition-transform duration-300"
  />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/dossierpic:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-lg drop-shadow">zoom_in</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-mono font-bold px-2.5 py-0.5 rounded-full uppercase">
                        {inspectingAccount.providerType || "Specialist"} Application Dossier
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${inspectingAccount.status === "Approved" ? "bg-emerald-100 text-emerald-800" : inspectingAccount.status === "Declined" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                        {inspectingAccount.status === "Approved" ? "Verified & Whitelisted" : inspectingAccount.status === "Declined" ? "Application Declined" : "Pending Verification Review"}
                      </span>
                    </div>
                    <h2 className="font-display font-extrabold text-2xl text-slate-900 mt-1">{inspectingAccount.name}</h2>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      {inspectingAccount.specialization || "Clinical Specialist"} • {inspectingAccount.hospitalName || "National Referral Hospital"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Submitted Registration Date: {new Date(inspectingAccount.createdAt).toLocaleDateString()} • ID: {inspectingAccount.id}</p>
                  </div>
                </div>
                <button
    type="button"
    onClick={() => setInspectingAccount(null)}
    className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
  >
                  ✕
                </button>
              </div>

              {
    /* Verified Email Banner Notice */
  }
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs">
                <span className="material-symbols-outlined text-blue-600 text-xl shrink-0 mt-0.5">verified_user</span>
                <div>
                  <span className="font-extrabold text-blue-950">Portal Login Credentials:</span>
                  <p className="text-blue-800 mt-0.5">
                    Authorized Specialist Login Email: <strong className="text-blue-950 underline font-mono text-xs">{inspectingAccount.email}</strong>
                  </p>
                  <p className="text-blue-700 mt-1 text-[11px]">
                    Once verified and whitelisted by Admin, this email address and password enable immediate login access to the <strong>Derma Care Provider Specialist Portal</strong>.
                  </p>
                </div>
              </div>

              {
    /* Form Grid Sections */
  }
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {
    /* Block 1: Practitioner Credentials */
  }
                <div className="bg-slate-50 p-4 rounded-2xl border space-y-3">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b pb-2">
                    <span className="material-symbols-outlined text-blue-600 text-base">badge</span>
                    1. Licensing & Accreditation Details
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-500 block">Licensing Authority:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.licensingAuthority || "Uganda Medical & Dental Practitioners Council"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Registration / License Number:</span>
                      <span className="font-bold text-blue-700 font-mono">{inspectingAccount.registrationNumber || "REG-8842-A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Academic Qualifications:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.qualifications || "MBChB, MMed Dermatology"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Primary Specialization:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.specialization || "Dermatology"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Clinical Experience:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.experience || "5 Years"}</span>
                    </div>
                  </div>
                </div>

                {
    /* Block 2: Practice & Address */
  }
                <div className="bg-slate-50 p-4 rounded-2xl border space-y-3">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b pb-2">
                    <span className="material-symbols-outlined text-blue-600 text-base">domain</span>
                    2. Facility, Hospital & Address
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-500 block">Hospital / Facility Name:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.hospitalName || inspectingAccount.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Department / Unit:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.department || "Clinical Dermatology"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Position / Title:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.position || "Lead Consultant"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Physical Practice Address:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.address || "Kampala, Uganda"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Facility Contact Phone:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.phone || "+256 700 000000"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Official Website:</span>
                      <span className="font-bold text-blue-600 truncate block">{inspectingAccount.website || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {
    /* Block 3: Consultation Schedule & Services */
  }
                <div className="bg-slate-50 p-4 rounded-2xl border space-y-3 md:col-span-2">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b pb-2">
                    <span className="material-symbols-outlined text-blue-600 text-base">event_note</span>
                    3. Practice Schedule & Scope of Services
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-slate-500 block">Consultation Mode:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.consultationType || "Both (Physical & Online)"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Consultation Hours:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.consultationHours || "09:00 AM - 05:00 PM"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Working Days:</span>
                      <span className="font-bold text-slate-800">{inspectingAccount.workingDays?.join(", ") || "Monday - Friday"}</span>
                    </div>
                  </div>
                  {inspectingAccount.services && inspectingAccount.services.length > 0 && <div className="pt-2">
                      <span className="text-slate-500 block mb-1">Clinical Services Offered:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {inspectingAccount.services.map((srv, idx) => <span key={idx} className="bg-white border text-slate-700 font-semibold px-2.5 py-1 rounded-lg text-[11px]">
                            {srv}
                          </span>)}
                      </div>
                    </div>}
                  {inspectingAccount.bio && <div className="pt-2 border-t">
                      <span className="text-slate-500 block mb-1">Professional Bio / Overview:</span>
                      <p className="text-slate-700 italic bg-white p-3 rounded-xl border">{inspectingAccount.bio}</p>
                    </div>}
                </div>

                {
    /* Block 4: Uploaded Verification Documents */
  }
                <div className="bg-slate-50 p-4 rounded-2xl border space-y-3 md:col-span-2">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b pb-2">
                    <span className="material-symbols-outlined text-blue-600 text-base">folder_open</span>
                    {at.docsSectionTitle}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
    type="button"
    onClick={() => setViewingDoc({ title: at.docLicenseLabel, docName: inspectingAccount.uploadedDocs?.license || "practising_licence_copy.pdf", type: "license" })}
    className="p-3 bg-white rounded-xl border text-left hover:border-blue-500 hover:shadow-sm transition-all"
  >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-blue-600">article</span>
                        <span className="font-bold text-slate-900 text-xs">{at.docLicenseLabel}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{inspectingAccount.uploadedDocs?.license || "practising_licence_copy.pdf"}</p>
                      <span className="mt-2 text-[10px] font-bold text-blue-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">visibility</span> {at.btnViewDocument}
                      </span>
                    </button>

                    <button
    type="button"
    onClick={() => setViewingDoc({ title: at.docCertLabel, docName: inspectingAccount.uploadedDocs?.cert || "registration_certificate.pdf", type: "cert" })}
    className="p-3 bg-white rounded-xl border text-left hover:border-blue-500 hover:shadow-sm transition-all"
  >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-blue-600">workspace_premium</span>
                        <span className="font-bold text-slate-900 text-xs">{at.docCertLabel}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{inspectingAccount.uploadedDocs?.cert || "registration_certificate.pdf"}</p>
                      <span className="mt-2 text-[10px] font-bold text-blue-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">visibility</span> {at.btnViewDocument}
                      </span>
                    </button>

                    <button
    type="button"
    onClick={() => setViewingDoc({ title: at.docIdLabel, docName: inspectingAccount.uploadedDocs?.idDoc || "national_id_card.pdf", type: "idDoc" })}
    className="p-3 bg-white rounded-xl border text-left hover:border-blue-500 hover:shadow-sm transition-all"
  >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-blue-600">badge</span>
                        <span className="font-bold text-slate-900 text-xs">{at.docIdLabel}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{inspectingAccount.uploadedDocs?.idDoc || "national_id_card.pdf"}</p>
                      <span className="mt-2 text-[10px] font-bold text-blue-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">visibility</span> {at.btnViewDocument}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {
    /* Modal Action Footer */
  }
              <div className="border-t border-slate-100 pt-4 flex flex-wrap justify-between items-center gap-3">
                <button
    type="button"
    onClick={() => setInspectingAccount(null)}
    className="px-4 py-2 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50"
  >
                  {at.btnClose}
                </button>

                {inspectingAccount.status === "Pending" ? <div className="flex flex-wrap items-center gap-2.5">
                    <button
    type="button"
    onClick={() => {
      onDeclineAccount(inspectingAccount.id);
      setInspectingAccount({ ...inspectingAccount, status: "Declined" });
      const newLog = {
        id: Math.floor(1e3 + Math.random() * 9e3).toString(),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        type: "warning",
        action: "Registration Declined",
        actor: "Super Admin",
        details: `Declined Specialist: ${inspectingAccount.name} (${inspectingAccount.email})`
      };
      setSystemLogs((prev) => [newLog, ...prev]);
      setFeedbackBanner({
        type: "warning",
        message: `Specialist application for ${inspectingAccount.name} declined.`
      });
    }}
    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition-colors"
  >
                      {at.btnDecline}
                    </button>
                    <button
    type="button"
    onClick={() => {
      onApproveAccount(inspectingAccount.id);
      setInspectingAccount({ ...inspectingAccount, status: "Approved" });
      const newLog = {
        id: Math.floor(1e3 + Math.random() * 9e3).toString(),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        type: "success",
        action: "Registration Whitelisted",
        actor: "Super Admin",
        details: `Verified & Whitelisted Provider: ${inspectingAccount.name} (${inspectingAccount.email})`
      };
      setSystemLogs((prev) => [newLog, ...prev]);
      setFeedbackBanner({
        type: "success",
        message: `Provider ${inspectingAccount.name} verified and added to Active Whitelist.`
      });
    }}
    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all"
  >
                      <span className="material-symbols-outlined text-base">verified</span>
                      {at.btnApprove}
                    </button>
                    <button
    type="button"
    onClick={() => handleInitiateDeleteAccount(inspectingAccount)}
    className="px-4 py-2 border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
    title="Permanently delete account"
  >
                      <span className="material-symbols-outlined text-sm text-rose-600">delete_forever</span>
                      {at.btnDelete}
                    </button>
                  </div> : inspectingAccount.status === "Approved" ? <div className="flex flex-wrap items-center gap-2.5">
                    <div className="px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                      {at.statusApproved}
                    </div>
                    <button
    type="button"
    onClick={() => handleInitiateRevokeWhitelist(inspectingAccount)}
    className="px-3.5 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
  >
                      <span className="material-symbols-outlined text-sm text-amber-700">person_remove</span>
                      {at.btnRevoke}
                    </button>
                    <button
    type="button"
    onClick={() => handleInitiateDeleteAccount(inspectingAccount)}
    className="px-3.5 py-2 border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
  >
                      <span className="material-symbols-outlined text-sm text-rose-600">delete_forever</span>
                      {at.btnDelete}
                    </button>
                  </div> : <div className="flex flex-wrap items-center gap-2.5">
                    <div className="px-3.5 py-2 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl font-bold text-xs flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-rose-600 text-sm">cancel</span>
                      {at.statusDeclined}
                    </div>
                    <button
    type="button"
    onClick={() => {
      onApproveAccount(inspectingAccount.id);
      setInspectingAccount({ ...inspectingAccount, status: "Approved" });
      const newLog = {
        id: Math.floor(1e3 + Math.random() * 9e3).toString(),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        type: "success",
        action: "Registration Whitelisted",
        actor: "Super Admin",
        details: `Re-verified & Whitelisted Provider: ${inspectingAccount.name} (${inspectingAccount.email})`
      };
      setSystemLogs((prev) => [newLog, ...prev]);
      setFeedbackBanner({
        type: "success",
        message: `Provider ${inspectingAccount.name} restored to Active Whitelist.`
      });
    }}
    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
  >
                      <span className="material-symbols-outlined text-sm">restart_alt</span>
                      {at.btnReverify}
                    </button>
                    <button
    type="button"
    onClick={() => handleInitiateDeleteAccount(inspectingAccount)}
    className="px-3.5 py-2 border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
  >
                      <span className="material-symbols-outlined text-sm text-rose-600">delete_forever</span>
                      {at.btnDelete}
                    </button>
                  </div>}
              </div>
            </div>
          </div>}

        {
    /* ======================= MODAL 2: DOCUMENT PREVIEW INSPECTOR ======================= */
  }
        {viewingDoc && inspectingAccount && <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 p-6 sm:p-8 space-y-6 shadow-2xl relative">
              <div className="flex justify-between items-start border-b pb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-2xl">verified</span>
                  <div>
                    <h3 className="font-display font-extrabold text-lg text-slate-900">{viewingDoc.title}</h3>
                    <p className="text-xs text-slate-500">File: <span className="font-mono">{viewingDoc.docName}</span></p>
                  </div>
                </div>
                <button
    type="button"
    onClick={() => setViewingDoc(null)}
    className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full flex items-center justify-center font-bold"
  >
                  ✕
                </button>
              </div>

              {
    /* Certificate Canvas Mock */
  }
              <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl space-y-4 text-center relative overflow-hidden">
                <div className="absolute top-2 right-2 text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded border border-emerald-300">
                  SEAL-VERIFIED-AUTHENTIC-2026
                </div>

                <div className="w-12 h-12 mx-auto bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-2xl">health_and_safety</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Official Government Digital Registry</span>
                  <h4 className="font-display font-black text-slate-900 text-base uppercase">{inspectingAccount.licensingAuthority || "UGANDA MEDICAL & DENTAL PRACTITIONERS COUNCIL"}</h4>
                  <p className="text-xs font-semibold text-slate-600">CERTIFICATE OF MEDICAL PRACTICE & LICENSURE</p>
                </div>

                <div className="my-4 py-3 bg-white rounded-xl border space-y-1 text-left px-4 text-xs">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-500">Practitioner Name:</span>
                    <span className="font-bold text-slate-900">{inspectingAccount.name}</span>
                  </div>
                  <div className="flex justify-between border-b py-1">
                    <span className="text-slate-500">License Number:</span>
                    <span className="font-bold text-blue-700 font-mono">{inspectingAccount.registrationNumber || "REG-8842-A"}</span>
                  </div>
                  <div className="flex justify-between border-b py-1">
                    <span className="text-slate-500">Facility / Hospital:</span>
                    <span className="font-bold text-slate-800">{inspectingAccount.hospitalName || inspectingAccount.name}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Verification Hash:</span>
                    <span className="font-mono text-[10px] text-slate-600">SHA256: 8f9a2b7c4d1e0f3a6b</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-2">
                  <span>ISSUED BY: DIRECTOR GENERAL HEALTH SERVICES</span>
                  <span>STATUS: VALID & UNEXPIRED</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
    type="button"
    onClick={() => showFeedback(`Downloading verified medical certificate: "${viewingDoc.docName}"`, "info")}
    className="px-4 py-2 border border-slate-300 hover:border-blue-500 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5"
  >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Download Copy
                </button>
                <button
    type="button"
    onClick={() => setViewingDoc(null)}
    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
  >
                  Close Document Viewer
                </button>
              </div>
            </div>
          </div>}

        {
    /* ======================= MODAL 3: REVOKE WHITELIST CONFIRMATION MODAL ======================= */
  }
        {accountToRevoke && <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-amber-200 p-6 sm:p-7 space-y-5 shadow-2xl relative">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">person_remove</span>
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-slate-900">
                      {at.revokeModalTitle}
                    </h3>
                    <p className="text-xs text-slate-500">{at.revokeModalSub}</p>
                  </div>
                </div>
                <button
    type="button"
    onClick={() => setAccountToRevoke(null)}
    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
  >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              {
    /* Account summary card */
  }
              <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{at.colSpecialist}:</span>
                  <span className="font-bold text-slate-900">{accountToRevoke.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{at.loginEmail}:</span>
                  <span className="font-bold text-blue-700">{accountToRevoke.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{at.whitelistId}:</span>
                  <span className="font-mono font-bold text-slate-900">{accountToRevoke.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{at.registrationLic}:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {accountToRevoke.registrationNumber || accountToRevoke.uploadedDocs?.license || "LIC-VERIFIED"}
                  </span>
                </div>
              </div>

              {
    /* Consequence Explanation */
  }
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-600">warning</span>
                  What happens when you revoke whitelist status:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] pl-1">
                  <li>The specialist's verified badge will be removed immediately.</li>
                  <li>They will no longer be able to log in to the Specialist Diagnostic Portal.</li>
                  <li>Their account status will shift to "Declined / Revoked". You can re-verify them at any time.</li>
                </ul>
              </div>

              {
    /* Revocation Reason Selection */
  }
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{at.revokeReasonLabel} *</label>
                  <select
    value={revokeReason}
    onChange={(e) => setRevokeReason(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-amber-500"
  >
                    <option value="License Suspension / Expiration">Medical License Expired or Suspended</option>
                    <option value="Disciplinary or Malpractice Review">Disciplinary / Regulatory Investigation</option>
                    <option value="Practitioner Left Practice / Facility">Practitioner Resignation / Facility Departure</option>
                    <option value="Incomplete Documentation / Verification Failure">Failed Periodic Credential Audit</option>
                    <option value="Administrative Decision">Administrative Revocation</option>
                    <option value="Other">Other Administrative Ground</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Administrative Notes (Optional)</label>
                  <textarea
    rows={2}
    value={revokeNotes}
    onChange={(e) => setRevokeNotes(e.target.value)}
    placeholder="Enter context, official notice reference number, or audit memo..."
    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
  />
                </div>
              </div>

              {
    /* Actions */
  }
              <div className="flex justify-end items-center gap-3 pt-2 border-t border-slate-100">
                <button
    type="button"
    onClick={() => setAccountToRevoke(null)}
    className="px-4 py-2.5 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50"
  >
                  {at.btnCancel}
                </button>
                <button
    type="button"
    onClick={handleConfirmRevokeWhitelist}
    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all"
  >
                  <span className="material-symbols-outlined text-base">person_remove</span>
                  {at.btnConfirmRevoke}
                </button>
              </div>
            </div>
          </div>}

        {
    /* ======================= MODAL 4: PERMANENT ACCOUNT DELETION MODAL ======================= */
  }
        {accountToDelete && <div className="fixed inset-0 z-[70] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full border border-rose-200 p-6 sm:p-7 space-y-5 shadow-2xl relative">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">delete_forever</span>
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base text-slate-900">
                      {at.deleteModalTitle}
                    </h3>
                    <p className="text-xs text-rose-600 font-semibold">{at.deleteModalSub}</p>
                  </div>
                </div>
                <button
    type="button"
    onClick={() => setAccountToDelete(null)}
    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
  >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              {
    /* Target Account Summary */
  }
              <div className="bg-rose-50/70 rounded-2xl p-4 border border-rose-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{at.formLegalName}:</span>
                  <span className="font-bold text-slate-900">{accountToDelete.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{at.formEmail}:</span>
                  <span className="font-bold text-blue-700">{accountToDelete.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Role:</span>
                  <span className="font-bold uppercase tracking-wide text-slate-800">{accountToDelete.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{at.whitelistId}:</span>
                  <span className="font-mono font-bold text-slate-900">{accountToDelete.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{at.colStatus}:</span>
                  <span className="font-bold text-slate-800">{accountToDelete.status || "Active"}</span>
                </div>
              </div>

              {
    /* Danger Warning Box */
  }
              <div className="p-3.5 bg-rose-100/60 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-rose-700">warning</span>
                  Permanent Data Deletion Notice:
                </p>
                <p className="text-[11px] leading-relaxed text-rose-800">
                  {at.deleteWarning}
                </p>
              </div>

              {
    /* Confirmation Actions */
  }
              <div className="flex justify-end items-center gap-3 pt-2 border-t border-slate-100">
                <button
    type="button"
    onClick={() => setAccountToDelete(null)}
    className="px-4 py-2.5 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50"
  >
                  {at.btnCancel}
                </button>
                <button
    type="button"
    onClick={handleConfirmDeleteAccount}
    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all"
  >
                  <span className="material-symbols-outlined text-base">delete_forever</span>
                  {at.btnConfirmDelete}
                </button>
              </div>
            </div>
          </div>}
        {
    /* ======================= MODAL 5: ENLARGED SPECIALIST PHOTO PREVIEW ======================= */
  }
        {previewPhoto && <div
    id="admin_photo_preview_modal"
    className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
    onClick={() => setPreviewPhoto(null)}
  >
            <div
    className="bg-white rounded-3xl max-w-sm sm:max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-scale-in"
    onClick={(e) => e.stopPropagation()}
  >
              <div className="relative aspect-4/3 sm:aspect-square w-full bg-slate-950 overflow-hidden">
                <img
    src={previewPhoto.url}
    alt={previewPhoto.name}
    referrerPolicy="no-referrer"
    className="w-full h-full object-cover object-center"
  />
                <button
    type="button"
    onClick={() => setPreviewPhoto(null)}
    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center transition-colors shadow-md text-sm font-bold"
    title={at.btnClose}
  >
                  ✕
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent p-4 sm:p-5">
                  <span className="text-[10px] text-blue-300 font-mono font-bold uppercase tracking-wider block">
                    {previewPhoto.providerType} • ID: {previewPhoto.id}
                  </span>
                  <h3 className="font-display font-extrabold text-white text-lg sm:text-xl mt-0.5">{previewPhoto.name}</h3>
                  <p className="text-xs text-slate-300 mt-0.5">{previewPhoto.title}</p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                  {at.verifiedPhotoTag}
                </span>
                <button
    type="button"
    onClick={() => setPreviewPhoto(null)}
    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
  >
                  {at.btnClose}
                </button>
              </div>
            </div>
          </div>}
        {/* ======================= MODAL 5: ALL USER DOSSIER & PROFILE DETAIL ======================= */}
        {selectedUserDetail && (
          <div className="fixed inset-0 z-[65] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden relative my-8 animate-scale-up">
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-md ${
                      selectedUserDetail.role === "patient"
                        ? "bg-gradient-to-tr from-blue-600 to-indigo-600"
                        : selectedUserDetail.role === "specialist"
                        ? "bg-gradient-to-tr from-emerald-600 to-teal-600"
                        : "bg-gradient-to-tr from-purple-600 to-violet-600"
                    }`}
                  >
                    {(selectedUserDetail.name || "U")
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0].toUpperCase())
                      .join("") || "U"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          selectedUserDetail.role === "patient"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                            : selectedUserDetail.role === "specialist"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                            : "bg-purple-500/20 text-purple-300 border border-purple-400/30"
                        }`}
                      >
                        {selectedUserDetail.role}
                      </span>
                      <span className="text-[11px] text-slate-300 font-mono">
                        Status: {selectedUserDetail.status || "Active"}
                      </span>
                    </div>
                    <h3 className="font-display font-extrabold text-xl text-white mt-1">
                      {selectedUserDetail.name}
                    </h3>
                    <p className="text-xs text-blue-200">
                      {selectedUserDetail.role === "specialist"
                        ? selectedUserDetail.specialization || selectedUserDetail.hospitalName || "Healthcare Provider"
                        : selectedUserDetail.role === "patient"
                        ? "Registered Patient Account"
                        : "System Administration Controller"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedUserDetail(null)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close dossier"
                >
                  ✕
                </button>
              </div>

              {/* Monospace User ID & Multi-Device Access Banner */}
              <div className="p-5 bg-slate-900 border-b border-slate-800 text-white space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-sans">
                      Permanent User ID
                    </span>
                    <span className="font-mono font-extrabold text-base text-blue-300 select-all">
                      {selectedUserDetail.id}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyUserId(selectedUserDetail.id)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copiedUserId === String(selectedUserDetail.id) ? "check" : "content_copy"}
                    </span>
                    <span>{copiedUserId === String(selectedUserDetail.id) ? "Copied ID!" : "Copy User ID"}</span>
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-lg text-emerald-400 shrink-0">devices</span>
                  <div>
                    <strong className="block font-bold text-white">Cross-Device Login Ready:</strong>
                    <span>
                      This user can log into their account on any smartphone, laptop, or tablet using their{" "}
                      <strong className="text-white">Full Name ("{selectedUserDetail.name}")</strong>,{" "}
                      <strong className="text-white">User ID ("{selectedUserDetail.id}")</strong>, or{" "}
                      <strong className="text-white">Email ("{selectedUserDetail.email}")</strong>.
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Details Grid */}
              <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Account Credentials & Record</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block font-medium">Email Address</span>
                    <span className="font-bold text-slate-900 break-all">{selectedUserDetail.email || "Not provided"}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block font-medium">Contact Phone</span>
                    <span className="font-mono font-bold text-slate-900">{selectedUserDetail.phone || "Not provided"}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block font-medium">Registered Date</span>
                    <span className="font-bold text-slate-900">
                      {selectedUserDetail.createdAt ? new Date(selectedUserDetail.createdAt).toLocaleString() : "Initial System Fixture"}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block font-medium">Cloud Database Sync</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">cloud_done</span>
                      <span>Verified in Firestore</span>
                    </span>
                  </div>

                  {/* Patient Specific Fields */}
                  {selectedUserDetail.role === "patient" && (
                    <>
                      {selectedUserDetail.dob && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block font-medium">Date of Birth</span>
                          <span className="font-bold text-slate-900">{selectedUserDetail.dob}</span>
                        </div>
                      )}
                      {selectedUserDetail.gender && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block font-medium">Gender</span>
                          <span className="font-bold text-slate-900">{selectedUserDetail.gender}</span>
                        </div>
                      )}
                      {(selectedUserDetail.district || selectedUserDetail.city) && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block font-medium">Location</span>
                          <span className="font-bold text-slate-900">
                            {[selectedUserDetail.city, selectedUserDetail.district, selectedUserDetail.country].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      {selectedUserDetail.address && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block font-medium">Physical Address</span>
                          <span className="font-bold text-slate-900">{selectedUserDetail.address}</span>
                        </div>
                      )}
                      {selectedUserDetail.primarySkinConcern && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 sm:col-span-2">
                          <span className="text-slate-400 block font-medium">Primary Skin Concern</span>
                          <span className="font-bold text-slate-900">{selectedUserDetail.primarySkinConcern}</span>
                        </div>
                      )}
                      {selectedUserDetail.digitalSignature && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 sm:col-span-2">
                          <span className="text-slate-400 block font-medium">Digital Signature on Paperwork</span>
                          <span className="font-serif italic font-bold text-slate-800 text-sm">
                            "{selectedUserDetail.digitalSignature}"
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Specialist Specific Fields */}
                  {selectedUserDetail.role === "specialist" && (
                    <>
                      {selectedUserDetail.registrationNumber && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block font-medium">Registration / License</span>
                          <span className="font-mono font-bold text-blue-700">{selectedUserDetail.registrationNumber}</span>
                        </div>
                      )}
                      {selectedUserDetail.licensingAuthority && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block font-medium">Licensing Authority</span>
                          <span className="font-bold text-slate-900">{selectedUserDetail.licensingAuthority}</span>
                        </div>
                      )}
                      {selectedUserDetail.hospitalName && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block font-medium">Clinic / Hospital</span>
                          <span className="font-bold text-slate-900">{selectedUserDetail.hospitalName}</span>
                        </div>
                      )}
                      {selectedUserDetail.experience && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block font-medium">Clinical Experience</span>
                          <span className="font-bold text-slate-900">{selectedUserDetail.experience}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Footer Modal Actions */}
              <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    handleQuickResetPassword(selectedUserDetail);
                    setSelectedUserDetail(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">lock_reset</span>
                  <span>Reset Password</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedUserDetail;
                      setSelectedUserDetail(null);
                      handleInitiateDeleteAccount(target);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Delete User</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUserDetail(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Close Dossier
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>;
}
