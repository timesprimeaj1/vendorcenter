/**
 * Comprehensive training-data generator for VendorCenter AI Assistant fine-tuning.
 *
 * Produces JSONL (one JSON object per line) in ChatML/Alpaca-style:
 *   { "instruction": "...", "input": "<user message>", "output": "<assistant response JSON>" }
 *
 * Generates ~1500+ examples across 9 intents with:
 *   - Formal, colloquial, Hinglish and Marathi query variations
 *   - Typos and abbreviations (inspired by Bitext linguistic tags)
 *   - Complaint, reschedule, vendor info, location and refund intents
 *   - Service-specific context sentences
 *
 * Usage:
 *   npx tsx src/scripts/generate-training-data.ts
 *
 * Output: model/training-data/vendorcenter_train.jsonl  (auto-created)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../model/training-data");
const OUT_FILE = path.join(OUT_DIR, "vendorcenter_train.jsonl");

// ═══ Service category knowledge base (16 categories) ═══
const CATEGORIES: {
  name: string;
  keywords_en: string[];
  keywords_mr: string[];
  hinglish: string[];
  problems: string[];
}[] = [
  { name: "Plumbing", keywords_en: ["plumber", "pipe", "leak", "tap", "faucet", "drain", "toilet", "bathroom", "water"], keywords_mr: ["प्लंबर", "नळ", "पाइप", "गळती", "नळकाम", "शौचालय", "बाथरूम", "पाणी"], hinglish: ["plumber chahiye", "nal se paani aa raha", "pipe leak ho raha"], problems: ["leaking pipe in kitchen", "blocked drain", "toilet not flushing", "tap is dripping", "water pressure low", "bathroom pipe burst"] },
  { name: "Electrical", keywords_en: ["electrician", "wiring", "switch", "fan", "light", "inverter", "mcb"], keywords_mr: ["इलेक्ट्रिशियन", "वीज", "वायरिंग", "पंखा", "दिवा", "लाइट", "विजेचे काम"], hinglish: ["bijli ka kaam", "electrician chahiye", "fan nahi chal raha"], problems: ["power outlet not working", "fan making noise", "short circuit", "need new wiring", "MCB keeps tripping", "inverter not charging"] },
  { name: "AC Repair", keywords_en: ["ac", "air conditioner", "air conditioning", "cooling", "hvac", "ac service", "ac installation"], keywords_mr: ["एसी", "एसी दुरुस्ती", "एसी सर्व्हिस", "वातानुकूलन", "कूलिंग"], hinglish: ["ac kharab ho gaya", "ac service karna hai", "ac thanda nahi kar raha"], problems: ["AC not cooling", "AC making loud noise", "need AC gas refill", "AC remote not working", "water leaking from AC", "need new AC installation"] },
  { name: "Cleaning", keywords_en: ["cleaning", "cleaner", "maid", "housekeeping", "deep cleaning", "home cleaning", "sanitization"], keywords_mr: ["स्वच्छता", "सफाई", "स्वच्छता सेवा", "घर स्वच्छता", "मोलकरीण", "झाडू"], hinglish: ["ghar ki safai", "maid chahiye", "deep cleaning karwana hai"], problems: ["need deep cleaning before festival", "bathroom cleaning", "kitchen deep clean", "post-construction cleaning", "sofa cleaning", "carpet shampooing"] },
  { name: "Painting", keywords_en: ["paint", "painting", "painter", "wall", "whitewash"], keywords_mr: ["रंगकाम", "पेंटिंग", "रंगारी", "भिंत", "रंग"], hinglish: ["paint karwana hai", "wall painting chahiye", "ghar ka colour"], problems: ["walls need repainting", "damp patches on walls", "exterior painting needed", "texture painting", "waterproof coating needed", "room touch-up paint"] },
  { name: "Carpentry", keywords_en: ["carpenter", "carpentry", "furniture", "wood", "cupboard", "wardrobe", "door"], keywords_mr: ["सुतार", "सुतारकाम", "फर्निचर", "लाकूड", "कपाट", "दरवाजा"], hinglish: ["carpenter chahiye", "furniture banwana hai", "almari lagwani hai"], problems: ["wardrobe door broken", "need custom furniture", "kitchen cabinet repair", "door hinge replacement", "bookshelf installation", "window frame repair"] },
  { name: "Pest Control", keywords_en: ["pest", "termite", "cockroach", "pest control", "rats", "mosquito", "bedbugs"], keywords_mr: ["कीटक नियंत्रण", "कीटक", "झुरळ", "उंदीर", "डास", "ढेकूण", "वाळवी"], hinglish: ["cockroach bahut hai", "termite control chahiye", "makdi ka jaal"], problems: ["cockroach infestation", "termite in furniture", "rat problem", "bedbug issue", "mosquito control", "ant problem in kitchen"] },
  { name: "Salon", keywords_en: ["salon", "haircut", "beauty", "spa", "grooming", "facial", "makeup", "bridal", "mehndi"], keywords_mr: ["सलून", "केशकर्तन", "ब्युटी", "सौंदर्य", "मेकअप", "फेशियल", "मेहंदी"], hinglish: ["haircut karwana hai", "facial chahiye", "bridal makeup"], problems: ["need a haircut at home", "bridal makeup for wedding", "facial and cleanup", "men's grooming", "mehndi for event", "spa at home"] },
  { name: "Appliance Repair", keywords_en: ["appliance", "fridge", "washing machine", "microwave", "refrigerator", "geyser"], keywords_mr: ["उपकरण दुरुस्ती", "फ्रिज", "वॉशिंग मशीन", "मायक्रोवेव्ह", "गिझर"], hinglish: ["fridge kharab ho gaya", "washing machine nahi chal rahi", "geyser repair"], problems: ["fridge not cooling", "washing machine vibrating", "microwave not heating", "geyser leaking", "dishwasher broken", "chimney not working"] },
  { name: "Moving", keywords_en: ["moving", "packers", "movers", "relocation", "shifting", "packers and movers", "transport"], keywords_mr: ["स्थलांतर", "पॅकर्स", "मूव्हर्स", "घर बदलणे", "वाहतूक"], hinglish: ["ghar shift karna hai", "packers movers chahiye", "saman le jaana hai"], problems: ["shifting to new city", "office relocation", "need packers for 2BHK", "furniture transport", "interstate shifting", "vehicle transport"] },
  { name: "Photography", keywords_en: ["photography", "photographer", "photo", "photo shoot", "videography"], keywords_mr: ["फोटोग्राफी", "फोटोग्राफर", "छायाचित्रण", "व्हिडिओग्राफी"], hinglish: ["photographer chahiye", "wedding photography", "photo shoot karwana"], problems: ["wedding photography", "baby photoshoot", "product photography", "corporate event video", "birthday party photos", "pre-wedding shoot"] },
  { name: "Catering", keywords_en: ["catering", "caterer", "food", "cook", "chef", "tiffin"], keywords_mr: ["केटरिंग", "स्वयंपाकी", "जेवण", "डबा", "शेफ"], hinglish: ["khana banwana hai", "catering for party", "cook chahiye"], problems: ["party catering for 50 people", "daily tiffin service", "wedding catering", "birthday party food", "office lunch catering", "quick cook for event"] },
  { name: "Mobile Repair", keywords_en: ["mobile", "mobile repair", "phone", "phone repair", "screen repair"], keywords_mr: ["मोबाइल", "मोबाइल दुरुस्ती", "फोन दुरुस्ती", "स्क्रीन दुरुस्ती"], hinglish: ["phone ki screen toot gayi", "mobile repair karna hai", "phone band ho gaya"], problems: ["cracked screen", "battery draining fast", "phone not charging", "speaker not working", "water damage repair", "software issues"] },
  { name: "Computer Repair", keywords_en: ["laptop", "computer", "laptop repair", "printer"], keywords_mr: ["लॅपटॉप", "कम्प्युटर"], hinglish: ["laptop slow chal raha", "computer repair chahiye", "printer nahi chal raha"], problems: ["laptop overheating", "computer won't start", "printer paper jam", "virus removal", "data recovery", "laptop screen replacement"] },
  { name: "Tutoring", keywords_en: ["tutor", "tutoring", "tuition", "teacher", "coaching"], keywords_mr: ["शिकवणी", "ट्यूशन", "शिक्षक", "कोचिंग"], hinglish: ["tuition teacher chahiye", "maths ka coaching", "home tutor"], problems: ["math tutor for class 10", "English speaking classes", "science tuition", "competitive exam coaching", "music lessons", "language classes"] },
  { name: "Fitness", keywords_en: ["fitness", "personal trainer", "yoga", "gym"], keywords_mr: ["फिटनेस", "योगा", "व्यायाम", "जिम"], hinglish: ["yoga teacher chahiye", "fitness trainer", "gym trainer ghar pe"], problems: ["personal trainer at home", "yoga for beginners", "weight loss program", "post-pregnancy fitness", "senior citizen exercises", "zumba classes"] },
];

// ═══ Intent templates ═══
interface Example { input: string; output: Record<string, unknown> }

// ─── SERVICE_SEARCH: formal, colloquial, Hinglish, Marathi, problem-based, typo ───
function serviceSearchExamples(cat: typeof CATEGORIES[number]): Example[] {
  const examples: Example[] = [];
  const kw = cat.keywords_en;
  const km = cat.keywords_mr;

  const outputBase = {
    intent: "SERVICE_SEARCH",
    action: "SHOW_RESULTS",
    service: cat.name,
    mode: "SERVICE",
    confidence: 0.95,
    message: `I'll find the best ${cat.name.toLowerCase()} vendors near you. Here are the top-rated options:`,
  };
  const mrOutput = {
    ...outputBase,
    message: `मी तुमच्या जवळचे सर्वोत्तम ${cat.name.toLowerCase()} विक्रेते शोधतो. येथे शीर्ष पर्याय आहेत:`,
  };

  // Formal English
  const formal = [
    `I need a ${kw[0]}`,
    `Find me a ${kw[0]} near me`,
    `Show ${kw[0]} services`,
    `Looking for ${kw[0]}`,
    `${kw[0]} service near me`,
    `Best ${kw[0]} in my area`,
    `I need help with ${kw[1] || kw[0]}`,
    `Can you find a good ${kw[0]}?`,
    `${kw[0]} available nearby?`,
    `I want to book a ${kw[0]}`,
    `${cat.name} service please`,
    `Show me top ${cat.name.toLowerCase()} vendors`,
    `Get me ${cat.name.toLowerCase()} help`,
    `Need urgent ${kw[0]}`,
    `My ${kw[1] || kw[0]} is broken, need help`,
    `I'm looking for ${cat.name.toLowerCase()} services in my locality`,
    `Could you recommend a ${kw[0]}?`,
    `I require ${cat.name.toLowerCase()} assistance at my home`,
    `Search for ${kw[0]} professionals`,
  ];
  for (const t of formal) examples.push({ input: t, output: outputBase });

  // Colloquial / informal / abbreviation
  const colloquial = [
    `need ${kw[0]} asap`,
    `get me a ${kw[0]} rn`,
    `${kw[0]} plz`,
    `any ${kw[0]} around?`,
    `yo need a ${kw[0]}`,
    `${kw[0]} guy near me?`,
  ];
  for (const t of colloquial) examples.push({ input: t, output: outputBase });

  // Typos (Bitext Z-tag inspired)
  const typos = [
    `I need a ${kw[0].slice(0, -1) + kw[0].slice(-1).toUpperCase()}`,
    `find ${kw[0].substring(0, 3)}${kw[0].substring(4)} near me`,
    `${cat.name.toLowerCase()} servce`,
  ];
  for (const t of typos) examples.push({ input: t, output: outputBase });

  // Hinglish
  for (const h of cat.hinglish) {
    examples.push({ input: h, output: outputBase });
  }

  // Problem-based (contextual real-world sentences)
  for (const p of cat.problems) {
    examples.push({ input: p, output: outputBase });
    examples.push({ input: `I have a problem: ${p}`, output: outputBase });
  }

  // Marathi
  if (km.length > 0) {
    const mrTemplates = [
      `मला ${km[0]} हवा`,
      `${km[0]} सेवा दाखवा`,
      `जवळचा ${km[0]} शोधा`,
      `${km[0]} लागतो`,
      `${km[0]} कुठे मिळेल?`,
      `चांगला ${km[0]} सांगा`,
      `${km[0]} बोलवा`,
    ];
    for (const t of mrTemplates) examples.push({ input: t, output: mrOutput });
  }

  return examples;
}

// ─── FAQ: comprehensive Q&A covering booking, payment, safety, vendor, platform ───
function faqExamples(): Example[] {
  const pairs: { q: string; a: string }[] = [
    // Booking
    { q: "How do I book a service?", a: "Booking is easy! Search for a service, pick a vendor based on ratings and reviews, choose a time, and book. Payments are secure and you can track your booking status in real-time." },
    { q: "How to book?", a: "Search for a service you need, select a vendor, choose a convenient time slot, and confirm your booking. It's simple!" },
    { q: "booking kaise karte hain?", a: "Service search karo, vendor choose karo, time select karo, aur confirm karo. Bahut easy hai!" },
    { q: "What happens after I book?", a: "After booking, the vendor receives a notification and confirms. You'll get booking status updates and can track progress in the My Bookings section." },
    { q: "Can I book for someone else?", a: "Yes! You can book a service at any address. Just provide the correct service address and contact details during booking." },
    { q: "How far in advance should I book?", a: "We recommend booking at least 24 hours in advance for best availability. However, some vendors accept same-day bookings." },
    { q: "Is there a minimum booking amount?", a: "There's no platform-wide minimum. Each vendor sets their own pricing. You can see the rates before confirming your booking." },
    // Cancellation
    { q: "How do I cancel my booking?", a: "You can cancel your booking from the My Bookings section. If the vendor hasn't started work yet, you'll get a full refund." },
    { q: "Can I cancel?", a: "Yes! Go to My Bookings, select the booking you want to cancel, and click Cancel. Refund policy depends on the booking status." },
    { q: "booking cancel kaise karu?", a: "My Bookings me jao, booking select karo aur Cancel button press karo. Agar vendor ne kaam shuru nahi kiya to full refund milega." },
    { q: "What is the cancellation policy?", a: "Free cancellation if the vendor hasn't started. After vendor starts, partial charges may apply. Check the booking details for specific terms." },
    { q: "Will I get a refund if I cancel?", a: "Yes, if cancelled before the vendor starts work, you get a full refund. Partial refunds apply if work has begun. Refunds process within 5-7 business days." },
    { q: "Cancel within how many hours?", a: "You can cancel anytime before the vendor starts work. We recommend cancelling at least 2 hours before the scheduled time for a smooth refund." },
    // Payment
    { q: "How does payment work?", a: "VendorCenter uses secure payment processing. You pay after the service is completed and you're satisfied. Your payment details are encrypted." },
    { q: "Is payment safe?", a: "Absolutely! All payments are processed securely with encryption. Your financial details are never shared with vendors." },
    { q: "What payment methods?", a: "We accept UPI, debit cards, credit cards, and net banking. All transactions are securely processed." },
    { q: "Do you accept UPI?", a: "Yes! We accept UPI along with debit cards, credit cards, and net banking." },
    { q: "payment kaise hota hai?", a: "Service complete hone ke baad pay karo. UPI, card, net banking sab accept hota hai. Payment fully secure hai." },
    { q: "Can I pay in cash?", a: "Currently we support digital payments — UPI, cards, and net banking — for security and transparency. Cash option may vary by vendor." },
    { q: "Payment failed, what to do?", a: "If payment failed, any debited amount will be auto-refunded within 48 hours. Try again with a different payment method, or contact support." },
    { q: "Do I need to pay upfront?", a: "No upfront payment is required for most services. You pay after the service is completed to your satisfaction." },
    // Vendor
    { q: "Are vendors verified?", a: "Yes! All vendors go through a verification process. We check their identity, work samples, and portfolio before approval." },
    { q: "How do I become a vendor?", a: "Register with your business details, upload your portfolio and documents, and our team will verify your profile. Once approved, you can start receiving bookings!" },
    { q: "I want to register as a vendor", a: "Great! You can register as a vendor by clicking 'Become a Vendor' on our homepage. You'll need your business details and service portfolio." },
    { q: "vendor kaise bante hain?", a: "Homepage pe 'Become a Vendor' click karo, business details aur portfolio upload karo. Verification ke baad bookings milna shuru ho jayengi!" },
    { q: "How are vendors rated?", a: "Vendors are rated by customers after each completed booking. Ratings are based on quality, punctuality, and professionalism." },
    { q: "Can I choose a specific vendor?", a: "Yes! Browse vendor profiles with ratings, reviews, and portfolios, then choose the one that suits you best." },
    { q: "What if the vendor doesn't show up?", a: "If a vendor misses the appointment, you get a full refund and the vendor is penalized. Contact support for immediate re-assignment." },
    { q: "How do I review a vendor?", a: "After the service is completed, you'll receive a prompt to rate and review the vendor. Your honest feedback helps other customers." },
    // Satisfaction & complaints
    { q: "What if I'm not satisfied?", a: "Your satisfaction matters! If you're not happy, raise a complaint from your booking page. Our support team will help resolve the issue." },
    { q: "How do I raise a complaint?", a: "Go to My Bookings, select the booking, and click 'Report Issue'. Describe the problem and our support team will respond within 24 hours." },
    { q: "I had a bad experience", a: "We're sorry to hear that. Please raise a complaint from your booking page so our support team can investigate and resolve the issue." },
    { q: "Service quality was poor", a: "Sorry about your experience. Please rate the vendor honestly and raise a complaint. We take quality seriously and will follow up." },
    { q: "complaint kaise karu?", a: "My Bookings me jao, booking select karo, 'Report Issue' pe click karo. Humari team 24 ghante me respond karegi." },
    // Ratings
    { q: "How are ratings calculated?", a: "Ratings are based on genuine customer reviews after completed bookings. The average rating and total reviews are shown on each vendor profile." },
    { q: "Can I trust the reviews?", a: "Yes! Only customers who've completed a booking can leave reviews. We verify each review to prevent fake ratings." },
    // Safety
    { q: "Is my data safe?", a: "VendorCenter follows strict data privacy practices. Your personal information is encrypted and never shared without your consent." },
    { q: "Is it safe to share my address?", a: "Yes, your address is only shared with the confirmed vendor and is encrypted. It's never sold or shared with third parties." },
    // Coverage
    { q: "What areas do you cover?", a: "We operate across multiple zones and cities. Share your location and we'll show local vendors. We're expanding regularly!" },
    { q: "Do you operate in my city?", a: "We're available in many cities across India. Enter your location and we'll show available vendors near you." },
    { q: "kya mere area me available hai?", a: "Apna location share karo, hum dikha denge ki aapke area me kaunse vendors available hain." },
    // Reschedule
    { q: "Can I reschedule my booking?", a: "You can reschedule by contacting the vendor through the booking page. Both parties need to agree on the new time." },
    { q: "How do I change my booking time?", a: "Go to My Bookings, select the booking, and use the reschedule option. The vendor will confirm the new timing." },
    { q: "booking reschedule kaise karu?", a: "My Bookings me jao, booking select karo, reschedule option use karo. Vendor nayi timing confirm karega." },
    // Support
    { q: "How do I contact support?", a: "Reach us through the Help section in the app, or email our support team. We typically respond within 24 hours." },
    { q: "support se baat kaise karu?", a: "App me Help section me jao ya support team ko email karo. Hum 24 ghante me reply karte hain." },
    { q: "Is there a helpline number?", a: "You can reach our support through the app's Help section. We prioritize quick resolution for all queries." },
    // Platform
    { q: "Tell me about VendorCenter", a: "VendorCenter is a platform connecting customers with verified local service providers. Book trusted vendors for plumbing, electrical, cleaning, and 15+ other services." },
    { q: "What is this app?", a: "VendorCenter connects you with verified local service professionals. From plumbing to photography, find trusted vendors, compare ratings, and book with confidence." },
    { q: "Who built this?", a: "VendorCenter is built by Prime Architect, focused on making local service booking transparent, secure, and reliable." },
    { q: "ye app kya hai?", a: "VendorCenter ek platform hai jo customers ko verified local service providers se connect karta hai. Plumbing, electrical, cleaning aur 15+ services book karo." },
    // Pricing / value
    { q: "Is VendorCenter free to use?", a: "Yes, browsing and searching is free. You only pay for the service you book. No hidden platform fees for customers." },
    { q: "Why should I use VendorCenter?", a: "Verified vendors, transparent pricing, secure payments, real reviews, and 15+ service categories — all in one platform." },
    { q: "How is VendorCenter different from others?", a: "We focus on vendor verification, transparent pricing, and customer satisfaction. Every vendor is vetted and every review is genuine." },
    // Marathi FAQs
    { q: "बुकिंग कसे करावे?", a: "सेवा शोधा, विक्रेता निवडा, वेळ निवडा आणि बुकिंग पुष्टी करा. खूप सोपे आहे!" },
    { q: "पेमेंट कसे होते?", a: "सेवा पूर्ण झाल्यावर पेमेंट करा. UPI, कार्ड आणि नेट बँकिंग स्वीकारले जाते. पेमेंट पूर्णपणे सुरक्षित आहे." },
    { q: "विक्रेते विश्वासार्ह आहेत का?", a: "होय! सर्व विक्रेत्यांची ओळख, कामाचे नमुने आणि पोर्टफोलिओ तपासून पडताळणी केली जाते." },
    { q: "तक्रार कशी नोंदवावी?", a: "My Bookings मध्ये जा, बुकिंग निवडा आणि 'Report Issue' वर क्लिक करा. आमची टीम 24 तासांत प्रतिसाद देईल." },
    { q: "रद्द कसे करावे?", a: "My Bookings मध्ये जा, बुकिंग निवडा आणि Cancel बटण दाबा. विक्रेत्याने काम सुरू केले नसल्यास पूर्ण परतावा मिळेल." },
  ];

  return pairs.map(({ q, a }) => ({
    input: q,
    output: {
      intent: "FAQ",
      action: "NONE",
      service: "",
      mode: "CHAT",
      confidence: 0.9,
      message: a,
    },
  }));
}

// ─── GREETING: hi/hello/namaste in all registers ───
function greetingExamples(): Example[] {
  const greetings = [
    "hi", "hello", "hey", "good morning", "good evening", "good afternoon",
    "namaste", "namaskar", "नमस्ते", "नमस्कार",
    "what can you do?", "help", "how does this work?",
    "hi there", "hey there", "howdy",
    "hii", "hlllo", "helo",
    "sup", "yo", "heyy",
    "kya kar sakte ho?", "kya help milegi?",
    "start", "begin",
    "I need help", "assist me",
    "Good day", "Morning",
  ];
  return greetings.map((g) => ({
    input: g,
    output: {
      intent: "GREETING",
      action: "NONE",
      service: "",
      mode: "CHAT",
      confidence: 0.95,
      message: "Hello! I'm VendorCenter's AI assistant. I can help you find and book local service professionals — plumbers, electricians, cleaners, and more. What service are you looking for?",
    },
  }));
}

// ─── MY_BOOKINGS: booking status queries ───
function bookingStatusExamples(): Example[] {
  const queries = [
    "Show my bookings",
    "What's the status of my booking?",
    "My recent bookings",
    "Do I have any active bookings?",
    "Check my booking status",
    "Where is my vendor?",
    "When is my next booking?",
    "My upcoming appointments",
    "show booking history",
    "meri bookings dikhao",
    "booking ka status kya hai?",
    "mera order kahan hai?",
    "booking status check karo",
    "list my past bookings",
    "any pending bookings?",
    "मझ्या बुकिंगची स्थिती",
    "माझ्या बुकिंग दाखवा",
    "माझ्या सेवा कुठपर्यंत आल्या?",
  ];
  return queries.map((q) => ({
    input: q,
    output: {
      intent: "MY_BOOKINGS",
      action: "SHOW_MY_BOOKINGS",
      service: "",
      mode: "SERVICE",
      confidence: 0.95,
      message: "Here are your recent bookings:",
    },
  }));
}

// ─── AVAILABLE_SERVICES: browsing/discovery ───
function availableServicesExamples(): Example[] {
  const queries = [
    "What services are available?",
    "Show all services",
    "What can I book?",
    "List of services",
    "What do you offer?",
    "Show me all categories",
    "Browse services",
    "What kind of services do you have?",
    "services list dikhao",
    "kya kya milta hai yahan?",
    "all services please",
    "what services you got?",
    "show me everything",
    "categories",
    "कोणत्या सेवा उपलब्ध आहेत?",
    "सर्व सेवा दाखवा",
    "तुम्ही कोणत्या सेवा देता?",
  ];
  return queries.map((q) => ({
    input: q,
    output: {
      intent: "AVAILABLE_SERVICES",
      action: "SHOW_CATEGORIES",
      service: "",
      mode: "SERVICE",
      confidence: 0.9,
      message: "We offer a wide range of services including plumbing, electrical, AC repair, cleaning, painting, carpentry, and many more. Here are all available categories:",
    },
  }));
}

// ─── PRICE_INQUIRY: cost/rate questions per category ───
function priceInquiryExamples(): Example[] {
  const examples: Example[] = [];
  for (const cat of CATEGORIES) {
    const queries = [
      `How much does ${cat.name.toLowerCase()} cost?`,
      `${cat.name} price`,
      `What's the rate for ${cat.keywords_en[0]}?`,
      `${cat.keywords_en[0]} charges`,
      `${cat.name.toLowerCase()} kitna lagega?`,
      `${cat.keywords_en[0]} ka rate kya hai?`,
      `price for ${cat.name.toLowerCase()} service`,
      `estimated cost of ${cat.keywords_en[0]}`,
    ];
    for (const q of queries) {
      examples.push({
        input: q,
        output: {
          intent: "SERVICE_SEARCH",
          action: "SHOW_RESULTS",
          service: cat.name,
          mode: "SERVICE",
          confidence: 0.85,
          message: `Pricing for ${cat.name.toLowerCase()} varies by vendor and scope of work. Let me show you vendors with their rates so you can compare:`,
        },
      });
    }
  }
  return examples;
}

// ─── COMPLAINT: dissatisfaction, issue reporting ───
function complaintExamples(): Example[] {
  const queries = [
    "I want to file a complaint",
    "The vendor did a terrible job",
    "Service was very bad",
    "I am not happy with the service",
    "The work quality is poor",
    "Vendor was unprofessional",
    "He didn't complete the work",
    "The vendor came late",
    "My issue was not resolved",
    "Want to report a problem with my booking",
    "complaint raise karna hai",
    "kaam achha nahi hua",
    "vendor ne kaam nahi kiya",
    "bahut kharab service thi",
    "paisa barbaad ho gaya",
    "vendor was rude to me",
    "work is incomplete",
    "vendor damaged my property",
    "I need to escalate this issue",
    "This is unacceptable service",
    "very bad experience, never again",
    "the vendor asked for extra money",
    "overcharged by the vendor",
    "vendor ne zyada paise mange",
    "विक्रेत्याने काम नीट केले नाही",
    "सेवा अत्यंत वाईट होती",
    "तक्रार नोंदवायची आहे",
  ];
  return queries.map((q) => ({
    input: q,
    output: {
      intent: "COMPLAINT",
      action: "NAVIGATE",
      service: "",
      mode: "CHAT",
      confidence: 0.9,
      message: "I'm sorry about your experience. You can raise a complaint from your booking page — go to My Bookings, select the booking, and click 'Report Issue'. Our support team will investigate and respond within 24 hours.",
    },
  }));
}

// ─── RESCHEDULE: change booking time ───
function rescheduleExamples(): Example[] {
  const queries = [
    "I need to reschedule my booking",
    "Can I change the booking time?",
    "Reschedule my appointment",
    "I want to move my booking to tomorrow",
    "Need to change the date",
    "Is it possible to reschedule?",
    "booking ka time change karna hai",
    "kal ke liye shift karo",
    "date badalni hai",
    "reschedule please",
    "postpone my booking",
    "can we do it next week instead?",
    "change timing of my service",
    "vendor ko bol do kal aaye",
    "माझे बुकिंग पुन्हा शेड्यूल करा",
    "वेळ बदलायची आहे",
  ];
  return queries.map((q) => ({
    input: q,
    output: {
      intent: "RESCHEDULE",
      action: "NAVIGATE",
      service: "",
      mode: "SERVICE",
      confidence: 0.9,
      message: "You can reschedule from the My Bookings section — select your booking and use the reschedule option. The vendor will confirm the new timing.",
    },
  }));
}

// ─── CANCEL_BOOKING: explicit cancellation requests ───
function cancelBookingExamples(): Example[] {
  const queries = [
    "Cancel my booking",
    "I want to cancel",
    "Please cancel the service",
    "Cancel my appointment",
    "I don't need the service anymore",
    "booking cancel karo",
    "mujhe cancel karna hai",
    "service nahi chahiye ab",
    "please cancel it",
    "I changed my mind, cancel",
    "can you cancel my last booking?",
    "cancel the plumber booking",
    "I want to cancel the electrician",
    "booking radd kara",
    "माझे बुकिंग रद्द करा",
    "सेवा रद्द करायची आहे",
  ];
  return queries.map((q) => ({
    input: q,
    output: {
      intent: "CANCEL_BOOKING",
      action: "NAVIGATE",
      service: "",
      mode: "SERVICE",
      confidence: 0.9,
      message: "You can cancel from My Bookings — select the booking and click Cancel. If the vendor hasn't started work, you'll receive a full refund.",
    },
  }));
}

// ─── REFUND: refund status and policy ───
function refundExamples(): Example[] {
  const queries = [
    "Where is my refund?",
    "I haven't received my refund",
    "Refund status",
    "When will I get my money back?",
    "Check refund status",
    "mera refund kab aayega?",
    "paisa wapas nahi aaya",
    "refund ka status kya hai?",
    "How long does refund take?",
    "refund process kya hai?",
    "I want a refund",
    "give me my money back",
    "refund nahi mila abhi tak",
    "माझा परतावा कधी मिळेल?",
    "परतावा स्थिती तपासा",
  ];
  return queries.map((q) => ({
    input: q,
    output: {
      intent: "REFUND",
      action: "NAVIGATE",
      service: "",
      mode: "CHAT",
      confidence: 0.9,
      message: "Refunds are processed within 5-7 business days after cancellation. Check your booking page for the refund status. If it's delayed, contact our support team.",
    },
  }));
}

// ─── VENDOR_INFO: questions about specific vendor/profile ───
function vendorInfoExamples(): Example[] {
  const queries = [
    "Show me vendor reviews",
    "What is this vendor's rating?",
    "Tell me about this vendor",
    "Vendor profile",
    "How many jobs has this vendor done?",
    "Is this vendor reliable?",
    "vendor ki rating dikhao",
    "vendor ka profile dekhna hai",
    "kitne kaam kiye hain isne?",
    "Show vendor portfolio",
    "Does this vendor have experience?",
    "vendor reviews dikhao",
    "What other services does this vendor offer?",
    "vendor ke baare me batao",
    "या विक्रेत्याबद्दल सांगा",
    "विक्रेत्याचे रेटिंग दाखवा",
  ];
  return queries.map((q) => ({
    input: q,
    output: {
      intent: "VENDOR_INFO",
      action: "NAVIGATE",
      service: "",
      mode: "CHAT",
      confidence: 0.85,
      message: "You can view the vendor's complete profile including ratings, reviews, portfolio, and completed jobs. Click on the vendor name to see full details.",
    },
  }));
}

// ─── LOCATION: city/area questions ───
function locationExamples(): Example[] {
  const queries = [
    "Change my location",
    "Set my area to Pune",
    "I'm in Mumbai",
    "Update my address",
    "Show vendors in Delhi",
    "Services available in Bangalore",
    "mera location change karo",
    "pune me kya available hai?",
    "mumbai ke vendors dikhao",
    "my area is Kolhapur",
    "Thane me milega kya?",
    "set location to Nashik",
    "माझे स्थान बदला",
    "पुण्यातील विक्रेते दाखवा",
  ];
  return queries.map((q) => ({
    input: q,
    output: {
      intent: "LOCATION",
      action: "ASK_LOCATION",
      service: "",
      mode: "SERVICE",
      confidence: 0.85,
      message: "I'll update your location. Share your city or area, and I'll show vendors available near you.",
    },
  }));
}

// ─── UNKNOWN / out-of-scope ───
function outOfScopeExamples(): Example[] {
  const queries = [
    "What's the weather today?",
    "Tell me a joke",
    "Who is the prime minister?",
    "Write me a poem",
    "Play a song",
    "What's 2+2?",
    "Stock market news",
    "What time is it?",
    "Recipe for biryani",
    "Who won the cricket match?",
    "Translate this to French",
    "aaj ka mausam kaisa hai?",
    "joke sunao",
    "cricket score kya hai?",
    "Tell me about politics",
    "What is quantum computing?",
    "How to make money online?",
    "news kya hai aaj ki?",
    "python code likh do",
    "order food online",
    "book a flight",
    "hotel room chahiye",
    "give me a movie recommendation",
    "आज हवामान कसे आहे?",
    "विनोद सांगा",
  ];
  return queries.map((q) => ({
    input: q,
    output: {
      intent: "UNKNOWN",
      action: "NONE",
      service: "",
      mode: "CHAT",
      confidence: 0.3,
      message: "I'm VendorCenter's service assistant — I can help you find and book local service professionals like plumbers, electricians, cleaners, and more. How can I help you with a service today?",
    },
  }));
}

// ─── MULTI-INTENT / complex queries ───
function complexQueryExamples(): Example[] {
  const examples: Example[] = [];

  // Ambiguous — could be multiple services
  const ambiguous = [
    { input: "My house needs work", output: { intent: "AVAILABLE_SERVICES", action: "SHOW_CATEGORIES", service: "", mode: "SERVICE", confidence: 0.7, message: "I can help! What kind of work does your house need? We offer plumbing, electrical, carpentry, painting, cleaning, and many more services." } },
    { input: "ghar me bahut kuch karna hai", output: { intent: "AVAILABLE_SERVICES", action: "SHOW_CATEGORIES", service: "", mode: "SERVICE", confidence: 0.7, message: "I can help! What kind of work does your house need? We offer plumbing, electrical, carpentry, painting, cleaning, and many more services." } },
    { input: "Something is wrong in my bathroom", output: { intent: "SERVICE_SEARCH", action: "ASK_DETAILS", service: "", mode: "CHAT", confidence: 0.7, message: "I can help with bathroom issues! Could you tell me more? Is it a plumbing problem (leaks, clogs), electrical (lights, geyser), or cleaning?" } },
    { input: "I need multiple services", output: { intent: "AVAILABLE_SERVICES", action: "SHOW_CATEGORIES", service: "", mode: "SERVICE", confidence: 0.75, message: "Sure! You can book multiple services. Let me show you all available categories so you can pick what you need:" } },
    { input: "need help renovating my kitchen", output: { intent: "AVAILABLE_SERVICES", action: "SHOW_CATEGORIES", service: "", mode: "SERVICE", confidence: 0.75, message: "Kitchen renovation can involve multiple services — carpentry, plumbing, painting, electrical, and cleaning. Let me show you the categories:" } },
  ];
  examples.push(...ambiguous);

  // Comparison / recommendation
  const comparison = [
    { input: "Which plumber has the best reviews?", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "Plumbing", mode: "SERVICE", confidence: 0.9, message: "I'll show you plumbers sorted by ratings so you can choose the best-reviewed one:" } },
    { input: "Who is the cheapest electrician?", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "Electrical", mode: "SERVICE", confidence: 0.85, message: "I'll show you electricians sorted by price so you can find the most affordable option:" } },
    { input: "recommend a good cleaner", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "Cleaning", mode: "SERVICE", confidence: 0.9, message: "I'll find highly-rated cleaners near you. Here are the top-rated options:" } },
    { input: "best rated AC service?", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "AC Repair", mode: "SERVICE", confidence: 0.9, message: "I'll show you top-rated AC repair vendors near you:" } },
  ];
  examples.push(...comparison);

  // Urgency
  const urgency = [
    { input: "URGENT pipe burst help!!!!", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "Plumbing", mode: "SERVICE", confidence: 0.95, message: "Emergency plumbing help! Let me find available plumbers near you right now:" } },
    { input: "power cut need electrician NOW", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "Electrical", mode: "SERVICE", confidence: 0.95, message: "Emergency electrical help! Let me find available electricians near you right now:" } },
    { input: "gas leak in kitchen emergency", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "Plumbing", mode: "SERVICE", confidence: 0.95, message: "For gas-related emergencies, please also call your gas company's emergency line. Meanwhile, let me find available service professionals near you:" } },
    { input: "toilet overflow help me", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "Plumbing", mode: "SERVICE", confidence: 0.95, message: "Emergency plumbing help! Let me find available plumbers near you right now:" } },
  ];
  examples.push(...urgency);

  // Polite / formal
  const polite = [
    { input: "Could you kindly assist me in finding a reliable carpenter?", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "Carpentry", mode: "SERVICE", confidence: 0.9, message: "Of course! I'll find reliable carpenters near you. Here are the top-rated options:" } },
    { input: "Would it be possible to schedule an AC maintenance visit?", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "AC Repair", mode: "SERVICE", confidence: 0.9, message: "Absolutely! Let me find AC service vendors for you:" } },
    { input: "I would appreciate help finding a salon service at home", output: { intent: "SERVICE_SEARCH", action: "SHOW_RESULTS", service: "Salon", mode: "SERVICE", confidence: 0.9, message: "I'll find salon service providers who offer home visits. Here are the top-rated options:" } },
  ];
  examples.push(...polite);

  // Frustrated / angry
  const frustrated = [
    { input: "nothing works on this damn app", output: { intent: "COMPLAINT", action: "NAVIGATE", service: "", mode: "CHAT", confidence: 0.8, message: "I'm sorry you're having trouble. Could you tell me what specific issue you're facing? I'll do my best to help, or connect you with our support team." } },
    { input: "worst service ever", output: { intent: "COMPLAINT", action: "NAVIGATE", service: "", mode: "CHAT", confidence: 0.85, message: "I'm sorry about your experience. Please raise a complaint from your booking page so our support team can investigate and make it right." } },
    { input: "useless app waste of time", output: { intent: "COMPLAINT", action: "NAVIGATE", service: "", mode: "CHAT", confidence: 0.8, message: "I'm sorry you feel that way. Please tell me what went wrong and I'll try to help, or you can contact our support team directly." } },
  ];
  examples.push(...frustrated);

  return examples;
}

// ═══ Instruction prefix (system prompt condensed) ═══
const INSTRUCTION = `You are VendorCenter's AI assistant. Given the user's message, produce a JSON decision with: intent (SERVICE_SEARCH | FAQ | GREETING | MY_BOOKINGS | AVAILABLE_SERVICES | COMPLAINT | RESCHEDULE | CANCEL_BOOKING | REFUND | VENDOR_INFO | LOCATION | UNKNOWN), action (SHOW_RESULTS | ASK_LOCATION | ASK_DETAILS | NAVIGATE | SHOW_MY_BOOKINGS | SHOW_CATEGORIES | NONE), service (category name or empty), mode (SERVICE | CHAT), confidence (0-1), and message (natural language response). Support English, Hinglish, and Marathi.`;

// ═══ Main ═══
function main() {
  const allExamples: Example[] = [];

  // Service search for each category (largest portion — ~40 per category)
  for (const cat of CATEGORIES) {
    allExamples.push(...serviceSearchExamples(cat));
  }

  // All intent functions
  allExamples.push(...faqExamples());
  allExamples.push(...greetingExamples());
  allExamples.push(...bookingStatusExamples());
  allExamples.push(...availableServicesExamples());
  allExamples.push(...priceInquiryExamples());
  allExamples.push(...complaintExamples());
  allExamples.push(...rescheduleExamples());
  allExamples.push(...cancelBookingExamples());
  allExamples.push(...refundExamples());
  allExamples.push(...vendorInfoExamples());
  allExamples.push(...locationExamples());
  allExamples.push(...outOfScopeExamples());
  allExamples.push(...complexQueryExamples());

  // Shuffle deterministically
  let seed = 42;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = allExamples.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allExamples[i], allExamples[j]] = [allExamples[j], allExamples[i]];
  }

  // Write JSONL
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const lines = allExamples.map((ex) =>
    JSON.stringify({
      instruction: INSTRUCTION,
      input: ex.input,
      output: JSON.stringify(ex.output),
    }),
  );
  fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf8");

  console.log(`[training-data] Generated ${allExamples.length} examples → ${OUT_FILE}`);

  // Stats
  const intentCounts: Record<string, number> = {};
  for (const ex of allExamples) {
    const intent = (ex.output as any).intent;
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;
  }
  console.log("[training-data] Distribution:");
  for (const [intent, count] of Object.entries(intentCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${intent}: ${count}`);
  }
  console.log(`  TOTAL: ${allExamples.length}`);
}

main();
