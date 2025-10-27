"use client";
import { useState, useEffect } from "react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [greeting, setGreeting] = useState("Hallo");

  // Dynamische Begrüßung basierend auf Uhrzeit
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Guten Morgen");
    else if (hour < 18) setGreeting("Guten Tag");
    else setGreeting("Guten Abend");
  }, []);

  // Prüfen, ob das Gerät ein kleines Display hat
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <>
      {/* 💬 Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="chat-toggle fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl transition-all duration-300 z-50"
        >
          💬
        </button>
      )}

      {/* 🪟 Chatfenster – unterscheidet zwischen Mobile & Desktop */}
      {open && (
        <>
          {/* ✅ MOBILE-VOLLANSICHT */}
          {isMobile ? (
            <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fadeIn">
              {/* Header */}
             <div className="flex justify-between items-center p-4 border-b border-gray-200 shadow-sm bg-white">
  <div className="flex-1 text-center relative">
    <h2 className="text-lg font-bold text-blue-700 tracking-wide">ImmoBot</h2>
    {/* Optionaler Online-Indikator */}
  </div>
  <button
    onClick={() => setOpen(false)}
    className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
    aria-label="Chat schließen"
  >
    ✕
  </button>
</div>


              {/* Chat-Bereich */}
              <div className="flex-1 overflow-hidden bg-gradient-to-b from-white to-blue-50/50">
                <iframe
                  src="/chatbot"
                  className="w-full h-full border-0"
                  style={{
                    height: "100%",
                    background:
                      "linear-gradient(to bottom, white, #eff6ff)",
                  }}
                ></iframe>
              </div>
            </div>
          ) : (
            /* ✅ DESKTOP-POPUP */
            <div className="fixed bottom-20 right-6 bg-white rounded-2xl shadow-2xl w-96 h-[550px] flex flex-col z-50 animate-fadeIn">
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800">ImmoBot</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Chat-Bereich */}
              <iframe
                src="/chatbot"
                className="w-full h-full border-0 rounded-b-2xl"
              ></iframe>
            </div>
          )}
        </>
      )}
    </>
  );
}
