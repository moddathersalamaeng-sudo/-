# -*- coding: utf-8 -*-
"""Phase 15 interface strings ("sl15"): the lesson deck. Same keys and placeholders in Arabic and English."""
def B(en, ar): return {"en": en, "ar": ar}
S = {
  "title": B("This lesson in slides", "الدرس في شرائح"),
  "carousel": B("slide deck", "عرض شرائح"), "slide": B("slide", "شريحة"), "stage": B("Slides — use the arrow keys to turn the page", "الشرائح — استخدم مفاتيح الأسهم لقلب الصفحة"),
  "of": B("Slide {n} of {total}", "الشريحة {n} من {total}"), "goTo": B("Go to slide {n}", "اذهب إلى الشريحة {n}"), "jump": B("Choose a slide", "اختر شريحة"),
  "prev": B("Previous", "السابقة"), "next": B("Next", "التالية"), "present": B("Present", "عرض بملء الشاشة"),
  "before": B("Not like this", "ليس هكذا"), "after": B("Like this", "بل هكذا"), "avoid": B("Avoid", "تجنّب"), "show": B("Show instead", "واعرض بدلًا منه"),
  "askYourself": B("What would you do? Think, then read the lesson below.", "ماذا كنت ستفعل؟ فكّر، ثم اقرأ الدرس أدناه."),
  "modelNote": B("Simplified illustration of the model's standard steps (CIA drawing).", "رسم مبسّط للخطوات المعروفة للنموذج (رسم من الأكاديمية)."),
  "figureNote": B("Figure from this lesson — its explanation is in the lesson below.", "رسم من هذا الدرس — شرحه في نص الدرس أدناه."),
  "compareNote": B("Both wordings are quoted from the lesson's example.", "الصياغتان منقولتان من مثال الدرس."),
  "fullBelow": B("The full lesson, the exercise and the check question are below.", "الدرس كاملًا والتمرين وسؤال التحقق أدناه."),
  "k": {"cover": B("Lesson", "الدرس"), "goals": B("What you will be able to do", "ما ستتمكن من فعله"), "idea": B("The key idea", "الفكرة الأساسية"),
        "steps": B("How, step by step", "الخطوات بالترتيب"), "example": B("An example", "مثال توضيحي"), "compare": B("Example: say it right", "مثال: الصياغة الصحيحة"),
        "scenario": B("Situation", "موقف عملي"), "avoid": B("Avoid this — show this", "تجنّب هذا — واعرض هذا"), "evidence": B("What proves it", "ما الذي يثبت ذلك"),
        "tips": B("Tips and checks", "نصائح وفحوص"), "summary": B("Remember", "تذكّر")}
}
def flatten(d, p=""):
    for k, v in d.items():
        key = f"{p}.{k}" if p else k
        if isinstance(v, dict) and set(v) == {"en", "ar"}: yield key, v
        else: yield from flatten(v, key)
def tree(lang):
    def w(d): return {k: (v[lang] if isinstance(v, dict) and set(v) == {"en", "ar"} else w(v)) for k, v in d.items()}
    return w(S)
