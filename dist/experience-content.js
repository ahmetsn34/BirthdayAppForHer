/** Keep the original experience unless the visitor explicitly opens ?demo=1. */
export function selectExperienceContent(base, search = "") {
  if (new URLSearchParams(search).get("demo") !== "1") return base;

  // A separate object keeps editing or rendering the demo from changing the gift.
  const demo = structuredClone(base);
  Object.assign(demo.page, {
    title: "Bir Dilek Gecesi · Demo",
    description: "Three.js ile hazırlanmış, tarayıcıda keşfedilebilen etkileşimli bir gece bahçesi.",
  });
  Object.assign(demo.intro, {
    date: "Etkileşimli WebGL deneyimi",
    title: "Hazır mısın,",
    name: "keşfetmeye?",
  });
  Object.assign(demo.letter, {
    heading: "Bahçeden bir not",
    greeting: "Merhaba, gezgin.",
    paragraphs: [
      "Bir Dilek Gecesi, tarayıcıda çalışan küçük bir etkileşimli bahçe. Işıkları takip et, çevreyi keşfet ve masadaki nesnelerle etkileşime geç.",
      "Bu portfolyo demosunda birinci şahıs hareketi, çarpışma kontrolünü, dokunmatik kontrolleri ve Web Audio ile üretilen müziği deneyebilirsin.",
      "Pastaya yaklaş, bir dilek tut ve mumları söndür. İstersen tekrar yakıp bahçeyi keşfetmeye devam et.",
    ],
    final: "Keşfin keyfini çıkar.",
    signature: "Bir Dilek Gecesi",
  });
  Object.assign(demo.objects, {
    envelopeTo: "Gezgine",
    envelopeFrom: "Bahçeden",
    note: { label: "Demo notu", action: "Oku" },
  });
  demo.messages.celebration = "Bir dilek, bir ışık. Keşfe devam!";
  return demo;
}
