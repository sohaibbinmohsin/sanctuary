export type ReportLanguage = 'en' | 'ur'

export const EMERGENCY_QUICK_COMPLAINTS_EN = [
  'Hit by vehicle',
  'Severe bleeding',
  'Fractured limb',
  'Unable to stand',
  'Sick or malnourished',
  'Trapped in drain or sewer',
] as const

export const EMERGENCY_QUICK_COMPLAINTS_UR = [
  'گاڑی کی ٹکر',
  'شدید خون بہہ رہا ہے',
  'ٹوٹی ہوئی ہڈی',
  'کھڑا ہونے سے قاصر',
  'بیمار یا شدید کمزور',
  'نالے یا گڑھے میں پھنسا ہوا',
] as const

export const CRUELTY_QUICK_COMPLAINTS_EN = [
  'Physical abuse or beating',
  'Chained without food or water',
  'Severe starvation or neglect',
  'Abandoned in distress',
  'Dog fighting or baiting',
  'Acid attack or burns',
  'Illegal breeding or hoarding',
  'Poisoning',
] as const

export const CRUELTY_QUICK_COMPLAINTS_UR = [
  'مار پیٹ اور تشدد',
  'بھوکا پیاسا باندھا ہوا',
  'شدید بھوک اور لاپرواہی',
  'بے یار و مددگار چھوڑ دیا',
  'کتوں کی لڑائی',
  'تیزاب یا جلایا گیا',
  'غیر قانونی قید یا افزائش',
  'زہر خوری',
] as const

export interface PipelineStageTranslation {
  key: string
  labelEn: string
  labelUr: string
  timeKey: string
}

export const EMERGENCY_PIPELINE_STAGES: readonly PipelineStageTranslation[] = [
  { key: 'logged', labelEn: 'Logged', labelUr: 'درج شدہ', timeKey: 'stage_logged_at' },
  { key: 'accepted', labelEn: 'Accepted', labelUr: 'منظور شدہ', timeKey: 'stage_accepted_at' },
  { key: 'dispatched', labelEn: 'Dispatched', labelUr: 'ٹیم روانہ', timeKey: 'stage_dispatched_at' },
  { key: 'attended', labelEn: 'Attended', labelUr: 'مقام پر آمد', timeKey: 'stage_attended_at' },
  { key: 'resolved', labelEn: 'Resolved', labelUr: 'حل شدہ', timeKey: 'stage_resolved_at' },
] as const

export const CRUELTY_PIPELINE_STAGES: readonly PipelineStageTranslation[] = [
  { key: 'logged', labelEn: 'Complaint Logged', labelUr: 'شکایت درج', timeKey: 'stage_logged_at' },
  { key: 'accepted', labelEn: 'Investigation', labelUr: 'تحقیقات جاری', timeKey: 'stage_accepted_at' },
  { key: 'dispatched', labelEn: 'Notice / Legal Action', labelUr: 'قانونی کارروائی', timeKey: 'stage_dispatched_at' },
  { key: 'attended', labelEn: 'In Custody', labelUr: 'حفاظتی تحویل', timeKey: 'stage_attended_at' },
  { key: 'resolved', labelEn: 'Resolved', labelUr: 'حل شدہ', timeKey: 'stage_resolved_at' },
] as const

export interface ReportTranslations {
  // Common
  sanctuary: string
  switchLangText: string
  liveCaseTracker: string
  rescueReport: string
  caseNumberLabel: string
  back: string
  copied: string
  copyTrackingLink: string
  reportAnotherCase: string
  reportEmergency: string
  privacyProtected: string

  // Report Modal / Steps
  modalTitle: string
  modalSubtitle: string
  stepAnimal: string
  stepLocation: string
  stepContact: string
  stepPhotosLocation: string
  stepContactSubmit: string
  situationNoteOptional: string
  situationNotePlaceholder: string
  gpsExtractedFromPhoto: string
  reportCategoryLabel: string
  categorySickInjured: string
  categoryCruelty: string
  categoryDogBite: string
  categoryMissingPet: string
  locationChooseHeading: string
  useCurrentLocationBtn: string
  useCurrentLocationSubtext: string
  enterLocationManuallyBtn: string
  enterLocationManuallySubtext: string
  locationConfirmed: string
  changeLocation: string
  medicalEmergency: string
  animalCruelty: string
  howManyAnimals: string
  singleAnimal: string
  multipleAnimals: string
  litter: string
  numberOfAnimals: string
  species: string
  speciesDog: string
  speciesCat: string
  speciesHorse: string
  speciesDonkey: string
  speciesBird: string
  speciesOther: string
  lifeStage: string
  puppyKitten: string
  adult: string
  senior: string
  avianSpecies: string
  specifyAnimal: string
  injuryDescriptionLabel: string
  crueltyDescriptionLabel: string
  injuryPlaceholder: string
  crueltyPlaceholder: string
  nextLocation: string
  nextContact: string

  // Step 2 Location
  cityLabel: string
  areaLabel: string
  areaPlaceholder: string
  landmarkLabel: string
  landmarkPlaceholder: string
  gpsHeading: string
  gpsHint: string
  gpsCaptured: string
  captureGpsBtn: string
  photosHeading: string
  uploadPhoto: string
  takePhoto: string

  // Step 3 Contact
  phoneLabel: string
  phonePlaceholder: string
  fullNameLabel: string
  fullNamePlaceholder: string
  cnicLabel: string
  cnicPlaceholder: string
  saveProfileToggle: string
  reviewSummaryHeading: string
  summaryCategory: string
  summaryAnimals: string
  summaryLocation: string
  summaryPhotos: string
  submitReportBtn: string
  submittingBtn: string

  // Track Screen
  chiefComplaint: string
  animalDetails: string
  rescueLocation: string
  casePhotos: string
  reporterDetails: string
  viewSubmittedDetails: string
  assignedRespondingUnit: string
  supportAndFollow: string
  caseNotFoundTitle: string
  caseNotFoundDesc: string

  // Tracking Field Labels & Fallbacks
  speciesLabel: string
  animalCountLabel: string
  lifeStageLabel: string
  reporterNameLabel: string
  landmarkNone: string
  notProvided: string
  anonymous: string
  notSpecified: string

  // Notice & Reality Check
  noticeFreshTitle: string
  noticeFreshBody: string
  noticeFreshCrueltyBody: string
  noticeQueuedTitle: string
  noticeQueuedBody: string
  noticeQueuedCrueltyBody: string
  noticeExtendedTitle: string
  noticeExtendedBody: string
  noticeExtendedCrueltyBody: string
  noticeActiveTitle: string
  noticeActiveBody: string
  noticeActiveCrueltyBody: string
  noticeResolvedTitle: string
  noticeResolvedBody: string
  noticeSubtextEmergency: string
  noticeSubtextCruelty: string
  advocacyTitle: string
  advocacyBody: string
}

export const TRANSLATIONS_EN: ReportTranslations = {
  sanctuary: 'Sanctuary',
  switchLangText: 'اردو',
  liveCaseTracker: 'Live Case Tracker',
  rescueReport: 'Rescue Report',
  caseNumberLabel: 'Case #',
  back: 'Back',
  copied: 'Copied!',
  copyTrackingLink: 'Copy tracking link',
  reportAnotherCase: 'Report another case',
  reportEmergency: 'Report an emergency',
  privacyProtected: 'Protected',

  modalTitle: 'Report an animal in distress',
  modalSubtitle: 'Submit details to dispatch responders across our animal welfare network.',
  stepAnimal: 'Animal',
  stepLocation: 'Location',
  stepContact: 'Contact',
  stepPhotosLocation: 'Photos & Location',
  stepContactSubmit: 'Contact & Submit',
  situationNoteOptional: 'What happened / Situation note (optional)',
  situationNotePlaceholder: 'Describe the injury, bleeding, or situation if needed (optional)',
  gpsExtractedFromPhoto: 'Location extracted from photo GPS',
  reportCategoryLabel: 'What kind of report is this?',
  categorySickInjured: 'Sick / Injured Animal',
  categoryCruelty: 'Animal Cruelty',
  categoryDogBite: 'Dog Bite Incident',
  categoryMissingPet: 'Missing Pet',
  locationChooseHeading: 'Where is the animal located?',
  useCurrentLocationBtn: 'Use current location',
  useCurrentLocationSubtext: '1-tap automatic location',
  enterLocationManuallyBtn: 'Enter location manually',
  enterLocationManuallySubtext: 'Select city and neighborhood',
  locationConfirmed: 'Location confirmed',
  changeLocation: 'Change or enter manually',
  medicalEmergency: 'Medical emergency',
  animalCruelty: 'Animal cruelty',
  howManyAnimals: 'Animal count and composition',
  singleAnimal: 'Single Animal',
  multipleAnimals: 'Multiple Animals',
  litter: 'Litter or Family',
  numberOfAnimals: 'Number of animals',
  species: 'Animal type',
  speciesDog: 'Dog',
  speciesCat: 'Cat',
  speciesHorse: 'Horse',
  speciesDonkey: 'Donkey',
  speciesBird: 'Bird',
  speciesOther: 'Other',
  lifeStage: 'Life stage',
  puppyKitten: 'Child / Baby',
  adult: 'Adult',
  senior: 'Senior',
  avianSpecies: 'Avian species',
  specifyAnimal: 'Specify animal',
  injuryDescriptionLabel: 'What happened / Injury description',
  crueltyDescriptionLabel: 'What happened / Cruelty description',
  injuryPlaceholder: 'Describe the injury, bleeding, behavior, or emergency situation',
  crueltyPlaceholder: 'Describe what abuse occurred, who was involved, and current condition...',
  nextLocation: 'Continue to Location',
  nextContact: 'Continue to Contact',

  cityLabel: 'City',
  areaLabel: 'Area or Neighborhood',
  areaPlaceholder: 'e.g. Gulberg III, DHA Phase 5, Saddar',
  landmarkLabel: 'Specific landmark or street (optional)',
  landmarkPlaceholder: 'e.g. Near Kalma Chowk underpass, opposite bakery',
  gpsHeading: 'Precise GPS coordinates',
  gpsHint: 'Helps field rescue teams navigate directly to the animal in rural or unmapped areas.',
  gpsCaptured: 'GPS captured',
  captureGpsBtn: 'Share exact GPS location',
  photosHeading: 'Photos of the animal or scene',
  uploadPhoto: 'Add photo',
  takePhoto: 'Take photo',

  phoneLabel: 'Mobile phone number',
  phonePlaceholder: '0300 1234567',
  fullNameLabel: 'Your name (optional)',
  fullNamePlaceholder: 'e.g. Usman Ali',
  cnicLabel: 'CNIC (optional)',
  cnicPlaceholder: '42101-1234567-1',
  saveProfileToggle: 'Remember my contact details on this device for future rescue reports',
  reviewSummaryHeading: 'Report Summary',
  summaryCategory: 'Category',
  summaryAnimals: 'Animals',
  summaryLocation: 'Location',
  summaryPhotos: 'Photos',
  submitReportBtn: 'Submit Emergency Report',
  submittingBtn: 'Submitting report...',

  chiefComplaint: 'Chief Complaint',
  animalDetails: 'Animal Details',
  rescueLocation: 'Rescue Location',
  casePhotos: 'Case Photos',
  reporterDetails: 'Reporter Details',
  viewSubmittedDetails: 'View submitted report details',
  assignedRespondingUnit: 'Assigned Responding Unit',
  supportAndFollow: 'Support and follow their work',
  caseNotFoundTitle: 'Case not found',
  caseNotFoundDesc: 'We could not find a rescue report matching this reference number. It may still be syncing or the tracking link could be incorrect.',

  speciesLabel: 'Species',
  animalCountLabel: 'Animal count',
  lifeStageLabel: 'Life stage',
  reporterNameLabel: 'Reporter name',
  landmarkNone: 'None',
  notProvided: 'Not provided',
  anonymous: 'Anonymous',
  notSpecified: 'Not specified',

  noticeFreshTitle: 'Thank you for reporting this case',
  noticeFreshBody: 'Your report is circulating across verified responders in the area. Field rescue teams prioritize severe, life-threatening traumas first.',
  noticeFreshCrueltyBody: 'Thank you for documenting this incident. Animal protection officers and volunteer legal observers review cruelty complaints based on evidence verification.',
  noticeQueuedTitle: 'Thank you for your continued patience',
  noticeQueuedBody: 'Your case remains active in the network dispatch queue. Responders operate under high daily case volumes and strict vehicle constraints. If you can safely offer the animal clean water, shade, or temporary containment nearby, that provides immediate relief while field teams mobilize.',
  noticeQueuedCrueltyBody: 'Your cruelty complaint is actively queued with regional anti-cruelty units. If you have additional video or photo evidence of perpetrators, keep it secure for investigating officers.',
  noticeExtendedTitle: 'Still awaiting an available rescue unit',
  noticeExtendedBody: 'All local partner shelters and ambulances are currently at peak operational capacity with critical inpatient cases. We recognize how difficult waiting can be.',
  noticeExtendedCrueltyBody: 'Regional rescue units and police animal wings are currently handling high priority legal complaints.',
  noticeActiveTitle: 'Responding team assigned and active',
  noticeActiveBody: 'A rescue vehicle has accepted this case and is moving into the field.',
  noticeActiveCrueltyBody: 'Anti-cruelty responders have taken this case and are preparing field intervention.',
  noticeResolvedTitle: 'Case completed and attended',
  noticeResolvedBody: 'This case has been attended by field responders and marked resolved in the network registry.',
  noticeSubtextEmergency: 'Response times depend on vehicle availability and trauma severity triage across the city.',
  noticeSubtextCruelty: 'Enforcement and custody actions depend on legal jurisdiction, witness statements, and police coordination.',
  advocacyTitle: 'Your report is already making a difference',
  advocacyBody: 'Every logged case is automatically catalogued for partner animal rights lawyers and policy advocates. This documented proof is used directly to lobby the government for strict animal cruelty penalties, municipal emergency fleets, and public rescue funding.',
}

export const TRANSLATIONS_UR: ReportTranslations = {
  sanctuary: 'سینکچوئری',
  switchLangText: 'English',
  liveCaseTracker: 'لائیو کیس ٹریکر',
  rescueReport: 'ریسکیو رپورٹ',
  caseNumberLabel: 'کیس نمبر #',
  back: 'پیچھے',
  copied: 'کاپی ہو گیا!',
  copyTrackingLink: 'ٹریکنگ لنک کاپی کریں',
  reportAnotherCase: 'ایک اور کیس رپورٹ کریں',
  reportEmergency: 'ہنگامی رپورٹ درج کریں',
  privacyProtected: 'محفوظ',

  modalTitle: 'مصیبت میں مبتلا جانور کی اطلاع دیں',
  modalSubtitle: 'ریسکیو ٹیموں کو بروقت روانہ کرنے کے لیے ضروری تفصیلات فراہم کریں۔',
  stepAnimal: 'جانور',
  stepLocation: 'مقام',
  stepContact: 'رابطہ',
  stepPhotosLocation: 'تصاویر اور مقام',
  stepContactSubmit: 'رابطہ اور تصدیق',
  situationNoteOptional: 'صورتحال یا چوٹ کی تفصیل (اختیاری)',
  situationNotePlaceholder: 'ضرورت ہو تو چوٹ یا صورتحال کی تفصیل درج کریں (اختیاری)',
  gpsExtractedFromPhoto: 'تصویر سے خودکار GPS مقام حاصل ہوا',
  reportCategoryLabel: 'رپورٹ کی نوعیت کیا ہے؟',
  categorySickInjured: 'بیمار یا زخمی جانور',
  categoryCruelty: 'جانوروں پر ظلم',
  categoryDogBite: 'کتے کے کاٹنے کا واقعہ',
  categoryMissingPet: 'گمشدہ پالتو جانور',
  locationChooseHeading: 'جانور کس جگہ موجود ہے؟',
  useCurrentLocationBtn: 'موجودہ لوکیشن استعمال کریں',
  useCurrentLocationSubtext: 'ایک کلک میں خودکار لوکیشن',
  enterLocationManuallyBtn: 'شہر اور علاقہ خود درج کریں',
  enterLocationManuallySubtext: 'شہر اور محلہ منتخب کریں',
  locationConfirmed: 'مقام کی تصدیق ہو گئی',
  changeLocation: 'تبدیل کریں یا خود لکھیں',
  medicalEmergency: 'طبی ہنگامی صورتحال',
  animalCruelty: 'جانوروں پر ظلم',
  howManyAnimals: 'کتنے جانور ہیں؟',
  singleAnimal: 'ایک جانور',
  multipleAnimals: 'ایک سے زائد',
  litter: 'بچوں کا جھرمٹ (پپلٹس / کٹن)',
  numberOfAnimals: 'جانوروں کی تعداد',
  species: 'جانور کی قسم',
  speciesDog: 'کتا',
  speciesCat: 'بلی',
  speciesHorse: 'گھوڑا',
  speciesDonkey: 'گدھا',
  speciesBird: 'پرندہ',
  speciesOther: 'دیگر جانور',
  lifeStage: 'عمر کا مرحلہ',
  puppyKitten: 'بچہ',
  adult: 'بالغ',
  senior: 'بوڑھا',
  avianSpecies: 'پرندے کی قسم',
  specifyAnimal: 'جانور کی وضاحت کریں',
  injuryDescriptionLabel: 'کیا ہوا؟ / چوٹ کی تفصیل',
  crueltyDescriptionLabel: 'کیا ہوا؟ / ظلم کی تفصیل',
  injuryPlaceholder: 'جانور کی حالت، چوٹ اور صورتحال بیان کریں...',
  crueltyPlaceholder: 'واقعہ، ملوث افراد اور جانور کی حالت بیان کریں...',
  nextLocation: 'اگلا: مقام',
  nextContact: 'اگلا: رابطہ',

  cityLabel: 'شہر',
  areaLabel: 'علاقہ / محلہ',
  areaPlaceholder: 'مثلاً گلبرگ، ڈی ایچ اے، صدر',
  landmarkLabel: 'قریبی مشہور جگہ / رہنمائی (اختیاری)',
  landmarkPlaceholder: 'مثلاً پیٹرول پمپ کے قریب، مارکیٹ کے پیچھے',
  gpsHeading: 'جی پی ایس لوکیشن',
  gpsHint: 'اختیاری۔ ریسکیو ٹیموں کی فوری رہنمائی کے لیے انتہائی مفید ہے۔',
  gpsCaptured: 'لوکیشن محفوظ ہوگئی',
  captureGpsBtn: 'موجودہ لوکیشن حاصل کریں',
  photosHeading: 'تصاویر شامل کریں (زیادہ سے زیادہ 5)',
  uploadPhoto: 'تصویر اپلوڈ کریں',
  takePhoto: 'کیمرے سے تصویر لیں',

  phoneLabel: 'فون نمبر',
  phonePlaceholder: '0300 1234567',
  fullNameLabel: 'آپ کا نام (اختیاری)',
  fullNamePlaceholder: 'مثلاً احمد خان',
  cnicLabel: 'شناختی کارڈ نمبر (اختیاری)',
  cnicPlaceholder: '42101-1234567-1',
  saveProfileToggle: 'آئندہ رپورٹس کے لیے میری معلومات اس ڈیوائس پر محفوظ رکھیں',
  reviewSummaryHeading: 'رپورٹ کا خلاصہ',
  summaryCategory: 'نوعیت',
  summaryAnimals: 'جانور',
  summaryLocation: 'مقام',
  summaryPhotos: 'تصاویر',
  submitReportBtn: 'ریسکیو رپورٹ درج کریں',
  submittingBtn: 'رپورٹ بھیجی جا رہی ہے...',

  chiefComplaint: 'بنیادی مسئلہ',
  animalDetails: 'جانور کی تفصیلات',
  rescueLocation: 'ریسکیو کا مقام',
  casePhotos: 'کیس کی تصاویر',
  reporterDetails: 'اطلاع دہندہ کی تفصیلات',
  viewSubmittedDetails: 'جمع کروائی گئی رپورٹ کی تفصیلات دیکھیں',
  assignedRespondingUnit: 'متعلقہ ریسکیو ٹیم',
  supportAndFollow: 'ان کے کام کی حمایت اور پیروی کریں',
  caseNotFoundTitle: 'کیس نہیں ملا',
  caseNotFoundDesc: 'اس ریفرنس نمبر کا کوئی ریکارڈ نہیں ملا۔ یہ ابھی اپلوڈ ہو رہا ہو سکتا ہے یا لنک درست نہیں ہے۔',

  speciesLabel: 'جانور کی قسم',
  animalCountLabel: 'تعداد',
  lifeStageLabel: 'عمر کا مرحلہ',
  reporterNameLabel: 'اطلاع دہندہ کا نام',
  landmarkNone: 'کوئی نہیں',
  notProvided: 'فراہم نہیں کیا گیا',
  anonymous: 'گمنام',
  notSpecified: 'درج نہیں',

  noticeFreshTitle: 'رپورٹ درج کرنے کا شکریہ',
  noticeFreshBody: 'آپ کی رپورٹ قریبی مصدقہ ریسکیو ٹیموں کو موصول ہو گئی ہے۔ فیلڈ ٹیمیں سب سے پہلے جان لیوا اور شدید زخمی جانوروں کو ترجیح دیتی ہیں۔',
  noticeFreshCrueltyBody: 'واقعہ ریکارڈ کروانے کا شکریہ۔ جانوروں کے تحفظ کے اہلکار اور رضاکار قانونی مبصرین ثبوتوں کی بنیاد پر رپورٹ کا جائزہ لے رہے ہیں۔',
  noticeQueuedTitle: 'آپ کے صبر اور تعاون کا شکریہ',
  noticeQueuedBody: 'آپ کا کیس ڈسپیچ قطار میں فعال ہے۔ ریسکیورز محدود گاڑیوں اور پناہ گاہوں میں گنجائش کی کمی کے باوجود کام کر رہے ہیں۔ اگر ممکن ہو تو جانور کو سایہ اور پینے کا صاف پانی فراہم کر دیں تاکہ فیلڈ ٹیم کے پہنچنے تک فوری راحت مل سکے۔',
  noticeQueuedCrueltyBody: 'آپ کی شکایت متعلقہ اینٹی کرولٹی ٹیموں کی قطار میں موجود ہے۔ اگر آپ کے پاس ملزمان کی مزید ویڈیو یا فوٹو ثبوت موجود ہیں تو قانونی کارروائی کے لیے محفوظ رکھیں۔',
  noticeExtendedTitle: 'دستیاب ریسکیو ٹیم کا انتظار ہے',
  noticeExtendedBody: 'شہر کی تمام پارٹنر پناہ گاہیں اور ایمبولینسز اس وقت شدید زخمی جانوروں کی دیکھ بھال میں مکمل طور پر مصروف ہیں۔ ہم انتظار کی اس تکلیف کو سمجھتے ہیں۔',
  noticeExtendedCrueltyBody: 'علاقائی ریسکیو یونٹس اور پولیس ونگز اس وقت دیگر سنگین قانونی شکایات پر کارروائی کر رہے ہیں۔',
  noticeActiveTitle: 'ریسکیو ٹیم روانہ ہو چکی ہے',
  noticeActiveBody: 'ریسکیو گاڑی نے یہ کیس قبول کر لیا ہے اور وہ جائے وقوعہ کی طرف بڑھ رہی ہے۔',
  noticeActiveCrueltyBody: 'اینٹی کرولٹی ٹیم نے کارروائی شروع کر دی ہے اور وہ جائے وقوعہ پر پہنچ رہی ہے۔',
  noticeResolvedTitle: 'کیس مکمل اور حل شدہ',
  noticeResolvedBody: 'فیلڈ ریسکیورز نے جائے وقوعہ پر پہنچ کر جانور کو امداد فراہم کر دی ہے اور کیس نمٹا دیا گیا ہے۔',
  noticeSubtextEmergency: 'رسپانس ٹائم کا انحصار گاڑیوں کی دستیابی اور شہر میں کیسز کی سنگینی پر ہے۔',
  noticeSubtextCruelty: 'قانونی کارروائی اور تحویل کا انحصار شواہد، گواہوں اور پولیس کے تعاون پر ہے۔',
  advocacyTitle: 'آپ کی رپورٹ پہلے ہی تبدیلی لا رہی ہے',
  advocacyBody: 'ہر رپورٹ خودکار طور پر پارٹنر وکیلوں اور پالیسی ماہرین کے ریکارڈ میں محفوظ ہوتی ہے۔ یہ دستاویزی ثبوت حکومت پر سخت قوانین، سرکاری ایمبولینسز اور سرکاری ریسکیو فنڈنگ کے لیے دباؤ ڈالنے کی خاطر استعمال کیا جاتا ہے۔',
}

export function getReportTranslations(lang: ReportLanguage): ReportTranslations {
  return lang === 'ur' ? TRANSLATIONS_UR : TRANSLATIONS_EN
}

export function translateSpecies(species: string | undefined | null, isUrdu: boolean): string {
  if (!species) return isUrdu ? 'درج نہیں' : 'Not specified'
  if (!isUrdu) return species
  const s = species.toLowerCase()
  if (s === 'dog') return 'کتا'
  if (s === 'cat') return 'بلی'
  if (s === 'horse') return 'گھوڑا'
  if (s === 'donkey') return 'گدھا'
  if (s === 'bird') return 'پرندہ'
  if (s === 'other') return 'دیگر جانور'
  return species
}

export function translateLifeStage(stage: string | undefined | null, isUrdu: boolean): string {
  if (!stage) return isUrdu ? 'درج نہیں' : 'Not specified'
  if (!isUrdu) return stage.charAt(0).toUpperCase() + stage.slice(1)
  const s = stage.toLowerCase()
  if (s.includes('puppy') || s.includes('kitten') || s.includes('baby') || s.includes('child')) return 'بچہ'
  if (s === 'adult') return 'بالغ'
  if (s === 'senior') return 'بوڑھا'
  return stage
}

export function formatAnimalCount(count: number, isUrdu: boolean): string {
  if (isUrdu) {
    return `${count} جانور`
  }
  return `${count} ${count === 1 ? 'animal' : 'animals'}`
}
