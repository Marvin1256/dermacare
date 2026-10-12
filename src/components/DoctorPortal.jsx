import { useState, useEffect, useRef, useMemo } from "react";
import { translations } from "../data";
import { generatePatientDiagnosticPDF } from "../utils/reportPdfGenerator";
import { playNotificationChime } from "../utils/audioChime";
import {
  handleHorizontalWheel,
  isolateScroll,
  useLockBodyScroll
} from "../utils/scrollHelpers";
export default function DoctorPortal({
  user,
  accounts = [],
  onUpdateUser,
  cases,
  onDiagnoseCase,
  appointments = [],
  onAcceptAppointment,
  onDeclineAppointment,
  onCompleteAppointment,
  onRescheduleAppointment,
  onUpdateAppointment,
  libraryItems = [],
  onAddLibraryItem,
  onUpdateLibraryItem,
  onLogout,
  currentLanguage,
  onLanguageChange,
  adminSpecialistChats = [],
  onSendSpecialistMessage,
  onMarkSpecialistChatRead
}) {
  const t = translations[currentLanguage] || translations.en;
  const [activeTab, setActiveTab] = useState("queue");
  const [communitySubTab, setCommunitySubTab] = useState("explorer");
  const [scrollProgress, setScrollProgress] = useState(0);
  const mainRef = useRef(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const [manualOrientationOverride, setManualOrientationOverride] = useState("auto");
  const [manualDropdownOverride, setManualDropdownOverride] = useState("auto");
  const [selectedCase, setSelectedCase] = useState(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState("");
  const [isFetchingAIAnalysis, setIsFetchingAIAnalysis] = useState(false);
  const [diagnosedCondition, setDiagnosedCondition] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [prescribedMedicine, setPrescribedMedicine] = useState("");
  const [exportingCaseId, setExportingCaseId] = useState(null);
  const [pdfSuccessToast, setPdfSuccessToast] = useState(null);
  const [appointmentFilter, setAppointmentFilter] = useState("pending"); // "pending" | "timetable" | "approved" | "all"
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [previewLesionPhoto, setPreviewLesionPhoto] = useState(null);
  const [appointmentActionToast, setAppointmentActionToast] = useState(null);
  const [pendingBookingToast, setPendingBookingToast] = useState(null);
  const [specialistReminderToast, setSpecialistReminderToast] = useState(null);
  const [editingReminderApp, setEditingReminderApp] = useState(null);
  const [rescheduleModalApp, setRescheduleModalApp] = useState(null);
  const [completeModalApp, setCompleteModalApp] = useState(null);
  const [eventsSearchQuery, setEventsSearchQuery] = useState("");
  const [eventsStatusFilter, setEventsStatusFilter] = useState("all"); // "all" | "confirmed" | "completed" | "pending" | "rescheduled"
  const [reservedDoctorSlots, setReservedDoctorSlots] = useState({});
  const [libraryMode, setLibraryMode] = useState("publish");
  const [libFormType, setLibFormType] = useState("article");
  const [editingLang, setEditingLang] = useState("en");
  const [libForm, setLibForm] = useState({
    title: "",
    category: "Skincare Tips",
    coverImage: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=800&q=80",
    photos: [
      "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=800&q=80"
    ],
    customPhotoUrl: "",
    mediaUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    audioTracks: [],
    duration: "03:45",
    author: user.name,
    titleTranslations: { en: "", lg: "", sw: "", fr: "" },
    summaryTranslations: { en: "", lg: "", sw: "", fr: "" },
    fullTextTranslations: { en: "", lg: "", sw: "", fr: "" }
  });
  const [recordingState, setRecordingState] = useState("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioFileInputRef = useRef(null);
  const formatTimerSeconds = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };
  const [webAudioInput, setWebAudioInput] = useState("");
  const startVoiceRecording = async () => {
    if (libForm.audioTracks.length >= 3) {
      alert("Maximum of 3 audio tracks allowed per voice advisory. Please remove an existing audio track before recording a new one.");
      return;
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Voice recording is not supported in this browser environment.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result;
          if (base64Audio) {
            setLibForm((prev) => {
              if (prev.audioTracks.length >= 3) {
                alert("Maximum 3 audio tracks allowed.");
                return prev;
              }
              const recDur = formatTimerSeconds(recordingSeconds) || "01:30";
              const newTrack = {
                id: "rec-" + Date.now(),
                name: `Recorded Voice Mail #${prev.audioTracks.length + 1}`,
                url: base64Audio,
                duration: recDur,
                type: "recorded"
              };
              const updated = [...prev.audioTracks, newTrack];
              return {
                ...prev,
                audioTracks: updated,
                mediaUrl: updated[0]?.url || base64Audio,
                duration: updated[0]?.duration || recDur
              };
            });
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start(200);
      setRecordingState("recording");
      setRecordingSeconds(0);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1e3);
    } catch (err) {
      console.error("Error starting audio recording:", err);
      alert("Could not access microphone for voice recording. Please verify browser microphone permissions.");
    }
  };
  const pauseVoiceRecording = () => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.pause();
      setRecordingState("paused");
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };
  const resumeVoiceRecording = () => {
    if (mediaRecorderRef.current && recordingState === "paused") {
      mediaRecorderRef.current.resume();
      setRecordingState("recording");
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1e3);
    }
  };
  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && (recordingState === "recording" || recordingState === "paused")) {
      mediaRecorderRef.current.stop();
      setRecordingState("stopped");
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };
  const resetVoiceRecording = () => {
    setRecordingState("idle");
    setRecordingSeconds(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };
  const handleDeviceAudioUpload = (e) => {
    if (libForm.audioTracks.length >= 3) {
      alert("Maximum of 3 audio tracks allowed per voice advisory. Please remove an existing track before uploading another.");
      if (audioFileInputRef.current) audioFileInputRef.current.value = "";
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (result) {
        setLibForm((prev) => {
          if (prev.audioTracks.length >= 3) {
            alert("Maximum 3 audio tracks allowed.");
            return prev;
          }
          const newTrack = {
            id: "up-" + Date.now(),
            name: file.name || `Uploaded Audio Message #${prev.audioTracks.length + 1}`,
            url: result,
            duration: "02:45",
            type: "uploaded"
          };
          const updated = [...prev.audioTracks, newTrack];
          return {
            ...prev,
            audioTracks: updated,
            mediaUrl: updated[0]?.url || result,
            duration: updated[0]?.duration || "02:45"
          };
        });
        setRecordingState("stopped");
      }
    };
    reader.readAsDataURL(file);
    if (audioFileInputRef.current) audioFileInputRef.current.value = "";
  };
  const handleAddWebAudioTrack = () => {
    if (!webAudioInput.trim()) return;
    if (libForm.audioTracks.length >= 3) {
      alert("Maximum of 3 audio tracks allowed. Please delete an existing audio track first.");
      return;
    }
    const newTrack = {
      id: "web-" + Date.now(),
      name: `Web Audio Stream #${libForm.audioTracks.length + 1}`,
      url: webAudioInput.trim(),
      duration: "03:00",
      type: "link"
    };
    const updated = [...libForm.audioTracks, newTrack];
    setLibForm((prev) => ({
      ...prev,
      audioTracks: updated,
      mediaUrl: updated[0]?.url || webAudioInput.trim(),
      duration: updated[0]?.duration || "03:00"
    }));
    setWebAudioInput("");
  };
  const handleDeleteAudioTrack = (trackId) => {
    setLibForm((prev) => {
      const updated = prev.audioTracks.filter((t2) => t2.id !== trackId);
      return {
        ...prev,
        audioTracks: updated,
        mediaUrl: updated[0]?.url || "",
        duration: updated[0]?.duration || "00:00"
      };
    });
  };
  const videoFileInputRef = useRef(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(null);
  const getEmbedVideoUrl = (url) => {
    if (!url) return "";
    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  };
  const handleDeviceVideoUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setVideoUploadProgress(20);
    const interval = setInterval(() => {
      setVideoUploadProgress((prev) => {
        if (prev === null) return null;
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setVideoUploadProgress(null), 1200);
          return 100;
        }
        return prev + 30;
      });
    }, 250);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (result) {
        setLibForm((prev) => ({
          ...prev,
          mediaUrl: result,
          duration: prev.duration || "04:15"
        }));
      }
    };
    reader.readAsDataURL(file);
    if (videoFileInputRef.current) videoFileInputRef.current.value = "";
  };
  const [viewItem, setViewItem] = useState(null);
  const [viewLang, setViewLang] = useState(currentLanguage);
  const [docCommentText, setDocCommentText] = useState("");

  // Lock body scroll when modals or overlays are open to prevent background bleed
  useLockBodyScroll(Boolean(viewItem || selectedCase || rescheduleModalApp || completeModalApp || editingReminderApp || previewLesionPhoto));

  // Sync viewItem with updated library items
  useEffect(() => {
    if (viewItem) {
      const refreshed = libraryItems.find((item) => item.id === viewItem.id);
      if (refreshed) {
        setViewItem(refreshed);
      }
    }
  }, [libraryItems]);

  const handleDocToggleReaction = (itemId, emoji) => {
    const item = libraryItems.find((i) => i.id === itemId);
    if (!item) return;

    const userId = user?.id || "doctor";
    const userReactions = { ...(item.userReactions || {}) };
    const currentReaction = userReactions[userId];
    const reactions = { ...(item.reactions || {}) };

    if (currentReaction === emoji) {
      delete userReactions[userId];
      reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
    } else {
      if (currentReaction && reactions[currentReaction]) {
        reactions[currentReaction] = Math.max(0, reactions[currentReaction] - 1);
      }
      userReactions[userId] = emoji;
      reactions[emoji] = (reactions[emoji] || 0) + 1;
    }

    const updated = { ...item, reactions, userReactions };
    if (onUpdateLibraryItem) onUpdateLibraryItem(updated);
    if (viewItem?.id === itemId) setViewItem(updated);
  };

  const handleDocToggleLike = (itemId) => {
    const item = libraryItems.find((i) => i.id === itemId);
    if (!item) return;

    const userId = user?.id || "doctor";
    const userLikes = Array.isArray(item.userLikes) ? [...item.userLikes] : [];
    const hasLiked = userLikes.includes(userId);
    let updatedLikes = typeof item.likes === "number" ? item.likes : 0;

    let nextLikes;
    if (hasLiked) {
      nextLikes = userLikes.filter((id) => id !== userId);
      updatedLikes = Math.max(0, updatedLikes - 1);
    } else {
      nextLikes = [...userLikes, userId];
      updatedLikes = updatedLikes + 1;
    }

    const updated = { ...item, likes: updatedLikes, userLikes: nextLikes };
    if (onUpdateLibraryItem) onUpdateLibraryItem(updated);
    if (viewItem?.id === itemId) setViewItem(updated);
  };

  const handleDocAddComment = (itemId, text) => {
    if (!text || !text.trim()) return;
    const item = libraryItems.find((i) => i.id === itemId);
    if (!item) return;

    const newComment = {
      id: "COM-" + Date.now(),
      userId: user?.id || "doctor_specialist",
      userName: user?.name || "Dr. Specialist",
      userRole: "Specialist",
      avatar: user?.profilePic || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=150&q=80",
      text: text.trim(),
      createdAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      likes: 0,
      userLikes: []
    };

    const updated = { ...item, comments: [newComment, ...(item.comments || [])] };
    if (onUpdateLibraryItem) onUpdateLibraryItem(updated);
    if (viewItem?.id === itemId) setViewItem(updated);
    setDocCommentText("");
  };

  const handleDocLikeComment = (itemId, commentId) => {
    const item = libraryItems.find((i) => i.id === itemId);
    if (!item) return;

    const userId = user?.id || "doctor";
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

    const updated = { ...item, comments: updatedComments };
    if (onUpdateLibraryItem) onUpdateLibraryItem(updated);
    if (viewItem?.id === itemId) setViewItem(updated);
  };
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");
  const [adminChatToast, setAdminChatToast] = useState(null);
  const [specialistSentToast, setSpecialistSentToast] = useState(null);
  const chatMessagesEndRef = useRef(null);

  // Filter two-way chat messages for this specialist by ID or email
  const myAdminChats = useMemo(() => {
    return adminSpecialistChats.filter(
      (c) =>
        c.specialistId === user.id ||
        (user?.email && c.specialistEmail && c.specialistEmail.toLowerCase() === user.email.toLowerCase())
    );
  }, [adminSpecialistChats, user?.id, user?.email]);

  // Guaranteed earlier conversations with administration for any specialist
  const displayedAdminChats = useMemo(() => {
    if (myAdminChats.length > 0) return myAdminChats;
    return [
      {
        id: `CHAT-WELCOME-${user.id || "INIT"}`,
        specialistId: user.id,
        specialistName: user.name,
        specialistEmail: user.email,
        specialization: user.specialization || "Clinical Specialist",
        role: "admin",
        senderName: "DERMA CARE System Administrator",
        content: `Welcome Dr. ${user.name} to the DERMA CARE Clinical Specialist Desk. Your practitioner credentials (${user.registrationNumber || "Lic. Verified"}) are logged with the central administration board. You can use this secure two-way channel to consult on license verifications, clinical form customizations, and patient triage escalations.`,
        time: "09:00 AM",
        date: "2026-10-06",
        timestamp: "2026-10-06T06:00:00.000Z",
        readByAdmin: true,
        readBySpecialist: true,
        isEarlierConversation: true
      }
    ];
  }, [myAdminChats, user?.id, user?.name, user?.email, user?.specialization, user?.registrationNumber]);

  // Unread messages from Admin for this specialist
  const unreadAdminMsgCount = useMemo(() => {
    return displayedAdminChats.filter((m) => m.role === "admin" && !m.readBySpecialist).length;
  }, [displayedAdminChats]);

  // When community tab is open, automatically mark messages as read by specialist
  useEffect(() => {
    if (activeTab === "community" && onMarkSpecialistChatRead) {
      const hasUnread = displayedAdminChats.some((m) => m.role === "admin" && !m.readBySpecialist);
      if (hasUnread) {
        onMarkSpecialistChatRead(user.id);
      }
    }
  }, [activeTab, displayedAdminChats, onMarkSpecialistChatRead, user?.id]);

  // Show live toast notification and audio chime when an Admin reply arrives
  const previousAdminMsgCountRef = useRef(displayedAdminChats.filter((m) => m.role === "admin").length);
  useEffect(() => {
    const currentAdminCount = displayedAdminChats.filter((m) => m.role === "admin").length;
    if (currentAdminCount > previousAdminMsgCountRef.current) {
      const latestAdminMsg = [...displayedAdminChats].reverse().find((m) => m.role === "admin");
      if (latestAdminMsg) {
        playNotificationChime();
        setAdminChatToast({
          sender: "DERMA CARE System Administrator",
          content: latestAdminMsg.content,
          time: latestAdminMsg.time
        });
        setTimeout(() => setAdminChatToast(null), 7000);
      }
    }
    previousAdminMsgCountRef.current = currentAdminCount;
  }, [displayedAdminChats]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (activeTab === "community") {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayedAdminChats.length, activeTab]);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const avatarFileInputRef = useRef(null);
  const [avatarSuccessToast, setAvatarSuccessToast] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profForm, setProfForm] = useState({
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "+256 701 123456",
    providerType: user.providerType || "Individual",
    licensingAuthority: user.licensingAuthority || "Medical Practitioners Council",
    registrationNumber: user.registrationNumber || "MED-UG-88492",
    specialization: user.specialization || "Clinical Dermatologist",
    experience: user.experience || "8 Years",
    qualifications: user.qualifications || "MBChB, MMed Dermatology",
    hospitalName: user.hospitalName || "Central Referral Clinic",
    department: user.department || "Dermatology & Skin Surgery",
    position: user.position || "Senior Consultant Dermatologist",
    website: user.website || "https://moyo-health.app",
    address: user.address || "Central Referral Clinic, Kampala",
    consultationType: user.consultationType || "Both",
    consultationHours: user.consultationHours || "09:00 AM - 05:00 PM",
    bio: user.bio || "Dermatology specialist passionate about high-quality patient skin triage.",
    profilePic: user.profilePic || ""
  });
  useEffect(() => {
    if (user) {
      setProfForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "+256 701 123456",
        providerType: user.providerType || "Individual",
        licensingAuthority: user.licensingAuthority || "Medical Practitioners Council",
        registrationNumber: user.registrationNumber || "MED-UG-88492",
        specialization: user.specialization || "Clinical Dermatologist",
        experience: user.experience || "8 Years",
        qualifications: user.qualifications || "MBChB, MMed Dermatology",
        hospitalName: user.hospitalName || "Central Referral Clinic",
        department: user.department || "Dermatology & Skin Surgery",
        position: user.position || "Senior Consultant Dermatologist",
        website: user.website || "https://moyo-health.app",
        address: user.address || "Central Referral Clinic, Kampala",
        consultationType: user.consultationType || "Both",
        consultationHours: user.consultationHours || "09:00 AM - 05:00 PM",
        bio: user.bio || "Dermatology specialist passionate about high-quality patient skin triage.",
        profilePic: user.profilePic || ""
      });
    }
  }, [user]);
  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }
    setIsUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (result) {
        setProfForm((prev) => ({ ...prev, profilePic: result }));
        const updatedUser = {
          ...user,
          profilePic: result
        };
        onUpdateUser(updatedUser);
        setIsUploadingAvatar(false);
        setAvatarSuccessToast("Profile picture updated successfully! Visible to admins and patients.");
        setTimeout(() => setAvatarSuccessToast(null), 4e3);
      }
    };
    reader.onerror = () => {
      setIsUploadingAvatar(false);
      alert("Failed to process image file. Please try again.");
    };
    reader.readAsDataURL(file);
    if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
  };
  const handleRemoveAvatar = (e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to remove your profile picture?")) {
      setProfForm((prev) => ({ ...prev, profilePic: "" }));
      const updatedUser = {
        ...user,
        profilePic: ""
      };
      onUpdateUser(updatedUser);
      setAvatarSuccessToast("Profile picture removed.");
      setTimeout(() => setAvatarSuccessToast(null), 3e3);
    }
  };
  useEffect(() => {
    const handleViewportChange = () => {
      const wide = window.innerWidth >= 1024;
      const landscape = window.innerWidth > window.innerHeight || typeof window !== "undefined" && window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
      setIsWideScreen(wide);
      setIsLandscape(landscape);
      const scrolled = window.scrollY > 40;
      setIsScrolledDown(scrolled);
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
    handleViewportChange();
    window.addEventListener("scroll", handleViewportChange, { passive: true });
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    const handleOutsideClick = (e) => {
      const navEl = document.getElementById("doctor_nav_wrapper");
      if (navEl && !navEl.contains(e.target)) {
        setIsNavDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [activeTab]);
  const isLeftOrientation = manualOrientationOverride === "left" ? true : manualOrientationOverride === "top" ? false : isWideScreen && isLandscape;
  const isDropdownMode = manualDropdownOverride === "dropdown";
  const handleFetchAISummaryReport = async (item) => {
    setIsFetchingAIAnalysis(true);
    setAiAnalysisResult("");
    try {
      const response = await fetch("/api/analyze-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: item.symptoms,
          transcription: item.transcription,
          language: currentLanguage
        })
      });
      const data = await response.json();
      setAiAnalysisResult(data.analysis);
    } catch (err) {
      setAiAnalysisResult(
        `**AI Clinical Insight Report (offline demo)**

- **Probable Dermatosis**: 85% Contact dermatitis/phototoxic reaction.
- **Severity**: Low-Moderate. Skin barrier intact.
- **Specialist scrutiny**: Investigate active cosmetic detergents or facial sunscreens applied in preceding 48 hours.
- **Recommended diagnostic question**: "Did you encounter tingling or red irritation immediately after product contact?"`
      );
    } finally {
      setIsFetchingAIAnalysis(false);
    }
  };
  const handleDownloadReportPDF = async (caseItem) => {
    try {
      setExportingCaseId(caseItem.id);
      await generatePatientDiagnosticPDF(caseItem, user);
      setPdfSuccessToast({ patientName: caseItem.patientName, caseId: caseItem.id });
      setTimeout(() => setPdfSuccessToast(null), 5e3);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Failed to generate diagnostic report PDF. Please try again.");
    } finally {
      setExportingCaseId(null);
    }
  };
  const handleExportCurrentDraftPDF = async () => {
    if (!selectedCase) return;
    const draftItem = {
      ...selectedCase,
      diagnosisReport: {
        diagnosedCondition: diagnosedCondition || "Clinical Diagnostic Assessment",
        notes: clinicalNotes || "Clinical examination in progress by specialist.",
        prescription: prescribedMedicine || "Pending formal review.",
        specialistName: user.name,
        specialistId: user.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
    await handleDownloadReportPDF(draftItem);
  };
  const handleDiagnoseSubmit = async (e, andDownloadPdf = false) => {
    e.preventDefault();
    if (!selectedCase || !diagnosedCondition || !clinicalNotes) {
      alert("Please fill in the diagnosed condition and clinical notes.");
      return;
    }
    const currentCase = selectedCase;
    const condition = diagnosedCondition;
    const notes = clinicalNotes;
    const prescription = prescribedMedicine;
    onDiagnoseCase(currentCase.id, condition, notes, prescription);
    if (andDownloadPdf) {
      const updatedCase = {
        ...currentCase,
        status: "Diagnosed",
        diagnosisReport: {
          diagnosedCondition: condition,
          notes,
          prescription,
          specialistName: user.name,
          specialistId: user.id,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
      await handleDownloadReportPDF(updatedCase);
    } else {
      setPdfSuccessToast({ patientName: currentCase.patientName, caseId: currentCase.id });
      setTimeout(() => setPdfSuccessToast(null), 5e3);
    }
    setSelectedCase(null);
    setDiagnosedCondition("");
    setClinicalNotes("");
    setPrescribedMedicine("");
  };
  const fileInputRef = useRef(null);
  const handleDeviceImageUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (result) {
          setLibForm((prev) => ({
            ...prev,
            photos: [...prev.photos, result],
            coverImage: prev.photos.length === 0 ? result : prev.coverImage
          }));
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleAddPhotoToForm = (presetUrl) => {
    const targetUrl = presetUrl || libForm.customPhotoUrl.trim();
    if (!targetUrl) return;
    setLibForm((prev) => ({
      ...prev,
      photos: [...prev.photos, targetUrl],
      customPhotoUrl: ""
    }));
  };
  const handleRemovePhotoFromForm = (idxToRemove) => {
    setLibForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, idx) => idx !== idxToRemove)
    }));
  };
  const handleAutoTranslateAcrossLanguages = () => {
    const baseTitle = libForm.titleTranslations[editingLang] || libForm.title || "Skincare Advisory";
    const baseSummary = libForm.summaryTranslations[editingLang] || "Essential health guidance from dermatology specialists.";
    const baseBody = libForm.fullTextTranslations[editingLang] || "Clinical protocols and patient instructions for dermal wellness.";
    setLibForm((prev) => ({
      ...prev,
      titleTranslations: {
        en: baseTitle,
        lg: `[LG] ${baseTitle} - Amagezi G'Obusawo`,
        sw: `[SW] ${baseTitle} - Ushauri wa Ngozi`,
        fr: `[FR] ${baseTitle} - Conseils Cutan\xE9s`
      },
      summaryTranslations: {
        en: baseSummary,
        lg: `Ekiwandiiko ky'obusawo: ${baseSummary}`,
        sw: `Makala ya matibabu: ${baseSummary}`,
        fr: `R\xE9sum\xE9 m\xE9dical : ${baseSummary}`
      },
      fullTextTranslations: {
        en: baseBody,
        lg: `[LG - Ebiwandiiko mu Luganda]
${baseBody}

Okunoonyereza kulaga nti okukuuma olusu nga luliiko amazzi n'okwerinda enjuba kukuuma olusu mu mbeera ey'obulungi.`,
        sw: `[SW - Nakala ya Kiswahili]
${baseBody}

Tafiti za kliniki zinaonyesha kuwa kulinda ngozi na kudumisha unyevu huzuia magonjwa ya ngozi.`,
        fr: `[FR - Transcription en Fran\xE7ais]
${baseBody}

Les \xE9tudes cliniques montrent que la protection de la peau et le maintien de l'hydratation pr\xE9viennent les affections cutan\xE9es.`
      }
    }));
    alert("\u2728 Content successfully auto-translated into English, Luganda, Swahili, and Fran\xE7ais!");
  };
  const handleLibrarySubmit = (e) => {
    e.preventDefault();
    const primaryTitle = libForm.titleTranslations.en || libForm.title || "Untitled Skincare Resource";
    const primarySummary = libForm.summaryTranslations.en || "Verified clinical guidance.";
    const primaryBody = libForm.fullTextTranslations.en || primarySummary;
    const newItem = {
      id: `LIB-${libFormType.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      title: primaryTitle,
      titleTranslations: {
        en: libForm.titleTranslations.en || primaryTitle,
        lg: libForm.titleTranslations.lg || `[LG] ${primaryTitle}`,
        sw: libForm.titleTranslations.sw || `[SW] ${primaryTitle}`,
        fr: libForm.titleTranslations.fr || `[FR] ${primaryTitle}`
      },
      type: libFormType,
      category: libForm.category,
      description: primarySummary,
      summaryTranslations: {
        en: libForm.summaryTranslations.en || primarySummary,
        lg: libForm.summaryTranslations.lg || `Ekiwandiiko: ${primarySummary}`,
        sw: libForm.summaryTranslations.sw || `Makala: ${primarySummary}`,
        fr: libForm.summaryTranslations.fr || `Article : ${primarySummary}`
      },
      fullText: primaryBody,
      fullTextTranslations: {
        en: libForm.fullTextTranslations.en || primaryBody,
        lg: libForm.fullTextTranslations.lg || `[LG - Luganda] ${primaryBody}`,
        sw: libForm.fullTextTranslations.sw || `[SW - Kiswahili] ${primaryBody}`,
        fr: libForm.fullTextTranslations.fr || `[FR - Fran\xE7ais] ${primaryBody}`
      },
      url: libFormType === "article" ? void 0 : libForm.audioTracks[0]?.url || libForm.mediaUrl || "https://www.w3schools.com/html/mov_bbb.mp4",
      audioTracks: libFormType === "audio" && libForm.audioTracks.length > 0 ? libForm.audioTracks : void 0,
      coverImage: libForm.coverImage,
      photos: libForm.photos.length > 0 ? libForm.photos : [libForm.coverImage],
      author: libForm.author || user.name,
      thumbnail: libForm.coverImage,
      createdAt: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      duration: libForm.duration,
      likes: 1
    };
    onAddLibraryItem(newItem);
    alert(`Successfully published ${libFormType.toUpperCase()} content "${primaryTitle}" with attached multi-media and 4-language support!`);
    setLibraryMode("directory");
    setCommunitySubTab("explorer");
  };
  const handleProfileSave = (e) => {
    e.preventDefault();
    const updatedUser = {
      ...user,
      name: profForm.name,
      email: profForm.email,
      phone: profForm.phone,
      providerType: profForm.providerType,
      licensingAuthority: profForm.licensingAuthority,
      registrationNumber: profForm.registrationNumber,
      specialization: profForm.specialization,
      experience: profForm.experience,
      qualifications: profForm.qualifications,
      hospitalName: profForm.hospitalName,
      department: profForm.department,
      position: profForm.position,
      website: profForm.website,
      address: profForm.address,
      consultationType: profForm.consultationType,
      consultationHours: profForm.consultationHours,
      bio: profForm.bio
    };
    onUpdateUser(updatedUser);
    setShowEditProfile(false);
    alert("Full clinical registration profile updated successfully!");
  };
  const handleAdminChatSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!adminMsg.trim()) return;
    const msgText = adminMsg.trim();
    if (onSendSpecialistMessage) {
      onSendSpecialistMessage(user, msgText);
    }
    setAdminMsg("");
    setSpecialistSentToast({
      content: msgText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    setTimeout(() => setSpecialistSentToast(null), 5000);
  };
  const doctorNavTranslations = {
    en: {
      appTitle: "DERMA CARE PROVIDER",
      subTitle: "Clinical Specialist Desk",
      licenseLabel: "License:",
      logout: "Log Out",
      tabQueue: "Patient Queue",
      tabAppointments: "Appointments",
      tabLibrary: "Educational Library",
      tabCommunity: "Community & Help Desk",
      tabProfile: "Clinic Profile",
      queueHeader: "Active Medical Diagnoses Queue",
      queuePending: "Pending Actions",
      queueCleared: "Great job! Patient diagnostic queue is fully cleared.",
      completedReports: "Completed Diagnostic Reports",
      queueDemographics: "Queue Demographics",
      avgWait: "Average wait time:",
      allergyCases: "Allergy flare cases:",
      completedConsults: "Completed consultations:",
      appointmentsHeader: "Patient Teleconsultation Planner",
      appointmentsSub: "Approve patient-initiated appointments and manage active calendar slots.",
      declineBtn: "Decline",
      approveBtn: "Approve Slot",
      noAppointments: "No active appointments proposed by patients."
    },
    lg: {
      appTitle: "OMUGABA BUSAWO DERMA CARE",
      subTitle: "Ekirowoozo ky'Omuwandiisi n'Omusawo",
      licenseLabel: "Laysensi:",
      logout: "Vaamu / Log Out",
      tabQueue: "Olunyiriri lw'Abalwadde",
      tabAppointments: "Ebiro eby'Okulaba",
      tabLibrary: "Ettwale ly'Okusoma",
      tabCommunity: "Eby'Abalwadde n'Ekisawo",
      tabProfile: "Ebyafayo by'Edwaliro",
      queueHeader: "Olunyiriri lwa Abalwadde Abanfuna Obusawo",
      queuePending: "Bikyaganyibwa",
      queueCleared: "Webale nnyo! Olunyiriri lw'abalwadde luweddeko kyebajje.",
      completedReports: "Ebiwandiiko ebiwedde eby'Obusawo",
      queueDemographics: "Ebyafayo by'Olunyiriri",
      avgWait: "Esaawa y'okulinda:",
      allergyCases: "Abalwadde b'Alerigi:",
      completedConsults: "Okulaba okuweze:",
      appointmentsHeader: "Ebiro eby'Okulaba Omusawo mu Mikutu",
      appointmentsSub: "Kkiriza okulaba kw'abalwadde n'okutegeka esaawa z'omukutu.",
      declineBtn: "Ggana",
      approveBtn: "Kkiriza Esaawa",
      noAppointments: "Tewali kussanya kulaba abalwadde ku saawa zino."
    },
    sw: {
      appTitle: "MTOA HUDUMA WA DERMA CARE",
      subTitle: "Kituo cha Daktari Mtaalamu",
      licenseLabel: "Leseni:",
      logout: "Ondoka / Log Out",
      tabQueue: "Foleni ya Wagonjwa",
      tabAppointments: "Miadi ya Daktari",
      tabLibrary: "Maktaba ya Elimu",
      tabCommunity: "Jumuiya na Msaada",
      tabProfile: "Prfili ya Kituo",
      queueHeader: "Foleni ya Uchunguzi wa Wagonjwa",
      queuePending: "Hatua Zinazosubiri",
      queueCleared: "Kazi nzuri! Foleni ya uchunguzi wa wagonjwa imekamilika.",
      completedReports: "Ripoti za Uchunguzi Zilizokamilika",
      queueDemographics: "Demografia ya Foleni",
      avgWait: "Muda wa wastani wa kusubiri:",
      allergyCases: "Kesi za mzio wa ngozi:",
      completedConsults: "Ushauri uliokamilika:",
      appointmentsHeader: "Mipango ya Ushauri wa Simu",
      appointmentsSub: "Thibitisha miadi iliyoombwa na wagonjwa na udhibiti ratiba yako.",
      declineBtn: "Kataa",
      approveBtn: "Thibitisha Miadi",
      noAppointments: "Hakuna miadi iliyoombwa na wagonjwa kwa sasa."
    },
    fr: {
      appTitle: "PRESTATAIRE DERMA CARE",
      subTitle: "Bureau du Sp\xE9cialiste Clinique",
      licenseLabel: "Licence:",
      logout: "D\xE9connexion",
      tabQueue: "File de Patients",
      tabAppointments: "Rendez-vous",
      tabLibrary: "Biblioth\xE8que \xC9ducative",
      tabCommunity: "Communaut\xE9 & Assistance",
      tabProfile: "Profil de la Clinique",
      queueHeader: "File d'Attente des Diagnostics M\xE9dicaux",
      queuePending: "Actions en Attente",
      queueCleared: "Bravo ! La file de diagnostic des patients est compl\xE8tement trait\xE9e.",
      completedReports: "Rapports Diagnostic Compl\xE9t\xE9s",
      queueDemographics: "D\xE9mographie de la File",
      avgWait: "Temps d'attente moyen :",
      allergyCases: "Cas d'allergies cutan\xE9es :",
      completedConsults: "Consultations termin\xE9es :",
      appointmentsHeader: "Planning de T\xE9l\xE9consultation Patients",
      appointmentsSub: "Approuvez les rendez-vous initi\xE9s par les patients et g\xE9rez vos cr\xE9neaux.",
      declineBtn: "Refuser",
      approveBtn: "Approuver le Cr\xE9neau",
      noAppointments: "Aucun rendez-vous propos\xE9 par les patients pour le moment."
    }
  };
  const navT = doctorNavTranslations[currentLanguage] || doctorNavTranslations.en;
  const doctorCases = useMemo(() => {
    return (cases || []).filter((c) => {
      if (!c) return false;
      if (c.specialistId === user.id) return true;
      if (user.id === "doctor_sarah" && (c.specialistId === "SPEC-001" || c.specialistName?.includes("Sarah") || c.specialistName?.includes("Jenkins"))) return true;
      if ((user.id === "doctor_dennis" || user.id === "6998552854" || user.id === "9769776628" || user.email === "dennis@clinic.com") && (c.specialistId === "SPEC-002" || c.specialistId === "doctor_dennis" || c.specialistId === "6998552854" || c.specialistId === "9769776628" || c.specialistName?.includes("Dennis") || c.specialistName?.includes("Ssozi"))) return true;
      if (user.name && c.specialistName && (c.specialistName === user.name || c.specialistName.toLowerCase().includes(user.name.toLowerCase()))) return true;
      if (user.role === "specialist" && (!c.specialistId || c.specialistId === "doctor_sarah" || c.specialistId === "SPEC-001")) return true;
      return false;
    });
  }, [cases, user]);

  const pendingCases = useMemo(() => doctorCases.filter((c) => c.status === "Pending"), [doctorCases]);
  const diagnosedCases = useMemo(() => doctorCases.filter((c) => c.status === "Diagnosed"), [doctorCases]);

  const doctorAppointments = useMemo(() => {
    return (appointments || []).filter((app) => {
      if (!app) return false;
      if (app.specialistId === user.id) return true;
      if (user.id === "doctor_sarah" && (app.specialistId === "SPEC-001" || app.specialistName?.includes("Sarah") || app.specialistName?.includes("Jenkins"))) return true;
      if ((user.id === "doctor_dennis" || user.id === "6998552854" || user.id === "9769776628" || user.email === "dennis@clinic.com") && (app.specialistId === "SPEC-002" || app.specialistId === "doctor_dennis" || app.specialistId === "6998552854" || app.specialistId === "9769776628" || app.specialistName?.includes("Dennis") || app.specialistName?.includes("Ssozi"))) return true;
      if (user.name && app.specialistName && (app.specialistName === user.name || app.specialistName.toLowerCase().includes(user.name.toLowerCase()))) return true;
      if (user.hospitalName && app.providerName && (app.providerName.toLowerCase().includes(user.hospitalName.toLowerCase()) || user.hospitalName.toLowerCase().includes(app.providerName.toLowerCase()))) return true;
      if (user.clinicName && app.providerName && (app.providerName.toLowerCase().includes(user.clinicName.toLowerCase()) || user.clinicName.toLowerCase().includes(app.providerName.toLowerCase()))) return true;
      if (user.role === "specialist" && (!app.specialistId || app.specialistId === "doctor_sarah" || app.specialistId === "SPEC-001")) return true;
      return false;
    });
  }, [appointments, user]);

  const doctorTimeSlots = [
    "08:30 AM", "09:30 AM", "10:30 AM", "11:30 AM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"
  ];

  const doctorScheduleDays = useMemo(() => {
    const days = [];
    const now = new Date();
    const workingDays = user?.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
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
      const dayApps = doctorAppointments.filter((a) => a.date === ymd);
      days.push({
        ymd,
        dayShort,
        dayFull,
        dateNumber,
        monthShort,
        isOnDuty,
        isToday: i === 0,
        appsCount: dayApps.length,
        pendingCount: dayApps.filter((a) => a.status === "Pending").length,
        approvedCount: dayApps.filter((a) => a.status === "Accepted" || a.status === "Approved").length
      });
    }
    return days;
  }, [user, doctorAppointments]);

  const handleDoctorAcceptAppointment = (appId) => {
    const targetApp = doctorAppointments.find((a) => a.id === appId);
    if (onAcceptAppointment) {
      onAcceptAppointment(appId);
    } else if (onUpdateAppointment) {
      onUpdateAppointment({
        ...targetApp,
        status: "Accepted",
        confirmedAt: (/* @__PURE__ */ new Date()).toISOString(),
        patientReminders: targetApp?.patientReminders || { h12: true, h1: true, m30: true },
        specialistReminders: targetApp?.specialistReminders || { m30: true, m5: true }
      });
    }
    setAppointmentActionToast({
      message: `Appointment approved for ${targetApp?.patientName || "Patient"} on ${targetApp?.date || "selected date"} at ${targetApp?.time || "scheduled slot"}. Patient portal confirmed with automatic reminders.`,
      type: "success"
    });
    setTimeout(() => setAppointmentActionToast(null), 4500);
  };

  const handleDoctorDeclineAppointment = (appId) => {
    const targetApp = doctorAppointments.find((a) => a.id === appId);
    if (onDeclineAppointment) {
      onDeclineAppointment(appId);
    } else if (onUpdateAppointment) {
      onUpdateAppointment({ ...targetApp, status: "Declined" });
    }
    setAppointmentActionToast({
      message: `Appointment request for ${targetApp?.patientName || "Patient"} has been declined.`,
      type: "declined"
    });
    setTimeout(() => setAppointmentActionToast(null), 4500);
  };

  const handleDoctorCompleteAppointment = (appId, notes = "") => {
    const targetApp = doctorAppointments.find((a) => a.id === appId);
    if (onCompleteAppointment) {
      onCompleteAppointment(appId, notes);
    } else if (onUpdateAppointment) {
      onUpdateAppointment({
        ...targetApp,
        status: "Completed",
        isCompleted: true,
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        completionNotes: notes || "Consultation successfully completed."
      });
    }
    playNotificationChime();
    setAppointmentActionToast({
      message: `Consultation with ${targetApp?.patientName || "Patient"} marked as Completed ✓ and crossed off active schedule.`,
      type: "success"
    });
    setCompleteModalApp(null);
    setTimeout(() => setAppointmentActionToast(null), 4500);
  };

  const handleDoctorRescheduleAppointment = (appId, { reason, proposedDate, proposedTime }) => {
    const targetApp = doctorAppointments.find((a) => a.id === appId);
    if (onRescheduleAppointment) {
      onRescheduleAppointment(appId, { reason, proposedDate, proposedTime });
    } else if (onUpdateAppointment) {
      onUpdateAppointment({
        ...targetApp,
        status: "Rescheduled",
        isMissed: true,
        missedAt: (/* @__PURE__ */ new Date()).toISOString(),
        rescheduleReason: reason || "Specialist was called for urgent clinical duty.",
        proposedDate: proposedDate || targetApp.date,
        proposedTime: proposedTime || targetApp.time
      });
    }
    playNotificationChime();
    setAppointmentActionToast({
      message: `Consultation for ${targetApp?.patientName || "Patient"} marked as Missed. Sorry notice & reschedule request sent to patient portal.`,
      type: "rescheduled"
    });
    setRescheduleModalApp(null);
    setTimeout(() => setAppointmentActionToast(null), 5500);
  };

  const triggerSpecialistReminderPreview = (app, alertType = "30m") => {
    playNotificationChime();
    setSpecialistReminderToast({
      appointment: app,
      type: alertType,
      title: alertType === "5m" ? "🚨 URGENT REMINDER: 5 Minutes to Event" : "⏰ UPCOMING REMINDER: 30 Minutes to Event",
      message:
        alertType === "5m"
          ? `Your consultation with ${app.patientName} begins in 5 minutes (${app.time}, ${app.type}). Please verify your dermatoscope notes and prepare.`
          : `Consultation with ${app.patientName} is scheduled in 30 minutes at ${app.time} (${app.type}). Patient has been notified.`
    });
    setTimeout(() => setSpecialistReminderToast(null), 8000);
  };

  const handleSaveReminderSettings = (appId, updatedReminders, updatedPatientReminders) => {
    const targetApp = doctorAppointments.find((a) => a.id === appId);
    if (!targetApp) return;
    const updated = {
      ...targetApp,
      specialistReminders: updatedReminders || targetApp.specialistReminders,
      patientReminders: updatedPatientReminders || targetApp.patientReminders
    };
    if (onUpdateAppointment) {
      onUpdateAppointment(updated);
    }
    playNotificationChime();
    setAppointmentActionToast({
      message: `Reminder schedule adjusted for ${targetApp.patientName}'s consultation (${targetApp.time}).`,
      type: "success"
    });
    setEditingReminderApp(null);
    setTimeout(() => setAppointmentActionToast(null), 4500);
  };

  // Real-time listener: Notify specialist immediately when a patient submits a new booking request
  const previousPendingAppCountRef = useRef(
    doctorAppointments.filter((a) => a.status === "Pending").length
  );
  useEffect(() => {
    const currentPendingApps = doctorAppointments.filter((a) => a.status === "Pending");
    if (currentPendingApps.length > previousPendingAppCountRef.current) {
      const latestApp = currentPendingApps[0];
      if (latestApp) {
        playNotificationChime();
        setPendingBookingToast({
          appointment: latestApp,
          message: `New Consultation Request from ${latestApp.patientName} for ${latestApp.date} at ${latestApp.time} (${latestApp.type})!`
        });
        setTimeout(() => setPendingBookingToast(null), 10000);
      }
    }
    previousPendingAppCountRef.current = currentPendingApps.length;
  }, [doctorAppointments]);
  const specialistTabs = [
    { id: "queue", label: navT.tabQueue, icon: "queue_play_next", count: pendingCases.length, hint: "Triage patient cases" },
    { id: "appointments", label: navT.tabAppointments, icon: "event", count: doctorAppointments.filter((a) => a.status === "Pending").length, hint: "Telehealth slots" },
    { id: "library", label: navT.tabLibrary, icon: "library_add", hint: "Health articles & media" },
    { id: "community", label: navT.tabCommunity, icon: "forum", count: unreadAdminMsgCount, hint: "Specialist consultation & Help Desk" },
    { id: "profile", label: navT.tabProfile, icon: "contact_page", hint: "Clinic credentials" }
  ];
  return <div id="doctor_portal_root" className="min-h-screen text-slate-800 flex flex-col pb-20 md:pb-6 relative">
      {/* Real-time Admin Reply Notification Toast for Specialist */}
      {adminChatToast && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-blue-400/50 flex items-start gap-3 max-w-sm animate-fade-in ring-1 ring-blue-500/30">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md">
            <span className="material-symbols-outlined text-white text-xl">support_agent</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-blue-300">DERMA CARE Administration</h4>
              <span className="text-[10px] text-slate-400">{adminChatToast.time}</span>
            </div>
            <p className="text-xs text-slate-200 mt-1 line-clamp-2">{adminChatToast.content}</p>
            <button
              type="button"
              onClick={() => {
                setActiveTab("community");
                setAdminChatToast(null);
              }}
              className="mt-2 text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Open Help Desk Chat</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAdminChatToast(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Specialist Message Sent Confirmation Toast */}
      {specialistSentToast && (
        <div className="fixed top-20 left-4 sm:left-auto sm:right-4 z-50 bg-emerald-950/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-400/50 flex items-start gap-3 max-w-sm animate-fade-in ring-1 ring-emerald-500/30">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-md">
            <span className="material-symbols-outlined text-white text-lg">check_circle</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-emerald-300">Delivered to Administration</h4>
              <span className="text-[10px] text-emerald-400/80">{specialistSentToast.time}</span>
            </div>
            <p className="text-[11px] text-emerald-100/90 mt-0.5 line-clamp-2">
              {specialistSentToast.content}
            </p>
            <p className="text-[10px] text-emerald-300 font-medium mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Admin notified in real-time. Replies appear here.</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSpecialistSentToast(null)}
            className="text-emerald-300 hover:text-white p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Real-time Patient Booking Notification Toast for Specialist */}
      {pendingBookingToast && (
        <div className="fixed top-20 left-4 sm:left-auto sm:right-4 z-50 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-amber-400/60 flex items-start gap-3 max-w-md animate-fade-in ring-2 ring-amber-500/40">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
            <span className="material-symbols-outlined text-2xl font-bold">notification_important</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">New Patient Booking Request</h4>
              <span className="text-[10px] text-slate-400">{pendingBookingToast.appointment.time}</span>
            </div>
            <p className="text-xs text-white font-bold mt-1">
              {pendingBookingToast.appointment.patientName} requested a {pendingBookingToast.appointment.type === "Online" ? "🌐 Video" : "🏥 In-Person"} consultation for <span className="text-amber-200">{pendingBookingToast.appointment.date}</span> at <span className="text-amber-200">{pendingBookingToast.appointment.time}</span>.
            </p>
            {pendingBookingToast.appointment.symptoms && (
              <p className="text-[11px] text-slate-300 mt-1 line-clamp-1 italic bg-slate-800/80 p-1.5 rounded-lg border border-slate-700/60">
                "{pendingBookingToast.appointment.symptoms}"
              </p>
            )}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleDoctorAcceptAppointment(pendingBookingToast.appointment.id);
                  setPendingBookingToast(null);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-xs">check</span>
                <span>Approve & Confirm Slot</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("appointments");
                  setAppointmentFilter("pending");
                  setPendingBookingToast(null);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
              >
                Inspect Details
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingBookingToast(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Specialist Automated Reminder Notification Toast (30m / 5m alerts) */}
      {specialistReminderToast && (
        <div className="fixed top-20 left-4 sm:left-auto sm:right-4 z-50 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-blue-400/60 flex items-start gap-3 max-w-md animate-fade-in ring-2 ring-blue-500/40">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
            specialistReminderToast.type === "5m" ? "bg-rose-600 text-white animate-bounce" : "bg-blue-600 text-white"
          }`}>
            <span className="material-symbols-outlined text-2xl font-bold">
              {specialistReminderToast.type === "5m" ? "timer" : "alarm"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className={`text-xs font-black uppercase tracking-wider ${
                specialistReminderToast.type === "5m" ? "text-rose-300" : "text-blue-300"
              }`}>
                {specialistReminderToast.title}
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">Specialist Alert</span>
            </div>
            <p className="text-xs text-slate-100 font-semibold mt-1">
              {specialistReminderToast.message}
            </p>
            {specialistReminderToast.appointment.type === "Online" && (
              <button
                type="button"
                onClick={() => {
                  alert(`Opening telemedicine room for ${specialistReminderToast.appointment.patientName}...`);
                  setSpecialistReminderToast(null);
                }}
                className="mt-2 text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl inline-flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">videocam</span>
                <span>Open Telehealth Session</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSpecialistReminderToast(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className={`glass-dark-header text-white sticky top-0 z-40 transition-all duration-200 ${isScrolledDown ? "shadow-xl" : "shadow-md"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-400 font-bold text-3xl">medical_services</span>
            <div className="hidden sm:block landscape:block">
              <h1 className="hidden sm:block landscape:block font-display font-black text-sm tracking-widest uppercase">{navT.appTitle}</h1>
              <p className="hidden sm:block landscape:block text-[10px] text-blue-400 font-mono font-bold uppercase tracking-wider">{navT.subTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Admin Help Desk Chat Notification Bell for Specialist */}
            <button
              type="button"
              onClick={() => setActiveTab("community")}
              className={`relative p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                activeTab === "community"
                  ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60"
              }`}
              title="DERMA CARE Administration Help Desk & Messages"
            >
              <span className="material-symbols-outlined text-lg">support_agent</span>
              {unreadAdminMsgCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-sm">
                  {unreadAdminMsgCount}
                </span>
              )}
            </button>

            {/* Language Switcher Widget in Header with tactile feedback */}
            <div className="flex items-center gap-1 glass-dark-panel p-1 rounded-xl border border-white/10">
              {[
    { code: "en", flag: "\u{1F1FA}\u{1F1F8}", label: "EN" },
    { code: "lg", flag: "\u{1F1FA}\u{1F1EC}", label: "LG" },
    { code: "sw", flag: "\u{1F1F9}\u{1F1FF}", label: "SW" },
    { code: "fr", flag: "\u{1F1EB}\u{1F1F7}", label: "FR" }
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
    className={`px-2 py-1 text-[11px] font-bold rounded-md flex items-center gap-1 transition-all duration-150 ease-out transform hover:scale-105 active:scale-95 cursor-pointer ${currentLanguage === lang.code ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/40" : "text-slate-300 hover:text-white hover:bg-slate-700/90"}`}
    title={lang.label}
  >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>)}
            </div>

            <div className="text-right hidden sm:block">
              <span className="block text-xs font-bold text-slate-200">{user.name}</span>
              <span className="block text-[10px] text-slate-400 font-mono">{navT.licenseLabel} {user.registrationNumber || "MED-UG-88492"}</span>
            </div>
            <button
    onClick={onLogout}
    className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 border border-slate-700 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 hover:border-slate-600 transition-all duration-150 ease-out transform hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
  >
              <span className="material-symbols-outlined text-sm">logout</span> {navT.logout}
            </button>
          </div>
        </div>
      </header>

      {/* Specialist Menu Tabs Wrapper (div:nth-of-type(1) under doctor_portal_root) */}
      <div
        id="doctor_nav_wrapper"
        onWheel={isolateScroll}
        className={`transition-all duration-300 overscroll-contain tabs-scroll-isolated ${isLeftOrientation ? `fixed left-4 lg:left-6 top-20 z-40 w-64 lg:w-72 glass-panel-elevated rounded-2xl p-3 flex flex-col gap-2 ${isScrolledDown ? "shadow-2xl" : "shadow-xl"}` : `sticky top-16 z-30 glass-nav-tabs border-b transition-all duration-200 ${isScrolledDown ? "shadow-md" : "shadow-xs"}`}`}
      >
        {/* If in Narrow View & Portrait and Scrolled Down: Show Dropdown Trigger Header */}
        {!isLeftOrientation && isDropdownMode && <header className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            {/* Active Tab indicator chip on left */}
            <div
              onClick={() => setIsNavDropdownOpen(!isNavDropdownOpen)}
              className="flex items-center gap-2.5 cursor-pointer select-none group"
            >
              <div className="w-8 h-8 rounded-xl glass-button-primary text-white flex items-center justify-center shadow-xs ring-2 ring-[#315B7D] ring-offset-1 ring-offset-white shadow-[0_2px_10px_rgba(49,91,125,0.3)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-base">
                  {specialistTabs.find((t2) => t2.id === activeTab)?.icon || "queue_play_next"}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs text-slate-900">
                    {specialistTabs.find((t2) => t2.id === activeTab)?.label || "Patient Queue"}
                  </span>
                  {(() => {
                    const currentTabMeta = specialistTabs.find((t2) => t2.id === activeTab);
                    return typeof currentTabMeta?.count === "number" && currentTabMeta.count > 0 ? (
                      <span className="px-1.5 py-0.2 text-[9px] rounded-full font-bold glass-badge-amber">
                        {currentTabMeta.count}
                      </span>
                    ) : null;
                  })()}
                </div>
                <span className="text-[10px] text-slate-400 block font-medium">Scrolled view • Tap to change</span>
              </div>
            </div>

            {/* Dropdown toggle button on right with animated chevron */}
            <div className="flex items-center gap-2">
              <button
                id="doctor_dropdown_toggle"
                type="button"
                onClick={() => setIsNavDropdownOpen(!isNavDropdownOpen)}
                className="px-3.5 py-1.5 glass-button-secondary text-blue-700 font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                <span>Change Tab</span>
                <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${isNavDropdownOpen ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>

              {/* Pin/Unpin Bar button */}
              <button
                type="button"
                onClick={() => setManualDropdownOverride(manualDropdownOverride === "bar" ? "auto" : "bar")}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white/40 rounded-lg text-xs cursor-pointer"
                title={manualDropdownOverride === "bar" ? "Auto dropdown on scroll" : "Pin full horizontal bar"}
              >
                <span className="material-symbols-outlined text-sm">view_week</span>
              </button>
            </div>
          </header>}

        {/* Inner Tabs Container */}
        <div
          id="doctor_tabs_inner"
          onWheel={handleHorizontalWheel}
          className={`overscroll-contain tabs-scroll-isolated tabs-horizontal-scroll ${isLeftOrientation ? "flex flex-col gap-1.5 w-full" : isDropdownMode ? `absolute top-full left-4 sm:left-6 mt-1.5 w-72 sm:w-80 glass-panel-elevated rounded-2xl shadow-2xl p-2 flex flex-col gap-1.5 z-50 transition-all duration-200 ${isNavDropdownOpen ? "opacity-100 visible scale-100 translate-y-0" : "opacity-0 invisible pointer-events-none -translate-y-2 scale-95"}` : "w-full max-w-7xl mx-auto px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 flex sm:grid sm:grid-cols-5 items-stretch gap-1.5 sm:gap-2 md:gap-3 overflow-x-auto sm:overflow-visible overscroll-x-contain scrollbar-none"}`}
        >
          {specialistTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`doctor_tab_${tab.id}`}
                type="button"
                title={tab.label}
                aria-label={tab.label}
                aria-selected={isActive}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsNavDropdownOpen(false);
                }}
                className={
                  isLeftOrientation || isDropdownMode
                    ? `w-full text-left py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-between transition-all duration-150 ease-out transform hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-95 group cursor-pointer select-none ${
                        isActive
                          ? tab.id === "queue"
                            ? "glass-button-primary shadow-[0_4px_18px_rgba(49,91,125,0.4),0_0_16px_rgba(16,185,129,0.3)] ring-2 ring-emerald-400 ring-offset-1 ring-offset-white border-l-4 border-l-emerald-300 font-extrabold"
                            : "glass-button-primary shadow-[0_4px_16px_rgba(49,91,125,0.35),0_0_12px_rgba(49,91,125,0.2)] ring-2 ring-[#315B7D] ring-offset-1 ring-offset-white border-l-4 border-l-amber-300 font-extrabold"
                          : tab.id === "queue"
                          ? "glass-button-secondary text-slate-700 hover:text-emerald-700 border border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-50/30"
                          : "glass-button-secondary text-slate-700 hover:text-blue-700 border border-[rgba(70,90,110,0.14)]"
                      }`
                    : `w-full min-w-0 py-2 sm:py-2.5 px-1 sm:px-2 md:px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-200 ease-out transform hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-95 group relative cursor-pointer select-none ${
                        isActive
                          ? tab.id === "queue"
                            ? "glass-button-primary shadow-[0_4px_20px_rgba(49,91,125,0.42),0_0_16px_rgba(52,211,153,0.35)] ring-2 ring-emerald-400 ring-offset-2 ring-offset-white/95 border border-emerald-400/40 font-extrabold"
                            : "glass-button-primary shadow-[0_4px_18px_rgba(49,91,125,0.36),0_0_14px_rgba(49,91,125,0.24)] ring-2 ring-[#315B7D] ring-offset-2 ring-offset-white/90 border border-[#24465F]/30 font-extrabold"
                          : tab.id === "queue"
                          ? "glass-button-secondary text-slate-700 hover:text-emerald-700 border border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-50/20"
                          : "glass-button-secondary text-slate-700 hover:text-blue-700 border border-[rgba(70,90,110,0.14)] hover:border-[#315B7D]/30"
                      }`
                }
              >
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0 truncate">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 transition-transform duration-150 ease-out group-hover:scale-110 ${
                      isActive
                        ? tab.id === "queue"
                          ? "bg-emerald-400/30 text-white shadow-inner ring-1 ring-white/30"
                          : "bg-white/25 text-white shadow-inner"
                        : tab.id === "queue"
                        ? "bg-emerald-600/10 text-emerald-700 shadow-xs"
                        : "bg-blue-600/10 text-blue-600 shadow-xs"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{tab.icon}</span>
                  </div>
                  {/* Tab label: hidden in narrow portrait view (icons-only), visible in phone landscape and tablet portrait view */}
                  <div className={`min-w-0 truncate flex items-center gap-1.5 ${!isLeftOrientation && !isDropdownMode ? "hidden landscape:flex md:flex" : ""}`}>
                    {tab.id === "queue" && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isActive ? "bg-emerald-300" : "bg-emerald-400"}`} />
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? "bg-white" : "bg-emerald-500"}`} />
                      </span>
                    )}
                    <div>
                      <span className={`text-[11px] sm:text-xs truncate block ${isActive ? "font-extrabold" : "font-bold"}`}>
                        {tab.label}
                      </span>
                      {(isLeftOrientation || isDropdownMode) && (
                        <span className={`text-[10px] block truncate font-medium ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                          {tab.hint}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Badge count: on narrow portrait positioned at top-right corner to preserve center alignment; in landscape & tablet inline */}
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span
                    className={`rounded-full font-bold transition-colors shrink-0 ${
                      !isLeftOrientation && !isDropdownMode
                        ? "absolute top-1 right-1 landscape:static md:static px-1.5 py-0.2 text-[9px] sm:text-[10px]"
                        : "px-1.5 py-0.2 text-[10px]"
                    } ${isActive ? "bg-white text-blue-700 shadow-2xs ring-1 ring-white/50" : "bg-amber-100 text-amber-800"}`}
                  >
                    {tab.count}
                  </span>
                )}
                {(isLeftOrientation || isDropdownMode) && isActive && (
                  <span className="material-symbols-outlined text-sm text-white shrink-0">check_circle</span>
                )}

                {/* Floating Tooltip: word label appears when cursor is on top of icon in narrow portrait view */}
                {!isLeftOrientation && !isDropdownMode && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute -bottom-9.5 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap px-2.5 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-lg shadow-xl border border-slate-700/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-hover:translate-y-0.5 transition-all duration-150 ease-out flex items-center gap-1 landscape:hidden md:hidden"
                  >
                    <span>{tab.label}</span>
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-t border-l border-slate-700/80" />
                  </div>
                )}

                {/* Subtle active indicator accent line under selected tab */}
                {!isLeftOrientation && !isDropdownMode && (
                  <span
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-300 ease-out pointer-events-none ${
                      isActive
                        ? "w-8 bg-[#315B7D] shadow-[0_0_8px_rgba(49,91,125,0.6)] opacity-100"
                        : "w-0 opacity-0 group-hover:w-3 group-hover:bg-[#315B7D]/40"
                    }`}
                    aria-hidden="true"
                  />
                )}

                {/* Active indicator bar for icon-only narrow portrait view */}
                {!isLeftOrientation && !isDropdownMode && (
                  <span
                    className={`landscape:hidden md:hidden absolute bottom-0.5 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full transition-all duration-300 ease-out ${
                      isActive ? "w-4 bg-white shadow-xs opacity-100" : "w-0 opacity-0 group-hover:w-2 group-hover:bg-blue-400"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <main
    ref={mainRef}
    id="doctor_main_content"
    className={`flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 transition-all duration-300 relative ${isLeftOrientation ? "lg:ml-72 xl:ml-80 lg:max-w-[calc(100%-19rem)] xl:max-w-[calc(100%-21rem)]" : ""}`}
  >
        {
    /* Slim, subtle scroll progress bar indicating view scroll position */
  }
        <div
    id="doctor_view_scroll_progress"
    className={`sticky ${!isLeftOrientation && isDropdownMode ? "top-[112px]" : "top-16"} -mt-6 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 z-20 bg-[#f8fafc]/95 backdrop-blur-md transition-all duration-200 ${isScrolledDown ? "border-b border-slate-200/90 shadow-md shadow-slate-900/5" : "border-b border-transparent shadow-none"}`}
    role="progressbar"
    aria-valuenow={Math.round(scrollProgress)}
    aria-valuemin={0}
    aria-valuemax={100}
    title={`View scroll: ${Math.round(scrollProgress)}%`}
  >
          <div className="h-[3px] w-full bg-emerald-950/10 overflow-hidden">
            <div
    id="doctor_scroll_progress_bar"
    className="h-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 transition-[width] duration-150 ease-out rounded-r-full shadow-xs shadow-emerald-500/30"
    style={{ width: `${scrollProgress}%` }}
  />
          </div>
        </div>
        
        {
    /* ======================= TAB 1: PATIENT QUEUE ======================= */
  }
        {activeTab === "queue" && <div id="doctor_queue_tab" className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {
    /* Left Patient lists */
  }
              <div className="md:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-display font-extrabold text-base text-slate-900">{navT.queueHeader}</h3>
                  <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full">{pendingCases.length} {navT.queuePending}</span>
                </div>

                {pendingCases.length === 0 && <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
                    <span className="material-symbols-outlined text-slate-400 text-4xl">check_circle</span>
                    <p className="text-xs font-bold text-slate-600">{navT.queueCleared}</p>
                  </div>}

                <div className="grid grid-cols-1 gap-4">
                  {pendingCases.map((item) => <div
    key={item.id}
    onClick={() => {
      setSelectedCase(item);
      setAiAnalysisResult("");
    }}
    className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-600 cursor-pointer shadow-sm flex gap-4 items-center"
  >
                      <img src={item.mediaUrl} alt="Patient Skin Concern" className="w-16 h-16 rounded-xl object-cover border border-slate-100 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-bold text-slate-900 truncate">{item.patientName}</span>
                          <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-100 uppercase">Case #{item.id}</span>
                        </div>
                        <p className="text-xs text-slate-600 truncate mt-1">"{item.symptoms}"</p>
                        <span className="text-[10px] text-slate-400 block mt-2 font-mono">Date submitted: {item.createdAt}</span>
                      </div>
                    </div>)}
                </div>

                {
    /* Historics Diagnosed */
  }
                {diagnosedCases.length > 0 && <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black tracking-widest uppercase text-slate-500">Completed Diagnostic Reports</h4>
                      <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Export official PDF records</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {diagnosedCases.map((item) => <div
    key={item.id}
    id={`diagnosed_case_${item.id}`}
    onClick={() => {
      setSelectedCase(item);
      setAiAnalysisResult(item.aiTriageSummary || "");
    }}
    className="p-3.5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 hover:border-blue-400 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
  >
                          <div className="flex items-center gap-3 min-w-0">
                            {item.mediaUrl ? <img
    src={item.mediaUrl}
    alt="Lesion thumbnail"
    className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0"
  /> : <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                                <span className="material-symbols-outlined text-xl">dermatology</span>
                              </div>}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm">{item.patientName}</span>
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200 uppercase">
                                  Diagnosed
                                </span>
                              </div>
                              <p className="text-slate-600 truncate text-xs mt-0.5">
                                <strong className="text-slate-700">Diagnosis:</strong> {item.diagnosisReport?.diagnosedCondition || "Clinical Assessment Available"}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                Case #{item.id} • Patient ID: {item.patientNumber || item.patientId}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
    id={`btn_download_pdf_${item.id}`}
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      handleDownloadReportPDF(item);
    }}
    disabled={exportingCaseId === item.id}
    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:bg-slate-300"
    title="Download Branded Clinical Diagnostic PDF"
  >
                              <span className="material-symbols-outlined text-sm">
                                {exportingCaseId === item.id ? "hourglass_empty" : "picture_as_pdf"}
                              </span>
                              <span>
                                {exportingCaseId === item.id ? "Exporting..." : "Download PDF Report"}
                              </span>
                            </button>

                            <button
    type="button"
    onClick={() => {
      setSelectedCase(item);
      setAiAnalysisResult(item.aiTriageSummary || "");
    }}
    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
    title="View Full Dossier"
  >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                            </button>
                          </div>
                        </div>)}
                    </div>
                  </div>}
              </div>

              {
    /* Patient statistics / Quick insights summary */
  }
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-1.5 border-b pb-2">
                    <span className="material-symbols-outlined text-blue-600 text-xl font-bold">query_stats</span>
                    Queue Demographics
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Average wait time:</span>
                      <span className="font-bold text-slate-800">14 minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Allergy flare cases:</span>
                      <span className="font-bold text-slate-800">58%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Completed consultations:</span>
                      <span className="font-bold text-blue-600">{diagnosedCases.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>}

        {
    /* ======================= TAB 2: APPOINTMENTS ======================= */
  }
        {activeTab === "appointments" && (
          <div id="doctor_appointments_tab" className="space-y-6 animate-fade-in">
            {/* Header & Quick Action Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
              <div>
                <h2 className="font-display font-extrabold text-xl text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-2xl">calendar_month</span>
                  Patient Appointments & Timetable Planner
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Review patient-submitted lesion photos, approve requested booking slots, and manage your daily availability calendar.
                </p>
              </div>

              {/* Status Counters */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                  doctorAppointments.filter((a) => a.status === "Pending").length > 0
                    ? "bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-300/30 animate-pulse"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}>
                  <span className="material-symbols-outlined text-sm">hourglass_top</span>
                  {doctorAppointments.filter((a) => a.status === "Pending").length} Waiting Approval
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  {doctorAppointments.filter((a) => a.status === "Accepted" || a.status === "Approved").length} Confirmed
                </span>
              </div>
            </div>

            {/* Sub-Navigation Mode Switcher */}
            <div
              className="flex rounded-2xl bg-slate-100 p-1.5 text-xs font-bold gap-1 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll scrollbar-thin"
              onWheel={handleHorizontalWheel}
            >
              <button
                type="button"
                onClick={() => setAppointmentFilter("pending")}
                className={`py-2 px-4 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  appointmentFilter === "pending"
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <span className="material-symbols-outlined text-base">hourglass_top</span>
                <span>Pending Approvals</span>
                {doctorAppointments.filter((a) => a.status === "Pending").length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                    {doctorAppointments.filter((a) => a.status === "Pending").length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setAppointmentFilter("events_db")}
                className={`py-2 px-4 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  appointmentFilter === "events_db"
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <span className="material-symbols-outlined text-base">table_chart</span>
                <span>Events Database & Agenda</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
                  {doctorAppointments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAppointmentFilter("timetable")}
                className={`py-2 px-4 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  appointmentFilter === "timetable"
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <span className="material-symbols-outlined text-base">schedule</span>
                <span>Doctor Timetable & Schedule</span>
                <span className="text-[10px] font-mono text-slate-400">({selectedScheduleDate})</span>
              </button>

              <button
                type="button"
                onClick={() => setAppointmentFilter("approved")}
                className={`py-2 px-4 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  appointmentFilter === "approved"
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <span className="material-symbols-outlined text-base">verified</span>
                <span>Confirmed Consultations</span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({doctorAppointments.filter((a) => a.status === "Accepted" || a.status === "Approved").length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAppointmentFilter("all")}
                className={`py-2 px-4 rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  appointmentFilter === "all"
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <span className="material-symbols-outlined text-base">format_list_bulleted</span>
                <span>All ({doctorAppointments.length})</span>
              </button>
            </div>

            {/* ================= VIEW 0: CLINICAL EVENTS DATABASE & AGENDA ================= */}
            {appointmentFilter === "events_db" && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                  <div>
                    <h3 className="font-display font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-600">database</span>
                      Specialist Clinical Events Database & Timetable Tracker
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Unified clinical timetable: Tick done (✓) when completed, cross & reschedule (✗) when missed with automated patient apologies, and adjust 30m / 5m alerts.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAppointmentFilter("timetable")}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span>Switch to Visual Timetable</span>
                    </button>
                  </div>
                </div>

                {/* Database Search & Status Filter Ribbon */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                      search
                    </span>
                    <input
                      type="text"
                      value={eventsSearchQuery}
                      onChange={(e) => setEventsSearchQuery(e.target.value)}
                      placeholder="Search by patient name, phone, condition, or date..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
                    />
                    {eventsSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setEventsSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                  </div>

                  {/* Status Pills Filter */}
                  <div
                    className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll pb-1 scrollbar-thin"
                    onWheel={handleHorizontalWheel}
                  >
                    {[
                      { id: "all", label: "All Events", count: doctorAppointments.length },
                      { id: "pending", label: "Waiting Approval", count: doctorAppointments.filter((a) => a.status === "Pending").length },
                      { id: "confirmed", label: "Confirmed", count: doctorAppointments.filter((a) => a.status === "Accepted" || a.status === "Approved").length },
                      { id: "completed", label: "Completed ✓", count: doctorAppointments.filter((a) => a.status === "Completed" || a.isCompleted).length },
                      { id: "rescheduled", label: "Missed / Rescheduled ✗", count: doctorAppointments.filter((a) => a.status === "Rescheduled" || a.isMissed).length }
                    ].map((st) => {
                      const isActive = eventsStatusFilter === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setEventsStatusFilter(st.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                            isActive
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                          }`}
                        >
                          <span>{st.label}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                            isActive ? "bg-white/20 text-white" : "bg-white text-slate-700 shadow-2xs"
                          }`}>
                            {st.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Events Database Table */}
                {(() => {
                  const q = eventsSearchQuery.trim().toLowerCase();
                  const filteredEvents = doctorAppointments.filter((app) => {
                    if (eventsStatusFilter === "pending" && app.status !== "Pending") return false;
                    if (eventsStatusFilter === "confirmed" && app.status !== "Accepted" && app.status !== "Approved") return false;
                    if (eventsStatusFilter === "completed" && app.status !== "Completed" && !app.isCompleted) return false;
                    if (eventsStatusFilter === "rescheduled" && app.status !== "Rescheduled" && !app.isMissed) return false;
                    if (!q) return true;
                    return (
                      (app.patientName && app.patientName.toLowerCase().includes(q)) ||
                      (app.patientPhone && app.patientPhone.includes(q)) ||
                      (app.date && app.date.includes(q)) ||
                      (app.time && app.time.toLowerCase().includes(q)) ||
                      (app.condition && app.condition.toLowerCase().includes(q)) ||
                      (app.symptoms && app.symptoms.toLowerCase().includes(q))
                    );
                  });

                  if (filteredEvents.length === 0) {
                    return (
                      <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                        <span className="material-symbols-outlined text-3xl text-slate-400">event_busy</span>
                        <h4 className="text-sm font-bold text-slate-800">No Events Matching Current Filter</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Try adjusting your search query or status filter to see scheduled patient consultations.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Event Date & Time</th>
                            <th className="py-3 px-4">Patient / Contact</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Reminders (30m & 5m)</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Event Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredEvents.map((app) => {
                            const isPending = app.status === "Pending";
                            const isApproved = app.status === "Accepted" || app.status === "Approved";
                            const isCompleted = app.status === "Completed" || app.isCompleted;
                            const isMissed = app.status === "Rescheduled" || app.isMissed;
                            const specR = app.specialistReminders || { m30: true, m5: true };

                            return (
                              <tr
                                key={app.id}
                                className={`transition-colors ${
                                  isCompleted
                                    ? "bg-slate-50/60 text-slate-600"
                                    : isMissed
                                    ? "bg-rose-50/30"
                                    : isPending
                                    ? "bg-amber-50/30"
                                    : "hover:bg-blue-50/30"
                                }`}
                              >
                                {/* Column 1: Date & Time */}
                                <td className="py-3.5 px-4 font-mono font-medium">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                    <span className="material-symbols-outlined text-sm text-blue-600">calendar_today</span>
                                    <span>{app.date}</span>
                                  </div>
                                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-1">
                                    ⏰ {app.time}
                                  </span>
                                </td>

                                {/* Column 2: Patient Info */}
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-2.5">
                                    {app.lesionImage ? (
                                      <div
                                        onClick={() => setPreviewLesionPhoto(app.lesionImage)}
                                        className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all shadow-2xs"
                                        title="Click to zoom in on clinical lesion photo"
                                      >
                                        <img
                                          src={app.lesionImage}
                                          alt="Lesion"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                                        {app.patientName ? app.patientName.charAt(0) : "P"}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <h5 className="font-extrabold text-slate-900 text-xs truncate max-w-[160px]">
                                        {app.patientName}
                                      </h5>
                                      <span className="text-[10px] text-slate-500 font-mono block">
                                        📞 {app.patientPhone || "+256..."}
                                      </span>
                                      {app.symptoms && (
                                        <span className="text-[10px] text-slate-500 italic block truncate max-w-[170px]" title={app.symptoms}>
                                          "{app.symptoms}"
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Column 3: Consultation Type */}
                                <td className="py-3.5 px-4">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                    app.type === "Online"
                                      ? "bg-sky-50 text-sky-800 border border-sky-200"
                                      : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                  }`}>
                                    <span className="material-symbols-outlined text-xs">
                                      {app.type === "Online" ? "videocam" : "apartment"}
                                    </span>
                                    <span>{app.type === "Online" ? "Online Video" : "In-Person"}</span>
                                  </span>
                                </td>

                                {/* Column 4: Reminders Configuration */}
                                <td className="py-3.5 px-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          specR.m30 ? "bg-blue-100 text-blue-800 border border-blue-200" : "bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title="Specialist 30 minutes before alert"
                                      >
                                        ⏰ 30m
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          specR.m5 ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-slate-100 text-slate-400 line-through"
                                        }`}
                                        title="Specialist 5 minutes urgent alert"
                                      >
                                        🚨 5m
                                      </span>
                                      <span
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        title="Patient automatic 12h, 1h & 30m notices"
                                      >
                                        👤 12h/1h/30m
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditingReminderApp(app)}
                                        className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline flex items-center gap-0.5 cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[11px]">tune</span>
                                        <span>Adjust Alerts</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => triggerSpecialistReminderPreview(app, "30m")}
                                        className="text-[10px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-0.5 cursor-pointer"
                                        title="Test audio chime & notification preview"
                                      >
                                        <span className="material-symbols-outlined text-[11px]">volume_up</span>
                                        <span>Test</span>
                                      </button>
                                    </div>
                                  </div>
                                </td>

                                {/* Column 5: Status Badge */}
                                <td className="py-3.5 px-4">
                                  {isPending && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                      Waiting Approval
                                    </span>
                                  )}
                                  {isApproved && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-300">
                                      <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                                      Confirmed
                                    </span>
                                  )}
                                  {isCompleted && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-200 text-slate-800 border border-slate-300">
                                      <span className="material-symbols-outlined text-xs text-emerald-600">task_alt</span>
                                      Done ✓
                                    </span>
                                  )}
                                  {isMissed && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-800 border border-rose-300">
                                      <span className="material-symbols-outlined text-xs text-rose-600">cancel</span>
                                      Missed / Reschedule
                                    </span>
                                  )}
                                </td>

                                {/* Column 6: Action Buttons */}
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {isPending && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleDoctorDeclineAppointment(app.id)}
                                          className="px-2.5 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold rounded-lg cursor-pointer"
                                        >
                                          Decline
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDoctorAcceptAppointment(app.id)}
                                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                                        >
                                          <span className="material-symbols-outlined text-xs">check</span>
                                          <span>Approve Slot</span>
                                        </button>
                                      </>
                                    )}

                                    {isApproved && (
                                      <>
                                        {/* Tick Event When Done (✓) */}
                                        <button
                                          type="button"
                                          onClick={() => setCompleteModalApp(app)}
                                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                          title="Mark consultation done / completed (✓)"
                                        >
                                          <span className="material-symbols-outlined text-sm font-black">check</span>
                                          <span>Done ✓</span>
                                        </button>

                                        {/* Cross Event When Missed & Reschedule (✗) */}
                                        <button
                                          type="button"
                                          onClick={() => setRescheduleModalApp(app)}
                                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                                          title="Mark missed & send sorry reschedule notice to patient (✗)"
                                        >
                                          <span className="material-symbols-outlined text-sm font-black">close</span>
                                          <span>Missed ✗</span>
                                        </button>

                                        {app.type === "Online" && (
                                          <button
                                            type="button"
                                            onClick={() => alert(`Launching telehealth consultation video with ${app.patientName}...`)}
                                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl cursor-pointer"
                                            title="Launch Video Room"
                                          >
                                            <span className="material-symbols-outlined text-xs">videocam</span>
                                          </button>
                                        )}
                                      </>
                                    )}

                                    {isCompleted && (
                                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                        <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                                        <span>Archived ✓</span>
                                        {app.completionNotes && (
                                          <button
                                            type="button"
                                            onClick={() => alert(`Consultation outcome notes: \n\n"${app.completionNotes}"`)}
                                            className="ml-1 text-blue-600 hover:underline font-bold"
                                          >
                                            Notes
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {isMissed && (
                                      <button
                                        type="button"
                                        onClick={() => setRescheduleModalApp(app)}
                                        className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 flex items-center gap-1 cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-xs">edit_calendar</span>
                                        <span>Update Reschedule</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ================= VIEW 1: INTERACTIVE TIMETABLE & CALENDAR ================= */}
            {appointmentFilter === "timetable" && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div>
                    <h3 className="font-display font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-600">view_timeline</span>
                      Interactive Daily Timetable & Availability
                    </h3>
                    <p className="text-xs text-slate-500">
                      Select any date to inspect booked consults, incoming patient requests, and open slots.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Free Slot
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending Approval
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Confirmed
                    </span>
                  </div>
                </div>

                {/* 14-Day Calendar Ribbon */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Select Consultation Date (Next 14 Days):
                  </span>
                  <div
                    className="flex gap-2 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll pb-2 scrollbar-thin"
                    onWheel={handleHorizontalWheel}
                  >
                    {doctorScheduleDays.map((day) => {
                      const isSelected = selectedScheduleDate === day.ymd;
                      return (
                        <button
                          key={day.ymd}
                          type="button"
                          onClick={() => setSelectedScheduleDate(day.ymd)}
                          className={`min-w-[80px] p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between shrink-0 relative ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-600/30 shadow-md font-bold"
                              : day.isOnDuty
                              ? "bg-slate-50 border-slate-200 hover:border-blue-400 text-slate-700 hover:bg-blue-50/50"
                              : "bg-slate-100/70 border-slate-200 text-slate-400 opacity-60"
                          }`}
                        >
                          <span className={`text-[10px] uppercase font-extrabold ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                            {day.dayShort}
                          </span>
                          <span className="text-base font-black my-0.5">
                            {day.dateNumber}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : day.isOnDuty
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}>
                            {day.isOnDuty ? "Open" : "Off"}
                          </span>

                          {/* Indicator dot if appointments exist for that day */}
                          {day.pendingCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
                              {day.pendingCount}
                            </span>
                          )}
                          {day.approvedCount > 0 && day.pendingCount === 0 && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-xs" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Day Timetable Matrix */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
                    <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-blue-600 text-base">today</span>
                      Timetable Slots for {selectedScheduleDate}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Operating Hours: {user.consultationHours || "08:30 AM - 05:00 PM"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {doctorTimeSlots.map((slot) => {
                      const matchedApp = doctorAppointments.find(
                        (a) => a.date === selectedScheduleDate && a.time === slot && a.status !== "Declined"
                      );
                      const isPending = matchedApp && matchedApp.status === "Pending";
                      const isApproved = matchedApp && (matchedApp.status === "Accepted" || matchedApp.status === "Approved");
                      const isReserved = reservedDoctorSlots[`${selectedScheduleDate}_${slot}`];

                      if (isPending) {
                        return (
                          <div
                            key={slot}
                            className="p-3.5 rounded-2xl border-2 border-amber-300 bg-amber-50/70 shadow-xs flex flex-col justify-between space-y-3 relative group"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-xs font-black text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-lg">
                                  ⏰ {slot}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                                  Approval Needed
                                </span>
                              </div>

                              <div className="flex items-start gap-2.5 mt-2">
                                {matchedApp.lesionImage && (
                                  <div
                                    onClick={() => setPreviewLesionPhoto(matchedApp.lesionImage)}
                                    className="w-11 h-11 rounded-xl overflow-hidden border border-amber-300 shrink-0 cursor-pointer relative group/img shadow-2xs"
                                    title="Click to inspect patient lesion"
                                  >
                                    <img
                                      src={matchedApp.lesionImage}
                                      alt="Patient Lesion"
                                      className="w-full h-full object-cover group-hover/img:scale-110 transition-transform"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                      <span className="material-symbols-outlined text-xs">zoom_in</span>
                                    </div>
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-extrabold text-slate-900 text-xs truncate">
                                    {matchedApp.patientName}
                                  </h4>
                                  <span className="text-[10px] text-slate-600 font-mono block">
                                    {matchedApp.patientPhone || "+256..."}
                                  </span>
                                  <span className="text-[10px] text-blue-700 font-bold block mt-0.5">
                                    {matchedApp.type === "Online" ? "🌐 Video Consult" : "🏥 In-Person"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Approval Action Buttons */}
                            <div className="flex items-center gap-1.5 pt-2 border-t border-amber-200/60">
                              <button
                                type="button"
                                onClick={() => handleDoctorDeclineAppointment(matchedApp.id)}
                                className="px-2.5 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDoctorAcceptAppointment(matchedApp.id)}
                                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] font-bold rounded-lg shadow-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">check</span>
                                Approve Slot
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (isApproved) {
                        return (
                          <div
                            key={slot}
                            className="p-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 shadow-xs flex flex-col justify-between space-y-3"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-xs font-black text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-lg">
                                  ⏰ {slot}
                                </span>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs text-emerald-700">check_circle</span>
                                  Confirmed
                                </span>
                              </div>

                              <div className="flex items-start gap-2.5 mt-2">
                                {matchedApp.lesionImage && (
                                  <div
                                    onClick={() => setPreviewLesionPhoto(matchedApp.lesionImage)}
                                    className="w-11 h-11 rounded-xl overflow-hidden border border-emerald-300 shrink-0 cursor-pointer shadow-2xs"
                                    title="Click to view lesion"
                                  >
                                    <img
                                      src={matchedApp.lesionImage}
                                      alt="Patient Lesion"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-extrabold text-slate-900 text-xs truncate">
                                    {matchedApp.patientName}
                                  </h4>
                                  <span className="text-[10px] text-slate-600 font-mono block">
                                    {matchedApp.patientPhone}
                                  </span>
                                  <span className="text-[10px] text-emerald-800 font-bold block mt-0.5">
                                    {matchedApp.type === "Online" ? "🌐 Video Consult" : "🏥 In-Person"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-emerald-200/60 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                                  <span>Slot Booked</span>
                                </span>
                                {matchedApp.type === "Online" && (
                                  <button
                                    type="button"
                                    onClick={() => alert(`Launching secure telehealth video room for ${matchedApp.patientName}...`)}
                                    className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-xs">videocam</span>
                                    <span>Call</span>
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-emerald-100">
                                <button
                                  type="button"
                                  onClick={() => setCompleteModalApp(matchedApp)}
                                  className="py-1 px-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-[10px] rounded-lg flex items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                                  title="Tick event when done (✓)"
                                >
                                  <span className="material-symbols-outlined text-[11px]">check</span>
                                  <span>Done ✓</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRescheduleModalApp(matchedApp)}
                                  className="py-1 px-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 cursor-pointer"
                                  title="Cross event when missed & reschedule (✗)"
                                >
                                  <span className="material-symbols-outlined text-[11px]">close</span>
                                  <span>Missed ✗</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingReminderApp(matchedApp)}
                                  className="py-1 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg flex items-center justify-center gap-0.5 cursor-pointer border border-slate-200"
                                  title="Adjust 30m & 5m reminders"
                                >
                                  <span className="material-symbols-outlined text-[11px]">alarm</span>
                                  <span>Remind</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (isReserved) {
                        return (
                          <div
                            key={slot}
                            className="p-3.5 rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 shadow-2xs flex flex-col justify-between space-y-2 opacity-80"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-lg">
                                ⏰ {slot}
                              </span>
                              <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                                Reserved
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 italic">
                              Marked unavailable by specialist.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setReservedDoctorSlots((prev) => {
                                  const copy = { ...prev };
                                  delete copy[`${selectedScheduleDate}_${slot}`];
                                  return copy;
                                });
                              }}
                              className="text-[11px] text-blue-600 font-bold hover:underline self-start cursor-pointer"
                            >
                              Make Available Again
                            </button>
                          </div>
                        );
                      }

                      // Free Available Slot
                      return (
                        <div
                          key={slot}
                          className="p-3.5 rounded-2xl border border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/50 transition-all shadow-2xs flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                                ⏰ {slot}
                              </span>
                              <span className="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                                🟢 Free Slot
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Open for patients to book via Treatment portal.
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <span className="text-[10px] text-emerald-700 font-medium">
                              Ready for booking
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setReservedDoctorSlots((prev) => ({
                                  ...prev,
                                  [`${selectedScheduleDate}_${slot}`]: true
                                }));
                              }}
                              className="text-[10px] text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                              title="Block slot if you have personal duties"
                            >
                              Reserve
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 2: APPOINTMENT CARDS (PENDING / APPROVED / ALL) ================= */}
            {appointmentFilter !== "timetable" && (
              <div className="space-y-4">
                {(() => {
                  const filteredList = doctorAppointments.filter((app) => {
                    if (appointmentFilter === "pending") return app.status === "Pending";
                    if (appointmentFilter === "approved") return app.status === "Accepted" || app.status === "Approved";
                    return true;
                  });

                  if (filteredList.length === 0) {
                    return (
                      <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                          <span className="material-symbols-outlined text-3xl">
                            {appointmentFilter === "pending" ? "check_circle" : "event_busy"}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-base text-slate-900">
                          {appointmentFilter === "pending"
                            ? "No Pending Appointment Approvals"
                            : appointmentFilter === "approved"
                            ? "No Confirmed Consultations Yet"
                            : "No Appointments Found"}
                        </h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          {appointmentFilter === "pending"
                            ? "All patient appointment requests have been processed. Switch to the 'Doctor Timetable' tab to inspect your daily schedule."
                            : "New appointments requested by patients through the Treatment portal will appear here for review."}
                        </p>
                        <button
                          type="button"
                          onClick={() => setAppointmentFilter("timetable")}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          <span>Open Timetable Schedule</span>
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredList.map((app) => {
                        const isPending = app.status === "Pending";
                        const isApproved = app.status === "Accepted" || app.status === "Approved";

                        return (
                          <div
                            key={app.id}
                            className={`bg-white border rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all ${
                              isPending
                                ? "border-amber-300 ring-2 ring-amber-300/20"
                                : isApproved
                                ? "border-emerald-200"
                                : "border-slate-200"
                            }`}
                          >
                            <div className="space-y-3">
                              {/* Header with status badge */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="font-extrabold text-slate-900 text-sm truncate">
                                    {app.patientName}
                                  </h3>
                                  <span className="text-xs text-slate-500 font-mono block">
                                    📞 {app.patientPhone || "+256 701 000000"}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border shrink-0 flex items-center gap-1 ${
                                    isApproved
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                      : isPending
                                      ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                                      : "bg-rose-50 text-rose-800 border-rose-300"
                                  }`}
                                >
                                  {isApproved ? (
                                    <>
                                      <span className="material-symbols-outlined text-xs">check_circle</span>
                                      Approved
                                    </>
                                  ) : isPending ? (
                                    <>
                                      <span className="material-symbols-outlined text-xs animate-spin">hourglass_top</span>
                                      Waiting Approval
                                    </>
                                  ) : (
                                    app.status
                                  )}
                                </span>
                              </div>

                              {/* Appointment Specs Box */}
                              <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1.5 border border-slate-100">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">Proposed Slot:</span>
                                  <span className="font-bold text-blue-700 font-mono">
                                    📅 {app.date} • ⏰ {app.time}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">Consultation Type:</span>
                                  <span className="font-semibold text-slate-800">
                                    {app.type === "Online" ? "🌐 Online Video Call" : "🏥 In-Person Visit"}
                                  </span>
                                </div>
                                {app.providerName && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Assigned Facility:</span>
                                    <span className="font-semibold text-slate-800 truncate max-w-[170px]">
                                      {app.providerName}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Attached Patient Lesion Photo Preview */}
                              {app.lesionImage && (
                                <div className="p-2.5 bg-blue-50/50 rounded-2xl border border-blue-200/60 flex items-center gap-3">
                                  <div
                                    onClick={() => setPreviewLesionPhoto(app.lesionImage)}
                                    className="w-14 h-14 rounded-xl overflow-hidden border border-blue-300 shrink-0 cursor-pointer relative group/thumb shadow-2xs"
                                    title="Click to view high-resolution photo"
                                  >
                                    <img
                                      src={app.lesionImage}
                                      alt="Patient Lesion"
                                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                                      <span className="material-symbols-outlined text-sm">zoom_in</span>
                                    </div>
                                  </div>
                                  <div className="min-w-0 flex-1 text-xs">
                                    <span className="block font-bold text-slate-800 text-[11px]">
                                      Attached Dermatology Photo
                                    </span>
                                    <p className="text-[11px] text-slate-600 truncate italic">
                                      "{app.symptoms || app.condition || "Cutaneous consultation requested."}"
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewLesionPhoto(app.lesionImage)}
                                      className="text-[10px] text-blue-700 font-bold hover:underline mt-0.5 inline-flex items-center gap-0.5 cursor-pointer"
                                    >
                                      <span>Inspect Full Photo</span>
                                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            {isPending && (
                              <div className="flex gap-2 pt-3 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => handleDoctorDeclineAppointment(app.id)}
                                  className="py-2 px-3 border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDoctorAcceptAppointment(app.id)}
                                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-sm">event_available</span>
                                  <span>Approve & Confirm Slot</span>
                                </button>
                              </div>
                            )}

                            {isApproved && (
                              <div className="pt-2 border-t border-slate-100 text-xs space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">verified</span>
                                    <span>Confirmed & Active Reminders</span>
                                  </span>
                                  {app.type === "Online" && (
                                    <button
                                      type="button"
                                      onClick={() => alert(`Starting video consultation with ${app.patientName}...`)}
                                      className="py-1 px-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-xs">videocam</span>
                                      <span>Call</span>
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => setCompleteModalApp(app)}
                                    className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-[11px] rounded-xl flex items-center justify-center gap-1 cursor-pointer shadow-xs transition-all"
                                    title="Tick event when done (✓)"
                                  >
                                    <span className="material-symbols-outlined text-xs font-black">check</span>
                                    <span>Done ✓</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRescheduleModalApp(app)}
                                    className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                                    title="Cross event when missed & reschedule (✗)"
                                  >
                                    <span className="material-symbols-outlined text-xs font-black">close</span>
                                    <span>Missed ✗</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingReminderApp(app)}
                                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 cursor-pointer border border-slate-200"
                                    title="Adjust 30m / 5m reminders"
                                  >
                                    <span className="material-symbols-outlined text-xs">alarm</span>
                                    <span>Remind</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {(app.status === "Completed" || app.isCompleted) && (
                              <div className="pt-2 border-t border-emerald-100 text-xs flex items-center justify-between">
                                <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                                  <span className="material-symbols-outlined text-xs">task_alt</span>
                                  Completed ✓
                                </span>
                                {app.completionNotes && (
                                  <span className="text-[10px] text-slate-500 italic truncate max-w-[170px]" title={app.completionNotes}>
                                    "{app.completionNotes}"
                                  </span>
                                )}
                              </div>
                            )}

                            {(app.status === "Rescheduled" || app.isMissed) && (
                              <div className="pt-2 border-t border-amber-100 text-xs space-y-1 bg-amber-50/60 p-2.5 rounded-2xl border border-amber-200/70">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-amber-900 font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs text-amber-700">schedule_send</span>
                                    Missed & Apology Notice Sent ✗
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setRescheduleModalApp(app)}
                                    className="text-[10px] text-blue-700 font-bold hover:underline cursor-pointer"
                                  >
                                    Update Slot
                                  </button>
                                </div>
                                <p className="text-[10px] text-slate-700">
                                  Proposed: <strong>{app.proposedDate || app.date}</strong> at <strong>{app.proposedTime || app.time}</strong>
                                </p>
                                {app.rescheduleReason && (
                                  <p className="text-[10px] text-slate-500 italic line-clamp-1">
                                    Reason: "{app.rescheduleReason}"
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {
    /* ======================= TAB 3: LIBRARY UPLOADS & DIRECTORY ======================= */
  }
        {activeTab === "library" && <div id="doctor_library_tab" className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 animate-fade-in">
            {
    /* Top Bar Header & Mode Selector */
  }
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="font-display font-extrabold text-xl text-slate-900 flex items-center gap-2">
                  <span>📚</span> Multilingual Health Library & Media Publisher
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Publish written articles with photo galleries, voice information recordings, or videos with text in 4 languages (EN, LG, SW, FR).
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
                <button
    type="button"
    onClick={() => setLibraryMode("publish")}
    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${libraryMode === "publish" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
  >
                  ➕ Publish Content
                </button>
                <button
    type="button"
    onClick={() => setLibraryMode("directory")}
    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${libraryMode === "directory" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
  >
                  📖 Library Explorer ({libraryItems.length})
                </button>
              </div>
            </div>

            {
    /* ================= MODE 1: PUBLISH MULTI-MEDIA CONTENT ================= */
  }
            {libraryMode === "publish" && <form onSubmit={handleLibrarySubmit} className="space-y-6">
                {
    /* Format Selector Cards */
  }
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Select Content Format *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
    type="button"
    onClick={() => setLibFormType("article")}
    className={`p-4 border rounded-2xl text-left transition-all flex flex-col justify-between ${libFormType === "article" ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20" : "border-slate-200 hover:border-slate-300 bg-slate-50/50"}`}
  >
                      <div>
                        <span className="text-2xl mb-2 block">📝</span>
                        <h4 className="font-bold text-xs text-slate-900">Written Article</h4>
                        <p className="text-[11px] text-slate-500 mt-1">Rich article with multiple photo attachments</p>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 mt-3 block">+ Photo Gallery</span>
                    </button>

                    <button
    type="button"
    onClick={() => setLibFormType("audio")}
    className={`p-4 border rounded-2xl text-left transition-all flex flex-col justify-between ${libFormType === "audio" ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20" : "border-slate-200 hover:border-slate-300 bg-slate-50/50"}`}
  >
                      <div>
                        <span className="text-2xl mb-2 block">🎙️</span>
                        <h4 className="font-bold text-xs text-slate-900">Voice Advisory</h4>
                        <p className="text-[11px] text-slate-500 mt-1">Voice information clip with cover photos & transcript</p>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 mt-3 block">+ Voice Audio & Cover Photo</span>
                    </button>

                    <button
    type="button"
    onClick={() => setLibFormType("video")}
    className={`p-4 border rounded-2xl text-left transition-all flex flex-col justify-between ${libFormType === "video" ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20" : "border-slate-200 hover:border-slate-300 bg-slate-50/50"}`}
  >
                      <div>
                        <span className="text-2xl mb-2 block">🎥</span>
                        <h4 className="font-bold text-xs text-slate-900">Video Content</h4>
                        <p className="text-[11px] text-slate-500 mt-1">Educational video with accompanying text/transcript</p>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 mt-3 block">+ Video & Text Alongside</span>
                    </button>
                  </div>
                </div>

                {
    /* Primary Metadata */
  }
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Resource Title (Primary) *
                    </label>
                    <input
    type="text"
    required
    placeholder={libFormType === "article" ? "e.g. Managing Eczema Flares in High Humidity" : libFormType === "audio" ? "e.g. Specialist Voice Advice on Sunscreen Usage" : "e.g. Video Guide: Patch Testing at Home"}
    value={libForm.title}
    onChange={(e) => setLibForm({ ...libForm, title: e.target.value })}
    className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs outline-none"
  />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Category</label>
                    <select
    value={libForm.category}
    onChange={(e) => setLibForm({ ...libForm, category: e.target.value })}
    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
  >
                      <option value="Skincare Tips">Skincare Tips</option>
                      <option value="Dermatosis Prevention">Dermatosis Prevention</option>
                      <option value="Allergy Guide">Allergy Guide</option>
                      <option value="General Hygiene">General Hygiene</option>
                      <option value="Pediatric Dermatology">Pediatric Dermatology</option>
                    </select>
                  </div>
                </div>

                {
    /* Cover Image & Attached Photos Section */
  }
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🖼️</span> Cover Photo & Article Photos Gallery ({libForm.photos.length})
                    </label>
                    <span className="text-[10px] text-slate-500">Upload from device or paste image URL</span>
                  </div>

                  {
    /* Hidden File Input for Device Photo Upload */
  }
                  <input
    type="file"
    ref={fileInputRef}
    onChange={handleDeviceImageUpload}
    accept="image/*"
    multiple
    className="hidden"
  />

                  {
    /* Device Upload Bar & Web URL Input */
  }
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <button
    type="button"
    onClick={() => fileInputRef.current?.click()}
    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all"
  >
                        <span>📱</span>
                        <span>Upload from Device (PC / Phone)</span>
                      </button>

                      <span className="text-[10px] text-slate-400 font-bold text-center sm:text-left self-center">OR</span>

                      <div className="flex-1 flex gap-2">
                        <input
    type="url"
    placeholder="Paste web image URL..."
    value={libForm.customPhotoUrl}
    onChange={(e) => setLibForm({ ...libForm, customPhotoUrl: e.target.value })}
    className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs outline-none"
  />
                        <button
    type="button"
    onClick={() => handleAddPhotoToForm()}
    className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800"
  >
                          Add URL
                        </button>
                      </div>
                    </div>
                  </div>

                  {
    /* Preset Clinical Photos Picker */
  }
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-500">Quick Clinical Presets:</span>
                    {[
    { label: "\u{1F52C} Dermatoscope", url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80" },
    { label: "\u{1F9F4} Emollient Routine", url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80" },
    { label: "\u2600\uFE0F Sun Barrier", url: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=800&q=80" },
    { label: "\u{1F33F} Organic Care", url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80" }
  ].map((preset, idx) => <button
    key={idx}
    type="button"
    onClick={() => handleAddPhotoToForm(preset.url)}
    className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-lg hover:border-blue-500 hover:text-blue-600"
  >
                        {preset.label}
                      </button>)}
                  </div>

                  {
    /* Photos Thumbnail Gallery Strip */
  }
                  {libForm.photos.length > 0 && <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2">
                      {libForm.photos.map((photo, index) => <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square">
                          <img src={photo} alt={`Attached ${index + 1}`} className="w-full h-full object-cover" />
                          <button
    type="button"
    onClick={() => handleRemovePhotoFromForm(index)}
    className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center opacity-90 group-hover:opacity-100 shadow-sm"
    title="Remove photo"
  >
                            ×
                          </button>
                          {index === 0 && <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                              Cover
                            </span>}
                        </div>)}
                    </div>}
                </div>

                {
    /* Specific Media Inputs (Voice Advisory Live Recording & File Upload OR Video URL) */
  }
                {libFormType === "audio" && <div className="bg-gradient-to-br from-indigo-50/70 via-blue-50/50 to-slate-50 border border-indigo-100/80 p-5 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                      <div>
                        <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest block">
                          Voice Advisory Studio
                        </span>
                        <h4 className="font-display font-extrabold text-sm text-slate-900 flex items-center gap-2">
                          <span>🎙️</span> Voice Mail Recording & Audio Message Attachment
                        </h4>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/60 self-start sm:self-auto">
                        High-Fidelity Audio (WebM / MP3)
                      </span>
                    </div>

                    {
    /* Dual Action Grid: Live Recorder + Device File Uploader */
  }
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {
    /* 1. LIVE VOICE MAIL RECORDER CARD */
  }
                      <div className="bg-white border border-indigo-100 rounded-2xl p-4 space-y-3 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                              Live Voice Mail Studio
                            </span>
                            <span className="text-xs font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                              ⏱️ {recordingState === "recording" ? formatTimerSeconds(recordingSeconds) : libForm.duration || "00:00"}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 leading-snug">
                            Record a direct audio message from your microphone to guide patients in Luganda, Swahili, French or English.
                          </p>

                          {
    /* Recording status visualizer */
  }
                          {recordingState === "recording" && <div className="my-3 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                                <span className="text-xs font-bold text-red-700">Recording live voice mail...</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-1 h-4 bg-red-500 rounded-full animate-bounce" />
                                <span className="w-1 h-6 bg-red-600 rounded-full animate-bounce delay-75" />
                                <span className="w-1 h-3 bg-red-400 rounded-full animate-bounce delay-150" />
                                <span className="w-1 h-5 bg-red-600 rounded-full animate-bounce delay-100" />
                              </div>
                            </div>}

                          {recordingState === "paused" && <div className="my-3 p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-800">
                              <span>⏸ Voice recording paused at {formatTimerSeconds(recordingSeconds)}</span>
                            </div>}
                        </div>

                        {
    /* Controls Toolbar */
  }
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          {recordingState === "idle" && <button
    type="button"
    onClick={startVoiceRecording}
    className="flex-1 py-2.5 px-3 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-1.5 shadow-sm"
  >
                              <span className="material-symbols-outlined text-base">mic</span>
                              <span>Record</span>
                            </button>}

                          {recordingState === "recording" && <>
                              <button
    type="button"
    onClick={pauseVoiceRecording}
    className="flex-1 py-2 px-2.5 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-1"
  >
                                <span className="material-symbols-outlined text-sm">pause</span>
                                <span>Pause</span>
                              </button>

                              <button
    type="button"
    onClick={stopVoiceRecording}
    className="flex-1 py-2 px-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-1 shadow-sm"
  >
                                <span className="material-symbols-outlined text-sm">square</span>
                                <span>Save Audio</span>
                              </button>
                            </>}

                          {recordingState === "paused" && <>
                              <button
    type="button"
    onClick={resumeVoiceRecording}
    className="flex-1 py-2 px-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-1"
  >
                                <span className="material-symbols-outlined text-sm">play_arrow</span>
                                <span>Resume</span>
                              </button>

                              <button
    type="button"
    onClick={stopVoiceRecording}
    className="flex-1 py-2 px-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-1 shadow-sm"
  >
                                <span className="material-symbols-outlined text-sm">square</span>
                                <span>Finish</span>
                              </button>
                            </>}

                          {recordingState === "stopped" && <button
    type="button"
    onClick={startVoiceRecording}
    className="py-2 px-3 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center gap-1"
  >
                              <span className="material-symbols-outlined text-sm">mic</span>
                              <span>Re-Record</span>
                            </button>}
                        </div>
                      </div>

                      {
    /* 2. UPLOAD AUDIO FILE FROM DEVICE / PC / PHONE */
  }
                      <div className="bg-white border border-indigo-100 rounded-2xl p-4 space-y-3 shadow-xs flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-800 block mb-1">
                            🎵 Upload Pre-Recorded Audio Message
                          </span>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Select an MP3, WAV, M4A, OGG or AAC audio voice note file directly from your computer or phone storage.
                          </p>

                          <input
    type="file"
    ref={audioFileInputRef}
    accept="audio/*"
    onChange={handleDeviceAudioUpload}
    className="hidden"
  />

                          <div className="mt-3">
                            <button
    type="button"
    onClick={() => audioFileInputRef.current?.click()}
    className="w-full py-3 px-4 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
  >
                              <span className="material-symbols-outlined text-lg text-indigo-600">upload_file</span>
                              <span>Choose Audio File from Device</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {
    /* ATTACHED AUDIO MESSAGES PLAYLIST & PREVIEW STUDIO (MAX 3 AUDIOS) */
  }
                    <div className="bg-white border border-indigo-200 rounded-2xl p-4 space-y-3 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-50 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <h5 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                            Recorded & Uploaded Audio Messages ({libForm.audioTracks.length} / 3 Max)
                          </h5>
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${libForm.audioTracks.length >= 3 ? "bg-amber-100 text-amber-800" : "bg-indigo-50 text-indigo-700"}`}>
                          {libForm.audioTracks.length >= 3 ? "Maximum 3/3 Reached" : `${3 - libForm.audioTracks.length} slot(s) available`}
                        </span>
                      </div>

                      {libForm.audioTracks.length === 0 ? <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1">
                          <p className="text-xs font-bold text-slate-600">No audio tracks recorded or attached yet</p>
                          <p className="text-[11px] text-slate-400">
                            Use the mic recorder or file uploader above to attach voice mail advisories (Up to 3 audio tracks maximum).
                          </p>
                        </div> : <div className="space-y-2.5">
                          {libForm.audioTracks.map((track, idx) => <div key={track.id || idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-indigo-300 transition-all">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-extrabold text-slate-900 truncate">
                                      {track.name}
                                    </span>
                                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${track.type === "recorded" ? "bg-red-100 text-red-700" : track.type === "uploaded" ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-700"}`}>
                                      {track.type === "recorded" ? "\u{1F399}\uFE0F Live Voice Recording" : track.type === "uploaded" ? "\u{1F3B5} File Upload" : "\u{1F517} Web Link"}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500 block truncate">
                                    {track.url && typeof track.url === "string" && track.url.startsWith("data:") ? "Local Audio Data Stream" : track.url || "Audio Stream"}
                                  </span>
                                </div>
                              </div>

                              {
    /* Audio Player Controls & Delete Action */
  }
                              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                                <audio controls src={track.url} className="h-8 max-w-[210px] sm:max-w-[260px]" />
                                <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                                  ⏱️ {track.duration || "02:00"}
                                </span>
                                <button
    type="button"
    onClick={() => handleDeleteAudioTrack(track.id)}
    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
    title="Delete Audio Track"
  >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </div>)}
                        </div>}
                    </div>
                  </div>}

                {libFormType === "video" && <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-red-950 text-white p-5 rounded-2xl space-y-5 border border-slate-800 shadow-xl">
                    {
    /* YouTube Creator Studio Header */
  }
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
                          <span className="material-symbols-outlined text-2xl">file_upload</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">
                              YouTube Creator Studio
                            </span>
                            <span className="bg-red-500/20 text-red-300 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-red-500/30">
                              HD / 4K Video Upload
                            </span>
                          </div>
                          <h4 className="font-display font-extrabold text-sm text-white flex items-center gap-1.5">
                            Upload Health Advisory Video
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-bold text-slate-300 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700">
                          Checks complete • No copyright issues
                        </span>
                      </div>
                    </div>

                    {
    /* YouTube Studio Dual Grid */
  }
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      {
    /* Left: YouTube File Uploader & Drop Zone (7 cols) */
  }
                      <div className="lg:col-span-7 bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                        <div>
                          {
    /* Drag & Drop Upload Zone */
  }
                          <div
    onClick={() => videoFileInputRef.current?.click()}
    className="border-2 border-dashed border-slate-600 hover:border-red-500 bg-slate-900/60 hover:bg-slate-900/90 rounded-2xl p-6 text-center space-y-3 cursor-pointer transition-all group"
  >
                            <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-red-600/20 text-red-500 group-hover:text-red-400 mx-auto flex items-center justify-center transition-all shadow-inner">
                              <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">
                                upload
                              </span>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs font-extrabold text-white">
                                Drag and drop video files to upload
                              </p>
                              <p className="text-[11px] text-slate-400">
                                MP4, WebM, MOV or AVI files up to 1080p / 4K resolution
                              </p>
                            </div>

                            <div>
                              <button
    type="button"
    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-full shadow-lg transition-all group-hover:scale-105 inline-flex items-center gap-2"
  >
                                <span className="material-symbols-outlined text-base">movie</span>
                                <span>SELECT FILE FROM DEVICE</span>
                              </button>
                            </div>

                            <input
    type="file"
    ref={videoFileInputRef}
    accept="video/*"
    onChange={handleDeviceVideoUpload}
    className="hidden"
  />
                          </div>

                          {
    /* Upload Progress Indicator */
  }
                          {videoUploadProgress !== null && <div className="mt-3 p-3 bg-red-950/60 border border-red-800/80 rounded-xl space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-red-200">
                                <span>Uploading Video to Studio...</span>
                                <span>{videoUploadProgress}%</span>
                              </div>
                              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
    className="h-full bg-red-500 transition-all duration-300"
    style={{ width: `${videoUploadProgress}%` }}
  />
                              </div>
                              <span className="text-[10px] text-slate-400 block text-right">
                                Processing HD version...
                              </span>
                            </div>}
                        </div>

                        {
    /* Paste YouTube / Video Link alternative */
  }
                        <div className="pt-3 border-t border-slate-700/80 space-y-1.5">
                          <label className="block text-xs font-bold text-slate-300">
                            🔗 Or Paste YouTube Video URL / Embed Link:
                          </label>
                          <div className="flex gap-2">
                            <input
    type="url"
    placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    value={libForm.mediaUrl}
    onChange={(e) => setLibForm({ ...libForm, mediaUrl: e.target.value })}
    className="flex-1 p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-red-500 transition-all"
  />
                            {libForm.mediaUrl && <button
    type="button"
    onClick={() => setLibForm({ ...libForm, mediaUrl: "" })}
    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl"
  >
                                Clear
                              </button>}
                          </div>
                        </div>
                      </div>

                      {
    /* Right: YouTube Live Video Preview & Player Details (5 cols) */
  }
                      <div className="lg:col-span-5 bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 space-y-3.5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                              Video Preview Player
                            </span>
                            <span className="text-[10px] font-mono font-extrabold bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30">
                              4K / HD
                            </span>
                          </div>

                          {
    /* Video Player Display */
  }
                          <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-700 shadow-md relative group flex items-center justify-center">
                            {libForm.mediaUrl ? libForm.mediaUrl.includes("youtube.com") || libForm.mediaUrl.includes("youtu.be") ? <iframe
    src={getEmbedVideoUrl(libForm.mediaUrl)}
    title="YouTube Video Preview"
    className="w-full h-full border-0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
  /> : <video
    controls
    src={libForm.mediaUrl}
    className="w-full h-full object-contain"
  /> : <div className="text-center p-4 space-y-1 text-slate-500">
                                <span className="material-symbols-outlined text-4xl block">play_circle</span>
                                <span className="text-xs font-bold">No video file or URL selected</span>
                              </div>}
                          </div>
                        </div>

                        {
    /* Video Metadata Inputs */
  }
                        <div className="space-y-2.5 pt-2 border-t border-slate-700/80">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Video Link
                            </label>
                            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-2 rounded-xl text-[11px] font-mono text-slate-300 truncate">
                              <span className="truncate flex-1">
                                {libForm.mediaUrl || "https://moyo-health.app/v/draft"}
                              </span>
                              <button
    type="button"
    onClick={() => {
      if (libForm.mediaUrl) {
        navigator.clipboard.writeText(libForm.mediaUrl);
        alert("Video link copied to clipboard!");
      }
    }}
    className="text-red-400 hover:text-red-300 text-xs font-bold shrink-0"
  >
                                Copy
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Duration (MM:SS)
                              </label>
                              <input
    type="text"
    value={libForm.duration}
    onChange={(e) => setLibForm({ ...libForm, duration: e.target.value })}
    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-red-500"
    placeholder="04:15"
  />
                            </div>

                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Visibility
                              </label>
                              <div className="p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-emerald-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>Public to Patients</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>}

                {
    /* ================= MULTILINGUAL TEXT SECTION (EN, LG, SW, FR) ================= */
  }
                <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>🌐</span> Multilingual Content Editor (4 Languages)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {libFormType === "article" ? "Write the article text in multiple languages." : libFormType === "audio" ? "Write the voice transcript text in multiple languages." : "Write the accompanying video text & transcript in multiple languages."}
                      </p>
                    </div>

                    <button
    type="button"
    onClick={handleAutoTranslateAcrossLanguages}
    className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-extrabold rounded-xl shadow-sm hover:from-blue-700 hover:to-indigo-700 flex items-center gap-1.5 self-start sm:self-auto"
  >
                      <span>⚡</span> AI Auto-Translate (EN, LG, SW, FR)
                    </button>
                  </div>

                  {/* Language Tab Switcher */}
                  <div
                    className="flex items-center gap-2 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll pb-1"
                    onWheel={handleHorizontalWheel}
                  >
                    {[
    { code: "en", flag: "\u{1F1FA}\u{1F1F8}", name: "English" },
    { code: "lg", flag: "\u{1F1FA}\u{1F1EC}", name: "Luganda" },
    { code: "sw", flag: "\u{1F1F9}\u{1F1FF}", name: "Swahili" },
    { code: "fr", flag: "\u{1F1EB}\u{1F1F7}", name: "Fran\xE7ais" }
  ].map((lang) => <button
    key={lang.code}
    type="button"
    onClick={() => setEditingLang(lang.code)}
    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${editingLang === lang.code ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
  >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                        {libForm.titleTranslations[lang.code] && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </button>)}
                  </div>

                  {
    /* Active Language Form Fields */
  }
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Title in ({editingLang.toUpperCase()})
                      </label>
                      <input
    type="text"
    placeholder={`e.g. Title in ${editingLang.toUpperCase()}`}
    value={libForm.titleTranslations[editingLang] || ""}
    onChange={(e) => setLibForm({
      ...libForm,
      titleTranslations: {
        ...libForm.titleTranslations,
        [editingLang]: e.target.value
      }
    })}
    className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs outline-none"
  />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Short Summary in ({editingLang.toUpperCase()})
                      </label>
                      <input
    type="text"
    placeholder={`e.g. Brief summary in ${editingLang.toUpperCase()}`}
    value={libForm.summaryTranslations[editingLang] || ""}
    onChange={(e) => setLibForm({
      ...libForm,
      summaryTranslations: {
        ...libForm.summaryTranslations,
        [editingLang]: e.target.value
      }
    })}
    className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs outline-none"
  />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {libFormType === "article" ? `Full Written Article Body in (${editingLang.toUpperCase()}) *` : libFormType === "audio" ? `Voice Information Transcript in (${editingLang.toUpperCase()}) *` : `Accompanying Article & Video Transcript in (${editingLang.toUpperCase()}) *`}
                      </label>
                      <textarea
    rows={5}
    placeholder={`Write detailed clinical content in ${editingLang.toUpperCase()}...`}
    value={libForm.fullTextTranslations[editingLang] || ""}
    onChange={(e) => setLibForm({
      ...libForm,
      fullTextTranslations: {
        ...libForm.fullTextTranslations,
        [editingLang]: e.target.value
      }
    })}
    className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs outline-none resize-none"
  />
                    </div>
                  </div>
                </div>

                <button
    type="submit"
    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
  >
                  <span>🚀</span> Publish Multilingual {libFormType.toUpperCase()} Resource
                </button>
              </form>}

            {
    /* ================= MODE 2: DIRECTORY & READER ================= */
  }
            {libraryMode === "directory" && <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {libraryItems.map((item) => <div
    key={item.id}
    onClick={() => {
      setViewItem(item);
      setViewLang(currentLanguage);
    }}
    className="bg-white border border-slate-200 hover:border-blue-500/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
  >
                      <div>
                        {
    /* Cover image header */
  }
                        <div className="relative h-36 bg-slate-100 overflow-hidden">
                          <img
    src={item.coverImage || item.thumbnail}
    alt={item.title}
    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
  />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                          {
    /* Media Type Badge */
  }
                          <span className="absolute top-2 left-2 bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                            {item.type === "article" && "\u{1F4DD} Article"}
                            {item.type === "audio" && "\u{1F399}\uFE0F Voice Advisory"}
                            {item.type === "video" && "\u{1F3A5} Video Content"}
                            {item.photos && item.photos.length > 1 && ` (${item.photos.length} photos)`}
                          </span>

                          {item.duration && <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                              ⏱️ {item.duration}
                            </span>}
                        </div>

                        {
    /* Text details */
  }
                        <div className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              {item.category}
                            </span>
                            <span className="text-[10px] text-slate-400">{item.createdAt}</span>
                          </div>

                          <h3 className="font-bold text-sm text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {item.titleTranslations?.[currentLanguage] || item.title}
                          </h3>

                          <p className="text-xs text-slate-500 line-clamp-2">
                            {item.summaryTranslations?.[currentLanguage] || item.description}
                          </p>
                        </div>
                      </div>

                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>By {item.author || "Specialist"}</span>
                        <span className="font-bold text-blue-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                          Inspect & Read 4 Languages &rarr;
                        </span>
                      </div>
                    </div>)}
                </div>
              </div>}

            {/* ================= INTERACTIVE READER MODAL ================= */}
            {viewItem && <div className="fixed inset-0 z-50 glass-overlay-backdrop flex items-center justify-center p-4">
                <div className="glass-modal rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl animate-scale-up">
                  {
    /* Modal Header & Language Selector */
  }
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg uppercase">
                          {viewItem.category}
                        </span>
                        <span className="text-xs text-slate-400">By {viewItem.author}</span>
                      </div>
                      <h2 className="font-display font-extrabold text-lg md:text-xl text-slate-900">
                        {viewItem.titleTranslations?.[viewLang] || viewItem.title}
                      </h2>
                    </div>

                    <button
    onClick={() => setViewItem(null)}
    className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-bold"
  >
                      ✕
                    </button>
                  </div>

                  {
    /* Active Language Bar Switcher */
  }
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 ml-2">🌐 Language View:</span>
                    <div className="flex items-center gap-1">
                      {[
    { code: "en", flag: "\u{1F1FA}\u{1F1F8}", name: "EN" },
    { code: "lg", flag: "\u{1F1FA}\u{1F1EC}", name: "LG" },
    { code: "sw", flag: "\u{1F1F9}\u{1F1FF}", name: "SW" },
    { code: "fr", flag: "\u{1F1EB}\u{1F1F7}", name: "FR" }
  ].map((lang) => <button
    key={lang.code}
    onClick={() => setViewLang(lang.code)}
    className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 ${viewLang === lang.code ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
  >
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </button>)}
                    </div>
                  </div>

                  {
    /* MEDIA DISPLAY (Article Photos Gallery / Voice Player / Video Player) */
  }
                  {viewItem.type === "article" && viewItem.photos && viewItem.photos.length > 0 && <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <span>📷</span> Article Photos Gallery ({viewItem.photos.length})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {viewItem.photos.map((imgUrl, i) => <div key={i} className="rounded-2xl overflow-hidden border border-slate-200 h-32 bg-slate-100">
                            <img src={imgUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          </div>)}
                      </div>
                    </div>}

                  {viewItem.type === "audio" && <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl space-y-4 shadow-inner">
                      <div className="flex items-center gap-4">
                        <img
    src={viewItem.coverImage || viewItem.thumbnail}
    alt="Album cover"
    className="w-16 h-16 rounded-xl object-cover border border-white/20 shadow-md"
  />
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">
                            🎙️ Voice Advisory ({viewItem.audioTracks?.length || 1} Track{viewItem.audioTracks && viewItem.audioTracks.length > 1 ? "s" : ""})
                          </span>
                          <h4 className="font-bold text-sm line-clamp-1">{viewItem.title}</h4>
                          <span className="text-xs text-slate-300">Total Duration: {viewItem.duration || "03:45"}</span>
                        </div>
                      </div>

                      {
    /* Audio Tracks Players List */
  }
                      {viewItem.audioTracks && viewItem.audioTracks.length > 0 ? <div className="space-y-2.5 pt-2 border-t border-white/10">
                          {viewItem.audioTracks.map((track, tIdx) => <div key={track.id || tIdx} className="bg-white/10 p-3 rounded-xl space-y-2 backdrop-blur-md">
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
                          <audio controls src={viewItem.url} className="w-full h-8" />
                        </div>}
                    </div>}

                  {viewItem.type === "video" && <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black aspect-video relative group">
                      {viewItem.url && (viewItem.url.includes("youtube.com") || viewItem.url.includes("youtu.be")) ? <iframe
    src={getEmbedVideoUrl(viewItem.url)}
    title="YouTube Video Advisory"
    className="w-full h-full border-0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
  /> : <video
    controls
    poster={viewItem.coverImage || viewItem.thumbnail}
    src={viewItem.url || "https://www.w3schools.com/html/mov_bbb.mp4"}
    className="w-full h-full object-cover"
  >
                          Your browser does not support HTML5 video.
                        </video>}
                    </div>}

                  {
    /* Accompanying Text & Voice Transcript Section in selected language */
  }
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📄</span> {viewItem.type === "audio" ? "Voice Transcript" : viewItem.type === "video" ? "Video Article & Transcript" : "Full Article Body"} ({viewLang.toUpperCase()})
                    </h3>

                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {viewItem.fullTextTranslations?.[viewLang] || viewItem.fullText || viewItem.summaryTranslations?.[viewLang] || viewItem.description}
                    </p>
                  </div>

                  {/* Doctor & Community Feedback Panel */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-display font-extrabold text-sm text-slate-900 flex items-center gap-2">
                          <span>💬</span> Patient Reactions & Community Feedback
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Review patient responses, answer inquiries, or react with clinical emojis.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDocToggleLike(viewItem.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          (viewItem.userLikes || []).includes(user?.id)
                            ? "bg-rose-50 text-rose-600 border border-rose-200"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <span>{(viewItem.userLikes || []).includes(user?.id) ? "❤️" : "🤍"}</span>
                        <span>{viewItem.likes || 0}</span>
                      </button>
                    </div>

                    {/* Emoji Reaction Toggles for Doctors */}
                    <div className="flex flex-wrap items-center gap-2">
                      {["❤️", "💡", "👏", "🙏", "✨"].map((emoji) => {
                        const count = viewItem.reactions?.[emoji] || 0;
                        const isReacted = viewItem.userReactions?.[user?.id] === emoji;
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleDocToggleReaction(viewItem.id, emoji)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isReacted
                                ? "bg-blue-600 text-white shadow-xs"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{count}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Comment Discussion Section */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Discussion & Clinical Feedback ({ (viewItem.comments || []).length })
                        </span>
                        <span className="text-[10px] text-slate-400">Replies visible to all portal users</span>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!docCommentText.trim()) return;
                          handleDocAddComment(viewItem.id, docCommentText);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          placeholder="Reply as specialist (e.g. clinical clarification, warning)..."
                          value={docCommentText}
                          onChange={(e) => setDocCommentText(e.target.value)}
                          className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600"
                        />
                        <button
                          type="submit"
                          disabled={!docCommentText.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                        >
                          Reply
                        </button>
                      </form>

                      {/* Comments List */}
                      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                        {(viewItem.comments || []).map((comm) => (
                          <div key={comm.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img
                                  src={comm.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"}
                                  alt={comm.userName}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                                <span className="text-xs font-bold text-slate-900">{comm.userName}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                  comm.userRole === "Specialist" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                                }`}>
                                  {comm.userRole}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">{comm.createdAt}</span>
                            </div>
                            <p className="text-xs text-slate-700 pl-8">{comm.text}</p>
                          </div>
                        ))}

                        {(viewItem.comments || []).length === 0 && (
                          <p className="text-xs text-slate-400 italic text-center py-3">No comments yet.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
    onClick={() => setViewItem(null)}
    className="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800"
  >
                    Close Resource Viewer
                  </button>
                </div>
              </div>}
          </div>}

        {
    /* ======================= TAB 4: HELP DESK / COMMUNICATION ======================= */
  }
        {activeTab === "community" && <div id="doctor_community_tab" className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {
    /* Left news panel */
  }
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-display font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">newspaper</span>
                Dermatology Community News & Updates
              </h3>
              
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded border border-blue-200">Medical Update</span>
                <h4 className="font-bold text-sm text-slate-900">National Dermatology Symposium (Kampala 2026)</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Join fellow skin care practitioners next month to discuss innovations in mobile telescopy, deep-dermal imaging, and clinical triaging. Accreditations count for annual licensing.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded border border-emerald-200">Clinical Guideline</span>
                <h4 className="font-bold text-sm text-slate-900">Revised Management Guidelines for Eczema & Contact Allergies</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Updated clinical protocols for first-line topical corticosteroids and barrier repair creams are now accessible in the Educational Library.
                </p>
              </div>
            </div>

            {/* Right Help Desk Admin chat */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between h-[580px]">
              {/* Chat Card Header */}
              <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-4 flex items-center justify-between border-b border-blue-900 shadow-xs shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
                    <span className="material-symbols-outlined text-2xl text-blue-200 font-semibold">support_agent</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-sm text-white">Administration Help Desk</h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Online</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-blue-200 font-medium">
                      Two-way verified channel • Real-time notifications enabled
                    </p>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-[10px] text-blue-200 font-medium block">Specialist Channel</span>
                  <span className="text-xs font-bold text-white font-mono">{user.name}</span>
                </div>
              </div>

              {/* Chat Messages & Earlier Conversations Timeline */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/90 scroll-smooth">
                {/* Earlier Conversations Divider */}
                <div className="flex items-center justify-center my-2">
                  <span className="px-3.5 py-1 rounded-full text-[10px] font-bold text-slate-600 bg-white border border-slate-200/90 flex items-center gap-1.5 shadow-2xs">
                    <span className="material-symbols-outlined text-xs text-blue-600 font-bold">history</span>
                    <span>Earlier Conversations with DERMA CARE Administration</span>
                  </span>
                </div>

                {displayedAdminChats.length === 0 ? (
                  <div className="text-center py-12 px-4 text-slate-400">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">chat_bubble_outline</span>
                    <p className="text-xs font-semibold text-slate-600">No previous messages with the Administration Desk.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Send a message below to consult with central medical administrators.</p>
                  </div>
                ) : (
                  displayedAdminChats.map((msg, idx) => {
                    const isSpecialist = msg.role === "specialist";
                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex gap-2.5 max-w-[88%] ${isSpecialist ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                      >
                        {/* Avatar indicator */}
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs ${
                            isSpecialist
                              ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white"
                              : "bg-slate-900 text-blue-300 border border-slate-700"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {isSpecialist ? "medical_services" : "verified_user"}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <div className={`flex items-center gap-1.5 mb-1 ${isSpecialist ? "justify-end" : "justify-start"}`}>
                            <span className="text-[10px] font-bold text-slate-600">
                              {isSpecialist ? `${user.name} (You)` : "DERMA CARE Administration"}
                            </span>
                            {!isSpecialist && (
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                Support Desk
                              </span>
                            )}
                          </div>

                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                              isSpecialist
                                ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-tr-none"
                                : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-none"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <div className={`flex items-center gap-2 justify-end mt-2 text-[9px] ${isSpecialist ? "text-blue-100" : "text-slate-400"}`}>
                              <span>{msg.time || "Recently"}</span>
                              {isSpecialist && (
                                <span className="flex items-center gap-0.5 font-medium">
                                  {msg.readByAdmin ? (
                                    <span className="text-emerald-300 font-bold flex items-center gap-0.5" title="Read by Admin">
                                      <span>✓✓</span>
                                      <span>Read by Admin</span>
                                    </span>
                                  ) : (
                                    <span className="text-blue-200 flex items-center gap-0.5" title="Delivered to Admin Queue">
                                      <span>✓</span>
                                      <span>Delivered</span>
                                    </span>
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
                <div ref={chatMessagesEndRef} />
              </div>

              {/* Chat Input & Fast Prompts */}
              <div className="border-t border-slate-100 bg-white p-3.5 space-y-2.5 shrink-0">
                {/* Live Channel Alert Tag */}
                <div className="flex items-center justify-between text-[10px] px-1 text-slate-500">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <span>Admin receives live notification on dispatch</span>
                  </div>
                  <span className="font-mono text-slate-400">Two-way encrypted channel</span>
                </div>

                <div
                  className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain tabs-horizontal-scroll pb-1 text-[10px] scrollbar-none"
                  onWheel={handleHorizontalWheel}
                >
                  <span className="text-slate-400 text-[10px] font-semibold shrink-0">Quick prompts:</span>
                  {[
                    "Request Form Template Update",
                    "License Verification Status",
                    "Update Telehealth Hours",
                    "Urgent Patient Case Escalation"
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAdminMsg(chip)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[10px] font-medium transition-colors shrink-0 cursor-pointer border border-slate-200/80 active:scale-95"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleAdminChatSubmit} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type message to DERMA CARE Administration..."
                    value={adminMsg}
                    onChange={(e) => setAdminMsg(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50/50 focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    <span>Send</span>
                    <span className="material-symbols-outlined text-sm">send</span>
                  </button>
                </form>
              </div>
            </div>
          </div>}

        {
    /* ======================= TAB 5: PROFILE MANAGEMENT ======================= */
  }
        {activeTab === "profile" && (() => {
    const profileTranslations = {
      en: {
        registrationCredentials: "Registration Credentials",
        verifiedAccount: "\u2713 Verified Account",
        clinicalProfileTitle: "Clinical Registration Profile",
        clinicalProfileSub: "View and edit your complete specialist registration and clinical details.",
        editRegistrationInfo: "Edit Registration Info",
        cancelEditing: "Cancel Editing",
        sec1Title: "Account & Contact Credentials",
        fullNameLabel: "Full Professional Name *",
        emailLabel: "Account Email *",
        phoneLabel: "Mobile / WhatsApp Contact *",
        sec2Title: "Medical Licensing & Registration",
        providerTypeLabel: "Provider Type *",
        providerTypeIndiv: "Individual Specialist Practitioner",
        providerTypeClinic: "Specialized Skin Clinic",
        providerTypeHospital: "Referral Hospital Department",
        licensingAuthLabel: "Licensing Authority *",
        registrationNumberLabel: "Medical Registration / License ID *",
        qualificationsLabel: "Degrees & Academic Qualifications",
        sec3Title: "Facility & Specialty Details",
        hospitalNameLabel: "Primary Hospital / Practice Name",
        departmentLabel: "Department",
        positionLabel: "Position / Title",
        specializationLabel: "Specialized Dermal Title *",
        experienceLabel: "Years of Practice Experience *",
        websiteLabel: "Clinical Website / Portal URL",
        sec4Title: "Consultation & Location",
        consultationTypeLabel: "Consultation Mode",
        consultBoth: "Both Physical & Tele-Dermatology",
        consultOnline: "Tele-Dermatology Only",
        consultPhysical: "In-Person Consultation Only",
        consultationHoursLabel: "Weekly Consulting Hours *",
        addressLabel: "Physical Clinic Address *",
        sec5Title: "Clinical Bio & Philosophy",
        bioLabel: "Professional Bio / Philosophy",
        saveProfileBtn: "Save Entire Registration Profile",
        statusVerified: "Verified & Active",
        licensingCardHeader: "Licensing & Credentials",
        facilityCardHeader: "Facility & Hospital",
        consultationCardHeader: "Consultation & Location",
        systemLangHeader: "System Language / Select Language",
        bioHeader: "Clinical Bio & Philosophy",
        saveSuccessAlert: "Full clinical registration profile updated successfully!"
      },
      lg: {
        registrationCredentials: "Ebyapa by'Oluwandiiko",
        verifiedAccount: "\u2713 Akaunti Ekakasiddwa",
        clinicalProfileTitle: "Ebyafayo by'Oluwandiiko lw'Obusawo",
        clinicalProfileSub: "Laba kaddako ku muwandiiko gwo ogwa sawo n'obukugu bwo obw\u2019obusawo.",
        editRegistrationInfo: "Kyusa Eby'oluwandiiko",
        cancelEditing: "Sazaamu Okukyusa",
        sec1Title: "Ebikwata ku Akaunti n'Endagiriro",
        fullNameLabel: "Erinnya lyo Ery'obusawo Mbulamba *",
        emailLabel: "Emeera ya Akaunti *",
        phoneLabel: "Essimu / WhatsApp *",
        sec2Title: "Oluwandiiko n'Olukusa lw'Obusawo",
        providerTypeLabel: "Okaani ka Mugaba Busawo *",
        providerTypeIndiv: "Musawo Nkyukutwa",
        providerTypeClinic: "Kkiliniki y'Ediba Ey'enjawulo",
        providerTypeHospital: "Ettwale ly'Edwaliro Ekulu",
        licensingAuthLabel: "Akakiiko Agawabi Kisawo *",
        registrationNumberLabel: "Namba y'Olukusa lw'Obusawo *",
        qualificationsLabel: "Ediguli n'Ebiwandiiko by'Obusomesa",
        sec3Title: "Ebikwata ku Dwaliro n'Obukugu",
        hospitalNameLabel: "Erinnya ly'Edwaliro lyo Ekulu",
        departmentLabel: "Ettwale ly'Obusawo",
        positionLabel: "Ekitiibwa / Obukulu",
        specializationLabel: "Ekitiibwa ky'Obukugu bw'Ediba *",
        experienceLabel: "Emyaka gy'Obumanyirivu *",
        websiteLabel: "Omukutu gw'Edwaliro gwa Intaneti",
        sec4Title: "Esaawa z'Okulaba Abalwadde n'Endagiriro",
        consultationTypeLabel: "Enfunda y'Okulaba Abalwadde",
        consultBoth: "Kutambula n'ag'omu Mikutu",
        consultOnline: "Mikutu gya Intaneti Wokka",
        consultPhysical: "Kujja ku Dwaliro Wokka",
        consultationHoursLabel: "Esaawa z'Okukola buli Wiki *",
        addressLabel: "Endagiriro y'Edwaliro gye Liri *",
        sec5Title: "Ebinyonyola ku Musawo n'Ebirowozo",
        bioLabel: "Ebinyonyola ku Musawo n'Ebirowozo",
        saveProfileBtn: "Tereka Ebyafayo by'Oluwandiiko Byonna",
        statusVerified: "Ekakasiddwa & Ekola",
        licensingCardHeader: "Ebyapa n'Olukusa lw'Obusawo",
        facilityCardHeader: "Edwaliro n'Ettwale",
        consultationCardHeader: "Esaawa z'Okulaba n'Endagiriro",
        systemLangHeader: "Olulimi lw'Esystem / Londa Olulimi",
        bioHeader: "Ebinyonyola ku Musawo n'Ebirowozo",
        saveSuccessAlert: "Ebyafayo by'oluwandiiko lw'obusawo biterekeddwa bulungi!"
      },
      sw: {
        registrationCredentials: "Vitambulisho vya Usajili",
        verifiedAccount: "\u2713 Akaunti Imethibitishwa",
        clinicalProfileTitle: "Prfili ya Usajili wa Udaktari",
        clinicalProfileSub: "Tazama na uhariri maelezo yako kamili ya usajili wa kitaalamu.",
        editRegistrationInfo: "Hariri Maelezo ya Usajili",
        cancelEditing: "Ghairi Kuhariri",
        sec1Title: "Anwani na Vitambulisho vya Akaunti",
        fullNameLabel: "Jina Rasmi la Kitaalamu *",
        emailLabel: "Barua Pepe ya Akaunti *",
        phoneLabel: "Nambari ya Simu / WhatsApp *",
        sec2Title: "Usajili na Leseni ya Udaktari",
        providerTypeLabel: "Aina ya Mtoa Huduma *",
        providerTypeIndiv: "Mtaalamu Binafsi wa Udaktari",
        providerTypeClinic: "Kituo cha Afya cha Ngozi",
        providerTypeHospital: "Idara ya Hospitali Kuu",
        licensingAuthLabel: "Mamlaka ya Utoaji Leseni *",
        registrationNumberLabel: "Nambari ya Usajili wa Udaktari *",
        qualificationsLabel: "Shahada na Sifa za Kitahadhari",
        sec3Title: "Maelezo ya Hospitali na Utaalamu",
        hospitalNameLabel: "Jina la Hospitali / Kituo cha Kazi",
        departmentLabel: "Idara",
        positionLabel: "Nafasi / Wadhifa",
        specializationLabel: "Anwani ya Utaalamu wa Ngozi *",
        experienceLabel: "Miaka ya Uzoefu wa Udaktari *",
        websiteLabel: "Tovuti ya Kituo cha Afya",
        sec4Title: "Ushauri na Mahali Kituo Kilipo",
        consultationTypeLabel: "Njia ya Mashauriano",
        consultBoth: "Ana kwa Ana na Mtandaoni",
        consultOnline: "Mtandaoni Pekee",
        consultPhysical: "Ana kwa Ana Pekee",
        consultationHoursLabel: "Masaa ya Kazi ya Wiki *",
        addressLabel: "Anwani ya Eneo la Kituo *",
        sec5Title: "Wosia na Falsafa ya Udaktari",
        bioLabel: "Maelezo ya Wosia / Falsafa",
        saveProfileBtn: "Hifadhi Prfili Kamili ya Usajili",
        statusVerified: "Imethibitishwa na Inafanya Kazi",
        licensingCardHeader: "Usajili na Leseni",
        facilityCardHeader: "Hospitali na Idara",
        consultationCardHeader: "Mashauriano na Eneo",
        systemLangHeader: "Lugha ya Mfumo / Chagua Lugha",
        bioHeader: "Wosia na Falsafa ya Udaktari",
        saveSuccessAlert: "Prfili kamili ya usajili wa udaktari imesasishwa vyema!"
      },
      fr: {
        registrationCredentials: "Informations d'Enregistrement",
        verifiedAccount: "\u2713 Compte V\xE9rifi\xE9",
        clinicalProfileTitle: "Profil d'Enregistrement Clinique",
        clinicalProfileSub: "Consultez et modifiez votre profil d'enregistrement sp\xE9cialis\xE9 complet.",
        editRegistrationInfo: "Modifier l'Enregistrement",
        cancelEditing: "Annuler la Modification",
        sec1Title: "Coordonn\xE9es et Identifiants du Compte",
        fullNameLabel: "Nom Professionnel Complet *",
        emailLabel: "E-mail du Compte *",
        phoneLabel: "Num\xE9ro de T\xE9l\xE9phone / WhatsApp *",
        sec2Title: "Agr\xE9ment et Licence M\xE9dicale",
        providerTypeLabel: "Type de Prestataire *",
        providerTypeIndiv: "Sp\xE9cialiste Ind\xE9pendant",
        providerTypeClinic: "Clinique Dermatologique Sp\xE9cialis\xE9e",
        providerTypeHospital: "D\xE9partement Hospitalier",
        licensingAuthLabel: "Autorit\xE9 d'Homologation *",
        registrationNumberLabel: "Num\xE9ro d'Immatriculation M\xE9dicale *",
        qualificationsLabel: "Dipl\xF4mes et Qualifications Acad\xE9miques",
        sec3Title: "D\xE9tails de l'\xC9tablissement et Sp\xE9cialit\xE9",
        hospitalNameLabel: "Nom de l'H\xF4pital / Cabinet Principal",
        departmentLabel: "D\xE9partement",
        positionLabel: "Poste / Titre",
        specializationLabel: "Titre de Sp\xE9cialit\xE9 Dermatologique *",
        experienceLabel: "Ann\xE9es d'Exp\xE9rience Pratique *",
        websiteLabel: "Site Web / Portail Clinique",
        sec4Title: "Consultations et Emplacement",
        consultationTypeLabel: "Mode de Consultation",
        consultBoth: "En Pr\xE9sentiel et T\xE9l\xE9-dermatologie",
        consultOnline: "T\xE9l\xE9-dermatologie Uniquement",
        consultPhysical: "En Pr\xE9sentiel Uniquement",
        consultationHoursLabel: "Heures de Consultation Hebdomadaires *",
        addressLabel: "Adresse Physique de la Clinique *",
        sec5Title: "Biographie Clinique & Philosophie",
        bioLabel: "Biographie / Philosophie Professionnelle",
        saveProfileBtn: "Enregistrer l'Ensemble du Profil",
        statusVerified: "V\xE9rifi\xE9 & Actif",
        licensingCardHeader: "Agr\xE9ment & Licences",
        facilityCardHeader: "\xC9tablissement & H\xF4pital",
        consultationCardHeader: "Consultation & Localisation",
        systemLangHeader: "Langue du Syst\xE8me / Choisir la Langue",
        bioHeader: "Biographie Clinique & Philosophie",
        saveSuccessAlert: "Le profil d'enregistrement clinique complet a \xE9t\xE9 mis \xE0 jour avec succ\xE8s !"
      }
    };
    const pT = profileTranslations[currentLanguage] || profileTranslations.en;
    return <div id="doctor_profile_tab" className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      {pT.registrationCredentials}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {pT.verifiedAccount}
                    </span>
                  </div>
                  <h2 className="font-display font-extrabold text-xl text-slate-900 mt-1">{pT.clinicalProfileTitle}</h2>
                  <p className="text-xs text-slate-500">{pT.clinicalProfileSub}</p>
                </div>

                <button
      type="button"
      onClick={() => setShowEditProfile(!showEditProfile)}
      className={`px-4 py-2.5 text-xs font-black rounded-xl border transition-all flex items-center justify-center gap-2 shrink-0 ${showEditProfile ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300" : "bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-sm"}`}
    >
                  <span className="material-symbols-outlined text-base">
                    {showEditProfile ? "close" : "edit_square"}
                  </span>
                  <span>{showEditProfile ? pT.cancelEditing : pT.editRegistrationInfo}</span>
                </button>
              </div>

              {showEditProfile ? <form onSubmit={(e) => {
      e.preventDefault();
      const updatedUser = {
        ...user,
        name: profForm.name,
        email: profForm.email,
        phone: profForm.phone,
        providerType: profForm.providerType,
        licensingAuthority: profForm.licensingAuthority,
        registrationNumber: profForm.registrationNumber,
        specialization: profForm.specialization,
        experience: profForm.experience,
        qualifications: profForm.qualifications,
        hospitalName: profForm.hospitalName,
        department: profForm.department,
        position: profForm.position,
        website: profForm.website,
        address: profForm.address,
        consultationType: profForm.consultationType,
        consultationHours: profForm.consultationHours,
        bio: profForm.bio,
        profilePic: profForm.profilePic || user.profilePic
      };
      onUpdateUser(updatedUser);
      setShowEditProfile(false);
      alert(pT.saveSuccessAlert);
    }} className="space-y-6">
                  {
      /* 1. Account & Personal Credentials */
    }
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">1</span>
                      <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">{pT.sec1Title}</h3>
                    </div>

                    {
      /* Circular Avatar Upload in Edit Form */
    }
                    <div className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl">
                      <div className="relative group shrink-0">
                        <div
      onClick={() => avatarFileInputRef.current?.click()}
      title="Click to upload profile picture"
      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-blue-600 shadow-md bg-slate-100 relative cursor-pointer block transition-transform duration-200 hover:scale-105"
    >
                          {profForm.profilePic || user.profilePic ? <img
      src={profForm.profilePic || user.profilePic}
      alt="Doctor Avatar"
      referrerPolicy="no-referrer"
      className="w-full h-full object-cover object-center"
    /> : <div className="w-full h-full flex items-center justify-center font-black text-xl text-white bg-gradient-to-br from-blue-600 to-indigo-700">
                              {profForm.name ? profForm.name.split(" ").pop()?.charAt(0) : "D"}
                            </div>}

                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white gap-0.5">
                            <span className="material-symbols-outlined text-lg">edit</span>
                            <span className="text-[9px] font-bold uppercase">Edit</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-900">Doctor Profile Picture</h4>
                        <p className="text-[11px] text-slate-500">
                          Visible to hospital administrators and patients across consultations.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
      type="button"
      onClick={() => avatarFileInputRef.current?.click()}
      className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold border border-blue-200 flex items-center gap-1 transition-all"
    >
                            <span className="material-symbols-outlined text-xs">upload</span>
                            <span>Upload Photo</span>
                          </button>
                          {(profForm.profilePic || user.profilePic) && <button
      type="button"
      onClick={handleRemoveAvatar}
      className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all"
    >
                              Remove
                            </button>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.fullNameLabel}</label>
                        <input
      type="text"
      required
      value={profForm.name}
      onChange={(e) => setProfForm({ ...profForm, name: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="Dr. Sarah Namubiru"
    />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.emailLabel}</label>
                        <input
      type="email"
      required
      value={profForm.email}
      onChange={(e) => setProfForm({ ...profForm, email: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="sarah.doctor@moyo-health.app"
    />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.phoneLabel}</label>
                        <input
      type="text"
      required
      value={profForm.phone}
      onChange={(e) => setProfForm({ ...profForm, phone: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="+256 701 123456"
    />
                      </div>
                    </div>
                  </div>

                  {
      /* 2. Medical Licensing & Accreditation */
    }
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">2</span>
                      <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">{pT.sec2Title}</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.providerTypeLabel}</label>
                        <select
      value={profForm.providerType}
      onChange={(e) => setProfForm({ ...profForm, providerType: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
    >
                          <option value="Individual">{pT.providerTypeIndiv}</option>
                          <option value="Clinic">{pT.providerTypeClinic}</option>
                          <option value="Hospital">{pT.providerTypeHospital}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.licensingAuthLabel}</label>
                        <input
      type="text"
      required
      value={profForm.licensingAuthority}
      onChange={(e) => setProfForm({ ...profForm, licensingAuthority: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="Medical Practitioners Council"
    />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.registrationNumberLabel}</label>
                        <input
      type="text"
      required
      value={profForm.registrationNumber}
      onChange={(e) => setProfForm({ ...profForm, registrationNumber: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-blue-600"
      placeholder="MED-UG-88492"
    />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.qualificationsLabel}</label>
                        <input
      type="text"
      value={profForm.qualifications}
      onChange={(e) => setProfForm({ ...profForm, qualifications: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="MBChB, MMed Dermatology, FWACP"
    />
                      </div>
                    </div>
                  </div>

                  {
      /* 3. Facility, Specialty & Practice Details */
    }
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">3</span>
                      <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">{pT.sec3Title}</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.hospitalNameLabel}</label>
                        <input
      type="text"
      value={profForm.hospitalName}
      onChange={(e) => setProfForm({ ...profForm, hospitalName: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="Central Referral Clinic"
    />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.departmentLabel}</label>
                        <input
      type="text"
      value={profForm.department}
      onChange={(e) => setProfForm({ ...profForm, department: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="Dermatology & Skin Surgery"
    />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.positionLabel}</label>
                        <input
      type="text"
      value={profForm.position}
      onChange={(e) => setProfForm({ ...profForm, position: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="Senior Consultant Dermatologist"
    />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.specializationLabel}</label>
                        <input
      type="text"
      required
      value={profForm.specialization}
      onChange={(e) => setProfForm({ ...profForm, specialization: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="Clinical Dermatologist"
    />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.experienceLabel}</label>
                        <input
      type="text"
      required
      value={profForm.experience}
      onChange={(e) => setProfForm({ ...profForm, experience: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="8 Years"
    />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.websiteLabel}</label>
                        <input
      type="url"
      value={profForm.website}
      onChange={(e) => setProfForm({ ...profForm, website: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="https://moyo-health.app"
    />
                      </div>
                    </div>
                  </div>

                  {
      /* 4. Consultation & Physical Location */
    }
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">4</span>
                      <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">{pT.sec4Title}</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.consultationTypeLabel}</label>
                        <select
      value={profForm.consultationType}
      onChange={(e) => setProfForm({ ...profForm, consultationType: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
    >
                          <option value="Both">{pT.consultBoth}</option>
                          <option value="Online">{pT.consultOnline}</option>
                          <option value="Physical">{pT.consultPhysical}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.consultationHoursLabel}</label>
                        <input
      type="text"
      required
      value={profForm.consultationHours}
      onChange={(e) => setProfForm({ ...profForm, consultationHours: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="09:00 AM - 05:00 PM (Mon - Fri)"
    />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.addressLabel}</label>
                        <input
      type="text"
      required
      value={profForm.address}
      onChange={(e) => setProfForm({ ...profForm, address: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
      placeholder="Central Referral Clinic, Jinja Rd, Kampala"
    />
                      </div>
                    </div>
                  </div>

                  {
      /* 5. Biography */
    }
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">5</span>
                      <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">{pT.sec5Title}</h3>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">{pT.bioLabel}</label>
                      <textarea
      rows={3}
      value={profForm.bio}
      onChange={(e) => setProfForm({ ...profForm, bio: e.target.value })}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 resize-none"
      placeholder="Dermatology specialist passionate about high-quality patient skin triage..."
    />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
      type="submit"
      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
    >
                      <span className="material-symbols-outlined text-lg">save</span>
                      <span>{pT.saveProfileBtn}</span>
                    </button>

                    <button
      type="button"
      onClick={() => setShowEditProfile(false)}
      className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300"
    >
                      {pT.cancelEditing}
                    </button>
                  </div>
                </form> : <div className="space-y-5 text-xs leading-relaxed">
                  {
      /* Hidden file input for avatar upload */
    }
                  <input
      type="file"
      ref={avatarFileInputRef}
      accept="image/*"
      className="hidden"
      onChange={handleAvatarFileChange}
    />

                  {
      /* Avatar Upload Feedback Banner */
    }
                  {avatarSuccessToast && <div className="p-3.5 bg-emerald-500/20 border border-emerald-400/60 text-emerald-100 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-emerald-400">check_circle</span>
                        <span>{avatarSuccessToast}</span>
                      </div>
                      <button
      type="button"
      onClick={() => setAvatarSuccessToast(null)}
      className="text-emerald-300 hover:text-white font-black text-xs px-1.5 py-0.5 rounded"
    >
                        ✕
                      </button>
                    </div>}

                  {
      /* Specialist Profile Card */
    }
                  <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-md">
                    <div className="flex items-center gap-4 sm:gap-5">
                      {
      /* Prominent Circular User Avatar Upload Component */
    }
                      <div className="relative group shrink-0">
                        <button
      type="button"
      id="doctor_avatar_upload_trigger"
      onClick={() => avatarFileInputRef.current?.click()}
      title="Click to change profile picture"
      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-white/60 ring-4 ring-blue-500/40 shadow-xl bg-blue-600 relative cursor-pointer block transition-all duration-200 hover:scale-105 active:scale-95 text-left focus:outline-none focus:ring-4 focus:ring-blue-400"
    >
                          {user.profilePic || profForm.profilePic ? <img
      id="doctor_profile_avatar_img"
      src={user.profilePic || profForm.profilePic}
      alt={user.name}
      referrerPolicy="no-referrer"
      className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-300"
      onError={(e) => {
        e.target.style.display = "none";
      }}
    /> : <div className="w-full h-full flex items-center justify-center font-black text-2xl sm:text-3xl text-white bg-gradient-to-br from-blue-600 to-indigo-800">
                              {user.name ? user.name.split(" ").pop()?.charAt(0) : "D"}
                            </div>}

                          {
      /* Hover effect displaying 'Edit' icon */
    }
                          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white gap-0.5 pointer-events-none">
                            <span className="material-symbols-outlined text-xl sm:text-2xl drop-shadow">edit</span>
                            <span className="text-[9px] font-black uppercase tracking-wider drop-shadow">Edit</span>
                          </div>

                          {
      /* Uploading loading spinner */
    }
                          {isUploadingAvatar && <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center text-white">
                              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                            </div>}
                        </button>

                        {
      /* Circular badge indicator button at bottom-right */
    }
                        <button
      type="button"
      onClick={() => avatarFileInputRef.current?.click()}
      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-90 text-white border-2 border-white shadow-md flex items-center justify-center transition-all duration-150 cursor-pointer"
      title="Upload new profile photo"
    >
                          <span className="material-symbols-outlined text-[15px]">photo_camera</span>
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-extrabold text-white">{user.name}</h3>
                          <span className="bg-blue-500/20 text-blue-300 text-[10px] font-extrabold px-2 py-0.5 rounded border border-blue-400/30">
                            {user.providerType === "Clinic" ? pT.providerTypeClinic : user.providerType === "Hospital" ? pT.providerTypeHospital : pT.providerTypeIndiv}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium">
                          {user.specialization || "Clinical Dermatologist"} • {user.experience || "8 Years"}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          📧 {user.email || "doctor@moyo-health.app"} | 📞 {user.phone || "+256 701 123456"}
                        </p>
                        <div className="flex items-center gap-3 pt-1">
                          <button
      type="button"
      onClick={() => avatarFileInputRef.current?.click()}
      className="text-[11px] font-bold text-blue-300 hover:text-white flex items-center gap-1 transition-colors underline cursor-pointer"
    >
                            <span className="material-symbols-outlined text-xs">upload</span>
                            <span>Change Profile Picture</span>
                          </button>
                          {(user.profilePic || profForm.profilePic) && <button
      type="button"
      onClick={handleRemoveAvatar}
      className="text-[11px] font-bold text-rose-300 hover:text-rose-100 flex items-center gap-1 transition-colors cursor-pointer"
    >
                              <span className="material-symbols-outlined text-xs">delete</span>
                              <span>Remove</span>
                            </button>}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/10 p-3 rounded-xl backdrop-blur-md border border-white/10 text-right self-stretch sm:self-auto flex sm:flex-col justify-between items-center sm:items-end">
                      <span className="text-[10px] text-slate-300 uppercase font-extrabold block">Status</span>
                      <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>{pT.statusVerified}</span>
                      </span>
                    </div>
                  </div>

                  {
      /* Registration Details Grid */
    }
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {
      /* Licensing & Registration Card */
    }
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
                      <div className="flex items-center gap-2 text-slate-900 font-extrabold border-b border-slate-200/80 pb-2">
                        <span className="material-symbols-outlined text-blue-600 text-lg">verified_user</span>
                        <span className="text-xs uppercase tracking-wider">{pT.licensingCardHeader}</span>
                      </div>
                      <div className="space-y-1.5 pt-1 text-slate-700">
                        <p className="flex justify-between gap-2">
                          <strong className="text-slate-500 font-medium shrink-0">{pT.licensingAuthLabel.replace(" *", "")}:</strong>
                          <span className="font-bold text-slate-900 text-right">{user.licensingAuthority || "Medical Practitioners Council"}</span>
                        </p>
                        <p className="flex justify-between gap-2">
                          <strong className="text-slate-500 font-medium shrink-0">{pT.registrationNumberLabel.replace(" *", "")}:</strong>
                          <span className="font-mono font-bold text-blue-700 text-right">{user.registrationNumber || "MED-UG-88492"}</span>
                        </p>
                        <p className="flex justify-between gap-2">
                          <strong className="text-slate-500 font-medium shrink-0">{pT.qualificationsLabel}:</strong>
                          <span className="font-bold text-slate-900 text-right">{user.qualifications || "MBChB, MMed Dermatology"}</span>
                        </p>
                      </div>
                    </div>

                    {
      /* Practice & Facility Card */
    }
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
                      <div className="flex items-center gap-2 text-slate-900 font-extrabold border-b border-slate-200/80 pb-2">
                        <span className="material-symbols-outlined text-blue-600 text-lg">local_hospital</span>
                        <span className="text-xs uppercase tracking-wider">{pT.facilityCardHeader}</span>
                      </div>
                      <div className="space-y-1.5 pt-1 text-slate-700">
                        <p className="flex justify-between gap-2">
                          <strong className="text-slate-500 font-medium shrink-0">{pT.hospitalNameLabel}:</strong>
                          <span className="font-bold text-slate-900 text-right">{user.hospitalName || "Central Referral Clinic"}</span>
                        </p>
                        <p className="flex justify-between gap-2">
                          <strong className="text-slate-500 font-medium shrink-0">{pT.departmentLabel} & {pT.positionLabel}:</strong>
                          <span className="font-bold text-slate-900 text-right">{user.department || "Dermatology"} ({user.position || "Consultant"})</span>
                        </p>
                        <p className="flex justify-between gap-2">
                          <strong className="text-slate-500 font-medium shrink-0">{pT.websiteLabel}:</strong>
                          <a href={user.website || "#"} target="_blank" rel="noreferrer" className="font-bold text-blue-600 underline truncate max-w-[150px]">
                            {user.website || "https://moyo-health.app"}
                          </a>
                        </p>
                      </div>
                    </div>

                    {
      /* Consultation & Hours Card */
    }
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2 md:col-span-2">
                      <div className="flex items-center gap-2 text-slate-900 font-extrabold border-b border-slate-200/80 pb-2">
                        <span className="material-symbols-outlined text-blue-600 text-lg">schedule</span>
                        <span className="text-xs uppercase tracking-wider">{pT.consultationCardHeader}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-slate-700">
                        <div>
                          <strong className="text-slate-500 font-medium block text-[10px] uppercase">{pT.consultationTypeLabel}</strong>
                          <span className="font-bold text-slate-900">
                            {user.consultationType === "Online" ? pT.consultOnline : user.consultationType === "Physical" ? pT.consultPhysical : pT.consultBoth}
                          </span>
                        </div>
                        <div>
                          <strong className="text-slate-500 font-medium block text-[10px] uppercase">{pT.consultationHoursLabel.replace(" *", "")}</strong>
                          <span className="font-bold text-slate-900">{user.consultationHours || "09:00 AM - 05:00 PM"}</span>
                        </div>
                        <div>
                          <strong className="text-slate-500 font-medium block text-[10px] uppercase">{pT.addressLabel.replace(" *", "")}</strong>
                          <span className="font-bold text-slate-900">{user.address || "Central Clinic, Jinja Rd, Kampala"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {
      /* System Language Settings */
    }
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                    <span className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-blue-600 text-sm">translate</span>
                      {pT.systemLangHeader}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
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
      className={`py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-between transition-all ${currentLanguage === lang.code ? "bg-blue-600 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"}`}
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
      /* Clinical Bio */
    }
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                    <span className="block font-extrabold text-slate-900 text-xs">{pT.bioHeader}</span>
                    <p className="text-slate-600 italic">"{user.bio || "Dedicated to bringing modern, remote skincare solutions to patients across the region."}"</p>
                  </div>
                </div>}
            </div>;
  })()}
      </main>

      {/* Specialist Diagnostic Modal (with live server-side AI case analysis summary) */}
      {selectedCase && <div className="fixed inset-0 z-50 glass-overlay-backdrop flex items-center justify-center p-4">
          <div className="glass-modal rounded-3xl w-full max-w-2xl p-6 md:p-8 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto relative">
            <button
    onClick={() => setSelectedCase(null)}
    className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1 rounded-full"
  >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="border-b pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-display font-extrabold text-lg text-slate-900">Patient Diagnostic File: {selectedCase.patientName}</h3>
                <span className="text-[10px] text-slate-500 font-mono">ID: {selectedCase.patientNumber || selectedCase.patientId} • Case #{selectedCase.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded border uppercase ${selectedCase.status === "Diagnosed" || selectedCase.diagnosisReport ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                  {selectedCase.status === "Diagnosed" || selectedCase.diagnosisReport ? "Completed & Certified" : "Pending Review"}
                </span>
                {(selectedCase.status === "Diagnosed" || selectedCase.diagnosisReport) && <button
    type="button"
    onClick={() => handleDownloadReportPDF(selectedCase)}
    disabled={exportingCaseId === selectedCase.id}
    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all cursor-pointer disabled:bg-slate-300"
    title="Export Branded PDF"
  >
                    <span className="material-symbols-outlined text-xs">picture_as_pdf</span>
                    <span>{exportingCaseId === selectedCase.id ? "PDF..." : "Export PDF"}</span>
                  </button>}
              </div>
            </div>

            {
    /* Case Details */
  }
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 shrink-0">
                <span className="block text-xs font-bold text-slate-500 mb-1">Lesion Photo</span>
                {selectedCase.mediaUrl ? <img src={selectedCase.mediaUrl} alt="Skin lesion" className="w-full h-32 object-cover rounded-xl border" /> : <div className="w-full h-32 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl">image_not_supported</span>
                  </div>}
              </div>
              <div className="sm:col-span-2 space-y-2">
                <span className="block text-xs font-bold text-slate-500">Symptoms Description</span>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border italic leading-relaxed">"{selectedCase.symptoms}"</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                  <span>Submitted: {selectedCase.createdAt}</span>
                </div>
              </div>
            </div>

            {
    /* AI Patient Report Summarizer Trigger Section */
  }
            <div className="bg-[#f0f9ff] border border-sky-100 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sky-600 animate-pulse font-bold">clinical_notes</span>
                  <span className="text-xs font-black text-sky-950 uppercase tracking-wider">AI Patient Triage Insights</span>
                </div>

                <button
    type="button"
    onClick={() => handleFetchAISummaryReport(selectedCase)}
    disabled={isFetchingAIAnalysis}
    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm disabled:bg-slate-300 cursor-pointer"
  >
                  <span className="material-symbols-outlined text-xs">analytics</span>
                  {isFetchingAIAnalysis ? "Consulting Gemini..." : "Generate Summarized Report from AI"}
                </button>
              </div>

              {
    /* Triage Summary display */
  }
              {isFetchingAIAnalysis ? <div className="h-20 bg-sky-50 rounded-xl animate-pulse flex items-center justify-center text-xs text-sky-700 font-medium">
                  Gemini is analyzing voice transcripts & cutaneous lesions symptoms...
                </div> : aiAnalysisResult ? <div className="bg-white p-3 rounded-xl border border-sky-100 text-xs text-sky-950 space-y-2 leading-relaxed">
                  <div className="whitespace-pre-line">{aiAnalysisResult}</div>
                </div> : <p className="text-[10px] text-sky-700 italic">Click the button above to run real-time server-side Gemini AI summarization on the symptoms and audio transcripts.</p>}
            </div>

            {
    /* If Diagnosed: Display Certified Diagnostic Dossier with Download CTA */
  }
            {selectedCase.status === "Diagnosed" || selectedCase.diagnosisReport ? <div className="space-y-4 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black tracking-widest uppercase text-slate-500">Official Clinical Diagnosis</h4>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    Certified Report
                  </span>
                </div>

                {
    /* Branded Diagnosis Card */
  }
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Diagnosed Condition</span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                      {selectedCase.diagnosisReport?.diagnosedCondition}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/60 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Prescription Regimen (Rx)</span>
                      <p className="text-slate-800 font-medium mt-0.5">
                        {selectedCase.diagnosisReport?.prescription || "None specified."}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Attending Specialist</span>
                      <p className="text-slate-800 font-medium mt-0.5">
                        {selectedCase.diagnosisReport?.specialistName || user.name}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-200/60 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Clinical Observation Notes</span>
                    <p className="text-slate-700 mt-0.5 leading-relaxed bg-white/80 p-3 rounded-xl border border-emerald-100 italic">
                      "{selectedCase.diagnosisReport?.notes}"
                    </p>
                  </div>
                </div>

                {
    /* Download PDF Actions Bar */
  }
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-blue-600">verified_user</span>
                    <span>Official medical document with clinical stamp, Rx regimen & license info</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
    type="button"
    onClick={() => setSelectedCase(null)}
    className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer"
  >
                      Close
                    </button>
                    <button
    id="btn_modal_download_report_pdf"
    type="button"
    onClick={() => handleDownloadReportPDF(selectedCase)}
    disabled={exportingCaseId === selectedCase.id}
    className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:bg-slate-300"
  >
                      <span className="material-symbols-outlined text-base">
                        {exportingCaseId === selectedCase.id ? "hourglass_empty" : "picture_as_pdf"}
                      </span>
                      <span>
                        {exportingCaseId === selectedCase.id ? "Generating Branded PDF..." : "Download Branded PDF Report"}
                      </span>
                    </button>
                  </div>
                </div>
              </div> : (
    /* Pending Form: Diagnose / Prescribe Form */
    <form onSubmit={(e) => handleDiagnoseSubmit(e, false)} className="space-y-4 pt-2 border-t">
                <h4 className="text-xs font-black tracking-widest uppercase text-slate-500">Clinical Diagnosis & Prescriptions</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Diagnosed Condition *</label>
                    <input
      type="text"
      required
      placeholder="e.g. Mild Atopic Eczema"
      value={diagnosedCondition}
      onChange={(e) => setDiagnosedCondition(e.target.value)}
      className="w-full p-2 bg-slate-50 border rounded-lg text-xs focus:border-blue-600 outline-none"
    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Prescription Skincare Plan (Medicines/Creams)</label>
                    <input
      type="text"
      placeholder="e.g. Hydrocortisone 1% cream twice daily for 5 days"
      value={prescribedMedicine}
      onChange={(e) => setPrescribedMedicine(e.target.value)}
      className="w-full p-2 bg-slate-50 border rounded-lg text-xs focus:border-blue-600 outline-none"
    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">Clinical Observation Notes *</label>
                  <textarea
      required
      rows={3}
      placeholder="Provide precise observation notes and follow-up guidance..."
      value={clinicalNotes}
      onChange={(e) => setClinicalNotes(e.target.value)}
      className="w-full p-2 bg-slate-50 border rounded-lg text-xs focus:border-blue-600 outline-none resize-none"
    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
      type="button"
      onClick={handleExportCurrentDraftPDF}
      disabled={!diagnosedCondition && !clinicalNotes}
      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
      title="Export draft diagnosis as branded PDF"
    >
                    <span className="material-symbols-outlined text-sm text-blue-600">picture_as_pdf</span>
                    <span>Preview Draft PDF</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
      type="button"
      onClick={() => setSelectedCase(null)}
      className="px-4 py-2 border text-xs text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer"
    >
                      Cancel
                    </button>
                    <button
      type="button"
      onClick={(e) => handleDiagnoseSubmit(e, true)}
      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
      title="Submit diagnosis and immediately download branded PDF"
    >
                      <span className="material-symbols-outlined text-sm">download_done</span>
                      <span>Submit & Download PDF</span>
                    </button>
                    <button
      type="submit"
      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
    >
                      Verify & Submit
                    </button>
                  </div>
                </div>
              </form>
  )}
          </div>
        </div>}

      {/* Modal 1: Tick Consultation Event When Done (✓) */}
      {completeModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-800 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">task_alt</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Mark Event Completed ✓</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Conclude consultation and archive to patient record</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompleteModalApp(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Event Summary Card */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                {completeModalApp.lesionImage ? (
                  <img
                    src={completeModalApp.lesionImage}
                    alt="Patient lesion"
                    className="w-11 h-11 rounded-xl object-cover border border-emerald-300 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-emerald-200 text-emerald-900 flex items-center justify-center font-bold text-sm shrink-0">
                    {completeModalApp.patientName ? completeModalApp.patientName.charAt(0) : "P"}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-extrabold text-slate-900 truncate">{completeModalApp.patientName}</h4>
                  <p className="text-slate-600 font-mono text-[11px]">
                    📅 {completeModalApp.date} • ⏰ {completeModalApp.time}
                  </p>
                  <span className="text-[10px] font-bold text-emerald-800">
                    {completeModalApp.type === "Online" ? "🌐 Video Consult" : "🏥 In-Person Examination"}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-600 text-white shrink-0">
                Active Slot
              </span>
            </div>

            {/* Clinical Completion Notes Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const notes = e.target.notes.value.trim() || "Consultation successfully completed with patient. Prescribed treatment plan discussed.";
                handleDoctorCompleteAppointment(completeModalApp.id, notes);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Consultation Conclusion & Outcome Notes *
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue="Consultation completed. Evaluated clinical symptoms, verified skin barrier integrity, and provided follow-up recommendations."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none transition-all"
                  required
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  ✓ Notes will be stamped with completion time and visible on patient's timeline.
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">verified</span>
                <span>Ticking this event marks it as Completed ✓ in the clinical database and crosses it off your pending queue.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompleteModalApp(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-sm font-black">check</span>
                  <span>Confirm & Tick Done (✓)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Cross Event When Missed & Propose Reschedule (✗) */}
      {rescheduleModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-800 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">event_busy</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Cross Event & Request Reschedule ✗</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Mark as missed & send empathetic apology to patient</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalApp(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Event Summary */}
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <h4 className="font-extrabold text-slate-900 truncate">{rescheduleModalApp.patientName}</h4>
                <p className="text-slate-600 font-mono text-[11px]">
                  Original Slot: <strong>{rescheduleModalApp.date}</strong> at <strong>{rescheduleModalApp.time}</strong>
                </p>
                <span className="text-[10px] text-rose-700 font-semibold">
                  Missed / Unattended Session
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-600 text-white shrink-0">
                Cross Off ✗
              </span>
            </div>

            {/* Reschedule Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const reason = e.target.reason.value.trim() || "Specialist was called for urgent clinical duty.";
                const proposedDate = e.target.proposedDate.value || rescheduleModalApp.date;
                const proposedTime = e.target.proposedTime.value || rescheduleModalApp.time;
                handleDoctorRescheduleAppointment(rescheduleModalApp.id, { reason, proposedDate, proposedTime });
              }}
              className="space-y-4"
            >
              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Reason for Missing / Rescheduling Event *
                </label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {[
                    "Urgent emergency surgery",
                    "Hospital triage call",
                    "Critical clinical duties",
                    "Clinic schedule delay"
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const input = document.getElementById("doctor_reschedule_reason_input");
                        if (input) input.value = preset;
                      }}
                      className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-left truncate cursor-pointer transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  id="doctor_reschedule_reason_input"
                  name="reason"
                  rows={2}
                  defaultValue="Specialist was called for urgent emergency surgical duty. We sincerely apologize for any inconvenience caused."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none resize-none transition-all"
                  required
                />
              </div>

              {/* Proposed New Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Proposed Reschedule Date *
                  </label>
                  <input
                    type="date"
                    name="proposedDate"
                    defaultValue={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      return d.toISOString().split("T")[0];
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Proposed Time Slot *
                  </label>
                  <select
                    name="proposedTime"
                    defaultValue={rescheduleModalApp.time || "10:30 AM"}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-500 outline-none"
                    required
                  >
                    {doctorTimeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        ⏰ {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Apology Notice Patient Preview */}
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <span className="material-symbols-outlined text-sm text-amber-600">mail</span>
                  <span>Automated Patient Apology Notice Preview</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed italic">
                  "Dr. {user.name} sends their sincere apologies: your consultation had to be rescheduled due to an urgent medical duty. We propose a new slot, or you can pick any other convenient time from the timetable."
                </p>
                <span className="text-[10px] text-amber-700 font-bold block pt-1">
                  ✓ Patient can accept the proposed date/time or re-select from timetable in one click!
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleModalApp(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>Cross Event & Send Apology Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Adjust Event Reminders & Notification Lead Times */}
      {editingReminderApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-800 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-xl">alarm</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Adjust Event Reminders</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Configure alert triggers for specialist & patient</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingReminderApp(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Event Summary Card */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <h4 className="font-extrabold text-slate-900 truncate">{editingReminderApp.patientName}</h4>
                <p className="text-slate-600 font-mono text-[11px]">
                  📅 {editingReminderApp.date} at ⏰ {editingReminderApp.time} ({editingReminderApp.type})
                </p>
              </div>
              <button
                type="button"
                onClick={() => triggerSpecialistReminderPreview(editingReminderApp, "30m")}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-xs">play_arrow</span>
                <span>Test 30m Chime</span>
              </button>
            </div>

            {/* Reminders Configuration Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const specR = {
                  m30: e.target.specM30.checked,
                  m5: e.target.specM5.checked,
                  h1: e.target.specH1.checked,
                  m15: e.target.specM15.checked,
                  sound: e.target.specSound.checked
                };
                const patR = {
                  h12: e.target.patH12.checked,
                  h1: e.target.patH1.checked,
                  m30: e.target.patM30.checked
                };
                handleSaveReminderSettings(editingReminderApp.id, specR, patR);
              }}
              className="space-y-4"
            >
              {/* Specialist Alert Settings */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Specialist Alert Triggers (Doctor Portal):
                </span>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-600 text-base">alarm</span>
                      <div>
                        <span className="font-bold text-slate-800 block">30 Minutes Before Event</span>
                        <span className="text-[10px] text-slate-500">Notice to review patient case, lesion photo, and dermatoscope notes</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      name="specM30"
                      defaultChecked={editingReminderApp.specialistReminders?.m30 ?? true}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-rose-600 text-base">timer</span>
                      <div>
                        <span className="font-bold text-slate-800 block">5 Minutes Before Event (Urgent)</span>
                        <span className="text-[10px] text-slate-500">Urgent chime & popup alert to start clinical call or room preparation</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      name="specM5"
                      defaultChecked={editingReminderApp.specialistReminders?.m5 ?? true}
                      className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-600 text-base">schedule</span>
                      <div>
                        <span className="font-bold text-slate-800 block">1 Hour Before Event</span>
                        <span className="text-[10px] text-slate-500">Preliminary heads-up on upcoming schedule</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      name="specH1"
                      defaultChecked={editingReminderApp.specialistReminders?.h1 ?? false}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-600 text-base">notifications_active</span>
                      <div>
                        <span className="font-bold text-slate-800 block">Audio Synthesis Chime</span>
                        <span className="text-[10px] text-slate-500">Play pleasant medical chime on alert trigger</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      name="specSound"
                      defaultChecked={editingReminderApp.specialistReminders?.sound ?? true}
                      className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                    />
                  </label>
                  <input type="hidden" name="specM15" defaultChecked={false} />
                </div>
              </div>

              {/* Patient Automated Reminders Sync */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Patient Automated Notices (Synced to Patient Portal):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <label className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col justify-between text-xs cursor-pointer">
                    <span className="font-extrabold text-emerald-950">12h Notice</span>
                    <span className="text-[10px] text-emerald-700">12 hrs before</span>
                    <div className="flex justify-end mt-1">
                      <input
                        type="checkbox"
                        name="patH12"
                        defaultChecked={editingReminderApp.patientReminders?.h12 ?? true}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                    </div>
                  </label>

                  <label className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col justify-between text-xs cursor-pointer">
                    <span className="font-extrabold text-emerald-950">1h Notice</span>
                    <span className="text-[10px] text-emerald-700">1 hr before</span>
                    <div className="flex justify-end mt-1">
                      <input
                        type="checkbox"
                        name="patH1"
                        defaultChecked={editingReminderApp.patientReminders?.h1 ?? true}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                    </div>
                  </label>

                  <label className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col justify-between text-xs cursor-pointer">
                    <span className="font-extrabold text-emerald-950">30m Notice</span>
                    <span className="text-[10px] text-emerald-700">30 mins before</span>
                    <div className="flex justify-end mt-1">
                      <input
                        type="checkbox"
                        name="patM30"
                        defaultChecked={editingReminderApp.patientReminders?.m30 ?? true}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingReminderApp(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-sm">check</span>
                  <span>Save Reminder Preferences</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesion Photo High-Resolution Inspection Modal */}
      {previewLesionPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-5 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">biotech</span>
                <h3 className="font-extrabold text-sm text-white">High-Resolution Dermatoscope Lesion Inspection</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLesionPhoto(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-800 max-h-[70vh]">
              <img
                src={previewLesionPhoto}
                alt="High-resolution patient lesion"
                className="max-h-[65vh] w-auto object-contain"
              />
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-lg text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                PATIENT CASE ATTACHMENT • DERMATOSCOPE OPTICAL MODE
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
              <span>Inspect border regularity, pigment network, and cutaneous symmetry.</span>
              <button
                type="button"
                onClick={() => setPreviewLesionPhoto(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Done Viewing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Action Toast */}
      {appointmentActionToast && (
        <div className={`fixed bottom-6 right-6 z-50 text-white px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 animate-fade-in max-w-sm ${
          appointmentActionToast.type === "success"
            ? "bg-slate-900 border-emerald-500/50"
            : "bg-slate-900 border-rose-500/50"
        }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            appointmentActionToast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}>
            <span className="material-symbols-outlined text-xl">
              {appointmentActionToast.type === "success" ? "check_circle" : "cancel"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold block text-white">
              {appointmentActionToast.type === "success" ? "Appointment Approved" : "Appointment Declined"}
            </span>
            <span className="text-[11px] text-slate-300 block truncate">
              {appointmentActionToast.message}
            </span>
          </div>
          <button
            onClick={() => setAppointmentActionToast(null)}
            className="text-slate-400 hover:text-white p-1 ml-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {
    /* Toast Notification when PDF is downloaded */
  }
      {pdfSuccessToast && <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 animate-fade-in max-w-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold block text-white">Diagnostic Report Exported</span>
            <span className="text-[11px] text-slate-300 block truncate">
              Branded PDF for {pdfSuccessToast.patientName} (Case #{pdfSuccessToast.caseId}) downloaded.
            </span>
          </div>
          <button
    onClick={() => setPdfSuccessToast(null)}
    className="text-slate-400 hover:text-white p-1 ml-1"
  >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>}
    </div>;
}
