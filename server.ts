import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
let aiInstance = null;
function getGemini() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Configure it via Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiInstance;
}
async function startServer() {
  const app = express();
  const PORT = 3e3;
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.post("/api/triage", async (req, res) => {
    try {
      const { symptoms, chatHistory = [], language = "en" } = req.body;
      const ai = getGemini();
      const langNames = {
        en: "English",
        lg: "Luganda",
        sw: "Swahili",
        fr: "French"
      };
      const langName = langNames[language] || "English";
      const systemInstruction = `
        You are "DERMA CARE AI Triage Assistant", an exceptionally skilled, compassionate, and precise AI bot specializing in clinical dermatology triage.
        Your goal is to communicate with the patient to collect key skin-related symptoms before they meet their doctor.
        
        Strict rules:
        1. YOU MUST respond and hold the entire conversation in the language "${langName}". All vocabulary, greetings, and advice must be native and accurate to ${langName}.
        2. Conduct a careful, friendly, and structured interview. Ask at most 1-2 questions at a time so as not to overwhelm the patient.
        3. Enquire about:
           - Onset and duration of the skin lesion or concern.
           - Presence of itching (pruritus), pain, or bleeding.
           - Exposure to any new triggers (such as cosmetics, soaps, medications, plants, sunlight, or foods).
           - Location on the body.
        4. State clearly at the beginning or end of your message that you are an AI triage bot aiding preliminary analysis, not a final clinical replacement for their dermatologist consult, and encourage booking a physical or online consultation.
        5. Provide 2-3 extremely gentle, safe general skin-care recommendations (e.g. keeping it clean, avoiding scratching, using gentle emollients, avoiding harsh detergents).
      `;
      const formattedHistory = chatHistory.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));
      formattedHistory.push({
        role: "user",
        parts: [{ text: symptoms }]
      });
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: formattedHistory,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });
      const responseText = response.text || "I was unable to analyze your symptoms. Please consult a dermatologist.";
      res.json({ text: responseText });
    } catch (err) {
      console.warn("Gemini triage notice (falling back to offline response):", err.message || err);
      res.json({
        text: `[AI Assistant is in demo offline mode] Thank you for describing your symptoms. Our dermatologists will review this details manually. Please continue with your appointment booking.`,
        error: err.message
      });
    }
  });
  app.post("/api/analyze-case", async (req, res) => {
    try {
      const { symptoms, transcription, language = "en" } = req.body;
      const ai = getGemini();
      const prompt = `
        As a senior clinical dermatologist AI assistant, analyze the following patient symptoms and voice transcriptions.
        
        Symptoms description: "${symptoms}"
        Voice note transcription: "${transcription || "No voice transcription available"}"
        
        Deliver a highly concise, professional "AI Insight report" structured as follows:
        1. **Probable Conditions (Dermatology-focused)**: Suggest the top 2-3 most likely skin conditions with brief estimated probabilities.
        2. **Severity Classification**: Assess as Low, Moderate, or High with medical reasoning.
        3. **Clinical Recommendations for Specialist**: Highlight specific lesions details, triggers, or patterns the examining dermatologist should scrutinize during active consult.
        4. **Suggested Medical Questions**: Propose 2-3 highly targeted diagnostic questions the dermatologist can ask during the physical or online call.
        
        Language: Respond in ${language === "fr" ? "French" : language === "sw" ? "Swahili" : language === "lg" ? "Luganda" : "English"}. Keep tone professional, exact, and concise.
      `;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          temperature: 0.2
        }
      });
      res.json({ analysis: response.text });
    } catch (err) {
      console.warn("Gemini case analysis notice (falling back to triage template):", err.message || err);
      res.json({
        analysis: `**Demographic & Clinical Triage Analysis**

* **Assessment**: AI analysis is currently running in offline mock triage mode. High probability of general dermatosis/contact reaction.
* **Observation**: Patient reports localized cutaneous symptoms. Advise physical dermatoscope inspection.
* **Recommended Action**: Scrutinize soap/detergent exposures and administer topical emollients.`
      });
    }
  });
  app.post("/api/encouragement", async (req, res) => {
    const { language = "en" } = req.body;
    try {
      const ai = getGemini();
      const prompt = `
        Generate one brief, highly inspiring "Daily Skin Tip" and encouragement message for skin health (1-2 sentences maximum).
        Focus on clinical, dermatologist-backed skincare habits (hydration, gentle cleansers, sunscreen, stress management, skin barrier preservation).
        
        Strict rules:
        - Respond ONLY in the requested language (English, Luganda, Swahili, or French).
        - Do not add markdown or headers. Just the direct sentence.
      `;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          temperature: 0.7
        }
      });
      res.json({ tip: response.text?.trim() });
    } catch (err) {
      console.warn("Gemini encouragement notice (using static skin tip):", err.message || err);
      const staticTips = {
        en: "Remember to apply SPF 50 sunscreen today, especially between 10 AM and 4 PM to protect your skin barrier.",
        lg: "Kijukize okusiiga sunscreen leero okusobola okukuuma eddiba lyo ku mazzi g'omusana agasiriiza.",
        sw: "Kumbuka kupaka mafuta ya kuzuia jua (sunscreen) leo ili kulinda ngozi yako dhidi ya miale mikali.",
        fr: "N'oubliez pas d'appliquer une crème solaire SPF 50 aujourd'hui pour protéger efficacement votre barrière cutanée."
      };
      res.json({ tip: staticTips[language] || staticTips["en"] });
    }
  });
  app.get("/pure-html", (req, res) => {
    res.sendFile(path.join(process.cwd(), "derma-care-frontend.html"));
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DERMA CARE full-stack server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
