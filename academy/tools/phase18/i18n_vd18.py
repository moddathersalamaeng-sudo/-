# -*- coding: utf-8 -*-
"""Phase 18 interface strings ("vd18"): videos. Same keys and placeholders in AR/EN."""
def B(en, ar): return {"en": en, "ar": ar}
S = {
  "title": B("Videos", "الفيديوهات"),
  "eyebrow": B("Video library", "مكتبة الفيديو"),
  "lede": B("Short video lessons by مدثر سلامه: ISO 9001:2026 clause by clause, the pioneers of quality, and applied excellence.", "دروس فيديو قصيرة من مدثر سلامه: ISO 9001:2026 بندًا بندًا، ورواد الجودة، وتطبيقات التميّز."),
  "count": B("{n} videos · {min} minutes", "{n} فيديو · {min} دقيقة"),
  "all": B("All series", "كل السلاسل"),
  "allVideos": B("All videos", "كل الفيديوهات"),
  "watch": B("Watch the explanation", "شاهد الشرح"),
  "watchNamed": B("Watch: {title}", "شاهد: {title}"),
  "inLesson": B("Video for this lesson", "فيديو هذا الدرس"),
  "inCourse": B("Videos in this course", "فيديوهات هذه الدورة"),
  "minutes": B("{n} min", "{n} د"),
  "seconds": B("{n} s", "{n} ث"),
  "watched": B("Watched", "تمت المشاهدة"),
  "resume": B("Continue from {t}", "أكمل من {t}"),
  "worksheet": B("Worksheet", "ورقة التطبيق"),
  "worksheetNote": B("Opens in a new tab; print it or fill it in.", "تفتح في تبويب جديد؛ اطبعها أو املأها."),
  "transcript": B("Transcript", "النص المكتوب"),
  "transcriptEn": B("English transcript", "النص المكتوب بالإنجليزية"),
  "transcriptAr": B("Arabic transcript", "النص المكتوب بالعربية"),
  "transcriptFail": B("The transcript could not be loaded.", "تعذّر تحميل النص المكتوب."),
  "usedIn": B("Used in these lessons", "مستخدم في هذه الدروس"),
  "notUsed": B("This video is in the library only.", "هذا الفيديو في المكتبة فقط."),
  "series": B("Series", "السلسلة"),
  "next": B("Next in the series", "التالي في السلسلة"),
  "prev": B("Previous", "السابق"),
  "open": B("Open the video page", "افتح صفحة الفيديو"),
  "notFound": B("Video not found", "الفيديو غير موجود"),
  "notFoundBody": B("This video is not in the library. Choose another one.", "هذا الفيديو غير موجود في المكتبة. اختر فيديو آخر."),
  "loadFail": B("The video could not be loaded. Check your connection and try again.", "تعذّر تحميل الفيديو. تحقق من الاتصال وحاول مرة أخرى."),
  "voiceNote": B("Some narrations use a synthetic voice; examples are illustrative. A video explains a clause — it does not replace the standard: read the clause in your licensed copy.", "بعض التعليقات الصوتية بصوت اصطناعي، والأمثلة توضيحية. الفيديو يشرح البند ولا يغني عن المواصفة: اقرأ البند في نسختك المرخّصة."),
  "filter": B("Show", "عرض"),
  "unwatched": B("Not watched yet", "لم تُشاهد بعد"),
  "progress": B("{w} of {n} watched", "شاهدت {w} من {n}"),
  "search": B("Search videos", "ابحث في الفيديوهات"),
  "none": B("No video matches.", "لا يوجد فيديو مطابق."),
  "libraryCard": B("Video library", "مكتبة الفيديو"),
  "libraryCardBody": B("{n} short video lessons — ISO 9001:2026, quality pioneers and excellence.", "{n} درس فيديو قصير — ISO 9001:2026 ورواد الجودة والتميّز."),
  "clause": B("Clause {c}", "البند {c}")
}
from placements import SERIES, SERIES_ABOUT
S["ser"] = {k: B(v["en"], v["ar"]) for k, v in SERIES.items()}
S["serAbout"] = {k: B(v["en"], v["ar"]) for k, v in SERIES_ABOUT.items()}
def flatten(d, p=""):
    for k, v in d.items():
        key = f"{p}.{k}" if p else k
        if isinstance(v, dict) and set(v) == {"en", "ar"}: yield key, v
        else: yield from flatten(v, key)
def tree(lang):
    def w(d): return {k: (v[lang] if isinstance(v, dict) and set(v) == {"en", "ar"} else w(v)) for k, v in d.items()}
    return w(S)
