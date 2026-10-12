import { useState, useEffect } from "react";
import LoginPortal from "./components/LoginPortal";
import PatientPortal from "./components/PatientPortal";
import DoctorPortal from "./components/DoctorPortal";
import AdminPortal from "./components/AdminPortal";
import { defaultLibrary, defaultFormTemplates, defaultAdminSpecialistChats } from "./data";
import hospitalRoomBg from "./assets/images/derma_hospital_room_1790257705106.jpg";
import {
  saveDocument,
  removeDocument,
  subscribeToCollection,
  seedCollectionIfEmpty,
  syncAllLocalAccounts,
  fetchAllAccountsFromCloud
} from "./services/firebaseSync";

export const initialDefaultAccounts = [
  {
    id: "0000000001",
    email: "admin23@gmail.com",
    passwordHash: "1234567890",
    role: "admin",
    status: "Approved",
    name: "Super Admin",
    phone: "+256 701 983247",
    department: "System Security & Administration",
    createdAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "1307715995",
    email: "marvinssozi23@gmail.com",
    passwordHash: "smarthealth2026",
    role: "patient",
    status: "Approved",
    name: "Ssozi Marvin Peter",
    phone: "+256742874403",
    dob: "2026-06-30",
    gender: "Male",
    theme: "light",
    fontSize: "md",
    language: "en",
    subscription: "free",
    createdAt: "2026-07-19T14:59:26.860Z"
  },
  {
    id: "1029384756",
    email: "marvinssozi23@gmail.com",
    passwordHash: "alex123",
    role: "patient",
    status: "Approved",
    name: "Marvin Ssozi",
    phone: "+256 772 123456",
    dob: "1995-10-15",
    gender: "Male",
    theme: "light",
    fontSize: "md",
    language: "en",
    subscription: "free",
    createdAt: "2026-07-01T00:00:00.000Z"
  },
  {
    id: "3669997048",
    email: "rtv@gmail.com",
    passwordHash: "1234567890",
    role: "patient",
    status: "Approved",
    name: "marvin",
    phone: "+256 345678",
    dob: "2026-09-11",
    gender: "Male",
    nationality: "Uganda",
    country: "Uganda",
    district: "Kampala",
    city: "kampala",
    address: "kyengera",
    digitalSignature: "m",
    primarySkinConcern: "General Rash / Irritation",
    theme: "light",
    fontSize: "md",
    language: "en",
    subscription: "free",
    createdAt: "2026-10-07T08:12:42.103Z"
  },
  {
    id: "4408172130",
    email: "rvinspeter23@gmail.com",
    passwordHash: "1234567890",
    role: "patient",
    status: "Approved",
    name: "marvin ssozi",
    phone: "+256 777449640",
    dob: "2026-09-01",
    gender: "Female",
    nationality: "Uganda",
    country: "Uganda",
    district: "Kampala",
    city: "kampala",
    address: "kyengera",
    theme: "light",
    fontSize: "md",
    language: "en",
    subscription: "free",
    createdAt: "2026-09-24T13:38:31.582Z"
  },
  {
    id: "5683599573",
    email: "ben@gmail.com",
    passwordHash: "zxcvbnmasd",
    role: "patient",
    status: "Approved",
    name: "john ben",
    phone: "+256 770000000",
    dob: "2026-10-03",
    gender: "Male",
    nationality: "Uganda",
    country: "Uganda",
    district: "Kampala",
    city: "kampala",
    address: "kyengera",
    digitalSignature: "ben",
    primarySkinConcern: "General Rash / Irritation",
    theme: "light",
    fontSize: "md",
    language: "en",
    subscription: "free",
    createdAt: "2026-10-09T13:40:03.134Z"
  },
  {
    id: "alex_patient",
    email: "alex@example.com",
    passwordHash: "alex123",
    role: "patient",
    status: "Approved",
    name: "Alex Mukasa",
    phone: "+256 772 987654",
    dob: "1996-04-12",
    gender: "Male",
    theme: "light",
    fontSize: "md",
    language: "en",
    subscription: "free",
    createdAt: "2026-07-01T00:00:00.000Z"
  },
  {
    id: "doctor_sarah",
    email: "sarah@clinic.com",
    passwordHash: "sarah123",
    role: "specialist",
    status: "Approved",
    name: "Dr. Sarah Jenkins",
    phone: "+256 701 987654",
    providerType: "Individual",
    specialization: "Dermatologist",
    registrationNumber: "LIC-9012-S",
    licensingAuthority: "Uganda Medical Council",
    experience: "8 Years",
    address: "Central Skin Clinic, Jinja Rd, Kampala",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday"],
    consultationHours: "09:00 AM - 05:00 PM",
    consultationType: "Both",
    bio: "Board-certified clinical dermatologist specializing in chronic skin disorders and laser-dermal therapies.",
    profilePic: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80",
    createdAt: "2026-07-01T00:00:00.000Z"
  },
  {
    id: "6998552854",
    email: "dennis@clinic.com",
    passwordHash: "dennis123",
    role: "specialist",
    status: "Approved",
    name: "Dr. Dennis Ssozi",
    phone: "+256 752 111222",
    providerType: "Clinic",
    specialization: "Allergy & Clinical Dermatology",
    registrationNumber: "REG-8842-A",
    licensingAuthority: "Uganda Medical & Dental Practitioners Council",
    experience: "12 Years",
    qualifications: "MBChB (Makerere), MMed (Dermatology), Dip. Allergy (UK)",
    hospitalName: "Metro Allergy & Skin Care Clinic",
    department: "Cutaneous Immunology & Laser Surgery",
    position: "Lead Medical Director",
    website: "https://metroallergy.co.ug",
    address: "Plot 45 Kampala Road, Metro Health Complex, Kampala",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    consultationHours: "08:30 AM - 04:30 PM",
    consultationType: "Both",
    services: ["General Dermatology", "Allergy Patch Testing", "Skin Biopsy", "Phototherapy"],
    bio: "Clinical immunology officer with 12+ years expertise dedicated to high-quality dermal testing and contact allergy management.",
    profilePic: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80",
    createdAt: "2026-07-01T00:00:00.000Z"
  },
  {
    id: "9769776628",
    email: "dennis@clinic.com",
    passwordHash: "dennis123",
    role: "specialist",
    status: "Approved",
    name: "Dr. Dennis Ssozi",
    phone: "+256 752 111222",
    providerType: "Clinic",
    specialization: "Allergy Specialist",
    registrationNumber: "REG-8842-A",
    licensingAuthority: "Ministry of Health",
    experience: "12 Years",
    address: "Metro Allergy Care, Kampala",
    bio: "Clinical immunology officer dedicated to high-quality dermal testing and contact allergy management.",
    profilePic: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80",
    createdAt: "2026-07-19T14:09:55.031Z"
  },
  {
    id: "9397678915",
    email: "khs@gmail.com",
    passwordHash: "1234567890",
    role: "specialist",
    status: "Approved",
    name: "KHS ",
    phone: "",
    providerType: "Hospital",
    specialization: "Dermatologist",
    registrationNumber: "SYYEYEE",
    experience: "1 Years",
    address: "kampala road",
    services: ["Dermatology", "Laboratory"],
    workingDays: ["Monday", "Tuesday", "Wednesday"],
    consultationHours: "09:00 AM - 05:00 PM",
    consultationType: "Both",
    bio: "Registered healthcare hospital practicing premium dermatology.",
    profilePic: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=300&q=80",
    createdAt: "2026-07-19T15:07:28.251Z"
  },
  {
    id: "doctor_dennis",
    email: "dennis@clinic.com",
    passwordHash: "dennis123",
    role: "specialist",
    status: "Pending",
    name: "Dr. Dennis Ssozi",
    phone: "+256 752 111222",
    providerType: "Clinic",
    specialization: "Allergy & Clinical Dermatology",
    registrationNumber: "REG-8842-A",
    licensingAuthority: "Uganda Medical & Dental Practitioners Council",
    experience: "12 Years",
    qualifications: "MBChB (Makerere), MMed (Dermatology), Dip. Allergy (UK)",
    hospitalName: "Metro Allergy & Skin Care Clinic",
    department: "Cutaneous Immunology & Laser Surgery",
    position: "Lead Medical Director",
    website: "https://metroallergy.co.ug",
    address: "Plot 45 Kampala Road, Metro Health Complex, Kampala",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    consultationHours: "08:30 AM - 04:30 PM",
    consultationType: "Both",
    services: ["General Dermatology", "Allergy Patch Testing", "Skin Biopsy", "Phototherapy"],
    bio: "Clinical immunology officer with 12+ years expertise dedicated to high-quality dermal testing and contact allergy management.",
    uploadedDocs: {
      license: "practising_licence_dr_dennis_2026.pdf",
      cert: "medical_registration_cert_dennis.pdf",
      idDoc: "national_id_card_dennis.pdf"
    },
    profilePic: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80",
    createdAt: "2026-07-01T00:00:00.000Z"
  }
];

export const initialDefaultCases = [
  {
    id: "81029",
    patientId: "1029384756",
    patientName: "Marvin Ssozi",
    patientEmail: "marvinssozi23@gmail.com",
    patientNumber: "1029384756",
    specialistId: "doctor_sarah",
    status: "Diagnosed",
    createdAt: "2026-07-18T10:00:00.000Z",
    mediaUrl: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=400&q=80",
    symptoms: "Mild atopic scaling and dry irritation across lower cheek after utilizing secondary cosmetics.",
    transcription: "I have a dry scaling spot on my cheek that developed three days ago after applying face cream.",
    aiTriageSummary: "AI Triage Probability: 84% - Early Stage Atopic Dermatitis. High correlation with soap product contacts.",
    diagnosisReport: {
      diagnosedCondition: "Contact Atopic Dermatitis",
      notes: "Observed superficial scaling and erythematous patches on bilateral cheeks. Patient skin barrier is intact but sensitive to synthetic additives.",
      prescription: "Apply hypoallergenic moisturizers thrice daily. Discontinue previous perfumed cosmetics.",
      specialistName: "Dr. Sarah Jenkins"
    }
  }
];

export const initialDefaultAppointments = [
  {
    id: "2001",
    patientId: "1029384756",
    patientName: "Marvin Ssozi",
    patientEmail: "marvinssozi23@gmail.com",
    patientPhone: "+256 772 123456",
    specialistId: "doctor_sarah",
    specialistName: "Dr. Sarah Jenkins",
    date: "2026-07-21",
    time: "10:00 AM",
    type: "Online",
    status: "Accepted"
  }
];

export default function App() {
  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem("sh_accounts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return initialDefaultAccounts;
  });
  const [cases, setCases] = useState(() => {
    const saved = localStorage.getItem("sh_cases");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return initialDefaultCases;
  });
  const [appointments, setAppointments] = useState(() => {
    const saved = localStorage.getItem("sh_appointments");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return initialDefaultAppointments;
  });
  const [libraryItems, setLibraryItems] = useState(() => {
    try {
      const saved = localStorage.getItem("sh_library_items");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge to ensure default fields like reactions & comments exist
          return parsed.map((item) => {
            const def = defaultLibrary.find((d) => d.id === item.id);
            return {
              ...def,
              ...item,
              reactions: item.reactions || def?.reactions || { "❤️": 10, "💡": 8, "👏": 5, "🙏": 3, "✨": 2 },
              userReactions: item.userReactions || def?.userReactions || {},
              comments: item.comments || def?.comments || [],
              likes: typeof item.likes === "number" ? item.likes : (def?.likes || 0)
            };
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
    return defaultLibrary;
  });
  const [formTemplates, setFormTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem("sh_form_templates");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasPatient = parsed.some((t) => t.providerType === "Patient" || t.id === "TMPL-PATIENT");
          if (!hasPatient) {
            const patientDefault = defaultFormTemplates.find((t) => t.providerType === "Patient");
            if (patientDefault) {
              return [patientDefault, ...parsed];
            }
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return defaultFormTemplates;
  });
  const [adminSpecialistChats, setAdminSpecialistChats] = useState(() => {
    try {
      const saved = localStorage.getItem("sh_admin_specialist_chats");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge to ensure default initial chats (Dr. Sarah & Dr. Dennis) are always preserved
          const existingIds = new Set(parsed.map((c) => c.id));
          const missingDefaults = defaultAdminSpecialistChats.filter((d) => !existingIds.has(d.id));
          return [...missingDefaults, ...parsed];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return defaultAdminSpecialistChats;
  });
  // When the app is reloaded or restarted, the user is always taken back to login tab
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      localStorage.removeItem("sh_session_user");
    } catch (e) {
      // ignore
    }
    return null;
  });
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    const saved = localStorage.getItem("sh_language");
    if (saved === "en" || saved === "lg" || saved === "sw" || saved === "fr") return saved;
    if (currentUser) return currentUser.language || "en";
    return "en";
  });
  // 1. Synchronize data with Firestore in real time across all devices & seed baseline collections
  useEffect(() => {
    // Sync any local accounts stored in localStorage to ensure cross-device availability
    const savedLocal = localStorage.getItem("sh_accounts");
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        if (Array.isArray(parsed) && parsed.length > 0) {
          syncAllLocalAccounts(parsed);
        }
      } catch (e) {
        // ignore
      }
    }

    // Fetch accounts directly from cloud to ensure immediate multi-device hydration
    fetchAllAccountsFromCloud().then((cloudAccs) => {
      if (cloudAccs && cloudAccs.length > 0) {
        setAccounts((prev) => {
          const cloudIds = new Set(cloudAccs.map((a) => a.id));
          const localOnly = prev.filter((a) => !cloudIds.has(a.id));
          return [...cloudAccs, ...localOnly];
        });
      }
    }).catch((err) => {
      console.warn("Direct accounts hydration:", err);
    });

    // Seed collections if Firestore is initially empty
    seedCollectionIfEmpty("accounts", initialDefaultAccounts);
    seedCollectionIfEmpty("cases", initialDefaultCases);
    seedCollectionIfEmpty("appointments", initialDefaultAppointments);
    seedCollectionIfEmpty("libraryItems", defaultLibrary);
    seedCollectionIfEmpty("formTemplates", defaultFormTemplates);
    seedCollectionIfEmpty("adminSpecialistChats", defaultAdminSpecialistChats);

    // Real-time synchronization listeners across all devices
    const unsubAccounts = subscribeToCollection("accounts", (remote) => {
      if (remote && remote.length > 0) {
        setAccounts((prev) => {
          const remoteIds = new Set(remote.map((a) => a.id));
          const localOnly = prev.filter((a) => !remoteIds.has(a.id));
          // Push any local accounts created offline to Firestore so other devices get them
          localOnly.forEach((acc) => saveDocument("accounts", acc.id, acc));
          return [...remote, ...localOnly];
        });
      }
    });

    const unsubCases = subscribeToCollection("cases", (remote) => {
      if (remote && remote.length > 0) {
        setCases((prev) => {
          const remoteIds = new Set(remote.map((c) => c.id));
          const localOnly = prev.filter((c) => !remoteIds.has(c.id));
          localOnly.forEach((c) => saveDocument("cases", c.id, c));
          return [...remote, ...localOnly];
        });
      }
    });

    const unsubAppointments = subscribeToCollection("appointments", (remote) => {
      if (remote && remote.length > 0) {
        setAppointments((prev) => {
          const remoteIds = new Set(remote.map((a) => a.id));
          const localOnly = prev.filter((a) => !remoteIds.has(a.id));
          localOnly.forEach((a) => saveDocument("appointments", a.id, a));
          return [...remote, ...localOnly];
        });
      }
    });

    const unsubLibrary = subscribeToCollection("libraryItems", (remote) => {
      if (remote && remote.length > 0) {
        setLibraryItems(remote);
      }
    });

    const unsubTemplates = subscribeToCollection("formTemplates", (remote) => {
      if (remote && remote.length > 0) {
        setFormTemplates(remote);
      }
    });

    const unsubChats = subscribeToCollection("adminSpecialistChats", (remote) => {
      if (remote && remote.length > 0) {
        setAdminSpecialistChats((prev) => {
          const remoteIds = new Set(remote.map((c) => c.id));
          const localOnly = prev.filter((c) => !remoteIds.has(c.id));
          localOnly.forEach((c) => saveDocument("adminSpecialistChats", c.id, c));
          return [...remote, ...localOnly];
        });
      }
    });

    return () => {
      unsubAccounts();
      unsubCases();
      unsubAppointments();
      unsubLibrary();
      unsubTemplates();
      unsubChats();
    };
  }, []);

  // Keep currentUser synced if their account profile is updated remotely
  useEffect(() => {
    if (currentUser) {
      const freshUser = accounts.find((a) => a.id === currentUser.id);
      if (freshUser && (freshUser.name !== currentUser.name || freshUser.status !== currentUser.status || freshUser.role !== currentUser.role)) {
        setCurrentUser((prev) => ({ ...prev, ...freshUser }));
      }
    }
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem("sh_accounts", JSON.stringify(accounts));
  }, [accounts]);
  useEffect(() => {
    localStorage.setItem("sh_cases", JSON.stringify(cases));
  }, [cases]);
  useEffect(() => {
    localStorage.setItem("sh_appointments", JSON.stringify(appointments));
  }, [appointments]);
  useEffect(() => {
    localStorage.setItem("sh_library_items", JSON.stringify(libraryItems));
  }, [libraryItems]);
  useEffect(() => {
    try {
      localStorage.setItem("sh_form_templates", JSON.stringify(formTemplates));
    } catch (e) {
      console.error(e);
    }
  }, [formTemplates]);
  useEffect(() => {
    try {
      localStorage.setItem("sh_admin_specialist_chats", JSON.stringify(adminSpecialistChats));
    } catch (e) {
      console.error(e);
    }
  }, [adminSpecialistChats]);
  useEffect(() => {
    // Session is not persisted across reloads or restarts so the user always returns to the login tab
    try {
      localStorage.removeItem("sh_session_user");
    } catch (e) {
      // ignore
    }
  }, [currentUser]);

  const handleRegisterAccount = (newAcc) => {
    setAccounts((prev) => [newAcc, ...prev.filter((a) => a.id !== newAcc.id)]);
    // Save to Firestore so user can access from other devices
    saveDocument("accounts", newAcc.id, newAcc);

    // If a new medical specialist registers, seed official earlier onboarding conversations with Admin
    if (newAcc.role === "specialist" || newAcc.providerType) {
      const welcomeMsg = {
        id: `CHAT-INIT-WELCOME-${Date.now()}`,
        specialistId: newAcc.id,
        specialistName: newAcc.name,
        specialistEmail: newAcc.email,
        specialization: newAcc.specialization || "Clinical Specialist",
        role: "admin",
        senderName: "DERMA CARE System Administrator",
        content: `Welcome Dr. ${newAcc.name} to the DERMA CARE Clinical Specialist Network. Your medical credentials (${newAcc.registrationNumber || "Pending Review"}) have been submitted to the Administration Desk. You can use this secure two-way channel to communicate directly with administrators regarding license verification, clinical form builder templates, or urgent triage escalations.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        date: new Date().toISOString().split("T")[0],
        timestamp: new Date().toISOString(),
        readByAdmin: true,
        readBySpecialist: false
      };
      setAdminSpecialistChats((prev) => [...prev, welcomeMsg]);
      saveDocument("adminSpecialistChats", welcomeMsg.id, welcomeMsg);
    }
  };

  const handleUpdateFormTemplates = (newTemplates) => {
    setFormTemplates(newTemplates);
    newTemplates.forEach((tpl) => {
      saveDocument("formTemplates", tpl.id, tpl);
    });
  };

  const handleSendSpecialistMessage = (specialistUser, content) => {
    if (!content || !content.trim()) return;
    const newMsg = {
      id: `CHAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      specialistId: specialistUser.id,
      specialistName: specialistUser.name,
      specialistEmail: specialistUser.email,
      specialization: specialistUser.specialization || "Clinical Dermatologist",
      role: "specialist",
      senderName: specialistUser.name,
      content: content.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString(),
      readByAdmin: false,
      readBySpecialist: true
    };
    setAdminSpecialistChats((prev) => [...prev, newMsg]);
    saveDocument("adminSpecialistChats", newMsg.id, newMsg);
  };

  const handleSendAdminReply = (specialistId, content) => {
    if (!content || !content.trim()) return;
    const specialist = accounts.find((a) => a.id === specialistId) || {
      name: "Specialist Provider",
      email: ""
    };
    const newMsg = {
      id: `CHAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      specialistId: specialistId,
      specialistName: specialist.name,
      specialistEmail: specialist.email,
      specialization: specialist.specialization || "Clinical Dermatologist",
      role: "admin",
      senderName: "DERMA CARE System Administrator",
      content: content.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString(),
      readByAdmin: true,
      readBySpecialist: false
    };
    setAdminSpecialistChats((prev) => [...prev, newMsg]);
    saveDocument("adminSpecialistChats", newMsg.id, newMsg);
  };

  const handleMarkAdminChatRead = (specialistId) => {
    setAdminSpecialistChats((prev) =>
      prev.map((msg) => {
        if (msg.specialistId === specialistId && !msg.readByAdmin) {
          saveDocument("adminSpecialistChats", msg.id, { ...msg, readByAdmin: true });
          return { ...msg, readByAdmin: true };
        }
        return msg;
      })
    );
  };

  const handleMarkSpecialistChatRead = (specialistId) => {
    setAdminSpecialistChats((prev) =>
      prev.map((msg) => {
        if (msg.specialistId === specialistId && !msg.readBySpecialist) {
          saveDocument("adminSpecialistChats", msg.id, { ...msg, readBySpecialist: true });
          return { ...msg, readBySpecialist: true };
        }
        return msg;
      })
    );
  };

  const handleLoginSuccess = (acc) => {
    setCurrentUser(acc);
    if (acc.language) {
      setCurrentLanguage(acc.language);
    }
  };

  const handleUpdateUser = (updatedUser) => {
    setCurrentUser(updatedUser);
    setAccounts((prev) => prev.map((a) => a.id === updatedUser.id ? updatedUser : a));
    saveDocument("accounts", updatedUser.id, updatedUser);
  };

  const handleSubmitCase = (newCase) => {
    setCases((prev) => [newCase, ...prev.filter((c) => c.id !== newCase.id)]);
    saveDocument("cases", newCase.id, newCase);
  };

  const handleDiagnoseCase = (caseId, condition, notes, prescription) => {
    const targetCase = cases.find((c) => c.id === caseId);
    const updatedCase = {
      ...(targetCase || {}),
      status: "Diagnosed",
      diagnosisReport: {
        diagnosedCondition: condition,
        notes,
        prescription,
        specialistName: currentUser?.name || "Dr. Sarah Jenkins",
        specialistId: currentUser?.id || "doctor_sarah",
        createdAt: new Date().toISOString()
      }
    };
    setCases((prev) => prev.map((c) => c.id === caseId ? { ...c, ...updatedCase } : c));
    saveDocument("cases", caseId, updatedCase);
  };

  const handleBookAppointment = (newApp) => {
    setAppointments((prev) => [newApp, ...prev.filter((a) => a.id !== newApp.id)]);
    saveDocument("appointments", newApp.id, newApp);
  };

  const handleAcceptAppointment = (appId) => {
    const target = appointments.find((a) => a.id === appId);
    const updatedFields = {
      ...(target || {}),
      status: "Accepted",
      confirmedAt: new Date().toISOString(),
      patientReminders: target?.patientReminders || { h12: true, h1: true, m30: true },
      specialistReminders: target?.specialistReminders || { m30: true, m5: true }
    };
    setAppointments((prev) => prev.map((app) => app.id === appId ? { ...app, ...updatedFields } : app));
    saveDocument("appointments", appId, updatedFields);
  };

  const handleDeclineAppointment = (appId) => {
    setAppointments((prev) => prev.map((app) => app.id === appId ? { ...app, status: "Declined" } : app));
    saveDocument("appointments", appId, { status: "Declined" });
  };

  const handleCompleteAppointment = (appId, completionNotes = "") => {
    const target = appointments.find((a) => a.id === appId);
    const updatedFields = {
      ...(target || {}),
      status: "Completed",
      isCompleted: true,
      completedAt: new Date().toISOString(),
      completionNotes: completionNotes || "Consultation successfully completed."
    };
    setAppointments((prev) => prev.map((app) => app.id === appId ? { ...app, ...updatedFields } : app));
    saveDocument("appointments", appId, updatedFields);
  };

  const handleRescheduleAppointment = (appId, { reason = "", proposedDate = "", proposedTime = "" } = {}) => {
    const target = appointments.find((a) => a.id === appId);
    const updatedFields = {
      ...(target || {}),
      status: "Rescheduled",
      isMissed: true,
      missedAt: new Date().toISOString(),
      rescheduleReason: reason || "Specialist was called for urgent clinical duties.",
      proposedDate: proposedDate || target?.date || "",
      proposedTime: proposedTime || target?.time || ""
    };
    setAppointments((prev) => prev.map((app) => app.id === appId ? { ...app, ...updatedFields } : app));
    saveDocument("appointments", appId, updatedFields);
  };

  const handleUpdateAppointment = (updatedApp) => {
    setAppointments((prev) => prev.map((app) => app.id === updatedApp.id ? updatedApp : app));
    saveDocument("appointments", updatedApp.id, updatedApp);
  };

  const handleAddLibraryItem = (newItem) => {
    setLibraryItems((prev) => [newItem, ...prev]);
    saveDocument("libraryItems", newItem.id, newItem);
  };

  const handleUpdateLibraryItem = (updatedItem) => {
    setLibraryItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
    saveDocument("libraryItems", updatedItem.id, updatedItem);
  };

  const handleApproveAccount = (accId) => {
    const target = accounts.find((a) => a.id === accId);
    if (!target) return;
    const whitelistID = Math.floor(1e9 + Math.random() * 9e9).toString();
    const updated = {
      ...target,
      status: "Approved",
      whitelistNumber: whitelistID
    };
    setAccounts((prev) => prev.map((acc) => acc.id === accId ? updated : acc));
    saveDocument("accounts", accId, updated);
  };

  const handleDeclineAccount = (accId) => {
    setAccounts((prev) => prev.map((acc) => acc.id === accId ? { ...acc, status: "Declined" } : acc));
    saveDocument("accounts", accId, { status: "Declined" });
  };

  const handleRevokeWhitelist = (accId) => {
    setAccounts((prev) => prev.map((acc) => acc.id === accId ? { ...acc, status: "Declined" } : acc));
    saveDocument("accounts", accId, { status: "Declined" });
  };

  const handleDeleteAccount = (accId) => {
    setAccounts((prev) => prev.filter((acc) => acc.id !== accId));
    removeDocument("accounts", accId);
  };

  const handleResetUserPassword = (accId, newPass) => {
    setAccounts((prev) => prev.map((acc) => acc.id === accId ? { ...acc, passwordHash: newPass } : acc));
    saveDocument("accounts", accId, { passwordHash: newPass });
  };
  const handleLogout = () => {
    setCurrentUser(null);
  };
  const handleLanguageChange = (lang) => {
    setCurrentLanguage(lang);
    localStorage.setItem("sh_language", lang);
    if (currentUser) {
      handleUpdateUser({ ...currentUser, language: lang });
    }
  };
  const renderPortal = () => {
    if (!currentUser) {
      return (
        <LoginPortal
          accounts={accounts}
          onRegister={handleRegisterAccount}
          onLoginSuccess={handleLoginSuccess}
          currentLanguage={currentLanguage}
          onLanguageChange={handleLanguageChange}
          formTemplates={formTemplates}
        />
      );
    }
    if (currentUser.role === "patient") {
      return (
        <PatientPortal
          user={currentUser}
          accounts={accounts}
          onUpdateUser={handleUpdateUser}
          cases={cases}
          onSubmitCase={handleSubmitCase}
          appointments={appointments}
          onBookAppointment={handleBookAppointment}
          onUpdateAppointment={handleUpdateAppointment}
          onRescheduleAppointment={handleRescheduleAppointment}
          libraryItems={libraryItems}
          onUpdateLibraryItem={handleUpdateLibraryItem}
          onLogout={handleLogout}
          currentLanguage={currentLanguage}
          onLanguageChange={handleLanguageChange}
        />
      );
    }
    if (currentUser.role === "specialist") {
      return (
        <DoctorPortal
          user={currentUser}
          accounts={accounts}
          onUpdateUser={handleUpdateUser}
          cases={cases}
          onDiagnoseCase={handleDiagnoseCase}
          appointments={appointments}
          onAcceptAppointment={handleAcceptAppointment}
          onDeclineAppointment={handleDeclineAppointment}
          onCompleteAppointment={handleCompleteAppointment}
          onRescheduleAppointment={handleRescheduleAppointment}
          onUpdateAppointment={handleUpdateAppointment}
          libraryItems={libraryItems}
          onAddLibraryItem={handleAddLibraryItem}
          onUpdateLibraryItem={handleUpdateLibraryItem}
          onLogout={handleLogout}
          currentLanguage={currentLanguage}
          onLanguageChange={handleLanguageChange}
          adminSpecialistChats={adminSpecialistChats}
          onSendSpecialistMessage={handleSendSpecialistMessage}
          onMarkSpecialistChatRead={handleMarkSpecialistChatRead}
        />
      );
    }
    if (currentUser.role === "admin") {
      return (
        <AdminPortal
          user={currentUser}
          accounts={accounts}
          onApproveAccount={handleApproveAccount}
          onDeclineAccount={handleDeclineAccount}
          onResetUserPassword={handleResetUserPassword}
          onDeleteAccount={handleDeleteAccount}
          onRevokeWhitelist={handleRevokeWhitelist}
          onLogout={handleLogout}
          currentLanguage={currentLanguage}
          onLanguageChange={handleLanguageChange}
          formTemplates={formTemplates}
          onUpdateTemplates={handleUpdateFormTemplates}
          adminSpecialistChats={adminSpecialistChats}
          onSendAdminReply={handleSendAdminReply}
          onMarkAdminChatRead={handleMarkAdminChatRead}
        />
      );
    }
    return null;
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-clip selection:bg-blue-500/20 derma-canvas">
      {/* Restored Dermatology Hospital Background Image when on Login Tab */}
      {!currentUser && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <img
            src={hospitalRoomBg}
            alt="Dermatology Hospital Room"
            className="w-full h-full object-cover object-center scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#F5F7FA]/90 via-[#F5F7FA]/80 to-[#F5F7FA]/92 backdrop-blur-[2px]" />
        </div>
      )}

      {/* Background ambient glowing light orbs for soft medical depth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute top-1/4 -right-32 w-[32rem] h-[32rem] rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl" />
      </div>
      <div className="relative z-10 min-h-screen">
        {renderPortal()}
      </div>
    </div>
  );
}
