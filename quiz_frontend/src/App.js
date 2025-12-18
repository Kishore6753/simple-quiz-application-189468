import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

/**
 * Local quiz data (no backend). Each question has a stable id and one correct option index.
 * Keep this simple and offline-friendly per requirements.
 */
const QUESTIONS = [
  {
    id: 'q1',
    question: 'Which HTML element is used to include JavaScript code?',
    options: ['<javascript>', '<js>', '<script>', '<code>'],
    correctIndex: 2,
  },
  {
    id: 'q2',
    question: 'In React, which hook is primarily used to manage local component state?',
    options: ['useState', 'useFetch', 'useStore', 'useData'],
    correctIndex: 0,
  },
  {
    id: 'q3',
    question: 'Which CSS property controls the size of text?',
    options: ['font-style', 'text-size', 'font-size', 'letter-spacing'],
    correctIndex: 2,
  },
  {
    id: 'q4',
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

/**
 * Create a stable subset of questions for the selected difficulty.
 * We keep order stable (first N questions) for determinism + tests.
 */
function getQuestionsForDifficulty(allQuestions, difficulty) {
  const preset = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.Easy;
  const n = Math.min(preset.questionCount, allQuestions.length);
  return allQuestions.slice(0, n);
}

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
   * Per-question countdown state.
   * We reset this when the question changes.
   */
  const [timeRemainingSec, setTimeRemainingSec] = useState(settings.timePerQuestionSec);

  // Keep the latest "has user answered" information available to the timer tick callback.
  const hasAnsweredRef = useRef(false);

  const totalQuestions = runQuestions.length;
  const currentQuestion = runQuestions[currentIndex];

  const selectedIndexForCurrent = answersById[currentQuestion?.id];
  const hasSelectedForCurrent = typeof selectedIndexForCurrent === 'number';

  useEffect(() => {
    hasAnsweredRef.current = hasSelectedForCurrent;
  }, [hasSelectedForCurrent]);

  const isLastQuestion = totalQuestions > 0 && currentIndex === totalQuestions - 1;

  const difficultyPreset = DIFFICULTY_PRESETS[settings.difficulty] ?? DIFFICULTY_PRESETS.Easy;

  const rawCorrectCount = useMemo(() => {
    return runQuestions.reduce((acc, q) => {
      const selected = answersById[q.id];
      if (typeof selected === 'number' && selected === q.correctIndex) return acc + 1;
      return acc;
    }, 0);
  }, [answersById, runQuestions]);

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
    setPhase('summary');
  };

  // PUBLIC_INTERFACE
  const goNext = ({ allowWithoutAnswer } = { allowWithoutAnswer: false }) => {
    // Guard: in manual "Next", require answer. In timeout auto-advance, allow without answer.
    if (!allowWithoutAnswer && !hasSelectedForCurrent) return;

    if (isLastQuestion) {
      endQuiz();
      return;
    }

    setCurrentIndex((i) => i + 1);
  };

  // When question changes during quiz, reset timer.
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
    const questionsForRun = getQuestionsForDifficulty(QUESTIONS, settings.difficulty);
    setRunQuestions(questionsForRun);
    setAnswersById({});
    setCurrentIndex(0);
    setPhase('quiz');
    resetTimerForQuestion(settings.timePerQuestionSec);
  };

  // PUBLIC_INTERFACE
  const restart = () => {
    setPhase('start');
    setRunQuestions([]);
    setAnswersById({});
    setCurrentIndex(0);
    resetTimerForQuestion(settings.timePerQuestionSec);
  };

  const renderStartScreen = () => {
    return (
      <>
        <header className="cardHeader">
          <span className="badge">Quick Quiz</span>
          <h1 className="resultTitle">Start a new run</h1>
          <p className="resultSubtitle">Pick your difficulty and time per question.</p>
        </header>

        <div className="settingsGrid" aria-label="Quiz settings">
          <label className="field">
            <span className="fieldLabel">Difficulty</span>
            <select
              className="select"
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
              {`Questions: ${Math.min(DIFFICULTY_PRESETS[settings.difficulty].questionCount, QUESTIONS.length)} • Multiplier: ${DIFFICULTY_PRESETS[settings.difficulty].multiplier}x`}
            </span>
          </label>

          <label className="field">
            <span className="fieldLabel">Time per question</span>
            <select
              className="select"
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
        </div>

        <footer className="cardFooter">
          <div className="hint">
            <span className="hintWait">Settings apply to this run only.</span>
          </div>
          <div className="actions">
            <button type="button" className="primaryBtn" onClick={startQuiz}>
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

    return (
      <>
        <header className="cardHeader">
          <div className="progressRow">
            <span className="progressLabel">
              Question <strong>{currentIndex + 1}</strong> of <strong>{totalQuestions}</strong>
              <span className="metaPill" aria-label="Selected difficulty">
                {settings.difficulty}
              </span>
            </span>
            <div className="progressTrack" aria-hidden="true">
              <div className="progressFill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="questionTopRow">
            <h1 className="question" id={`question-${currentQuestion.id}`}>
              {currentQuestion.question}
            </h1>

            <div className="timerWrap" aria-label="Time remaining">
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
          {currentQuestion.options.map((opt, idx) => {
            const isSelected = selectedIndexForCurrent === idx;
            return (
              <button
                key={opt}
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
            <button type="button" className="primaryBtn" onClick={() => goNext()} disabled={!hasSelectedForCurrent}>
              {isLastQuestion ? 'Finish' : 'Next'}
            </button>
          </div>
        </footer>
      </>
    );
  };

  const renderSummaryScreen = () => {
    return (
      <>
        <header className="cardHeader">
          <span className="badge">Quiz Complete</span>
          <h1 className="resultTitle">Your score</h1>
          <p className="resultScore">
            <strong>
              {scoreDisplay} / {totalQuestions * difficultyPreset.multiplier}
            </strong>
          </p>
          <p className="resultSubtitle">
            Difficulty: <strong>{settings.difficulty}</strong> • Multiplier:{' '}
            <strong>{difficultyPreset.multiplier}x</strong> • Time per question:{' '}
            <strong>{settings.timePerQuestionSec}s</strong>
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
            <span className="summaryLabel">Score (after multiplier)</span>
            <span className="summaryValue">{scoreDisplay}</span>
          </div>
        </div>

        <footer className="cardFooter">
          <div className="actions">
            <button type="button" className="secondaryBtn" onClick={restart}>
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
