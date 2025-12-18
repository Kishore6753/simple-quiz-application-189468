import React, { useMemo, useState } from 'react';
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

// PUBLIC_INTERFACE
function App() {
  /** Index of the current question being displayed. */
  const [currentIndex, setCurrentIndex] = useState(0);

  /**
   * Map of { [questionId]: selectedOptionIndex }.
   * This allows us to compute score at the end and also keep answers if we add "Back" later.
   */
  const [answersById, setAnswersById] = useState({});

  const totalQuestions = QUESTIONS.length;
  const currentQuestion = QUESTIONS[currentIndex];
  const selectedIndexForCurrent = answersById[currentQuestion?.id];

  const isLastQuestion = currentIndex === totalQuestions - 1;
  const hasSelectedForCurrent = typeof selectedIndexForCurrent === 'number';

  const score = useMemo(() => {
    return QUESTIONS.reduce((acc, q) => {
      const selected = answersById[q.id];
      if (typeof selected === 'number' && selected === q.correctIndex) return acc + 1;
      return acc;
    }, 0);
  }, [answersById]);

  const isComplete = useMemo(() => {
    // Completion is reaching beyond last question (we show summary).
    return currentIndex >= totalQuestions;
  }, [currentIndex, totalQuestions]);

  // PUBLIC_INTERFACE
  const selectOption = (questionId, optionIndex) => {
    setAnswersById((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  // PUBLIC_INTERFACE
  const goNext = () => {
    // Guard: only allow progress when an answer is selected
    if (!hasSelectedForCurrent) return;

    if (isLastQuestion) {
      setCurrentIndex(totalQuestions); // summary screen
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  // PUBLIC_INTERFACE
  const restart = () => {
    setAnswersById({});
    setCurrentIndex(0);
  };

  return (
    <div className="App">
      <main className="page">
        <section className="card" aria-live="polite">
          {!isComplete ? (
            <>
              <header className="cardHeader">
                <div className="progressRow">
                  <span className="progressLabel">
                    Question <strong>{currentIndex + 1}</strong> of <strong>{totalQuestions}</strong>
                  </span>
                  <div className="progressTrack" aria-hidden="true">
                    <div
                      className="progressFill"
                      style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                    />
                  </div>
                </div>

                <h1 className="question" id={`question-${currentQuestion.id}`}>
                  {currentQuestion.question}
                </h1>
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
                  ) : (
                    <span className="hintWait">Select an answer to continue</span>
                  )}
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={goNext}
                    disabled={!hasSelectedForCurrent}
                  >
                    {isLastQuestion ? 'Finish' : 'Next'}
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <>
              <header className="cardHeader">
                <span className="badge">Quiz Complete</span>
                <h1 className="resultTitle">Your score</h1>
                <p className="resultScore">
                  <strong>
                    {score} / {totalQuestions}
                  </strong>
                </p>
                <p className="resultSubtitle">
                  {score === totalQuestions
                    ? 'Perfect score — great job!'
                    : score >= Math.ceil(totalQuestions * 0.7)
                      ? 'Nice work — you’re doing great.'
                      : 'Good effort — try again to improve your score.'}
                </p>
              </header>

              <div className="summary">
                <div className="summaryRow">
                  <span className="summaryLabel">Correct</span>
                  <span className="summaryValue success">{score}</span>
                </div>
                <div className="summaryRow">
                  <span className="summaryLabel">Incorrect</span>
                  <span className="summaryValue error">{totalQuestions - score}</span>
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
          )}
        </section>

        <footer className="pageFooter">
          <span className="footerText">Offline-ready • No backend required</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
