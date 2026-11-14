"""Phase 12A explanatory figures (governed data, owner_phase "12A") — rendered by src/ui/figures.js templates.
Placement keys: "company:main" (workspace → Start here), "company:share" (Passport → My company; People → how to share),
"company:matrix", "company:tna". Original CIA diagrams; no numbers, no claims. Author: مدثر سلامه."""


def T(en, ar):
    return {"en": en, "ar": ar}


def s(en, ar, den=None, dar=None):
    x = {"t": T(en, ar)}
    if den:
        x["d"] = T(den, dar)
    return x


FIGS = [
    {"id": "FIG-CO-CONSENT", "template": "flow", "caption": T("A share happens only when the employee decides", "لا تتم المشاركة إلا بقرار الموظف"),
     "read": T("Read from the start. The employee chooses the parts, checks the list, gives consent and hands the file over; only then can the company import it. Deleting the file ends the share.",
               "اقرأ من البداية. يختار الموظف الأجزاء، ويراجع القائمة، ويوافق، ويسلّم الملف؛ وعندها فقط تستطيع الشركة استيراده. وحذف الملف يُنهي المشاركة."),
     "steps": [s("Choose the parts", "اختيار الأجزاء"), s("Check the list", "مراجعة القائمة"), s("Give consent", "الموافقة"), s("Hand over the file", "تسليم الملف"), s("Company imports", "استيراد الشركة")], "highlight": 2},
    {"id": "FIG-CO-CYCLE", "template": "cycle", "caption": T("The company learning cycle", "دورة التعلّم في الشركة"),
     "read": T("Shares show where people stand, the matrix shows the gaps, the analysis turns gaps into needs, the plan and the assignments act on them, and the next share shows what changed.",
               "تُظهر المشاركات أين يقف الأفراد، وتُظهر المصفوفة الفجوات، ويحوّل التحليل الفجوات إلى احتياجات، وتعالجها الخطة والتكليفات، ثم تُظهر المشاركة التالية ما تغيّر."),
     "center": T("Team competence", "كفاءة الفريق"),
     "steps": [s("Share", "المشاركة", "By consent", "بالموافقة"), s("Matrix", "المصفوفة", "Levels and gaps", "المستويات والفجوات"), s("Needs", "الاحتياجات", "Required minus current", "المطلوب ناقص الحالي"),
               s("Plan and assign", "الخطة والتكليف", "Courses and labs", "دورات ومختبرات"), s("Learn", "التعلّم", "Evidence grows", "تنمو الأدلة")]},
    {"id": "FIG-CO-SOURCE", "template": "ladder", "caption": T("How strong is the level in a matrix cell?", "ما مدى قوة المستوى في خلية المصفوفة؟"),
     "read": T("Read from the bottom. A cell with nothing shared tells you nothing; a self-rating is the person's own view; an assessed level was scored by the Academy; a verified level was checked by a named reviewer. Importing a share never moves a level up this ladder.",
               "اقرأ من الأسفل. الخلية التي لم يُشارَك فيها شيء لا تخبرك بشيء؛ والتقييم الذاتي رأي الفرد نفسه؛ والمستوى المُقيَّم صحّحته الأكاديمية؛ والمستوى المتحقق منه راجعه مراجع مُسمّى. واستيراد المشاركة لا يرفع مستوى على هذا السلّم أبدًا."),
     "levels": [s("Verified", "متحقق منه", "Named reviewer", "مراجع مُسمّى"), s("Assessed", "مُقيَّم", "Scored by the Academy", "صحّحته الأكاديمية"),
                s("Self-rated", "تقييم ذاتي", "The person's own view", "رأي الفرد نفسه"), s("Nothing shared", "لم يُشارَك شيء", "No information", "لا معلومات")], "highlight": 1},
    {"id": "FIG-CO-TNA", "template": "flow", "caption": T("From a gap to a line in the annual plan", "من الفجوة إلى سطر في الخطة السنوية"),
     "read": T("The role sets the required level; the share gives the current level; the difference is the development need. Needs are added up per department and for the company, put in priority order and matched with learning.",
               "يحدد الدور المستوى المطلوب، وتعطي المشاركة المستوى الحالي، والفرق هو الاحتياج التطويري. تُجمع الاحتياجات لكل إدارة وللشركة، وتُرتَّب حسب الأولوية، وتُربط بالتعلّم."),
     "steps": [s("Required level", "المستوى المطلوب"), s("Current level", "المستوى الحالي"), s("Development need", "الاحتياج التطويري"), s("Priority", "الأولوية"), s("Plan line", "سطر الخطة")], "highlight": 2}
]

PLACEMENT = {"company:main": ["FIG-CO-CYCLE"], "company:share": ["FIG-CO-CONSENT"], "company:matrix": ["FIG-CO-SOURCE"], "company:tna": ["FIG-CO-TNA"]}
