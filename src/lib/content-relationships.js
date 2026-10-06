/**
 * Content Relationships Engine - Smart linking without AI
 * Uses tags, categories, keywords, and explicit relationships
 * @module lib/content-relationships
 */

// Core relationship mapping: topic -> related topics
const TOPIC_RELATIONSHIPS = {
  // Prayer (الصلاة)
  'صلاة': {
    quran: ['الصلاة', 'أقم الصلاة', 'المصلي', 'الركوع', 'السجود'],
    hadith: ['صلاة', 'الصلوات', 'الإمام', 'الجماعة', 'السنة'],
    tafsir: ['الصلاة', 'أقم الصلاة', 'مواقيت'],
    fiqh: ['طهارة', 'وضوء', 'غسل', 'تيمم', 'أذان', 'إقامة', 'فرائض', 'سنن', 'مبطلات', 'سهو', 'مسافر', 'مريض', 'جمع', 'قصر', 'جمعة', 'عيد', 'استخارة', 'توبة', 'خسوف', 'استسقاء', 'تراويح', 'تهجد', 'وتر'],
    adhkar: ['أذكار بعد الصلاة', 'أذكار الصباح', 'أذكار المساء', 'تسبيح', 'استغفار'],
    ibadat: ['وضوء', 'صلاة', 'أذان', 'إقامة'],
    tools: ['مواقيت الصلاة', 'القبلة', 'أذان', 'مسبحة'],
    occasions: ['جمعة', 'عيد الفطر', 'عيد الأضحى', 'رمضان'],
  },

  // Fasting/Worship (الصيام/العبادة)
  'صيام': {
    quran: ['الصيام', 'رمضان', 'الشهر', 'الإفطار', 'السحور'],
    hadith: ['صيام', 'رمضان', 'الصائم', 'السحور', 'الإفطار', 'ليلة القدر', 'اعتكاف'],
    tafsir: ['الصيام', 'رمضان', 'الشهر', 'المحرم'],
    fiqh: ['صيام', 'نية', 'إفطار', 'سحور', 'قضاء', 'كفارة', 'فدية', 'مسافر', 'مريض', 'حائض', 'نفساء', 'عتكاف', ' ليلة القدر', 'زكاة الفطر'],
    adhkar: ['دعاء الصائم', 'دعاء الإفطار', 'دعاء السحور', 'أذكار رمضان'],
    ibadat: ['صيام', 'رمضان', 'زكاة الفطر', 'اعتكاف'],
    tools: ['تقويم هجري', 'مواقيت الصلاة', 'مسبحة'],
    occasions: ['رمضان', 'ليلة القدر', 'العشر الأواخر', 'عيد الفطر', 'شعبان', 'شوال'],
  },

  // Quran (القرآن)
  'قرآن': {
    quran: ['آية', 'سورة', 'جزء', 'حزب', 'صفحة', 'تلاوة', 'حفظ', 'تجويد', 'تفسير', 'أسباب النزول'],
    hadith: ['قرآن', 'تلاوة', 'حفظ', 'تعلم', 'شفيع'],
    tafsir: ['تفسير', 'معنى', 'غريب', 'ناسخ', 'منسوخ', 'مكي', 'مدني'],
    fiqh: ['أحكام التلاوة', 'سجود التلاوة', 'القراءة في الصلاة'],
    adhkar: ['أذكار الصباح', 'أذكار المساء', 'آية الكرسي', 'المعوذتين'],
    tools: ['مصحف', 'تلاوة', 'تجويد', 'تفسير', 'حفظ', 'ختمة', 'ورد'],
    library: ['تفسير', 'علوم القرآن', 'غريب القرآن', 'قراءات'],
  },

  // Dhikr/Dua (الأذكار/الأدعية)
  'ذكر': {
    quran: ['ذكر', 'تسبيح', 'تهليل', 'تحميد', 'تكبير', 'استغفار'],
    hadith: ['ذكر', 'تسبيح', 'تهليل', 'دعاء', 'استغفار', 'أذكار'],
    fiqh: ['أذكار الصلاة', 'أذكار الوضوء', 'أذكار النوم', 'أذكار الصباح', 'أذكار المساء'],
    adhkar: ['صباح', 'مساء', 'نوم', 'استيقاظ', 'بعد صلاة', 'مسجد', 'سفر', 'طعام', 'دخول بيت', 'خروج بيت', 'استغفار', 'صلاة على النبي'],
    tools: ['مسبحة', 'عداد', 'أذكار', 'نور الذكر'],
    occasions: ['رمضان', 'عشر ذي الحجة', 'يوم عرفة', 'عاشوراء', 'جمعة'],
  },

  // Hajj/Umrah (الحج/العمرة)
  'حج': {
    quran: ['حج', 'بيت', 'كعبة', 'صفا', 'مروة', 'عرفات', 'مزدلفة', 'منى', 'جمرة'],
    hadith: ['حج', 'عمرة', 'إحرام', 'طواف', 'سعي', 'وقوف', 'رمي', 'هدى'],
    tafsir: ['الحج', 'البيت', 'العمرة'],
    fiqh: ['إحرام', 'طواف', 'سعي', 'وقوف عرفة', 'مبيت مزدلفة', 'رمي جمار', 'ذبح', 'تحلل', 'طواف وداع', 'عمرة', 'تمتع', 'قران', 'إفراد'],
    ibadat: ['حج', 'عمرة', 'مناسك'],
    tools: ['قبلة', 'دليل حج', 'تقويم'],
    occasions: ['ذو الحجة', 'يوم عرفة', 'عيد الأضحى', 'أيام التشريق'],
  },

  // Zakat/Charity (الزكاة/الصدقة)
  'زكاة': {
    quran: ['زكاة', 'صدقة', 'إنفاق', 'فقراء', 'مساكين', 'مؤلفة', 'غارمين', 'سبيل الله', 'ابن السبيل'],
    hadith: ['زكاة', 'صدقة', 'نصاب', 'خراج', 'عشر', 'نصف عشر'],
    tafsir: ['الزكاة', 'الصدقة', 'الإنفاق'],
    fiqh: ['نصاب ذهب', 'نصاب فضة', 'زكاة المال', 'زكاة التجارة', 'زكاة الأنعام', 'زكاة الزرع', 'زكاة المعادن', 'زكاة الفطر', 'مصارف الزكاة', 'حاسبة زكاة'],
    tools: ['حاسبة زكاة', 'حاسبة مواريث'],
    occasions: ['رمضان', 'عيد الفطر', 'زكاة الفطر'],
  },

  // Seerah/Prophets (السيرة/الأنبياء)
  'سيرة': {
    quran: ['نبي', 'رسول', 'محمد', 'أحمد', 'مبشر', 'نذير', 'سراج', 'منير'],
    hadith: ['نبي', 'رسول', 'صلى الله عليه وسلم', 'الهجرة', 'غزوة', 'صلح', 'فتح', 'حجة'],
    seerah: ['ميلاد', 'بداية الوحي', 'دعوة سرية', 'دعوة جهرية', 'هجرة', 'مدينة', 'بدر', 'أحد', 'خندق', 'حديبية', 'فتح مكة', 'حجة الوداع', 'وفاة'],
    prophets: ['آدم', 'نوح', 'إبراهيم', 'موسى', 'عيسى', 'محمد', 'يوسف', 'أيوب', 'يونس', 'هود', 'صالح', 'شُعيب', 'إدريس', 'ذو الكفل', 'إلياس', 'اليسع', 'زكريا', 'يحيى', 'شيث', 'لقمان', 'ذي القرنين', 'خضر'],
    companions: ['أبو بكر', 'عمر', 'عثمان', 'علي', 'طلحة', 'الزبير', 'عبد الرحمن', 'سعد', 'أبو عبيدة', 'خالد', 'عمرو', 'معاذ', 'أبو هريرة', 'عائشة', 'فاطمة', 'خديجة', 'حفصة', 'زينب', 'أم سلمة', 'صفية', 'مارية'],
    library: ['سيرة', 'تاريخ', 'الرحيق المختوم', 'البداية والنهاية'],
  },

  // Aqeedah (العقيدة)
  'عقيدة': {
    quran: ['إيمان', 'كفر', 'شرك', 'توحيد', 'ربوبية', 'أُلوهية', 'أسماء', 'صفات', 'قدر', 'يوم الآخر', 'بعث', 'حساب', 'جنة', 'نار'],
    hadith: ['إيمان', 'إسلام', 'إحسان', 'ساعة', 'علامات', 'قبر', 'بعث', 'حوض', 'شفاعة', 'ميزان', 'صراط'],
    aqeedah: ['توحيد', 'ربوبية', 'أُلوهية', 'أسماء وصفات', 'إيمان', 'ملائكة', 'كتب', 'رسل', 'يوم آخر', 'قدر', 'شرك', 'نفاق', 'بدعة', 'سنة', 'سلف', 'مرجئة', 'قدرية', 'جهمية', 'معتزلة', 'أشعرية', 'ماتريدية'],
    fiqh: ['تكفير', 'حاكمية', 'ولاء', 'براء', 'أمر بمعروف', 'نهي عن منكر'],
    library: ['عقيدة', 'توحيد', 'سنة', 'بدعة', 'ردود', 'فرق'],
  },

  // Family/Social (الأسرة/المعاملات)
  'أسرة': {
    quran: ['زوج', 'زوجة', 'والد', 'والدة', 'ولد', 'بنت', 'أخ', 'أخت', 'قرابة', 'رحم', 'مهر', 'نفقة', 'عدة', 'طلاق', 'خلع', 'إيلاء', 'ظهار', 'مضارة', 'رضاع', 'حضانة', 'ولاية', 'وصية', 'ميراث'],
    hadith: ['نكاح', 'طلاق', 'وليمة', 'مهر', 'نفقة', 'بر', 'وصال', 'رضاع', 'ميراث', 'وصية', 'هبة', 'عهدة'],
    fiqh: ['نكاح', 'شروط', 'أركان', 'ولي', 'شهود', 'مهر', 'نفقة', 'عدة', 'طلاق', 'رجعي', 'بائن', 'مخلعة', 'إيلاء', 'ظهار', 'لعان', 'رضاع', 'حضانة', 'ولاية', 'وصية', 'ميراث', 'فروض', 'تعصيب', 'حجب', 'منع'],
    akhlaq: ['بر', 'صلة', 'رحم', 'إحسان', 'عفو', 'صفح', 'كظم', 'غضب', 'حياء', 'تواضع', 'صدق', 'أمانة', 'وفاء', 'شكر', 'صبر', 'رضا'],
    occasions: ['زواج', 'ولادة', 'ختان', 'عقيقة', 'خطبة', 'عقد', 'وليمة'],
  },

  // History (التاريخ)
  'تاريخ': {
    quran: ['أمة', 'قرن', 'قرون', 'آباء', 'أجداد', 'سلف', 'خلف', 'دولة', 'ملك', 'خلافة', 'إمارة'],
    hadith: ['خليفة', 'إمارة', 'خلافة', 'سلطان', 'حاكم', 'رعية', 'عدل', 'جور', 'فتنة', ' فرقة', 'جماعة'],
    history: ['نبوة', 'راشدين', 'أمية', 'عباسية', 'أندلس', 'فاطمية', 'أيوبي', 'مملوكي', 'عثماني', 'حديث', 'علماء', 'مدن', 'معارك', 'فتح', 'حضارة', 'علوم', 'تراجم', 'مذاهب'],
    seerah: ['هجرة', 'دولة', 'مدينة', 'خلافة', 'أبو بكر', 'عمر', 'عثمان', 'علي'],
    library: ['تاريخ', 'سير', 'تراجم', 'طبقات', 'بداية ونهاية', 'الكامل', 'تاريخ الإسلام', 'البداية والنهاية'],
  },

  // Akhlaq/Ethics (الأخلاق)
  'أخلاق': {
    quran: ['خُلُق', 'خِلق', 'حسن', 'سيء', 'كريم', 'لئيم', 'صبر', 'شكر', 'تواضع', 'تكبر', 'رحمة', 'قسوة', 'عفو', 'انتقام', 'عدل', 'جور', 'صدق', 'كذب', 'أمانة', 'خيانة', 'وفاء', 'غدر'],
    hadith: ['خُلق', 'أخلاق', 'مكارم', 'مذموم', 'حسن', 'قبيح', 'خلق', 'سوء', 'كريم', 'لئيم'],
    akhlaq: ['صدق', 'أمانة', 'بر', 'صلة', 'حسن خلق', 'صبر', 'شكر', 'تواضع', 'رحمة', 'عفو', 'إحسان', 'حياء', 'غيرة', 'كرم', 'جود', 'سخاء', 'بذل', 'عطاء', 'صفح', 'صفح', 'كظم غيظ'],
    fiqh: ['أمر بمعروف', 'نهي عن منكر', 'نصيحة', 'غيرة', 'ستر', 'عفو', 'صفح'],
    library: ['أخلاق', 'تهذيب', 'تربية', 'مكارم', 'رياضة', 'تصوف', 'زهد', 'ورع', 'تقوى'],
  },
};

// Reverse index: keyword -> topics
const KEYWORD_TO_TOPICS = {};

// Build reverse index
Object.entries(TOPIC_RELATIONSHIPS).forEach(([topic, categories]) => {
  Object.values(categories).flat().forEach(keyword => {
    const normalized = normalize(keyword);
    if (!KEYWORD_TO_TOPICS[normalized]) {
      KEYWORD_TO_TOPICS[normalized] = [];
    }
    if (!KEYWORD_TO_TOPICS[normalized].includes(topic)) {
      KEYWORD_TO_TOPICS[normalized].push(topic);
    }
  });
  // Also index the topic itself
  const normTopic = normalize(topic);
  if (!KEYWORD_TO_TOPICS[normTopic]) {
    KEYWORD_TO_TOPICS[normTopic] = [];
  }
  if (!KEYWORD_TO_TOPICS[normTopic].includes(topic)) {
    KEYWORD_TO_TOPICS[normTopic].push(topic);
  }
});

function normalize(text) {
  return String(text || '')
    .trim()
    .replace(/[،؛؟!.,;?]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export { normalize };

/**
 * Get related content for a given topic/keyword
 * @param {string} keyword - The keyword or topic to find relations for
 * @param {object} options - Options
 * @returns {Promise<Array>} Related content items
 */
export async function getRelatedContent(keyword, options = {}) {
  const {
    limit = 10,
    categories = null, // Filter by category
    currentRoute = '', // Exclude current page
    registry // Search registry instance
  } = options;

  const normalized = normalize(keyword);
  const topics = KEYWORD_TO_TOPICS[normalized] || [];
  
  if (!topics.length && registry) {
    // Fallback: search registry for the keyword
    try {
      const { searchAll } = await import('./unified-search.js');
      const results = await searchAll(keyword, { limit: 20 });
      return results.results
        .filter(r => r.route !== currentRoute)
        .slice(0, limit)
        .map(r => ({
          id: r.id,
          type: r.type,
          category: r.category,
          icon: r.icon,
          title: r.title,
          description: r.description,
          route: r.route,
          score: r.score,
          matchType: r.matchType,
          sourceId: r.sourceId
        }));
    } catch (e) {
      console.warn('Fallback search failed:', e);
    }
  }

  // Collect related items from all topics
  const relatedItems = [];
  const seen = new Set();

  for (const topic of topics) {
    const relations = TOPIC_RELATIONSHIPS[topic];
    if (!relations) continue;

    for (const [category, keywords] of Object.entries(relations)) {
      if (categories && !categories.includes(category)) continue;

      for (const kw of keywords) {
        if (registry) {
          try {
            const { searchAll } = await import('./unified-search.js');
            const results = await searchAll(kw, { limit: 5, category });
            for (const r of results.results) {
              const key = `${r.sourceId}|${r.id}|${r.route}`;
              if (seen.has(key) || r.route === currentRoute) continue;
              seen.add(key);
              relatedItems.push({
                id: r.id,
                type: r.type,
                category: r.category,
                icon: r.icon,
                title: r.title,
                description: r.description,
                route: r.route,
                score: r.score,
                matchType: r.matchType,
                sourceId: r.sourceId,
                relatedTopic: topic,
                relatedKeyword: kw
              });
            }
          } catch (e) {
            // Skip failed searches
          }
        }
      }
    }
  }

  // Sort by score and limit
  return relatedItems
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
}

/**
 * Get related topics for a keyword
 * @param {string} keyword
 * @returns {string[]}
 */
function getRelatedTopics(keyword) {
  const normalized = normalize(keyword);
  return KEYWORD_TO_TOPICS[normalized] || [];
}

/**
 * Register custom relationships (for dynamic content)
 * @param {string} topic
 * @param {object} relationships
 */
function registerRelationships(topic, relationships) {
  TOPIC_RELATIONSHIPS[topic] = relationships;
  
  // Update reverse index
  Object.values(relationships).flat().forEach(keyword => {
    const norm = normalize(keyword);
    if (!KEYWORD_TO_TOPICS[norm]) {
      KEYWORD_TO_TOPICS[norm] = [];
    }
    if (!KEYWORD_TO_TOPICS[norm].includes(topic)) {
      KEYWORD_TO_TOPICS[norm].push(topic);
    }
  });
}

/**
 * Get all registered topics
 * @returns {string[]}
 */
function getAllTopics() {
  return Object.keys(TOPIC_RELATIONSHIPS);
}

/**
 * Get relationship map for a topic
 * @param {string} topic
 * @returns {object|null}
 */
function getRelationshipMap(topic) {
  return TOPIC_RELATIONSHIPS[topic] || null;
}

// Auto-detect topic from page content
function detectTopicFromContent(text, maxTopics = 3) {
  const normalized = normalize(text);
  const topicScores = {};

  Object.entries(KEYWORD_TO_TOPICS).forEach(([keyword, topics]) => {
    if (normalized.includes(keyword) && keyword.length > 2) {
      topics.forEach(topic => {
        topicScores[topic] = (topicScores[topic] || 0) + (keyword.length > 5 ? 2 : 1);
      });
    }
  });

  return Object.entries(topicScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTopics)
    .map(([topic]) => topic);
}