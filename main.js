class GeminiChatApp {
  constructor() {
    this.chatMessages = document.getElementById('chatMessages');
    this.userInput = document.getElementById('userInput');
    this.sendButton = document.getElementById('sendButton');
    
    // Gemini API configuration
    this.GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    this.GEMINI_API_KEY = 'AIzaSyD8QzStt2pXKyDEOqjtqOk9LaU3zDG3Tz0';
    
    // Maintain conversation context
    this.conversationContext = [];
    
    // Training data storage
    this.trainingData = JSON.parse(localStorage.getItem('trainingData')) || [];
    
    // Initialize modal elements
    this.trainModal = document.getElementById('trainModal');
    this.learnedModal = document.getElementById('learnedModal');
    this.trainButton = document.getElementById('trainButton');
    this.learnedButton = document.getElementById('learnedButton');
    this.closeButtons = document.querySelectorAll('.close');
    this.clearButton = document.getElementById('clearButton');
    
    this.setupEventListeners();
    this.setupModalEventListeners();
    this.renderTrainingList();
    
    // Initialize cloud storage
    this.initializeCloudStorage();
  }

  setupEventListeners() {
    this.sendButton.addEventListener('click', () => this.handleSendMessage());
    this.userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSendMessage();
      }
    });

    // Add clear button event listener
    this.clearButton.addEventListener('click', () => this.clearConversation());
  }

  setupModalEventListeners() {
    // Training button click
    this.trainButton.onclick = () => {
      this.trainModal.style.display = 'block';
    };

    // Learned button click
    this.learnedButton.onclick = () => {
      this.learnedModal.style.display = 'block';
      this.renderLearnedList();
    };

    // Close button clicks
    this.closeButtons.forEach(button => {
      button.onclick = () => {
        this.trainModal.style.display = 'none';
        this.learnedModal.style.display = 'none';
      };
    });

    // Click outside modal to close
    window.onclick = (event) => {
      if (event.target === this.trainModal) {
        this.trainModal.style.display = 'none';
      }
      if (event.target === this.learnedModal) {
        this.learnedModal.style.display = 'none';
      }
    };

    // Add training button click
    document.getElementById('addTrainingButton').onclick = () => {
      this.addTrainingItem();
    };
  }

  async initializeCloudStorage() {
    try {
      // Fetch shared training data from server
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Get shared training data for the chat assistant.
          
          interface Response {
            trainingData: Array<{
              question: string;
              answer: string;
            }>;
          }
          
          {
            "trainingData": [
              {
                "question": "¿Cuál es tu nombre?",
                "answer": "Mi nombre es Wisdom, un asistente contextual."
              }
            ]
          }`,
          data: "fetch_training_data"
        })
      });

      const data = await response.json();
      
      // Merge cloud data with local data
      const cloudTrainingData = data.trainingData || [];
      this.trainingData = [...new Set([...this.trainingData, ...cloudTrainingData])];
      
      // Update local storage
      localStorage.setItem('trainingData', JSON.stringify(this.trainingData));
      
      // Render updated training list
      this.renderTrainingList();
    } catch (error) {
      console.error('Error fetching shared training data:', error);
    }
  }

  async addTrainingItem() {
    const question = document.getElementById('questionInput').value.trim();
    const answer = document.getElementById('answerInput').value.trim();
    
    if (question && answer) {
      // Add to local storage
      this.trainingData.push({ question, answer });
      localStorage.setItem('trainingData', JSON.stringify(this.trainingData));
      
      try {
        // Sync with cloud storage
        await fetch('/api/ai_completion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: `Add new training item to shared knowledge base.
            
            interface Response {
              success: boolean;
            }
            
            {
              "success": true
            }`,
            data: {
              question,
              answer
            }
          })
        });
      } catch (error) {
        console.error('Error syncing training data:', error);
      }
      
      // Clear inputs
      document.getElementById('questionInput').value = '';
      document.getElementById('answerInput').value = '';
      
      this.renderTrainingList();
    }
  }

  renderTrainingList() {
    const trainingList = document.getElementById('trainingList');
    trainingList.innerHTML = '';
    
    this.trainingData.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'training-item';
      div.innerHTML = `
        <div>
          <strong>P:</strong> ${item.question}<br>
          <strong>R:</strong> ${item.answer}
        </div>
        <button onclick="chatApp.removeTrainingItem(${index})">🗑️</button>
      `;
      trainingList.appendChild(div);
    });
  }

  async removeTrainingItem(index) {
    const removedItem = this.trainingData[index];
    this.trainingData.splice(index, 1);
    localStorage.setItem('trainingData', JSON.stringify(this.trainingData));
    
    try {
      // Sync removal with cloud storage
      await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Remove training item from shared knowledge base.
          
          interface Response {
            success: boolean;
          }
          
          {
            "success": true
          }`,
          data: removedItem
        })
      });
    } catch (error) {
      console.error('Error removing training data from cloud:', error);
    }
    
    this.renderTrainingList();
  }

  renderLearnedList() {
    const learnedList = document.getElementById('learnedList');
    learnedList.innerHTML = '';
    
    // Get stored conversations from localStorage
    const storedConversations = JSON.parse(localStorage.getItem('conversations')) || [];
    const conversations = [...storedConversations, ...this.conversationContext];
    
    // Show conversation history
    conversations.forEach((exchange, index) => {
      if (index % 2 === 0 && index + 1 < conversations.length) {
        const div = document.createElement('div');
        div.className = 'learned-item';
        div.innerHTML = `
          <strong>Usuario:</strong> ${exchange.parts[0].text}<br>
          <strong>Wisdom:</strong> ${conversations[index + 1].parts[0].text}
        `;
        learnedList.appendChild(div);
      }
    });
  }

  async handleSendMessage() {
    const message = this.userInput.value.trim();
    if (!message) return;

    // Check for special commands
    if (message.toLowerCase() === 'ocultar') {
      this.trainButton.style.display = 'none';
      this.learnedButton.style.display = 'none';
      this.userInput.value = '';
      return;
    }

    if (message.toLowerCase() === 'entrenarlimhi') {
      this.trainButton.style.display = 'block';
      this.learnedButton.style.display = 'block';
      this.userInput.value = '';
      return;
    }

    // Add user message to chat and context
    this.addMessage(message, 'user');
    this.conversationContext.push({ role: 'user', parts: [{ text: message }] });
    this.userInput.value = '';

    try {
      const typingId = this.addTypingIndicator();

      // Check training data with improved matching
      const trainedResponse = await this.checkTrainingData(message);
      if (trainedResponse) {
        this.removeTypingIndicator(typingId);
        this.addMessage(trainedResponse, 'bot');
        this.conversationContext.push({ role: 'model', parts: [{ text: trainedResponse }] });
        return;
      }

      // Enhanced prompt for more precise responses
      const response = await fetch(`${this.GEMINI_API_ENDPOINT}?key=${this.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            ...this.conversationContext.slice(-4), // Reduced context window for more focus
            {
              role: 'user',
              parts: [{
                text: `Responde de manera precisa y concisa (máximo 40 palabras). 
                Enfócate en los puntos clave y mantén un tono conversacional profesional.
                Si no estás seguro, indica claramente tus limitaciones.
                Pregunta original: ${message}`
              }]
            }
          ],
          generationConfig: {
            temperature: 0.3, // Reduced temperature for more focused responses
            maxOutputTokens: 60, // Reduced token limit for shorter responses
            topP: 0.8, // Added top_p for better response quality
            topK: 40 // Added top_k for more focused token selection
          }
        })
      });

      this.removeTypingIndicator(typingId);

      if (!response.ok) {
        throw new Error('Error en la API de Gemini');
      }

      const data = await response.json();
      
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                        'Lo siento, no puedo responder a eso con precisión.';
      
      this.addMessage(aiResponse, 'bot');
      this.conversationContext.push({ role: 'model', parts: [{ text: aiResponse }] });

      // After successful response, store conversation
      const conversations = JSON.parse(localStorage.getItem('conversations')) || [];
      conversations.push(
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text: aiResponse }] }
      );
      localStorage.setItem('conversations', JSON.stringify(conversations));

    } catch (error) {
      console.error('Error:', error);
      this.addMessage('Lo siento, hubo un problema al procesar tu pregunta.', 'error');
    }
  }

  async checkTrainingData(message) {
    try {
      // Get real-time training data from cloud
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Match user message with training data.
          Message: ${message}
          
          interface Response {
            match: string | null;
            confidence: number;
          }
          
          {
            "match": "Esta es la respuesta más apropiada",
            "confidence": 0.85
          }`,
          data: {
            message,
            trainingData: this.trainingData
          }
        })
      });

      const data = await response.json();
      return data.confidence > 0.6 ? data.match : null;
      
    } catch (error) {
      console.error('Error matching with cloud training data:', error);
      // Fallback to local matching
      const keywords = message.toLowerCase().split(/\s+/);
      const matches = this.trainingData.map(item => {
        const questionKeywords = item.question.toLowerCase().split(/\s+/);
        const matchScore = keywords.reduce((score, keyword) => {
          return score + (questionKeywords.includes(keyword) ? 1 : 0);
        }, 0) / Math.max(keywords.length, questionKeywords.length);
        return { answer: item.answer, score: matchScore };
      });

      // Find best match above threshold
      const bestMatch = matches.reduce((best, current) => 
        current.score > best.score ? current : best
      , { score: 0, answer: null });

      return bestMatch.score > 0.6 ? bestMatch.answer : null;
    }
  }

  addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    // Updated modern icons
    avatar.innerHTML = type === 'user' ? 
      '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 4a4 4 0 0 1 4 4a4 4 0 0 1-4 4a4 4 0 0 1-4-4a4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"/></svg>' : 
      '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5z"/></svg>';

    const textDiv = document.createElement('div');
    textDiv.className = 'text';
    textDiv.textContent = text;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(textDiv);
    this.chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  addTypingIndicator() {
    const id = 'typing-' + Date.now();
    const indicator = document.createElement('div');
    indicator.id = id;
    indicator.className = 'message bot';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    // Updated bot typing icon
    avatar.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5z"/></svg>';

    const textDiv = document.createElement('div');
    textDiv.className = 'text';
    textDiv.textContent = 'Escribiendo...';

    indicator.appendChild(avatar);
    indicator.appendChild(textDiv);
    this.chatMessages.appendChild(indicator);
    
    return id;
  }

  removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
      indicator.remove();
    }
  }

  clearConversation() {
    // Clear the chat messages except for the initial greeting
    this.chatMessages.innerHTML = '';
    
    // Add back the initial greeting
    const greeting = document.createElement('div');
    greeting.className = 'message bot';
    greeting.innerHTML = `
      <div class="avatar">🤖</div>
      <div class="text">Hola, soy Wisdom. Puedo ayudarte con diversos temas de manera contextual.</div>
    `;
    this.chatMessages.appendChild(greeting);
    
    // Clear the conversation context
    this.conversationContext = [];
  }
}

// Make chatApp global for DOM event handlers
window.chatApp = new GeminiChatApp();