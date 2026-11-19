# -*- coding: utf-8 -*-
"""Phase 16 interface strings ("cx16"): the certificate of completion and its verification page. Same keys and placeholders in AR/EN."""
def B(en, ar): return {"en": en, "ar": ar}
S = {
  "kind": B("Certificate of Completion", "شهادة إتمام"),
  "presented": B("This is to record that", "تشهد أكاديمية التحسين المستمر بأن"),
  "completed": B("has completed every lesson and passed the final assessment of the course", "قد أتمّ جميع دروس الدورة واجتاز اختبارها النهائي"),
  "completedLessons": B("has completed every lesson of the course", "قد أتمّ جميع دروس الدورة"),
  "covered": B("What the course covered", "ما غطّته الدورة"),
  "score": B("Final assessment", "الاختبار النهائي"),
  "signatory": B("Modather Salama", "مدثر سلامه"),
  "signRole": B("Founder, Continual Improvement Academy", "المؤسس — أكاديمية التحسين المستمر"),
  "sealLabel": B("Course seal {code}", "ختم الدورة {code}"),
  "qrLabel": B("QR code: open the verification page for this certificate", "رمز QR: افتح صفحة التحقق من هذه الشهادة"),
  "scan": B("Scan to verify", "امسح للتحقق"),
  "sealCode": B("Seal code", "رمز الختم"),
  "sheetLabel": B("Certificate of completion", "شهادة الإتمام"),
  "lede": B("Type your name as it should appear. Each course has its own certificate design; yours carries a serial, a seal code and a QR code anyone can scan to check it.", "اكتب اسمك كما تريد أن يظهر. لكل دورة تصميم شهادة خاص بها، وشهادتك تحمل رقمًا تسلسليًا ورمز ختم ورمز QR يستطيع أي شخص مسحه للتحقق منها."),
  "empty": B("Your certificate appears here once you type your name and press Make certificate.", "تظهر شهادتك هنا بعد كتابة اسمك والضغط على «إنشاء الشهادة»."),
  "update": B("Update certificate", "تحديث الشهادة"),
  "copyLink": B("Copy verification link", "نسخ رابط التحقق"),
  "copied": B("Verification link copied.", "تم نسخ رابط التحقق."),
  "openVerify": B("Open the verification page", "فتح صفحة التحقق"),
  "registered": B("Recorded in the Academy register on {date}. The verification page confirms the Academy issued it.", "مسجّلة في سجل الأكاديمية بتاريخ {date}. صفحة التحقق تؤكد أن الأكاديمية هي التي أصدرتها."),
  "signInToRegister": B("Sign in with your Academy account and press Update certificate to record it in the Academy register.", "سجّل الدخول بحساب الأكاديمية واضغط «تحديث الشهادة» لتسجيلها في سجل الأكاديمية."),
  "deviceOnly": B("Kept on this device. Its QR code proves the details were not changed after it was made; confirming the issuer needs the Academy register (accounts).", "محفوظة على هذا الجهاز. رمز QR يثبت أن البيانات لم تتغيّر بعد إنشائها؛ أما تأكيد الجهة المُصدِرة فيحتاج سجل الأكاديمية (الحسابات)."),
  "howVerify": B("Anyone can check this certificate: scan the QR code or open the verification page and type the serial.", "يستطيع أي شخص التحقق من هذه الشهادة: بمسح رمز QR أو بفتح صفحة التحقق وكتابة الرقم التسلسلي."),
  "v": {
    "eyebrow": B("Certificate verification", "التحقق من الشهادات"),
    "title": B("Verify a certificate", "التحقق من شهادة"),
    "lede": B("Scan the QR code on the certificate, or type its serial number.", "امسح رمز QR الموجود على الشهادة، أو اكتب رقمها التسلسلي."),
    "formNote": B("A serial alone can be checked only against the Academy register. The QR code also carries the certificate's details and seal.", "الرقم التسلسلي وحده يُتحقق منه فقط في سجل الأكاديمية. أما رمز QR فيحمل أيضًا بيانات الشهادة وختمها."),
    "otherSerial": B("Check another serial", "التحقق من رقم آخر"),
    "details": B("Certificate details", "بيانات الشهادة"),
    "checks": B("What was checked", "ما تم فحصه"),
    "name": B("Name", "الاسم"), "course": B("Course", "الدورة"), "academy": B("Academy", "الأكاديمية"),
    "form": {
      "label": B("Serial number", "الرقم التسلسلي"), "go": B("Verify", "تحقّق"),
      "malformed": B("This is not a CIA serial. It looks like CIA-C-ISO101-2611-QZBJWHV.", "هذا ليس رقمًا تسلسليًا للأكاديمية. شكله مثل CIA-C-ISO101-2611-QZBJWHV."),
      "typo": B("The last character does not match — please check the serial for a typing mistake.", "الحرف الأخير لا يطابق — راجع الرقم التسلسلي بحثًا عن خطأ في الكتابة.")
    },
    "verdict": {
      "registered": B("Issued by the Academy", "صادرة من الأكاديمية"),
      "intact": B("Details intact", "البيانات سليمة"),
      "revoked": B("Withdrawn by the Academy", "سحبتها الأكاديمية"),
      "differs": B("Details differ from the register", "البيانات تختلف عن السجل"),
      "altered": B("Changed after it was made", "عُدِّلت بعد إنشائها"),
      "mismatch": B("Details belong to another serial", "البيانات تخص رقمًا تسلسليًا آخر"),
      "typo": B("Serial has a typing mistake", "في الرقم التسلسلي خطأ كتابي"),
      "malformed": B("Not a CIA certificate link", "ليس رابط شهادة من الأكاديمية"),
      "missing": B("Serial only — no details to check", "رقم تسلسلي فقط — لا توجد بيانات للفحص"),
      "unknown": B("Not found in the Academy register", "غير موجودة في سجل الأكاديمية"),
      "legacy": B("Older certificate number", "رقم شهادة بالصيغة القديمة")
    },
    "body": {
      "registered": B("The Academy register holds this serial for the name, course and date below, and it is valid.", "سجل الأكاديمية يحتوي هذا الرقم التسلسلي بالاسم والدورة والتاريخ الموضحة أدناه، وهو ساري."),
      "intact": B("The details below match their seal and serial, so they were not edited after the certificate was made. This page cannot confirm who issued it: the Academy register is not switched on for this site.", "البيانات أدناه تطابق ختمها ورقمها التسلسلي، أي أنها لم تُعدَّل بعد إنشاء الشهادة. ولا تستطيع هذه الصفحة تأكيد الجهة المُصدِرة لأن سجل الأكاديمية غير مفعّل لهذا الموقع."),
      "revoked": B("The Academy register holds this serial but marks it as withdrawn. Do not rely on this certificate.", "سجل الأكاديمية يحتوي هذا الرقم لكنه مُعلَّم كمسحوب. لا تعتمد على هذه الشهادة."),
      "differs": B("The register holds this serial, but the name, course or date on the certificate are different. Ask the holder for the original.", "السجل يحتوي هذا الرقم، لكن الاسم أو الدورة أو التاريخ على الشهادة مختلف. اطلب من صاحبها النسخة الأصلية."),
      "altered": B("At least one detail (name, course, date, hours or score) no longer matches the seal. Do not rely on this certificate.", "تفصيل واحد على الأقل (الاسم أو الدورة أو التاريخ أو الساعات أو الدرجة) لم يعد يطابق الختم. لا تعتمد على هذه الشهادة."),
      "mismatch": B("The QR details were made for a different serial than the one in the address.", "بيانات رمز QR صُنعت لرقم تسلسلي غير الموجود في الرابط."),
      "typo": B("The serial's check character does not match. Re-type it from the certificate.", "حرف التحقق في الرقم التسلسلي لا يطابق. أعد كتابته من الشهادة."),
      "malformed": B("The link is incomplete or not from this Academy. Scan the QR code again.", "الرابط ناقص أو ليس من هذه الأكاديمية. امسح رمز QR مرة أخرى."),
      "missing": B("Without the QR details there is nothing to compare here, and the Academy register is not switched on for this site. Scan the certificate's QR code instead.", "بدون بيانات رمز QR لا يوجد ما يُقارَن هنا، وسجل الأكاديمية غير مفعّل لهذا الموقع. امسح رمز QR الموجود على الشهادة بدلًا من ذلك."),
      "unknown": B("The Academy register has no certificate with this serial.", "لا توجد في سجل الأكاديمية شهادة بهذا الرقم التسلسلي."),
      "legacy": B("This number uses the format from before November 2026 and carries no seal. Ask the holder to open the certificate again to get a new one with a QR code.", "هذا الرقم بالصيغة السابقة لنوفمبر 2026 ولا يحمل ختمًا. اطلب من صاحبها فتح الشهادة مرة أخرى للحصول على نسخة جديدة برمز QR.")
    },
    "check": {
      "seal": {
        "intact": B("Seal check: name, course, date, hours and score match the seal.", "فحص الختم: الاسم والدورة والتاريخ والساعات والدرجة تطابق الختم."),
        "altered": B("Seal check: the details do not match the seal.", "فحص الختم: البيانات لا تطابق الختم."),
        "mismatch": B("Seal check: the details belong to another serial.", "فحص الختم: البيانات تخص رقمًا تسلسليًا آخر."),
        "missing": B("Seal check: not run — the link carries no details.", "فحص الختم: لم يُجرَ — الرابط لا يحمل بيانات."),
        "typo": B("Seal check: not run — the serial has a typing mistake.", "فحص الختم: لم يُجرَ — في الرقم التسلسلي خطأ كتابي."),
        "malformed": B("Seal check: the details could not be read.", "فحص الختم: تعذّرت قراءة البيانات.")
      },
      "reg": {
        "valid": B("Academy register: issued on {date}, valid.", "سجل الأكاديمية: صادرة بتاريخ {date}، سارية."),
        "revoked": B("Academy register: withdrawn.", "سجل الأكاديمية: مسحوبة."),
        "none": B("Academy register: no certificate with this serial.", "سجل الأكاديمية: لا توجد شهادة بهذا الرقم."),
        "error": B("Academy register: could not be reached — try again later.", "سجل الأكاديمية: تعذّر الوصول إليه — حاول لاحقًا."),
        "off": B("Academy register: not switched on for this site, so the issuer cannot be confirmed here.", "سجل الأكاديمية: غير مفعّل لهذا الموقع، لذلك لا يمكن تأكيد الجهة المُصدِرة هنا.")
      },
      "device": B("This certificate was made on this device.", "هذه الشهادة أُنشئت على هذا الجهاز.")
    }
  }
}
def flatten(d, p=""):
    for k, v in d.items():
        key = f"{p}.{k}" if p else k
        if isinstance(v, dict) and set(v) == {"en", "ar"}: yield key, v
        else: yield from flatten(v, key)
def tree(lang):
    def w(d): return {k: (v[lang] if isinstance(v, dict) and set(v) == {"en", "ar"} else w(v)) for k, v in d.items()}
    return w(S)
