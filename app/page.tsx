"use client";

import { useEffect } from "react";
import ChatWidget from "@/components/ChatWidget";

export default function HomePage() {
  // ✅ Scroll Animation + Sticky Header + Mobile Menu
  useEffect(() => {
    const header = document.getElementById("mainHeader");
    const burgerBtn = document.getElementById("burgerBtn");
    const mobileMenu = document.getElementById("mobileMenu");
    const overlay = document.getElementById("menuOverlay");

    let lastScroll = 0;

    const handleScroll = () => {
      const currentScroll = window.scrollY;
      if (header) {
        if (currentScroll > lastScroll && currentScroll > 80) {
          header.style.transform = "translateY(-100%)";
        } else {
          header.style.transform = "translateY(0)";
        }
      }
      lastScroll = currentScroll;

      // 📱 Wenn man scrollt → Menü schließen
      if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
        closeMenu();
      }
    };

    const closeMenu = () => {
      if (!mobileMenu || !overlay) return;
      mobileMenu.classList.add("hidden");
      overlay.classList.add("hidden");
      overlay.classList.remove("active");
      document.body.classList.remove("overflow-hidden");
    };

burgerBtn?.addEventListener("click", () => {
  const isOpen = !mobileMenu?.classList.contains("hidden");

  if (isOpen) {
    mobileMenu?.classList.add("hidden");
    overlay?.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
  } else {
    mobileMenu?.classList.remove("hidden");
    overlay?.classList.add("hidden"); // ✅ Overlay bleibt unsichtbar
    document.body.classList.add("overflow-hidden");
  }
});


    // Overlay-Klick → Menü schließen
    overlay?.addEventListener("click", closeMenu);

    // Klick außerhalb → Menü schließen
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mobileMenu &&
        !mobileMenu.contains(e.target as Node) &&
        !burgerBtn?.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    window.addEventListener("scroll", handleScroll);

    return () => {
      overlay?.removeEventListener("click", closeMenu);
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // ✅ Haupt-Render
  return (
    <main lang="de" className="bg-gray-50 text-gray-800 min-h-screen">
      {/* ✅ HEADER */}
      <header
        id="mainHeader"
        className="fixed top-0 w-full bg-gradient-to-r from-blue-100 to-white backdrop-blur-md 
                   border-b border-gray-200 shadow-sm z-50 transition-transform duration-300"
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4">
          <a href="#home" className="flex items-center gap-3">
            <span className="text-xl sm:text-2xl font-bold text-gray-900">ImmoBot</span>
          </a>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-6 lg:space-x-8 text-gray-700 text-base lg:text-lg font-medium">
            <a
              href="#home"
              className="hover:text-blue-700 border-b-2 border-transparent hover:border-blue-700 transition"
            >
              Home
            </a>
            <a
              href="#about"
              className="hover:text-blue-700 border-b-2 border-transparent hover:border-blue-700 transition"
            >
              Über uns
            </a>
            <a
              href="#faq"
              className="hover:text-blue-700 border-b-2 border-transparent hover:border-blue-700 transition"
            >
              FAQ
            </a>
          </nav>

          {/* Burger Menu */}
          <button
            id="burgerBtn"
            className="md:hidden p-2 text-gray-700 hover:text-blue-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          id="mobileMenu"
          className="hidden absolute top-full left-0 w-full bg-white shadow-lg border-t border-gray-200 z-50"
        >
          <nav className="flex flex-col items-center py-6 space-y-4 text-gray-700 text-lg font-medium">
            <a href="#home" onClick={() => document.getElementById("menuOverlay")?.classList.add("hidden")} className="hover:text-blue-600 transition">
              Home
            </a>
            <a href="#about" onClick={() => document.getElementById("menuOverlay")?.classList.add("hidden")} className="hover:text-blue-600 transition">
              Über uns
            </a>
            <a href="#faq" onClick={() => document.getElementById("menuOverlay")?.classList.add("hidden")} className="hover:text-blue-600 transition">
              FAQ
            </a>
          </nav>
        </div>
      </header>

      {/* Overlay */}
      <div
        id="menuOverlay"
        className="hidden fixed inset-0 bg-black bg-opacity-40 z-40"
      ></div>

      {/* 💬 ChatWidget (schwebend unten rechts) */}
      <ChatWidget />



    


{/* ✅ HERO SECTION */}
<section
  id="home"
  className="relative min-h-[90vh] flex flex-col justify-center items-center text-center 
             bg-gradient-to-br from-blue-100 via-white to-blue-50 overflow-hidden pt-28 md:pt-32"
>
  {/* Deko-Kreise */}
  <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-blue-200 rounded-full opacity-30 animate-pulse"></div>
  <div className="absolute bottom-[-60px] right-[-60px] w-80 h-80 bg-blue-300 rounded-full opacity-20 animate-pulse"></div>

  {/* Text-Inhalt */}
  <div className="relative max-w-3xl px-6 z-10">
    <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 text-gray-900 leading-tight">
      Intelligente Chatbots neu gedacht.<br className="hidden sm:block" />{" "}
      Einfach ausprobieren – kostenlos und jederzeit erlebbar.
    </h1>
    <p className="text-lg sm:text-xl md:text-2xl mb-8 font-light text-gray-700">
      Beantwortet Kundenanfragen automatisch – rund um die Uhr.
    </p>

    {/* 💬 Chat starten Button */}
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        const chatBtn = document.querySelector<HTMLButtonElement>(".chat-toggle");
        chatBtn?.click(); // öffnet das ChatWidget
      }}
      className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white 
                 px-6 py-3 md:px-8 md:py-3.5 rounded-xl font-semibold shadow-lg 
                 hover:shadow-xl hover:bg-blue-700 transition-all duration-300 mb-12"
    >
      💬 AI Assistent starten
    </a>
  </div>
</section>







{/* ✅ Über uns */}
<section
  id="about"
  className="relative py-12 md:py-20 px-6 bg-[#F6FAF7]"
  data-animate
>
  <div className="relative max-w-4xl mx-auto text-center bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 md:p-10">
    <h2 className="text-3xl md:text-4xl font-bold mb-4">Über uns</h2>
    <p className="text-base md:text-lg leading-7 text-gray-700">
      ImmoBot ist eine reine Demoseite, die unseren Chatbot in Aktion zeigt.<br />
      Wir sind ein junges Team und möchten hier demonstrieren, wie unsere
      Chatbots aussehen und funktionieren.
      <br />
      <br />
      Der Fokus liegt nicht auf der Website selbst, sondern auf der Qualität
      und dem Mehrwert unserer Chatbot-Lösungen.
    </p>
  </div>
</section>

{/* ✅ Kundenstimmen */}
<section
  id="shop"
  className="bg-[#F1F4F8] py-12 md:py-16 mt-12 md:mt-16 rounded-t-3xl"
  data-animate
>
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
          <div className="flex justify-center mb-2 text-blue-600 text-lg">
            ⭐⭐⭐⭐⭐
          </div>
          <p className="text-lg italic mb-4 text-center">{item.text}</p>
          <span className="block font-semibold">{item.name}</span>
        </div>
      ))}
    </div>
  </div>
</section>

{/* ✅ FAQ */}
<section
  id="faq"
  className="bg-[#F6FAF7] py-12 md:py-20 px-6"
  data-animate
>
  <div className="max-w-3xl mx-auto">
    <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">
      Häufige Fragen
    </h2>

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
            <span className="transition-transform group-open:rotate-180 text-gray-500">
              ⌄
            </span>
          </summary>
          <p className="mt-4 text-gray-600 leading-relaxed">{faq.answer}</p>
        </details>
      ))}
    </div>
  </div>
</section>







      {/* ✅ FOOTER */}
<footer className="bg-gray-100 border-t border-gray-200 text-gray-600 text-sm mt-16">
  <div className="max-w-6xl mx-auto px-8 py-12 grid md:grid-cols-4 gap-8">
    {/* ImmoBot Beschreibung */}
    <div>
      <h3 className="font-semibold text-gray-800 mb-3">ImmoBot</h3>
      <p>
        Eine moderne Demoseite – klar strukturiert, interaktiv und jederzeit erweiterbar.
      </p>
    </div>

    {/* Rechtliches */}
    <div>
      <h3 className="font-semibold text-gray-800 mb-3">Rechtliches</h3>
      <ul className="space-y-2">
        <li>
          <a
            href="#"
            className="hover:text-blue-700 transition-colors duration-200"
          >
            Impressum
          </a>
        </li>
        <li>
          <a
            href="#"
            className="hover:text-blue-700 transition-colors duration-200"
          >
            Datenschutz
          </a>
        </li>
      </ul>
    </div>

    {/* Kontakt */}
    <div>
      <h3 className="font-semibold text-gray-800 mb-3">Kontakt</h3>
      <p>
        E-Mail:{" "}
        <a
          href="mailto:immobot.team@gmail.com"
          className="text-blue-700 hover:underline"
        >
          immobot.team@gmail.com
        </a>
      </p>
      <p className="mt-2">
        Telefon:{" "}
        <a href="tel:+4312345678" className="text-blue-700 hover:underline">
          +43 1 234 5678
        </a>
      </p>
    </div>

    {/* Service */}
    <div>
      <h3 className="font-semibold text-gray-800 mb-3">Service</h3>
      <ul className="space-y-2">
        <li>
          <a
            href="#"
            className="font-semibold hover:text-blue-700 transition-colors duration-200"
          >
            Immobilien ansehen
          </a>
        </li>
      
      </ul>
    </div>
  </div>

  {/* Copyright */}
  <div className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
    © {new Date().getFullYear()} ImmoBot. Alle Rechte vorbehalten.
  </div>
</footer>
</main>
  );
}