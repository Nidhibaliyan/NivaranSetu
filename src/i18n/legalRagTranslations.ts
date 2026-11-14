import type { LanguageCode } from '../types';

export const LEGAL_RAG_LANGUAGES: Record<LanguageCode, { nativeName: string; label: string }> = {
  en: { nativeName: 'English', label: 'English' },
  hi: { nativeName: 'हिन्दी', label: 'Hindi' },
  bn: { nativeName: 'বাংলা', label: 'Bengali' },
  mr: { nativeName: 'मराठी', label: 'Marathi' },
  ta: { nativeName: 'தமிழ்', label: 'Tamil' },
  te: { nativeName: 'తెలుగు', label: 'Telugu' },
  kn: { nativeName: 'ಕನ್ನಡ', label: 'Kannada' },
  ml: { nativeName: 'മലയാളം', label: 'Malayalam' },
  gu: { nativeName: 'ગુજરાતી', label: 'Gujarati' },
  pa: { nativeName: 'ਪੰਜਾਬੀ', label: 'Punjabi' },
  or: { nativeName: 'ଓଡ଼ିଆ', label: 'Odia' },
  ur: { nativeName: 'اردو', label: 'Urdu' },
};

type Copy = {
  title: string; subtitle: string; question: string; placeholder: string;
  ask: string; searching: string; sources: string; empty: string;
  disclaimer: string; error: string; language: string;
};

export const LEGAL_RAG_COPY: Record<LanguageCode, Copy> = {
  en: {
    title: 'Legal Knowledge Assistant', subtitle: 'Ask questions about retrieved legal and regulatory sources.',
    question: 'Your question', placeholder: 'Example: What is the RBI process after a bank rejects my complaint?',
    ask: 'Ask legal sources', searching: 'Searching verified sources…', sources: 'Retrieved sources',
    empty: 'Ask a question to search the legal knowledge base.', disclaimer: 'Informational support only — not legal advice. Verify current law and case-specific applicability with a qualified professional.',
    error: 'Unable to retrieve an answer. Please try again.', language: 'Answer language',
  },
  hi: {
    title: 'कानूनी जानकारी सहायक', subtitle: 'सत्यापित कानूनी और नियामक स्रोतों के बारे में प्रश्न पूछें।',
    question: 'आपका प्रश्न', placeholder: 'उदाहरण: बैंक द्वारा शिकायत अस्वीकार करने के बाद RBI की प्रक्रिया क्या है?',
    ask: 'कानूनी स्रोत खोजें', searching: 'सत्यापित स्रोत खोजे जा रहे हैं…', sources: 'प्राप्त स्रोत',
    empty: 'कानूनी जानकारी खोजने के लिए प्रश्न पूछें।', disclaimer: 'केवल सूचनात्मक सहायता — कानूनी सलाह नहीं। वर्तमान कानून और मामले पर लागू होने की पुष्टि योग्य विशेषज्ञ से करें।',
    error: 'उत्तर प्राप्त नहीं हो सका। कृपया पुनः प्रयास करें।', language: 'उत्तर की भाषा',
  },
  bn: {
    title: 'আইনি তথ্য সহায়ক', subtitle: 'যাচাইকৃত আইনি ও নিয়ন্ত্রক উৎস সম্পর্কে প্রশ্ন করুন।',
    question: 'আপনার প্রশ্ন', placeholder: 'উদাহরণ: ব্যাংক অভিযোগ প্রত্যাখ্যান করলে RBI-এর প্রক্রিয়া কী?',
    ask: 'আইনি উৎস খুঁজুন', searching: 'যাচাইকৃত উৎস খোঁজা হচ্ছে…', sources: 'প্রাপ্ত উৎস',
    empty: 'আইনি তথ্যভান্ডার খুঁজতে একটি প্রশ্ন করুন।', disclaimer: 'শুধুমাত্র তথ্যগত সহায়তা—আইনি পরামর্শ নয়। বর্তমান আইন ও আপনার ক্ষেত্রে প্রযোজ্যতা বিশেষজ্ঞের মাধ্যমে যাচাই করুন।',
    error: 'উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।', language: 'উত্তরের ভাষা',
  },
  mr: {
    title: 'कायदेशीर माहिती सहाय्यक', subtitle: 'सत्यापित कायदेशीर आणि नियामक स्रोतांबद्दल प्रश्न विचारा.',
    question: 'तुमचा प्रश्न', placeholder: 'उदाहरण: बँकेने तक्रार नाकारल्यानंतर RBI प्रक्रिया काय आहे?',
    ask: 'कायदेशीर स्रोत शोधा', searching: 'सत्यापित स्रोत शोधत आहे…', sources: 'मिळालेले स्रोत',
    empty: 'कायदेशीर माहिती शोधण्यासाठी प्रश्न विचारा.', disclaimer: 'फक्त माहितीपर मदत—कायदेशीर सल्ला नाही. सध्याचा कायदा आणि तुमच्या प्रकरणातील लागूत्व तज्ज्ञांकडून तपासा.',
    error: 'उत्तर मिळू शकले नाही. पुन्हा प्रयत्न करा.', language: 'उत्तराची भाषा',
  },
  ta: {
    title: 'சட்டத் தகவல் உதவியாளர்', subtitle: 'சரிபார்க்கப்பட்ட சட்ட மற்றும் ஒழுங்குமுறை ஆதாரங்கள் குறித்து கேளுங்கள்.',
    question: 'உங்கள் கேள்வி', placeholder: 'உதாரணம்: வங்கி புகாரை நிராகரித்த பிறகு RBI நடைமுறை என்ன?',
    ask: 'சட்ட ஆதாரங்களைத் தேடு', searching: 'சரிபார்க்கப்பட்ட ஆதாரங்கள் தேடப்படுகின்றன…', sources: 'கிடைத்த ஆதாரங்கள்',
    empty: 'சட்ட அறிவுத் தளத்தைத் தேட ஒரு கேள்வியைக் கேளுங்கள்.', disclaimer: 'தகவல் உதவி மட்டுமே—சட்ட ஆலோசனை அல்ல. தற்போதைய சட்டத்தையும் உங்கள் வழக்கிற்கான பொருத்தத்தையும் நிபுணரிடம் சரிபார்க்கவும்.',
    error: 'பதிலைப் பெற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.', language: 'பதில் மொழி',
  },
  te: {
    title: 'న్యాయ సమాచారం సహాయకుడు', subtitle: 'ధృవీకరించిన చట్టాలు మరియు నియంత్రణ మూలాల గురించి అడగండి.',
    question: 'మీ ప్రశ్న', placeholder: 'ఉదాహరణ: బ్యాంక్ ఫిర్యాదును తిరస్కరించిన తర్వాత RBI ప్రక్రియ ఏమిటి?',
    ask: 'చట్టపరమైన మూలాలను వెతకండి', searching: 'ధృవీకరించిన మూలాలను వెతుకుతోంది…', sources: 'లభించిన మూలాలు',
    empty: 'చట్టపరమైన సమాచారాన్ని వెతకడానికి ప్రశ్న అడగండి.', disclaimer: 'సమాచార సహాయం మాత్రమే—న్యాయ సలహా కాదు. ప్రస్తుత చట్టం మరియు మీ కేసుకు వర్తింపును నిపుణుడితో నిర్ధారించండి.',
    error: 'సమాధానం పొందలేకపోయాం. మళ్లీ ప్రయత్నించండి.', language: 'సమాధాన భాష',
  },
  kn: {
    title: 'ಕಾನೂನು ಮಾಹಿತಿ ಸಹಾಯಕ', subtitle: 'ಪರಿಶೀಲಿತ ಕಾನೂನು ಮತ್ತು ನಿಯಂತ್ರಣ ಮೂಲಗಳ ಬಗ್ಗೆ ಪ್ರಶ್ನಿಸಿ.',
    question: 'ನಿಮ್ಮ ಪ್ರಶ್ನೆ', placeholder: 'ಉದಾಹರಣೆ: ಬ್ಯಾಂಕ್ ದೂರು ತಿರಸ್ಕರಿಸಿದ ನಂತರ RBI ಪ್ರಕ್ರಿಯೆ ಏನು?',
    ask: 'ಕಾನೂನು ಮೂಲಗಳನ್ನು ಹುಡುಕಿ', searching: 'ಪರಿಶೀಲಿತ ಮೂಲಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ…', sources: 'ಪಡೆದ ಮೂಲಗಳು',
    empty: 'ಕಾನೂನು ಜ್ಞಾನ ಸಂಗ್ರಹವನ್ನು ಹುಡುಕಲು ಪ್ರಶ್ನೆ ಕೇಳಿ.', disclaimer: 'ಮಾಹಿತಿ ಸಹಾಯ ಮಾತ್ರ—ಕಾನೂನು ಸಲಹೆಯಲ್ಲ. ಪ್ರಸ್ತುತ ಕಾನೂನು ಮತ್ತು ನಿಮ್ಮ ಪ್ರಕರಣಕ್ಕೆ ಅನ್ವಯಿಸುವುದನ್ನು ತಜ್ಞರಿಂದ ಪರಿಶೀಲಿಸಿ.',
    error: 'ಉತ್ತರ ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', language: 'ಉತ್ತರದ ಭಾಷೆ',
  },
  ml: {
    title: 'നിയമ വിവര സഹായി', subtitle: 'പരിശോധിച്ച നിയമ, നിയന്ത്രണ സ്രോതസ്സുകളെക്കുറിച്ച് ചോദിക്കുക.',
    question: 'നിങ്ങളുടെ ചോദ്യം', placeholder: 'ഉദാഹരണം: ബാങ്ക് പരാതി നിരസിച്ചാൽ RBI നടപടിക്രമം എന്താണ്?',
    ask: 'നിയമ സ്രോതസ്സുകൾ തിരയുക', searching: 'പരിശോധിച്ച സ്രോതസ്സുകൾ തിരയുന്നു…', sources: 'ലഭിച്ച സ്രോതസ്സുകൾ',
    empty: 'നിയമ വിജ്ഞാനശേഖരം തിരയാൻ ഒരു ചോദ്യം ചോദിക്കുക.', disclaimer: 'വിവര സഹായം മാത്രം—നിയമോപദേശം അല്ല. നിലവിലെ നിയമവും നിങ്ങളുടെ കേസിലെ ബാധകതയും വിദഗ്ധനോട് സ്ഥിരീകരിക്കുക.',
    error: 'ഉത്തരം ലഭിച്ചില്ല. വീണ്ടും ശ്രമിക്കുക.', language: 'ഉത്തരത്തിന്റെ ഭാഷ',
  },
  gu: {
    title: 'કાનૂની માહિતી સહાયક', subtitle: 'ચકાસેલા કાનૂની અને નિયમનકારી સ્ત્રોતો વિશે પ્રશ્નો પૂછો.',
    question: 'તમારો પ્રશ્ન', placeholder: 'ઉદાહરણ: બેંક ફરિયાદ નકારે પછી RBI પ્રક્રિયા શું છે?',
    ask: 'કાનૂની સ્ત્રોતો શોધો', searching: 'ચકાસેલા સ્ત્રોતો શોધાઈ રહ્યા છે…', sources: 'મળેલા સ્ત્રોતો',
    empty: 'કાનૂની જ્ઞાન આધાર શોધવા પ્રશ્ન પૂછો.', disclaimer: 'માત્ર માહિતી માટેની મદદ—કાનૂની સલાહ નથી. વર્તમાન કાયદો અને તમારા કેસમાં લાગુ પડતું હોવું નિષ્ણાત સાથે ચકાસો.',
    error: 'જવાબ મેળવી શકાયો નથી. ફરી પ્રયાસ કરો.', language: 'જવાબની ભાષા',
  },
  pa: {
    title: 'ਕਾਨੂੰਨੀ ਜਾਣਕਾਰੀ ਸਹਾਇਕ', subtitle: 'ਪ੍ਰਮਾਣਿਤ ਕਾਨੂੰਨੀ ਅਤੇ ਨਿਯਮਕ ਸਰੋਤਾਂ ਬਾਰੇ ਸਵਾਲ ਪੁੱਛੋ।',
    question: 'ਤੁਹਾਡਾ ਸਵਾਲ', placeholder: 'ਉਦਾਹਰਨ: ਬੈਂਕ ਵੱਲੋਂ ਸ਼ਿਕਾਇਤ ਰੱਦ ਕਰਨ ਤੋਂ ਬਾਅਦ RBI ਦੀ ਪ੍ਰਕਿਰਿਆ ਕੀ ਹੈ?',
    ask: 'ਕਾਨੂੰਨੀ ਸਰੋਤ ਖੋਜੋ', searching: 'ਪ੍ਰਮਾਣਿਤ ਸਰੋਤ ਖੋਜੇ ਜਾ ਰਹੇ ਹਨ…', sources: 'ਮਿਲੇ ਸਰੋਤ',
    empty: 'ਕਾਨੂੰਨੀ ਗਿਆਨ ਅਧਾਰ ਖੋਜਣ ਲਈ ਸਵਾਲ ਪੁੱਛੋ।', disclaimer: 'ਸਿਰਫ਼ ਜਾਣਕਾਰੀ ਲਈ ਮਦਦ—ਕਾਨੂੰਨੀ ਸਲਾਹ ਨਹੀਂ। ਮੌਜੂਦਾ ਕਾਨੂੰਨ ਅਤੇ ਤੁਹਾਡੇ ਕੇਸ ਉੱਤੇ ਲਾਗੂ ਹੋਣ ਦੀ ਪੁਸ਼ਟੀ ਮਾਹਰ ਤੋਂ ਕਰੋ।',
    error: 'ਜਵਾਬ ਪ੍ਰਾਪਤ ਨਹੀਂ ਹੋਇਆ। ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', language: 'ਜਵਾਬ ਦੀ ਭਾਸ਼ਾ',
  },
  or: {
    title: 'ଆଇନ ସୂଚନା ସହାୟକ', subtitle: 'ଯାଞ୍ଚିତ ଆଇନ ଓ ନିୟାମକ ଉତ୍ସ ବିଷୟରେ ପଚାରନ୍ତୁ।',
    question: 'ଆପଣଙ୍କ ପ୍ରଶ୍ନ', placeholder: 'ଉଦାହରଣ: ବ୍ୟାଙ୍କ ଅଭିଯୋଗ ଖାରଜ କଲେ RBI ପ୍ରକ୍ରିୟା କଣ?',
    ask: 'ଆଇନ ଉତ୍ସ ଖୋଜନ୍ତୁ', searching: 'ଯାଞ୍ଚିତ ଉତ୍ସ ଖୋଜାଯାଉଛି…', sources: 'ମିଳିଥିବା ଉତ୍ସ',
    empty: 'ଆଇନ ଜ୍ଞାନ ଭଣ୍ଡାର ଖୋଜିବାକୁ ପ୍ରଶ୍ନ କରନ୍ତୁ।', disclaimer: 'କେବଳ ସୂଚନାମୂଳକ ସହାୟତା—ଆଇନ ପରାମର୍ଶ ନୁହେଁ। ବର୍ତ୍ତମାନର ଆଇନ ଓ ଆପଣଙ୍କ ମାମଲାରେ ପ୍ରୟୋଗ ବିଶେଷଜ୍ଞଙ୍କ ସହ ଯାଞ୍ଚ କରନ୍ତୁ।',
    error: 'ଉତ୍ତର ମିଳିଲା ନାହିଁ। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।', language: 'ଉତ୍ତରର ଭାଷା',
  },
  ur: {
    title: 'قانونی معلومات کا معاون', subtitle: 'تصدیق شدہ قانونی اور ضابطہ جاتی ذرائع کے بارے میں سوال کریں۔',
    question: 'آپ کا سوال', placeholder: 'مثال: بینک کی جانب سے شکایت مسترد کرنے کے بعد RBI کا طریقہ کیا ہے؟',
    ask: 'قانونی ذرائع تلاش کریں', searching: 'تصدیق شدہ ذرائع تلاش کیے جا رہے ہیں…', sources: 'حاصل شدہ ذرائع',
    empty: 'قانونی معلومات تلاش کرنے کے لیے سوال پوچھیں۔', disclaimer: 'صرف معلوماتی مدد—قانونی مشورہ نہیں۔ موجودہ قانون اور آپ کے معاملے پر اطلاق کسی مستند ماہر سے تصدیق کریں۔',
    error: 'جواب حاصل نہیں ہو سکا۔ دوبارہ کوشش کریں۔', language: 'جواب کی زبان',
  },
};

export function getLegalRagCopy(language: LanguageCode): Copy {
  return LEGAL_RAG_COPY[language] || LEGAL_RAG_COPY.en;
}
