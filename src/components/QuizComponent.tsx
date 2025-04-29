import React from 'react';

// Define the structure for a single question
interface Question {
  q: string;
  opts: string[];
  ans: string; // Although not used for display, it's part of the data structure
}

// Define the structure for the entire quiz data
interface QuizData {
  title: string;
  questions: Question[];
}

// Define the props for the QuizComponent
interface QuizComponentProps {
  quizData: QuizData;
}

// Basic styling object
const styles: { [key: string]: React.CSSProperties } = {
  quizContainer: {
    padding: '20px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    margin: '20px 0',
    fontFamily: 'sans-serif', // Basic font for readability
  },
  title: {
    marginBottom: '20px',
    fontSize: '1.5em',
    fontWeight: 'bold',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
  },
  questionBlock: {
    marginBottom: '20px', // Increased spacing between questions
  },
  questionText: {
    fontWeight: 'bold',
    marginBottom: '10px',
    fontSize: '1.1em',
  },
  optionsList: {
    listStyleType: 'none',
    paddingLeft: '20px',
    margin: 0, // Reset default margin
  },
  optionItem: {
    marginBottom: '8px', // Increased spacing for options
    padding: '5px',
    border: '1px solid #eee',
    borderRadius: '4px',
  },
};

// The QuizComponent functional component
const QuizComponent: React.FC<QuizComponentProps> = ({ quizData }) => {
  // Add a check for empty or undefined quizData
  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
    return <div style={styles.quizContainer}>No quiz data available or quiz is empty.</div>;
  }

  return (
    <div style={styles.quizContainer}>
      <h2 style={styles.title}>{quizData.title}</h2>
      {quizData.questions.map((question, index) => (
        <div key={index} style={styles.questionBlock}>
          <p style={styles.questionText}>{`${index + 1}. ${question.q}`}</p>
          <ul style={styles.optionsList}>
            {question.opts.map((option, optIndex) => (
              <li key={optIndex} style={styles.optionItem}>
                {option}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default QuizComponent;