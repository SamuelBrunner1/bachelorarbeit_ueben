import ChatWidget from "@/components/ChatWidget";

const memberships = [
  {
    name: "Basic Mitgliedschaft",
    price: "29€ / Monat",
    features: ["Zugang zu Trainingsgeräten", "Nutzung während Öffnungszeiten"],
  },
  {
    name: "Advanced Mitgliedschaft",
    price: "39€ / Monat",
    features: ["Zugang zu allen Trainingsbereichen", "Kurse inklusive"],
  },
  {
    name: "Premium Mitgliedschaft",
    price: "49€ / Monat",
    features: ["24/7 Zugang", "Kurse inklusive", "1x Personal Training pro Monat"],
  },
  {
    name: "Probetraining",
    price: "Kostenlos",
    features: ["Unverbindlich", "Jederzeit möglich"],
  },
];

const courses = ["Yoga", "HIIT", "Spinning", "Functional Training", "Pilates"];

const openingHours = [
  { day: "Montag – Sonntag", time: "06:00 – 22:00 Uhr" },
  { day: "Feiertage", time: "08:00 – 18:00 Uhr" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="#home" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 font-bold text-white shadow-lg">
              U
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Unser Fitnessstudio
              </p>
              <p className="text-lg font-semibold text-slate-900">Unser modernes Fitnessstudio in Wien</p>
            </div>
          </a>

          <nav className="hidden gap-6 text-sm font-medium text-slate-600 md:flex">
            <a className="transition hover:text-slate-900" href="#home">Start</a>
            <a className="transition hover:text-slate-900" href="#oeffnungszeiten">Öffnungszeiten</a>
            <a className="transition hover:text-slate-900" href="#mitgliedschaften">Mitgliedschaften</a>
            <a className="transition hover:text-slate-900" href="#kurse">Kurse</a>
            <a className="transition hover:text-slate-900" href="#standort">Standort</a>
            <a className="transition hover:text-slate-900" href="#kontakt">Kontakt</a>
          </nav>

          <a
            href="/chatbot"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            Probetraining vereinbaren
          </a>
        </div>
      </header>

      <ChatWidget />

      <section id="home" className="relative overflow-hidden px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-128 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(148,163,184,0.18),transparent_28%),linear-gradient(135deg,#f8fafc_0%,#eef2ff_52%,#ffffff_100%)]" />
        <div className="absolute left-8 top-20 -z-10 h-32 w-32 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute bottom-10 right-4 -z-10 h-40 w-40 rounded-full bg-slate-900/10 blur-3xl" />

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 shadow-sm">
              Fitnessstudio Demo
            </p>
            <h1 className="text-5xl font-black leading-tight tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              Starte jetzt dein Training
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              Modernes Fitnessstudio mit flexiblen Mitgliedschaften und kostenlosen Probetrainings.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/chatbot"
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-600"
              >
                Probetraining vereinbaren
              </a>
              <a
                href="#mitgliedschaften"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
              >
                Mitgliedschaften ansehen
              </a>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { value: "06–22 Uhr", label: "Täglich geöffnet" },
                { value: "5 Kurse", label: "Tägliche Kursauswahl" },
                { value: "60€", label: "Personal Training ab" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-200/70 backdrop-blur">
                  <p className="text-2xl font-black text-slate-950">{stat.value}</p>
                  <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-4xl border border-white/70 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/15">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.32em] text-emerald-300">Demo Standort</p>
              <h2 className="mt-3 text-3xl font-bold">Unser Fitnessstudio</h2>
              <p className="mt-4 text-slate-300">Zentral in Wien und gut erreichbar</p>
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl bg-white/10 px-4 py-3">Gratis Probetraining</div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">Flexible Mitgliedschaften</div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">Kurse & Personal Training</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="oeffnungszeiten" className="px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Öffnungszeiten</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Jeden Tag für dein Training offen</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {openingHours.map((slot) => (
              <article key={slot.day} className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{slot.day}</p>
                <p className="mt-3 text-2xl font-bold text-slate-950">{slot.time}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="mitgliedschaften" className="px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Preise / Mitgliedschaften</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Mitgliedschaften</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
            {memberships.map((plan) => (
              <article key={plan.name} className="flex h-full flex-col rounded-4xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <p className="text-lg font-semibold text-slate-950">{plan.name}</p>
                <p className="mt-3 text-3xl font-black text-slate-900">{plan.price}</p>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="kurse" className="px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Kurse</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Unsere Kurse</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Kurse finden täglich vormittags und abends statt.
            </p>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-3">
              {courses.map((course) => (
                <span key={course} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {course}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="standort" className="px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Standort</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Unser Fitnessstudio</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-lg font-semibold text-slate-950">Mariahilfer Straße 120</p>
              <p className="mt-2 text-slate-600">1070 Wien</p>
              <p className="mt-2 text-slate-600">U3 Neubaugasse (2 Minuten entfernt)</p>
            </div>
            <div className="rounded-4xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Erreichbarkeit</p>
              <div className="mt-4 space-y-3 text-slate-700">
                <p>Moderne Lage im 7. Bezirk</p>
                <p>Perfekt für Training vor oder nach der Arbeit</p>
                <p>Öffentlich gut erreichbar</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="anmeldung" className="px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-4xl bg-slate-950 px-6 py-8 text-white sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300">Anmeldung</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Die Anmeldung ist online oder direkt vor Ort möglich.</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                "Ausweis",
                "Bankverbindung",
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-white/10 px-4 py-4 text-base font-medium">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="kuendigung" className="px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <article className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Kündigung</p>
            <p className="mt-4 text-2xl font-bold text-slate-950">Kündigungsfrist: 1 Monat</p>
          </article>
          <article className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Möglichkeiten</p>
            <ul className="mt-4 space-y-3 text-slate-700">
              <li>per E-Mail</li>
              <li>schriftlich vor Ort</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="personal-training" className="px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl rounded-4xl bg-linear-to-r from-emerald-500 to-teal-500 px-6 py-10 text-white shadow-2xl shadow-emerald-500/20 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">Personal Training</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Individuelles Personal Training ab 60€ pro Einheit verfügbar.</h2>
        </div>
      </section>

      <section id="kontakt" className="px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Kontakt</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Wir sind für dich da</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Telefon</p>
              <p className="mt-3 text-2xl font-bold text-slate-950">+43 1 2345678</p>
            </article>
            <article className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">E-Mail</p>
              <a className="mt-3 block text-2xl font-bold text-slate-950 hover:text-emerald-600" href="mailto:demo@email.com">
                demo@email.com
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-4xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Probetraining</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Jetzt Probetraining sichern</h2>
          <p className="mt-4 text-slate-600">Einfach online starten oder direkt vor Ort anmelden.</p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="/chatbot"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Probetraining vereinbaren
            </a>
            <a
              href="#kontakt"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
            >
              Kontakt aufnehmen
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div>
            <h3 className="text-lg font-semibold text-white">Unser Fitnessstudio</h3>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
              Eine moderne Demo-Website für ein Fitnessstudio in Wien – klar strukturiert, verkaufsorientiert und für Kundenpräsentationen optimiert.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Kontakt</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">+43 1 2345678</p>
            <p className="text-sm leading-6 text-slate-400">demo@email.com</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Standort</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">Mariahilfer Straße 120</p>
            <p className="text-sm leading-6 text-slate-400">1070 Wien</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
