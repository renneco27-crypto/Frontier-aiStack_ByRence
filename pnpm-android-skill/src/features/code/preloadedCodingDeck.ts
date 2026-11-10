// src/features/code/preloadedCodingDeck.ts
// Type definitions and preloaded challenges for Zero-LLM Coding Lab & IDE

export type CodeLanguage = 'java' | 'python' | 'sql' | 'javascript'

export interface ScenarioModeData {
  scenarioPrompt: string
  starterTemplate: string
  expectedKeywords: string[]
  forbiddenPatterns?: string[]
  sampleSolution: string
  simulatedOutput: string
}

export interface BugHunterModeData {
  scenarioPrompt: string
  buggyCode: string
  bugCount: number
  bugDescriptions: string[]
  cleanSolution: string
  simulatedOutput: string
}

export interface CodePracticeChallenge {
  prompt: string
  starterCode?: string
  solutionKeywords: string[]
  solutionPattern?: string
  hint?: string
  explanation: string
  simulatedOutput: string
}

export interface UnifiedCodeChallenge {
  id: string
  rawCard?: any
  topic: string
  category: 'OOP' | 'Data Structures' | 'Databases & SQL' | 'Error Handling' | 'Algorithms'
  language: CodeLanguage
  description: string
  scenario: ScenarioModeData
  bugHunter: BugHunterModeData
  codeLabData?: {
    in_plain_words?: string
    syntax_formula?: string
    script_html?: string
    data_map?: { section: string; fn: string; concept: string; memory_effect: string }[]
    test_suite?: string
    variations?: {
      title: string
      use_case: string
      code: string
      explanation?: string
    }[]
    practice_challenge?: CodePracticeChallenge
    bug_hunter?: {
      prompt?: string
      buggy_code?: string
      buggyCode?: string
      clean_solution?: string
      bug_descriptions?: string[]
      simulated_output?: string
    }
  }
  practiceChallenge?: CodePracticeChallenge
}

export const PRELOADED_CODING_CHALLENGES: UnifiedCodeChallenge[] = [
  {
    id: 'code-object-assign',
    topic: 'Object.assign(target, ...sources)',
    category: 'Data Structures',
    language: 'javascript',
    description: 'Merge properties from source objects into a target object without mutating the original.',
    scenario: {
      scenarioPrompt: 'Create a function updateInventory that returns a newly merged item without mutating baseItem.',
      starterTemplate: `function updateInventory(baseItem, changes) {
  // TODO: Return a new object merging baseItem and changes without mutating baseItem
  
}`,
      expectedKeywords: ['Object.assign', '{}'],
      sampleSolution: `function updateInventory(baseItem, changes) {
  return Object.assign({}, baseItem, changes);
}

const base = { id: 101, title: 'JS Handbook', price: 40 };
const discount = { price: 32, onSale: true };
const updated = updateInventory(base, discount);
console.log(updated);`,
      simulatedOutput: '{ id: 101, title: "JS Handbook", price: 32, onSale: true }'
    },
    bugHunter: {
      scenarioPrompt: 'Fix the bug where Object.assign mutates the original base object.',
      buggyCode: `function mergeSettings(defaults, custom) {
  return Object.assign(defaults, custom);
}`,
      bugCount: 1,
      bugDescriptions: ['Target is defaults, which mutates the original object in place.'],
      cleanSolution: `function mergeSettings(defaults, custom) {
  return Object.assign({}, defaults, custom);
}`,
      simulatedOutput: 'Clean object created without mutating defaults.'
    },
    codeLabData: {
      in_plain_words: 'Think of Object.assign as copy-and-paste for object properties. Passing an empty object {} as the first target guarantees the original source is never mutated.',
      syntax_formula: 'const result = Object.assign(target, ...sources);',
      script_html: `// 1. Declare base inventory item

const base = { title: "JS Guide", cost: 40 };
// base is stored in memory with title and cost

// 2. Declare update modifications

const update = { cost: 35, onSale: true };
// update has the replacement cost and a new boolean

// 3. Merge without mutating original base

const newBook = Object.assign({}, base, update);
// {} receives properties from base, then update overwrites cost to 35

// 4. Output verified object

console.log(newBook);
// Expected: { title: "JS Guide", cost: 35, onSale: true }`,
      data_map: [
        { section: '1. Setup', fn: 'const base = { ... }', concept: 'Object literal', memory_effect: 'Allocates base object with cost 40' },
        { section: '2. Changes', fn: 'const update = { ... }', concept: 'Delta object', memory_effect: 'Allocates update object with cost 35' },
        { section: '3. Merge', fn: 'Object.assign({}, ...)', concept: 'Shallow merge', memory_effect: 'Creates new target pointer, copies keys from left to right' },
        { section: '4. Output', fn: 'console.log(newBook)', concept: 'Console stream', memory_effect: 'Prints new merged record while base stays cost 40' }
      ],
      variations: [
        {
          title: 'Cloning an Object',
          use_case: 'Defensive copy',
          code: `const original = { user: "admin", level: 9 };
const copy = Object.assign({}, original);
copy.level = 10;
// original.level remains 9`,
          explanation: 'Creates a top-level clone so modifying the copy leaves the original intact.'
        },
        {
          title: 'Applying Default Configuration',
          use_case: 'Config fallback',
          code: `function initApp(options) {
  const defaults = { debug: false, port: 3000, theme: "dark" };
  return Object.assign({}, defaults, options);
}
const config = initApp({ port: 8080 });
// { debug: false, port: 8080, theme: "dark" }`,
          explanation: 'Overwrites defaults only for properties explicitly supplied in options.'
        },
        {
          title: 'Combining Multiple Sources',
          use_case: 'Multi-part assembly',
          code: `const bio = { name: "Dev" };
const perms = { role: "editor" };
const stats = { logins: 14 };
const profile = Object.assign({}, bio, perms, stats);`,
          explanation: 'Pass multiple sources in sequence. Later sources win on property conflicts.'
        }
      ],
      test_suite: `console.assert(newBook.cost === 35, "Cost must be updated to 35");
console.assert(newBook.title === "JS Guide", "Title must be preserved");
console.assert(base.cost === 40, "Base object must remain unmutated");`,
      practice_challenge: {
        prompt: 'Given const state = { theme: "dark", zoom: 100 } and const custom = { zoom: 120 }, write the Object.assign expression to create a new merged object without altering state.',
        starterCode: 'const result = Object.assign(',
        solutionKeywords: ['Object.assign', '{}', 'state', 'custom'],
        solutionPattern: 'Object\\.assign\\s*\\(\\s*\\{\\s*\\}\\s*,\\s*state\\s*,\\s*custom\\s*\\)',
        hint: 'Use an empty object {} as the first target argument: Object.assign({}, state, custom)',
        explanation: 'Object.assign({}, state, custom) creates a fresh object, copies state, and overwrites zoom with custom.',
        simulatedOutput: '{ theme: "dark", zoom: 120 }'
      }
    },
    practiceChallenge: {
      prompt: 'Given const state = { theme: "dark", zoom: 100 } and const custom = { zoom: 120 }, write the Object.assign expression to create a new merged object without altering state.',
      starterCode: 'const result = Object.assign(',
      solutionKeywords: ['Object.assign', '{}', 'state', 'custom'],
      solutionPattern: 'Object\\.assign\\s*\\(\\s*\\{\\s*\\}\\s*,\\s*state\\s*,\\s*custom\\s*\\)',
      hint: 'Use an empty object {} as the first target argument: Object.assign({}, state, custom)',
      explanation: 'Object.assign({}, state, custom) creates a fresh object, copies state, and overwrites zoom with custom.',
      simulatedOutput: '{ theme: "dark", zoom: 120 }'
    }
  },
  {
    id: 'code-crud-attendance',
    topic: 'Array CRUD Operations: Student Attendance',
    category: 'Data Structures',
    language: 'javascript',
    description: 'Implement Create, Read, Update, Delete with array methods and objects.',
    scenario: {
      scenarioPrompt: 'Implement a function findStudent(students, id) that returns the student record matching id.',
      starterTemplate: `function findStudent(students, id) {
  return students.find(s => s.id === id);
}`,
      expectedKeywords: ['find', 'id'],
      sampleSolution: `let students = [];
let nextId = 1;

function registerStudent(name, grade) {
  const student = { id: nextId++, name: name, grade: grade, present: 0 };
  students.push(student);
  return student;
}

function findStudent(id) {
  return students.find(s => s.id === id);
}`,
      simulatedOutput: 'Student 1 registered and queried successfully.'
    },
    bugHunter: {
      scenarioPrompt: 'Fix removeStudent to correctly remove 1 item at the found index without deleting other items.',
      buggyCode: `function removeStudent(students, id) {
  const index = students.findIndex(s => s.id === id);
  if (index !== -1) {
    students.splice(index);
  }
}`,
      bugCount: 1,
      bugDescriptions: ['splice(index) without a deleteCount removes all subsequent elements.'],
      cleanSolution: `function removeStudent(students, id) {
  const index = students.findIndex(s => s.id === id);
  if (index !== -1) {
    students.splice(index, 1);
  }
}`,
      simulatedOutput: 'Single student removed cleanly.'
    },
    codeLabData: {
      in_plain_words: 'CRUD represents the 4 foundations of data handling: Create (push), Read (find), Update (Object.assign/mutate), and Delete (splice).',
      syntax_formula: 'CREATE: arr.push(item) | READ: arr.find(fn) | UPDATE: Object.assign(item, data) | DELETE: arr.splice(idx, 1)',
      script_html: `let students = [];
let nextStudentId = 1;

function registerStudent(name, grade) {
  if (!name || !grade) return null;
  const student = {
    id: nextStudentId++,
    name: name,
    grade: grade,
    totalPresent: 0,
    totalAbsent: 0
  };
  students.push(student);
  return student;
}

function findStudent(id) {
  return students.find(s => s.id === id);
}

function updateStudent(id, newData) {
  const student = findStudent(id);
  if (!student) return null;
  Object.assign(student, newData);
  return student;
}

function removeStudent(id) {
  const index = students.findIndex(s => s.id === id);
  if (index === -1) return false;
  students.splice(index, 1);
  return true;
}`,
      data_map: [
        { section: '1. Create', fn: 'registerStudent()', concept: 'push & post-increment', memory_effect: 'Pushes student object into array; increments ID counter' },
        { section: '2. Read', fn: 'findStudent()', concept: 'Array.prototype.find', memory_effect: 'Returns matching object reference or undefined' },
        { section: '3. Update', fn: 'updateStudent()', concept: 'Object.assign in-place', memory_effect: 'Mutates student properties in heap memory' },
        { section: '4. Delete', fn: 'removeStudent()', concept: 'Array.prototype.splice', memory_effect: 'Removes 1 element at found index, shifts rest left' }
      ],
      variations: [
        {
          title: 'Immutable Add (React/Redux style)',
          use_case: 'Functional update',
          code: `function addStudentImmutable(list, student) {
  return [...list, student];
}`,
          explanation: 'Returns a new array using the spread operator instead of mutating with push.'
        },
        {
          title: 'Immutable Delete via Filter',
          use_case: 'Non-destructive removal',
          code: `function removeStudentImmutable(list, id) {
  return list.filter(student => student.id !== id);
}`,
          explanation: 'Creates a new array excluding the matching ID.'
        }
      ],
      test_suite: `const s1 = registerStudent("Alex", "10A");
console.assert(s1.id === 1, "ID must be 1");
const updated = updateStudent(1, { grade: "10B" });
console.assert(updated.grade === "10B", "Grade must be updated");
removeStudent(1);
console.assert(students.length === 0, "List must be empty after remove");`,
      practice_challenge: {
        prompt: 'In an array students = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }], write the single JavaScript array method to find the student with id === 2.',
        starterCode: 'const student = students.find(',
        solutionKeywords: ['find', 'id', '2'],
        solutionPattern: 'students\\.find\\s*\\(\\s*\\(?\\w+\\)?\\s*=>\\s*\\w+\\.id\\s*===?\\s*2\\s*\\)',
        hint: 'Use the .find() method: students.find(s => s.id === 2)',
        explanation: 'students.find(s => s.id === 2) iterates through the array and returns the first element satisfying the predicate.',
        simulatedOutput: '{ id: 2, name: "Bob" }'
      }
    },
    practiceChallenge: {
      prompt: 'In an array students = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }], write the single JavaScript array method to find the student with id === 2.',
      starterCode: 'const student = students.find(',
      solutionKeywords: ['find', 'id', '2'],
      solutionPattern: 'students\\.find\\s*\\(\\s*\\(?\\w+\\)?\\s*=>\\s*\\w+\\.id\\s*===?\\s*2\\s*\\)',
      hint: 'Use the .find() method: students.find(s => s.id === 2)',
      explanation: 'students.find(s => s.id === 2) iterates through the array and returns the first element satisfying the predicate.',
      simulatedOutput: '{ id: 2, name: "Bob" }'
    }
  },
  {
    id: 'code-object-entries',
    topic: 'Object.entries() & Object.fromEntries()',
    category: 'Data Structures',
    language: 'javascript',
    description: 'Transform, map, and filter object properties as [key, value] pairs.',
    scenario: {
      scenarioPrompt: 'Write a function countKeys(obj) that returns the total count of own enumerable keys.',
      starterTemplate: `function countKeys(obj) {
  return Object.keys(obj).length;
}`,
      expectedKeywords: ['Object.keys', 'length'],
      sampleSolution: `function countKeys(obj) {
  return Object.keys(obj).length;
}`,
      simulatedOutput: 'Key count returned correctly.'
    },
    bugHunter: {
      scenarioPrompt: 'Fix the transformation pipeline to reconstruct an object using Object.fromEntries.',
      buggyCode: `function doubleScores(scores) {
  return Object.entries(scores).map(([k, v]) => [k, v * 2]);
}`,
      bugCount: 1,
      bugDescriptions: ['Returns an array of pairs instead of an object.'],
      cleanSolution: `function doubleScores(scores) {
  const pairs = Object.entries(scores).map(([k, v]) => [k, v * 2]);
  return Object.fromEntries(pairs);
}`,
      simulatedOutput: 'Object reconstituted with doubled scores.'
    },
    codeLabData: {
      in_plain_words: 'Object.entries converts an object into an array of [key, value] pairs so you can map or filter. Object.fromEntries converts the pairs back into an object.',
      syntax_formula: 'Object.entries(obj) -> [[k1, v1], [k2, v2]] | Object.fromEntries(pairs) -> obj',
      script_html: `const inventory = { apples: 5, oranges: 2, bananas: 12 };

// 1. Convert to key-value pairs

const entries = Object.entries(inventory);
// [["apples", 5], ["oranges", 2], ["bananas", 12]]

// 2. Filter items with stock > 3

const inStock = entries.filter(([item, qty]) => qty > 3);
// [["apples", 5], ["bananas", 12]]

// 3. Rebuild clean object

const filteredInventory = Object.fromEntries(inStock);
console.log(filteredInventory);
// { apples: 5, bananas: 12 }`,
      data_map: [
        { section: '1. Deconstruct', fn: 'Object.entries()', concept: 'Object to 2D Array', memory_effect: 'Creates array of [key, value] pairs' },
        { section: '2. Filter', fn: 'Array.prototype.filter()', concept: 'Predicate mapping', memory_effect: 'Retains only matching pairs in new array' },
        { section: '3. Reassemble', fn: 'Object.fromEntries()', concept: '2D Array to Object', memory_effect: 'Constructs new object from array tuples' }
      ],
      variations: [
        {
          title: 'Mapping Object Values',
          use_case: 'Price adjustment',
          code: `const prices = { shirt: 20, pants: 40 };
const discounted = Object.fromEntries(
  Object.entries(prices).map(([item, price]) => [item, price * 0.9])
);`,
          explanation: 'Applies 10% discount to all values while keeping keys intact.'
        }
      ],
      test_suite: `console.assert(filteredInventory.apples === 5, "Apples must be included");
console.assert(filteredInventory.oranges === undefined, "Oranges must be excluded");`,
      practice_challenge: {
        prompt: 'Given const scores = { a: 10, b: 25 }, write the expression to get the total number of keys using Object.keys.',
        starterCode: 'const count = Object.keys(',
        solutionKeywords: ['Object.keys', 'scores', 'length'],
        solutionPattern: 'Object\\.keys\\s*\\(\\s*scores\\s*\\)\\.length',
        hint: 'Call .length on Object.keys(scores): Object.keys(scores).length',
        explanation: 'Object.keys(scores) returns ["a", "b"]. Calling .length yields 2.',
        simulatedOutput: '2'
      }
    },
    practiceChallenge: {
      prompt: 'Given const scores = { a: 10, b: 25 }, write the expression to get the total number of keys using Object.keys.',
      starterCode: 'const count = Object.keys(',
      solutionKeywords: ['Object.keys', 'scores', 'length'],
      solutionPattern: 'Object\\.keys\\s*\\(\\s*scores\\s*\\)\\.length',
      hint: 'Call .length on Object.keys(scores): Object.keys(scores).length',
      explanation: 'Object.keys(scores) returns ["a", "b"]. Calling .length yields 2.',
      simulatedOutput: '2'
    }
  },
  {
    id: 'code-java-switch-cases',
    topic: 'Java Switch Cases & Pattern Matching',
    category: 'Algorithms',
    language: 'java',
    description: 'Multi-way conditional branching using modern Java switch statements, arrow expressions (->), and pattern matching.',
    scenario: {
      scenarioPrompt: 'Implement evaluateShippingCost(String speedCode, boolean isMember) using Java enhanced switch expression syntax.',
      starterTemplate: `public class ShippingService {
    public static double evaluateShippingCost(String speedCode, boolean isMember) {
        // TODO: Use switch arrow (->) expression to return:
        // "EXPRESS"   -> member ? 12.0 : 18.0
        // "STANDARD"  -> member ? 0.0 : 5.99
        // "OVERNIGHT" -> 25.0
        // default     -> 7.50
        return switch (speedCode.toUpperCase()) {
            // Write your cases here...
        };
    }
}`,
      expectedKeywords: ['switch', 'case', '->', 'default'],
      sampleSolution: `public class ShippingService {
    public static double evaluateShippingCost(String speedCode, boolean isMember) {
        return switch (speedCode.toUpperCase()) {
            case "EXPRESS" -> isMember ? 12.0 : 18.0;
            case "STANDARD" -> isMember ? 0.0 : 5.99;
            case "OVERNIGHT" -> 25.0;
            default -> 7.50;
        };
    }

    public static void main(String[] args) {
        double cost = evaluateShippingCost("STANDARD", true);
        System.out.println("Shipping cost: $" + cost);
    }
}`,
      simulatedOutput: 'Shipping cost: $0.0'
    },
    bugHunter: {
      scenarioPrompt: 'Fix the missing break fallthrough bug causing every input to receive the default review status.',
      buggyCode: `public class GradeEvaluator {
    public static String getStanding(char grade) {
        String status = "Unknown";
        switch (grade) {
            case 'A':
                status = "Honors";
            case 'B':
                status = "Good";
            case 'C':
                status = "Pass";
            case 'F':
                status = "Fail";
            default:
                status = "Review";
        }
        return status;
    }
}`,
      bugCount: 1,
      bugDescriptions: ['Missing break statements in traditional switch causes execution to fall through all cases to the default branch.'],
      cleanSolution: `public class GradeEvaluator {
    public static String getStanding(char grade) {
        return switch (grade) {
            case 'A' -> "Honors";
            case 'B' -> "Good";
            case 'C' -> "Pass";
            case 'F' -> "Fail";
            default -> "Review";
        };
    }
}`,
      simulatedOutput: 'Grade A correctly returns: Honors'
    },
    codeLabData: {
      in_plain_words: 'Switch statements evaluate an expression once and jump directly to the matching case branch. In modern Java, switch expressions with the arrow operator (->) eliminate fallthrough bugs and directly return values.',
      syntax_formula: 'return switch (selector) { case CONST_1 -> val1; case CONST_2, CONST_3 -> val2; default -> fallback; };',
      script_html: `public class Main {
    public static double evaluateShippingCost(String speedCode, boolean isMember) {
        return switch (speedCode.toUpperCase()) {
            case "EXPRESS" -> isMember ? 12.0 : 18.0;
            case "STANDARD" -> isMember ? 0.0 : 5.99;
            case "OVERNIGHT" -> 25.0;
            default -> 7.50;
        };
    }

    public static void main(String[] args) {
        double cost = evaluateShippingCost("STANDARD", true);
        System.out.println("Shipping cost: $" + cost);
    }
}`,
      data_map: [
        { section: '1. Class & Method', fn: 'public static double evaluateShippingCost(...)', concept: 'Pure Static Method', memory_effect: 'Stack frame allocated with speedCode and isMember arguments' },
        { section: '2. Normalization', fn: 'speedCode.toUpperCase()', concept: 'Selector Preprocessing', memory_effect: 'Creates uppercase String instance on heap for safe branch matching' },
        { section: '3. Arrow Return', fn: 'case "STANDARD" -> isMember ? 0.0 : 5.99', concept: 'Ternary Yield', memory_effect: 'Evaluates boolean condition and pushes 0.0 directly to operand stack' },
        { section: '4. Entrypoint', fn: 'System.out.println(...)', concept: 'Standard I/O Execution', memory_effect: 'Outputs "Shipping cost: $0.0" to standard stdout stream' }
      ],
      variations: [
        {
          title: '1. Modern Arrow Expression',
          use_case: 'Inline Value Return',
          code: `int priority = switch (severity) {
    case "CRITICAL", "HIGH" -> 1;
    case "MEDIUM" -> 2;
    default -> 3;
};`,
          explanation: 'Groups multiple constants on one line and yields the result without needing a break statement.'
        },
        {
          title: '2. Switch with Yield Block',
          use_case: 'Multi-line Computation',
          code: `double discount = switch (tier) {
    case "GOLD" -> {
        double base = 0.20;
        yield base + bonus;
    }
    case "SILVER" -> 0.10;
    default -> 0.0;
};`,
          explanation: 'Uses code blocks with yield when a case branch requires intermediate calculations before returning.'
        },
        {
          title: '3. Enum-based Switching',
          use_case: 'Compile-time Exhaustiveness',
          code: `enum TaskState { TODO, IN_PROGRESS, DONE }

String message = switch (state) {
    case TODO -> "Awaiting assignment";
    case IN_PROGRESS -> "Work underway";
    case DONE -> "Completed successfully";
};`,
          explanation: 'When switching over enums, the Java compiler verifies all enum constants are covered, eliminating unexpected default branches.'
        },
        {
          title: '4. Pattern Matching for Switch (Java 21)',
          use_case: 'Type-safe Polymorphism',
          code: `static String formatValue(Object obj) {
    return switch (obj) {
        case Integer i -> String.format("Int: %d", i);
        case Double d -> String.format("Float: %.2f", d);
        case String s -> "String: " + s.toUpperCase();
        case null -> "Null reference";
        default -> obj.toString();
    };
}`,
          explanation: 'Eliminates cumbersome instanceof checks and manual casts by matching types directly in case labels.'
        }
      ],
      test_suite: `assert evaluateShippingCost("STANDARD", true) == 0.0 : "Free for members";
assert evaluateShippingCost("OVERNIGHT", false) == 25.0 : "Overnight rate";`,
      practice_challenge: {
        prompt: 'Complete the switch arrow expression: return 0.0 for "STANDARD", 15.0 for "EXPRESS", and 5.0 for default.',
        starterCode: 'return switch (speed) { case "STANDARD" -> 0.0; case "EXPRESS" -> 15.0; default -> 5.0; };',
        solutionKeywords: ['switch', 'case', 'default', '->'],
        solutionPattern: 'switch\\s*\\(.*\\)\\s*\\{.*case.*->.*default.*->.*\\}',
        hint: 'Use modern switch arrow syntax: return switch (speed) { case "STANDARD" -> 0.0; case "EXPRESS" -> 15.0; default -> 5.0; };',
        explanation: 'Evaluates speed selector and yields cost value directly without fallthrough.',
        simulatedOutput: 'STANDARD -> $0.0'
      }
    },
    practiceChallenge: {
      prompt: 'Complete the switch arrow expression: return 0.0 for "STANDARD", 15.0 for "EXPRESS", and 5.0 for default.',
      starterCode: 'return switch (speed) { case "STANDARD" -> 0.0; case "EXPRESS" -> 15.0; default -> 5.0; };',
      solutionKeywords: ['switch', 'case', 'default', '->'],
      solutionPattern: 'switch\\s*\\(.*\\)\\s*\\{.*case.*->.*default.*->.*\\}',
      hint: 'Use modern switch arrow syntax: return switch (speed) { case "STANDARD" -> 0.0; case "EXPRESS" -> 15.0; default -> 5.0; };',
      explanation: 'Evaluates speed selector and yields cost value directly without fallthrough.',
      simulatedOutput: 'STANDARD -> $0.0'
    }
  }
]
