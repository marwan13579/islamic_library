/**
 * أنواع المشروع المشتركة (JSDoc) — تُستخدم للتحقّق الساكن عبر `npm run typecheck`.
 * @module types
 */

/**
 * @typedef {"section" | "h3" | "p" | "ul" | "ol" | "evidence" | "hadith" | "quote" | "note" | "warn" | "group"} BlockType
 * @typedef {{ type: "section", title: string, children: Block[] }} SectionBlock
 * @typedef {{ type: "h3", text: string }} H3Block
 * @typedef {{ type: "p", text: string }} PBlock
 * @typedef {{ type: "ul" | "ol", items: string[] }} ListBlock
 * @typedef {{ type: "evidence", ayah: string, ref: string }} EvidenceBlock
 * @typedef {{ type: "hadith", text: string, ref: string }} HadithBlock
 * @typedef {{ type: "quote", text: string, scholar: string }} QuoteBlock
 * @typedef {{ type: "note" | "warn", text: string }} NoteBlock
 * @typedef {{ type: "group", children: Block[] }} GroupBlock
 * @typedef {SectionBlock | H3Block | PBlock | ListBlock | EvidenceBlock | HadithBlock | QuoteBlock | NoteBlock | GroupBlock} Block
 */

/**
 * @typedef {Object} Faq
 * @property {string} q
 * @property {string} a
 */

/**
 * @typedef {Object} QuizQuestion
 * @property {string} q
 * @property {string[]} options
 * @property {number} answer
 * @property {string} explain
 */

/**
 * @typedef {Object} Lesson
 * @property {string} id
 * @property {string} cat
 * @property {string} catKey
 * @property {"fard" | "sunnah"} type
 * @property {string} icon
 * @property {string} title
 * @property {string} desc
 * @property {string[]} sources
 * @property {string[]} related
 * @property {Block[]} body
 * @property {Faq[]} faq
 * @property {QuizQuestion[]} quiz
 */

/**
 * @typedef {Object} ManhajLesson
 * @property {string} id
 * @property {string} cat
 * @property {string} mcat
 * @property {string} icon
 * @property {string} title
 * @property {string} desc
 * @property {Block[]} body
 * @property {string[]} [sources]
 * @property {Faq[]} [faq]
 * @property {QuizQuestion[]} [quiz]
 */

/**
 * @typedef {Object} Scholar
 * @property {string} name
 * @property {string} era
 * @property {string} tag
 * @property {string} initial
 * @property {string} bio
 */

/**
 * @typedef {Object} Saying
 * @property {string} txt
 * @property {string} author
 * @property {string} src
 */

/**
 * @typedef {Object} SeerahStop
 * @property {string} year
 * @property {string} title
 * @property {string} desc
 */

/**
 * @typedef {Object} Prophet
 * @property {string} emoji
 * @property {string} title
 * @property {string} desc
 * @property {string} story
 */

/**
 * @typedef {Object} NameOfGod
 * @property {string} n
 * @property {string} m
 */

/**
 * @typedef {Object} DuaCategory
 * @property {string} title
 * @property {{ txt: string, src: string }[]} items
 */

/**
 * @typedef {Object} KidLesson
 * @property {string} emoji
 * @property {string} title
 * @property {string} desc
 * @property {string} age
 * @property {string} body
 */

/**
 * @typedef {Object} QaItem
 * @property {string} q
 * @property {string} a
 */

/** @typedef {"mc" | "tf" | "fill"} QuestionType */
/** @typedef {"easy" | "medium" | "hard"} Difficulty */

/**
 * @typedef {Object} Question
 * @property {QuestionType} t
 * @property {Difficulty} d
 * @property {string} q
 * @property {string[]} [o]
 * @property {number | boolean | string[]} a
 * @property {string} e
 */

/**
 * @typedef {Object} QuestionCategory
 * @property {string} key
 * @property {string} title
 * @property {string} desc
 * @property {string} icon
 * @property {string} group
 * @property {Question[]} questions
 */

/**
 * @typedef {Object} AthkarCategory
 * @property {string} category
 * @property {{ text: string, count: number }[]} items
 */

/**
 * @typedef {Object} Hadith
 * @property {string} id
 * @property {string} cat
 * @property {string} title
 * @property {string} text
 * @property {string} ref
 */

/**
 * @typedef {Object} RadioStation
 * @property {string} name
 * @property {string} url
 * @property {string} cat
 */

/**
 * @typedef {Object} Certificate
 * @property {string} id
 * @property {string} name
 * @property {string} title
 * @property {number} score
 * @property {number} total
 * @property {number} percent
 * @property {string} ts
 */

export {};