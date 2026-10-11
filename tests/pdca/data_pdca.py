import json
def B(ar,en): return {"ar":ar,"en":en}
def L(ar,en): return B(ar,en)

meta={
 "code":"PDCA",
 "name":B("PDCA — دورة التحسين المستمر","PDCA — Plan-Do-Check-Act"),
 "edition":B("أداة منهجية، وليست شهادة","Method tool, not a certification standard"),
 "status":B("أداة الصندوق الأولى","First tool in the Toolbox"),
 "cert":False,
 "certNote":B("PDCA منهجية إدارة وليست مواصفة للشهادة. المرجع الرسمي لدورتها في المنصة هو ISO 9001:2026 البند 0.3.2.","PDCA is a management method, not a certification standard. Its formal reference in the platform is ISO 9001:2026 clause 0.3.2."),
 "verified":B("المصدر: ISO 9001:2026 البند 0.3.2 والبند 10.2 (نص مُعاد صياغته، وليس منقولاً). التحقق: 2026-10-10.","Source: ISO 9001:2026 clauses 0.3.2 and 10.2 (paraphrased, not copied). Verified: 2026-10-10.")
}

std={
 "purpose":B("PDCA دورة إدارة متكررة: تخطط لتغيير صغير ومحدد، تنفّذه، تقيس أثره، ثم تقرر تثبيته أو تعديله وتبدأ دورة جديدة. الغرض أن يتحول التحسين من مبادرات متفرقة إلى عمل منضبط ومتكرر.",
   "PDCA is a repeating management method: plan a small, specific change, carry it out, measure its effect, then decide whether to keep it, adjust it or start a new cycle. Its purpose is to turn improvement from scattered initiatives into a disciplined, repeatable routine."),
 "who":B("مالكو العمليات، وفرق التحسين، ومديرو الجودة وHSE، والمدققون الذين يتحققون من أن التحسين موثّق ومقاس.",
   "Process owners, improvement teams, quality and HSE managers, and auditors who check that improvement is documented and measured."),
 "rolesSub":B("","") ,
 "roles":[],
 "map":[
  {"no":"P","t":B("التخطيط","Plan"),"d":B("حدّد المشكلة والهدف، وحلّل الأسباب، ثم خطّط الإجراءات والمخاطر.","Define the problem and target, analyse causes, then plan actions and risks."),"go":"PL1","goL":B("اشرح PL1","Explain PL1")},
  {"no":"D","t":B("التنفيذ","Do"),"d":B("نفّذ الخطة كما كُتبت، وسجّل الانحرافات، واحتفظ بالدليل.","Carry out the plan as written, record deviations and keep evidence."),"go":"DO1","goL":B("اشرح DO1","Explain DO1")},
  {"no":"C","t":B("التحقق","Check"),"d":B("قِس النتيجة بالطريقة نفسها، وتحقق من التنفيذ ومن الأثر.","Measure the result the same way, and check implementation and effect."),"go":"CK1","goL":B("اشرح CK1","Explain CK1")},
  {"no":"A","t":B("التصرف","Act"),"d":B("ثبّت ما نجح أو عدّل الخطة، وأغلق الدورة واربطها بسجلها الأصلي.","Standardise what worked or adjust the plan, then close the cycle and link it to its origin."),"go":"AC1","goL":B("اشرح AC1","Explain AC1")}
 ],
 "rel":[
  {"code":"CAPA","n":B("إجراء تصحيحي (CAPA)","Corrective action (CAPA)"),"col":"#C2410C","d":B("عندما تبدأ الدورة من عدم مطابقة، يصبح سجل CAPA هو المرجع الذي تُغلق به الدورة (البند 10.2).","When a cycle starts from a nonconformity, the CAPA record is the reference that closes it (clause 10.2)."),"tool":""},
  {"code":"RCA","n":B("تحليل السبب الجذري","Root cause analysis"),"col":"#3563C9","d":B("يغذّي مرحلة التخطيط بالأسباب المرجّحة. أدوات الصندوق: 5 Whys وFishbone وPareto.","Feeds the planning stage with likely causes. Toolbox tools: 5 Whys, Fishbone, Pareto."),"tool":""},
  {"code":"ISO 9001","n":B("نظام إدارة الجودة","Quality management system"),"col":"#1B2A4A","d":B("PDCA هو البنية التي تقوم عليها متطلبات البنود 4 إلى 10 في المواصفة.","PDCA is the structure on which clauses 4 to 10 of the standard are arranged."),"tool":""}
 ],
 "comp":[
  {"code":"ISO 9001:2026 §0.3.2","n":B("دورة PDCA","PDCA cycle"),"d":B("وصف الدورة للعمليات والنظام ككل، وربطها بالبنود 4 إلى 10.","Describes the cycle for processes and for the whole system, linked to clauses 4 to 10.")},
  {"code":"ISO 9001:2026 §10.2","n":B("عدم المطابقة والإجراء التصحيحي","Nonconformity and corrective action"),"d":B("مراجعة عدم المطابقة، وتحديد أسبابها، وتنفيذ الإجراء، ومراجعة فعاليته، وتحديث المخاطر عند الحاجة.","Review the nonconformity, determine causes, implement action, review its effectiveness and update risks where needed.")}
 ],
 "buy":[],
 "buyNote":B("للنص الرسمي للمواصفة استخدم النسخة المنشورة من المنظمة الدولية للتوحيد القياسي، وليس هذه المنصة.","For the official text of the standard, use the copy published by the International Organization for Standardization, not this platform.")
}

texts={
 "stdT":B("الشرح العام","Overview"),
 "stdS":B("ماذا تعني PDCA، ومن يستخدمها، وكيف ترتبط بالمنظومة.","What PDCA means, who uses it and how it connects to the system."),
 "clT":B("شرح الخطوات","Step-by-step guide"),
 "clS":B("كل خطوة بمتطلبها وأمثلة وأدلة يطلبها المدقق. الأمثلة توضيحية وليست بيانات حقيقية.","Each step with its requirement, examples and the evidence an auditor asks for. Examples are illustrative, not real data."),
 "note":B("الفرق بين التعريف والإرشاد: ما يلي في «المتطلب» تعريف مأخوذ من المنهجية، وما في «كيف تطبقه» و«الفجوات» إرشاد تطبيقي من خبرة الكاتب وليس نصاً معيارياً.","Definition vs guidance: the “requirement” text describes the method; “how to implement” and “common gaps” are practical guidance from the author's experience, not normative text."),
 "chgT":B("ما الذي تغيّر","What changed"),
 "chgS":B("","")
}

phases={
 "plan":{"c":"#1E8C93","t":"#E3F4F4","n":B("التخطيط","Plan")},
 "support":{"c":"#3563C9","t":"#E7EEFB","n":B("التنفيذ","Do")},
 "check":{"c":"#C9821A","t":"#FCF1DE","n":B("التحقق","Check")},
 "act":{"c":"#3C9A5F","t":"#E5F4EA","n":B("التصرف","Act")}
}

def item(c,t,r,x,h,e,g,owner,kpi):
    return {"c":c,"q":"","t":t,"r":r,"x":x,"h":h,"e":e,"g":g,"owner":owner,"kpi":kpi}

sections=[
 {"id":"P","grp":"cycle","t":B("التخطيط — Plan","Plan"),"sh":B("Plan · التخطيط","Plan · Plan"),
  "p":B("قبل أي تغيير، تحدد ما المشكلة، وما الهدف، ولماذا تحدث، وماذا ستفعل ومن يتولى ماذا.","Before any change, define the problem, the target, why it happens, what you will do and who owns what."),
  "ph":"plan","col":"#1E8C93","tint":"#E3F4F4","fl":[B("المرحلة 1 من 4","Stage 1 of 4")],
  "it":[
   item("PL1",B("حدّد المشكلة والهدف القابل للقياس","Define the problem and a measurable target"),
     B("صِغ المشكلة كما تُلاحظ: ما الذي يحدث، أين، ومنذ متى. ثم حدّد هدفاً يمكن قياسه مقابل خط أساس (baseline) واضح، حتى تعرف لاحقاً إن كان الوضع قد تحسّن فعلاً.",
       "State the problem as observed: what happens, where and since when. Then set a target you can measure against a clear baseline, so you can later tell whether things actually improved."),
     B("مثال توضيحي، وليس بيانات حقيقية: «تأخر إرجاع الاعتمادات الفنية عن الموعد المتفق عليه في الربع الأخير، والخط الأساس يُحسب من سجل الاعتمادات نفسه».",
       "Illustrative example, not real data: “Technical submittals returned after the agreed date in the last quarter; the baseline is counted from the submittals register itself.”"),
     [B("اجمع بيانات الخط الأساس من سجل موجود، لا من الذاكرة","Take baseline data from an existing record, not from memory"),
      B("عرّف الهدف بوحدة قياس ومدة وطريقة حساب","Define the target with a unit, a period and a calculation method"),
      B("اكتب نطاق الدورة: ما الذي يشمله وما الذي لا يشمله","Write the cycle scope: what is included and what is not")],
     [B("وصف المشكلة مع مصدر البيانات","Problem statement with the data source"),
      B("سجل الخط الأساس وطريقة حسابه","Baseline record and how it was calculated"),
      B("الهدف مكتوباً بوحدة القياس","Target written with its unit")],
     [B("هدف عام مثل «تحسين الأداء» بلا مقياس","A general goal such as “improve performance” with no measure"),
      B("خط أساس مقدّر من الذاكرة","A baseline estimated from memory"),
      B("مشكلة مكتوبة كحل مقنّع، مثل «نحتاج برنامجاً جديداً»","A problem written as a disguised solution, such as “we need a new system”")],
     B("مالك العملية","Process owner"),B("نسبة الدورات التي لها هدف وخط أساس مسجّلان","Share of cycles with a recorded target and baseline")),
   item("PL2",B("حلّل الأسباب قبل اختيار الحل","Analyse causes before choosing a fix"),
     B("ابحث عن السبب الجذري أو الأسباب المرجّحة قبل اقتراح الإجراء. استخدم أدوات التحليل في الصندوق (5 Whys وFishbone وPareto) وسجّل ما استخدمته.",
       "Look for the root cause or the most likely causes before proposing an action. Use the toolbox analysis tools (5 Whys, Fishbone, Pareto) and record which ones you used."),
     B("إذا تكرر التأخير عند مرحلة المراجعة الداخلية، فالسؤال هو: لماذا تتوقف الاعتمادات هناك؟ وليس: كيف نُسرّع الموظفين؟",
       "If delays repeat at the internal review stage, ask why submittals stop there, not how to make people work faster."),
     [B("اختر أداة تحليل تناسب المشكلة وسجّل سببها","Pick an analysis tool that fits the problem and record why"),
      B("فرّق بين السبب وأعراضه بسؤال «لماذا» متكرر","Separate the cause from its symptoms by asking “why” repeatedly"),
      B("ارجع إلى البيانات: هل السبب يظهر فعلاً فيها؟","Go back to the data: does the cause actually appear in it?")],
     [B("مخرجات أداة التحليل محفوظة","Analysis tool output saved"),
      B("أدلة تدعم السبب المرجّح","Evidence supporting the likely cause")],
     [B("اختيار الحل قبل التحليل","Choosing the fix before analysing"),
      B("سبب مكتوب دون دليل","A cause written without evidence"),
      B("الاكتفاء بالسبب المباشر دون السؤال عن سببه","Stopping at the direct cause without asking what caused it")],
     B("فريق التحسين","Improvement team"),B("عدد الأسباب المحدّدة بدليل","Causes identified with evidence")),
   item("PL3",B("خطّط الإجراءات والمخاطر والموارد","Plan actions, owners, resources and risks"),
     B("لكل إجراء: مسؤول واضح، وتاريخ بداية وتاريخ استحقاق، والموارد المطلوبة، وما قد يعيق التنفيذ. ومعالجة المخاطر والفرص المرتبطة بالتغيير جزء من التخطيط وليست ملحقاً له.",
       "For each action: a clear owner, start and due dates, the resources needed and what could block it. Addressing the risks and opportunities linked to the change is part of planning, not an add-on."),
     B("إجراء «تدريب المراجعين على نموذج الاعتماد» مالكه مدير الهندسة، يبدأ الأسبوع القادم، ويستحق قبل نهاية الشهر، ويعيقه غياب المراجع الرئيسي في الإجازات.",
       "Action “train reviewers on the submittal form”: owner is the engineering manager, starts next week, due before month end, and could be blocked by the lead reviewer's leave."),
     [B("اكتب الإجراء بفعل محدد ومُنجَز","Write each action as a specific, completable task"),
      B("اربط كل إجراء بسبب من PL2","Link each action to a cause from PL2"),
      B("سجّل المخاطر التي قد تعيق التنفيذ وطريقة معالجتها","Record the risks that could block it and how to handle them")],
     [B("خطة إجراءات بمالك وتواريخ","Action plan with owners and dates"),
      B("سجل مخاطر الدورة","Cycle risk log")],
     [B("إجراءات عامة بلا مالك أو موعد","General actions with no owner or date"),
      B("تجاهل المخاطر والفرص المرتبطة بالتغيير","Ignoring the risks and opportunities linked to the change")],
     B("صاحب العملية","Process owner"),B("نسبة الإجراءات التي لها مالك وتاريخ","Share of actions with an owner and a due date"))
  ]},
 {"id":"D","grp":"cycle","t":B("التنفيذ — Do","Do"),"sh":B("Do · التنفيذ","Do · Do"),
  "p":B("نفّذ ما خُطط له، وسجّل ما تغيّر أثناء التنفيذ، واجمع الدليل وأنت تعمل.","Carry out what was planned, record what changed during the work, and collect evidence as you go."),
  "ph":"support","col":"#3563C9","tint":"#E7EEFB","fl":[B("المرحلة 2 من 4","Stage 2 of 4")],
  "it":[
   item("DO1",B("نفّذ الخطة كما كُتبت وسجّل الانحرافات","Carry out the plan as written and record deviations"),
     B("نفّذ الإجراءات بالترتيب المخطط له. أي تغيير في النطاق أو الموعد أو المسؤول يُسجَّل بتاريخه وسببه، حتى لا تصبح المقارنة اللاحقة غير دقيقة.",
       "Carry out the actions in the planned order. Any change in scope, date or owner is recorded with its date and reason, so the later comparison stays accurate."),
     B("تأجل التدريب أسبوعين بسبب الإجازات؛ يُسجَّل التأجيل مع السبب الجديد للموعد.",
       "Training is postponed two weeks because of leave; the postponement is logged with the reason and the new date."),
     [B("راجع الخطة مع المالك في بداية التنفيذ","Review the plan with the owner at the start"),
      B("سجّل كل انحراف في سجل الدورة فور حدوثه","Log each deviation in the cycle record as it happens")],
     [B("سجل الانحرافات بتاريخها وسببها","Deviation log with dates and reasons")],
     [B("تنفيذ بلا سجل، ثم تُكتب الذكريات لاحقاً","Work done with no log, then reconstructed from memory"),
      B("تغيير الخطة دون علم صاحب الهدف","Changing the plan without the target owner knowing")],
     B("مالك الإجراء","Action owner"),B("نسبة الإجراءات المنفذة في موعدها","Share of actions completed on time")),
   item("DO2",B("احتفظ بالدليل أثناء التنفيذ","Keep evidence while doing the work"),
     B("الدليل هو ما يجعل التحسين قابلاً للتدقيق: سجل حضور تدريب، نموذج معدّل، محضر اجتماع، صورة قبل وبعد، أو تقرير تشغيل. اجمعه أثناء التنفيذ، لا بعده من الذاكرة.",
       "Evidence is what makes improvement auditable: a training attendance list, a revised form, meeting minutes, a before-and-after photo or an operating report. Collect it during the work, not afterwards from memory."),
     B("بعد تعديل النموذج تُحفظ نسخته القديمة والجديدة مع تاريخ السريان وقائمة المستخدمين الذين تلقّوا التدريب.",
       "After the form is revised, the old and new versions are kept with the effective date and the list of users who were trained."),
     [B("حدّد قبل البدء ما الدليل المطلوب لكل إجراء","Decide before starting what evidence each action needs"),
      B("احفظ الدليل في مكان واحد مرتبط بالدورة","Store evidence in one place linked to the cycle")],
     [B("مرفقات مؤرخة ومرتبطة بالإجراء","Dated attachments linked to the action")],
     [B("دليل موجود لكن غير مؤرخ أو غير مرتبط بالإجراء","Evidence that exists but is undated or unlinked to the action"),
      B("الاعتماد على شهادة شفهية من أحد الموظفين","Relying on a verbal statement from a staff member")],
     B("مالك الإجراء","Action owner"),B("نسبة الإجراءات المنفذة ولها دليل","Share of completed actions with evidence"))
  ]},
 {"id":"C","grp":"cycle","t":B("التحقق — Check","Check"),"sh":B("Check · التحقق","Check · Check"),
  "p":B("قِس النتيجة بالمقياس نفسه، وتحقق من أن الإجراء نُفّذ، ومن أنه أحدث الأثر المطلوب.","Measure the result with the same method, verify that the action was implemented and that it produced the intended effect."),
  "ph":"check","col":"#C9821A","tint":"#FCF1DE","fl":[B("المرحلة 3 من 4","Stage 3 of 4")],
  "it":[
   item("CK1",B("قِس النتيجة بالمقياس نفسه","Measure the result with the same method"),
     B("أعد القياس بالطريقة نفسها التي استخدمتها للخط الأساس، ولفترة أو حجم مماثل تقريباً، ثم قارن النتيجة بالهدف. إذا غيّرت طريقة القياس فسجّل ذلك حتى لا تُقرأ المقارنة خطأً.",
       "Re-measure with the same method you used for the baseline, over a similar period or volume, then compare the result with the target. If you changed the method, record it so the comparison is not misread."),
     B("إذا كان الخط الأساس يحسب الاعتمادات المتأخرة من السجل الشهري، فالقياس بعد التغيير يُحسب من السجل نفسه للفترة الموازية.",
       "If the baseline counts late submittals from the monthly register, the post-change measure is counted from the same register for a matching period."),
     [B("استخدم التعريف نفسه للحالة «متأخر»","Use the same definition of “late”"),
      B("قارن الفترات المتماثلة فقط","Compare matching periods only")],
     [B("نتيجة القياس مع طريقة حسابها","Measured result with its calculation method")],
     [B("مقارنة شهر كامل مع أسبوع","Comparing a full month with one week"),
      B("تغيير تعريف المقياس في منتصف الدورة دون تسجيل","Changing the measure's definition mid-cycle without recording it")],
     B("مدير العملية أو مسؤول الجودة","Process manager or quality lead"),B("نتيجة القياس مقارنة بالهدف","Measured result against the target")),
   item("CK2",B("تحقق من التنفيذ ومن الأثر معاً","Check implementation and effectiveness together"),
     B("التحقق خطوتان: هل نُفّذ ما خُطط له؟ وهل حقق الأثر المطلوب؟ قد تنفّذ إجراءً كاملاً ولا يتغير شيء، وهذه معلومة مهمة تقود إلى تعديل الحل لا إلى إغلاق الدورة.",
       "Verification has two parts: was what was planned implemented, and did it produce the intended effect? You can implement an action fully and see no change; that is important information that leads to adjusting the fix, not to closing the cycle."),
     B("تدريب نُفّذ لكل المراجعين، لكن معدل التأخير لم يتغير؛ السبب الحقيقي ربما في اعتماد المهندس الاستشاري، لا في المراجعين.",
       "Training was delivered to all reviewers, but the delay rate did not change; the real cause may lie in the consultant's approval step, not with the reviewers."),
     [B("اعمل قائمة تحقق بسيطة للتنفيذ","Use a simple implementation checklist"),
      B("اسأل: هل النتيجة تغيّرت بسبب الإجراء أم لسبب آخر؟","Ask: did the result change because of the action or for another reason?")],
     [B("قائمة تحقق التنفيذ موقعة","Signed implementation checklist"),
      B("ملاحظة عن الأثر وسببها","Note on the effect and its reason")],
     [B("اعتبار التنفيذ دليلاً على الفعالية","Treating implementation as proof of effectiveness"),
      B("إغلاق الدورة قبل مرور فترة كافية للقياس","Closing the cycle before enough time has passed to measure")],
     B("مدقق داخلي أو مسؤول النظام","Internal auditor or system owner"),B("نسبة الدورات التي لها تحقق من الأثر","Share of cycles with an effectiveness check"))
  ]},
 {"id":"A","grp":"cycle","t":B("التصرف — Act","Act"),"sh":B("Act · التصرف","Act · Act"),
  "p":B("إن نجح التغيير فثبّته، وإن لم ينجح فعدّل وابدأ دورة جديدة، ثم أغلق الدورة واربطها بسجلها الأصلي.","If the change worked, make it permanent; if not, adjust and start a new cycle. Then close the cycle and link it to its origin."),
  "ph":"act","col":"#3C9A5F","tint":"#E5F4EA","fl":[B("المرحلة 4 من 4","Stage 4 of 4")],
  "it":[
   item("AC1",B("ثبّت ما نجح أو عدّل الخطة","Standardise what worked or adjust the plan"),
     B("إذا تحقق الهدف، حوّل التغيير إلى إجراء مكتوب أو نموذج أو تدريب، حتى لا يعود الوضع القديم. وإذا لم يتحقق، فلا تُغلق الدورة: عدّل الحل وابدأ دورة جديدة من PL2 لا من الصفر.",
       "If the target was met, turn the change into a written procedure, form or training so the old way does not return. If it was not met, do not close the cycle: adjust the fix and start a new cycle from PL2, not from zero."),
     B("نجح نموذج الاعتماد الجديد، فيُدرج في إجراء المراجعة وتُحدَّث قائمة النماذج المعتمدة. أما التدريب وحده فلم يكفِ، فتُبدأ دورة جديدة تستهدف الاعتماد الاستشاري.",
       "The new submittal form worked, so it is written into the review procedure and the approved forms list is updated. Training alone was not enough, so a new cycle starts targeting the consultant's approval step."),
     [B("حدّث الوثيقة أو النموذج قبل إغلاق الدورة","Update the document or form before closing the cycle"),
      B("إن لم يتحقق الهدف، سجّل الفرضية التي فشلت","If the target was not met, record which assumption failed")],
     [B("وثيقة أو نموذج محدّث بتاريخ السريان","Updated document or form with its effective date"),
      B("رابط الدورة الجديدة عند الحاجة","Link to the new cycle when needed")],
     [B("تغيير يعيش في ذهن الفريق ولا يُكتب","A change that lives in people's heads and is never written down"),
      B("إغلاق دورة فاشلة لأنها أصبحت مملة","Closing a failed cycle because it has become tedious")],
     B("صاحب العملية","Process owner"),B("عدد التغييرات المثبتة في وثائق مُحدّثة","Changes made permanent in updated documents")),
   item("AC2",B("أغلق الدورة واربطها بسجلها الأصلي","Close the cycle and link it to its origin"),
     B("إذا بدأت الدورة من عدم مطابقة (NCR) أو ملاحظة تدقيق، فاربطها بسجل المعالجة وبإجراء التصحيح، وحدّث المخاطر والفرص التي حددتها في التخطيط إن تغيّرت. ثم أغلق الدورة بتاريخ وسبب.",
       "If the cycle started from a nonconformity (NCR) or an audit finding, link it to that record and to the corrective action, and update the risks and opportunities from planning if they changed. Then close the cycle with a date and a reason."),
     B("دورة بدأت من ملاحظة تدقيق عن تأخر الاعتمادات تُغلق مع رابط إلى سجل الملاحظة، وتحديث سجل المخاطر ببند «تأخر الاعتماد الاستشاري».",
       "A cycle that began from an audit finding on submittal delays is closed with a link to the finding record, and the risk register is updated with “delay in consultant approval”."),
     [B("اربط الدورة بمرجعها: NCR أو تدقيق أو مشروع أو عملية","Link the cycle to its reference: NCR, audit, project or process"),
      B("لا تُغلق دورة دون تاريخ إغلاق وسبب","Never close a cycle without a closure date and reason")],
     [B("رقم المرجع وتاريخ الإغلاق وسببه","Reference number, closure date and reason")],
     [B("دورة مغلقة دون رابط بمرجعها","A closed cycle with no link to its origin"),
      B("مخاطر لم تُحدَّث رغم تغيّر الوضع","Risks not updated although the situation changed")],
     B("مسؤول النظام","System owner"),B("متوسط زمن إغلاق الدورة","Average cycle closure time")),
   item("AC3",B("شارك الدروس المستفادة","Share the lessons learned"),
     B("سجّل ما تعلّمته: ما الذي كان أصعب من المتوقع، وما الذي يصلح لعمليات أخرى. الدروس التي لا تُكتب تُعاد تجربتها.",
       "Write down what you learned: what was harder than expected and what would work for other processes. Lessons that are not written down get relearned the hard way."),
     B("اكتشف الفريق أن البيانات تُدخل يدوياً في سجلين؛ الدرس: توحيد مصدر البيانات قبل القياس.",
       "The team found that data was entered by hand into two registers; the lesson: fix one data source before measuring."),
     [B("اكتب درسين أو ثلاثة على الأكثر، بوضوح","Write two or three lessons at most, clearly"),
      B("أرسلها لأصحاب العمليات المشابهة","Send them to owners of similar processes")],
     [B("ملاحظات الدروس المستفادة","Lessons learned notes")],
     [B("دروس عامة مثل «يجب التواصل أكثر»","Generic lessons such as “we should communicate more”")],
     B("فريق التحسين","Improvement team"),B("عدد الدروس المطبقة في عمليات أخرى","Lessons applied to other processes"))
  ]}
]

paths=[]
edges=[["PL2","PL3"],["PL3","DO1"],["DO1","CK1"],["CK1","CK2"],["CK2","AC1"],["AC1","PL2"],["AC2","AC3"]]
changes={
 "note":B("","") ,
 "tlT":B("","") ,"tlS":B("","") ,"tlCols":4,"tl":[],
 "cardsT":B("","") ,"cardsS":B("","") ,"cards":[],
 "corr":{"t":B("","") ,"s":B("","") ,"h":[],"rows":[]},
 "steps":{"t":B("","") ,"s":B("","") ,"l":B("","")}
}
diagram={"type":""}
legend=[]
flags={}
matrix={"tab":"","d":B("",""),"btn":B("","")}
data={"meta":meta,"std":std,"texts":texts,"phases":phases,"flags":flags,"legend":legend,"diagram":diagram,"matrix":matrix,"sections":sections,"paths":paths,"edges":edges,"changes":changes}
with open("data.js","w",encoding="utf-8") as f:
    f.write("/* PDCA explanation data for the CIA Explain Kit v1.4. Written from ISO 9001:2026 clauses 0.3.2 and 10.2 (paraphrased). */\n")
    f.write("const EXPLAIN_PDCA="+json.dumps(data,ensure_ascii=False,indent=1)+";\n")
print("ok", sum(len(s["it"]) for s in sections), "items")
