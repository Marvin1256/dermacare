import { useState, useEffect, useRef, useMemo } from "react";
import { translations, defaultClinics, defaultHospitals, defaultSpecialists, defaultLibrary } from "../data";
import { generatePatientDiagnosticPDF } from "../utils/reportPdfGenerator";
import { playNotificationChime } from "../utils/audioChime";
import { matchesPatientRecord } from "../services/firebaseSync";
import {
  handleHorizontalWheel,
  isolateScroll,
  useLockBodyScroll
} from "../utils/scrollHelpers";
import lesionMacroImg from "../assets/images/derma_lesion_macro_1790257717240.jpg";
import specialistExamImg from "../assets/images/derma_specialist_exam_1790257731242.jpg";
export default function PatientPortal({
  user,
  accounts = [],
  onUpdateUser,
  cases,
  onSubmitCase,
  appointments,
  onBookAppointment,
  onUpdateAppointment,
  onRescheduleAppointment,
  libraryItems = defaultLibrary,
  onUpdateLibraryItem,
  onLogout,
  currentLanguage,
  onLanguageChange
}) {
  const t = translations[currentLanguage] || translations.en;
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Real-time Event Notification Dropdown & Alert Toast for Patient
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const notificationMenuRef = useRef(null);
  const [patientToastAlert, setPatientToastAlert] = useState(null);
  const [dismissedNotices, setDismissedNotices] = useState(() => new Set());

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(e.target)) {
        setShowNotificationMenu(false);
      }
    };
    if (showUserMenu || showNotificationMenu) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [showUserMenu, showNotificationMenu]);

  // Helper to reliably match patient records across multiple devices & previous logins
  const isMyAppointment = (a) => matchesPatientRecord(a, user);
  const isMyCase = (c) => matchesPatientRecord(c, user);

  // Real-time listener: Notify patient immediately when doctor accepts or reschedules a booking
  const prevAppointmentsRef = useRef(appointments);
  useEffect(() => {
    if (!prevAppointmentsRef.current) {
      prevAppointmentsRef.current = appointments;
      return;
    }
    (appointments || []).forEach((curr) => {
      if (!isMyAppointment(curr)) return;
      const prev = prevAppointmentsRef.current.find((p) => p.id === curr.id);
      // Case 1: Doctor just approved appointment
      if (prev && prev.status === "Pending" && (curr.status === "Accepted" || curr.status === "Approved")) {
        playNotificationChime();
        setPatientToastAlert({
          type: "confirmed",
          title: "🎉 Meeting / Consultation Confirmed!",
          message: `Dr. ${curr.specialistName || "Specialist"} approved your booking for ${curr.date} at ${curr.time} (${curr.type}). Automatic reminders: 12h, 1h, and 30m before meeting are active!`,
          appointment: curr
        });
        setTimeout(() => setPatientToastAlert(null), 9000);
      }
      // Case 2: Doctor missed and requested reschedule with apology
      if (prev && prev.status !== "Rescheduled" && (curr.status === "Rescheduled" || curr.isMissed)) {
        playNotificationChime();
        setPatientToastAlert({
          type: "rescheduled",
          title: "⚠️ Reschedule Notice from Specialist",
          message: `Dr. ${curr.specialistName || "Specialist"} sends their apologies: Consultation on ${curr.date} at ${curr.time} had to be rescheduled due to: "${curr.rescheduleReason || 'Urgent duties'}". Proposed new slot: ${curr.proposedDate || curr.date} at ${curr.proposedTime || curr.time}.`,
          appointment: curr
        });
        setTimeout(() => setPatientToastAlert(null), 11000);
      }
    });
    prevAppointmentsRef.current = appointments;
  }, [appointments, user.id]);

  const [dailyTip, setDailyTip] = useState("");
  const [loadingTip, setLoadingTip] = useState(false);
  const [clinicSearchQuery, setClinicSearchQuery] = useState("");
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [libraryMediaType, setLibraryMediaType] = useState("all");
  const [patientViewItem, setPatientViewItem] = useState(null);
  const [patientViewLang, setPatientViewLang] = useState(currentLanguage);
  const [newCommentText, setNewCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentFilter, setCommentFilter] = useState("all"); // "all" | "specialist" | "patient"
  const [activeEmojiPickerItemId, setActiveEmojiPickerItemId] = useState(null);

  // Sync patientViewItem with latest libraryItems changes (for real-time comments/reactions sync)
  useEffect(() => {
    if (patientViewItem) {
      const refreshed = libraryItems.find((item) => item.id === patientViewItem.id);
      if (refreshed) {
        setPatientViewItem(refreshed);
      }
    }
  }, [libraryItems]);

  const handleToggleReaction = (itemId, emoji) => {
    const item = libraryItems.find((i) => i.id === itemId);
    if (!item) return;

    const userId = user?.id || "guest";
    const userReactions = { ...(item.userReactions || {}) };
    const currentReaction = userReactions[userId];
    const reactions = { ...(item.reactions || {}) };

    if (currentReaction === emoji) {
      // User tapped their existing reaction -> remove it
      delete userReactions[userId];
      reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
    } else {
      // Remove old emoji count if any
      if (currentReaction && reactions[currentReaction]) {
        reactions[currentReaction] = Math.max(0, reactions[currentReaction] - 1);
      }
      // Add new emoji
      userReactions[userId] = emoji;
      reactions[emoji] = (reactions[emoji] || 0) + 1;
    }

    const updatedItem = {
      ...item,
      reactions,
      userReactions
    };

    if (onUpdateLibraryItem) {
      onUpdateLibraryItem(updatedItem);
    }
    if (patientViewItem?.id === itemId) {
      setPatientViewItem(updatedItem);
    }
  };

  const handleToggleLike = (itemId) => {
    const item = libraryItems.find((i) => i.id === itemId);
    if (!item) return;

    const userId = user?.id || "guest";
    const userLikes = Array.isArray(item.userLikes) ? [...item.userLikes] : [];
    const hasLiked = userLikes.includes(userId);
    let updatedLikes = typeof item.likes === "number" ? item.likes : 0;

    let nextUserLikes;
    if (hasLiked) {
      nextUserLikes = userLikes.filter((id) => id !== userId);
      updatedLikes = Math.max(0, updatedLikes - 1);
    } else {
      nextUserLikes = [...userLikes, userId];
      updatedLikes = updatedLikes + 1;
    }

    const updatedItem = {
      ...item,
      likes: updatedLikes,
      userLikes: nextUserLikes
    };

    if (onUpdateLibraryItem) {
      onUpdateLibraryItem(updatedItem);
    }
    if (patientViewItem?.id === itemId) {
      setPatientViewItem(updatedItem);
    }
  };

  const handleAddComment = (itemId, text) => {
    if (!text || !text.trim()) return;
    const item = libraryItems.find((i) => i.id === itemId);
    if (!item) return;

    const newComment = {
      id: "COM-" + Date.now(),
      userId: user?.id || "patient-anon",
      userName: user?.name || "Patient Member",
      userRole: "Patient",
      avatar: user?.profilePic || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
      text: text.trim(),
      createdAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      likes: 0,
      userLikes: []
    };

    const updatedItem = {
      ...item,
      comments: [newComment, ...(item.comments || [])]
    };

    if (onUpdateLibraryItem) {
      onUpdateLibraryItem(updatedItem);
    }
    if (patientViewItem?.id === itemId) {
      setPatientViewItem(updatedItem);
    }
    setNewCommentText("");
  };

  const handleLikeComment = (itemId, commentId) => {
    const item = libraryItems.find((i) => i.id === itemId);
    if (!item) return;

    const userId = user?.id || "guest";
    const updatedComments = (item.comments || []).map((c) => {
      if (c.id === commentId) {
        const userLikes = Array.isArray(c.userLikes) ? [...c.userLikes] : [];
        const hasLiked = userLikes.includes(userId);
        return {
          ...c,
          likes: hasLiked ? Math.max(0, (c.likes || 1) - 1) : (c.likes || 0) + 1,
          userLikes: hasLiked ? userLikes.filter((id) => id !== userId) : [...userLikes, userId]
        };
      }
      return c;
    });

    const updatedItem = {
      ...item,
      comments: updatedComments
    };

    if (onUpdateLibraryItem) {
      onUpdateLibraryItem(updatedItem);
    }
    if (patientViewItem?.id === itemId) {
      setPatientViewItem(updatedItem);
    }
  };
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedDoctorProfile, setSelectedDoctorProfile] = useState(null);
  const allSpecialists = useMemo(() => {
    const list = (accounts || []).filter((acc) => acc.role === "specialist").map((acc) => ({
      id: acc.id,
      name: acc.name || "Specialist Doctor",
      email: acc.email,
      phone: acc.phone || "+256 701 123456",
      specialization: acc.specialization || "Clinical Dermatologist",
      registrationNumber: acc.registrationNumber || "REG-UG-MED",
      experience: acc.experience || "8+ Years",
      rating: 4.9,
      clinicName: acc.hospitalName || "Central Referral Skin Clinic",
      address: acc.address || "Kampala Medical Complex",
      profilePic: acc.profilePic || "",
      bio: acc.bio || "Dermatology specialist passionate about high-quality patient skin triage.",
      services: acc.services && acc.services.length > 0 ? acc.services : ["Dermal Assessment", "Allergy Patch Testing", "Skin Barrier Therapy"],
      workingDays: acc.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      consultationHours: acc.consultationHours || "09:00 AM - 05:00 PM",
      consultationType: acc.consultationType || "Both",
      providerType: acc.providerType || "Individual",
      licensingAuthority: acc.licensingAuthority || "Medical Practitioners Council"
    }));
    defaultSpecialists.forEach((def) => {
      const existing = list.find((s) => s.id === def.id || s.email === def.email || s.name === def.name);
      if (!existing) {
        list.push(def);
      } else if (!existing.profilePic && def.profilePic) {
        existing.profilePic = def.profilePic;
      }
    });
    return list;
  }, [accounts]);
  const getDoctorAvatar = (docOrName) => {
    if (!docOrName) return "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80";
    if (typeof docOrName === "string") {
      const match = allSpecialists.find((s) => s.name === docOrName || s.id === docOrName);
      if (match?.profilePic) return match.profilePic;
      return "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80";
    }
    if (docOrName.profilePic) return docOrName.profilePic;
    return "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80";
  };
  const [liveNow, setLiveNow] = useState(/* @__PURE__ */ new Date());
  useEffect(() => {
    const timer = setInterval(() => setLiveNow(/* @__PURE__ */ new Date()), 1e3);
    return () => clearInterval(timer);
  }, []);
  const formatYMD = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayYMD = useMemo(() => formatYMD(/* @__PURE__ */ new Date()), [liveNow.getDate(), liveNow.getMonth(), liveNow.getFullYear()]);
  const [calYear, setCalYear] = useState((/* @__PURE__ */ new Date()).getFullYear());
  const [calMonth, setCalMonth] = useState((/* @__PURE__ */ new Date()).getMonth());
  const [selectedCalDate, setSelectedCalDate] = useState(todayYMD);
  const [calendarMode, setCalendarMode] = useState("month");
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [showQuickBookModal, setShowQuickBookModal] = useState(false);
  const [quickBookSpec, setQuickBookSpec] = useState(defaultSpecialists[0]?.id || "");
  const [quickBookTime, setQuickBookTime] = useState("09:00 AM");
  const [quickBookType, setQuickBookType] = useState("Online");
  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };
  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };
  const handleResetToToday = () => {
    const now = /* @__PURE__ */ new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setSelectedCalDate(formatYMD(now));
  };
  const calendarDays = useMemo(() => {
    const days = [];
    const firstDay = new Date(calYear, calMonth, 1);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(calYear, calMonth - 1, daysInPrevMonth - i);
      const dateStr = formatYMD(prevDate);
      const appCount = appointments.filter(
        (a) => isMyAppointment(a) && a.date === dateStr
      ).length;
      days.push({
        dateStr,
        dayNum: prevDate.getDate(),
        isCurrentMonth: false,
        isToday: dateStr === todayYMD,
        isSelected: dateStr === selectedCalDate,
        appointmentsCount: appCount
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(calYear, calMonth, d);
      const dateStr = formatYMD(currDate);
      const appCount = appointments.filter(
        (a) => isMyAppointment(a) && a.date === dateStr
      ).length;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayYMD,
        isSelected: dateStr === selectedCalDate,
        appointmentsCount: appCount
      });
    }
    const totalCells = days.length > 35 ? 42 : 35;
    const remainingCells = totalCells - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(calYear, calMonth + 1, i);
      const dateStr = formatYMD(nextDate);
      const appCount = appointments.filter(
        (a) => isMyAppointment(a) && a.date === dateStr
      ).length;
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: dateStr === todayYMD,
        isSelected: dateStr === selectedCalDate,
        appointmentsCount: appCount
      });
    }
    return days;
  }, [calYear, calMonth, selectedCalDate, appointments, user, todayYMD]);
  const weekDays = useMemo(() => {
    let baseDate;
    if (selectedCalDate) {
      const parts = selectedCalDate.split("-");
      baseDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      baseDate = /* @__PURE__ */ new Date();
    }
    const dayOfWeek = baseDate.getDay();
    const sunday = new Date(baseDate);
    sunday.setDate(baseDate.getDate() - dayOfWeek);
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dateStr = formatYMD(d);
      const appCount = appointments.filter(
        (a) => isMyAppointment(a) && a.date === dateStr
      ).length;
      week.push({
        dateStr,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        isToday: dateStr === todayYMD,
        isSelected: dateStr === selectedCalDate,
        appointmentsCount: appCount
      });
    }
    return week;
  }, [selectedCalDate, appointments, user, todayYMD]);
  const handleQuickBookAppointment = (e) => {
    e.preventDefault();
    const spec = allSpecialists.find((s) => s.id === quickBookSpec) || allSpecialists[0];
    const newApp = {
      id: Math.floor(1e3 + Math.random() * 9e3).toString(),
      patientId: user.id,
      patientName: user.name,
      patientPhone: user.phone || "+256 701 000000",
      specialistId: spec.id,
      specialistName: spec.name,
      date: selectedCalDate,
      time: quickBookTime,
      type: quickBookType,
      status: "Pending"
    };
    onBookAppointment(newApp);
    setShowQuickBookModal(false);
    alert(`Appointment successfully scheduled for ${selectedCalDate} at ${quickBookTime} with ${spec.name}!`);
  };

  const patientAppointments = useMemo(() => {
    return (appointments || []).filter(isMyAppointment);
  }, [appointments, user]);

  const handleAcceptReschedule = (app) => {
    const updated = {
      ...app,
      date: app.proposedDate || app.date,
      time: app.proposedTime || app.time,
      status: "Accepted",
      isMissed: false,
      confirmedAt: new Date().toISOString(),
      patientReminders: { h12: true, h1: true, m30: true },
      specialistReminders: { m30: true, m5: true }
    };
    if (onUpdateAppointment) {
      onUpdateAppointment(updated);
    }
    playNotificationChime();
    setPatientToastAlert({
      type: "confirmed",
      title: "✓ Reschedule Confirmed!",
      message: `Your consultation with ${app.specialistName} has been confirmed for ${updated.date} at ${updated.time}. Automatic reminders (12h, 1h, 30m) active!`,
      appointment: updated
    });
    setTimeout(() => setPatientToastAlert(null), 6000);
  };

  const handleSelectAlternativeSlot = (app) => {
    const spec = allSpecialists.find((s) => s.id === app.specialistId || s.name === app.specialistName) || allSpecialists[0];
    setRecipientType("doctor");
    setSelectedProviderId(spec.id);
    setSelectedDoctorProfile(spec);
    setSelectedSpecForConsult(spec.id);
    setTreatmentStage(3);
    setActiveTab("treatment");
    setShowNotificationMenu(false);
  };

  const triggerPatientReminderPreview = (app) => {
    playNotificationChime();
    setPatientToastAlert({
      type: "reminder_preview",
      title: "⏰ 30 MINUTES TO CONSULTATION",
      message: `Your consultation with ${app.specialistName || 'Specialist'} starts in 30 minutes (${app.time}, ${app.type}). Please verify your camera, lighting, and skin photos.`,
      appointment: app
    });
    setTimeout(() => setPatientToastAlert(null), 8000);
  };

  const patientNoticesList = useMemo(() => {
    const list = [];
    patientAppointments.forEach((app) => {
      // Notice 1: Rescheduled / Missed
      if (app.status === "Rescheduled" || app.isMissed) {
        list.push({
          id: `notice-rescheduled-${app.id}`,
          title: `⚠️ Reschedule Request from ${app.specialistName || "Doctor"}`,
          description: `Dr. ${app.specialistName || "Specialist"} sends their sincere apologies: your consultation on ${app.date} at ${app.time} could not take place due to: "${app.rescheduleReason || 'Urgent duties'}". Proposed new slot: ${app.proposedDate || app.date} at ${app.proposedTime || app.time}.`,
          time: "Action Required",
          isUrgent: true,
          icon: "event_repeat",
          iconBg: "bg-rose-100 text-rose-700",
          iconColor: "text-rose-600",
          actions: (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => handleAcceptReschedule(app)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg shadow-2xs cursor-pointer active:scale-95"
              >
                Accept Proposed Slot ✓
              </button>
              <button
                type="button"
                onClick={() => handleSelectAlternativeSlot(app)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200 cursor-pointer"
              >
                Pick Another Slot
              </button>
            </div>
          )
        });
      }

      // Notice 2: Confirmed / Approved
      if (app.status === "Accepted" || app.status === "Approved") {
        list.push({
          id: `notice-confirmed-${app.id}`,
          title: `✓ Consultation Confirmed with ${app.specialistName || "Specialist"}`,
          description: `Dr. ${app.specialistName} has confirmed your booking for ${app.date} at ${app.time} (${app.type}). Automatic reminders: 12 hrs, 1 hr, and 30 mins before meeting.`,
          time: "Confirmed",
          icon: "check_circle",
          iconBg: "bg-emerald-100 text-emerald-700",
          iconColor: "text-emerald-600",
          actions: (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => triggerPatientReminderPreview(app)}
                className="text-[10px] text-blue-700 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">volume_up</span>
                <span>Test 30m Reminder</span>
              </button>
              {app.type === "Online" && (
                <button
                  type="button"
                  onClick={() => alert(`Launching telehealth video consultation with ${app.specialistName}...`)}
                  className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold"
                >
                  Join Video
                </button>
              )}
            </div>
          )
        });

        // Notice 3: 12 Hours Before Reminder
        list.push({
          id: `notice-remind-12h-${app.id}`,
          title: `⏰ 12 Hours Before Reminder: ${app.specialistName}`,
          description: `Upcoming consultation in 12 hours (${app.date} at ${app.time}). Review your uploaded skin photos and prepare your questions.`,
          time: "12h Prior",
          icon: "alarm",
          iconBg: "bg-sky-100 text-sky-700",
          iconColor: "text-sky-600"
        });

        // Notice 4: 1 Hour Before Reminder
        list.push({
          id: `notice-remind-1h-${app.id}`,
          title: `🔔 1 Hour Before Reminder: Consultation with ${app.specialistName}`,
          description: `Your consultation starts in 1 hour at ${app.time} (${app.type}). Please ensure good room lighting.`,
          time: "1h Prior",
          icon: "schedule",
          iconBg: "bg-indigo-100 text-indigo-700",
          iconColor: "text-indigo-600"
        });

        // Notice 5: 30 Minutes Before Urgent Reminder
        list.push({
          id: `notice-remind-30m-${app.id}`,
          title: `⚡ 30 Minutes Before Reminder: Ready to Connect`,
          description: `Starting in 30 minutes (${app.time}) with ${app.specialistName}. Get ready to connect with your specialist.`,
          time: "30m Prior",
          isUrgent: true,
          icon: "timer",
          iconBg: "bg-amber-100 text-amber-800",
          iconColor: "text-amber-700",
          actions: (
            <button
              type="button"
              onClick={() => triggerPatientReminderPreview(app)}
              className="text-[10px] text-amber-800 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">volume_up</span>
              <span>Preview 30m Chime Alert</span>
            </button>
          )
        });
      }

      // Notice 6: Pending Doctor Approval
      if (app.status === "Pending") {
        list.push({
          id: `notice-pending-${app.id}`,
          title: `⏳ Consultation Request Pending Doctor Review`,
          description: `Your request for ${app.date} at ${app.time} with ${app.specialistName} has been submitted. The specialist is reviewing your case photos.`,
          time: "Submitted",
          icon: "hourglass_top",
          iconBg: "bg-amber-100 text-amber-800",
          iconColor: "text-amber-600"
        });
      }
    });

    return list.filter((n) => !dismissedNotices.has(n.id));
  }, [patientAppointments, dismissedNotices]);

  const patientUnreadNoticesCount = patientNoticesList.length;
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content: currentLanguage === "lg" ? "Otya Alex? Embeera y'eddiba lyo eri itya leero? Olina kye weetaaga okwebuuzaako?" : currentLanguage === "sw" ? "Hujambo Alex? Hali ya ngozi yako ikoje leo? Una swali lolote la kuuliza?" : currentLanguage === "fr" ? "Bonjour Alex. Comment se porte votre peau aujourd'hui ? Avez-vous remarqu\xE9 des changements ?" : "Hello Alex. How is your skin feeling today? Have you noticed any new changes or concerns?"
    }
  ]);
  const [currentInput, setCurrentInput] = useState("");
  const [isSendingToAI, setIsSendingToAI] = useState(false);
  const [isDownloadingReportPdf, setIsDownloadingReportPdf] = useState(false);
  const handleDownloadPatientReport = async (caseItem) => {
    try {
      setIsDownloadingReportPdf(true);
      const spec = defaultSpecialists.find(
        (s) => s.id === caseItem.diagnosisReport?.specialistId || s.name === caseItem.diagnosisReport?.specialistName
      ) || defaultSpecialists[0];
      const specialistAccount = {
        id: spec.id,
        passwordHash: "secured",
        name: spec.name,
        email: spec.email || "specialist@clinic.com",
        phone: spec.phone || "+256 701 987654",
        role: "specialist",
        status: "Approved",
        specialization: spec.specialization,
        hospitalName: spec.clinicName || "Moyo Regional Dermatology Clinic",
        registrationNumber: spec.registrationNumber || "MED-UG-88492",
        licensingAuthority: "Uganda Medical Council",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await generatePatientDiagnosticPDF(caseItem, specialistAccount);
    } catch (err) {
      console.error("Failed to download PDF report:", err);
      alert("Failed to generate diagnostic report PDF. Please try again.");
    } finally {
      setIsDownloadingReportPdf(false);
    }
  };
  const [uploadedMedia, setUploadedMedia] = useState(null);
  const [mediaFileName, setMediaFileName] = useState("");
  const [mediaFileSize, setMediaFileSize] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [symptomsText, setSymptomsText] = useState("");
  const [recipientType, setRecipientType] = useState("doctor"); // "doctor" | "clinic" | "hospital"
  const [selectedProviderId, setSelectedProviderId] = useState("SPEC-001");
  const [selectedSpecForConsult, setSelectedSpecForConsult] = useState("SPEC-001");
  const [consultType, setConsultType] = useState("Online");
  const [consultDate, setConsultDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [consultTime, setConsultHours] = useState("10:30 AM");
  const [showDiagnosedReportModal, setShowDiagnosedReportModal] = useState(null);
  const [bookingConfirmationModal, setBookingConfirmationModal] = useState(null);

  // Compute selected provider details dynamically across doctors, clinics, and hospitals
  const currentSelectedProvider = useMemo(() => {
    if (recipientType === "doctor") {
      return allSpecialists.find((s) => s.id === selectedProviderId) || allSpecialists[0];
    }
    if (recipientType === "clinic") {
      return defaultClinics.find((c) => c.id === selectedProviderId) || defaultClinics[0];
    }
    return defaultHospitals.find((h) => h.id === selectedProviderId) || defaultHospitals[0];
  }, [recipientType, selectedProviderId, allSpecialists]);

  // Compute upcoming calendar days for timetable
  const upcomingProviderDays = useMemo(() => {
    const days = [];
    const now = new Date();
    const workingDays = currentSelectedProvider?.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const ymd = `${yyyy}-${mm}-${dd}`;
      const dayShort = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayFull = d.toLocaleDateString("en-US", { weekday: "long" });
      const dateNumber = d.getDate();
      const monthShort = d.toLocaleDateString("en-US", { month: "short" });
      const isOnDuty = workingDays.includes(dayFull);
      days.push({
        ymd,
        dayShort,
        dayFull,
        dateNumber,
        monthShort,
        isOnDuty,
        isToday: i === 0
      });
    }
    return days;
  }, [currentSelectedProvider]);

  const providerTimeSlots = [
    "08:30 AM", "09:30 AM", "10:30 AM", "11:30 AM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"
  ];

  const isSlotBookedForProvider = (date, slotTime) => {
    return (appointments || []).some((a) => {
      const isDateMatch = a.date === date;
      const isTimeMatch = a.time === slotTime;
      const isProvMatch =
        a.specialistId === currentSelectedProvider?.id ||
        a.specialistName === currentSelectedProvider?.name ||
        a.providerName === currentSelectedProvider?.name;
      const isNotDeclined = a.status !== "Declined";
      return isDateMatch && isTimeMatch && isProvMatch && isNotDeclined;
    });
  };

  // Visual Progress Stepper & Stage Tracking: 1 = Image Upload, 2 = AI Processing, 3 = Results Review
  const [treatmentStage, setTreatmentStage] = useState(1);
  const [aiScanProgress, setAiScanProgress] = useState(0);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiScanStageText, setAiScanStageText] = useState("Initializing neural dermatoscope matrix...");

  const startAiScan = () => {
    setTreatmentStage(2);
    setIsAiScanning(true);
    setAiScanProgress(15);
    setAiScanStageText("Initializing polarized dermatoscopy sensor & optics...");

    setTimeout(() => {
      setAiScanProgress(45);
      setAiScanStageText("Extracting lesion boundary, ABCD symmetry & erythema index...");
    }, 600);

    setTimeout(() => {
      setAiScanProgress(78);
      setAiScanStageText("Deep learning comparison against 50,000+ dermatologic clinical cases...");
    }, 1300);

    setTimeout(() => {
      setAiScanProgress(100);
      setIsAiScanning(false);
      setAiScanStageText("Cutaneous scan complete: Clinical triage synthesis ready.");
    }, 2200);
  };

  const handleProceedToAiProcessing = () => {
    if (!uploadedMedia && !symptomsText.trim()) {
      setUploadedMedia(lesionMacroImg);
      setMediaFileName("clinical_dermatoscope_macro.jpg");
      setMediaFileSize("1.4 MB");
      setSymptomsText("Localized erythematous pruritic plaque on upper forearm, persisting 4 days without vesicular breakdown.");
    }
    startAiScan();
  };

  const loadSampleDermatologyImage = () => {
    setUploadedMedia(lesionMacroImg);
    setMediaFileName("clinical_macro_dermoscopy_04.jpg");
    setMediaFileSize("1.4 MB");
    if (!symptomsText) {
      setSymptomsText("Mild erythematous macular lesion on left forearm, duration 4 days with moderate pruritus (itching). No ulceration.");
    }
  };

  const loadSpecificSample = (type) => {
    if (type === "eczema") {
      setUploadedMedia("https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80");
      setMediaFileName("clinical_eczema_flare_02.jpg");
      setMediaFileSize("1.8 MB");
      setSymptomsText("Erythematous pruritic plaque with mild scaling on dorsal hand and forearm. Severe itching at night, duration 5 days.");
    } else if (type === "mole") {
      setUploadedMedia("https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80");
      setMediaFileName("clinical_pigmented_mole_scan.jpg");
      setMediaFileSize("2.1 MB");
      setSymptomsText("Asymmetrical pigmented cutaneous nevus on shoulder. Mild color variation observed over last 3 weeks.");
    } else {
      setUploadedMedia(lesionMacroImg);
      setMediaFileName("clinical_macro_dermoscopy_04.jpg");
      setMediaFileSize("1.4 MB");
      setSymptomsText("Localized erythematous pruritic plaque on upper forearm, persisting 4 days without vesicular breakdown.");
    }
  };

  // Unified Consultation & Meeting Booking Flow: Routes all booking actions into the 3-stage diagnostic process
  const startConsultationBooking = ({
    doctor = null,
    doctorId = null,
    clinic = null,
    hospital = null,
    date = null,
    time = null,
    stage = 1
  } = {}) => {
    // 1. Switch to treatment tab
    setActiveTab("treatment");

    // 2. Pre-select provider if specified
    if (doctor || doctorId) {
      const docId = doctor?.id || doctorId;
      const docObj = doctor || allSpecialists.find((s) => s.id === docId || s.name === docId) || allSpecialists[0];
      setRecipientType("doctor");
      if (docObj) {
        setSelectedProviderId(docObj.id);
        setSelectedSpecForConsult(docObj.id);
        setSelectedDoctorProfile(docObj);
      }
    } else if (clinic) {
      setRecipientType("clinic");
      setSelectedProviderId(clinic.id);
      setSelectedEntity(clinic);
    } else if (hospital) {
      setRecipientType("hospital");
      setSelectedProviderId(hospital.id);
      setSelectedEntity(hospital);
    }

    // 3. Pre-select date & time if specified
    if (date) {
      setConsultDate(date);
    }
    if (time) {
      setConsultHours(time);
    }

    // 4. Set stage (1: Image & Symptoms upload, 2: Provider selection, 3: Timetable & Block Slot)
    setTreatmentStage(stage);

    // 5. Dismiss any open doctor modal or quickbook modal
    setShowQuickBookModal(false);

    // 6. Smoothly scroll down to the diagnostic booking stepper
    setTimeout(() => {
      const el = document.getElementById("patient_treatment_stepper") || document.getElementById("patient_treatment");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 120);
  };
  const [themeMode, setThemeMode] = useState(user.theme || "light");
  const [fontSize, setFontSize] = useState(user.fontSize || "md");
  const [emailInput, setEmailInput] = useState(user.email);
  const [passwordInput, setPasswordInput] = useState(user.passwordHash);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editPhone, setEditPhone] = useState(user.phone || "");
  const [editDob, setEditDob] = useState(user.dob || "");
  useEffect(() => {
    const fetchEncouragement = async () => {
      setLoadingTip(true);
      try {
        const response = await fetch("/api/encouragement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: currentLanguage })
        });
        const data = await response.json();
        setDailyTip(data.tip);
      } catch (err) {
        const fallbacks = {
          en: "Apply mineral-based SPF 50 daily and keep your skin hydrated to preserve your barrier.",
          lg: "Nnywa amazzi mangi buli lunaku ate osiige bizigo ebitasiriiza eddiba lyo.",
          sw: "Kunywa maji mengi kila siku na usafishe ngozi yako kwa sabuni laini isiyo na manukato.",
          fr: "Hydratez votre peau matin et soir et privil\xE9giez les nettoyants sans savon pour pr\xE9server le film hydrolipidique."
        };
        setDailyTip(fallbacks[currentLanguage] || fallbacks.en);
      } finally {
        setLoadingTip(false);
      }
    };
    fetchEncouragement();
  }, [currentLanguage]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.fontSize = fontSize === "sm" ? "14px" : fontSize === "lg" ? "18px" : "16px";
  }, [fontSize]);
  const [isWideScreen, setIsWideScreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [manualOrientationOverride, setManualOrientationOverride] = useState("auto");
  const [scrollProgress, setScrollProgress] = useState(0);
  const patientMainRef = useRef(null);
  useEffect(() => {
    const handleViewportChange = () => {
      const wide = window.innerWidth >= 1024;
      const landscape = window.innerWidth > window.innerHeight || typeof window !== "undefined" && window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
      setIsWideScreen(wide);
      setIsLandscape(landscape);
      const scrolled = window.scrollY > 40;
      setIsScrolledDown(scrolled);
      const mainEl = patientMainRef.current;
      if (mainEl) {
        const rect = mainEl.getBoundingClientRect();
        const mainTop = window.scrollY + rect.top;
        const mainHeight = mainEl.scrollHeight || mainEl.offsetHeight;
        const scrollable = mainHeight - window.innerHeight;
        if (scrollable > 20) {
          const scrolledDistance = window.scrollY - mainTop + 70;
          const progress = Math.min(100, Math.max(0, (scrolledDistance / scrollable) * 100));
          setScrollProgress(progress);
        } else {
          const totalDoc = document.documentElement.scrollHeight - window.innerHeight;
          const progress = totalDoc > 0 ? Math.min(100, Math.max(0, (window.scrollY / totalDoc) * 100)) : 0;
          setScrollProgress(progress);
        }
      } else {
        const totalDoc = document.documentElement.scrollHeight - window.innerHeight;
        const progress = totalDoc > 0 ? Math.min(100, Math.max(0, (window.scrollY / totalDoc) * 100)) : 0;
        setScrollProgress(progress);
      }
    };
    handleViewportChange();
    window.addEventListener("scroll", handleViewportChange, { passive: true });
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    return () => {
      window.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  }, [activeTab]);
  const isLeftOrientation = false;
  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!currentInput.trim() || isSendingToAI) return;
    const userMessageText = currentInput.trim();
    setCurrentInput("");
    const updatedMessages = [...chatMessages, { role: "user", content: userMessageText }];
    setChatMessages(updatedMessages);
    setIsSendingToAI(true);
    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: userMessageText,
          chatHistory: updatedMessages.slice(0, -1),
          language: currentLanguage
        })
      });
      const data = await response.json();
      setChatMessages([...updatedMessages, { role: "assistant", content: data.text }]);
    } catch (err) {
      setChatMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: `[AI Connection Demo Mode] I received your symptoms: "${userMessageText}". Rest assured, we have securely logged this concern for Dr. Jenkins. Please complete booking your meeting.`
        }
      ]);
    } finally {
      setIsSendingToAI(false);
    }
  };
  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("Please select a valid image or video file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setUploadedMedia(e.target.result);
        setMediaFileName(file.name);
        const kb = (file.size / 1024).toFixed(1);
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        setMediaFileSize(file.size > 1024 * 1024 ? `${mb} MB` : `${kb} KB`);
      }
    };
    reader.readAsDataURL(file);
  };
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };
  const openLiveCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        setMediaStream(stream);
        setIsCameraActive(true);
      } else {
        cameraInputRef.current?.click();
      }
    } catch (err) {
      console.warn("Camera access issue:", err);
      setCameraError("Live camera video stream unavailable. Triggering system camera file picker...");
      cameraInputRef.current?.click();
    }
  };
  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [isCameraActive, mediaStream]);
  const capturePhotoFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      setUploadedMedia(dataUrl);
      setMediaFileName(`lesion_snapshot_${Date.now().toString().slice(-4)}.jpg`);
      setMediaFileSize("Live Camera Snapshot");
    }
    stopCamera();
  };
  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    setIsCameraActive(false);
    setCameraError(null);
  };
  const handleVoiceRecordSimulation = () => {
    if (isRecording) {
      setIsRecording(false);
      const mockTranscriptions = {
        en: "I have a sudden itchy red patch spreading over my lower chin and neck after testing a new organic sunscreen lotion yesterday.",
        lg: "Nfuna ekikaanyigo eky'amaanyi wamu n'obutulututu obumyufu obw'okubiriitira ku mugongo ne ku kifuba kyange.",
        sw: "Ninahisi kuwasha sana na madoa mekundu yanayosambaa kwenye mikono tangu asubuhi ya leo.",
        fr: "J'ai des plaques rouges irritantes qui d\xE9mangent beaucoup sur le dos de la main droite depuis hier apr\xE8s-midi."
      };
      setSymptomsText(
        (prev) => (prev ? prev + " " : "") + (mockTranscriptions[currentLanguage] || mockTranscriptions.en)
      );
    } else {
      setIsRecording(true);
    }
  };
  const handleCaseSubmit = (e) => {
    e.preventDefault();
    const effectiveSymptoms = symptomsText.trim() || (uploadedMedia ? "Lesion photo assessment & triage consultation requested." : "General skin examination requested.");
    const provider = currentSelectedProvider || allSpecialists[0];
    let resolvedDoctorId = "doctor_sarah";
    let resolvedDoctorName = "Dr. Sarah Jenkins";

    if (recipientType === "doctor") {
      const matchedAccount = (accounts || []).find((a) => a.role === "specialist" && (a.id === provider.id || a.name === provider.name));
      resolvedDoctorId = matchedAccount ? matchedAccount.id : (provider.id === "SPEC-001" ? "doctor_sarah" : provider.id === "SPEC-002" ? "doctor_dennis" : provider.id);
      resolvedDoctorName = provider.name;
    } else {
      const docName = provider.doctors?.[0] || "Dr. Sarah Jenkins";
      const matchedAccount = (accounts || []).find((a) => a.role === "specialist" && (a.name === docName || a.hospitalName === provider.name));
      resolvedDoctorId = matchedAccount ? matchedAccount.id : "doctor_sarah";
      resolvedDoctorName = docName;
    }

    const newCase = {
      id: Math.floor(1e4 + Math.random() * 9e4).toString(),
      patientId: user.id,
      patientName: user.name,
      patientNumber: user.id,
      specialistId: resolvedDoctorId,
      specialistName: resolvedDoctorName,
      providerType: recipientType,
      providerName: provider.name,
      status: "Pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      mediaUrl: uploadedMedia || lesionMacroImg,
      symptoms: effectiveSymptoms,
      transcription: isRecording ? "Simulated audio transcription..." : effectiveSymptoms
    };
    const mockTriageSummaries = [
      `AI Triage Probability: 84% - Early Stage Atopic Dermatitis. Mild scaling observed. High correlation with product contact. Non-urgent.`,
      `AI Triage Probability: 72% - Cutaneous Allergy Flare. Contact irritation suspect. Recommended: physical inspection under dermatoscope.`
    ];
    newCase.aiTriageSummary = mockTriageSummaries[Math.floor(Math.random() * mockTriageSummaries.length)];
    onSubmitCase(newCase);

    const effectiveDate = consultDate || upcomingProviderDays[0]?.ymd;
    const effectiveTime = consultTime || "10:30 AM";

    const newApp = {
      id: Math.floor(1e4 + Math.random() * 9e4).toString(),
      patientId: user.id,
      patientName: user.name,
      patientPhone: user.phone || "+256 701 000000",
      providerType: recipientType,
      providerName: provider.name,
      providerAddress: provider.address || provider.clinicName || "",
      specialistId: resolvedDoctorId,
      specialistName: resolvedDoctorName,
      date: effectiveDate,
      time: effectiveTime,
      type: consultType,
      status: "Pending", // Waiting for Doctor Approval
      lesionImage: uploadedMedia || lesionMacroImg,
      symptoms: effectiveSymptoms,
      condition: "Atopic Dermatitis / Eczematous Flare",
      requestedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    onBookAppointment(newApp);

    // Show Waiting for Doctor Approval confirmation modal
    setBookingConfirmationModal({
      show: true,
      appointment: newApp,
      provider
    });
  };
  const handleSaveSettings = (e) => {
    e.preventDefault();
    const updated = {
      ...user,
      theme: themeMode,
      fontSize,
      email: emailInput,
      passwordHash: passwordInput,
      name: editName,
      phone: editPhone,
      dob: editDob
    };
    onUpdateUser(updated);
    setShowEditForm(false);
    alert("Settings saved successfully!");
  };
  const [searchDirectoryTab, setSearchDirectoryTab] = useState("doctors"); // "doctors" | "clinics" | "hospitals"
  const filteredDoctors = allSpecialists.filter(
    (s) => s.name.toLowerCase().includes(clinicSearchQuery.toLowerCase()) || s.specialization && s.specialization.toLowerCase().includes(clinicSearchQuery.toLowerCase()) || s.clinicName && s.clinicName.toLowerCase().includes(clinicSearchQuery.toLowerCase()) || s.services && s.services.some((srv) => srv.toLowerCase().includes(clinicSearchQuery.toLowerCase()))
  );
  const filteredClinics = defaultClinics.filter(
    (c) => c.name.toLowerCase().includes(clinicSearchQuery.toLowerCase()) || c.address.toLowerCase().includes(clinicSearchQuery.toLowerCase()) || c.services.some((s) => s.toLowerCase().includes(clinicSearchQuery.toLowerCase()))
  );
  const filteredHospitals = (defaultHospitals || []).filter(
    (h) => h.name.toLowerCase().includes(clinicSearchQuery.toLowerCase()) || h.address.toLowerCase().includes(clinicSearchQuery.toLowerCase()) || (h.services && h.services.some((s) => s.toLowerCase().includes(clinicSearchQuery.toLowerCase())))
  );
  const filteredLibrary = libraryItems.filter((l) => {
    const q = librarySearchQuery.toLowerCase();
    const titleText = (l.titleTranslations?.[currentLanguage] || l.title).toLowerCase();
    const descText = (l.summaryTranslations?.[currentLanguage] || l.description).toLowerCase();
    const catText = l.category.toLowerCase();
    return titleText.includes(q) || descText.includes(q) || catText.includes(q);
  });
  const articleItems = useMemo(
    () => filteredLibrary.filter((item) => item.type === "article"),
    [filteredLibrary]
  );
  const audioItems = useMemo(
    () => filteredLibrary.filter((item) => item.type === "audio"),
    [filteredLibrary]
  );
  const videoItems = useMemo(
    () => filteredLibrary.filter((item) => item.type === "video"),
    [filteredLibrary]
  );
  const patientTabs = [
    {
      id: "dashboard",
      label: t.dashboard || "Dashboard",
      hint: "Overview & Triage",
      icon: "dashboard",
      count: appointments.filter((a) => isMyAppointment(a) && a.status === "Pending").length + cases.filter((c) => isMyCase(c) && c.status === "Pending").length
    },
    {
      id: "treatment",
      label: t.treatment || "Find Care",
      hint: "Doctors & Clinics",
      icon: "medical_services",
      count: allSpecialists.length
    },
    {
      id: "library",
      label: t.library || "Skin Library",
      hint: "Advisories & Guides",
      icon: "local_library",
      count: libraryItems.length
    },
    {
      id: "settings",
      label: t.settings || "My Settings",
      hint: "Profile & Preferences",
      icon: "settings",
      count: 0
    }
  ];
  return <div id="patient_portal_root" className="min-h-screen flex flex-col pb-8 derma-canvas text-[#263746] antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top Banner Area: Single cohesive header container (h-16 / 64px height) with fixed padding (px-6) */}
      <header className={`sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-[rgba(70,90,110,0.14)] transition-all duration-200 ${isScrolledDown ? "shadow-sm" : ""}`}>
        <div className="flex justify-between items-center w-full px-6 h-16 max-w-7xl mx-auto gap-4">
          
          {/* Brand Logo & App Identity (Left) */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#315B7D] to-[#44749D] flex items-center justify-center shadow-xs shrink-0 text-white">
              <span className="material-symbols-outlined text-[22px]">health_and_safety</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-base sm:text-lg text-[#263746] leading-none">
                  DERMA <span className="text-[#315B7D]">CARE</span>
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#E8F1F7] text-[#315B7D] border border-[#315B7D]/20">
                  Patient
                </span>
              </div>
              <p className="text-[11px] text-[#667685] font-semibold tracking-wider uppercase mt-0.5 hidden xs:block">
                DERMATOLOGY PORTAL
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Dashboard, Treatment, Library, Settings) integrated in cohesive header */}
          <nav
            className="hidden lg:flex items-center gap-1.5 p-1 bg-[#F1F5F9]/80 backdrop-blur-md rounded-2xl border border-[rgba(70,90,110,0.12)] shadow-2xs overflow-x-auto overscroll-x-contain tabs-horizontal-scroll scrollbar-none"
            onWheel={handleHorizontalWheel}
          >
            {patientTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`patient_tab_${tab.id}`}
                  type="button"
                  title={tab.label}
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 relative select-none group ${
                    isActive
                      ? "bg-gradient-to-r from-[#315B7D] to-[#406E94] text-white shadow-[0_4px_18px_rgba(49,91,125,0.36),0_0_14px_rgba(49,91,125,0.22)] ring-2 ring-[#315B7D] ring-offset-2 ring-offset-white border border-[#24465F]/30 font-extrabold"
                      : "text-[#55697D] hover:text-[#263746] hover:bg-white/80 hover:shadow-2xs border border-transparent"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                      isActive
                        ? "bg-white/20 text-white shadow-inner ring-1 ring-white/30"
                        : "bg-white/80 text-[#6B8299] group-hover:text-[#315B7D] group-hover:bg-[#E8F1F7] shadow-2xs"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {tab.icon}
                    </span>
                  </div>
                  <span>{tab.label}</span>
                  {tab.id === "dashboard" && (
                    <span className="relative flex h-2 w-2 shrink-0 ml-0.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isActive ? "bg-emerald-300" : "bg-emerald-400"}`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? "bg-white" : "bg-emerald-500"}`} />
                    </span>
                  )}
                  {typeof tab.count === "number" && tab.count > 0 && (
                    <span
                      className={`rounded-full font-bold px-1.5 py-0.2 text-[10px] transition-colors ${
                        isActive ? "bg-white text-[#315B7D] shadow-xs ring-1 ring-white/40" : "bg-[#E8F1F7] text-[#315B7D]"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {/* Subtle active accent bar */}
                  {isActive && (
                    <span
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-7 h-[3px] bg-[#315B7D] rounded-full shadow-[0_0_8px_rgba(49,91,125,0.7)] pointer-events-none"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Identity, Language Segmented Toggle & Compact User Menu (Right) */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Sleek Segmented Language Toggle */}
            <div className="hidden sm:inline-flex p-1 bg-[#E8F1F7] rounded-xl border border-[rgba(70,90,110,0.2)] shadow-2xs items-center gap-0.5">
              {[
                { code: "en", label: "EN", title: "English" },
                { code: "lg", label: "LG", title: "Luganda" },
                { code: "sw", label: "SW", title: "Kiswahili" },
                { code: "fr", label: "FR", title: "Français" }
              ].map((lang) => {
                const isSelected = currentLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    title={lang.title}
                    onClick={() => {
                      if (onLanguageChange) onLanguageChange(lang.code);
                      else onUpdateUser({ ...user, language: lang.code });
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-white text-[#315B7D] shadow-xs font-bold"
                        : "text-[#495b6c] hover:text-[#263746] hover:bg-[#d8e6f1]"
                    }`}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>

            {/* Mobile language dropdown for small screens */}
            <div className="sm:hidden relative">
              <select
                value={currentLanguage}
                onChange={(e) => {
                  if (onLanguageChange) onLanguageChange(e.target.value);
                  else onUpdateUser({ ...user, language: e.target.value });
                }}
                className="text-xs font-bold bg-[#E8F1F7] border border-[rgba(70,90,110,0.14)] rounded-lg px-2 py-1.5 text-[#263746]"
              >
                <option value="en">🇺🇸 EN</option>
                <option value="lg">🇺🇬 LG</option>
                <option value="sw">🇹🇿 SW</option>
                <option value="fr">🇫🇷 FR</option>
              </select>
            </div>

            {/* Real-time Consultation & Meeting Notices Bell */}
            <div className="relative" ref={notificationMenuRef}>
              <button
                type="button"
                id="patient_notifications_button"
                onClick={() => setShowNotificationMenu(!showNotificationMenu)}
                className="relative p-2 rounded-xl border border-[rgba(70,90,110,0.18)] bg-white hover:bg-slate-50 text-[#315B7D] transition-colors shadow-2xs cursor-pointer flex items-center justify-center group"
                aria-label="Event Notifications"
                title="Consultation & Meeting Notices"
              >
                <span className="material-symbols-outlined text-xl group-hover:scale-105 transition-transform">
                  {patientUnreadNoticesCount > 0 ? "notifications_active" : "notifications"}
                </span>
                {patientUnreadNoticesCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-600 text-white font-mono font-black text-[10px] flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
                    {patientUnreadNoticesCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Drawer */}
              {showNotificationMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-600 text-lg">event_available</span>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Consultation & Meeting Notices
                      </h4>
                    </div>
                    {patientNoticesList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDismissedNotices(new Set(patientNoticesList.map((n) => n.id)));
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
                    {patientNoticesList.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 space-y-1">
                        <span className="material-symbols-outlined text-2xl text-slate-300">notifications_paused</span>
                        <p className="text-xs font-semibold text-slate-600">No New Notifications</p>
                        <p className="text-[11px] text-slate-400">Notices for approved consultations, 12h/1h/30m reminders, and rescheduling updates will appear here.</p>
                      </div>
                    ) : (
                      patientNoticesList.map((notice) => (
                        <div key={notice.id} className={`p-3.5 hover:bg-slate-50 transition-colors ${notice.isUrgent ? "bg-amber-50/50" : ""}`}>
                          <div className="flex items-start gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${notice.iconBg}`}>
                              <span className={`material-symbols-outlined text-base ${notice.iconColor}`}>
                                {notice.icon}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 text-xs">
                              <div className="flex items-center justify-between gap-1">
                                <h5 className="font-bold text-slate-900 truncate text-[11px]">{notice.title}</h5>
                                <span className="text-[9px] text-slate-400 font-mono shrink-0">{notice.time}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{notice.description}</p>
                              
                              {notice.actions && (
                                <div className="mt-2 flex items-center gap-2">
                                  {notice.actions}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Compact User Menu Component (Avatar + Dropdown Arrow) */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                id="patient_user_menu_button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-[rgba(70,90,110,0.14)] bg-white hover:bg-slate-50 transition-colors shadow-xs cursor-pointer group"
                aria-expanded={showUserMenu}
                aria-label="User Account Menu"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#315B7D] to-[#44749D] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {user.name ? user.name.charAt(0).toUpperCase() : "P"}
                </div>
                <div className="hidden md:flex flex-col text-left leading-tight">
                  <span className="text-xs font-bold text-[#263746] truncate max-w-[110px]">
                    {user.name || "Patient"}
                  </span>
                  <span className="text-[10px] text-[#8A98A5] font-mono">
                    {user.id}
                  </span>
                </div>
                <span className={`material-symbols-outlined text-[#8A98A5] text-base transition-transform duration-200 ${showUserMenu ? "rotate-180" : ""}`}>
                  keyboard_arrow_down
                </span>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{user.name || "Patient"}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email || "patient@dermacare.org"}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                        {user.id}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">Patient</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("settings");
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base text-slate-400">person</span>
                      <span>{t.settings || "Profile & Settings"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("treatment");
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base text-slate-400">medical_services</span>
                      <span>Find Clinics & Specialists</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onLogout) onLogout();
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base text-red-500">logout</span>
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sub-Navbar for smaller screens (< lg) */}
      <div
        className="lg:hidden sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 py-2 shadow-xs overscroll-x-contain tabs-horizontal-scroll"
        onWheel={handleHorizontalWheel}
      >
        <div
          className="flex sm:grid sm:grid-cols-4 gap-1.5 max-w-7xl mx-auto p-1 bg-slate-100/70 rounded-2xl border border-slate-200/60 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll scrollbar-none"
          onWheel={handleHorizontalWheel}
        >
          {patientTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-selected={isActive}
                title={tab.label}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer relative select-none transform hover:-translate-y-0.5 active:translate-y-0 shrink-0 flex-1 sm:flex-initial min-w-[70px] ${
                  isActive
                    ? "bg-gradient-to-r from-[#315B7D] to-[#406E94] text-white shadow-[0_2px_12px_rgba(49,91,125,0.32),0_0_10px_rgba(49,91,125,0.2)] ring-2 ring-[#315B7D] ring-offset-1 ring-offset-white font-extrabold"
                    : "text-slate-600 hover:bg-white/80 hover:text-slate-900 border border-transparent"
                }`}
              >
                <span className={`material-symbols-outlined text-lg sm:text-base transition-colors shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-800"}`}>
                  {tab.icon}
                </span>
                <span className="truncate transition-all duration-200 max-sm:hidden max-sm:group-hover:flex max-sm:group-hover:absolute max-sm:group-hover:-top-9 max-sm:group-hover:left-1/2 max-sm:group-hover:-translate-x-1/2 max-sm:group-hover:bg-slate-900 max-sm:group-hover:text-white max-sm:group-hover:px-2.5 max-sm:group-hover:py-1 max-sm:group-hover:rounded-lg max-sm:group-hover:text-[11px] max-sm:group-hover:font-bold max-sm:group-hover:shadow-xl max-sm:group-hover:z-50 max-sm:group-hover:whitespace-nowrap sm:inline">
                  {tab.label}
                </span>
                {isActive && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-[#315B7D] rounded-full shadow-[0_0_6px_rgba(49,91,125,0.6)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <main
        ref={patientMainRef}
        id="patient_main_content"
        className="flex-1 pt-6 px-4 md:px-8 w-full max-w-7xl mx-auto space-y-6 relative transition-all duration-300"
      >
        {
    /* Slim, subtle scroll progress bar indicating view scroll position */
  }
        <div
          id="patient_view_scroll_progress"
          className={`sticky top-16 -mt-6 -mx-4 md:-mx-8 mb-4 z-20 bg-white/95 backdrop-blur-md transition-all duration-200 ${scrollProgress > 2 ? "border-b border-slate-200/80 shadow-xs" : "border-b border-transparent shadow-none"}`}
          role="progressbar"
    aria-valuenow={Math.round(scrollProgress)}
    aria-valuemin={0}
    aria-valuemax={100}
    title={`View scroll: ${Math.round(scrollProgress)}%`}
  >
          <div className="h-[3px] w-full bg-emerald-950/10 overflow-hidden">
            <div
    id="patient_scroll_progress_bar"
    className="h-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 transition-[width] duration-150 ease-out rounded-r-full shadow-xs shadow-emerald-500/30"
    style={{ width: `${scrollProgress}%` }}
  />
          </div>
        </div>
        
        {
    /* ===================== TAB 1: DASHBOARD ===================== */
  }
        {activeTab === "dashboard" && <div id="patient_dashboard" className="space-y-6 animate-fade-in">
            {/* Bento Greeting Section: Welcome + Daily Tip */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main Welcome Card (8 cols) */}
              <div className="lg:col-span-8 bg-gradient-to-br from-[#315B7D] via-[#356388] to-[#44749D] text-white rounded-[22px] p-6 sm:p-8 relative overflow-hidden shadow-[0_10px_30px_rgba(49,91,125,0.15)] border border-[#315B7D]/20 flex flex-col justify-between">
                {/* Subtle soft decorative background circles */}
                <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="absolute right-12 bottom-0 w-48 h-48 rounded-full bg-[#E5F2F8]/10 blur-xl pointer-events-none" />

                <div className="relative z-10 space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold tracking-wide text-white/90">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Dermatology Portal • Active Plan</span>
                  </div>

                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
                    {t.welcome}, {user.name}!
                  </h2>
                  <p className="text-white/85 text-sm sm:text-base leading-relaxed max-w-xl font-normal">
                    Your personalized dermatology treatment plan is active. View your treatment progress, reports and recommendations.
                  </p>
                </div>

                <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab("treatment")}
                    className="px-4 py-2.5 bg-white text-[#315B7D] hover:bg-[#E8F1F7] font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <span>View Treatment Plan</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startConsultationBooking()}
                    className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 font-semibold text-xs sm:text-sm rounded-xl backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">calendar_add_on</span>
                    <span>Book Consultation</span>
                  </button>
                </div>
              </div>

              {/* Daily Tip Card (4 cols) - Premium light warm card with soft border */}
              <div className="lg:col-span-4 bg-[#FDFBF7] border border-[rgba(70,90,110,0.14)] rounded-[22px] p-6 shadow-[0_8px_30px_rgba(40,60,80,0.04)] flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between mb-4">
                  <div className="px-3 py-1 rounded-full bg-[#F7F1E8] border border-[rgba(122,92,40,0.15)] text-[#7A5C28] text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                    <span className="material-symbols-outlined text-sm text-[#7A5C28]">lightbulb</span>
                    <span>{t.dailyTip || "DAILY TIP"}</span>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-2xs">
                    <span className="material-symbols-outlined text-xl">wb_sunny</span>
                  </div>
                </div>

                <div className="relative z-10 flex-1 flex flex-col justify-center">
                  {loadingTip ? (
                    <div className="space-y-2 py-2">
                      <div className="h-4 w-5/6 bg-amber-600/15 rounded-lg animate-pulse" />
                      <div className="h-4 w-4/6 bg-amber-600/10 rounded-lg animate-pulse" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-amber-500/70 text-lg leading-none shrink-0 mt-0.5">format_quote</span>
                        <p className="text-sm font-medium leading-relaxed text-[#263746]">
                          {dailyTip || "Remember to apply SPF 50 sunscreen daily, especially between 10 AM and 4 PM, to protect your skin barrier."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-4 border-t border-[rgba(70,90,110,0.1)] flex items-center justify-between text-xs text-[#8A98A5]">
                  <span className="flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">verified</span>
                    Clinical Recommendation
                  </span>
                  <span className="text-[11px] font-mono">SPF 50+</span>
                </div>
              </div>
            </div>

            {/* Active Rescheduled / Missed Consultation Apology Banner */}
            {(() => {
              const rescheduledApps = patientAppointments.filter(
                (a) => a.status === "Rescheduled" || a.isMissed
              );
              if (rescheduledApps.length === 0) return null;
              return (
                <div className="space-y-3">
                  {rescheduledApps.map((app) => (
                    <div
                      key={app.id}
                      className="p-5 sm:p-6 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/15 border-2 border-rose-300 rounded-[22px] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                          <span className="material-symbols-outlined text-2xl font-bold">event_repeat</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white">
                              Consultation Update & Apology
                            </span>
                            <span className="text-xs text-rose-800 font-bold font-mono">
                              Originally scheduled: {app.date} at {app.time}
                            </span>
                          </div>
                          <h4 className="font-display font-extrabold text-sm sm:text-base text-slate-900">
                            Dr. {app.specialistName || "Specialist"} sends their sincere apologies
                          </h4>
                          <p className="text-xs text-slate-700 leading-relaxed max-w-2xl">
                            "We are truly sorry, but your consultation could not take place due to: <strong className="text-rose-900 font-bold">"{app.rescheduleReason || "Emergency clinical duties"}"</strong>. We have prioritized a proposed reschedule slot for you."
                          </p>
                          <div className="pt-1 flex items-center gap-2 text-xs font-bold text-slate-800">
                            <span className="text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-lg border border-blue-200">
                              Proposed Slot: 📅 {app.proposedDate || app.date} at ⏰ {app.proposedTime || app.time}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-stretch gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAcceptReschedule(app)}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-sm font-black">check</span>
                          <span>Accept Proposed Slot</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectAlternativeSlot(app)}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-sm">calendar_month</span>
                          <span>Pick Another Slot</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Active Confirmed Consultations & Reminders Card */}
            {(() => {
              const confirmedApps = patientAppointments.filter(
                (a) => a.status === "Accepted" || a.status === "Approved"
              );
              if (confirmedApps.length === 0) return null;
              return (
                <div className="space-y-3">
                  {confirmedApps.map((app) => (
                    <div
                      key={app.id}
                      className="p-5 sm:p-6 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-sky-50 border border-emerald-200 rounded-[22px] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                          <span className="material-symbols-outlined text-2xl font-bold">verified</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Meeting Confirmed ✓
                            </span>
                            <span className="text-xs text-emerald-900 font-mono font-bold">
                              📅 {app.date} • ⏰ {app.time} ({app.type === "Online" ? "🌐 Video Consult" : "🏥 In-Person"})
                            </span>
                          </div>
                          <h4 className="font-display font-extrabold text-sm sm:text-base text-slate-900">
                            Upcoming Consultation with {app.specialistName || "Specialist"}
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Doctor has approved this consultation. Your automated reminders are active:
                          </p>

                          {/* Reminder Badges Timeline */}
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
                              <span className="material-symbols-outlined text-xs text-emerald-600 font-black">check</span>
                              <span>12h Notice Scheduled</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
                              <span className="material-symbols-outlined text-xs text-emerald-600 font-black">check</span>
                              <span>1h Notice Scheduled</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-rose-800 border border-rose-200 shadow-2xs animate-pulse">
                              <span className="material-symbols-outlined text-xs text-rose-600 font-black">timer</span>
                              <span>30m Urgent Alert Scheduled</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-stretch gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => triggerPatientReminderPreview(app)}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 text-[#315B7D] border border-[#315B7D]/30 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">volume_up</span>
                          <span>Preview 30m Chime Alert</span>
                        </button>
                        {app.type === "Online" && (
                          <button
                            type="button"
                            onClick={() => alert(`Launching secure telehealth consultation video with ${app.specialistName}...`)}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">videocam</span>
                            <span>Join Video Call</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Quick Actions Section */}
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <h3 className="font-display font-extrabold text-base sm:text-lg text-[#263746] tracking-tight">
                    {t.quickActions}
                  </h3>
                  <p className="text-xs text-[#8A98A5]">Direct access to priority clinical services</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* 1. View Report */}
                <button
                  type="button"
                  onClick={() => {
                    const diagnosed = cases.find((c) => isMyCase(c) && c.status === "Diagnosed") || cases.find((c) => c.status === "Diagnosed");
                    if (diagnosed) {
                      setShowDiagnosedReportModal(diagnosed);
                    } else {
                      alert("You do not have any diagnostic reports filled by doctor yet. Submit a treatment request to consult a specialist.");
                    }
                  }}
                  className="bg-white border border-[rgba(70,90,110,0.12)] hover:border-[#315B7D]/40 rounded-[20px] p-4 flex flex-col justify-between group shadow-[0_4px_20px_rgba(40,60,80,0.04)] hover:shadow-[0_8px_28px_rgba(40,60,80,0.08)] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#E5F2F8] text-[#315B7D] flex items-center justify-center group-hover:scale-105 transition-transform mb-3">
                    <span className="material-symbols-outlined text-2xl">summarize</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#263746] group-hover:text-[#315B7D] transition-colors">{t.viewReport}</h4>
                    <p className="text-[11px] text-[#8A98A5] mt-0.5 leading-snug line-clamp-2">Clinical diagnosis notes</p>
                  </div>
                </button>

                {/* 2. Submit Diagnosis / Skin Assessment */}
                <button
                  type="button"
                  onClick={() => setActiveTab("treatment")}
                  className="bg-white border border-[rgba(70,90,110,0.12)] hover:border-[#315B7D]/40 rounded-[20px] p-4 flex flex-col justify-between group shadow-[0_4px_20px_rgba(40,60,80,0.04)] hover:shadow-[0_8px_28px_rgba(40,60,80,0.08)] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#EEEAF8] text-[#52447D] flex items-center justify-center group-hover:scale-105 transition-transform mb-3">
                    <span className="material-symbols-outlined text-2xl">medical_information</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#263746] group-hover:text-[#315B7D] transition-colors">{t.diagnosis}</h4>
                    <p className="text-[11px] text-[#8A98A5] mt-0.5 leading-snug line-clamp-2">AI skin symptom triage</p>
                  </div>
                </button>

                {/* 3. Find Clinics */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("treatment");
                    setTimeout(() => {
                      const el = document.getElementById("clinics_section_anchor");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                  className="bg-white border border-[rgba(70,90,110,0.12)] hover:border-[#315B7D]/40 rounded-[20px] p-4 flex flex-col justify-between group shadow-[0_4px_20px_rgba(40,60,80,0.04)] hover:shadow-[0_8px_28px_rgba(40,60,80,0.08)] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#F7E9E7] text-[#8C433A] flex items-center justify-center group-hover:scale-105 transition-transform mb-3">
                    <span className="material-symbols-outlined text-2xl">local_hospital</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#263746] group-hover:text-[#315B7D] transition-colors">{t.findClinics}</h4>
                    <p className="text-[11px] text-[#8A98A5] mt-0.5 leading-snug line-clamp-2">Verified clinics & docs</p>
                  </div>
                </button>

                {/* 4. Book Appointment */}
                <button
                  type="button"
                  onClick={() => startConsultationBooking()}
                  className="bg-white border border-[rgba(70,90,110,0.12)] hover:border-[#315B7D]/40 rounded-[20px] p-4 flex flex-col justify-between group shadow-[0_4px_20px_rgba(40,60,80,0.04)] hover:shadow-[0_8px_28px_rgba(40,60,80,0.08)] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#F7F1E8] text-[#7A5C28] flex items-center justify-center group-hover:scale-105 transition-transform mb-3">
                    <span className="material-symbols-outlined text-2xl">event_available</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#263746] group-hover:text-[#315B7D] transition-colors">Book Consultation</h4>
                    <p className="text-[11px] text-[#8A98A5] mt-0.5 leading-snug line-clamp-2">In-person & video slots</p>
                  </div>
                </button>

                {/* 5. Treatment Plan */}
                <button
                  type="button"
                  onClick={() => setActiveTab("treatment")}
                  className="bg-white border border-[rgba(70,90,110,0.12)] hover:border-[#315B7D]/40 rounded-[20px] p-4 flex flex-col justify-between group shadow-[0_4px_20px_rgba(40,60,80,0.04)] hover:shadow-[0_8px_28px_rgba(40,60,80,0.08)] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#E8F1F7] text-[#24465F] flex items-center justify-center group-hover:scale-105 transition-transform mb-3">
                    <span className="material-symbols-outlined text-2xl">prescriptions</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#263746] group-hover:text-[#315B7D] transition-colors">Treatment Plan</h4>
                    <p className="text-[11px] text-[#8A98A5] mt-0.5 leading-snug line-clamp-2">Active care regimen</p>
                  </div>
                </button>

                {/* 6. Derm Library */}
                <button
                  type="button"
                  onClick={() => setActiveTab("library")}
                  className="bg-white border border-[rgba(70,90,110,0.12)] hover:border-[#315B7D]/40 rounded-[20px] p-4 flex flex-col justify-between group shadow-[0_4px_20px_rgba(40,60,80,0.04)] hover:shadow-[0_8px_28px_rgba(40,60,80,0.08)] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#E5F2F8] text-[#315B7D] flex items-center justify-center group-hover:scale-105 transition-transform mb-3">
                    <span className="material-symbols-outlined text-2xl">menu_book</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#263746] group-hover:text-[#315B7D] transition-colors">{t.library}</h4>
                    <p className="text-[11px] text-[#8A98A5] mt-0.5 leading-snug line-clamp-2">Educational articles</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Real-Time Up-To-Date Meeting Calendar & Scheduled Meetings List */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Calendar Control Card (col-span-5) */}
              <div className="lg:col-span-5 bg-white border border-[rgba(70,90,110,0.14)] rounded-[22px] p-6 shadow-[0_8px_30px_rgba(40,60,80,0.04)] space-y-4">
                {/* Header: Title + Live Sync Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(70,90,110,0.1)] pb-3.5">
                  <div>
                    <h3 className="font-display font-extrabold text-sm text-[#263746] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#315B7D] text-xl">calendar_month</span>
                      {t.calendar}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        LIVE SYNC • {liveNow.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Mode Selector (Month / Week) */}
                  <div className="flex items-center gap-1 bg-[#E8F1F7]/70 p-1 rounded-xl border border-[rgba(70,90,110,0.12)]">
                    <button
                      type="button"
                      onClick={() => setCalendarMode("month")}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        calendarMode === "month"
                          ? "bg-white text-[#315B7D] shadow-xs"
                          : "text-[#667685] hover:text-[#263746]"
                      }`}
                    >
                      Month
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMode("week")}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        calendarMode === "week"
                          ? "bg-white text-[#315B7D] shadow-xs"
                          : "text-[#667685] hover:text-[#263746]"
                      }`}
                    >
                      Week
                    </button>
                  </div>
                </div>

                {/* Month Navigator Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="w-7 h-7 rounded-lg border border-[rgba(70,90,110,0.18)] hover:bg-[#E8F1F7] flex items-center justify-center text-sm font-bold text-[#263746] transition-colors cursor-pointer"
                      title="Previous Month"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="w-7 h-7 rounded-lg border border-[rgba(70,90,110,0.18)] hover:bg-[#E8F1F7] flex items-center justify-center text-sm font-bold text-[#263746] transition-colors cursor-pointer"
                      title="Next Month"
                    >
                      ›
                    </button>
                    <span className="font-display font-extrabold text-sm text-[#263746] ml-1">
                      {MONTH_NAMES[calMonth]} {calYear}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetToToday}
                    className="px-2.5 py-1 text-[11px] font-bold bg-[#E8F1F7] text-[#315B7D] border border-[#315B7D]/20 rounded-lg hover:bg-[#E8F1F7]/80 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Today</span>
                  </button>
                </div>

                {/* Calendar View (Month Grid or Week Strip) */}
                {calendarMode === "month" ? (
                  <div className="space-y-1">
                    {
    /* Day Headers */
  }
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d} className="text-[10px] font-bold text-outline uppercase tracking-wider py-1">
                          {d}
                        </span>)}
                    </div>

                    {/* Month Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((cell, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedCalDate(cell.dateStr)}
                          className={`relative py-2.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            cell.isSelected
                              ? "bg-[#315B7D] text-white shadow-md ring-2 ring-[#315B7D]/30"
                              : cell.isToday
                              ? "bg-[#E8F1F7] text-[#24465F] border border-[#315B7D]/40 font-extrabold"
                              : cell.isCurrentMonth
                              ? "bg-white hover:bg-[#F5F7FA] text-[#263746] border border-[rgba(70,90,110,0.1)]"
                              : "bg-[#F8FAFC] text-[#8A98A5]/40 border border-transparent"
                          }`}
                        >
                          <span className="text-xs">{cell.dayNum}</span>

                          {cell.isToday && (
                            <span className={`text-[8px] leading-none uppercase font-black tracking-tighter px-1 rounded ${cell.isSelected ? "bg-white text-[#315B7D]" : "bg-[#315B7D] text-white"}`}>
                              Today
                            </span>
                          )}

                          {cell.appointmentsCount > 0 && !cell.isToday && (
                            <span className={`w-2 h-2 rounded-full ${cell.isSelected ? "bg-amber-300" : "bg-[#315B7D] animate-pulse"}`} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Week Strip View */
                  <div className="grid grid-cols-7 gap-1.5">
                    {weekDays.map((day) => (
                      <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => setSelectedCalDate(day.dateStr)}
                        className={`py-3 px-1 rounded-xl flex flex-col items-center justify-center border text-xs transition-all cursor-pointer ${
                          day.isSelected
                            ? "bg-[#315B7D] text-white border-[#315B7D] shadow-md font-extrabold ring-2 ring-[#315B7D]/30"
                            : day.isToday
                            ? "bg-[#E8F1F7] border-[#315B7D]/40 text-[#24465F] font-bold"
                            : "bg-white border-[rgba(70,90,110,0.12)] text-[#263746] hover:bg-[#F5F7FA]"
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold tracking-wider">{day.dayName}</span>
                        <span className="text-sm font-extrabold mt-0.5">{day.dayNum}</span>
                        {day.appointmentsCount > 0 && (
                          <span className={`mt-1 text-[9px] font-black px-1.5 py-0.2 rounded-full ${day.isSelected ? "bg-white text-[#315B7D]" : "bg-[#E8F1F7] text-[#315B7D]"}`}>
                            {day.appointmentsCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Date Summary & Direct Booking Trigger */}
                <div className="pt-2 border-t border-[rgba(70,90,110,0.1)] flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="text-[#8A98A5] block text-[10px]">Active Date Selected:</span>
                    <span className="font-bold text-[#263746] font-mono">{selectedCalDate}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => startConsultationBooking({ date: selectedCalDate, stage: 1 })}
                    className="px-3.5 py-1.5 bg-[#315B7D] hover:bg-[#24465F] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    <span>Book on Date</span>
                  </button>
                </div>
              </div>

              {/* Scheduled Consultations List for Selected Date (col-span-7) */}
              <div className="lg:col-span-7 bg-white border border-[rgba(70,90,110,0.14)] rounded-[22px] p-6 shadow-[0_8px_30px_rgba(40,60,80,0.04)] space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(70,90,110,0.1)] pb-3.5 mb-3.5">
                    <div>
                      <h3 className="font-display font-extrabold text-sm text-[#263746] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#315B7D] text-lg">event_available</span>
                        Scheduled Consultations
                      </h3>
                      <p className="text-[11px] text-[#667685] font-medium">
                        {showAllAppointments ? "Showing all upcoming booked consultations" : `Filter: ${selectedCalDate}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAllAppointments(!showAllAppointments)}
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          showAllAppointments
                            ? "bg-[#315B7D] text-white border-transparent shadow-xs"
                            : "bg-white border-[rgba(70,90,110,0.18)] text-[#263746] hover:bg-[#F5F7FA]"
                        }`}
                      >
                        {showAllAppointments ? "Filter by Selected Date" : "Show All Appointments"}
                      </button>

                      <button
                        type="button"
                        onClick={() => startConsultationBooking({ date: selectedCalDate, stage: 1 })}
                        className="px-3 py-1.5 bg-[#315B7D] hover:bg-[#24465F] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">add_event</span>
                        <span>Schedule Consultation</span>
                      </button>
                    </div>
                  </div>

                  {/* Appointments Filtered List */}
                  {(() => {
                    const filteredApps = appointments.filter((app) => {
                      if (!isMyAppointment(app)) return false;
                      if (showAllAppointments) return true;
                      return app.date === selectedCalDate;
                    });
                    if (filteredApps.length === 0) {
                      return (
                        <div className="p-8 text-center bg-[#F8FAFC] rounded-2xl border border-dashed border-[rgba(70,90,110,0.18)] space-y-2">
                          <span className="material-symbols-outlined text-[#8A98A5] text-3xl">event_busy</span>
                          <p className="text-xs font-bold text-[#263746]">No consultations scheduled for {selectedCalDate}</p>
                          <p className="text-[11px] text-[#8A98A5]">Click "Book on Date" to reserve a video call or clinic slot with a specialist.</p>
                          <button
                            type="button"
                            onClick={() => startConsultationBooking({ date: selectedCalDate, stage: 1 })}
                            className="mt-2 px-4 py-2 bg-[#315B7D] hover:bg-[#24465F] text-white font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">calendar_month</span>
                            <span>Book Consultation Now</span>
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                        {filteredApps.map((app) => {
                          const matchedDoc = allSpecialists.find((s) => s.id === app.specialistId || s.name === app.specialistName);
                          const avatarSrc = getDoctorAvatar(matchedDoc || app.specialistName);
                          return (
                            <div
                              key={app.id}
        className="p-3.5 bg-surface rounded-2xl border border-outline-variant/80 hover:border-primary/50 transition-all flex items-center justify-between gap-3 shadow-xs"
      >
                              <div className="flex items-center gap-3 min-w-0">
                                {
        /* Doctor Circular Avatar with photo and view profile trigger */
      }
                                <div
        onClick={() => matchedDoc && setSelectedDoctorProfile(matchedDoc)}
        className={`w-11 h-11 rounded-full overflow-hidden border-2 border-primary/40 shadow-sm shrink-0 relative ${matchedDoc ? "cursor-pointer group hover:ring-2 hover:ring-primary hover:scale-105" : ""} transition-all`}
        title={matchedDoc ? `Click to view Dr. ${app.specialistName}'s profile` : app.specialistName}
      >
                                  <img
        src={avatarSrc}
        alt={app.specialistName}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover object-center"
        onError={(e) => {
          e.target.src = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80";
        }}
      />
                                  {matchedDoc && <div className="absolute inset-0 bg-primary/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <span className="material-symbols-outlined text-white text-xs">visibility</span>
                                    </div>}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4
        onClick={() => matchedDoc && setSelectedDoctorProfile(matchedDoc)}
        className={`text-xs font-extrabold text-on-surface truncate ${matchedDoc ? "hover:text-primary hover:underline cursor-pointer" : ""}`}
      >
                                      {app.specialistName}
                                    </h4>
                                    {matchedDoc && <button
        type="button"
        onClick={() => setSelectedDoctorProfile(matchedDoc)}
        className="text-[10px] text-primary hover:underline font-bold"
      >
                                        • Profile
                                      </button>}
                                  </div>
                                  <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                                    <span>{app.type === "Online" ? "🌐 Video Consultation" : "🏥 Physical Clinic Visit"}</span>
                                    {app.providerName && (
                                      <span className="text-[10px] text-outline truncate max-w-[130px]">
                                        • {app.providerName}
                                      </span>
                                    )}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-outline font-mono">
                                      📅 {app.date} • ⏰ {app.time}
                                    </span>
                                    {app.lesionImage && (
                                      <span className="text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                                        <span className="material-symbols-outlined text-[11px]">photo</span>
                                        Photo attached
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span
                                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl shrink-0 flex items-center gap-1.5 ${
                                    app.status === "Accepted" || app.status === "Approved"
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : app.status === "Rescheduled" || app.isMissed
                                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                                      : app.status === "Declined" || app.status === "Rejected"
                                      ? "bg-slate-100 text-slate-700 border border-slate-200"
                                      : "bg-amber-100 text-amber-900 border border-amber-300 shadow-xs ring-2 ring-amber-300/30 animate-pulse"
                                  }`}
                                >
                                  {app.status === "Accepted" || app.status === "Approved" ? (
                                    <>
                                      <span className="material-symbols-outlined text-xs text-emerald-700 font-bold">check_circle</span>
                                      <span>Approved & Confirmed ✓</span>
                                    </>
                                  ) : app.status === "Rescheduled" || app.isMissed ? (
                                    <>
                                      <span className="material-symbols-outlined text-xs text-rose-700 font-bold">event_repeat</span>
                                      <span>Missed & Reschedule Sent ✗</span>
                                    </>
                                  ) : app.status === "Declined" || app.status === "Rejected" ? (
                                    <>
                                      <span className="material-symbols-outlined text-xs">cancel</span>
                                      <span>Declined</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined text-xs text-amber-700 animate-spin">hourglass_top</span>
                                      <span>Waiting for Doctor Approval</span>
                                    </>
                                  )}
                                </span>

                                {(app.status === "Rescheduled" || app.isMissed) && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptReschedule(app)}
                                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg shadow-2xs cursor-pointer active:scale-95"
                                    >
                                      Accept Proposed {app.proposedTime || app.time} ✓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAlternativeSlot(app)}
                                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200 cursor-pointer"
                                    >
                                      Pick Slot
                                    </button>
                                  </div>
                                )}

                                {(app.status === "Accepted" || app.status === "Approved") && (
                                  <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                                    <span className="material-symbols-outlined text-xs text-emerald-600">alarm</span>
                                    <span>Reminders Active (12h/1h/30m)</span>
                                  </div>
                                )}

                                {app.status === "Pending" && (
                                  <span className="text-[9px] text-amber-700 font-medium italic">
                                    Doctor reviewing lesion case
                                  </span>
                                )}
                              </div>
                            </div>
                        );
                      })}
                    </div>
                  );
                })()}
                </div>

                {
    /* Footer Tip */
  }
                <div className="pt-3 border-t border-outline-variant/30 text-[11px] text-outline flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-primary">info</span>
                    Appointments automatically sync with specialist clinical queues.
                  </span>
                  <span className="font-mono text-[10px] font-bold text-primary">
                    {appointments.filter(isMyAppointment).length} Total Bookings
                  </span>
                </div>
              </div>
            </div>

            {/* QUICK BOOKING MODAL */}
            {showQuickBookModal && <div className="fixed inset-0 z-50 glass-overlay-backdrop flex items-center justify-center p-4">
                <div className="glass-modal rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-scale-up">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                    <div>
                      <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest block">
                        Real-Time Scheduler
                      </span>
                      <h3 className="font-display font-extrabold text-base text-slate-900">
                        Book Consultation
                      </h3>
                    </div>
                    <button
    type="button"
    onClick={() => setShowQuickBookModal(false)}
    className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
  >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleQuickBookAppointment} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Selected Date</label>
                      <input
    type="date"
    required
    value={selectedCalDate}
    onChange={(e) => setSelectedCalDate(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs outline-none focus:border-blue-600 font-bold"
  />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Select Specialist *</label>
                      <select
    required
    value={quickBookSpec}
    onChange={(e) => setQuickBookSpec(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600 font-bold"
  >
                        {allSpecialists.map((spec) => <option key={spec.id} value={spec.id}>
                            {spec.name} ({spec.specialization})
                          </option>)}
                      </select>
                    </div>

                    {
    /* Selected Doctor Preview Card with Prominent Circular Avatar */
  }
                    {(() => {
    const curSpec = allSpecialists.find((s) => s.id === quickBookSpec) || allSpecialists[0];
    if (!curSpec) return null;
    return <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-600 shadow-sm shrink-0">
                              <img
      src={getDoctorAvatar(curSpec)}
      alt={curSpec.name}
      referrerPolicy="no-referrer"
      className="w-full h-full object-cover object-center"
      onError={(e) => {
        e.target.src = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80";
      }}
    />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-extrabold text-slate-900 text-xs truncate">{curSpec.name}</h4>
                                <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">Verified</span>
                              </div>
                              <p className="text-[11px] text-slate-600 truncate">{curSpec.specialization}</p>
                              <p className="text-[10px] text-slate-500 truncate">{curSpec.clinicName || curSpec.hospitalName}</p>
                            </div>
                          </div>
                          <button
      type="button"
      onClick={() => {
        setSelectedDoctorProfile(curSpec);
      }}
      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline shrink-0 cursor-pointer"
    >
                            View Profile
                          </button>
                        </div>;
  })()}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Consultation Mode</label>
                        <select
    value={quickBookType}
    onChange={(e) => setQuickBookType(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600 font-bold"
  >
                          <option value="Online">Online Video Call</option>
                          <option value="Physical">Physical Clinic Visit</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Time Slot *</label>
                        <select
    value={quickBookTime}
    onChange={(e) => setQuickBookTime(e.target.value)}
    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600 font-bold"
  >
                          <option value="09:00 AM">09:00 AM</option>
                          <option value="10:00 AM">10:00 AM</option>
                          <option value="11:30 AM">11:30 AM</option>
                          <option value="01:15 PM">01:15 PM</option>
                          <option value="03:00 PM">03:00 PM</option>
                          <option value="04:30 PM">04:30 PM</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
    type="button"
    onClick={() => setShowQuickBookModal(false)}
    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 text-xs"
  >
                        Cancel
                      </button>
                      <button
    type="submit"
    className="flex-1 py-3 bg-blue-600 text-white font-extrabold rounded-xl hover:bg-blue-700 text-xs shadow-md"
  >
                        Confirm Booking
                      </button>
                    </div>
                  </form>
                </div>
              </div>}

            {
    /* Interactive AI Triage Chat Bot assistant */
  }
            <div className="bg-[#f0f3ff] border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-primary text-white p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-secondary-container animate-bounce">smart_toy</span>
                <div>
                  <h3 className="font-display font-extrabold text-sm">{t.aiTriage}</h3>
                  <p className="text-[10px] text-[#c4d2ff]">{t.aiTriageSub}</p>
                </div>
              </div>

              {
    /* Chat conversations area */
  }
              <div className="p-4 h-64 overflow-y-auto space-y-3 bg-white">
                {chatMessages.map((msg, idx) => <div key={idx} className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold ${msg.role === "user" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-800"}`}>
                      <span className="material-symbols-outlined text-sm">{msg.role === "user" ? "person" : "smart_toy"}</span>
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.role === "user" ? "bg-primary text-white rounded-tr-none" : "bg-surface-container-low text-on-surface rounded-tl-none border border-outline-variant/30"}`}>
                      {msg.content}
                    </div>
                  </div>)}
                {isSendingToAI && <div className="flex gap-3 max-w-[80%] animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-secondary-container text-[#006c47] flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">smart_toy</span>
                    </div>
                    <div className="p-3 bg-surface-container rounded-2xl text-xs rounded-tl-none text-outline">
                      AI Triage Assistant is analyzing...
                    </div>
                  </div>}
              </div>

              {
    /* Chat entry bar */
  }
              <form onSubmit={handleSendChatMessage} className="p-3 bg-surface-container-low border-t border-outline-variant flex gap-2">
                <input
    type="text"
    placeholder={t.typeSymptoms}
    value={currentInput}
    onChange={(e) => setCurrentInput(e.target.value)}
    disabled={isSendingToAI}
    className="flex-1 px-4 py-2 bg-white border border-outline-variant rounded-full text-xs outline-none focus:border-primary"
  />
                <button
    type="submit"
    disabled={isSendingToAI}
    className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-container shrink-0"
  >
                  <span className="material-symbols-outlined text-lg fill">send</span>
                </button>
              </form>
            </div>
          </div>}

        {
    /* ===================== TAB 2: DIAGNOSIS & TREATMENT ===================== */
  }
        {activeTab === "treatment" && <div id="patient_treatment" className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant gap-2">
              <div>
                <h2 className="font-display font-black text-2xl text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">dermatology</span>
                  Get Cutaneous Diagnosis & Specialist Triage
                </h2>
                <p className="text-sm text-on-surface-variant">
                  High-resolution lesion capture, real-time AI optical scanning, and certified specialist consultations.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Clinical Dermatoscope Triage Ready
                </span>
              </div>
            </div>

            {/* ================= VISUAL PROGRESS STEPPER ================= */}
            <div id="patient_treatment_stepper" className="bg-white border border-outline-variant rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-outline block">
                    Diagnostic Workflow
                  </span>
                  <h3 className="font-display font-black text-base sm:text-lg text-on-surface">
                    Patient Stage Progress Tracker
                  </h3>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Stage {treatmentStage} of 3 • {
                      treatmentStage === 1 ? "Image Upload" :
                      treatmentStage === 2 ? "Select Provider" : "Timetable & Block Slot"
                    }
                  </span>
                  {treatmentStage > 1 && (
                    <button
                      type="button"
                      onClick={() => setTreatmentStage(1)}
                      className="text-xs text-outline hover:text-on-surface font-semibold underline cursor-pointer"
                    >
                      Reset Workflow
                    </button>
                  )}
                </div>
              </div>

              {/* Visual Progress Bar & Step Badges */}
              <div className="relative pt-2 pb-2">
                {/* Connecting Background Line */}
                <div className="absolute top-7 left-8 right-8 h-1 bg-surface-container-high -translate-y-1/2 rounded-full z-0" />
                
                {/* Animated Active Progress Fill */}
                <div
                  className="absolute top-7 left-8 h-1 bg-gradient-to-r from-primary via-sky-500 to-emerald-500 -translate-y-1/2 rounded-full z-0 transition-all duration-500"
                  style={{
                    width: treatmentStage === 1 ? "18%" : treatmentStage === 2 ? "50%" : "calc(100% - 4rem)"
                  }}
                />

                {/* 3 Step Nodes */}
                <div className="relative z-10 grid grid-cols-3 gap-2">
                  {/* Step 1: Image Upload */}
                  <button
                    type="button"
                    onClick={() => setTreatmentStage(1)}
                    className="flex flex-col items-center text-center group cursor-pointer"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${
                      treatmentStage === 1
                        ? "bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-white shadow-[0_2px_12px_rgba(49,91,125,0.25)] scale-105"
                        : treatmentStage > 1
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-surface-container-high text-outline hover:bg-slate-200"
                    }`}>
                      {treatmentStage > 1 ? (
                        <span className="material-symbols-outlined text-2xl font-bold">check</span>
                      ) : (
                        <span className="material-symbols-outlined text-2xl">photo_camera</span>
                      )}
                    </div>
                    <span className={`mt-2 text-xs font-bold block ${
                      treatmentStage === 1 ? "text-primary font-black" : treatmentStage > 1 ? "text-emerald-700" : "text-outline"
                    }`}>
                      1. Image Upload
                    </span>
                    <span className="text-[10px] text-outline hidden sm:block">Photos & Symptoms</span>
                  </button>

                  {/* Step 2: Select Provider */}
                  <button
                    type="button"
                    onClick={() => setTreatmentStage(2)}
                    className="flex flex-col items-center text-center group cursor-pointer"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${
                      treatmentStage === 2
                        ? "bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-white shadow-[0_2px_12px_rgba(49,91,125,0.25)] scale-105"
                        : treatmentStage > 2
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-surface-container-high text-outline hover:bg-slate-200"
                    }`}>
                      {treatmentStage > 2 ? (
                        <span className="material-symbols-outlined text-2xl font-bold">check</span>
                      ) : (
                        <span className="material-symbols-outlined text-2xl">local_hospital</span>
                      )}
                    </div>
                    <span className={`mt-2 text-xs font-bold block ${
                      treatmentStage === 2 ? "text-primary font-black" : treatmentStage > 2 ? "text-emerald-700" : "text-outline"
                    }`}>
                      2. Select Provider
                    </span>
                    <span className="text-[10px] text-outline hidden sm:block">Doctor, Clinic, or Hospital</span>
                  </button>

                  {/* Step 3: Timetable & Block Slot */}
                  <button
                    type="button"
                    onClick={() => setTreatmentStage(3)}
                    className="flex flex-col items-center text-center group cursor-pointer"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${
                      treatmentStage === 3
                        ? "bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-white shadow-[0_2px_12px_rgba(49,91,125,0.25)] scale-105"
                        : "bg-surface-container-high text-outline hover:bg-slate-200"
                    }`}>
                      <span className="material-symbols-outlined text-2xl">calendar_month</span>
                    </div>
                    <span className={`mt-2 text-xs font-bold block ${
                      treatmentStage === 3 ? "text-primary font-black" : "text-outline"
                    }`}>
                      3. Timetable & Block Slot
                    </span>
                    <span className="text-[10px] text-outline hidden sm:block">Free Slots & Approval</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ================= STEP CONTENT & CLINICS DIRECTORY GRID ================= */}
            <form onSubmit={handleCaseSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (Stage-dependent workflow) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* ---------------- STAGE 1: IMAGE UPLOAD & CONSULTATION INITIATION ---------------- */}
                {treatmentStage === 1 && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Target Provider Header Banner when coming from a Doctor/Clinic booking button */}
                    {currentSelectedProvider && (
                      <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border border-blue-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-primary/50 shrink-0 shadow-sm bg-white">
                            <img
                              src={getDoctorAvatar(currentSelectedProvider)}
                              alt={currentSelectedProvider.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80";
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                Targeted Consultation
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                {recipientType === "doctor" ? "Specialist Dermatologist" : recipientType === "clinic" ? "Skin Clinic" : "Hospital"}
                              </span>
                            </div>
                            <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-900 truncate">
                              {currentSelectedProvider.name}
                            </h3>
                            <p className="text-[11px] text-slate-600 truncate">
                              {currentSelectedProvider.specialization || currentSelectedProvider.address || "Dermatology Center"} • 🕒 {currentSelectedProvider.consultationHours || currentSelectedProvider.operatingHours || "09:00 AM - 05:00 PM"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => setTreatmentStage(3)}
                            className="px-3.5 py-2 bg-primary hover:bg-primary/90 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Jump to Timetable</span>
                            <span className="material-symbols-outlined text-sm">calendar_month</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTreatmentStage(2)}
                            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                          >
                            <span>Change</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Media Upload Box (CSS Selector Target) */}
                    <div className="bg-white border border-outline-variant/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <input
                        type="file"
                        ref={cameraInputRef}
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                      />

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-outline-variant/60 gap-2">
                        <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary">add_a_photo</span>
                          1. Upload Dermatology Photos or Lesion Video
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-secondary font-semibold bg-secondary-container/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Dermatoscope Triage Ready
                          </span>
                        </div>
                      </div>
                      
                      {/* Dropzone with Drag & Drop */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
                          isDragging ? "border-primary bg-primary/10 scale-[0.99]" : "border-outline-variant hover:border-primary bg-surface-container-low"
                        }`}
                      >
                        <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                          <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-on-surface">
                          Drag & drop skin lesion photos or take a high-res capture
                        </p>
                        <p className="text-[10px] text-outline mt-1 font-mono">
                          PNG, JPG, WEBP, MP4 supported (Max 50MB). End-to-end encrypted for specialist review.
                        </p>

                        {/* Quick Access Upload Action Buttons */}
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
                          >
                            <span className="material-symbols-outlined text-base">folder_open</span>
                            Browse Files
                          </button>

                          <button
                            type="button"
                            onClick={openLiveCamera}
                            className="px-4 py-2.5 bg-secondary-container text-[#006c47] text-xs font-bold rounded-xl hover:bg-secondary-container/80 transition-all flex items-center gap-2 border border-secondary/20 shadow-sm cursor-pointer active:scale-95"
                          >
                            <span className="material-symbols-outlined text-base">photo_camera</span>
                            Take Photo (Camera)
                          </button>
                        </div>

                        {/* One-Click Clinical Sample Presets */}
                        <div className="mt-4 pt-3 border-t border-outline-variant/40 flex flex-wrap items-center justify-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-outline block mr-1">
                            Load Clinical Samples:
                          </span>
                          <button
                            type="button"
                            onClick={() => loadSpecificSample("macro")}
                            className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <span>📸 Macro Dermatoscope</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => loadSpecificSample("eczema")}
                            className="px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <span>🔍 Eczema Plaque</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => loadSpecificSample("mole")}
                            className="px-2.5 py-1 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <span>🔬 Pigmented Mole</span>
                          </button>
                        </div>
                      </div>

                      {/* Uploaded Media Preview */}
                      {uploadedMedia && (
                        <div className="mt-4 flex items-center gap-3 p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 animate-fade-in">
                          {uploadedMedia.startsWith("data:video") ? (
                            <video src={uploadedMedia} controls className="w-20 h-20 object-cover rounded-lg border border-blue-300 bg-black shrink-0" />
                          ) : (
                            <img src={uploadedMedia} alt="Skin Concern Preview" className="w-20 h-20 object-cover rounded-lg border border-blue-300 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-on-surface block truncate">
                              {mediaFileName || "clinical_lesion_photo.jpg"}
                            </span>
                            <span className="text-[11px] text-outline block">
                              {mediaFileSize || "Ready for Specialist Triage"}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-mono font-bold flex items-center gap-1 mt-1">
                              <span className="material-symbols-outlined text-xs">verified_user</span> Encrypted & Ready for Doctor Consultation
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedMedia(null);
                              setMediaFileName("");
                              setMediaFileSize("");
                            }}
                            className="text-error hover:bg-error-container p-2 rounded-full transition-colors cursor-pointer shrink-0"
                            title="Delete photo"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Voice / Text description of Symptoms */}
                    <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
                      <span className="block font-bold text-sm text-on-surface mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">mic</span>
                        2. Describe Symptoms (Type or Voice Record)
                      </span>

                      <div className="flex flex-col sm:flex-row gap-4 items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                        <button
                          type="button"
                          onClick={handleVoiceRecordSimulation}
                          className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 relative transition-all cursor-pointer ${
                            isRecording ? "bg-error text-white animate-pulse" : "bg-[#e7eeff] text-primary hover:bg-[#dfe8ff]"
                          }`}
                        >
                          <span className="material-symbols-outlined text-2xl font-bold fill">mic</span>
                          {isRecording && <div className="absolute inset-0 rounded-full border-4 border-error animate-ping" />}
                        </button>
                        
                        <div className="flex-1 w-full">
                          <span className="block text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
                            {isRecording ? "Recording active... click button to stop & transcribe" : "Click Mic button to record clinical voice note or enter symptoms below"}
                          </span>
                          <textarea
                            placeholder="Type symptoms here (e.g. onset, duration, severe itching, pain levels, flare history)..."
                            value={symptomsText}
                            onChange={(e) => setSymptomsText(e.target.value)}
                            className="w-full h-24 bg-white border border-outline-variant focus:border-primary rounded-lg p-3 text-xs outline-none resize-none"
                          />
                        </div>
                      </div>

                      {/* Quick Symptom Chips */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-outline mr-1 uppercase">Quick Add:</span>
                        {[
                          "+ Severe Itching (Pruritus)",
                          "+ Erythematous Plaque",
                          "+ Dry & Scaling Skin",
                          "+ Burning / Stinging",
                          "+ Lesion Border Change"
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => {
                              setSymptomsText((prev) => (prev ? prev + ", " + chip.replace("+ ", "") : chip.replace("+ ", "")));
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-surface-container hover:bg-primary/10 hover:text-primary text-slate-700 transition-colors cursor-pointer border border-outline-variant/40"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Step 1 Next Actions */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                      {currentSelectedProvider ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (!uploadedMedia && !symptomsText.trim()) {
                                setUploadedMedia(lesionMacroImg);
                                setMediaFileName("clinical_dermatoscope_macro.jpg");
                                setMediaFileSize("1.4 MB");
                                setSymptomsText("Localized erythematous pruritic plaque on upper forearm, persisting 4 days without vesicular breakdown.");
                              }
                              setTreatmentStage(3);
                            }}
                            className="flex-1 py-3.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer active:scale-95"
                          >
                            <span>Proceed to Timetable & Block Slot with {currentSelectedProvider.name} (Stage 3)</span>
                            <span className="material-symbols-outlined text-base">calendar_month</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTreatmentStage(2)}
                            className="py-3.5 px-5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <span>Browse Other Providers (Stage 2)</span>
                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!uploadedMedia && !symptomsText.trim()) {
                              setUploadedMedia(lesionMacroImg);
                              setMediaFileName("clinical_dermatoscope_macro.jpg");
                              setMediaFileSize("1.4 MB");
                              setSymptomsText("Localized erythematous pruritic plaque on upper forearm, persisting 4 days without vesicular breakdown.");
                            }
                            setTreatmentStage(2);
                          }}
                          className="flex-1 py-3.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer"
                        >
                          <span>Next: Select Doctor, Clinic or Hospital (Stage 2)</span>
                          <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ---------------- STAGE 2: SELECT DOCTOR, CLINIC, OR HOSPITAL ---------------- */}
                {treatmentStage === 2 && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-white border border-outline-variant rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
                      {/* Section Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono block">
                            Stage 2 of 3 • Healthcare Provider Selection
                          </span>
                          <h3 className="font-display font-extrabold text-lg text-on-surface flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">local_hospital</span>
                            Select Doctor, Clinic, or Hospital
                          </h3>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            Choose who should receive your dermatology case and review your submitted lesion photo.
                          </p>
                        </div>
                        <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold self-start sm:self-center">
                          Direct Specialist Routing
                        </span>
                      </div>

                      {/* 1. Recipient Category Switcher */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-on-surface">
                          1. Choose Provider Category:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            { type: "doctor", label: "Specialist Doctor", icon: "stethoscope", count: allSpecialists.length, desc: "Direct consultation with certified dermatologists" },
                            { type: "clinic", label: "Skin Clinic", icon: "medical_services", count: defaultClinics.length, desc: "Outpatient clinical dermatology centers" },
                            { type: "hospital", label: "Hospital", icon: "local_hospital", count: defaultHospitals.length, desc: "Full-service regional referral facilities" }
                          ].map((cat) => {
                            const isSelected = recipientType === cat.type;
                            return (
                              <button
                                key={cat.type}
                                type="button"
                                onClick={() => {
                                  setRecipientType(cat.type);
                                  if (cat.type === "doctor") setSelectedProviderId(allSpecialists[0]?.id || "SPEC-001");
                                  else if (cat.type === "clinic") setSelectedProviderId(defaultClinics[0]?.id || "CLI-001");
                                  else setSelectedProviderId(defaultHospitals[0]?.id || "HOSP-001");
                                }}
                                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? "bg-[#E8F1F7] border-[#315B7D] ring-2 ring-[#315B7D]/25 shadow-xs"
                                    : "bg-surface border-outline-variant hover:border-[#315B7D]/40 hover:bg-slate-50"
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="w-8 h-8 rounded-xl bg-white border border-outline-variant/60 flex items-center justify-center text-primary shadow-2xs">
                                      <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-surface-container-high text-outline">
                                      {cat.count} Available
                                    </span>
                                  </div>
                                  <h4 className={`text-xs font-bold ${isSelected ? "text-[#315B7D]" : "text-on-surface"}`}>
                                    {cat.label}
                                  </h4>
                                </div>
                                <span className="text-[10px] text-outline block mt-2 line-clamp-2">{cat.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Select Provider Dropdown with Search */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-on-surface">
                            2. Choose Specific {recipientType === "doctor" ? "Doctor" : recipientType === "clinic" ? "Clinic" : "Hospital"}:
                          </label>
                          <span className="text-[11px] text-outline">
                            {recipientType === "doctor" ? `${allSpecialists.length} Specialists` : recipientType === "clinic" ? `${defaultClinics.length} Clinics` : `${defaultHospitals.length} Hospitals`}
                          </span>
                        </div>

                        <select
                          value={selectedProviderId}
                          onChange={(e) => setSelectedProviderId(e.target.value)}
                          className="w-full p-3 bg-white border border-outline-variant focus:border-primary rounded-xl text-xs font-semibold"
                        >
                          {recipientType === "doctor" &&
                            allSpecialists.map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                {doc.name} — {doc.specialization} ({doc.clinicName || "Dermatology Practice"}) • ★ {doc.rating || 4.9}
                              </option>
                            ))}
                          {recipientType === "clinic" &&
                            defaultClinics.map((cli) => (
                              <option key={cli.id} value={cli.id}>
                                {cli.name} — {cli.address} • ★ {cli.rating || 4.9}
                              </option>
                            ))}
                          {recipientType === "hospital" &&
                            defaultHospitals.map((hosp) => (
                              <option key={hosp.id} value={hosp.id}>
                                {hosp.name} — {hosp.address} • ★ {hosp.rating || 4.9}
                              </option>
                            ))}
                        </select>

                        {/* Interactive Provider Cards List for Fast Visual Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {recipientType === "doctor" &&
                            allSpecialists.map((doc) => {
                              const isSelected = selectedProviderId === doc.id;
                              return (
                                <div
                                  key={doc.id}
                                  onClick={() => {
                                    setSelectedProviderId(doc.id);
                                    setSelectedDoctorProfile(doc);
                                    setSelectedSpecForConsult(doc.id);
                                  }}
                                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                      ? "bg-[#E8F1F7] border-[#315B7D] ring-2 ring-[#315B7D]/25 shadow-xs"
                                      : "bg-surface border-outline-variant hover:border-[#315B7D]/40 hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    {doc.profilePic ? (
                                      <img
                                        src={doc.profilePic}
                                        alt={doc.name}
                                        className="w-12 h-12 rounded-xl object-cover border border-outline-variant shrink-0"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                                        <span className="material-symbols-outlined text-2xl">person</span>
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-1">
                                        <h4 className="font-extrabold text-xs text-on-surface truncate">{doc.name}</h4>
                                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold shrink-0">
                                          ★ {doc.rating || 4.9}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-primary truncate font-medium">{doc.specialization}</p>
                                      <p className="text-[10px] text-outline truncate">{doc.clinicName || "Dermatology Clinic"}</p>
                                    </div>
                                  </div>

                                  <div className="mt-2.5 pt-2 border-t border-outline-variant/60 flex items-center justify-between text-[10px]">
                                    {(() => {
                                      const docBookings = (appointments || []).filter(
                                        (a) => (a.specialistId === doc.id || a.specialistName === doc.name) && a.status !== "Declined"
                                      );
                                      const count = docBookings.length;
                                      return (
                                        <div className="flex items-center gap-1.5">
                                          <span className={`w-2 h-2 rounded-full ${count > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                                          <span className="font-semibold text-slate-700">
                                            {count > 0 ? `${count} Active Booking${count > 1 ? "s" : ""}` : "All Slots Open"}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                    <span className={`font-bold ${isSelected ? "text-primary font-black" : "text-slate-500"}`}>
                                      {isSelected ? "Selected ✓" : "Click to Select"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                          {recipientType === "clinic" &&
                            defaultClinics.map((cli) => {
                              const isSelected = selectedProviderId === cli.id;
                              return (
                                <div
                                  key={cli.id}
                                  onClick={() => setSelectedProviderId(cli.id)}
                                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                      ? "bg-[#E8F1F7] border-[#315B7D] ring-2 ring-[#315B7D]/25 shadow-xs"
                                      : "bg-surface border-outline-variant hover:border-[#315B7D]/40 hover:bg-slate-50"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="font-extrabold text-xs text-on-surface truncate">{cli.name}</h4>
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold shrink-0">
                                        ★ {cli.rating || 4.9}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-outline mt-0.5 line-clamp-1">📍 {cli.address}</p>
                                    <p className="text-[10px] text-primary mt-1 font-medium truncate">
                                      Attending: {cli.doctors?.join(", ") || "Certified Dermatologists"}
                                    </p>
                                  </div>

                                  <div className="mt-3 pt-2 border-t border-outline-variant/60 flex items-center justify-between text-[10px]">
                                    <span className="text-outline">🕒 {cli.consultationHours || "09:00 AM - 05:00 PM"}</span>
                                    <span className={`font-bold ${isSelected ? "text-primary font-black" : "text-slate-500"}`}>
                                      {isSelected ? "Selected ✓" : "Click to Select"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                          {recipientType === "hospital" &&
                            defaultHospitals.map((hosp) => {
                              const isSelected = selectedProviderId === hosp.id;
                              return (
                                <div
                                  key={hosp.id}
                                  onClick={() => setSelectedProviderId(hosp.id)}
                                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                      ? "bg-[#E8F1F7] border-[#315B7D] ring-2 ring-[#315B7D]/25 shadow-xs"
                                      : "bg-surface border-outline-variant hover:border-[#315B7D]/40 hover:bg-slate-50"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="font-extrabold text-xs text-on-surface truncate">{hosp.name}</h4>
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold shrink-0">
                                        ★ {hosp.rating || 4.9}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-outline mt-0.5 line-clamp-1">📍 {hosp.address}</p>
                                    <p className="text-[10px] text-primary mt-1 font-medium truncate">
                                      Department: Dermatology & Cutaneous Care
                                    </p>
                                  </div>

                                  <div className="mt-3 pt-2 border-t border-outline-variant/60 flex items-center justify-between text-[10px]">
                                    <span className="text-outline">🕒 {hosp.operatingHours ? hosp.operatingHours.slice(0, 30) : "Open Daily"}</span>
                                    <span className={`font-bold ${isSelected ? "text-primary font-black" : "text-slate-500"}`}>
                                      {isSelected ? "Selected ✓" : "Click to Select"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        {/* Selected Provider Info Banner */}
                        {currentSelectedProvider && (
                          <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#315B7D] to-[#44749D] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                                <span className="material-symbols-outlined text-2xl">
                                  {recipientType === "doctor" ? "stethoscope" : recipientType === "clinic" ? "medical_services" : "local_hospital"}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-extrabold text-on-surface text-sm truncate">{currentSelectedProvider.name}</h4>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold shrink-0">
                                    ★ {currentSelectedProvider.rating || 4.9}
                                  </span>
                                </div>
                                <p className="text-xs text-primary font-semibold truncate">
                                  {currentSelectedProvider.specialization || currentSelectedProvider.address || "Dermatology Practice"}
                                </p>
                                <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                                  ✓ Ready to receive your submitted skin case
                                </span>
                              </div>
                            </div>
                            <div className="text-[11px] text-outline text-left sm:text-right shrink-0">
                              <span className="block font-medium">🕒 {currentSelectedProvider.consultationHours || currentSelectedProvider.operatingHours || "09:00 AM - 05:00 PM"}</span>
                              <span className="block text-[10px] text-outline">
                                Working Days: {(currentSelectedProvider.workingDays || ["Mon", "Tue", "Wed", "Thu", "Fri"]).slice(0, 4).join(", ")}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stage 2 Action Navigation */}
                      <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-outline-variant/60">
                        <button
                          type="button"
                          onClick={() => setTreatmentStage(1)}
                          className="w-full sm:w-auto px-5 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-base">arrow_back</span>
                          Back to Image Upload
                        </button>

                        <button
                          type="button"
                          onClick={() => setTreatmentStage(3)}
                          className="w-full flex-1 py-3.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer"
                        >
                          <span>Next: Check Timetable & Block Free Slot (Stage 3)</span>
                          <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- STAGE 3: TIMETABLE & CALENDAR (FREE SLOTS & BLOCK APPOINTMENT) ---------------- */}
                {treatmentStage === 3 && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Provider Scheduling & Interactive Timetable */}
                    <div className="bg-white border border-outline-variant rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono block">
                            Stage 3 of 3 • Timetable & Appointment Booking
                          </span>
                          <h3 className="font-display font-extrabold text-base sm:text-lg text-on-surface flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">calendar_month</span>
                            Provider Timetable: View Free Slots & Block Appointment
                          </h3>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            Check when <strong className="text-on-surface">{currentSelectedProvider?.name || "the provider"}</strong> is free and block your time slot.
                          </p>
                        </div>
                        <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full font-bold self-start sm:self-center flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">hourglass_top</span>
                          Pending Doctor Approval After Booking
                        </span>
                      </div>

                      {/* Selected Provider Quick Summary Banner */}
                      {currentSelectedProvider && (
                        <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                              <span className="material-symbols-outlined text-lg">
                                {recipientType === "doctor" ? "stethoscope" : recipientType === "clinic" ? "medical_services" : "local_hospital"}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-on-surface truncate">{currentSelectedProvider.name}</h4>
                              <p className="text-[11px] text-outline truncate">
                                {currentSelectedProvider.specialization || currentSelectedProvider.address || "Dermatology Facility"} • Hours: {currentSelectedProvider.consultationHours || currentSelectedProvider.operatingHours || "09:00 AM - 05:00 PM"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTreatmentStage(2)}
                            className="text-xs font-bold text-primary hover:underline shrink-0 cursor-pointer"
                          >
                            Change Provider
                          </button>
                        </div>
                      )}

                      {/* 1. Date Selector Ribbon (14 upcoming days) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-on-surface flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-primary text-sm">event</span>
                            1. Select Consultation Date:
                          </label>
                          <span className="text-[11px] text-outline font-medium">
                            14-Day Live Availability Window
                          </span>
                        </div>

                        <div
                          className="flex gap-2 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll pb-2 scrollbar-thin"
                          onWheel={handleHorizontalWheel}
                        >
                          {upcomingProviderDays.map((day) => {
                            const isSelectedDate = consultDate === day.ymd;
                            return (
                              <button
                                key={day.ymd}
                                type="button"
                                onClick={() => setConsultDate(day.ymd)}
                                className={`min-w-[70px] p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between shrink-0 ${
                                  isSelectedDate
                                    ? "bg-[#315B7D] text-white border-[#315B7D] ring-2 ring-[#315B7D]/25 shadow-sm font-bold"
                                    : day.isOnDuty
                                    ? "bg-white border-outline-variant hover:border-[#315B7D]/40 text-on-surface"
                                    : "bg-slate-100/70 border-slate-200 text-slate-400 opacity-60"
                                }`}
                              >
                                <span className={`text-[10px] uppercase font-bold ${isSelectedDate ? "text-white/80" : "text-outline"}`}>
                                  {day.dayShort}
                                </span>
                                <span className="text-sm font-extrabold my-0.5">
                                  {day.dateNumber}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                                  isSelectedDate
                                    ? "bg-white/20 text-white"
                                    : day.isOnDuty
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-200 text-slate-600"
                                }`}>
                                  {day.isOnDuty ? "Open" : "Off"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Daily Timetable Slot Matrix */}
                      <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-on-surface flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-primary text-sm">schedule</span>
                            2. Timetable Slots for {consultDate || "Selected Date"}
                          </span>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Free
                            </span>
                            <span className="flex items-center gap-1 text-rose-700 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-rose-500" /> Booked
                            </span>
                            <span className="flex items-center gap-1 text-[#315B7D] font-semibold">
                              <span className="w-2 h-2 rounded-full bg-[#315B7D]" /> Selected
                            </span>
                          </div>
                        </div>

                        {/* Time Slots Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {providerTimeSlots.map((slot) => {
                            const matchedSlotApp = (appointments || []).find((a) => {
                              const isDateMatch = a.date === consultDate;
                              const isTimeMatch = a.time === slot;
                              const isProvMatch =
                                a.specialistId === currentSelectedProvider?.id ||
                                a.specialistName === currentSelectedProvider?.name ||
                                a.providerName === currentSelectedProvider?.name;
                              const isNotDeclined = a.status !== "Declined";
                              return isDateMatch && isTimeMatch && isProvMatch && isNotDeclined;
                            });
                            const isBooked = !!matchedSlotApp;
                            const isMyBooking = matchedSlotApp && isMyAppointment(matchedSlotApp);
                            const isSelected = consultTime === slot && !isBooked;
                            const selectedDayObj = upcomingProviderDays.find((d) => d.ymd === consultDate);
                            const isOffDuty = selectedDayObj && !selectedDayObj.isOnDuty;

                            if (isOffDuty) {
                              return (
                                <div
                                  key={slot}
                                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 text-center text-xs font-medium cursor-not-allowed"
                                >
                                  <span>{slot}</span>
                                  <span className="block text-[9px] text-slate-400 mt-0.5">Off Duty</span>
                                </div>
                              );
                            }

                            if (isBooked) {
                              if (isMyBooking) {
                                return (
                                  <div
                                    key={slot}
                                    title="You have already booked this slot."
                                    className="p-2.5 rounded-xl border-2 border-blue-400 bg-blue-50/80 text-blue-900 text-center text-xs font-bold"
                                  >
                                    <span>{slot}</span>
                                    <span className="block text-[9px] text-blue-700 font-extrabold mt-0.5">
                                      {matchedSlotApp.status === "Accepted" || matchedSlotApp.status === "Approved" ? "Your Booking ✓" : "Your Request (Pending)"}
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={slot}
                                  title={`Specialist ${currentSelectedProvider?.name} is already booked for ${slot} on ${consultDate}. Please choose another open slot.`}
                                  className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-center text-xs font-semibold cursor-not-allowed opacity-90 shadow-2xs"
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="material-symbols-outlined text-[13px] text-rose-500">lock</span>
                                    <span className="line-through">{slot}</span>
                                  </div>
                                  <span className="block text-[9px] text-rose-700 font-black mt-0.5">Specialist Booked</span>
                                </div>
                              );
                            }

                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setConsultHours(slot)}
                                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer relative ${
                                  isSelected
                                    ? "bg-[#315B7D] text-white border-[#315B7D] shadow-sm font-extrabold ring-2 ring-[#315B7D]/20 scale-102"
                                    : "bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 hover:border-emerald-500 font-bold"
                                }`}
                              >
                                <span className="text-xs font-bold">{slot}</span>
                                <span className={`block text-[9px] mt-0.5 ${isSelected ? "text-white/90" : "text-emerald-700 font-semibold"}`}>
                                  {isSelected ? "Blocked ✓" : "Free Slot"}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Selected Slot Feedback Banner */}
                        <div className="p-3 bg-white rounded-xl border border-primary/30 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            <span>
                              <strong>Blocked Slot:</strong> {consultDate} at {consultTime} with {currentSelectedProvider?.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded">
                            Ready to Submit
                          </span>
                        </div>
                      </div>

                      {/* 3. Consultation Mode Selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-outline-variant/60">
                        <div>
                          <label className="block text-xs font-bold text-on-surface mb-1">3. Consultation Mode:</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setConsultType("Online")}
                              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                                consultType === "Online"
                                  ? "bg-[#315B7D] text-white border-[#315B7D] shadow-xs"
                                  : "bg-white border-outline-variant text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              🌐 Online Video Call
                            </button>
                            <button
                              type="button"
                              onClick={() => setConsultType("Physical")}
                              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                                consultType === "Physical"
                                  ? "bg-[#315B7D] text-white border-[#315B7D] shadow-xs"
                                  : "bg-white border-outline-variant text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              🏥 In-Person Visit
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-on-surface mb-1">Contact Phone for Reminders:</label>
                          <input
                            type="text"
                            defaultValue={user.phone || "+256 701 983247"}
                            placeholder="+256..."
                            className="w-full p-2.5 bg-white border border-outline-variant focus:border-primary rounded-xl text-xs"
                          />
                        </div>
                      </div>

                      {/* 4. Case Summary & Waiting for Doctor Approval Notice */}
                      <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2 text-xs text-amber-900">
                        <div className="flex items-center gap-2 font-bold text-amber-950">
                          <span className="material-symbols-outlined text-amber-600 text-lg">hourglass_top</span>
                          <span>What happens after submitting?</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Your chosen time slot on the timetable will be <strong>blocked</strong>, and your lesion image and clinical symptoms will be submitted to <strong>{currentSelectedProvider?.name}</strong>. The doctor will review your appointment request and approve it. You can monitor the approval status anytime in your <strong>"My Appointments & Calendar"</strong> tab.
                        </p>
                        {uploadedMedia && (
                          <div className="flex items-center gap-2.5 pt-1">
                            <img
                              src={uploadedMedia}
                              alt="Attached skin photo"
                              className="w-10 h-10 rounded-lg object-cover border border-amber-300 shrink-0"
                            />
                            <span className="text-[10px] text-amber-800 italic truncate">
                              Attached Photo: {mediaFileName || "Clinical Lesion Photo"} ({symptomsText.slice(0, 50) || "Symptoms described"}...)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Stage 3 Submission Buttons */}
                      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setTreatmentStage(2)}
                          className="w-full sm:w-auto px-5 py-3.5 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-base">arrow_back</span>
                          Back to Provider Selection
                        </button>

                        <button
                          type="submit"
                          className="w-full flex-1 py-3.5 bg-primary hover:bg-primary-container text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base font-bold">event_available</span>
                          Submit Case & Block Appointment with {currentSelectedProvider?.name || "Provider"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column (List of Recommended Doctors & Clinics with local instant search indexing) */}
              <div className="lg:col-span-4 space-y-6">
                <div id="clinics_section_anchor" className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-sm text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-xl">travel_explore</span>
                      Find Doctors & Clinics
                    </h3>
                  </div>

                  {/* Toggle between Doctors, Clinics, and Hospitals */}
                  <div
                    className="flex rounded-xl bg-surface-container-high p-1 text-xs font-bold gap-1 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll scrollbar-none"
                    onWheel={handleHorizontalWheel}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSearchDirectoryTab("doctors");
                        setRecipientType("doctor");
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                        searchDirectoryTab === "doctors" ? "bg-white text-primary shadow-xs" : "text-outline hover:text-on-surface"
                      }`}
                    >
                      Doctors ({filteredDoctors.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchDirectoryTab("clinics");
                        setRecipientType("clinic");
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                        searchDirectoryTab === "clinics" ? "bg-white text-primary shadow-xs" : "text-outline hover:text-on-surface"
                      }`}
                    >
                      Clinics ({filteredClinics.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchDirectoryTab("hospitals");
                        setRecipientType("hospital");
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                        searchDirectoryTab === "hospitals" ? "bg-white text-primary shadow-xs" : "text-outline hover:text-on-surface"
                      }`}
                    >
                      Hospitals ({filteredHospitals.length})
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
                    <input
                      type="text"
                      placeholder={
                        searchDirectoryTab === "doctors"
                          ? "Search doctor by name, specialty..."
                          : searchDirectoryTab === "clinics"
                          ? "Search clinic, address, services..."
                          : "Search hospital name, department, location..."
                      }
                      value={clinicSearchQuery}
                      onChange={(e) => setClinicSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-surface-container rounded-lg text-xs outline-none focus:border-primary"
                    />
                  </div>

                  {/* List Results */}
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {searchDirectoryTab === "doctors" && (
                      <>
                        {filteredDoctors.map((doc) => (
                          <div
                            key={doc.id}
                            onClick={() => {
                              setRecipientType("doctor");
                              setSelectedProviderId(doc.id);
                              setSelectedDoctorProfile(doc);
                              setSelectedSpecForConsult(doc.id);
                            }}
                            className={`p-3 border rounded-xl transition-all cursor-pointer bg-surface flex items-center justify-between gap-3 group ${
                              recipientType === "doctor" && selectedProviderId === doc.id
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "border-outline-variant hover:border-primary hover:bg-[#f0f3ff]"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/40 shadow-xs shrink-0 bg-primary/10 relative group-hover:scale-105 transition-transform">
                                <img
                                  src={getDoctorAvatar(doc)}
                                  alt={doc.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover object-center"
                                  onError={(e) => {
                                    e.target.src = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80";
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-on-surface truncate group-hover:text-primary">{doc.name}</span>
                                  <span className="text-[10px] bg-secondary-container text-secondary px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                                    ★ {doc.rating || 4.9}
                                  </span>
                                </div>
                                <p className="text-[11px] text-primary font-medium truncate">{doc.specialization}</p>
                                <p className="text-[10px] text-on-surface-variant truncate">{doc.clinicName || doc.hospitalName}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRecipientType("doctor");
                                setSelectedProviderId(doc.id);
                                setSelectedDoctorProfile(doc);
                                setSelectedSpecForConsult(doc.id);
                              }}
                              className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg shrink-0 transition-colors cursor-pointer ${
                                recipientType === "doctor" && selectedProviderId === doc.id
                                  ? "bg-primary text-white"
                                  : "bg-primary/10 hover:bg-primary hover:text-white text-primary"
                              }`}
                            >
                              {recipientType === "doctor" && selectedProviderId === doc.id ? "Selected ✓" : "Select"}
                            </button>
                          </div>
                        ))}

                        {filteredDoctors.length === 0 && <p className="text-xs text-outline italic text-center py-4">No specialists match search criteria.</p>}
                      </>
                    )}

                    {searchDirectoryTab === "clinics" && (
                      <>
                        {filteredClinics.map((cli) => (
                          <div
                            key={cli.id}
                            onClick={() => {
                              setRecipientType("clinic");
                              setSelectedProviderId(cli.id);
                              setSelectedEntity(cli);
                            }}
                            className={`p-3 border rounded-xl transition-all cursor-pointer bg-surface ${
                              recipientType === "clinic" && selectedProviderId === cli.id
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "border-outline-variant hover:border-primary hover:bg-[#f0f3ff]"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-on-surface truncate">{cli.name}</span>
                              <span className="text-[10px] bg-secondary-container text-secondary px-1.5 py-0.5 rounded font-mono font-bold">{cli.rating} ★</span>
                            </div>
                            <p className="text-[10px] text-on-surface-variant truncate">{cli.address}</p>
                            <p className="text-[10px] text-primary font-medium mt-1">🕒 {cli.consultationHours || "09:00 AM - 05:00 PM"}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {cli.services.slice(0, 2).map((srv) => (
                                <span key={srv} className="text-[9px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded">
                                  {srv}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}

                        {filteredClinics.length === 0 && <p className="text-xs text-outline italic text-center py-4">No clinics match search criteria.</p>}
                      </>
                    )}

                    {searchDirectoryTab === "hospitals" && (
                      <>
                        {filteredHospitals.map((hosp) => (
                          <div
                            key={hosp.id}
                            onClick={() => {
                              setRecipientType("hospital");
                              setSelectedProviderId(hosp.id);
                              setSelectedEntity(hosp);
                            }}
                            className={`p-3 border rounded-xl transition-all cursor-pointer bg-surface ${
                              recipientType === "hospital" && selectedProviderId === hosp.id
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "border-outline-variant hover:border-primary hover:bg-[#f0f3ff]"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-on-surface truncate">{hosp.name}</span>
                              <span className="text-[10px] bg-secondary-container text-secondary px-1.5 py-0.5 rounded font-mono font-bold">{hosp.rating} ★</span>
                            </div>
                            <p className="text-[10px] text-on-surface-variant truncate">{hosp.address}</p>
                            <p className="text-[10px] text-primary font-medium mt-1">🕒 {hosp.operatingHours}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {hosp.services.slice(0, 2).map((srv) => (
                                <span key={srv} className="text-[9px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded">
                                  {srv}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}

                        {filteredHospitals.length === 0 && <p className="text-xs text-outline italic text-center py-4">No hospitals match search criteria.</p>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>}

        {
    /* ===================== TAB 3: LIBRARY & EDUCATION ===================== */
  }
        {activeTab === "library" && (
          <div id="patient_library" className="space-y-8 animate-fade-in pb-12">
            {/* Header & Search with frosted glass appearance and medical background image */}
            <div className="relative overflow-hidden rounded-3xl border border-white/40 shadow-xl bg-cover bg-center p-6 sm:p-8 space-y-6"
                 style={{ backgroundImage: `url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=80')` }}>
              {/* Glassmorphism frosted overlay */}
              <div className="absolute inset-0 bg-white/80 backdrop-blur-xl -z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/70 via-white/85 to-slate-50/70 -z-10" />
              <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-300/25 rounded-full blur-3xl pointer-events-none -z-10" />
              <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-purple-300/20 rounded-full blur-3xl pointer-events-none -z-10" />

              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50/90 backdrop-blur-md border border-blue-200/70 text-[#315B7D] text-xs font-bold uppercase tracking-wider shadow-xs">
                    <span className="material-symbols-outlined text-sm">local_library</span>
                    Multilingual Education Center
                  </div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1e2d3d] tracking-tight">
                    Clinical Dermatology Knowledge Library
                  </h2>
                  <p className="text-sm text-slate-700 max-w-2xl leading-relaxed font-medium">
                    Verified skincare resources organized by media type. Explore peer-reviewed clinical articles, listen to voice advisories by certified dermatologists, or watch procedure video guides in 4 regional languages.
                  </p>
                </div>

                {/* Instant Search Bar with glass styling */}
                <div className="relative w-full lg:w-88 shrink-0">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search articles, podcasts, videos..."
                    value={librarySearchQuery}
                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    className="w-full pl-11 pr-10 py-3 bg-white/85 backdrop-blur-md border border-white/60 shadow-inner rounded-2xl text-xs sm:text-sm font-medium outline-none focus:border-[#315B7D] focus:bg-white focus:ring-2 focus:ring-[#315B7D]/25 transition-all text-slate-900 placeholder:text-slate-400"
                  />
                  {librarySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLibrarySearchQuery("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 text-sm p-1 rounded-full hover:bg-slate-200/60 transition"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Segmented Section Filter Selections */}
              <div className="relative pt-4 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3">
                <div
                  className="flex items-center gap-2 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll pb-1 scrollbar-none max-w-full"
                  onWheel={handleHorizontalWheel}
                >
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mr-1 hidden sm:inline shrink-0">
                    Browse Format:
                  </span>
                  
                  {/* All Resources Tab */}
                  <button
                    type="button"
                    onClick={() => setLibraryMediaType("all")}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer backdrop-blur-md ${
                      libraryMediaType === "all"
                        ? "bg-[#315B7D] text-white shadow-md ring-2 ring-[#315B7D]/30"
                        : "bg-white/80 text-slate-700 border border-white/70 hover:bg-white/95 hover:text-slate-950 shadow-xs"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">dashboard_customize</span>
                    <span>All Media</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      libraryMediaType === "all" ? "bg-white/25 text-white" : "bg-slate-200/80 text-slate-800"
                    }`}>
                      {filteredLibrary.length}
                    </span>
                  </button>

                  {/* Articles Tab */}
                  <button
                    type="button"
                    onClick={() => setLibraryMediaType("article")}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer backdrop-blur-md ${
                      libraryMediaType === "article"
                        ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-600/30"
                        : "bg-blue-50/80 text-blue-900 border border-blue-200/60 hover:bg-blue-100/80 shadow-xs"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">menu_book</span>
                    <span>Written Articles</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      libraryMediaType === "article" ? "bg-white/25 text-white" : "bg-blue-200/70 text-blue-900"
                    }`}>
                      {articleItems.length}
                    </span>
                  </button>

                  {/* Audio Tab */}
                  <button
                    type="button"
                    onClick={() => setLibraryMediaType("audio")}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer backdrop-blur-md ${
                      libraryMediaType === "audio"
                        ? "bg-purple-600 text-white shadow-md ring-2 ring-purple-600/30"
                        : "bg-purple-50/80 text-purple-900 border border-purple-200/60 hover:bg-purple-100/80 shadow-xs"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">headphones</span>
                    <span>Voice Advisories</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      libraryMediaType === "audio" ? "bg-white/25 text-white" : "bg-purple-200/70 text-purple-900"
                    }`}>
                      {audioItems.length}
                    </span>
                  </button>

                  {/* Video Tab */}
                  <button
                    type="button"
                    onClick={() => setLibraryMediaType("video")}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer backdrop-blur-md ${
                      libraryMediaType === "video"
                        ? "bg-rose-600 text-white shadow-md ring-2 ring-rose-600/30"
                        : "bg-rose-50/80 text-rose-900 border border-rose-200/60 hover:bg-rose-100/80 shadow-xs"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">smart_display</span>
                    <span>Video Demonstrations</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      libraryMediaType === "video" ? "bg-white/25 text-white" : "bg-rose-200/70 text-rose-900"
                    }`}>
                      {videoItems.length}
                    </span>
                  </button>
                </div>

                <div className="text-[11px] font-semibold text-slate-700 bg-white/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/60 shadow-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Available in English, Luganda, Swahili, French</span>
                </div>
              </div>
            </div>

            {/* SECTION 1: WRITTEN CLINICAL ARTICLES */}
            {(libraryMediaType === "all" || libraryMediaType === "article") && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-xl">article</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-extrabold text-lg text-slate-900">
                          Clinical Articles & Care Protocols
                        </h3>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                          {articleItems.length} {articleItems.length === 1 ? "Article" : "Articles"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        In-depth medical literature with attached photographic galleries and treatment protocols.
                      </p>
                    </div>
                  </div>

                  {libraryMediaType === "all" && articleItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLibraryMediaType("article")}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
                    >
                      View all articles
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  )}
                </div>

                {articleItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {articleItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setPatientViewItem(item);
                          setPatientViewLang(currentLanguage);
                        }}
                        className="bg-white border border-slate-200/90 hover:border-blue-500/60 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-pointer hover:-translate-y-1"
                      >
                        <div>
                          {/* Image Cover */}
                          <div className="relative h-48 bg-slate-100 overflow-hidden">
                            <img
                              src={item.coverImage || item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                            
                            {/* Format Pill */}
                            <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-blue-600/90 text-white backdrop-blur-md px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-xs">article</span>
                              Written Article
                            </span>

                            {/* Photos Badge */}
                            {item.photos && item.photos.length > 0 && (
                              <span className="absolute top-3 right-3 text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-md px-2 py-0.8 rounded-md flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">photo_camera</span>
                                {item.photos.length} Photos
                              </span>
                            )}

                            <span className="absolute bottom-3 left-3 text-[10px] font-semibold text-slate-200 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs text-blue-300">schedule</span>
                              4 min read
                            </span>
                          </div>

                          {/* Body */}
                          <div className="p-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                {item.category}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {item.createdAt}
                              </span>
                            </div>

                            <h4 className="text-base font-extrabold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug">
                              {item.titleTranslations?.[currentLanguage] || item.title}
                            </h4>

                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                              {item.summaryTranslations?.[currentLanguage] || item.description}
                            </p>
                          </div>
                        </div>

                        {/* Social Interaction Bar (Reactions, Likes, Comments Count) */}
                        <div className="px-5 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Like Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLike(item.id);
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                (item.userLikes || []).includes(user?.id)
                                  ? "bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs"
                                  : "bg-white text-slate-600 hover:text-rose-600 hover:bg-rose-50/50 border border-slate-200"
                              }`}
                              title="Like resource"
                            >
                              <span className="text-sm">{(item.userLikes || []).includes(user?.id) ? "❤️" : "🤍"}</span>
                              <span>{item.likes || 0}</span>
                            </button>

                            {/* Quick Emoji Reaction Pill Buttons */}
                            {["❤️", "💡", "👏", "🙏", "✨"].map((emoji) => {
                              const count = item.reactions?.[emoji] || 0;
                              const isReacted = item.userReactions?.[user?.id] === emoji;
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleReaction(item.id, emoji);
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                                    isReacted
                                      ? "bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs ring-1 ring-blue-300"
                                      : count > 0
                                      ? "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                                      : "hidden sm:inline-flex bg-white/70 text-slate-400 hover:text-slate-800 hover:bg-slate-100 border border-slate-100"
                                  }`}
                                  title={`React with ${emoji}`}
                                >
                                  <span>{emoji}</span>
                                  {count > 0 && <span className="text-[10px] font-bold">{count}</span>}
                                </button>
                              );
                            })}
                          </div>

                          {/* Comments count indicator */}
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium shrink-0">
                            <span className="material-symbols-outlined text-sm text-slate-400">forum</span>
                            <span>{(item.comments || []).length}</span>
                          </div>
                        </div>

                        {/* Footer Action */}
                        <div className="px-5 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-slate-400">verified</span>
                            By {item.author || "Specialist"}
                          </span>
                          <span className="font-bold text-blue-600 group-hover:text-blue-800 flex items-center gap-1">
                            Read & Discuss
                            <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">
                              arrow_forward
                            </span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-500">No written articles match your search filter.</p>
                  </div>
                )}
              </section>
            )}

            {/* SECTION 2: AUDIO & SPECIALIST VOICE ADVISORIES */}
            {(libraryMediaType === "all" || libraryMediaType === "audio") && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-xl">podcasts</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-extrabold text-lg text-slate-900">
                          Specialist Voice Advisories & Audio Podcasts
                        </h3>
                        <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                          {audioItems.length} {audioItems.length === 1 ? "Audio Guide" : "Audio Guides"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Spoken dermatological counsel recorded by accredited doctors with full multilingual voice transcripts.
                      </p>
                    </div>
                  </div>

                  {libraryMediaType === "all" && audioItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLibraryMediaType("audio")}
                      className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 transition"
                    >
                      View all audio
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  )}
                </div>

                {audioItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {audioItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setPatientViewItem(item);
                          setPatientViewLang(currentLanguage);
                        }}
                        className="bg-white border border-slate-200/90 hover:border-purple-500/60 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-pointer hover:-translate-y-1"
                      >
                        <div>
                          {/* Image Cover with Audio Waveform Accent */}
                          <div className="relative h-48 bg-slate-900 overflow-hidden">
                            <img
                              src={item.coverImage || item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-purple-950/90 via-purple-950/30 to-transparent" />
                            
                            {/* Format Pill */}
                            <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-purple-600 text-white backdrop-blur-md px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-xs">headphones</span>
                              Voice Advisory
                            </span>

                            {/* Duration Badge */}
                            {item.duration && (
                              <span className="absolute top-3 right-3 text-[10px] font-bold bg-black/75 text-white backdrop-blur-md px-2 py-0.8 rounded-md flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs text-purple-300">timer</span>
                                {item.duration}
                              </span>
                            )}

                            {/* Audio Visualizer Wave Graphic on Card */}
                            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-1 h-6">
                              {[35, 60, 45, 80, 50, 95, 70, 40, 85, 55, 75, 45, 90, 60, 40].map((h, idx) => (
                                <div
                                  key={idx}
                                  className="w-1 bg-purple-300/80 rounded-full group-hover:bg-purple-200 transition-all duration-300 group-hover:scale-y-110"
                                  style={{ height: `${h}%` }}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Body */}
                          <div className="p-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                {item.category}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {item.createdAt}
                              </span>
                            </div>

                            <h4 className="text-base font-extrabold text-slate-900 line-clamp-2 group-hover:text-purple-600 transition-colors leading-snug">
                              {item.titleTranslations?.[currentLanguage] || item.title}
                            </h4>

                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                              {item.summaryTranslations?.[currentLanguage] || item.description}
                            </p>
                          </div>
                        </div>

                        {/* Social Interaction Bar (Reactions, Likes, Comments Count) */}
                        <div className="px-5 py-2.5 bg-purple-50/30 border-t border-purple-100/50 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Like Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLike(item.id);
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                (item.userLikes || []).includes(user?.id)
                                  ? "bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs"
                                  : "bg-white text-slate-600 hover:text-rose-600 hover:bg-rose-50/50 border border-slate-200"
                              }`}
                              title="Like resource"
                            >
                              <span className="text-sm">{(item.userLikes || []).includes(user?.id) ? "❤️" : "🤍"}</span>
                              <span>{item.likes || 0}</span>
                            </button>

                            {/* Quick Emoji Reaction Pill Buttons */}
                            {["❤️", "💡", "👏", "🙏", "✨"].map((emoji) => {
                              const count = item.reactions?.[emoji] || 0;
                              const isReacted = item.userReactions?.[user?.id] === emoji;
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleReaction(item.id, emoji);
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                                    isReacted
                                      ? "bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs ring-1 ring-purple-300"
                                      : count > 0
                                      ? "bg-white text-slate-700 hover:bg-purple-50 border border-purple-200/60"
                                      : "hidden sm:inline-flex bg-white/70 text-slate-400 hover:text-slate-800 hover:bg-slate-100 border border-slate-100"
                                  }`}
                                  title={`React with ${emoji}`}
                                >
                                  <span>{emoji}</span>
                                  {count > 0 && <span className="text-[10px] font-bold">{count}</span>}
                                </button>
                              );
                            })}
                          </div>

                          {/* Comments count indicator */}
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium shrink-0">
                            <span className="material-symbols-outlined text-sm text-purple-400">forum</span>
                            <span>{(item.comments || []).length}</span>
                          </div>
                        </div>

                        {/* Footer Action */}
                        <div className="px-5 py-3.5 bg-purple-50/60 border-t border-purple-100/60 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-purple-600">mic</span>
                            Voice: {item.author || "Specialist"}
                          </span>
                          <span className="font-bold text-purple-600 group-hover:text-purple-800 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base">play_circle</span>
                            Listen & React
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-500">No voice advisories match your search filter.</p>
                  </div>
                )}
              </section>
            )}

            {/* SECTION 3: VIDEO DEMONSTRATIONS & PROCEDURES */}
            {(libraryMediaType === "all" || libraryMediaType === "video") && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-xl">smart_display</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-extrabold text-lg text-slate-900">
                          Video Demonstrations & Clinical Protocols
                        </h3>
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                          {videoItems.length} {videoItems.length === 1 ? "Video" : "Videos"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Step-by-step visual procedures showing self-examination rules, biopsy workflows, and safe topical steroid administration.
                      </p>
                    </div>
                  </div>

                  {libraryMediaType === "all" && videoItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLibraryMediaType("video")}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition"
                    >
                      View all videos
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  )}
                </div>

                {videoItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videoItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setPatientViewItem(item);
                          setPatientViewLang(currentLanguage);
                        }}
                        className="bg-white border border-slate-200/90 hover:border-rose-500/60 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-pointer hover:-translate-y-1"
                      >
                        <div>
                          {/* Video Thumbnail with Centered Play Action */}
                          <div className="relative h-48 bg-slate-950 overflow-hidden">
                            <img
                              src={item.coverImage || item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/20 to-transparent" />
                            
                            {/* Format Pill */}
                            <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white backdrop-blur-md px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-xs">play_arrow</span>
                              Video Guide
                            </span>

                            {/* Duration Badge */}
                            {item.duration && (
                              <span className="absolute top-3 right-3 text-[10px] font-bold bg-black/80 text-white backdrop-blur-md px-2 py-0.8 rounded-md flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs text-rose-400">timer</span>
                                {item.duration}
                              </span>
                            )}

                            {/* Centered Glowing Play Button */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-13 h-13 rounded-full bg-rose-600/90 group-hover:bg-rose-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 ring-4 ring-white/30">
                                <span className="material-symbols-outlined text-3xl ml-0.5">play_arrow</span>
                              </div>
                            </div>

                            <span className="absolute bottom-3 left-3 text-[10px] font-bold text-slate-200 bg-black/50 px-2 py-0.5 rounded backdrop-blur-xs">
                              HD Clinical Procedure
                            </span>
                          </div>

                          {/* Body */}
                          <div className="p-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                {item.category}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {item.createdAt}
                              </span>
                            </div>

                            <h4 className="text-base font-extrabold text-slate-900 line-clamp-2 group-hover:text-rose-600 transition-colors leading-snug">
                              {item.titleTranslations?.[currentLanguage] || item.title}
                            </h4>

                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                              {item.summaryTranslations?.[currentLanguage] || item.description}
                            </p>
                          </div>
                        </div>

                        {/* Social Interaction Bar (Reactions, Likes, Comments Count) */}
                        <div className="px-5 py-2.5 bg-rose-50/30 border-t border-rose-100/50 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Like Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLike(item.id);
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                (item.userLikes || []).includes(user?.id)
                                  ? "bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs"
                                  : "bg-white text-slate-600 hover:text-rose-600 hover:bg-rose-50/50 border border-slate-200"
                              }`}
                              title="Like resource"
                            >
                              <span className="text-sm">{(item.userLikes || []).includes(user?.id) ? "❤️" : "🤍"}</span>
                              <span>{item.likes || 0}</span>
                            </button>

                            {/* Quick Emoji Reaction Pill Buttons */}
                            {["❤️", "💡", "👏", "🙏", "✨"].map((emoji) => {
                              const count = item.reactions?.[emoji] || 0;
                              const isReacted = item.userReactions?.[user?.id] === emoji;
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleReaction(item.id, emoji);
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                                    isReacted
                                      ? "bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs ring-1 ring-rose-300"
                                      : count > 0
                                      ? "bg-white text-slate-700 hover:bg-rose-50 border border-rose-200/60"
                                      : "hidden sm:inline-flex bg-white/70 text-slate-400 hover:text-slate-800 hover:bg-slate-100 border border-slate-100"
                                  }`}
                                  title={`React with ${emoji}`}
                                >
                                  <span>{emoji}</span>
                                  {count > 0 && <span className="text-[10px] font-bold">{count}</span>}
                                </button>
                              );
                            })}
                          </div>

                          {/* Comments count indicator */}
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium shrink-0">
                            <span className="material-symbols-outlined text-sm text-rose-400">forum</span>
                            <span>{(item.comments || []).length}</span>
                          </div>
                        </div>

                        {/* Footer Action */}
                        <div className="px-5 py-3.5 bg-rose-50/60 border-t border-rose-100/60 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-rose-600">videocam</span>
                            Dem: {item.author || "Specialist"}
                          </span>
                          <span className="font-bold text-rose-600 group-hover:text-rose-800 flex items-center gap-1">
                            Watch & Discuss
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-500">No video demonstrations match your search filter.</p>
                  </div>
                )}
              </section>
            )}

            {filteredLibrary.length === 0 && (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
                <span className="material-symbols-outlined text-5xl text-slate-300">search_off</span>
                <h4 className="text-base font-bold text-slate-800">No Educational Resources Found</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  We could not find any articles, voice advisories, or video guides matching &ldquo;{librarySearchQuery}&rdquo;. Try another search term or clear the filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLibrarySearchQuery("");
                    setLibraryMediaType("all");
                  }}
                  className="px-4 py-2 bg-[#315B7D] text-white text-xs font-bold rounded-xl hover:bg-[#24465F] transition"
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {/* PATIENT INTERACTIVE READER MODAL */}
            {patientViewItem && <div className="fixed inset-0 z-50 glass-overlay-backdrop flex items-center justify-center p-4">
                <div className="glass-modal rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl animate-scale-up">
                  {
    /* Modal Header */
  }
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg uppercase">
                          {patientViewItem.category}
                        </span>
                        <span className="text-xs text-slate-400">By {patientViewItem.author}</span>
                      </div>
                      <h2 className="font-display font-extrabold text-lg md:text-xl text-slate-900">
                        {patientViewItem.titleTranslations?.[patientViewLang] || patientViewItem.title}
                      </h2>
                    </div>

                    <button
    onClick={() => setPatientViewItem(null)}
    className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-bold"
  >
                      ✕
                    </button>
                  </div>

                  {
    /* Active Language Bar Switcher */
  }
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 ml-2">🌐 Switch Language:</span>
                    <div className="flex items-center gap-1">
                      {[
    { code: "en", flag: "\u{1F1FA}\u{1F1F8}", name: "English" },
    { code: "lg", flag: "\u{1F1FA}\u{1F1EC}", name: "Luganda" },
    { code: "sw", flag: "\u{1F1F9}\u{1F1FF}", name: "Swahili" },
    { code: "fr", flag: "\u{1F1EB}\u{1F1F7}", name: "Fran\xE7ais" }
  ].map((lang) => <button
    key={lang.code}
    onClick={() => setPatientViewLang(lang.code)}
    className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 ${patientViewLang === lang.code ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
  >
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </button>)}
                    </div>
                  </div>

                  {
    /* MEDIA DISPLAY (Article Gallery / Audio Player / Video Player) */
  }
                  {patientViewItem.type === "article" && patientViewItem.photos && patientViewItem.photos.length > 0 && <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <span>📷</span> Attached Clinical Photos ({patientViewItem.photos.length})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {patientViewItem.photos.map((imgUrl, i) => <div key={i} className="rounded-2xl overflow-hidden border border-slate-200 h-32 bg-slate-100">
                            <img src={imgUrl} alt={`Clinical photo ${i + 1}`} className="w-full h-full object-cover" />
                          </div>)}
                      </div>
                    </div>}

                  {patientViewItem.type === "audio" && <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl space-y-4 shadow-inner">
                      <div className="flex items-center gap-4">
                        <img
    src={patientViewItem.coverImage || patientViewItem.thumbnail}
    alt="Cover Art"
    className="w-16 h-16 rounded-xl object-cover border border-white/20 shadow-md"
  />
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">
                            🎙️ Voice Advisory ({patientViewItem.audioTracks?.length || 1} Track{patientViewItem.audioTracks && patientViewItem.audioTracks.length > 1 ? "s" : ""})
                          </span>
                          <h4 className="font-bold text-sm line-clamp-1">{patientViewItem.title}</h4>
                          <span className="text-xs text-slate-300">Total Duration: {patientViewItem.duration || "03:45"}</span>
                        </div>
                      </div>

                      {
    /* Audio Tracks Players List */
  }
                      {patientViewItem.audioTracks && patientViewItem.audioTracks.length > 0 ? <div className="space-y-2.5 pt-2 border-t border-white/10">
                          {patientViewItem.audioTracks.map((track, tIdx) => <div key={track.id || tIdx} className="bg-white/10 p-3 rounded-xl space-y-2 backdrop-blur-md">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-md bg-indigo-500 text-white text-[10px] flex items-center justify-center font-black">
                                    {tIdx + 1}
                                  </span>
                                  <span>{track.name}</span>
                                </span>
                                <span className="text-[10px] font-mono text-indigo-300 font-bold">
                                  ⏱️ {track.duration || "02:00"}
                                </span>
                              </div>
                              <audio controls src={track.url} className="w-full h-8" />
                            </div>)}
                        </div> : <div className="bg-white/10 p-3 rounded-xl backdrop-blur-md">
                          <audio controls src={patientViewItem.url} className="w-full h-8" />
                        </div>}
                    </div>}

                  {patientViewItem.type === "video" && <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black aspect-video relative group">
                      {patientViewItem.url && (patientViewItem.url.includes("youtube.com") || patientViewItem.url.includes("youtu.be")) ? <iframe
    src={patientViewItem.url.includes("youtube.com/watch?v=") ? `https://www.youtube.com/embed/${patientViewItem.url.split("v=")[1]?.split("&")[0]}` : patientViewItem.url.includes("youtu.be/") ? `https://www.youtube.com/embed/${patientViewItem.url.split("youtu.be/")[1]?.split("?")[0]}` : patientViewItem.url}
    title="YouTube Video Advisory"
    className="w-full h-full border-0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
  /> : <video
    controls
    poster={patientViewItem.coverImage || patientViewItem.thumbnail}
    src={patientViewItem.url || "https://www.w3schools.com/html/mov_bbb.mp4"}
    className="w-full h-full object-cover"
  />}
                    </div>}

                  {
    /* Accompanying Text & Voice Transcript Section in selected language */
  }
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📄</span> {patientViewItem.type === "audio" ? "Voice Transcript" : patientViewItem.type === "video" ? "Video Article & Transcript" : "Full Article Body"} ({patientViewLang.toUpperCase()})
                    </h3>

                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {patientViewItem.fullTextTranslations?.[patientViewLang] || patientViewItem.fullText || patientViewItem.summaryTranslations?.[patientViewLang] || patientViewItem.description}
                    </p>
                  </div>

                  {/* ================= SOCIAL ENGAGEMENT & REACTIONS PANEL ================= */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-display font-black text-sm text-slate-900 flex items-center gap-2">
                          <span className="text-lg">💬</span>
                          <span>Community Reactions & Patient Feedback</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          React to this clinical publication with emojis, express gratitude, or discuss treatments with fellow patients and doctors.
                        </p>
                      </div>

                      {/* Primary Like Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleLike(patientViewItem.id)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                          (patientViewItem.userLikes || []).includes(user?.id)
                            ? "bg-rose-500 text-white ring-2 ring-rose-300"
                            : "bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600 border border-slate-200"
                        }`}
                      >
                        <span className="text-base">{(patientViewItem.userLikes || []).includes(user?.id) ? "❤️" : "🤍"}</span>
                        <span>{(patientViewItem.userLikes || []).includes(user?.id) ? "Liked Post" : "Like"}</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-black/10 text-[11px]">
                          {patientViewItem.likes || 0}
                        </span>
                      </button>
                    </div>

                    {/* Emoji Reaction Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base text-amber-500">add_reaction</span>
                          <span>React with Emojis:</span>
                        </span>
                        <span className="text-[11px] font-normal text-slate-400">
                          {patientViewItem.userReactions?.[user?.id]
                            ? `You reacted with ${patientViewItem.userReactions[user?.id]}`
                            : "Tap an emoji to react"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { emoji: "❤️", label: "Helpful Care" },
                          { emoji: "💡", label: "Informative" },
                          { emoji: "👏", label: "Applaud Doctor" },
                          { emoji: "🙏", label: "Grateful" },
                          { emoji: "✨", label: "Life Changing" },
                          { emoji: "🌿", label: "Natural Relief" },
                          { emoji: "🔥", label: "Top Advisory" }
                        ].map(({ emoji, label }) => {
                          const count = patientViewItem.reactions?.[emoji] || 0;
                          const isSelected = patientViewItem.userReactions?.[user?.id] === emoji;
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(patientViewItem.id, emoji)}
                              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                                isSelected
                                  ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400 scale-105"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:scale-105 border border-slate-200/80"
                              }`}
                              title={label}
                            >
                              <span className="text-base group-hover:scale-125 transition-transform">{emoji}</span>
                              <span className={isSelected ? "text-white" : "text-slate-600"}>{count}</span>
                              <span className={`text-[10px] font-normal hidden md:inline opacity-80 ${isSelected ? "text-white" : "text-slate-500"}`}>
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ================= COMMENTS & COMMUNITY THREAD ================= */}
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                            Patient & Specialist Discussion ({ (patientViewItem.comments || []).length })
                          </span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>

                        {/* Filter by Patient vs Specialist Comments */}
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => setCommentFilter("all")}
                            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${commentFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"}`}
                          >
                            All ({ (patientViewItem.comments || []).length })
                          </button>
                          <button
                            type="button"
                            onClick={() => setCommentFilter("specialist")}
                            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${commentFilter === "specialist" ? "bg-white text-blue-700 shadow-2xs" : "text-slate-500"}`}
                          >
                            Doctors
                          </button>
                          <button
                            type="button"
                            onClick={() => setCommentFilter("patient")}
                            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${commentFilter === "patient" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-500"}`}
                          >
                            Patients
                          </button>
                        </div>
                      </div>

                      {/* Add Comment Input Form */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newCommentText.trim()) return;
                          setCommentSubmitting(true);
                          handleAddComment(patientViewItem.id, newCommentText);
                          setCommentSubmitting(false);
                        }}
                        className="space-y-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#315B7D] to-[#406E94] text-white flex items-center justify-center text-xs font-bold shadow-2xs shrink-0">
                            {user?.name ? user.name.charAt(0).toUpperCase() : "P"}
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            {user?.name || "Patient Member"} <span className="text-[10px] font-normal text-slate-400">({user?.role === "specialist" ? "Specialist" : "Patient"})</span>
                          </span>
                        </div>

                        <div className="relative">
                          <textarea
                            rows={2}
                            placeholder="Share your personal experience, clinical questions, or feedback on this resource..."
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#315B7D] focus:ring-2 focus:ring-[#315B7D]/20 transition-all resize-none"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1">
                            {["❤️ Helpful", "👏 Well explained", "🙏 Thank you", "💊 Routine tested"].map((quick) => (
                              <button
                                key={quick}
                                type="button"
                                onClick={() => setNewCommentText((prev) => (prev ? `${prev} ${quick}` : quick))}
                                className="hidden sm:inline-block px-2 py-0.8 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-600 transition cursor-pointer"
                              >
                                {quick}
                              </button>
                            ))}
                          </div>

                          <button
                            type="submit"
                            disabled={!newCommentText.trim() || commentSubmitting}
                            className="px-4 py-2 bg-[#315B7D] hover:bg-[#24465F] disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">send</span>
                            <span>Post Comment</span>
                          </button>
                        </div>
                      </form>

                      {/* Display Comments List */}
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {(patientViewItem.comments || [])
                          .filter((c) => {
                            if (commentFilter === "specialist") return c.userRole === "Specialist" || c.userRole === "Doctor";
                            if (commentFilter === "patient") return c.userRole === "Patient";
                            return true;
                          })
                          .map((comm) => {
                            const isLikedByMe = (comm.userLikes || []).includes(user?.id);
                            return (
                              <div
                                key={comm.id}
                                className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 space-y-2 hover:border-slate-300 transition"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <img
                                      src={comm.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"}
                                      alt={comm.userName}
                                      className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                                    />
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-slate-900">{comm.userName}</span>
                                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full ${
                                          comm.userRole === "Specialist" || comm.userRole === "Doctor"
                                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        }`}>
                                          {comm.userRole || "Patient"}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-mono">{comm.createdAt}</span>
                                    </div>
                                  </div>

                                  {/* Like comment button */}
                                  <button
                                    type="button"
                                    onClick={() => handleLikeComment(patientViewItem.id, comm.id)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                      isLikedByMe
                                        ? "bg-rose-50 text-rose-600 border border-rose-200"
                                        : "text-slate-500 hover:text-rose-600 hover:bg-white"
                                    }`}
                                    title="Upvote comment"
                                  >
                                    <span>{isLikedByMe ? "❤️" : "🤍"}</span>
                                    <span>{comm.likes || 0}</span>
                                  </button>
                                </div>

                                <p className="text-xs text-slate-700 leading-relaxed pl-9">
                                  {comm.text}
                                </p>
                              </div>
                            );
                          })}

                        {(patientViewItem.comments || []).length === 0 && (
                          <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <span className="material-symbols-outlined text-3xl text-slate-300">chat_bubble_outline</span>
                            <p className="text-xs text-slate-500 mt-1">No comments posted yet.</p>
                            <p className="text-[11px] text-slate-400">Be the first patient or specialist to share your thoughts!</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setPatientViewItem(null)}
                    className="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 cursor-pointer shadow-sm"
                  >
                    Close Resource Reader
                  </button>
                </div>
              </div>}
          </div>
        )}

        {
    /* ===================== TAB 4: SETTINGS & PARAMETERS ===================== */
  }
        {activeTab === "settings" && <div id="patient_settings" className="space-y-6 animate-fade-in">
            <div className="border-b border-outline-variant pb-2">
              <h2 className="font-display font-black text-2xl text-on-surface">Account Parameters & Adjustments</h2>
              <p className="text-sm text-on-surface-variant">Update credentials, theme preferences, typography size, or modify subscription features.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {
    /* Profile details & Credentials */
  }
              <div className="lg:col-span-8 space-y-6">
                
                {
    /* Advanced Premium Subscription */
  }
                <div className="bg-gradient-to-br from-tertiary-container to-tertiary text-white rounded-2xl p-6 relative overflow-hidden shadow-sm flex flex-col justify-between items-start">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                  <span className="material-symbols-outlined text-3xl text-secondary-container mb-3">stars</span>
                  <h3 className="font-display font-extrabold text-lg">Unlock Advanced Skincare Features</h3>
                  <p className="text-[#d5ccff] text-xs leading-relaxed max-w-lg mb-4">
                    Get access to automatic multi-spectral mole analyses, unlimited teleconsultation slots, and certified dermatology PDF guides.
                  </p>
                  <button
    type="button"
    onClick={() => alert("DERMA CARE Premium Subscription: Available in active enterprise license.")}
    className="px-5 py-2.5 bg-secondary-container text-black font-bold rounded-lg text-xs hover:bg-[#65dca4] shadow-sm"
  >
                    Upgrade to Premium Plan
                  </button>
                </div>

                <section className="bg-white border border-outline-variant rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-outline-variant pb-3">
                    <span className="material-symbols-outlined text-primary font-bold">manage_accounts</span>
                    <h3 className="font-display font-bold text-md text-on-surface">Edit Registration Profile Form</h3>
                  </div>

                  {showEditForm ? <form onSubmit={handleSaveSettings} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold mb-1">Full Name</label>
                          <input
    type="text"
    value={editName}
    onChange={(e) => setEditName(e.target.value)}
    className="w-full p-2 bg-surface border border-outline-variant rounded-lg text-xs"
  />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Phone Number</label>
                          <input
    type="text"
    value={editPhone}
    onChange={(e) => setEditPhone(e.target.value)}
    className="w-full p-2 bg-surface border border-outline-variant rounded-lg text-xs"
  />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold mb-1">Change Email</label>
                          <input
    type="email"
    value={emailInput}
    onChange={(e) => setEmailInput(e.target.value)}
    className="w-full p-2 bg-surface border border-outline-variant rounded-lg text-xs"
  />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Date of Birth</label>
                          <input
    type="date"
    value={editDob}
    onChange={(e) => setEditDob(e.target.value)}
    className="w-full p-2 bg-surface border border-outline-variant rounded-lg text-xs"
  />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">Reset Account Password</label>
                        <div className="relative">
                          <input
    type={showPassword ? "text" : "password"}
    value={passwordInput}
    onChange={(e) => setPasswordInput(e.target.value)}
    className="w-full p-2 pr-10 bg-surface border border-outline-variant rounded-lg text-xs font-mono"
    placeholder="Enter new password..."
  />
                          <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary p-1 flex items-center justify-center transition-colors"
    title={showPassword ? "Hide password" : "View password"}
  >
                            <span className="material-symbols-outlined text-base">
                              {showPassword ? "visibility_off" : "visibility"}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 justify-end">
                        <button
    type="button"
    onClick={() => setShowEditForm(false)}
    className="px-4 py-2 border border-outline text-on-surface text-xs rounded-lg"
  >
                          Cancel
                        </button>
                        <button
    type="submit"
    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg"
  >
                          Save Registration Changes
                        </button>
                      </div>
                    </form> : <div className="space-y-3">
                      <p className="text-xs text-on-surface-variant"><strong>Full Name:</strong> {user.name}</p>
                      <p className="text-xs text-on-surface-variant"><strong>Email Address:</strong> {user.email}</p>
                      <p className="text-xs text-on-surface-variant"><strong>Phone:</strong> {user.phone || "None"}</p>
                      <p className="text-xs text-on-surface-variant"><strong>Date of Birth:</strong> {user.dob || "None"}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                        <span><strong>Account Password:</strong></span>
                        <span className="font-mono bg-surface-container px-2 py-0.5 rounded border border-outline-variant/60 font-medium">
                          {showPassword ? user.passwordHash || passwordInput || "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                        </span>
                        <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/90 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md transition-colors border border-primary/20 cursor-pointer"
    title={showPassword ? "Hide password" : "View password"}
  >
                          <span className="material-symbols-outlined text-xs">
                            {showPassword ? "visibility_off" : "visibility"}
                          </span>
                          <span>{showPassword ? "Hide Password" : "View Password"}</span>
                        </button>
                      </div>
                      
                      <button
    type="button"
    onClick={() => setShowEditForm(true)}
    className="px-4 py-2 border border-primary text-primary font-bold hover:bg-[#f0f3ff] rounded-lg text-xs"
  >
                        Modify Profile Form
                      </button>
                    </div>}
                </section>
              </div>

              {
    /* Right Column: Visual Parameter adjustments */
  }
              <div className="lg:col-span-4 space-y-6">
                <section className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="font-display font-bold text-sm text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-lg">palette</span>
                    Visual Parameters
                  </h3>

                  {
    /* System Language Switcher */
  }
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">translate</span>
                      {t.selectLang || "Select Language"}
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 bg-surface-container rounded-xl p-1.5 border border-outline-variant/40">
                      {[
    { code: "en", label: "English", flag: "\u{1F1FA}\u{1F1F8}" },
    { code: "lg", label: "Luganda", flag: "\u{1F1FA}\u{1F1EC}" },
    { code: "sw", label: "Swahili", flag: "\u{1F1F9}\u{1F1FF}" },
    { code: "fr", label: "Fran\xE7ais", flag: "\u{1F1EB}\u{1F1F7}" }
  ].map((lang) => <button
    key={lang.code}
    type="button"
    onClick={() => {
      if (onLanguageChange) {
        onLanguageChange(lang.code);
      } else {
        onUpdateUser({ ...user, language: lang.code });
      }
    }}
    className={`py-2 px-2.5 text-xs font-bold rounded-lg flex items-center justify-between transition-all ${currentLanguage === lang.code ? "bg-primary text-white shadow-xs" : "bg-white hover:bg-surface-container-high text-on-surface border border-outline-variant/40"}`}
  >
                          <span className="flex items-center gap-1.5">
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                          </span>
                          {currentLanguage === lang.code && <span className="material-symbols-outlined text-xs">check_circle</span>}
                        </button>)}
                    </div>
                  </div>

                  {
    /* Theme Switcher */
  }
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-on-surface-variant">Theme Preference</span>
                    <div className="flex bg-surface-container border border-outline-variant rounded-lg p-1 w-full">
                      <button
    onClick={() => setThemeMode("light")}
    className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${themeMode === "light" ? "bg-white text-primary shadow-sm border border-outline-variant" : "text-on-surface-variant"}`}
  >
                        <span className="material-symbols-outlined text-xs">light_mode</span> Light
                      </button>
                      <button
    onClick={() => setThemeMode("dark")}
    className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${themeMode === "dark" ? "bg-white text-primary shadow-sm border border-outline-variant" : "text-on-surface-variant"}`}
  >
                        <span className="material-symbols-outlined text-xs">dark_mode</span> Dark
                      </button>
                    </div>
                  </div>

                  {
    /* Font Size Selector */
  }
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-on-surface-variant">Accessibility Text Size</span>
                    <div className="flex justify-between items-center bg-surface-container rounded-lg p-1">
                      {["sm", "md", "lg"].map((size) => <button
    key={size}
    onClick={() => setFontSize(size)}
    className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase ${fontSize === size ? "bg-primary text-white" : "text-on-surface-variant"}`}
  >
                          {size}
                        </button>)}
                    </div>
                  </div>

                  {
    /* Share button */
  }
                  <button
    onClick={() => {
      navigator.clipboard.writeText(window.location.href);
      alert("DERMA CARE platform invite link copied! Share with friends on WhatsApp or Twitter.");
    }}
    className="w-full py-2 bg-surface-container-high hover:bg-surface-container-highest rounded-lg text-xs font-bold text-primary flex items-center justify-center gap-1.5 border border-outline-variant/40"
  >
                    <span className="material-symbols-outlined text-sm">share</span>
                    Invite Friends & Share Platform
                  </button>

                  {
    /* Logout */
  }
                  <button
    onClick={onLogout}
    className="w-full py-2 bg-white border border-error hover:bg-error-container text-error rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    {t.logout}
                  </button>
                </section>
              </div>
            </div>
          </div>}
      </main>

      {/* Selected Clinic Details Modal */}
      {selectedEntity && <div className="fixed inset-0 z-50 glass-overlay-backdrop flex items-center justify-center p-4">
          <div className="glass-modal rounded-3xl w-full max-w-lg p-6 sm:p-7 space-y-5 animate-scale-up relative">
            <button
    onClick={() => setSelectedEntity(null)}
    className="absolute right-4 top-4 text-outline hover:text-on-surface p-1 rounded-full"
  >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-container text-white rounded-xl flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl font-bold">local_hospital</span>
              </div>
              <div>
                <h3 className="font-display font-black text-md text-on-surface">{selectedEntity.name}</h3>
                <span className="text-xs text-outline">{selectedEntity.address}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-bold text-primary uppercase">Dermatology Services Offered</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedEntity.services.map((srv) => <span key={srv} className="text-xs bg-surface-container-low text-on-surface border border-outline-variant/30 px-2.5 py-1 rounded-full">
                    {srv}
                  </span>)}
              </div>
            </div>

            <div className="pt-2 border-t border-outline-variant flex items-center justify-between text-xs text-outline">
              <span>✉️ {selectedEntity.email}</span>
              <span>📞 {selectedEntity.phone}</span>
            </div>
          </div>
        </div>}

      {/* Diagnostic View Report Modal */}
      {showDiagnosedReportModal && <div className="fixed inset-0 z-50 glass-overlay-backdrop flex items-center justify-center p-4">
          <div className="glass-modal rounded-3xl w-full max-w-xl p-6 sm:p-7 space-y-5 animate-scale-up relative max-h-[90vh] overflow-y-auto">
            <button
    onClick={() => setShowDiagnosedReportModal(null)}
    className="absolute right-4 top-4 text-outline hover:text-on-surface p-1 rounded-full"
  >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="border-b border-outline-variant pb-3">
              <span className="bg-secondary-container text-[#00734c] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded">Diagnosed Report</span>
              <h3 className="font-display font-black text-lg text-primary mt-1">Clinical Case Report #{showDiagnosedReportModal.id}</h3>
              <p className="text-xs text-outline font-mono">Date: {showDiagnosedReportModal.createdAt}</p>
            </div>

            <div className="space-y-3">
              <div className="bg-surface p-3 rounded-lg border border-outline-variant text-xs space-y-1">
                <span className="block font-bold text-primary">Patient Submitted Symptoms:</span>
                <p className="italic text-on-surface-variant">"{showDiagnosedReportModal.symptoms}"</p>
              </div>

              {showDiagnosedReportModal.diagnosisReport && <div className="space-y-3 bg-[#f0f3ff] p-4 rounded-xl border border-primary/20">
                  <div>
                    <span className="text-xs font-bold text-primary block">Diagnosed Skin Condition:</span>
                    <p className="text-sm font-bold text-on-surface">{showDiagnosedReportModal.diagnosisReport.diagnosedCondition}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-primary block">Clinical Observation Notes:</span>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{showDiagnosedReportModal.diagnosisReport.notes}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-secondary block">Prescribed Skincare Plan:</span>
                    <p className="text-xs font-mono font-bold text-secondary bg-[#e8fbf3] p-2 rounded border border-secondary-container">
                      {showDiagnosedReportModal.diagnosisReport.prescription}
                    </p>
                  </div>
                  {(() => {
    const docName = showDiagnosedReportModal.diagnosisReport.specialistName;
    const doc = allSpecialists.find((s) => s.name === docName || s.id === showDiagnosedReportModal.specialistId);
    return <div className="flex items-center justify-between gap-3 pt-2 border-t border-primary/15">
                        <div className="flex items-center gap-2.5">
                          <div
      onClick={() => doc && setSelectedDoctorProfile(doc)}
      className={`w-9 h-9 rounded-full overflow-hidden border-2 border-primary/40 shadow-xs shrink-0 ${doc ? "cursor-pointer hover:ring-2 hover:ring-primary" : ""}`}
      title={doc ? `Click to view Dr. ${docName}'s profile` : docName}
    >
                            <img
      src={getDoctorAvatar(doc || docName)}
      alt={docName}
      referrerPolicy="no-referrer"
      className="w-full h-full object-cover"
      onError={(e) => {
        e.target.src = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80";
      }}
    />
                          </div>
                          <div>
                            <span className="text-[10px] text-outline block">Diagnosing Specialist</span>
                            <span
      onClick={() => doc && setSelectedDoctorProfile(doc)}
      className={`text-xs font-extrabold text-on-surface ${doc ? "hover:text-primary hover:underline cursor-pointer" : ""}`}
    >
                              {docName}
                            </span>
                          </div>
                        </div>
                        {doc && <button
      type="button"
      onClick={() => setSelectedDoctorProfile(doc)}
      className="px-2.5 py-1 bg-white hover:bg-primary/10 text-primary text-[10px] font-bold rounded-lg border border-primary/20 transition-all cursor-pointer"
    >
                            View Doctor Profile
                          </button>}
                      </div>;
  })()}

                  <div className="pt-2 border-t border-primary/20 flex justify-end">
                    <button
    type="button"
    onClick={() => handleDownloadPatientReport(showDiagnosedReportModal)}
    disabled={isDownloadingReportPdf}
    className="px-4 py-2 bg-primary hover:bg-primary/90 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
  >
                      <span className="material-symbols-outlined text-sm">
                        {isDownloadingReportPdf ? "hourglass_empty" : "picture_as_pdf"}
                      </span>
                      <span>
                        {isDownloadingReportPdf ? "Generating PDF..." : "Download Official PDF Report"}
                      </span>
                    </button>
                  </div>
                </div>}
            </div>
          </div>
        </div>}

      {/* Doctor Profile Modal (Viewable by Patient under Doctor Profile) */}
      {selectedDoctorProfile && <div className="fixed inset-0 z-50 glass-overlay-backdrop flex items-center justify-center p-4">
          <div className="glass-modal rounded-3xl w-full max-w-lg p-6 sm:p-7 space-y-5 animate-scale-up relative max-h-[92vh] overflow-y-auto">
            <button
    type="button"
    onClick={() => setSelectedDoctorProfile(null)}
    className="absolute right-4 top-4 w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
  >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {
    /* Doctor Profile Header with Prominent Circular Avatar */
  }
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 pb-4 border-b border-outline-variant/60">
              <div className="relative shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white shadow-xl ring-4 ring-primary/20 bg-primary/10">
                  <img
    src={getDoctorAvatar(selectedDoctorProfile)}
    alt={selectedDoctorProfile.name}
    referrerPolicy="no-referrer"
    className="w-full h-full object-cover object-center"
    onError={(e) => {
      e.target.src = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80";
    }}
  />
                </div>
                <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 text-white border-2 border-white flex items-center justify-center shadow" title="Verified Specialist Doctor">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </span>
              </div>

              <div className="text-center sm:text-left space-y-1.5 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h3 className="font-display font-black text-lg sm:text-xl text-on-surface">{selectedDoctorProfile.name}</h3>
                  <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-primary/20 uppercase tracking-wider">
                    {selectedDoctorProfile.providerType || "Verified Specialist"}
                  </span>
                </div>
                <p className="text-xs font-bold text-primary">
                  {selectedDoctorProfile.specialization || "Clinical Dermatologist"}
                </p>
                <p className="text-[11px] text-on-surface-variant flex items-center justify-center sm:justify-start gap-1">
                  <span className="material-symbols-outlined text-xs">local_hospital</span>
                  <span>{selectedDoctorProfile.clinicName || selectedDoctorProfile.hospitalName || "Central Referral Skin Clinic"}</span>
                  {selectedDoctorProfile.experience && <span>• {selectedDoctorProfile.experience} experience</span>}
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-0.5">
                  <span className="text-[11px] bg-secondary-container text-secondary font-bold px-2 py-0.5 rounded-md font-mono">
                    ★ {selectedDoctorProfile.rating || 4.9} rating
                  </span>
                  <span className="text-[11px] text-outline font-mono">
                    ID: {selectedDoctorProfile.registrationNumber || "REG-UG-MED"}
                  </span>
                </div>
              </div>
            </div>

            {
    /* Doctor Credentials & Practice Details */
  }
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/60 space-y-1">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider block">Licensing & Credentials</span>
                <p className="font-bold text-on-surface">{selectedDoctorProfile.licensingAuthority || "Medical Practitioners Council"}</p>
                <p className="text-[11px] text-outline font-mono">Reg: {selectedDoctorProfile.registrationNumber || "REG-9102-S"}</p>
              </div>

              <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/60 space-y-1">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider block">Consultation Availability</span>
                <p className="font-bold text-on-surface">{selectedDoctorProfile.consultationHours || "09:00 AM - 05:00 PM"}</p>
                <p className="text-[11px] text-outline">
                  {selectedDoctorProfile.consultationType === "Both" ? "\u{1F310} Video Calls & \u{1F3E5} Clinic Visits" : selectedDoctorProfile.consultationType === "Online" ? "\u{1F310} Online Video Consultation Only" : "\u{1F3E5} In-Person Clinic Only"}
                </p>
              </div>
            </div>

            {
    /* Clinical Services Offered */
  }
            {selectedDoctorProfile.services && selectedDoctorProfile.services.length > 0 && <div className="space-y-1.5">
                <span className="block text-[11px] font-bold text-on-surface uppercase tracking-wider">Clinical Dermatology Services</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDoctorProfile.services.map((srv) => <span key={srv} className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-medium">
                      {srv}
                    </span>)}
                </div>
              </div>}

            {
    /* Bio */
  }
            {selectedDoctorProfile.bio && <div className="p-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant/60 space-y-1 text-xs">
                <span className="block font-bold text-on-surface text-[11px] uppercase tracking-wider">Clinical Philosophy & Bio</span>
                <p className="text-on-surface-variant leading-relaxed italic">"{selectedDoctorProfile.bio}"</p>
              </div>}

            {
    /* Action Footer */
  }
            <div className="pt-2 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-outline text-center sm:text-left">
                <span>📧 {selectedDoctorProfile.email}</span>
                {selectedDoctorProfile.phone && <span className="ml-3">📞 {selectedDoctorProfile.phone}</span>}
              </div>
              <button
    type="button"
    onClick={() => {
      const doc = selectedDoctorProfile;
      setSelectedDoctorProfile(null);
      startConsultationBooking({ doctor: doc, stage: 1 });
    }}
    className="w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary/90 active:scale-95 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer"
  >
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                <span>Book Consultation with Dr. {selectedDoctorProfile.name.split(" ").pop()}</span>
              </button>
            </div>
          </div>
        </div>}

      {/* Appointment Blocked & Waiting for Doctor Approval Modal */}
      {bookingConfirmationModal && bookingConfirmationModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-outline-variant text-[#263746]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl animate-spin text-amber-600">hourglass_top</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full inline-block">
                    ⏳ Waiting for Doctor Approval
                  </span>
                  <h3 className="font-display font-extrabold text-base text-on-surface">
                    Appointment Slot Blocked & Submitted
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookingConfirmationModal(null)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Content Summary */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/80 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
                <span className="text-outline font-semibold">Selected Provider:</span>
                <span className="font-extrabold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-base">
                    {bookingConfirmationModal.appointment.providerType === "doctor" ? "stethoscope" : bookingConfirmationModal.appointment.providerType === "clinic" ? "medical_services" : "local_hospital"}
                  </span>
                  {bookingConfirmationModal.appointment.specialistName || bookingConfirmationModal.appointment.providerName}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
                <span className="text-outline font-semibold">Blocked Date & Time:</span>
                <span className="font-bold text-primary font-mono">
                  📅 {bookingConfirmationModal.appointment.date} • ⏰ {bookingConfirmationModal.appointment.time}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
                <span className="text-outline font-semibold">Consultation Mode:</span>
                <span className="font-bold text-on-surface">
                  {bookingConfirmationModal.appointment.type === "Online" ? "🌐 Online Video Call" : "🏥 In-Person Facility Visit"}
                </span>
              </div>

              {/* Uploaded Lesion Image & Symptoms Preview */}
              <div className="pt-1 flex items-center gap-3">
                {bookingConfirmationModal.appointment.lesionImage && (
                  <img
                    src={bookingConfirmationModal.appointment.lesionImage}
                    alt="Attached Lesion"
                    className="w-14 h-14 rounded-xl object-cover border border-outline-variant shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <span className="block font-bold text-on-surface text-[11px] truncate">
                    Attached Lesion Photo & Symptoms
                  </span>
                  <p className="text-[11px] text-outline line-clamp-2 italic">
                    "{bookingConfirmationModal.appointment.symptoms || "Cutaneous consultation requested."}"
                  </p>
                </div>
              </div>
            </div>

            {/* Waiting for Approval Explanatory Note */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
              <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">info</span>
              <div>
                <strong className="block font-bold">What happens next?</strong>
                The specialist doctor is reviewing your submitted skin photos and case details. Once approved, you will see the status update to <span className="font-bold text-emerald-700">"Approved & Confirmed ✓"</span> on your dashboard and timetable.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setBookingConfirmationModal(null);
                  setActiveTab("dashboard");
                }}
                className="w-full sm:w-auto flex-1 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">event_available</span>
                View in My Appointments & Calendar
              </button>
              <button
                type="button"
                onClick={() => setBookingConfirmationModal(null)}
                className="w-full sm:w-auto px-4 py-2.5 border border-outline-variant hover:bg-surface-container text-on-surface font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Live Dermatology Camera Viewfinder Modal */}
      {isCameraActive && <div className="fixed inset-0 z-50 glass-overlay-backdrop flex items-center justify-center p-4">
          <div className="glass-viewfinder-overlay rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-error animate-ping" />
                <h3 className="font-bold text-sm text-on-surface">Live Dermatology Camera Viewfinder</h3>
              </div>
              <button
    type="button"
    onClick={stopCamera}
    className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant"
  >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {
    /* Video Feed Frame */
  }
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-outline-variant">
              <video
    ref={videoRef}
    autoPlay
    playsInline
    muted
    className="w-full h-full object-cover"
  />
              {
    /* Target Alignment Reticle for lesion capture */
  }
              <div className="absolute inset-0 border-2 border-dashed border-white/50 rounded-2xl pointer-events-none m-6 flex items-center justify-center">
                <span className="text-white/80 text-[10px] font-mono uppercase bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                  Center lesion or affected skin area
                </span>
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {cameraError && <p className="text-xs text-error font-medium">{cameraError}</p>}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
    type="button"
    onClick={stopCamera}
    className="px-4 py-2.5 rounded-xl border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container"
  >
                Cancel
              </button>

              <button
    type="button"
    onClick={() => cameraInputRef.current?.click()}
    className="px-3 py-2.5 rounded-xl border border-outline-variant text-xs font-bold text-on-surface-variant hover:bg-surface-container flex items-center gap-1"
  >
                <span className="material-symbols-outlined text-sm">photo_camera</span>
                Native Camera
              </button>

              <button
                type="button"
                onClick={capturePhotoFromCamera}
                className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 flex items-center gap-2 shadow-md"
              >
                <span className="material-symbols-outlined text-base">camera</span>
                Snap Photo
              </button>
            </div>
          </div>
        </div>}
    </div>;
}
