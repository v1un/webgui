import React, { useState } from 'react';
import QuizComponent from '../components/QuizComponent'; // Import the QuizComponent

// Define the expected response structure from the backend
interface AiResponse {
  text?: string; // Optional text response
  quizData?: any; // Optional quiz data (replace 'any' with a specific type if known)
  studyState: object; // The next study state
}

// Define the structure for a chat message
interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  isQuiz?: boolean; // Optional flag to indicate a quiz message
}

const StudyPage: React.FC = () => {
  // State for the current input value
  const [inputValue, setInputValue] = useState<string>('');
  // State for the chat history
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  // State for loading status
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // State for the study state from the backend
  const [studyState, setStudyState] = useState<object | null>(null);
  // State to hold received quiz data for display
  const [currentQuizData, setCurrentQuizData] = useState<any | null>(null);


  // Handler for input changes
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  // Call the backend AI orchestrator API
  const callAiOrchestrator = async (userMessage: string, currentStudyState: object | null): Promise<AiResponse> => {
    setIsLoading(true);
    console.log('Calling backend API for:', userMessage, 'with state:', currentStudyState);
    const backendUrl = 'http://localhost:3000/api/ai/chat'; // Assuming backend runs on port 3000

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send both message and current study state
        body: JSON.stringify({ message: userMessage, studyState: currentStudyState }),
      });

      if (!response.ok) {
        // Handle HTTP errors (e.g., 404, 500)
        const errorBody = await response.text(); // Try to get more error details
        console.error("Backend error response:", errorBody);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const aiResponse: AiResponse = await response.json(); // Parse the JSON response from backend
      console.log('Backend response received:', aiResponse);
      return aiResponse; // Return the full response object

    } catch (error) {
      console.error("Error calling backend API:", error);
      // Return a structured error response including a default studyState (or handle differently)
      // For simplicity, returning the current state back, but might need adjustment
      return {
        text: 'Sorry, could not connect to the backend or process the request.',
        studyState: currentStudyState || {} // Return current state or empty object on error
      };
    } finally {
      setIsLoading(false); // Ensure loading is reset regardless of success or error
    }
  };

  // Handler for sending a message (handles initial prompt and subsequent interactions)
  const handleSendMessage = async () => {
    // Use inputValue for the initial message, might be empty for subsequent "next" actions
    const userMessageToSend = inputValue.trim();

    // Only proceed if it's the first message OR if not loading (allowing empty messages after first)
    if ((userMessageToSend || chatHistory.length > 0) && !isLoading) {
      setIsLoading(true); // Set loading early
      setCurrentQuizData(null); // Clear previous quiz data on new message

      // Add user message to history only if it's not empty (e.g., initial prompt)
      if (userMessageToSend) {
        const newUserMessage: ChatMessage = { sender: 'user', text: userMessageToSend };
        setChatHistory(prevHistory => [...prevHistory, newUserMessage]);
      }

      // Clear the input field after capturing the message
      setInputValue('');

      try {
        // Call the backend orchestrator with the message and current study state
        const response = await callAiOrchestrator(userMessageToSend, studyState);

        // Process the response
        let aiMessageToAdd: ChatMessage | null = null;

        if (response.text) {
          // Handle text response
          aiMessageToAdd = { sender: 'ai', text: response.text };
          setCurrentQuizData(null); // Clear quiz data when a text explanation is received
        } else if (response.quizData) {
          // Handle quiz response
          aiMessageToAdd = { sender: 'ai', text: 'Quiz received! See below.', isQuiz: true };
          setCurrentQuizData(response.quizData); // Store quiz data for display
          console.log("Received Quiz Data:", response.quizData);
        } else {
          // Handle unexpected response format
           aiMessageToAdd = { sender: 'ai', text: 'Received an unexpected response format from the backend.' };
           console.warn("Unexpected backend response:", response);
        }

        // Add the AI message to chat history if one was created
        if (aiMessageToAdd) {
            setChatHistory(prevHistory => [...prevHistory, aiMessageToAdd!]);
        }

        // Update the study state for the next request
        setStudyState(response.studyState);
        console.log("Updated Study State:", response.studyState);

      } catch (error) {
        // This catch block might be redundant if callAiOrchestrator handles errors,
        // but kept for safety.
        console.error("Error in handleSendMessage:", error);
        const errorMessage: ChatMessage = { sender: 'ai', text: 'Sorry, an error occurred while processing your request.' };
        setChatHistory(prevHistory => [...prevHistory, errorMessage]);
      } finally {
         setIsLoading(false); // Ensure loading is reset
      }
    }
  };


  // Handle Enter key press in input
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) { // Prevent sending with Enter while loading
      handleSendMessage();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px' }}>
      <h2>AI Study Assistant</h2>
      {/* Chat History Area */}
      <div style={{ flexGrow: 1, border: '1px solid #ccc', marginBottom: '10px', padding: '10px', overflowY: 'auto' }}>
        {chatHistory.length === 0 ? (
          <p>No messages yet. Ask the AI something!</p>
        ) : (
          chatHistory.map((message, index) => (
            <p key={index} style={{ margin: '5px 0', color: message.sender === 'ai' ? 'blue' : 'black' }}>
              <strong>{message.sender === 'user' ? 'You: ' : 'AI: '}</strong>
              {message.text}
            </p>
          ))
        )}
        {/* Loading Indicator */}
        {isLoading && <p style={{ fontStyle: 'italic', color: 'grey' }}>AI is thinking...</p>}
      </div>
      {/* Quiz Area Placeholder - Displays received quiz data */}
      <div style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px', background: '#f9f9f9' }}>
        <h4>Quiz Area</h4>
        {currentQuizData ? (
          <QuizComponent quizData={currentQuizData} /> // Render QuizComponent when data exists
        ) : (
          <p>No quiz active.</p>
        )}
      </div>
      {/* Input Area */}
      <div style={{ display: 'flex' }}>
        <input
          type="text"
          placeholder={isLoading ? "AI is thinking..." : "Ask the AI assistant..."}
          style={{ flexGrow: 1, marginRight: '10px', padding: '8px' }}
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          disabled={isLoading} // Disable input while loading
        />
        <button
          style={{ padding: '8px 15px' }}
          onClick={handleSendMessage}
          disabled={isLoading} // Disable button while loading
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default StudyPage;