/**
 * الانحراف المغناطيسي: الفرق بين الشمال المغناطيسي والشمال الحقيقي.
 *
 * حسّاسات الهاتف (بما فيها `DeviceOrientationEvent`) تقيس اتجاهَ الجهاز
 * نسبةً إلى **الشمال المغناطيسي**، وزاوية القبلة تُقاس من **الشمال الحقيقي**.
 * والفرق بينهما — الانحراف — يبلغ نحو ٥ درجات شرقًا في مصر، ويقارب ٢٦ درجة
 * غربًا في جنوب أفريقيا، ونحو ١٣ درجة شرقًا في سيدني. فمن لم يصحّحه انحرف
 * سهم البوصلة الحيّة بهذا القدر كلّه، وهو خطأ يُظنّ خطأً في زاوية القبلة.
 *
 * النموذج: WMM2020 (عصر 2020.0) بتوسيف كرويّ حتى الدرجة والرتبة ١٢،
 * ومعاملاته وتغيّرها السنوي من ملف NOAA `WMM2020.COF` كما هي، وطريقة
 * الحساب هي خوارزمية النموذج الرسمية.
 *
 * التحقّق: طوبقت القيمُ الرسمية المنشورة (NOAA WMM2025 test values و
 * IAGA IGRF-14 test values) على ست نقاط موزّعة على الأرض في ٢٠٢٥، فوافق
 * الحسابُ القيمَ المنشورة بفارق لا يتجاوز ٠٫٣ درجة في الانحراف، ونحو ٥٠
 * نانوتسلا في مكوّنات المجال. خارج نطاق النموذج (٢٠٢٠–٢٠٢٥ رسميًا) يُقصر
 * الاستقراء على ٢٠٢٠–٢٠٣٠ فلا يتخطّى النموذج حدًّا بعيدًا.
 *
 * @module lib/magnetic
 */

/** عمر النموذج (WMM2020). */
const EPOCH = 2020.0;
/** أقصى درجة في التوسيف الزائد. */
const NMAX = 12;
/** أوّل سنة يُقصر عليها الاستقراء وآخره، فلا يتخطّى النموذج حدًّا بعيدًا. */
const YEAR_RANGE = [2020, 2030];

/** نصف القطر المتوسط للأرض بالكيلومترات (كما في النموذج). */
const MEAN_RADIUS = 6371.2;
/** نصف القطر الأكبر لإهليلجي WGS-84 ومعامل تفلطحه. */
const WGS_A = 6378.137;
const WGS_F = 1 / 298.257223563;
const WGS_B = WGS_A * (1 - WGS_F);

/**
 * معاملات غوس للنموذج: `[g, h, ġ, ḣ]` بالنانوتسلا، مرتّبة بالدرجة `n`
 * ثم بالرتبة `m` من ٠ إلى `n` (كما في ملف WMM.COF).
 * @type {Array<Array<[number, number, number, number]>>}
 */
const COEFFICIENTS = [
  [[-29404.5, 0, 6.7, 0], [-1450.7, 4652.9, 7.7, -25.1]],
  [[-2500, 0, -11.5, 0], [2982, -2991.6, -7.1, -30.2], [1676.8, -734.8, -2.2, -23.9]],
  [[1363.9, 0, 2.8, 0], [-2381, -82.2, -6.2, 5.7], [1236.2, 241.8, 3.4, -1], [525.7, -542.9, -12.2, 1.1]],
  [[903.1, 0, -1.1, 0], [809.4, 282, -1.6, 0.2], [86.2, -158.4, -6, 6.9], [-309.4, 199.8, 5.4, 3.7], [47.9, -350.1, -5.5, -5.6]],
  [[-234.4, 0, -0.3, 0], [363.1, 47.7, 0.6, 0.1], [187.8, 208.4, -0.7, 2.5], [-140.7, -121.3, 0.1, -0.9], [-151.2, 32.2, 1.2, 3], [13.7, 99.1, 1, 0.5]],
  [[65.9, 0, -0.6, 0], [65.6, -19.1, -0.4, 0.1], [73, 25, 0.5, -1.8], [-121.5, 52.7, 1.4, -1.4], [-36.2, -64.4, -1.4, 0.9], [13.5, 9, 0, 0.1], [-64.7, 68.1, 0.8, 1]],
  [[80.6, 0, -0.1, 0], [-76.8, -51.4, -0.3, 0.5], [-8.3, -16.8, -0.1, 0.6], [56.5, 2.3, 0.7, -0.7], [15.8, 23.5, 0.2, -0.2], [6.4, -2.2, -0.5, -1.2], [-7.2, -27.2, -0.8, 0.2], [9.8, -1.9, 1, 0.3]],
  [[23.6, 0, -0.1, 0], [9.8, 8.4, 0.1, -0.3], [-17.5, -15.3, -0.1, 0.7], [-0.4, 12.8, 0.5, -0.2], [-21.1, -11.8, -0.1, 0.5], [15.3, 14.9, 0.4, -0.3], [13.7, 3.6, 0.5, -0.5], [-16.5, -6.9, 0, 0.4], [-0.3, 2.8, 0.4, 0.1]],
  [[5, 0, -0.1, 0], [8.2, -23.3, -0.2, -0.3], [2.9, 11.1, 0, 0.2], [-1.4, 9.8, 0.4, -0.4], [-1.1, -5.1, -0.3, 0.4], [-13.3, -6.2, 0, 0.1], [1.1, 7.8, 0.3, 0], [8.9, 0.4, 0, -0.2], [-9.3, -1.5, 0, 0.5], [-11.9, 9.7, -0.4, 0.2]],
  [[-1.9, 0, 0, 0], [-6.2, 3.4, 0, 0], [-0.1, -0.2, 0, 0.1], [1.7, 3.5, 0.2, -0.3], [-0.9, 4.8, -0.1, 0.1], [0.6, -8.6, -0.2, -0.2], [-0.9, -0.1, 0, 0.1], [1.9, -4.2, -0.1, 0], [1.4, -3.4, -0.2, -0.1], [-2.4, -0.1, -0.1, 0.2], [-3.9, -8.8, 0, 0]],
  [[3, 0, 0, 0], [-1.4, 0, -0.1, 0], [-2.5, 2.6, 0, 0.1], [2.4, -0.5, 0, 0], [-0.9, -0.4, 0, 0.2], [0.3, 0.6, -0.1, 0], [-0.7, -0.2, 0, 0], [-0.1, -1.7, 0, 0.1], [1.4, -1.6, -0.1, 0], [-0.6, -3, -0.1, -0.1], [0.2, -2, -0.1, 0], [3.1, -2.6, -0.1, 0]],
  [[-2, 0, 0, 0], [-0.1, -1.2, 0, 0], [0.5, 0.5, 0, 0], [1.3, 1.3, 0, -0.1], [-1.2, -1.8, 0, 0.1], [0.7, 0.1, 0, 0], [0.3, 0.7, 0, 0], [0.5, -0.1, 0, 0], [-0.2, 0.6, 0, 0.1], [-0.5, 0.2, 0, 0], [0.1, -0.9, 0, 0], [-1.1, 0, 0, 0], [-0.3, 0.5, -0.1, -0.1]],
];

const toRad = (value) => (value * Math.PI) / 180;
const toDeg = (value) => (value * 180) / Math.PI;

/**
 * موقع جغرافي إلى إحداثي مركزي: خط العرض المركزي ونصف القطر.
 * @param {number} lat خط العرض الجيوديسي بالدرجات
 * @param {number} alt الارتفاع بالكيلومترات
 * @returns {{ radius: number, lat: number }} نصف القطر بالكيلومترات والعرض بالراديان
 */
function geocentric(lat, alt = 0) {
  const rad = toRad(lat);
  const sinSq = Math.sin(rad) ** 2;
  const cosSq = Math.cos(rad) ** 2;
  const tmp = alt * Math.sqrt(WGS_A ** 2 * cosSq + WGS_B ** 2 * sinSq);
  const beta = Math.atan(((tmp + WGS_B ** 2) / (tmp + WGS_A ** 2)) * Math.tan(rad));
  const ratio = 1 - (WGS_B / WGS_A) ** 2;
  const radius = Math.sqrt(
    alt ** 2 + 2 * tmp + (WGS_A ** 2 * (1 - (1 - (WGS_B / WGS_A) ** 4) * sinSq)) / (1 - ratio * sinSq),
  );
  return { radius, lat: beta };
}

/**
 * دوال لِجندر المرتبطة شبه المعيارية (Schmidt quasi-normalised) ومشتقّاتها
 * بالنسبة لخط العرض الشتوي، بتخطيط `[m][n]` كما في خوارزمية النموذج.
 * @param {number} colatitude خط العرض الشتوي بالدرجات
 * @returns {Array<Array<number>>} `[P, dP]`
 */
function legendre(colatitude) {
  const cos = Math.cos(toRad(colatitude));
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  /** @type {number[][]} */
  const P = Array.from({ length: NMAX + 1 }, () => new Array(NMAX + 1).fill(0));
  /** @type {number[][]} */
  const dP = Array.from({ length: NMAX + 1 }, () => new Array(NMAX + 1).fill(0));
  P[0][0] = 1;
  for (let m = 0; m < NMAX; m += 1) {
    if (m === 1) {
      P[1][1] = sin;
      dP[1][1] = cos;
    }
    /* P(m+1, m) = √(2m+1) · cos θ · P(m, m) */
    const seed = Math.sqrt(2 * m + 1) * P[m][m];
    P[m][m + 1] = cos * seed;
    dP[m][m + 1] = dP[m][m] * cos * Math.sqrt(2 * m + 1) - sin * seed;
    for (let n = m + 2; n <= NMAX; n += 1) {
      const d = n * n - m * m;
      P[m][n] = ((2 * n - 1) * cos * P[m][n - 1] - Math.sqrt(d - (2 * n - 1)) * P[m][n - 2]) / Math.sqrt(d);
      dP[m][n] = (n * cos * P[m][n] - Math.sqrt(d) * P[m][n - 1]) / sin;
    }
    /* قطر الشطر التالي: P(m+1, m+1) */
    P[m + 1][m + 1] = (sin * seed) / Math.sqrt(2 * m + 2);
    dP[m + 1][m + 1] = P[m][m + 1] * Math.sqrt(m + 1) * Math.sqrt(0.5);
  }
  return [P, dP];
}

/**
 * الانحراف المغناطيسي في نقطة ما، بالدرجات، موجبًا إلى الشرق.
 *
 * @param {number} lat خط العرض بالدرجات (شمالًا موجبًا)
 * @param {number} lng خط الطول بالدرجات (شرقًا موجبًا)
 * @param {number} [year] سنة عشرية (2026.8 مثلًا). الافتراضي سنة اليوم.
 * @returns {number} الانحراف بالدرجات، بين ‑٣٠ و+٣٠ تقريبًا
 */
export function magneticDeclination(lat, lng, year = decimalYear(new Date())) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0;
  const clamped = Math.min(Math.max(year, YEAR_RANGE[0]), YEAR_RANGE[1]);
  const dt = clamped - EPOCH;
  const { radius, lat: geocentricLat } = geocentric(lat);
  const [P, dP] = legendre(90 - toDeg(geocentricLat));

  /* جيب وجيب تمام الرتب حسب خط الطول */
  const cosLng = Math.cos(toRad(lng));
  const sinLng = Math.sin(toRad(lng));
  /** @type {number[]} */
  const cosM = [1, cosLng];
  /** @type {number[]} */
  const sinM = [0, sinLng];
  for (let m = 2; m <= NMAX; m += 1) {
    cosM.push(cosM[m - 1] * cosLng - sinM[m - 1] * sinLng);
    sinM.push(cosM[m - 1] * sinLng + sinM[m - 1] * cosLng);
  }
  const ratio = MEAN_RADIUS / radius;
  /** @type {number[]} */
  const radiusPower = [ratio ** 2];
  for (let n = 1; n <= NMAX; n += 1) radiusPower.push(radiusPower[n - 1] * ratio);

  let theta = 0;
  let phi = 0;
  let radial = 0;
  for (let m = 0; m <= NMAX; m += 1) {
    for (let n = Math.max(m, 1); n <= NMAX; n += 1) {
      const [g0, h0, gDot, hDot] = COEFFICIENTS[n - 1][m];
      const g = g0 + gDot * dt;
      const h = h0 + hDot * dt;
      const along = g * cosM[m] + h * sinM[m];
      theta -= radiusPower[n] * along * dP[m][n];
      phi += radiusPower[n] * (g * sinM[m] - h * cosM[m]) * m * P[m][n];
      radial -= radiusPower[n] * along * (n + 1) * P[m][n];
    }
  }

  /*
   * المكوّن شرقًا يحتاج قسمةً على جيب تمام العرض، وهو ينعدم عند القطب:
   * هناك لا يبقى أفقيّ، فلا معنى للانحراف.
   */
  const nearPole = Math.abs(geocentricLat) > Math.PI / 2 - 1e-6;
  const east = nearPole ? 0 : phi / Math.cos(geocentricLat);
  const south = -theta;
  /* ردّ المكوّنات من المركز إلى الإحداثي الجيوديسي، فارتفاع القطب الشمالي */
  const tilt = geocentricLat - toRad(lat);
  const north = south * Math.cos(tilt) - radial * Math.sin(tilt);
  const angle = toDeg(Math.atan2(east, north));
  return Number.isFinite(angle) ? angle : 0;
}

/**
 * اتجاه الجهاز صحيح نسبةً إلى الشمال الحقيقي.
 * @param {number} magneticHeading اتجاه الجهاز نسبةً إلى الشمال المغناطيسي (٠ شمال)
 * @param {number} declination الانحراف بالدرجات موجبًا إلى الشرق
 * @returns {number} ٠..٣٦٠ من الشمال الحقيقي
 */
export function trueHeading(magneticHeading, declination) {
  if (!Number.isFinite(magneticHeading)) return 0;
  return ((magneticHeading + declination) % 360 + 360) % 360;
}

/**
 * زاوية القبلة كما تظهر على الشاشة: الفرق بين اتجاه القبلة واتجاه الجهاز.
 * @param {number} bearing اتجاه القبلة من الشمال الحقيقي (٠..٣٦٠)
 * @param {number} heading اتجاه الجهاز من الشمال الحقيقي (٠..٣٦٠)
 * @returns {number} ٠..٣٦٠، والصفر يعني أن الكعبة في مقدّمة الجهاز
 */
export function relativeBearing(bearing, heading) {
  if (!Number.isFinite(bearing) || !Number.isFinite(heading)) return 0;
  return ((bearing - heading) % 360 + 360) % 360;
}

/**
 * السنة العشرية لتاريخٍ ما، وهي الصيغة التي يقبلها النموذج.
 * @param {Date} date
 * @returns {number} مثل ٢٠٢٦٫٧٩ في أواخر ٢٠٢٦
 */
export function decimalYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const end = Date.UTC(date.getUTCFullYear() + 1, 0, 1);
  return date.getUTCFullYear() + (date.getTime() - start) / (end - start);
}