"""Readiness and standard diagnostics — original items; 'I don't know' is allowed in these assessments."""
from lib import question, opt as o

READINESS, DIAG = [], {"9001": [], "14001": [], "45001": [], "27001": []}


def rq(qid, comp, prompt, options, correct, expl, diff="medium", fmt="knowledge"):
    READINESS.append(question(qid, comp, prompt, options, correct, expl, difficulty=diff, fmt=fmt))


def dq(std, qid, comp, prompt, options, correct, expl, diff="medium", fmt="knowledge"):
    DIAG[std].append(question(qid, comp, prompt, options, correct, expl, difficulty=diff, fmt=fmt))


rq("Q-RD-01", "ISO-01", ("A supplier says its products are ‘ISO certified’. What is the precise issue with this claim?", "يقول مورد إن منتجاته «حاصلة على شهادة ISO». ما الخلل الدقيق في هذا الادعاء؟"),
   [o("ISO 9001 certifies a management system, not individual products", "شهادة ISO 9001 تخص نظام الإدارة لا المنتجات الفردية", "Correct: system certification is not product certification.", "صحيح: شهادة النظام ليست شهادة منتج."),
    o("Only government products can be certified", "لا تُعتمد إلا منتجات الحكومة", "Not true.", "غير صحيح."),
    o("ISO certificates expire after one month", "تنتهي شهادات ISO بعد شهر", "Not true.", "غير صحيح."),
    o("There is no issue", "لا يوجد خلل", "The claim confuses system and product.", "الادعاء يخلط بين النظام والمنتج.")], 0,
   ("Management-system certification attests the system; product conformity needs product certification or testing.", "تشهد شهادة نظام الإدارة على النظام، أما مطابقة المنتج فتحتاج إلى شهادة منتج أو اختبار."))
rq("Q-RD-02", "ISO-01", ("A requirement uses ‘should’ in a guidance standard. How do you treat it?", "يستخدم نص الصيغة «should» في مواصفة إرشادية. كيف تتعامل معه؟"),
   [o("As a mandatory requirement", "متطلب إلزامي", "‘Should’ is a recommendation.", "«should» توصية."),
    o("As a recommendation to consider, with a reason if not followed", "توصية تُدرس، ويُذكر سبب عدم اتباعها", "Correct.", "صحيح."),
    o("As irrelevant text", "نص غير ذي صلة", "Recommendations carry useful guidance.", "التوصيات تحمل إرشادًا مفيدًا."),
    o("As a permission", "إذن", "Permission is ‘may’.", "الإذن هو «may».")], 1,
   ("‘Should’ signals a recommendation; organizations can choose another effective approach.", "«should» تدل على توصية، ويمكن للمنظمة اختيار أسلوب آخر فعال."))
rq("Q-RD-03", "ISO-02", ("How much documented information should a small workshop keep?", "ما مقدار المعلومات الموثقة التي ينبغي أن تحتفظ بها ورشة صغيرة؟"),
   [o("A procedure for every clause", "إجراء لكل بند", "Clause-by-clause documents are not required.", "الوثائق بحسب البنود غير مطلوبة."),
    o("What the standard requires plus what the workshop needs for effective, consistent work", "ما تتطلبه المواصفة إضافة إلى ما تحتاجه الورشة لعمل فعال ومتسق", "Correct: proportionate to size, complexity and competence.", "صحيح: بما يتناسب مع الحجم والتعقيد والكفاءة."),
    o("Nothing; small organizations are exempt", "لا شيء؛ فالمنظمات الصغيرة معفاة", "No size exemption exists.", "لا يوجد إعفاء بحسب الحجم."),
    o("Whatever the consultant’s template contains", "كل ما في نماذج الاستشاري", "Templates must fit the organization.", "يجب أن تناسب النماذج المنظمة.")], 1,
   ("Documented information is proportionate: required items plus what the organization judges necessary.", "المعلومات الموثقة متناسبة: العناصر المطلوبة إضافة إلى ما تراه المنظمة ضروريًا."))
rq("Q-RD-04", "ISO-02", ("A process owner sets the objective ‘improve safety’. What is missing to manage it?", "وضع مالك عملية هدف «تحسين السلامة». ما الذي ينقصه ليُدار؟"),
   [o("A slogan and a poster", "شعار وملصق", "Awareness tools are not a measure.", "أدوات التوعية ليست مقياسًا."),
    o("Measure, target, owner, deadline and resources", "المقياس والقيمة المستهدفة والمالك والموعد والموارد", "Correct.", "صحيح."),
    o("Certification body approval", "موافقة جهة منح الشهادة", "Objectives are the organization’s.", "الأهداف تخص المنظمة."),
    o("Nothing", "لا شيء", "It cannot be tracked as written.", "لا يمكن متابعته بصيغته الحالية.")], 1,
   ("Objectives need measurable criteria, ownership, timing and resources.", "تحتاج الأهداف إلى معايير قابلة للقياس وملكية وتوقيت وموارد."))
rq("Q-RD-05", "AUD-01", ("Which area should a risk-based audit programme visit more often?", "أي مجال يجب أن يزوره برنامج التدقيق القائم على المخاطر أكثر؟"),
   [o("The office with the newest furniture", "المكتب ذو الأثاث الأحدث", "Irrelevant.", "غير ذي صلة."),
    o("A process with recent complaints, changes and high consequence", "عملية بها شكاوى حديثة وتغييرات وعواقب كبيرة", "Correct.", "صحيح."),
    o("The area audited last week with no issues", "مجال دُقق الأسبوع الماضي دون مشكلات", "Lower risk, lower frequency.", "مخاطر أقل وتكرار أقل."),
    o("Every area exactly the same", "كل المجالات بالتساوي تمامًا", "Ignores risk and results.", "يتجاهل المخاطر والنتائج.")], 1,
   ("Frequency and depth follow importance, risk, changes and previous results.", "يتبع التكرار والعمق الأهميةَ والمخاطر والتغييرات والنتائج السابقة."))
rq("Q-RD-06", "AUD-01", ("What must be defined before an audit starts?", "ما الذي يجب تحديده قبل بدء التدقيق؟"),
   [o("Objectives, scope and criteria", "الأهداف والنطاق والمعايير", "Correct.", "صحيح."),
    o("The findings", "النتائج", "Findings come from evidence.", "تنتج النتائج عن الأدلة."),
    o("The corrective actions", "الإجراءات التصحيحية", "They follow findings.", "تأتي بعد النتائج."),
    o("The auditee’s KPI targets", "قيم مؤشرات أداء الخاضع للتدقيق", "Not an audit-definition element.", "ليست عنصرًا في تعريف التدقيق.")], 0,
   ("An audit is defined by its objectives, scope and criteria.", "يُعرَّف التدقيق بأهدافه ونطاقه ومعاييره."))
rq("Q-RD-07", "AUD-02", ("Which is objective evidence?", "أي مما يلي دليل موضوعي؟"),
   [o("The supervisor’s assurance that checks are done", "تأكيد المشرف أن الفحوص تُجرى", "Assurance is not verified evidence.", "التأكيد ليس دليلًا متحققًا منه."),
    o("A signed inspection record for the batch you sampled", "سجل فحص موقّع للدفعة التي اخترتها عينة", "Correct: a verifiable record.", "صحيح: سجل قابل للتحقق."),
    o("The auditor’s feeling that the area is tidy", "شعور المدقق بأن المنطقة مرتبة", "Opinion.", "رأي."),
    o("A rumour from another department", "إشاعة من قسم آخر", "Not verifiable.", "غير قابل للتحقق.")], 1,
   ("Objective evidence is verifiable: records, observation, or statements confirmed by other sources.", "الدليل الموضوعي قابل للتحقق: سجلات أو ملاحظة أو أقوال مؤكدة بمصادر أخرى."))
rq("Q-RD-08", "AUD-02", ("You have 15 minutes to check 400 release records. What is best?", "لديك 15 دقيقة لفحص 400 سجل إفراج. ما الأفضل؟"),
   [o("Read the first five on the shelf", "اقرأ أول خمسة على الرف", "Convenience sample, biased.", "عينة مريحة متحيزة."),
    o("Select a small sample across dates, shifts and product types", "اختر عينة صغيرة عبر التواريخ والورديات وأنواع المنتجات", "Correct: a representative sample.", "صحيح: عينة ممثِّلة."),
    o("Skip the check", "تجاوز الفحص", "No evidence.", "لا دليل."),
    o("Ask the auditee to choose", "اطلب من الخاضع للتدقيق أن يختار", "Selection bias.", "تحيّز في الاختيار.")], 1,
   ("Sampling should be planned and representative of the population and its risks.", "يجب أن تكون العينة مخططة وممثِّلة للمجتمع ومخاطره."))
rq("Q-RD-09", "AUD-03", ("Which nonconformity statement is well written?", "أي صياغة لعدم المطابقة سليمة؟"),
   [o("Calibration is poor", "المعايرة سيئة", "Vague, no evidence.", "غامضة بلا دليل."),
    o("Gauge PG-07 used for release on 12 May was three weeks past its calibration due date, contrary to the requirement for verified measuring equipment", "المقياس PG-07 المستخدم في إفراج 12 مايو كان متجاوزًا موعد معايرته بثلاثة أسابيع، خلافًا لمتطلب معدات قياس متحقق منها", "Correct: requirement, evidence, gap.", "صحيح: متطلب ودليل وفجوة."),
    o("The QC manager is careless", "مدير الجودة مهمل", "Personal opinion.", "رأي شخصي."),
    o("Buy new gauges", "اشترِ مقاييس جديدة", "A recommendation, not a finding.", "توصية وليست ملاحظة.")], 1,
   ("A finding states the requirement, the objective evidence and the gap — without blame or solutions.", "تذكر الملاحظة المتطلب والدليل الموضوعي والفجوة، دون لوم أو حلول."))
rq("Q-RD-10", "RSK-01", ("What does risk-based thinking require of a small company?", "ماذا يتطلب التفكير القائم على المخاطر من شركة صغيرة؟"),
   [o("A full enterprise risk management system", "نظام كامل لإدارة المخاطر المؤسسية", "Not required by management system standards.", "لا تتطلبه مواصفات نظم الإدارة."),
    o("Determining the risks and opportunities that matter and acting proportionately", "تحديد المخاطر والفرص المهمة والتصرف بتناسب", "Correct.", "صحيح."),
    o("Nothing until something goes wrong", "لا شيء حتى يقع خطأ", "That is reactive.", "هذا تفاعل بعد الحدث."),
    o("Buying insurance", "شراء التأمين", "One treatment option only.", "خيار معالجة واحد فقط.")], 1,
   ("Actions should be proportionate to the potential effect on intended results.", "يجب أن تتناسب الإجراءات مع الأثر المحتمل على النتائج المقصودة."))

dq("9001", "Q-DG-9001-01", "ISO-01", ("What is the main purpose of a quality management system?", "ما الغرض الرئيسي من نظام إدارة الجودة؟"),
   [o("To produce a quality manual", "إعداد دليل للجودة", "A manual is a means, not the purpose.", "الدليل وسيلة لا غاية."),
    o("To consistently provide conforming products and services and enhance customer satisfaction", "تقديم منتجات وخدمات مطابقة باستمرار وتعزيز رضا العملاء", "Correct.", "صحيح."),
    o("To pass the certification audit", "اجتياز تدقيق الشهادة", "Certification is optional.", "الشهادة اختيارية."),
    o("To inspect every product", "فحص كل منتج", "Inspection is one control among many.", "الفحص ضابط من بين ضوابط كثيرة.")], 1,
   ("A QMS exists to deliver conforming outputs consistently and to improve customer satisfaction.", "يوجد نظام إدارة الجودة لتقديم مخرجات مطابقة باستمرار وتحسين رضا العملاء."))
dq("9001", "Q-DG-9001-02", "ISO-01", ("What does the process approach mean in practice?", "ماذا يعني نهج العمليات عمليًا؟"),
   [o("Writing one procedure per department", "كتابة إجراء لكل قسم", "Departments are not processes.", "الأقسام ليست عمليات."),
    o("Managing interrelated activities with inputs, outputs, owners, controls and measures", "إدارة الأنشطة المترابطة بمدخلات ومخرجات وملاك وضوابط ومقاييس", "Correct.", "صحيح."),
    o("Automating all activities", "أتمتة كل الأنشطة", "Automation is optional.", "الأتمتة اختيارية."),
    o("Focusing only on production", "التركيز على الإنتاج فقط", "Support and management processes count too.", "تُحسب عمليات الدعم والإدارة أيضًا.")], 1,
   ("The process approach links activities into a system with defined interactions, ownership and performance.", "يربط نهج العمليات الأنشطة في نظام بتفاعلات وملكية وأداء محددة."))
dq("9001", "Q-DG-9001-03", "ISO-02", ("A customer changes a drawing after the order is accepted. What must happen first?", "غيّر عميل رسمًا بعد قبول الطلب. ما الذي يجب أن يحدث أولًا؟"),
   [o("Continue production; the change can wait", "استمر في الإنتاج؛ يمكن للتغيير أن ينتظر", "Risk of nonconforming output.", "خطر مخرجات غير مطابقة."),
    o("Review and agree the change, update documents and inform affected people", "مراجعة التغيير والاتفاق عليه وتحديث الوثائق وإبلاغ المعنيين", "Correct.", "صحيح."),
    o("Tell only the salesperson", "أبلغ مندوب المبيعات فقط", "Production and QC must know.", "يجب أن يعلم الإنتاج وضبط الجودة."),
    o("Reject every change", "ارفض كل تغيير", "Changes are normal; control them.", "التغييرات طبيعية ويجب ضبطها.")], 1,
   ("Changed requirements are reviewed, documented and communicated before work proceeds.", "تُراجع المتطلبات المتغيرة وتوثق وتُبلغ قبل استمرار العمل."))
dq("9001", "Q-DG-9001-04", "QM-04", ("What best shows that an external provider is controlled?", "ما الذي يُظهر على أفضل وجه أن موردًا خارجيًا تحت السيطرة؟"),
   [o("A signed contract only", "عقد موقّع فقط", "A contract alone is not performance.", "العقد وحده ليس أداءً."),
    o("Defined criteria, performance monitoring and actions when performance drops", "معايير محددة ومتابعة أداء وإجراءات عند تراجعه", "Correct.", "صحيح."),
    o("A long relationship", "علاقة طويلة", "Duration is not evidence.", "طول المدة ليس دليلًا."),
    o("The lowest price", "أقل سعر", "Price is not control.", "السعر ليس ضبطًا.")], 1,
   ("Control of external providers combines selection criteria, monitoring and responses to performance.", "يجمع ضبط الموردين الخارجيين بين معايير الاختيار والمتابعة والاستجابة للأداء."))
dq("9001", "Q-DG-9001-05", "AUD-02", ("To test release control, which audit approach is strongest?", "لاختبار ضبط الإفراج، أي أسلوب تدقيق أقوى؟"),
   [o("Read the release procedure", "قراءة إجراء الإفراج", "Document only.", "وثيقة فقط."),
    o("Trace a sample of shipped orders back to inspection records, authority and equipment status", "تتبع عينة من الطلبات المشحونة إلى سجلات الفحص والصلاحية وحالة المعدات", "Correct: tests practice.", "صحيح: يختبر الممارسة."),
    o("Ask the QC manager if releases are controlled", "اسأل مدير الجودة هل الإفراج مضبوط", "Assurance only.", "تأكيد فقط."),
    o("Count the number of inspectors", "عدّ المفتشين", "Not evidence of control.", "ليس دليل ضبط.")], 1,
   ("Tracing real outputs through records tests whether the control works.", "تتبع المخرجات الفعلية عبر السجلات يختبر عمل الضابط."), diff="hard")
dq("9001", "Q-DG-9001-06", "QM-03", ("A complaint was closed three times with ‘operator retrained’. What is your judgment?", "أُغلقت شكوى ثلاث مرات بإجراء «أُعيد تدريب المشغّل». ما حكمك؟"),
   [o("Acceptable; training is always the fix", "مقبول؛ التدريب هو الحل دائمًا", "Recurrence shows otherwise.", "التكرار يدل على العكس."),
    o("The root cause was probably not found; corrective-action effectiveness is not demonstrated", "على الأرجح لم يُحدد السبب الجذري، ولم تثبت فاعلية الإجراء التصحيحي", "Correct.", "صحيح."),
    o("The customer is wrong", "العميل مخطئ", "No basis.", "لا أساس لذلك."),
    o("Close it a fourth time", "أغلقها للمرة الرابعة", "Repeats the failure.", "يكرر الإخفاق.")], 1,
   ("Recurrence after closure is evidence the cause was not removed.", "التكرار بعد الإغلاق دليل على أن السبب لم يُزل."), diff="hard", fmt="judgment")

dq("14001", "Q-DG-14001-01", "ISO-01", ("Which pair is an environmental aspect and its impact?", "أي زوج يمثل جانبًا بيئيًا وأثره؟"),
   [o("Diesel generator emissions → air pollution", "انبعاثات مولد الديزل ← تلوث الهواء", "Correct: activity element → change to the environment.", "صحيح: عنصر النشاط ← التغير في البيئة."),
    o("Air pollution → diesel generator", "تلوث الهواء ← مولد الديزل", "Reversed.", "معكوس."),
    o("ISO 14001 → certificate", "ISO 14001 ← شهادة", "Unrelated.", "غير ذي صلة."),
    o("Budget → cost", "الميزانية ← التكلفة", "Not environmental.", "ليس بيئيًا.")], 0,
   ("An aspect is the element of an activity that interacts with the environment; the impact is the resulting change.", "الجانب عنصر في النشاط يتفاعل مع البيئة، والأثر هو التغير الناتج."))
dq("14001", "Q-DG-14001-02", "CMP-01", ("What are compliance obligations in an EMS?", "ما الالتزامات الواجبة في نظام الإدارة البيئية؟"),
   [o("Only national laws", "القوانين الوطنية فقط", "Too narrow.", "ضيق جدًا."),
    o("Legal requirements and other requirements the organization must or chooses to comply with", "المتطلبات القانونية والمتطلبات الأخرى التي يجب أو تختار المنظمة الالتزام بها", "Correct.", "صحيح."),
    o("The certification body’s rules", "قواعد جهة منح الشهادة", "Not compliance obligations.", "ليست التزامات واجبة."),
    o("Voluntary targets only", "أهداف طوعية فقط", "Too narrow.", "ضيق جدًا.")], 1,
   ("Compliance obligations include legal requirements and other requirements adopted (permits, contracts, commitments).", "تشمل الالتزامات الواجبة المتطلبات القانونية والمتطلبات الأخرى المتبناة (التصاريح والعقود والتعهدات)."))
dq("14001", "Q-DG-14001-03", "ISO-02", ("Chemical drums are stored on bare ground near a drain. What is the best operational control?", "تُخزّن براميل كيميائية على أرض مكشوفة قرب مصرف. ما أفضل ضابط تشغيلي؟"),
   [o("A sign saying ‘be careful’", "لافتة «انتبه»", "Weak control.", "ضابط ضعيف."),
    o("Bunded storage away from drains, a spill kit, an inspection routine and trained handlers", "تخزين بحاجز احتواء بعيدًا عن المصارف، وعدة انسكاب، وجولات فحص، ومناولون مدربون", "Correct: engineering plus procedural controls.", "صحيح: ضوابط هندسية وإجرائية."),
    o("Move the drums at night", "انقل البراميل ليلًا", "Hides, doesn’t control.", "يخفي ولا يضبط."),
    o("Write a policy statement", "اكتب بيان سياسة", "Not an operational control.", "ليس ضابطًا تشغيليًا.")], 1,
   ("Controls should prevent the impact at source and be checked routinely.", "يجب أن تمنع الضوابطُ الأثرَ من المصدر وتُفحص دوريًا."))
dq("14001", "Q-DG-14001-04", "ISO-01", ("What does a life-cycle perspective ask an organization to consider?", "ماذا يطلب منظور دورة الحياة من المنظمة أن تراعيه؟"),
   [o("Only its own site emissions", "انبعاثات موقعها فقط", "Too narrow.", "ضيق جدًا."),
    o("Stages it can control or influence, such as purchasing, design, transport and end-of-life", "المراحل التي يمكنها ضبطها أو التأثير فيها مثل الشراء والتصميم والنقل ونهاية العمر", "Correct.", "صحيح."),
    o("A full life-cycle assessment study", "دراسة كاملة لتقييم دورة الحياة", "Not required.", "غير مطلوبة."),
    o("Employee life events", "أحداث حياة الموظفين", "Unrelated.", "غير ذي صلة.")], 1,
   ("The perspective covers stages the organization can control or influence; a formal LCA is not required.", "يتعلق المنظور بالمراحل التي تضبطها المنظمة أو تؤثر فيها، ولا تُطلب دراسة تقييم دورة حياة رسمية."))
dq("14001", "Q-DG-14001-05", "AUD-02", ("How do you audit the evaluation of compliance?", "كيف تدقق تقييم الامتثال؟"),
   [o("Ask if the company obeys the law", "اسأل هل تلتزم الشركة بالقانون", "Assurance only.", "تأكيد فقط."),
    o("Sample obligations (for example a permit limit) and check monitoring data, evaluation records and actions on exceedances", "خذ عينة من الالتزامات (مثل حد في تصريح) وافحص بيانات الرصد وسجلات التقييم والإجراءات عند التجاوز", "Correct.", "صحيح."),
    o("Read the legal register only", "اقرأ سجل المتطلبات القانونية فقط", "A register is not an evaluation.", "السجل ليس تقييمًا."),
    o("Check the environmental policy", "افحص السياسة البيئية", "Indirect.", "غير مباشر.")], 1,
   ("Compliance evaluation is tested by tracing specific obligations to results and responses.", "يُختبر تقييم الامتثال بتتبع التزامات محددة حتى النتائج والاستجابات."), diff="hard")
dq("14001", "Q-DG-14001-06", "RSK-02", ("A spill drill revealed the kit was empty. What is the right judgment?", "كشف تمرين انسكاب أن عدة الانسكاب فارغة. ما الحكم الصحيح؟"),
   [o("The drill passed because people attended", "نجح التمرين لأن الأشخاص حضروا", "Attendance is not readiness.", "الحضور ليس جاهزية."),
    o("The response is not ready: correct it, find why checks missed it and retest", "الاستجابة غير جاهزة: صحّح، وابحث لماذا لم تكتشفه الفحوص، وأعد الاختبار", "Correct.", "صحيح."),
    o("Ignore it; spills are rare", "تجاهل؛ الانسكابات نادرة", "Rare is not impossible.", "النادر ليس مستحيلًا."),
    o("Cancel future drills", "ألغِ التمارين القادمة", "Removes a key check.", "يلغي فحصًا مهمًا.")], 1,
   ("Tests of emergency preparedness exist to find such gaps and drive correction.", "توجد اختبارات الاستعداد للطوارئ لاكتشاف مثل هذه الفجوات وتصحيحها."), fmt="judgment")

dq("45001", "Q-DG-45001-01", "ISO-01", ("What distinguishes worker participation from consultation?", "ما الذي يميز مشاركة العاملين عن التشاور معهم؟"),
   [o("Nothing; they are the same", "لا شيء، هما الشيء نفسه", "They differ in depth.", "يختلفان في العمق."),
    o("Consultation seeks views before decisions; participation involves workers in decision-making", "التشاور طلب آراء قبل القرار، والمشاركة إشراك العاملين في صنع القرار", "Correct.", "صحيح."),
    o("Participation means attending training", "المشاركة تعني حضور التدريب", "Too narrow.", "ضيق جدًا."),
    o("Consultation is only for managers", "التشاور للمديرين فقط", "It is for workers.", "التشاور للعاملين.")], 1,
   ("Both are expected; participation goes further than seeking views.", "كلاهما متوقع، والمشاركة أبعد من طلب الآراء."))
dq("45001", "Q-DG-45001-02", "RSK-02", ("Which control is highest in the hierarchy for work at height?", "أي ضابط هو الأعلى في التسلسل الهرمي للعمل على ارتفاع؟"),
   [o("Harness", "حزام أمان", "PPE is the last line.", "معدات الوقاية آخر خط."),
    o("Warning sign", "لافتة تحذير", "Administrative.", "إداري."),
    o("Eliminate the need by assembling at ground level", "إلغاء الحاجة بالتجميع على مستوى الأرض", "Correct: elimination.", "صحيح: الإزالة."),
    o("Training", "التدريب", "Administrative.", "إداري.")], 2,
   ("Elimination and substitution come before engineering, administrative controls and PPE.", "تأتي الإزالة والاستبدال قبل الضوابط الهندسية والإدارية ومعدات الوقاية."))
dq("45001", "Q-DG-45001-03", "ISO-02", ("A new solvent will replace the current one. Which OH&S control applies?", "سيحل مذيب جديد محل الحالي. أي ضابط سلامة ينطبق؟"),
   [o("None until an incident", "لا شيء حتى يقع حادث", "Reactive.", "تفاعلي."),
    o("Management of change: assess hazards and risks before introduction", "إدارة التغيير: تقييم المخاطر قبل الإدخال", "Correct.", "صحيح."),
    o("Let purchasing decide", "دع المشتريات تقرر", "OH&S input is needed.", "يلزم رأي السلامة."),
    o("Change the label only", "غيّر الملصق فقط", "Insufficient.", "غير كافٍ.")], 1,
   ("Planned changes are assessed for OH&S hazards and risks before implementation.", "تُقيَّم التغييرات المخططة من حيث مخاطر السلامة قبل التنفيذ."))
dq("45001", "Q-DG-45001-04", "ISO-02", ("How should contractor OH&S risks be controlled?", "كيف تُضبط مخاطر السلامة الخاصة بالمقاولين؟"),
   [o("It is the contractor’s problem", "هذه مشكلة المقاول", "The host organization shares responsibility.", "المنظمة المضيفة تشارك المسؤولية."),
    o("Selection criteria, coordination of hazards, permits and monitoring on site", "معايير اختيار وتنسيق للمخاطر وتصاريح ومتابعة في الموقع", "Correct.", "صحيح."),
    o("A contract clause only", "بند في العقد فقط", "Paper control only.", "ضبط ورقي فقط."),
    o("Ban contractors", "منع المقاولين", "Unrealistic.", "غير واقعي.")], 1,
   ("Procurement and contractor controls coordinate hazards across organizations.", "تنسّق ضوابط الشراء والمقاولين المخاطر بين المنظمات."))
dq("45001", "Q-DG-45001-05", "QM-03", ("An investigation concludes ‘worker was careless’. What is your judgment?", "انتهى تحقيق إلى أن «العامل كان مهملًا». ما حكمك؟"),
   [o("Complete; discipline the worker", "مكتمل؛ عاقب العامل", "Stops at blame.", "يتوقف عند اللوم."),
    o("Incomplete; look for system causes such as task design, supervision and controls", "غير مكتمل؛ ابحث عن أسباب نظامية مثل تصميم المهمة والإشراف والضوابط", "Correct.", "صحيح."),
    o("Close it; it was minor", "أغلقه؛ كان بسيطًا", "Potential severity matters.", "الشدة المحتملة مهمة."),
    o("Report to the insurer only", "أبلغ شركة التأمين فقط", "Not an investigation.", "ليس تحقيقًا.")], 1,
   ("Blame conclusions hide system causes; corrective action must address them.", "استنتاجات اللوم تخفي الأسباب النظامية، ويجب أن يعالجها الإجراء التصحيحي."), diff="hard", fmt="judgment")
dq("45001", "Q-DG-45001-06", "AUD-02", ("What is the best evidence that a permit-to-work system works?", "ما أفضل دليل على أن نظام تصاريح العمل يعمل؟"),
   [o("The permit procedure document", "وثيقة إجراء التصاريح", "Document only.", "وثيقة فقط."),
    o("Observing a live job and checking its permit, isolations and sign-offs", "ملاحظة عمل جارٍ وفحص تصريحه والعزل والتوقيعات", "Correct.", "صحيح."),
    o("A training attendance list", "قائمة حضور التدريب", "Indirect.", "غير مباشر."),
    o("The manager’s statement", "إفادة المدير", "Assurance only.", "تأكيد فقط.")], 1,
   ("Field observation combined with records tests real implementation.", "الملاحظة الميدانية مع السجلات تختبر التطبيق الفعلي."), diff="hard")

dq("27001", "Q-DG-27001-01", "ISA-01", ("Information security protects which three properties?", "يحمي أمن المعلومات أي ثلاث خصائص؟"),
   [o("Cost, speed and quality", "التكلفة والسرعة والجودة", "Project triangle.", "مثلث المشروع."),
    o("Confidentiality, integrity and availability", "السرية والسلامة والإتاحة", "Correct.", "صحيح."),
    o("Hardware, software and network", "العتاد والبرمجيات والشبكة", "Assets, not properties.", "أصول لا خصائص."),
    o("Policy, procedure and record", "سياسة وإجراء وسجل", "Documents.", "وثائق.")], 1,
   ("The ISMS protects the confidentiality, integrity and availability of information.", "يحمي نظام إدارة أمن المعلومات سرية المعلومات وسلامتها وإتاحتها."))
dq("27001", "Q-DG-27001-02", "ISO-02", ("How should controls in the Statement of Applicability be decided?", "كيف تُحدد الضوابط في بيان قابلية التطبيق؟"),
   [o("Implement every Annex A control", "طبّق كل ضوابط الملحق (أ)", "Controls follow risk treatment.", "الضوابط تتبع معالجة المخاطر."),
    o("From the risk treatment plan, with justification for inclusions and exclusions", "من خطة معالجة المخاطر، مع تبرير الإدراج والاستبعاد", "Correct.", "صحيح."),
    o("Copy another company’s SoA", "انسخ بيان شركة أخرى", "Context differs.", "السياق مختلف."),
    o("Let the IT vendor choose", "دع مورد تقنية المعلومات يختار", "Ownership is lost.", "تضيع الملكية.")], 1,
   ("The SoA records controls needed by risk treatment and justifies inclusions and exclusions.", "يسجل البيان الضوابط التي تتطلبها معالجة المخاطر ويبرر الإدراج والاستبعاد."))
dq("27001", "Q-DG-27001-03", "ISA-01", ("What shows that access rights are controlled?", "ما الذي يُظهر أن صلاحيات الوصول مضبوطة؟"),
   [o("A strong password policy document", "وثيقة سياسة كلمات مرور قوية", "Document only.", "وثيقة فقط."),
    o("Periodic access reviews with removals for leavers and role changes", "مراجعات دورية للصلاحيات مع إزالة صلاحيات المغادرين ومتغيري الأدوار", "Correct.", "صحيح."),
    o("Everyone has admin rights for speed", "صلاحيات مسؤول للجميع لتسريع العمل", "The opposite of control.", "عكس الضبط."),
    o("IT says it is fine", "يقول قسم التقنية إن الأمر سليم", "Assurance only.", "تأكيد فقط.")], 1,
   ("Access control is shown by reviews and timely removal, not by policy alone.", "يظهر ضبط الوصول بالمراجعات والإزالة في الوقت المناسب، لا بالسياسة وحدها."))
dq("27001", "Q-DG-27001-04", "ISA-02", ("An employee clicked a phishing link. What should happen?", "نقر موظف على رابط تصيّد. ماذا يجب أن يحدث؟"),
   [o("Hide it to avoid embarrassment", "إخفاؤه لتجنب الإحراج", "Delays response.", "يؤخر الاستجابة."),
    o("Report promptly through the incident channel so it can be assessed and contained", "الإبلاغ فورًا عبر قناة الحوادث لتقييمه واحتوائه", "Correct.", "صحيح."),
    o("Delete the email and continue", "احذف الرسالة وتابع", "Loses evidence.", "يضيع الدليل."),
    o("Change the desktop wallpaper", "غيّر خلفية الشاشة", "Irrelevant.", "غير ذي صلة.")], 1,
   ("Prompt reporting enables assessment, containment and learning.", "الإبلاغ الفوري يتيح التقييم والاحتواء والتعلم."))
dq("27001", "Q-DG-27001-05", "AUD-02", ("How do you audit leaver access removal?", "كيف تدقق إزالة صلاحيات المغادرين؟"),
   [o("Read the HR policy", "اقرأ سياسة الموارد البشرية", "Document only.", "وثيقة فقط."),
    o("Sample recent leavers from HR and check their account status and removal dates in the systems", "خذ عينة من المغادرين حديثًا من الموارد البشرية وافحص حالة حساباتهم وتواريخ الإزالة في الأنظمة", "Correct.", "صحيح."),
    o("Ask IT to confirm", "اطلب تأكيد التقنية", "Assurance only.", "تأكيد فقط."),
    o("Check the firewall model", "افحص طراز الجدار الناري", "Unrelated.", "غير ذي صلة.")], 1,
   ("Comparing two independent sources (HR and system records) produces objective evidence.", "مقارنة مصدرين مستقلين (الموارد البشرية وسجلات الأنظمة) تنتج دليلًا موضوعيًا."), diff="hard")
dq("27001", "Q-DG-27001-06", "ISO-01", ("A company excludes physical security controls because ‘we use the cloud’. What is your judgment?", "تستبعد شركة ضوابط الأمن المادي لأنها «تستخدم السحابة». ما حكمك؟"),
   [o("Always acceptable", "مقبول دائمًا", "Offices and devices still exist.", "المكاتب والأجهزة لا تزال موجودة."),
    o("Questionable: exclusions need justification against actual risks such as offices, laptops and media", "مشكوك فيه: الاستبعاد يحتاج تبريرًا مقابل مخاطر فعلية مثل المكاتب والحواسيب والوسائط", "Correct.", "صحيح."),
    o("Required by the standard", "تتطلبه المواصفة", "No such requirement.", "لا يوجد هذا المتطلب."),
    o("Irrelevant to the SoA", "غير متعلق بالبيان", "It is exactly the SoA’s purpose.", "هذا بالضبط غرض البيان.")], 1,
   ("Exclusions must be justified by the risk assessment, not by a general assumption.", "يجب تبرير الاستبعاد بتقييم المخاطر، لا بافتراض عام."), diff="hard", fmt="judgment")
