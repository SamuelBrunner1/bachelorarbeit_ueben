"use client";
import { useState, useEffect } from "react";

export default function Home() {
  // Chatbot State
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { sender: "Du", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });

    const data = await res.json();
    const botMessage = { sender: "Bot", text: data.reply };
    setMessages((prev) => [...prev, botMessage]);
  };

  // Scroll Animation + Sticky Header + Mobile Menu
  useEffect(() => {
    const header = document.getElementById("mainHeader");
    const burgerBtn = document.getElementById("burgerBtn");
    const mobileMenu = document.getElementById("mobileMenu");
    const overlay = document.getElementById("menuOverlay");

    let lastScroll = 0;
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      if (header) {
        if (currentScroll > lastScroll && currentScroll > 80)
          header.style.transform = "translateY(-100%)";
        else header.style.transform = "translateY(0)";
      }
      lastScroll = currentScroll;
    };

    const closeMenu = () => {
      if (!mobileMenu || !overlay) return;
      mobileMenu.classList.add("hidden");
      overlay.classList.remove("active");
      document.body.classList.remove("overflow-hidden");
    };

    burgerBtn?.addEventListener("click", () => {
      mobileMenu?.classList.toggle("hidden");
      overlay?.classList.toggle("active");
      document.body.classList.toggle("overflow-hidden");
    });

    overlay?.addEventListener("click", closeMenu);
    window.addEventListener("scroll", handleScroll);

    return () => {
      overlay?.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div lang="de" className="bg-gray-50 text-gray-800">
      {/* ✅ HEADER */}
      <header
        id="mainHeader"
        className="fixed top-0 w-full bg-gradient-to-r from-blue-100 to-white backdrop-blur-md border-b border-gray-200 shadow-sm z-50 transition-transform duration-300"
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4">
          <a href="#home" className="flex items-center gap-3">
            <span className="text-xl sm:text-2xl font-bold text-gray-900">ImmoBot</span>
          </a>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-6 lg:space-x-8 text-gray-700 text-base lg:text-lg font-medium">
            <a href="#home" className="hover:text-blue-700 border-b-2 border-transparent hover:border-blue-700 transition">
              Home
            </a>
            <a href="#about" className="hover:text-blue-700 border-b-2 border-transparent hover:border-blue-700 transition">
              Über uns
            </a>
            <a href="#faq" className="hover:text-blue-700 border-b-2 border-transparent hover:border-blue-700 transition">
              FAQ
            </a>
          </nav>


          {/* CTA }
          <a
            href="#chatbot"
            className="hidden md:inline-block bg-blue-600 text-white px-4 lg:px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 shadow-md hover:shadow-lg transition text-sm lg:text-base"
          >
            💬 ImmoBot starten
          </a> */}

          {/* Burger Menu */}
          <button id="burgerBtn" className="md:hidden p-2 text-gray-700 hover:text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>

        <div id="mobileMenu" className="hidden absolute top-full left-0 w-full bg-white shadow-lg border-t border-gray-200 z-50">
          <nav className="flex flex-col items-center py-6 space-y-4 text-gray-700 text-lg font-medium">
            <a href="#home" className="hover:text-blue-600 transition">Home</a>
            <a href="#about" className="hover:text-blue-600 transition">Über uns</a>
            <a href="#faq" className="hover:text-blue-600 transition">FAQ</a>
            <a href="#chatbot" className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold shadow-lg hover:bg-blue-700 transition">
              💬 ImmoBot starten
            </a>
          </nav>
        </div>
      </header>

      <div id="menuOverlay" className="hidden fixed inset-0 bg-black bg-opacity-40 z-40"></div>

      {/* ✅ HERO */}
    <section
  id="home"
  className="relative min-h-[90vh] flex flex-col justify-center items-center text-center bg-gradient-to-br from-blue-100 via-white to-blue-50 overflow-hidden pt-28 md:pt-32"
>

        <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-blue-200 rounded-full opacity-30 animate-pulse"></div>
        <div className="absolute bottom-[-60px] right-[-60px] w-80 h-80 bg-blue-300 rounded-full opacity-20 animate-pulse"></div>

        <div className="relative max-w-3xl px-6 z-10">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 text-gray-900 leading-tight">
            Immobilien-Chatbots neu gedacht.<br className="hidden sm:block" /> Einfach ausprobieren –
            kostenlos und jederzeit erlebbar.
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl mb-8 font-light text-gray-700">
            Unser Chatbot beantwortet Immobilienanfragen automatisch – modern, effizient und rund um die Uhr verfügbar.
          </p>
          <a
  href="#chatbot"
  className="mt-8 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-300"
>
  💬 ImmoBot starten
</a>

        </div>
      </section>




     {/* ✅ Moderner Chatbereich */}
<section
  id="chatbot"
  className="relative flex flex-col items-center justify-center py-24 bg-gradient-to-br from-blue-50 via-white to-blue-100 overflow-hidden"
>
  {/* Dekoelemente */}
  <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl"></div>
  <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-200/20 rounded-full blur-2xl"></div>

  {/* Titel */}
  <h2 className="text-4xl font-bold mb-8 flex items-center gap-2 text-gray-800 relative z-10">
    <span className="text-blue-600 text-5xl">💬</span> ImmoBot Demo
  </h2>

  {/* Chatcontainer */}
  <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-gray-200 rounded-3xl shadow-2xl p-6 z-10 transition hover:shadow-[0_0_40px_rgba(59,130,246,0.2)]">
    <div className="h-96 overflow-y-auto mb-4 p-3 rounded-2xl bg-gray-50/60 border border-gray-100 text-gray-700 space-y-3 scroll-smooth">
      {messages.length === 0 && (
        <p className="text-center text-gray-400 italic mt-20">
          👋 Willkommen! Stellen Sie dem ImmoBot eine Frage …
        </p>
      )}
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex ${
            m.sender === "Du" ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`px-4 py-2 rounded-2xl text-sm max-w-[80%] shadow-sm ${
              m.sender === "Du"
                ? "bg-blue-600 text-white rounded-br-none"
                : "bg-gray-100 text-gray-800 rounded-bl-none"
            }`}
          >
            {m.text}
          </div>
        </div>
      ))}
    </div>

    {/* Eingabefeld */}
    <div className="flex items-center bg-gray-100 border border-gray-200 rounded-full overflow-hidden shadow-inner">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        placeholder="Frage stellen..."
        className="flex-1 bg-transparent px-4 py-2 text-gray-700 focus:outline-none"
      />
      <button
        onClick={sendMessage}
        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 font-medium transition rounded-full"
      >
        Senden
      </button>
    </div>
  </div>

  {/* Untertext */}
  <p className="mt-6 text-gray-500 text-sm">
    Diese Demo zeigt, wie Immobilienanfragen automatisiert beantwortet werden können.
  </p>
</section>







{/* ✅ Über uns */}
<section id="about" className="relative py-12 md:py-20 px-6 bg-[#F6FAF7]" data-animate>
  <div className="relative max-w-4xl mx-auto text-center bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 md:p-10">
    <h2 className="text-3xl md:text-4xl font-bold mb-4">Über uns</h2>
    <p className="text-base md:text-lg leading-7 text-gray-700">
      ImmoBot ist eine reine Demoseite, die unseren Chatbot in Aktion zeigt.<br />
      Wir sind ein junges Team und möchten hier demonstrieren, wie unsere Chatbots in der Immobilienbranche aussehen und funktionieren.
      <br /><br />
      Der Fokus liegt nicht auf der Website selbst, sondern auf der Qualität und dem Mehrwert unserer Chatbot-Lösungen.
    </p>
  </div>
</section>

{/* ✅ Kundenstimmen */}
<section id="shop" className="bg-[#F1F4F8] py-12 md:py-16 mt-12 md:mt-16 rounded-t-3xl" data-animate>
  <div className="max-w-6xl mx-auto px-6">
    <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 md:mb-10">
      Das sagen unsere Interessenten
    </h2>

    {/* Scroll-Snap Container */}
    <div className="flex overflow-x-auto space-x-6 snap-x snap-mandatory px-2 md:px-6 scrollbar-hide">
      {[
        {
          text: "„Sehr moderne Darstellung – ich konnte mir sofort einen guten Eindruck von der Wohnung verschaffen.“",
          name: "– Markus H.",
        },
        {
          text: "„Schnelle Rückmeldung und übersichtliche Informationen – genau so stellt man sich eine Immobilienseite vor.“",
          name: "– Julia K.",
        },
        {
          text: "„Sehr angenehme Demo! Alles wirkt professionell und realistisch.“",
          name: "– Thomas L.",
        },
      ].map((item, i) => (
        <div
          key={i}
          className="min-w-[300px] md:min-w-[400px] bg-white rounded-2xl shadow-md p-6 snap-center flex flex-col items-center justify-center"
        >
          <div className="flex justify-center mb-2 text-blue-600 text-lg">⭐⭐⭐⭐⭐</div>
          <p className="text-lg italic mb-4 text-center">{item.text}</p>
          <span className="block font-semibold">{item.name}</span>
        </div>
      ))}
    </div>
  </div>
</section>

{/* ✅ FAQ */}
<section id="faq" className="bg-[#F6FAF7] py-12 md:py-20 px-6" data-animate>
  <div className="max-w-3xl mx-auto">
    <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">Häufige Fragen</h2>
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg divide-y divide-gray-200 border border-gray-200">
      {[
        {
          question: "Wie schnell kann eine Besichtigung vereinbart werden?",
          answer:
            "In der Regel können Besichtigungstermine innerhalb von 2–3 Werktagen vereinbart werden. Eine genaue Abstimmung erfolgt direkt über den zuständigen Ansprechpartner.",
        },
        {
          question: "Sind die Immobilien real oder nur zu Demonstrationszwecken?",
          answer:
            "Diese Website dient ausschließlich als Demonstration. Alle dargestellten Immobilien, Bilder und Informationen sind fiktiv und zu Präsentationszwecken erstellt.",
        },
        {
          question: "Kann später ein Chatbot für Anfragen integriert werden?",
          answer:
            "Ja, die Seite ist bereits dafür vorbereitet. Ein Chatbot kann integriert werden, um Anfragen zu Immobilien, Besichtigungen und Exposés automatisiert zu beantworten.",
        },
      ].map((faq, i) => (
        <details key={i} className="group p-6">
          <summary className="flex justify-between items-center cursor-pointer text-lg font-medium">
            <span>{faq.question}</span>
            <span className="transition-transform group-open:rotate-180 text-gray-500">⌄</span>
          </summary>
          <p className="mt-4 text-gray-600 leading-relaxed">{faq.answer}</p>
        </details>
      ))}
    </div>
  </div>
</section>






      {/* ✅ FOOTER */}
      <footer className="bg-gray-100 border-t border-gray-200 text-gray-600 text-sm">
        <div className="max-w-6xl mx-auto px-8 py-12 grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">ImmoBot</h3>
            <p>Eine moderne Immobilien-Demoseite – klar strukturiert und jederzeit erweiterbar.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Rechtliches</h3>
            <a href="#" className="hover:text-green-700">
              Impressum & Datenschutz
            </a>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Kontakt</h3>
            <p>
              E-Mail:{" "}
              <a href="mailto:immobot.team@gmail.com" className="hover:text-green-700">
                immobot.team@gmail.com
              </a>
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Service</h3>
            <a href="#" className="font-semibold hover:text-green-700">
              Immobilien ansehen
            </a>
          </div>
        </div>
        <div className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          © 2025 ImmoBot. Alle Rechte vorbehalten.
        </div>
      </footer>
    </div>
  );
}
