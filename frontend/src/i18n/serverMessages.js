import i18n from './index';

// Nepali translations for backend-generated messages. The API always
// returns an English `message` (unchanged, so it stays test-stable) plus a
// stable `code` and, for messages with numbers/names/lists baked in, an
// `extra` object with the raw values. Each entry here is a function so a
// dynamic message can be rebuilt in Nepali from those same values.
//
// Any code not listed here simply falls back to the English `message` —
// safe by construction, never a crash or a blank alert.

// A status enum's Nepali word, reusing the same translations shown
// everywhere else in the app (StatusBadge etc.), so a server message and a
// status pill never disagree. Falls back to the raw English enum value if a
// status hasn't been added there.
const statusWord = (status) => i18n.t(`common:status.${status}`, status);

// A KYC identity-document type's Nepali name (citizenship_front, nid_back...).
const kycDocWord = (type) => i18n.t(`kyc:documents.${type}`, type);

// A truck paper type's Nepali name (bluebook, truck_photo, insurance).
const truckDocWord = (type) => i18n.t(`trucks:documents.${type}`, type);

const joinNe = (items) => items.join(', ');

const SERVER_MESSAGES_NE = {
  // ── Auth ──────────────────────────────────────────────────────────────
  AUTH_EMAIL_IN_USE: () => 'यो इमेलको खाता पहिले नै छ, कृपया लग इन गर्नुहोस्',
  AUTH_PHONE_IN_USE: () => 'त्यो फोन नम्बर पहिले नै अर्को खातासँग जोडिएको छ',
  AUTH_DUPLICATE_FIELD: ({ field }) => `त्यो ${field} पहिले नै प्रयोगमा छ`,
  AUTH_ADMIN_DENIED: () => 'एडमिन पहुँच अस्वीकृत',
  AUTH_INVALID_CREDENTIALS: () => 'इमेल वा पासवर्ड मिलेन',
  AUTH_ACCOUNT_STATUS: ({ status }) => `खाता ${statusWord(status)} अवस्थामा छ`,
  AUTH_GOOGLE_NOT_CONFIGURED: () => 'गुगल साइन-इन अझै सेटअप गरिएको छैन',
  ROLE_REQUIRED: () => 'यो गुगल खाताको लागि अझै कुनै FLITO खाता छैन। साइन अप गर्न भूमिका छान्नुहोस्।',
  AUTH_GOOGLE_SERVICE_NOT_CONFIGURED: () => 'यस सर्भरमा गुगल साइन-इन अझै सेटअप गरिएको छैन',
  AUTH_GOOGLE_TOKEN_INVALID: () => 'गुगल साइन-इन प्रमाणित हुन सकेन, फेरि प्रयास गर्नुहोस्',
  AUTH_GOOGLE_NO_EMAIL: () => 'गुगलले यो खाताको लागि इमेल ठेगाना दिएन',
  AUTH_GOOGLE_EMAIL_IN_USE: () => 'त्यो इमेल पहिले नै अर्को खातामा प्रयोग भइरहेको छ',
  AUTH_CODE_INVALID: () => 'त्यो कोड अमान्य छ वा म्याद सकिएको छ',
  AUTH_CODE_TOO_MANY_ATTEMPTS: () => 'धेरै पटक गलत कोड। नयाँ कोड माग्नुहोस् र फेरि प्रयास गर्नुहोस्।',
  AUTH_CODE_RESEND_COOLDOWN: ({ retryAfterSeconds }) => `अर्को कोड माग्नुअघि ${retryAfterSeconds} सेकेन्ड पर्खनुहोस्`,
  AUTH_EMAIL_SEND_FAILED: () => 'हामी अहिले इमेल पठाउन सकेनौं। केही बेरमा फेरि प्रयास गर्नुहोस्।',
  AUTH_USER_NOT_FOUND: () => 'प्रयोगकर्ता फेला परेन',
  AUTH_NO_EMAIL: () => 'पहिले इमेल ठेगाना थप्नुहोस्',
  AUTH_RESET_CODE_SENT_GENERIC: () => 'यदि त्यो इमेलको खाता छ भने, हामीले रिसेट कोड पठाएका छौं',
  AUTH_RATE_LIMITED: () => 'धेरै पटक प्रयास भयो, कृपया पछि फेरि प्रयास गर्नुहोस्',
  AUTH_NO_TOKEN: () => 'कुनै टोकन दिइएको छैन',
  AUTH_INVALID_TOKEN: () => 'टोकन अमान्य छ वा म्याद सकिएको छ',
  AUTH_INSUFFICIENT_ROLE: () => 'अनुमति छैन: भूमिका अपुरो',

  // ── Validation (shared across signup/loads/quotes/profile/trucks) ─────
  VALIDATION_INVALID_EMAIL: () => 'मान्य इमेल ठेगाना हाल्नुहोस्',
  VALIDATION_WEAK_PASSWORD: () => 'पासवर्ड कम्तीमा ८ अक्षरको हुनुपर्छ र एउटा अक्षर र अंक समावेश हुनुपर्छ',
  VALIDATION_INVALID_ROLE: () => 'भूमिका शिपर, ट्रक मालिक, वा चालक मध्ये एक हुनुपर्छ',
  VALIDATION_FIRST_NAME_REQUIRED: () => 'पहिलो नाम आवश्यक छ',
  VALIDATION_INVALID_PHONE: () => 'फोन नम्बर मान्य +977 नम्बर हुनुपर्छ, वा खाली छोड्नुहोस्',
  VALIDATION_LOGIN_REQUIRED: () => 'इमेल र पासवर्ड आवश्यक छ',
  VALIDATION_GOOGLE_TOKEN_REQUIRED: () => 'गुगल idToken आवश्यक छ',
  VALIDATION_CODE_REQUIRED: () => 'इमेल र कोड आवश्यक छ',
  VALIDATION_LOAD_GOODS_TYPE: () => 'सामानको प्रकार आवश्यक छ (बढीमा १०० अक्षर)',
  VALIDATION_LOAD_WEIGHT: ({ max }) => `तौल आवश्यक छ, केजीमा, बढीमा ${Number(max).toLocaleString('en-IN')} सम्म`,
  VALIDATION_PICKUP_DATE: ({ maxDaysAhead }) => `उठान मिति आजदेखि ${maxDaysAhead} दिनसम्मको हुनुपर्छ (YYYY-MM-DD)`,
  VALIDATION_STOP_ADDRESS: ({ stop, detail }) => `${stop}: ${detail}`,
  VALIDATION_CONTACT_NAME: ({ stop, max }) => `${stop}: सम्पर्क नाम बढीमा ${max} अक्षरको हुनुपर्छ`,
  VALIDATION_CONTACT_PHONE: ({ stop }) => `${stop}: सम्पर्क फोन मान्य +977 नम्बर हुनुपर्छ, वा खाली छोड्नुहोस्`,
  VALIDATION_LOAD_ID_REQUIRED: () => 'loadId आवश्यक छ',
  VALIDATION_PRICE: ({ field, min, max }) => `${field} रु. ${Number(min).toLocaleString('en-IN')} देखि रु. ${Number(max).toLocaleString('en-IN')} सम्मको पूर्णाङ्क हुनुपर्छ`,
  VALIDATION_QUOTE_TRUCK_REQUIRED: () => 'truckId आवश्यक छ: यो लोड कुन ट्रकले बोक्ने छान्नुहोस्',
  VALIDATION_TRUCK_ID_REQUIRED: () => 'truckId आवश्यक छ',
  VALIDATION_TRUCK_FIELD: ({ detail }) => `ट्रकको विवरण जाँच गर्नुहोस्: ${detail}`,
  VALIDATION_RATING: () => 'रेटिङ १ देखि ५ सम्मको पूर्णाङ्क हुनुपर्छ',
  VALIDATION_REVIEW_LENGTH: ({ max }) => `समीक्षा बढीमा ${max} अक्षरको हुनुपर्छ`,
  VALIDATION_FIELD_TEXT_TYPE: ({ field }) => `${field} अक्षर (टेक्स्ट) हुनुपर्छ`,
  VALIDATION_ADDRESS: ({ detail }) => detail,
  VALIDATION_FIRST_NAME_LENGTH: () => 'पहिलो नाम १ देखि ५० अक्षरको हुनुपर्छ',
  VALIDATION_LAST_NAME_LENGTH: ({ max }) => `थर बढीमा ${max} अक्षरको हुनुपर्छ`,
  VALIDATION_COMPANY_NAME_LENGTH: ({ max }) => `कम्पनीको नाम बढीमा ${max} अक्षरको हुनुपर्छ`,
  VALIDATION_COORDINATES: () => 'lat -90 देखि 90 र lng -180 देखि 180 को बीचमा हुनुपर्छ',
  VALIDATION_PUSH_TOKEN: () => 'pushToken मान्य Expo पुश टोकन हुनुपर्छ',

  // ── Loads ───────────────────────────────────────────────────────────────
  LOADS_NOT_FOUND: () => 'लोड फेला परेन',
  LOADS_NOT_OWNER: () => 'यो तपाईंको लोड होइन',
  LOADS_CANCEL_NOT_ALLOWED: ({ status }) => `${statusWord(status)} अवस्थाको लोड रद्द गर्न सकिँदैन`,
  LOADS_RELIST_NOT_EXPIRED: ({ status }) => `म्याद सकिएको लोड मात्र फेरि पोस्ट गर्न सकिन्छ (यो हाल ${statusWord(status)} छ)`,
  LOADS_UPLOADS_NOT_CONFIGURED: () => 'यस सर्भरमा फाइल अपलोड सेटअप गरिएको छैन',
  LOADS_PHOTOS_LOCKED: ({ status }) => `लोड ${statusWord(status)} भइसकेपछि फोटोहरू परिवर्तन गर्न सकिँदैन`,
  LOADS_PHOTOS_REQUIRED: () => 'कम्तीमा एउटा फोटो थप्नुहोस्',
  LOADS_MAX_PHOTOS: ({ max, count }) => `एउटा लोडमा बढीमा ${max} फोटो राख्न सकिन्छ (हाल ${count} छन्)`,
  LOADS_PHOTOS_UPLOAD_CONFLICT: () => 'अपलोड गर्दागर्दै यो लोड परिवर्तन भयो। पुनः लोड गरेर फेरि प्रयास गर्नुहोस्।',
  LOADS_PHOTO_NOT_FOUND: () => 'फोटो फेला परेन',
  LOADS_PHOTO_DELETE_CONFLICT: () => 'यो लोड बीचमै बुक भइसकेकोले यसका फोटोहरू लक भएका छन्',

  // ── Quotes / offers / negotiation ──────────────────────────────────────
  QUOTES_LOAD_NOT_ACCEPTING_OFFERS: ({ status }) => `लोड ${statusWord(status)} अवस्थामा छ, अब प्रस्तावहरू स्वीकार गर्दैन`,
  QUOTES_LOAD_EXPIRED: () => 'यो लोडको म्याद सकिएकोले अब प्रस्तावहरू स्वीकार गर्दैन',
  QUOTES_LOAD_NOT_FOUND: () => 'लोड फेला परेन',
  QUOTES_TRUCK_NOT_IN_FLEET: () => 'त्यो ट्रक तपाईंको फ्लिटमा छैन',
  QUOTES_TRUCK_UNAVAILABLE: ({ detail }) => detail,
  QUOTES_ACTIVE_OFFER_EXISTS: () => 'यो लोडमा तपाईंको पहिले नै एउटा सक्रिय प्रस्ताव छ',
  QUOTES_NOT_YOUR_LOAD: () => 'यो तपाईंको लोड होइन',
  QUOTES_TRUCK_NOT_FOUND: () => 'ट्रक फेला परेन',
  QUOTES_OWNER_UNAVAILABLE: () => 'यो ट्रकको मालिकले अहिले बुकिङ लिन सक्नुहुन्न',
  QUOTES_OPEN_OFFER_WITH_OWNER: ({ ownerName }) => `यो लोडमा ${ownerName}सँग तपाईंको पहिले नै खुला प्रस्ताव छ। त्यसैलाई जवाफ दिनुहोस्।`,
  QUOTES_TOO_MANY_OPEN_REQUESTS: ({ max }) => `एकैचोटि बढीमा ${max} अनुरोध पर्खाइमा राख्न सकिन्छ। जवाफको पर्खनुहोस्, वा एउटा फिर्ता लिनुहोस्।`,
  QUOTES_QUOTE_NOT_FOUND: () => 'प्रस्ताव फेला परेन',
  QUOTES_NOT_PART_OF_NEGOTIATION: () => 'तपाईं यो मोलमोलाइको सहभागी होइन',
  QUOTES_ALREADY_DECIDED: ({ status }) => `प्रस्ताव पहिले नै ${statusWord(status)} भइसक्यो`,
  QUOTES_LOAD_STATUS_BLOCKS_RESPONSE: ({ status }) => `यो लोड ${statusWord(status)} अवस्थामा छ`,
  QUOTES_OFFER_EXPIRED: () => 'यो प्रस्तावको म्याद सकियो',
  QUOTES_WAITING_ON_OTHER_PARTY: () => 'तपाईंको प्रस्तावमा अर्को पक्षको जवाफको पर्खाइमा',
  QUOTES_COUNTER_PROBLEM: ({ detail }) => detail,
  QUOTES_CHANGED_UNDERNEATH: () => 'यो प्रस्ताव भर्खरै परिवर्तन भयो। पुनः लोड गरेर फेरि प्रयास गर्नुहोस्।',
  QUOTES_TRUCK_NOT_AVAILABLE_ON_DATE: () => 'उठान मितिमा त्यो ट्रक अब उपलब्ध छैन',
  QUOTES_LOAD_ALREADY_BOOKED: () => 'यो लोड पहिले नै बुक भइसकेको छ',

  // ── Bookings ────────────────────────────────────────────────────────────
  BOOKINGS_NOT_FOUND: () => 'बुकिङ फेला परेन',
  BOOKINGS_NOT_PARTY: () => 'तपाईं यो बुकिङको सहभागी होइन',
  BOOKINGS_ASSIGN_DRIVER_OWNER_ONLY: () => 'मालिकले मात्र चालक तोक्न सक्नुहुन्छ',
  BOOKINGS_INVALID_STATUS_FOR_ASSIGNMENT: ({ status }) => `${statusWord(status)} अवस्थाको बुकिङमा चालक तोक्न सकिँदैन`,
  BOOKINGS_DRIVER_NOT_FOUND: () => 'चालक फेला परेन',
  BOOKINGS_DRIVER_ACCOUNT_STATUS: ({ name, status }) => `${name}को खाता ${statusWord(status)} अवस्थामा छ`,
  DRIVER_NOT_VERIFIED: ({ name }) => `${name}ले पहिचान प्रमाणीकरण पूरा गर्नुभएको छैन, त्यसैले उहाँलाई बुकिङमा तोक्न मिल्दैन`,
  BOOKINGS_PICKUP_DROPOFF_DRIVER_ONLY: () => 'तोकिएको चालकले मात्र उठान वा डेलिभरीको प्रगति रिपोर्ट गर्न सक्नुहुन्छ',
  BOOKINGS_DRIVER_CANNOT_CANCEL: () => 'चालकले बुकिङ रद्द गर्न सक्नुहुन्न',
  BOOKINGS_CANNOT_CANCEL_STATUS: ({ status }) => `${statusWord(status)} अवस्थाको बुकिङ रद्द गर्न सकिँदैन`,
  BOOKINGS_ADVANCE_STATUS_DRIVER_ONLY: () => 'तोकिएको चालकले मात्र डेलिभरी अवस्था अगाडि बढाउन सक्नुहुन्छ',
  BOOKINGS_CONFIRM_OWNER_ONLY: () => 'मालिकले मात्र बुकिङ पुष्टि गर्न सक्नुहुन्छ',
  BOOKINGS_UNSUPPORTED_STATUS_TRANSITION: ({ status }) => `असमर्थित अवस्था परिवर्तन: ${status}`,
  BOOKINGS_ALREADY_STATUS: ({ status }) => `बुकिङ पहिले नै ${statusWord(status)} भइसक्यो`,
  BOOKINGS_LOCATION_DRIVER_ONLY: () => 'तोकिएको चालकले मात्र लोकेसन अपडेट गर्न सक्नुहुन्छ',
  BOOKINGS_LOCATION_NOT_IN_TRANSIT: ({ status }) => `बुकिङ ढुवानीमा हुँदा मात्र लोकेसन सेयर गर्न सकिन्छ (यो हाल ${statusWord(status)} छ)`,
  BOOKINGS_RATE_PARTY_ONLY: () => 'शिपर वा मालिकले मात्र यो बुकिङलाई रेट गर्न सक्नुहुन्छ',
  BOOKINGS_RATE_NOT_COMPLETED: () => 'सम्पन्न भएको बुकिङलाई मात्र रेट गर्न सकिन्छ',
  BOOKINGS_ALREADY_RATED: () => 'तपाईंले यो बुकिङलाई पहिले नै रेट गरिसक्नुभयो',

  // ── Trucks ──────────────────────────────────────────────────────────────
  TRUCKS_DUPLICATE_REGISTRATION: () => 'त्यो दर्ता नम्बरको ट्रक तपाईंसँग पहिले नै छ',
  TRUCKS_NOT_FOUND: () => 'ट्रक फेला परेन',
  TRUCKS_FORBIDDEN: () => 'यो तपाईंको ट्रक होइन',
  TRUCKS_DRIVER_NOT_FOUND: () => 'त्यो फोन नम्बरको चालक फेला परेन',
  TRUCKS_UPLOADS_NOT_CONFIGURED: () => 'यस सर्भरमा फाइल अपलोड सेटअप गरिएको छैन',
  TRUCKS_VERIFICATION_LOCKED: ({ status }) => `यो ट्रकको प्रमाणीकरण ${statusWord(status)} हुँदा कागजातहरू परिवर्तन गर्न सकिँदैन`,
  TRUCKS_INVALID_DOCUMENT_TYPE: ({ types }) => `टाइप यीमध्ये एक हुनुपर्छ: ${joinNe((types || []).map(truckDocWord))}`,
  TRUCKS_DOCUMENT_FILE_REQUIRED: () => 'कागजातको फोटो वा PDF थप्नुहोस्',
  TRUCKS_PAPERS_LOCKED: () => 'यो ट्रक बीचमै प्रमाणीकरणको लागि पेश भइसकेकोले यसका कागजातहरू परिवर्तन गर्न सकिँदैन',
  TRUCKS_DOCUMENT_NOT_FOUND: () => 'कागजात फेला परेन',
  TRUCKS_VERIFICATION_ALREADY_SUBMITTED: ({ status }) => `यो ट्रकको प्रमाणीकरण पहिले नै ${statusWord(status)} छ`,
  TRUCKS_MISSING_DOCUMENTS: ({ documents }) => `पहिले यी कागजातहरू अपलोड गर्नुहोस्: ${joinNe((documents || []).map(truckDocWord))}`,
  TRUCKS_PAPERS_CHANGED: () => 'पेश गर्दागर्दै यो ट्रकका कागजातहरू परिवर्तन भए। पुनः लोड गरेर फेरि प्रयास गर्नुहोस्।',

  // ── Delivery proof ──────────────────────────────────────────────────────
  DELIVERY_UPLOADS_NOT_CONFIGURED: () => 'यस सर्भरमा फाइल अपलोड सेटअप गरिएको छैन',
  DELIVERY_BOOKING_NOT_FOUND: () => 'बुकिङ फेला परेन',
  DELIVERY_FORBIDDEN: () => 'तोकिएको चालकले मात्र डेलिभरी प्रमाण थप्न सक्नुहुन्छ',
  DELIVERY_NOT_READY: () => 'सामान उठाइसकेपछि मात्र डेलिभरी प्रमाण थप्न सकिन्छ',
  DELIVERY_PHOTO_REQUIRED: () => 'कम्तीमा एउटा फोटो थप्नुहोस्',
  DELIVERY_MAX_PHOTOS: ({ max, count }) => `एउटा बुकिङमा बढीमा ${max} डेलिभरी फोटो राख्न सकिन्छ (हाल ${count} छन्)`,
  DELIVERY_BOOKING_CHANGED: () => 'अपलोड गर्दागर्दै यो बुकिङ परिवर्तन भयो। पुनः लोड गरेर फेरि प्रयास गर्नुहोस्।',
  DELIVERY_SIGNATURE_FILE_REQUIRED: () => 'हस्ताक्षरको फोटो थप्नुहोस्',

  // ── Users / KYC ─────────────────────────────────────────────────────────
  USERS_PHONE_QUERY_REQUIRED: () => 'phone प्यारामिटर आवश्यक छ',
  USERS_DRIVER_NOT_FOUND: () => 'त्यो फोन नम्बरको चालक फेला परेन',
  USERS_NOT_FOUND: () => 'प्रयोगकर्ता फेला परेन',
  USERS_NAME_LOCKED: () => 'तपाईंको नाम KYC कागजातसँग जाँचिन्छ, त्यसैले ती समीक्षामा वा स्वीकृत हुँदा परिवर्तन गर्न मिल्दैन',
  USERS_COMPANY_NAME_NOT_ALLOWED: () => 'ट्रक मालिकहरूको मात्र कम्पनीको नाम हुन्छ',
  USERS_EMAIL_REQUIRED_FOR_LOGIN: () => 'तपाईं यही इमेलबाट लग इन गर्नुहुन्छ, त्यसैले यसलाई हटाउन मिल्दैन। परिवर्तन गर्न चाहनुहुन्छ भने पहिले फोन नम्बर थप्नुहोस्।',
  USERS_FIELD_IN_USE: ({ field }) => `त्यो ${field} पहिले नै प्रयोगमा छ`,
  USERS_STORAGE_NOT_CONFIGURED: () => 'यस सर्भरमा फाइल अपलोड सेटअप गरिएको छैन',
  USERS_AVATAR_FILE_REQUIRED: () => 'आफ्नो प्रोफाइल फोटोको लागि तस्बिर थप्नुहोस्',
  USERS_KYC_NOT_EDITABLE: ({ status }) => `तपाईंको प्रमाणीकरण ${statusWord(status)} हुँदा कागजातहरू परिवर्तन गर्न सकिँदैन`,
  USERS_INVALID_DOCUMENT_TYPE: ({ allowedTypes }) => `टाइप यीमध्ये एक हुनुपर्छ: ${joinNe((allowedTypes || []).map(kycDocWord))}`,
  USERS_DOCUMENT_FILE_REQUIRED: () => 'कागजातको फाइल थप्नुहोस्',
  USERS_KYC_LOCKED: () => 'तपाईंका कागजातहरू बीचमै पेश भइसकेकोले अब परिवर्तन गर्न सकिँदैन',
  USERS_DOCUMENT_NOT_FOUND: () => 'कागजात फेला परेन',
  USERS_KYC_ALREADY_SUBMITTED: ({ status }) => `तपाईंको प्रमाणीकरण पहिले नै ${statusWord(status)} छ`,
  ADDRESS_REQUIRED: () => 'प्रमाणीकरणको लागि पेश गर्नुअघि आफ्नो ठेगाना थप्नुहोस्',
  USERS_MISSING_KYC_DOCUMENTS: ({ documents }) => `पहिले यी कागजातहरू अपलोड गर्नुहोस्: ${joinNe((documents || []).map(kycDocWord))}`,
  USERS_KYC_SUBMIT_CONFLICT: () => 'पेश गर्दागर्दै तपाईंका कागजातहरू परिवर्तन भए। पुनः लोड गरेर फेरि प्रयास गर्नुहोस्।',

  // ── Admin ───────────────────────────────────────────────────────────────
  ADMIN_INVALID_DECISION: () => 'निर्णय स्वीकृत वा अस्वीकृत मध्ये एक हुनुपर्छ',
  ADMIN_REJECTION_REASON_TOO_SHORT: ({ who, minLength }) => `${who}लाई अस्वीकृतिको कारण दिनुहोस् (कम्तीमा ${minLength} अक्षर) ताकि उनीहरूले के सुधार्ने थाहा पाऊन्`,
  ADMIN_REJECTION_REASON_TOO_LONG: ({ maxLength }) => `कारण बढीमा ${maxLength} अक्षरको हुनुपर्छ`,
  ADMIN_KYC_NOT_PENDING: () => 'यो प्रयोगकर्ताको समीक्षामा कुनै प्रमाणीकरण छैन',
  ADMIN_USER_NOT_FOUND: () => 'प्रयोगकर्ता फेला परेन',
  ADMIN_TRUCK_NOT_PENDING: () => 'यो ट्रकको समीक्षामा कुनै प्रमाणीकरण छैन',
  ADMIN_TRUCK_NOT_FOUND: () => 'ट्रक फेला परेन',
  ADMIN_INVALID_STATUS: () => 'अमान्य अवस्था',
  ADMIN_CANNOT_CHANGE_OWN_STATUS: () => 'तपाईं आफ्नै खाताको अवस्था परिवर्तन गर्न सक्नुहुन्न',

  // ── Locations ───────────────────────────────────────────────────────────
  LOCATIONS_TOO_MANY_LOOKUPS: () => 'धेरै पटक लोकेसन खोजी भयो। केही मिनेटमा फेरि प्रयास गर्नुहोस्।',
  LOCATIONS_INVALID_COORDINATES: () => 'lat -90 देखि 90 र lng -180 देखि 180 को बीचमा हुनुपर्छ',

  // ── Email verification codes ────────────────────────────────────────────
  VERIFICATION_RESEND_COOLDOWN: ({ retryAfterSeconds }) => `अर्को कोड माग्नुअघि ${retryAfterSeconds} सेकेन्ड पर्खनुहोस्`,
  VERIFICATION_EMAIL_SEND_FAILED: () => 'हामी अहिले इमेल पठाउन सकेनौं। केही बेरमा फेरि प्रयास गर्नुहोस्।',

  // ── Uploads / generic errors ────────────────────────────────────────────
  UPLOAD_DOCUMENT_TOO_LARGE: () => 'कागजात बढीमा 10 MB को हुनुपर्छ',
  UPLOAD_SIGNATURE_TOO_LARGE: () => 'हस्ताक्षरको फोटो बढीमा 1 MB को हुनुपर्छ',
  UPLOAD_PHOTO_TOO_LARGE: () => 'हरेक फोटो बढीमा 5 MB को हुनुपर्छ',
  UPLOAD_ONE_AT_A_TIME: () => 'एकपटकमा एउटा मात्र फाइल पठाउनुहोस्',
  UPLOAD_TOO_MANY_FILES: () => 'एकैचोटि धेरै फाइल अपलोड भयो',
  UPLOAD_UNEXPECTED_FIELD: () => 'एकैचोटि धेरै फोटो अपलोड भयो, वा फाइल गलत फिल्डमा पठाइयो',
  INVALID_ID: ({ field }) => `अमान्य ${field}`,
  DUPLICATE_VALUE: () => 'यो मान पहिले नै प्रयोगमा छ',
  CORS_NOT_ALLOWED: () => 'CORS द्वारा अनुमति छैन',
  INTERNAL_SERVER_ERROR: () => 'सर्भरमा समस्या भयो',
};

export const translateServerMessage = (code, extra) => {
  const entry = SERVER_MESSAGES_NE[code];
  if (!entry) return null;
  try {
    return entry(extra || {});
  } catch (error) {
    return null;
  }
};

export default SERVER_MESSAGES_NE;
