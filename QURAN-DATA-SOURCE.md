# Quran Arabic data source

`vendor/quran-arabic.json` contains the Arabic Uthmani text and verse location metadata used by the offline reader.

- Source: [AlQuran.cloud API](https://api.alquran.cloud/v1/quran/quran-uthmani)
- Edition identifier: `quran-uthmani`
- Included data: 114 surahs, 6,236 ayahs, juz/page/hizb metadata
- Excluded data: translations and tafsir, which remain optional online requests
- Source terms: [AlQuran.cloud terms](https://alquran.cloud/terms-and-conditions), Section II permits storing and reproducing Arabic Quran text for non-commercial use and asks for source attribution.

To refresh the bundled corpus, run `npm run download:quran` from this folder while online. The script validates the surah and ayah totals, numbering, and required Arabic text before replacing the data file.
