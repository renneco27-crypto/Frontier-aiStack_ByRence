// src/features/math/preloadedMathDeck.ts
// Type definitions and preloaded challenges for Math Lab & Calculus Notebook Cards

export interface MathStep {
  stepNumber: number
  latex: string
  rawText?: string
  explanation: string
  operationType: 'start' | 'add_sub' | 'mul_div' | 'cancel' | 'substitute' | 'factor' | 'simplify' | 'final'
  operationBadge?: string
  cancelledTerms?: string[]
}

export interface MathPracticeProblem {
  question: string
  given: string[]
  formulaHint?: string
  targetNumeric: number
  unit: string
  acceptableUnits?: string[]
  tolerancePercent?: number
  explanation: string
}

export interface MathChallenge {
  id: string
  rawCard?: any
  topic: string
  category: 'Algebra' | 'Fractions & Cancellation' | 'Quadratic Equations' | 'Systems of Equations' | 'Trigonometry' | 'Calculus'
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  problemLatex: string
  description: string
  steps: MathStep[]
  whatsNextQuiz: {
    question: string
    options: { textLatex: string; isCorrect: boolean; explanation: string }[]
  }
  bugHunterQuiz: {
    flawedSteps: { stepNumber: number; latex: string; hasError: boolean; errorReason?: string }[]
    correctStepLatex: string
  }
  notebookData?: {
    symbol_table?: { symbol: string; meaning: string; unit: string }[]
    in_plain_words?: string
    problem_breakdown?: {
      restate?: string
      given?: string[]
      formula_master?: string
      formula_working?: string
    }
    solution_steps?: string
    key_takeaway?: string
    practice_problem?: MathPracticeProblem
  }
  practiceProblem?: MathPracticeProblem
}

export const PRELOADED_MATH_CHALLENGES: MathChallenge[] = [
  {
    id: 'math-spring-energy',
    topic: 'Elastic Potential Energy: Compressed Spring',
    category: 'Calculus',
    difficulty: 'Intermediate',
    problemLatex: 'U_s = \\frac{1}{2} k x^2',
    description: 'Calculate stored elastic potential energy in a compressed spring.',
    steps: [
      {
        stepNumber: 1,
        latex: 'U_s = \\frac{1}{2} k x^2',
        explanation: 'State the master formula for elastic potential energy.',
        operationType: 'start',
        operationBadge: 'Formula'
      },
      {
        stepNumber: 2,
        latex: 'U_s = \\frac{1}{2} (1500)(0.20)^2',
        explanation: 'Substitute given values: k = 1500 N/m, x = 0.20 m.',
        operationType: 'substitute',
        operationBadge: 'Substitute'
      },
      {
        stepNumber: 3,
        latex: 'U_s = \\frac{1}{2} (1500)(0.04)',
        explanation: 'Square the compression displacement: (0.20)^2 = 0.04.',
        operationType: 'simplify',
        operationBadge: 'Exponent'
      },
      {
        stepNumber: 4,
        latex: 'U_s = 750 \\times 0.04',
        explanation: 'Multiply half of the spring constant: 1/2 * 1500 = 750.',
        operationType: 'simplify',
        operationBadge: 'Multiply'
      },
      {
        stepNumber: 5,
        latex: 'U_s = 30.00\\text{ J}',
        explanation: 'Multiply to obtain the final stored energy.',
        operationType: 'final',
        operationBadge: 'Final Answer'
      }
    ],
    whatsNextQuiz: {
      question: 'What is the stored energy when k = 1500 N/m and x = 0.20 m?',
      options: [
        { textLatex: '30.00\\text{ J}', isCorrect: true, explanation: 'Correct: Us = 0.5 * 1500 * 0.04 = 30 J.' },
        { textLatex: '15.00\\text{ J}', isCorrect: false, explanation: 'Incorrect: Forgot to square the displacement.' },
        { textLatex: '300.00\\text{ J}', isCorrect: false, explanation: 'Incorrect arithmetic scaling.' },
        { textLatex: '60.00\\text{ J}', isCorrect: false, explanation: 'Incorrect: Did not multiply by 1/2.' }
      ]
    },
    bugHunterQuiz: {
      flawedSteps: [
        { stepNumber: 1, latex: 'U_s = k x^2', hasError: true, errorReason: 'Missing factor of 1/2.' }
      ],
      correctStepLatex: 'U_s = \\frac{1}{2} k x^2'
    },
    notebookData: {
      symbol_table: [
        { symbol: 'Us', meaning: 'Elastic potential energy (stored in spring)', unit: 'Joule (J)' },
        { symbol: 'k', meaning: 'Spring constant (stiffness of spring)', unit: 'Newton per meter (N/m)' },
        { symbol: 'x', meaning: 'Compression or extension from equilibrium', unit: 'meter (m)' }
      ],
      in_plain_words: 'Energy stored in a spring depends quadratically on how much it is stretched or squeezed. Doubling the compression quadruples the stored energy.',
      problem_breakdown: {
        restate: 'A spring with stiffness k = 1500 N/m is compressed by 0.20 m. Calculate the stored elastic potential energy.',
        given: [
          'k = 1500 N/m',
          'x = 0.20 m'
        ],
        formula_master: 'Us = 1/2 * k * x^2',
        formula_working: 'Us = 0.5 * k * x^2'
      },
      solution_steps: `1. Write the formula:
Us = 1/2 * k * x^2

2. Substitute the values:
Us = 1/2 * 1500 * (0.20)^2

3. Evaluate the exponent:
Us = 1/2 * 1500 * 0.04

4. Multiply constants:
Us = 750 * 0.04

5. Calculate final product:
Us = 30.00 J`,
      key_takeaway: 'Work done to compress a spring equals the area under the linear force-distance curve F(x)=kx, yielding quadratic energy scaling.',
      practice_problem: {
        question: 'A spring with spring constant k = 800 N/m is compressed by 0.15 m. Calculate the stored elastic potential energy.',
        given: ['k = 800 N/m', 'x = 0.15 m'],
        formulaHint: 'Us = 1/2 * k * x^2',
        targetNumeric: 9,
        unit: 'J',
        acceptableUnits: ['j', 'joules', 'joule', 'j.'],
        tolerancePercent: 2,
        explanation: 'Us = 1/2 * (800 N/m) * (0.15 m)^2 = 400 * 0.0225 = 9.00 J'
      }
    },
    practiceProblem: {
      question: 'A spring with spring constant k = 800 N/m is compressed by 0.15 m. Calculate the stored elastic potential energy.',
      given: ['k = 800 N/m', 'x = 0.15 m'],
      formulaHint: 'Us = 1/2 * k * x^2',
      targetNumeric: 9,
      unit: 'J',
      acceptableUnits: ['j', 'joules', 'joule', 'j.'],
      tolerancePercent: 2,
      explanation: 'Us = 1/2 * (800 N/m) * (0.15 m)^2 = 400 * 0.0225 = 9.00 J'
    }
  },
  {
    id: 'math-constant-work',
    topic: 'Constant Force & Work Done',
    category: 'Calculus',
    difficulty: 'Beginner',
    problemLatex: 'W = F \\cdot d',
    description: 'Calculate work performed by a constant force along the line of motion.',
    steps: [
      {
        stepNumber: 1,
        latex: 'W = F \\cdot d \\cos(\\theta)',
        explanation: 'Master formula for work done by a constant vector force.',
        operationType: 'start',
        operationBadge: 'Formula'
      },
      {
        stepNumber: 2,
        latex: 'W = 250 \\times 0.12 \\times \\cos(0^\\circ)',
        explanation: 'Substitute F = 250 N, d = 0.12 m, theta = 0 deg.',
        operationType: 'substitute',
        operationBadge: 'Substitute'
      },
      {
        stepNumber: 3,
        latex: 'W = 250 \\times 0.12 \\times 1',
        explanation: 'Evaluate cos(0 deg) = 1.',
        operationType: 'simplify',
        operationBadge: 'Trig'
      },
      {
        stepNumber: 4,
        latex: 'W = 30.00\\text{ J}',
        explanation: 'Multiply to determine total mechanical work.',
        operationType: 'final',
        operationBadge: 'Final Answer'
      }
    ],
    whatsNextQuiz: {
      question: 'What is the work done when F = 250 N and d = 0.12 m along the line of force?',
      options: [
        { textLatex: '30.00\\text{ J}', isCorrect: true, explanation: 'Correct: W = 250 * 0.12 = 30 J.' },
        { textLatex: '25.00\\text{ J}', isCorrect: false, explanation: 'Incorrect.' },
        { textLatex: '300.00\\text{ J}', isCorrect: false, explanation: 'Incorrect decimal placement.' },
        { textLatex: '0\\text{ J}', isCorrect: false, explanation: 'Incorrect.' }
      ]
    },
    bugHunterQuiz: {
      flawedSteps: [
        { stepNumber: 1, latex: 'W = F / d', hasError: true, errorReason: 'Work is force times distance, not divided.' }
      ],
      correctStepLatex: 'W = F \\cdot d'
    },
    notebookData: {
      symbol_table: [
        { symbol: 'W', meaning: 'Mechanical work done', unit: 'Joule (J)' },
        { symbol: 'F', meaning: 'Applied constant force magnitude', unit: 'Newton (N)' },
        { symbol: 'd', meaning: 'Displacement magnitude along motion', unit: 'meter (m)' },
        { symbol: 'theta', meaning: 'Angle between force and displacement', unit: 'degrees (deg)' }
      ],
      in_plain_words: 'Work measures energy transferred when a force causes an object to move in its direction. No displacement means zero work.',
      problem_breakdown: {
        restate: 'A constant horizontal force of F = 250 N moves an object by d = 0.12 m in the direction of the force. Calculate the work done.',
        given: [
          'F = 250 N',
          'd = 0.12 m',
          'theta = 0 deg'
        ],
        formula_master: 'W = F * d * cos(theta)',
        formula_working: 'W = F * d'
      },
      solution_steps: `1. Write the formula:
W = F * d

2. Substitute the numbers:
W = 250 * 0.12

3. Multiply:
W = 30.00 J`,
      key_takeaway: 'Work represents the line integral of force over displacement. For constant collinear force, it simplifies to simple multiplication.',
      practice_problem: {
        question: 'A constant horizontal force of 45 N pushes a crate across 4.0 m of smooth floor in the same direction. Calculate the work done.',
        given: ['F = 45 N', 'd = 4.0 m', 'theta = 0 deg'],
        formulaHint: 'W = F * d',
        targetNumeric: 180,
        unit: 'J',
        acceptableUnits: ['j', 'joules', 'joule', 'j.'],
        tolerancePercent: 2,
        explanation: 'W = 45 N * 4.0 m = 180.00 J'
      }
    },
    practiceProblem: {
      question: 'A constant horizontal force of 45 N pushes a crate across 4.0 m of smooth floor in the same direction. Calculate the work done.',
      given: ['F = 45 N', 'd = 4.0 m', 'theta = 0 deg'],
      formulaHint: 'W = F * d',
      targetNumeric: 180,
      unit: 'J',
      acceptableUnits: ['j', 'joules', 'joule', 'j.'],
      tolerancePercent: 2,
      explanation: 'W = 45 N * 4.0 m = 180.00 J'
    }
  },
  {
    id: 'math-power-rate',
    topic: 'Power & Work Rate',
    category: 'Calculus',
    difficulty: 'Intermediate',
    problemLatex: 'P = \\frac{W}{t}',
    description: 'Calculate average mechanical power output.',
    steps: [
      {
        stepNumber: 1,
        latex: 'P = \\frac{W}{t}',
        explanation: 'State formula for power as the time rate of doing work.',
        operationType: 'start',
        operationBadge: 'Formula'
      },
      {
        stepNumber: 2,
        latex: 'P = \\frac{600}{12}',
        explanation: 'Substitute W = 600 J and t = 12 s.',
        operationType: 'substitute',
        operationBadge: 'Substitute'
      },
      {
        stepNumber: 3,
        latex: 'P = 50.00\\text{ W}',
        explanation: 'Divide work by elapsed time to get Watts.',
        operationType: 'final',
        operationBadge: 'Final Answer'
      }
    ],
    whatsNextQuiz: {
      question: 'What is the power when W = 600 J and t = 12 s?',
      options: [
        { textLatex: '50.00\\text{ W}', isCorrect: true, explanation: 'Correct: 600 / 12 = 50 W.' },
        { textLatex: '7200\\text{ W}', isCorrect: false, explanation: 'Incorrect: Multiplied instead of divided.' },
        { textLatex: '0.02\\text{ W}', isCorrect: false, explanation: 'Incorrect: Inverted operands.' },
        { textLatex: '25.00\\text{ W}', isCorrect: false, explanation: 'Incorrect.' }
      ]
    },
    bugHunterQuiz: {
      flawedSteps: [
        { stepNumber: 1, latex: 'P = W \\cdot t', hasError: true, errorReason: 'Power is work divided by time.' }
      ],
      correctStepLatex: 'P = \\frac{W}{t}'
    },
    notebookData: {
      symbol_table: [
        { symbol: 'P', meaning: 'Power output (rate of work)', unit: 'Watt (W)' },
        { symbol: 'W', meaning: 'Mechanical work done', unit: 'Joule (J)' },
        { symbol: 't', meaning: 'Time duration', unit: 'second (s)' }
      ],
      in_plain_words: 'Power measures how quickly work is completed. Doing the same work in half the time requires double the power.',
      problem_breakdown: {
        restate: 'A motor completes 600 J of work in 12 seconds. Calculate its average power output.',
        given: [
          'W = 600 J',
          't = 12 s'
        ],
        formula_master: 'P = dW/dt',
        formula_working: 'P = W / t'
      },
      solution_steps: `1. Write the formula:
P = W / t

2. Substitute the values:
P = 600 / 12

3. Divide:
P = 50.00 W`,
      key_takeaway: 'Power is the derivative of work with respect to time. One Watt equals one Joule transferred per second.',
      practice_problem: {
        question: 'An electric hoist performs 2400 J of work over 8.0 seconds. Calculate the power output in Watts.',
        given: ['W = 2400 J', 't = 8.0 s'],
        formulaHint: 'P = W / t',
        targetNumeric: 300,
        unit: 'W',
        acceptableUnits: ['w', 'watts', 'watt', 'w.'],
        tolerancePercent: 2,
        explanation: 'P = 2400 J / 8.0 s = 300.00 W'
      }
    },
    practiceProblem: {
      question: 'An electric hoist performs 2400 J of work over 8.0 seconds. Calculate the power output in Watts.',
      given: ['W = 2400 J', 't = 8.0 s'],
      formulaHint: 'P = W / t',
      targetNumeric: 300,
      unit: 'W',
      acceptableUnits: ['w', 'watts', 'watt', 'w.'],
      tolerancePercent: 2,
      explanation: 'P = 2400 J / 8.0 s = 300.00 W'
    }
  },
  {
    id: 'math-gravitational-energy',
    topic: 'Gravitational Potential Energy',
    category: 'Calculus',
    difficulty: 'Beginner',
    problemLatex: 'U_g = m \\cdot g \\cdot h',
    description: 'Calculate potential energy stored through elevation in uniform gravity.',
    steps: [
      {
        stepNumber: 1,
        latex: 'U_g = m \\cdot g \\cdot h',
        explanation: 'Master formula for gravitational potential energy near Earth surface.',
        operationType: 'start',
        operationBadge: 'Formula'
      },
      {
        stepNumber: 2,
        latex: 'U_g = (5)(9.80)(4)',
        explanation: 'Substitute mass m = 5 kg, gravity g = 9.80 m/s^2, height h = 4 m.',
        operationType: 'substitute',
        operationBadge: 'Substitute'
      },
      {
        stepNumber: 3,
        latex: 'U_g = 49.00 \\times 4',
        explanation: 'Multiply mass by gravity: 5 * 9.80 = 49.00.',
        operationType: 'simplify',
        operationBadge: 'Multiply'
      },
      {
        stepNumber: 4,
        latex: 'U_g = 196.00\\text{ J}',
        explanation: 'Final product yields stored energy in Joules.',
        operationType: 'final',
        operationBadge: 'Final Answer'
      }
    ],
    whatsNextQuiz: {
      question: 'What is Ug for m = 5 kg, g = 9.80 m/s^2, h = 4 m?',
      options: [
        { textLatex: '196.00\\text{ J}', isCorrect: true, explanation: 'Correct: 5 * 9.80 * 4 = 196 J.' },
        { textLatex: '98.00\\text{ J}', isCorrect: false, explanation: 'Incorrect.' },
        { textLatex: '200.00\\text{ J}', isCorrect: false, explanation: 'Incorrect approximation.' },
        { textLatex: '49.00\\text{ J}', isCorrect: false, explanation: 'Forgot height factor.' }
      ]
    },
    bugHunterQuiz: {
      flawedSteps: [
        { stepNumber: 1, latex: 'U_g = \\frac{1}{2} m g h', hasError: true, errorReason: 'Gravitational PE does not have 1/2 factor.' }
      ],
      correctStepLatex: 'U_g = m \\cdot g \\cdot h'
    },
    notebookData: {
      symbol_table: [
        { symbol: 'Ug', meaning: 'Gravitational potential energy (stored from height)', unit: 'Joule (J)' },
        { symbol: 'm', meaning: 'Mass of the object', unit: 'kilogram (kg)' },
        { symbol: 'g', meaning: 'Acceleration due to gravity (9.80 on Earth)', unit: 'm/s^2' },
        { symbol: 'h', meaning: 'Elevation above chosen datum', unit: 'meter (m)' }
      ],
      in_plain_words: 'Energy stored equals mass times gravity times height. The higher and heavier an object, the more energy it stores.',
      problem_breakdown: {
        restate: 'A 5.0 kg mass is lifted 4.0 m above the ground in standard gravity (g = 9.80 m/s^2). Calculate stored gravitational energy.',
        given: [
          'm = 5.0 kg',
          'g = 9.80 m/s^2',
          'h = 4.0 m'
        ],
        formula_master: 'Ug = m * g * h',
        formula_working: 'Ug = m * g * h'
      },
      solution_steps: `1. Write the formula:
Ug = m * g * h

2. Substitute values:
Ug = 5.0 * 9.80 * 4.0

3. Multiply:
Ug = 196.00 J`,
      key_takeaway: 'Gravitational energy represents conservative work done against a uniform gravitational field.',
      practice_problem: {
        question: 'A 2.5 kg textbook is lifted onto a shelf 2.0 m high. Take g = 9.80 m/s^2. Calculate the gravitational potential energy.',
        given: ['m = 2.5 kg', 'g = 9.80 m/s²', 'h = 2.0 m'],
        formulaHint: 'Ug = m * g * h',
        targetNumeric: 49,
        unit: 'J',
        acceptableUnits: ['j', 'joules', 'joule', 'j.'],
        tolerancePercent: 2,
        explanation: 'Ug = 2.5 kg * 9.80 m/s² * 2.0 m = 49.00 J'
      }
    },
    practiceProblem: {
      question: 'A 2.5 kg textbook is lifted onto a shelf 2.0 m high. Take g = 9.80 m/s^2. Calculate the gravitational potential energy.',
      given: ['m = 2.5 kg', 'g = 9.80 m/s²', 'h = 2.0 m'],
      formulaHint: 'Ug = m * g * h',
      targetNumeric: 49,
      unit: 'J',
      acceptableUnits: ['j', 'joules', 'joule', 'j.'],
      tolerancePercent: 2,
      explanation: 'Ug = 2.5 kg * 9.80 m/s² * 2.0 m = 49.00 J'
    }
  },
  {
    id: 'math-balloon-elasticity',
    topic: 'Expansion of a Balloon Over Time: Elasticity & Related Rates',
    category: 'Calculus',
    difficulty: 'Intermediate',
    problemLatex: '\\frac{dr}{dt} = \\frac{\\frac{dV}{dt}}{4\\pi r^2}',
    description: 'Calculate the instantaneous radial expansion rate dr/dt of an elastic spherical balloon inflating under constant air inflow.',
    steps: [
      {
        stepNumber: 1,
        latex: 'V = \\frac{4}{3}\\pi r^3',
        explanation: 'State master geometric formula relating balloon volume V to radius r.',
        operationType: 'start',
        operationBadge: 'Formula'
      },
      {
        stepNumber: 2,
        latex: '\\frac{dV}{dt} = 4\\pi r^2 \\frac{dr}{dt}',
        explanation: 'Differentiate both sides with respect to time t using the chain rule.',
        operationType: 'simplify',
        operationBadge: 'Derivative'
      },
      {
        stepNumber: 3,
        latex: '\\frac{dr}{dt} = \\frac{\\frac{dV}{dt}}{4\\pi r^2}',
        explanation: 'Isolate radial expansion rate dr/dt by dividing both sides by surface area 4*pi*r^2.',
        operationType: 'simplify',
        operationBadge: 'Working Form'
      },
      {
        stepNumber: 4,
        latex: '\\frac{dr}{dt} = \\frac{400}{4\\pi (10)^2}',
        explanation: 'Substitute given values: inflation rate dV/dt = 400 cm³/s and instantaneous radius r = 10 cm.',
        operationType: 'substitute',
        operationBadge: 'Substitute'
      },
      {
        stepNumber: 5,
        latex: '\\frac{dr}{dt} = \\frac{400}{400\\pi} = \\frac{1}{\\pi}',
        explanation: 'Simplify denominator 4*pi*100 = 400*pi and cancel the common factor of 400.',
        operationType: 'cancel',
        operationBadge: 'Cancel'
      },
      {
        stepNumber: 6,
        latex: '\\frac{dr}{dt} \\approx 0.32\\text{ cm/s}',
        explanation: 'Evaluate numerical quotient: 1 / 3.14159 ≈ 0.32 cm/s.',
        operationType: 'final',
        operationBadge: 'Final Answer'
      }
    ],
    whatsNextQuiz: {
      question: 'What happens to the radial expansion velocity dr/dt as the balloon radius continues to grow larger?',
      options: [
        { textLatex: '\\text{It decreases inversely proportional to } r^2', isCorrect: true, explanation: 'Correct: dr/dt = (dV/dt)/(4*pi*r^2), so larger radius means greater surface area and slower radial growth.' },
        { textLatex: '\\text{It remains constant}', isCorrect: false, explanation: 'Incorrect: While dV/dt is constant, surface area increases quadratically.' },
        { textLatex: '\\text{It accelerates exponentially}', isCorrect: false, explanation: 'Incorrect: Air must distribute over greater surface area, decelerating radius growth.' },
        { textLatex: '\\text{It drops to zero immediately}', isCorrect: false, explanation: 'Incorrect: It continuously approaches zero asymptotically but does not drop instantly.' }
      ]
    },
    bugHunterQuiz: {
      flawedSteps: [
        { stepNumber: 2, latex: '\\frac{dV}{dt} = \\frac{4}{3}\\pi r^2 \\frac{dr}{dt}', hasError: true, errorReason: 'Forgot power rule multiplier: d/dr(r^3) = 3r^2, which cancels the 1/3 to leave 4*pi*r^2.' }
      ],
      correctStepLatex: '\\frac{dV}{dt} = 4\\pi r^2 \\frac{dr}{dt}'
    },
    notebookData: {
      symbol_table: [
        { symbol: 'V', meaning: 'Internal volume of spherical balloon', unit: 'cubic centimeter (cm³)' },
        { symbol: 'r', meaning: 'Radius of balloon', unit: 'centimeter (cm)' },
        { symbol: 't', meaning: 'Elapsed time', unit: 'second (s)' },
        { symbol: 'dV/dt', meaning: 'Volume inflation rate from pump', unit: 'cubic centimeters per second (cm³/s)' },
        { symbol: 'dr/dt', meaning: 'Instantaneous rate of radial expansion', unit: 'centimeters per second (cm/s)' },
        { symbol: 'A', meaning: 'Instantaneous surface area of sphere (4*pi*r²)', unit: 'square centimeters (cm²)' }
      ],
      in_plain_words: 'As an elastic balloon fills with air at a constant rate, its radius grows quickly at first, but slows down dramatically as it gets bigger. This happens because the incoming volume must spread out across a much larger surface area that scales with the square of the radius.',
      problem_breakdown: {
        restate: 'A spherical elastic balloon is inflated with helium at a constant rate of 400 cm³/s. Find the instantaneous rate at which the radius is increasing when the radius is exactly 10 cm.',
        given: [
          'dV/dt = 400 cm³/s',
          'r = 10 cm',
          'Spherical volume V = (4/3) * pi * r³'
        ],
        formula_master: 'V = (4/3) * pi * r³',
        formula_working: 'dr/dt = (dV/dt) / (4 * pi * r²)'
      },
      solution_steps: `1. Write the formula:
dr/dt = (dV/dt) / (4 * pi * r^2)

2. Substitute the numbers:
dr/dt = 400 / (4 * pi * (10)^2)

3. Square the radius:
dr/dt = 400 / (4 * pi * 100)

4. Multiply denominator:
dr/dt = 400 / (400 * pi)

5. Cancel 400:
dr/dt = 1 / pi

6. Final numeric value:
dr/dt = 0.32 cm/s`,
      key_takeaway: 'Related rates link physical flow rates to spatial expansion rates through the chain rule; radial growth is inversely proportional to instantaneous surface area.',
      practice_problem: {
        question: 'If the balloon inflation rate is increased to 900 cm³/s, calculate the rate of radius expansion dr/dt when the radius r is 15 cm. Round to 2 decimal places with SI unit.',
        given: ['dV/dt = 900 cm³/s', 'r = 15 cm'],
        formulaHint: 'dr/dt = (dV/dt) / (4 * pi * r^2)',
        targetNumeric: 0.32,
        unit: 'cm/s',
        acceptableUnits: ['cm/s', 'cm / s', 'centimeters/second', 'cm s^-1'],
        tolerancePercent: 2,
        explanation: 'dr/dt = 900 / (4 * pi * 15^2) = 900 / (900 * pi) = 1/pi ≈ 0.32 cm/s'
      }
    },
    practiceProblem: {
      question: 'If the balloon inflation rate is increased to 900 cm³/s, calculate the rate of radius expansion dr/dt when the radius r is 15 cm. Round to 2 decimal places with SI unit.',
      given: ['dV/dt = 900 cm³/s', 'r = 15 cm'],
      formulaHint: 'dr/dt = (dV/dt) / (4 * pi * r^2)',
      targetNumeric: 0.32,
      unit: 'cm/s',
      acceptableUnits: ['cm/s', 'cm / s', 'centimeters/second', 'cm s^-1'],
      tolerancePercent: 2,
      explanation: 'dr/dt = 900 / (4 * pi * 15^2) = 900 / (900 * pi) = 1/pi ≈ 0.32 cm/s'
    }
  }
]
