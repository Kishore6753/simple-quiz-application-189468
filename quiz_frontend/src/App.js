import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

/**
 * Local quiz data (no backend). Each question has a stable id and one correct option index.
 * Keep this simple and offline-friendly per requirements.
 *
 * We also add a `difficulty` tag per question to support optional "adaptive mode".
 * Difficulty is used only for *selection ordering*; scoring remains based on the selected run difficulty multiplier.
 */
const QUESTIONS = [
  {
    id: 'q1',
    difficulty: 'Easy',
    question: 'Which HTML element is used to include JavaScript code?',
    options: ['<javascript>', '<js>', '<script>', '<code>'],
    correctIndex: 2,
  },
  {
    id: 'q2',
    difficulty: 'Easy',
    question: 'In React, which hook is primarily used to manage local component state?',
    options: ['useState', 'useFetch', 'useStore', 'useData'],
    correctIndex: 0,
  },
  {
    id: 'q3',
    difficulty: 'Medium',
    question: 'Which CSS property controls the size of text?',
    options: ['font-style', 'text-size', 'font-size', 'letter-spacing'],
    correctIndex: 2,
  },
  {
    id: 'q4',
    difficulty: 'Medium',
    question: 'What does JSON stand for?',
    options: [
      'Java Source Object Notation',
      'JavaScript Object Notation',
      'Joined Standard Output Name',
      'Java Syntax Oriented Namespace',
    ],
    correctIndex: 1,
  },
  {
    id: 'q5',
    difficulty: 'Hard',
    question: 'Which of the following best describes a REST API?',
    options: [
      'A database query language',
      'A way to style web pages',
      'An architectural style for web services',
      'A browser rendering engine',
    ],
    correctIndex: 2,
  },
];

/**
 * Difficulty presets:
 * - questionCount: subset size used for this run
 * - multiplier: scoring multiplier for this run
 */
const DIFFICULTY_PRESETS = {
  Easy: { questionCount: 5, multiplier: 1 },
  Medium: { questionCount: 8, multiplier: 1.5 },
  Hard: { questionCount: 10, multiplier: 2 },
};

const TIME_OPTIONS_SECONDS = [15, 20, 25, 30];

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];
const ADAPTIVE_WINDOW_N = 5;

/**
 * Achievements:
 * - 5-in-a-row: reach a 5 correct streak at any point
 * - 10-in-a-row: reach a 10 correct streak at any point
 * - Perfect Score: all answers correct (evaluated at end)
 */
const BADGES = [
  { id: 'streak-5', label: '5-in-a-row' },
  { id: 'streak-10', label: '10-in-a-row' },
  { id: 'perfect', label: 'Perfect Score' },
];

// PUBLIC_INTERFACE
function App() {
  /**
   * Phase flow:
   * - start: choose difficulty + timer duration for this run
   * - quiz: answering questions
   * - summary: results
   */
  const [phase, setPhase] = useState('start');

  /** Persisted settings for the current run. */
  const [settings, setSettings] = useState({
    difficulty: 'Easy',
    timePerQuestionSec: 20,
    shuffleEnabled: true,
    adaptiveEnabled: false,
  });

  /** Questions used for the current run. This is fixed once the quiz starts. */
  const [runQuestions, setRunQuestions] = useState([]);

  /** Index of the current question being displayed (within runQuestions). */
  const [currentIndex, setCurrentIndex] = useState(0);

  /**
   * Map of { [questionId]: selectedOptionIndex }.
   * Missing key => unanswered (counts as incorrect).
   */
  const [answersById, setAnswersById] = useState({});

  /**
   * Map of { [questionId]: { options: string[], correctIndex: number } }
   * Used to support shuffling options while preserving correctness.
   */
  const [optionsByQuestionId, setOptionsByQuestionId] = useState({});

  /** Streaks and achievements for this run. */
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState([]);

  /** Recent correctness history for adaptive mode. */
  const [recentCorrectness, setRecentCorrectness] = useState([]);

  /**
   * Per-question countdown state.
   * We reset this when the question changes.
   */
  const [timeRemainingSec, setTimeRemainingSec] = useState(settings.timePerQuestionSec);

  // Keep the latest "has user answered" information available to the timer tick callback.
  const hasAnsweredRef = useRef(false);

  // Keep the latest values needed by the timer callback without re-registering interval.
  const phaseRef = useRef(phase);
  const currentIndexRef = useRef(currentIndex);
  const runQuestionsRef = useRef(runQuestions);
  const answersByIdRef = useRef(answersById);
  const optionsByQuestionIdRef = useRef(optionsByQuestionId);
  const timePerQuestionRef = useRef(settings.timePerQuestionSec);
  const currentStreakRef = useRef(currentStreak);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    runQuestionsRef.current = runQuestions;
  }, [runQuestions]);
  useEffect(() => {
    answersByIdRef.current = answersById;
  }, [answersById]);
  useEffect(() => {
    optionsByQuestionIdRef.current = optionsByQuestionId;
  }, [optionsByQuestionId]);
  useEffect(() => {
    timePerQuestionRef.current = settings.timePerQuestionSec;
  }, [settings.timePerQuestionSec]);
  useEffect(() => {
    currentStreakRef.current = currentStreak;
  }, [currentStreak]);

  const totalQuestions = runQuestions.length;
  const currentQuestion = runQuestions[currentIndex];

  const currentOptionsEntry = currentQuestion ? optionsByQuestionId[currentQuestion.id] : null;

  const selectedIndexForCurrent = currentQuestion ? answersById[currentQuestion.id] : undefined;
  const hasSelectedForCurrent = typeof selectedIndexForCurrent === 'number';

  useEffect(() => {
    hasAnsweredRef.current = hasSelectedForCurrent;
  }, [hasSelectedForCurrent]);

  const isLastQuestion = totalQuestions > 0 && currentIndex === totalQuestions - 1;

  const difficultyPreset = DIFFICULTY_PRESETS[settings.difficulty] ?? DIFFICULTY_PRESETS.Easy;

  const rawCorrectCount = useMemo(() => {
    return runQuestions.reduce((acc, q) => {
      const selected = answersById[q.id];
      const correctIndex = optionsByQuestionId[q.id]?.correctIndex ?? q.correctIndex;
      if (typeof selected === 'number' && selected === correctIndex) return acc + 1;
      return acc;
    }, 0);
  }, [answersById, runQuestions, optionsByQuestionId]);

  const finalScore = useMemo(() => {
    // Keep score reasonably presentable; can be fractional if multiplier is 1.5
    return rawCorrectCount * difficultyPreset.multiplier;
  }, [rawCorrectCount, difficultyPreset.multiplier]);

  const scoreDisplay = useMemo(() => {
    const score = finalScore;
    if (Number.isInteger(score)) return String(score);
    return score.toFixed(1);
  }, [finalScore]);

  const progressPercent = useMemo(() => {
    if (!totalQuestions) return 0;
    return ((currentIndex + 1) / totalQuestions) * 100;
  }, [currentIndex, totalQuestions]);

  const timeProgress = useMemo(() => {
    const total = settings.timePerQuestionSec;
    if (!total) return 0;
    return Math.max(0, Math.min(1, timeRemainingSec / total));
  }, [timeRemainingSec, settings.timePerQuestionSec]);

  const earnedBadgesForRibbon = useMemo(() => {
    return BADGES.filter((b) => earnedBadgeIds.includes(b.id));
  }, [earnedBadgeIds]);

  const recentAccuracyPercent = useMemo(() => {
    if (!recentCorrectness.length) return null;
    const correct = recentCorrectness.reduce((acc, v) => acc + (v ? 1 : 0), 0);
    return (correct / recentCorrectness.length) * 100;
  }, [recentCorrectness]);

  // Deterministic RNG support for tests:
  // - In normal runtime, uses Math.random()
  // - In tests, if window.__TEST_RANDOM_SEED__ is set, uses a seeded LCG for deterministic order
  function makeRng() {
    const maybeSeed = typeof window !== 'undefined' && typeof window.__TEST_RANDOM_SEED__ === 'number'
      ? window.__TEST_RANDOM_SEED__
      : null;

    if (maybeSeed == null) {
      // Use native random
      return () => Math.random();
    }

    // Simple LCG: X_{n+1} = (aX_n + c) mod m
    // Parameters from Numerical Recipes: a=1664525, c=1013904223, m=2^32
    let state = maybeSeed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      // Scale to [0,1)
      return state / 0x100000000;
    };
  }

  const rngRef = useRef(null);
  if (rngRef.current == null) {
    rngRef.current = makeRng();
  }
  function randomInt(maxExclusive) {
    const r = rngRef.current ? rngRef.current() : Math.random();
    return Math.floor(r * maxExclusive);
  }

  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function clampDifficulty(difficulty) {
    if (DIFFICULTY_ORDER.includes(difficulty)) return difficulty;
    return 'Easy';
  }

  function difficultyToRank(difficulty) {
    return DIFFICULTY_ORDER.indexOf(clampDifficulty(difficulty));
  }

  function rankToDifficulty(rank) {
    const clamped = Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, rank));
    return DIFFICULTY_ORDER[clamped];
  }

  function nextAdaptiveDifficultyFromRecent(recent) {
    // Heuristic:
    // - if accuracy >= 80%, try harder (rank +1)
    // - if accuracy <= 40%, try easier (rank -1)
    // - otherwise hold
    const window = recent.slice(-ADAPTIVE_WINDOW_N);
    if (!window.length) return null;
    const correctCount = window.reduce((acc, v) => acc + (v ? 1 : 0), 0);
    const accPct = (correctCount / window.length) * 100;

    if (accPct >= 80) return { direction: 'harder', accPct };
    if (accPct <= 40) return { direction: 'easier', accPct };
    return { direction: 'hold', accPct };
  }

  function makeOptionShuffleMap(questionsForRun, enabled) {
    const map = {};
    questionsForRun.forEach((q) => {
      if (!enabled) {
        map[q.id] = { options: q.options, correctIndex: q.correctIndex };
        return;
      }

      const indexed = q.options.map((opt, idx) => ({ opt, idx }));
      const shuffled = shuffleArray(indexed);
      const newOptions = shuffled.map((x) => x.opt);
      const newCorrectIndex = shuffled.findIndex((x) => x.idx === q.correctIndex);

      map[q.id] = {
        options: newOptions,
        correctIndex: newCorrectIndex,
      };
    });
    return map;
  }

  function getQuestionsForInitialDifficulty(allQuestions, difficulty) {
    const preset = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.Easy;
    const n = Math.min(preset.questionCount, allQuestions.length);

    // Selection pool: for adaptive mode, we prefer ordering by question difficulty around initial.
    // We still take only N questions for the run (run length equals "difficulty preset questionCount").
    return { n };
  }

  function computeRunQuestionOrder({ allQuestions, initialDifficulty, shuffleEnabled, adaptiveEnabled }) {
    const { n } = getQuestionsForInitialDifficulty(allQuestions, initialDifficulty);

    // Base pool: all questions. With small local list, adaptive is mostly illustrative but functional.
    // We always return a fixed-length run.
    let ordered = [...allQuestions];

    if (adaptiveEnabled) {
      const initialRank = difficultyToRank(initialDifficulty);

      // Sort by "distance" from initial difficulty, with deterministic tie-breaking when shuffle is on.
      ordered.sort((a, b) => {
        const da = Math.abs(difficultyToRank(a.difficulty) - initialRank);
        const db = Math.abs(difficultyToRank(b.difficulty) - initialRank);
        if (da !== db) return da - db;

        if (shuffleEnabled) {
          // Use seeded pseudo-random tie-breaker
          // Derive stable pseudo-random by comparing randomInt across call
          const ra = randomInt(1 << 30);
          const rb = randomInt(1 << 30);
          return ra - rb;
        }
        return String(a.id).localeCompare(String(b.id));
      });
    } else if (shuffleEnabled) {
      ordered = shuffleArray(ordered);
    }

    // Ensure stable subset size.
    return ordered.slice(0, n);
  }

  function awardBadgeIfNeeded(badgeId) {
    setEarnedBadgeIds((prev) => {
      if (prev.includes(badgeId)) return prev;
      return [...prev, badgeId];
    });
  }

  function updateStreaksAndBadges(isCorrect) {
    setCurrentStreak((prev) => {
      const next = isCorrect ? prev + 1 : 0;

      // Update best streak
      setBestStreak((bestPrev) => Math.max(bestPrev, next));

      // Award streak badges at thresholds.
      if (next >= 5) awardBadgeIfNeeded('streak-5');
      if (next >= 10) awardBadgeIfNeeded('streak-10');

      return next;
    });
  }

  function updateRecentCorrectness(isCorrect) {
    setRecentCorrectness((prev) => {
      const next = [...prev, isCorrect].slice(-ADAPTIVE_WINDOW_N);
      return next;
    });
  }

  function getEffectiveDifficultyLabel() {
    if (!settings.adaptiveEnabled) return settings.difficulty;
    // When adaptive is enabled, difficulty selection is the initial difficulty only.
    return `${settings.difficulty} (initial)`;
  }

  // PUBLIC_INTERFACE
  const selectOption = (questionId, optionIndex) => {
    setAnswersById((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const resetTimerForQuestion = (durationSec) => {
    setTimeRemainingSec(durationSec);
  };

  const endQuiz = () => {
    // Perfect score badge is computed at end (includes timeouts/unanswered).
    const rq = runQuestionsRef.current;
    const ans = answersByIdRef.current;
    const optMap = optionsByQuestionIdRef.current;

    const correctCount = rq.reduce((acc, q) => {
      const selected = ans[q.id];
      const correctIndex = optMap[q.id]?.correctIndex ?? q.correctIndex;
      if (typeof selected === 'number' && selected === correctIndex) return acc + 1;
      return acc;
    }, 0);

    if (rq.length > 0 && correctCount === rq.length) {
      awardBadgeIfNeeded('perfect');
    }

    setPhase('summary');
  };

  function evaluateAnswerForQuestion(question, selectedIndex) {
    const correctIndex = optionsByQuestionIdRef.current[question.id]?.correctIndex ?? question.correctIndex;
    return typeof selectedIndex === 'number' && selectedIndex === correctIndex;
  }

  function computeNextIndexAdaptive(currentIdx, recent) {
    const rq = runQuestionsRef.current;
    const currentQ = rq[currentIdx];
    if (!currentQ) return currentIdx + 1;

    const suggestion = nextAdaptiveDifficultyFromRecent(recent);
    if (!suggestion || suggestion.direction === 'hold') return currentIdx + 1;

    const currentRank = difficultyToRank(currentQ.difficulty);
    const desiredRank =
      suggestion.direction === 'harder' ? currentRank + 1 : suggestion.direction === 'easier' ? currentRank - 1 : currentRank;
    const desiredDifficulty = rankToDifficulty(desiredRank);

    const unanswered = rq
      .map((q, idx) => ({ q, idx }))
      .filter(({ q, idx }) => idx > currentIdx && answersByIdRef.current[q.id] === undefined);

    // First try to find a question exactly matching desired difficulty.
    const exact = unanswered.find(({ q }) => clampDifficulty(q.difficulty) === desiredDifficulty);
    if (exact) return exact.idx;

    // If none, keep normal sequential progression.
    return currentIdx + 1;
  }

  // PUBLIC_INTERFACE
  const goNext = ({ allowWithoutAnswer } = { allowWithoutAnswer: false }) => {
    const rq = runQuestionsRef.current;
    const idx = currentIndexRef.current;
    const q = rq[idx];

    if (!q) return;

    const selected = answersByIdRef.current[q.id];

    // Guard: in manual "Next", require answer. In timeout auto-advance, allow without answer.
    if (!allowWithoutAnswer && typeof selected !== 'number') return;

    // Compute correctness (unanswered => incorrect).
    const isCorrect = evaluateAnswerForQuestion(q, selected);
    updateStreaksAndBadges(isCorrect);
    updateRecentCorrectness(isCorrect);

    const isLast = rq.length > 0 && idx === rq.length - 1;
    if (isLast) {
      endQuiz();
      return;
    }

    if (settings.adaptiveEnabled) {
      const nextRecent = [...recentCorrectness, isCorrect].slice(-ADAPTIVE_WINDOW_N);
      const nextIdx = computeNextIndexAdaptive(idx, nextRecent);
      setCurrentIndex(nextIdx);
      return;
    }

    setCurrentIndex((i) => i + 1);
  };

  // When question changes during quiz, reset timer and "answered" state.
  useEffect(() => {
    if (phase !== 'quiz') return;
    resetTimerForQuestion(settings.timePerQuestionSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, phase]);

  // Timer interval while in quiz phase.
  useEffect(() => {
    if (phase !== 'quiz') return;
    if (!currentQuestion) return;

    const intervalId = window.setInterval(() => {
      setTimeRemainingSec((prev) => {
        // If user already answered, do not auto-advance; keep timer from going negative.
        if (hasAnsweredRef.current) return prev;

        if (prev <= 1) {
          // Time expired: unanswered => incorrect by default, auto-advance.
          window.setTimeout(() => {
            // Double-check still unanswered at the moment we advance.
            if (!hasAnsweredRef.current) goNext({ allowWithoutAnswer: true });
          }, 0);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
    // Intentionally exclude goNext from deps to avoid interval restarts due to function identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQuestion?.id]);

  // PUBLIC_INTERFACE
  const startQuiz = () => {
    const questionsForRun = computeRunQuestionOrder({
      allQuestions: QUESTIONS,
      initialDifficulty: settings.difficulty,
      shuffleEnabled: settings.shuffleEnabled,
      adaptiveEnabled: settings.adaptiveEnabled,
    });

    setRunQuestions(questionsForRun);
    setOptionsByQuestionId(makeOptionShuffleMap(questionsForRun, settings.shuffleEnabled));
    setAnswersById({});
    setCurrentIndex(0);
    setPhase('quiz');

    // reset run stats
    setCurrentStreak(0);
    setBestStreak(0);
    setEarnedBadgeIds([]);
    setRecentCorrectness([]);

    resetTimerForQuestion(settings.timePerQuestionSec);
  };

  // PUBLIC_INTERFACE
  const restart = () => {
    setPhase('start');
    setRunQuestions([]);
    setOptionsByQuestionId({});
    setAnswersById({});
    setCurrentIndex(0);

    setCurrentStreak(0);
    setBestStreak(0);
    setEarnedBadgeIds([]);
    setRecentCorrectness([]);

    resetTimerForQuestion(settings.timePerQuestionSec);
  };

  const renderStartScreen = () => {
    const difficultyLabel = settings.adaptiveEnabled ? 'Initial difficulty' : 'Difficulty';
    const difficultyHint = settings.adaptiveEnabled
      ? 'Adaptive Mode will adjust which questions appear next based on your recent accuracy.'
      : 'Questions and score multiplier scale with difficulty.';

    return (
      <>
        <header className="cardHeader">
          <span className="badge" aria-label="Quiz type badge">
            <span className="badgeDot" aria-hidden="true" />
            Quick Quiz
          </span>
          <h1 className="resultTitle">Start a new run</h1>
          <p className="resultSubtitle">Pick your settings before you begin.</p>
        </header>

        <div className="settingsGrid" aria-label="Quiz settings">
          <label className="field">
            <span className="fieldLabel">{difficultyLabel}</span>
            <select
              className="select"
              aria-label={difficultyLabel}
              value={settings.difficulty}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  difficulty: e.target.value,
                }))
              }
            >
              {Object.keys(DIFFICULTY_PRESETS).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span className="fieldHint">
              {`Run length: ${Math.min(DIFFICULTY_PRESETS[settings.difficulty].questionCount, QUESTIONS.length)} • Multiplier: ${
                DIFFICULTY_PRESETS[settings.difficulty].multiplier
              }x • ${difficultyHint}`}
            </span>
          </label>

          <label className="field">
            <span className="fieldLabel">Time per question</span>
            <select
              className="select"
              aria-label="Time per question"
              value={settings.timePerQuestionSec}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  timePerQuestionSec: Number(e.target.value),
                }))
              }
            >
              {TIME_OPTIONS_SECONDS.map((s) => (
                <option key={s} value={s}>
                  {s}s
                </option>
              ))}
            </select>
            <span className="fieldHint">Timer auto-advances if you don’t answer in time.</span>
          </label>

          <div className="field" role="group" aria-label="Modes">
            <span className="fieldLabel">Modes</span>

            <label className="toggleRow">
              <span className="toggleText">
                <span className="toggleLabel">Shuffle <span className="togglePill">default ON</span></span>
              </span>
              <div>
                <input
                  className="toggle"
                  type="checkbox"
                  role="switch"
                  aria-checked={settings.shuffleEnabled}
                  checked={settings.shuffleEnabled}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      shuffleEnabled: e.target.checked,
                    }))
                  }
                  aria-label="Shuffle"
                />
                <span className="toggleStateChip" aria-hidden="true">{settings.shuffleEnabled ? 'On' : 'Off'}</span>
              </div>
            </label>

            <label className="toggleRow">
              <span className="toggleText">
                <span className="toggleLabel">Adaptive Mode <span className="togglePill">default OFF</span></span>
              </span>
              <div>
                <input
                  className="toggle"
                  type="checkbox"
                  role="switch"
                  aria-checked={settings.adaptiveEnabled}
                  checked={settings.adaptiveEnabled}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      adaptiveEnabled: e.target.checked,
                    }))
                  }
                  aria-label="Adaptive Mode"
                />
                <span className="toggleStateChip" aria-hidden="true">{settings.adaptiveEnabled ? 'On' : 'Off'}</span>
              </div>
            </label>

            <span className="fieldHint">
              Shuffle randomizes question order and answer choices. Adaptive Mode adjusts difficulty based on your last{' '}
              {ADAPTIVE_WINDOW_N} answers.
            </span>
          </div>
        </div>

        <footer className="cardFooter">
          <div className="hint">
            <span className="hintWait">Settings apply to this run only.</span>
          </div>
          <div className="actions">
            <button type="button" className="primaryBtn" onClick={startQuiz} aria-label="Start quiz">
              Start Quiz
            </button>
          </div>
        </footer>
      </>
    );
  };

  const renderQuizScreen = () => {
    if (!currentQuestion) return null;

    const total = settings.timePerQuestionSec;
    const optionsToRender = currentOptionsEntry?.options ?? currentQuestion.options;

    return (
      <>
        <header className="cardHeader">
          <div className="progressRow">
            <span className="progressLabel">
              Question <strong>{currentIndex + 1}</strong> of <strong>{totalQuestions}</strong>
              <span className="metaPill" aria-label="Selected difficulty">
                {getEffectiveDifficultyLabel()}
              </span>
            </span>
            <div className="progressTrack" aria-hidden="true">
              <div className="progressFill" style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="ribbonRow" aria-label="Run stats" role="status" aria-live="polite">
              <span className="ribbonItem">
                Streak: <strong>{currentStreak}</strong> (best <strong>{bestStreak}</strong>)
              </span>
              {settings.adaptiveEnabled ? (
                <span className="ribbonItem" aria-label="Recent accuracy">
                  Accuracy (last {ADAPTIVE_WINDOW_N}):{' '}
                  <strong>{recentAccuracyPercent === null ? '—' : `${Math.round(recentAccuracyPercent)}%`}</strong>
                </span>
              ) : null}
            </div>

            {earnedBadgesForRibbon.length ? (
              <div className="badgeRibbon" aria-label="Earned badges">
                {earnedBadgesForRibbon.map((b) => (
                  <span key={b.id} className="miniBadge" role="img" aria-label={`Badge earned: ${b.label}`}>
                    <span className="dot" aria-hidden="true" />
                    {b.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="questionTopRow">
            <h1 className="question" id={`question-${currentQuestion.id}`}>
              {currentQuestion.question}
            </h1>

            <div
              className="timerWrap"
              tabIndex={0}
              aria-label="Time remaining"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="timerRing" aria-hidden="true">
                <svg viewBox="0 0 44 44" className="ringSvg">
                  <circle className="ringTrack" cx="22" cy="22" r="18" />
                  <circle
                    className="ringProgress"
                    cx="22"
                    cy="22"
                    r="18"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 18}`,
                      strokeDashoffset: `${(1 - timeProgress) * 2 * Math.PI * 18}`,
                    }}
                  />
                </svg>
                <span className="ringCenterText">{timeRemainingSec}s</span>
              </div>
              <span className="timerText">
                <strong>{timeRemainingSec}</strong> / {total}s
              </span>
            </div>
          </div>
        </header>

        <div className="options" role="radiogroup" aria-labelledby={`question-${currentQuestion.id}`}>
          {optionsToRender.map((opt, idx) => {
            const isSelected = selectedIndexForCurrent === idx;
            return (
              <button
                key={`${currentQuestion.id}-${opt}`}
                type="button"
                className={`optionBtn ${isSelected ? 'selected' : ''}`}
                onClick={() => selectOption(currentQuestion.id, idx)}
                role="radio"
                aria-checked={isSelected}
              >
                <span className="optionText">{opt}</span>
              </button>
            );
          })}
        </div>

        <footer className="cardFooter">
          <div className="hint" aria-live="polite">
            {hasSelectedForCurrent ? (
              <span className="hintOk">Answer selected</span>
            ) : timeRemainingSec === 0 ? (
              <span className="hintWait">Time’s up — moving on…</span>
            ) : (
              <span className="hintWait">Select an answer before time runs out</span>
            )}
          </div>

          <div className="actions">
            <button
              type="button"
              className="primaryBtn"
              onClick={() => goNext()}
              disabled={!hasSelectedForCurrent}
              aria-label={isLastQuestion ? 'Finish quiz' : 'Go to next question'}
            >
              {isLastQuestion ? 'Finish' : 'Next'}
            </button>
          </div>
        </footer>
      </>
    );
  };

  const renderSummaryScreen = () => {
    const maxScore = totalQuestions * difficultyPreset.multiplier;

    return (
      <>
        <header className="cardHeader">
          <span className="badge">Quiz Complete</span>
          <h1 className="resultTitle">Your score</h1>
          <p className="resultScore">
            <strong>
              {scoreDisplay} / {maxScore}
            </strong>
          </p>
          <p className="resultSubtitle">
            Difficulty: <strong>{getEffectiveDifficultyLabel()}</strong> • Multiplier: <strong>{difficultyPreset.multiplier}x</strong> •
            Time per question: <strong>{settings.timePerQuestionSec}s</strong>
          </p>
        </header>

        <div className="summary">
          <div className="summaryRow">
            <span className="summaryLabel">Correct</span>
            <span className="summaryValue success">{rawCorrectCount}</span>
          </div>
          <div className="summaryRow">
            <span className="summaryLabel">Incorrect</span>
            <span className="summaryValue error">{totalQuestions - rawCorrectCount}</span>
          </div>
          <div className="summaryRow">
            <span className="summaryLabel">Best streak</span>
            <span className="summaryValue">{bestStreak}</span>
          </div>
          <div className="summaryRow">
            <span className="summaryLabel">Badges earned</span>
            <span className="summaryValue">{earnedBadgeIds.length ? earnedBadgeIds.length : '0'}</span>
          </div>

          {earnedBadgeIds.length ? (
            <div className="badgeGrid" aria-label="Badges earned list">
              {BADGES.filter((b) => earnedBadgeIds.includes(b.id)).map((b) => (
                <span key={b.id} className="miniBadge" role="img" aria-label={`Badge earned: ${b.label}`}>
                  <span className="dot" aria-hidden="true" />
                  {b.label}
                </span>
              ))}
            </div>
          ) : (
            <div className="badgeGrid" aria-label="Badges earned list">
              <span className="miniBadge neutral" aria-label="No badges earned">
                <span className="dot" aria-hidden="true" />
                None yet
              </span>
              <span className="emptyBadges">No badges this run — try a longer streak!</span>
            </div>
          )}

          <div className="summaryRow">
            <span className="summaryLabel">Shuffle</span>
            <span className="summaryValue">{settings.shuffleEnabled ? 'On' : 'Off'}</span>
          </div>
          <div className="summaryRow">
            <span className="summaryLabel">Adaptive Mode</span>
            <span className="summaryValue">{settings.adaptiveEnabled ? 'On' : 'Off'}</span>
          </div>

          <div className="summaryRow">
            <span className="summaryLabel">Score (after multiplier)</span>
            <span className="summaryValue">{scoreDisplay}</span>
          </div>
        </div>

        <footer className="cardFooter">
          <div className="actions">
            <button type="button" className="secondaryBtn" onClick={restart} aria-label="Restart quiz">
              Restart Quiz
            </button>
          </div>
        </footer>
      </>
    );
  };

  return (
    <div className="App">
      <main className="page">
        <section className="card" aria-live="polite">
          {phase === 'start' ? renderStartScreen() : null}
          {phase === 'quiz' ? renderQuizScreen() : null}
          {phase === 'summary' ? renderSummaryScreen() : null}
        </section>

        <footer className="pageFooter">
          <span className="footerText">Offline-ready • No backend required</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
