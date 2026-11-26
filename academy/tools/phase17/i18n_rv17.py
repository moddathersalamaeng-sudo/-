# -*- coding: utf-8 -*-
"""Phase 17 interface strings ("rv17"): daily review cards. Same keys and placeholders in AR/EN."""
def B(en, ar): return {"en": en, "ar": ar}
S = {
  "title": B("Daily review", "المراجعة اليومية"),
  "open": B("Daily review", "المراجعة اليومية"),
  "stat": {"due": B("Due today", "مستحقة اليوم"), "streak": B("Day streak", "أيام متتالية"), "learning": B("Learning", "قيد التعلّم"), "mastered": B("Mastered", "متقنة")},
  "emptyTitle": B("No review cards yet", "لا توجد بطاقات مراجعة بعد"),
  "emptyBody": B("Questions you miss in an assessment or a lesson check come here by themselves. You can also add a practice set below.", "الأسئلة التي تخطئ فيها في الاختبارات أو أسئلة التحقق في الدروس تأتي هنا تلقائيًا. ويمكنك أيضًا إضافة مجموعة تدريب من الأسفل."),
  "dueTitle": B("{n} cards to review today", "{n} بطاقة للمراجعة اليوم"),
  "dueBody": B("About a minute per card. Each right answer pushes the card further out; a wrong one brings it back tomorrow.", "دقيقة تقريبًا لكل بطاقة. كل إجابة صحيحة تؤجل البطاقة لمدة أطول، والإجابة الخاطئة تعيدها غدًا."),
  "start": B("Start today's review ({n})", "ابدأ مراجعة اليوم ({n})"),
  "clearTitle": B("All done for today", "أنهيت مراجعة اليوم"),
  "nextReview": B("Next cards are due on {date}.", "البطاقات التالية مستحقة يوم {date}."),
  "boxesLabel": B("Cards by box", "البطاقات حسب الصندوق"),
  "boxShort": B("Box {n} · {d} d", "صندوق {n} · {d} يوم"),
  "last14": B("Last 14 days", "آخر 14 يومًا"),
  "dayLine": B("{date}: {n} cards reviewed", "{date}: تمت مراجعة {n} بطاقة"),
  "box": B("Box {n}", "الصندوق {n}"),
  "mastered": B("Mastered", "متقنة"),
  "src": {"assessment": B("From an assessment", "من اختبار"), "lesson": B("From a lesson check", "من سؤال تحقق في درس"), "practice": B("Practice set", "مجموعة تدريب")},
  "check": B("Check", "تحقّق"),
  "next": B("Next card", "البطاقة التالية"),
  "finish": B("Finish", "إنهاء"),
  "unknownBack": B("Here is the answer — this card comes back tomorrow.", "هذه هي الإجابة — ستعود هذه البطاقة غدًا."),
  "nextOn": B("Next review: {date} (box {n})", "المراجعة التالية: {date} (الصندوق {n})"),
  "nextMastered": B("Mastered — checked again on {date}", "متقنة — تُراجع مرة أخرى يوم {date}"),
  "study": B("Study this topic", "ادرس هذا الموضوع"),
  "sessionTitle": B("Today's review", "مراجعة اليوم"),
  "progress": B("Session progress", "تقدّم الجلسة"),
  "progressText": B("Card {n} of {total}", "البطاقة {n} من {total}"),
  "doneTitle": B("Review complete", "اكتملت المراجعة"),
  "doneLine": B("{right} of {total} right", "{right} من {total} صحيحة"),
  "doneBody": B("The cards you missed come back tomorrow; the others wait longer. See you tomorrow.", "البطاقات التي أخطأت فيها تعود غدًا، والباقي ينتظر مدة أطول. نراك غدًا."),
  "backToDeck": B("Back to my cards", "العودة إلى بطاقاتي"),
  "addTitle": B("Add a practice set", "إضافة مجموعة تدريب"),
  "addLabel": B("Academy", "الأكاديمية"),
  "addSet": B("Add {n} questions", "أضف {n} أسئلة"),
  "addNote": B("Published questions from the academy's bank that are not in your cards yet. Useful before a certification exam.", "أسئلة منشورة من بنك أسئلة الأكاديمية ليست ضمن بطاقاتك بعد. مفيدة قبل امتحان شهادة."),
  "added": B("{n} cards added — they are due today.", "تمت إضافة {n} بطاقة — مستحقة اليوم."),
  "addedNone": B("Every question of this academy is already in your cards.", "كل أسئلة هذه الأكاديمية موجودة في بطاقاتك بالفعل."),
  "deckTitle": B("All my cards ({n})", "كل بطاقاتي ({n})"),
  "dueOn": B("due {date}", "مستحقة {date}"),
  "remove": B("Remove", "إزالة"),
  "removeNamed": B("Remove card {id}", "إزالة البطاقة {id}"),
  "removed": B("Card removed.", "تمت إزالة البطاقة."),
  "honest": B("Review answers are practice: they never change an assessment score, a competency level or your passport.", "إجابات المراجعة للتدريب فقط: لا تغيّر درجة أي اختبار ولا مستوى أي جدارة ولا جواز السفر المهني."),
  "lessonAdded": B("Added to your daily review.", "أُضيف إلى مراجعتك اليومية."),
  "dueBadge": B("{n} review cards due today", "{n} بطاقة مراجعة مستحقة اليوم")
}
def flatten(d, p=""):
    for k, v in d.items():
        key = f"{p}.{k}" if p else k
        if isinstance(v, dict) and set(v) == {"en", "ar"}: yield key, v
        else: yield from flatten(v, key)
def tree(lang):
    def w(d): return {k: (v[lang] if isinstance(v, dict) and set(v) == {"en", "ar"} else w(v)) for k, v in d.items()}
    return w(S)
