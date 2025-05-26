// Global variables
let sidebarCreated = false;
let summaryData = null;

// Notify that content script is loaded
console.log("YouTube Summary content script loaded");

// Listen for messages from background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Content script received message:", request);
  
  if (request.action === 'summarize') {
    try {
      // Create sidebar immediately with loading state
      createSidebarWithLoading();
      
      // Then generate summary
      generateSummary(request.model)
        .then(() => {
          sendResponse({status: 'success'});
        })
        .catch(error => {
          console.error('Error generating summary:', error);
          updateSidebarWithError(error.toString());
          sendResponse({status: 'error', message: error.toString()});
        });
    } catch (error) {
      console.error('Error:', error);
      sendResponse({status: 'error', message: error.toString()});
    }
    return true; // Required for async sendResponse
  }
});

// Create sidebar with loading state
function createSidebarWithLoading() {
  if (!sidebarCreated) {
    // Create sidebar container
    const sidebar = document.createElement('div');
    sidebar.id = 'yt-summary-sidebar';
    sidebar.className = 'yt-summary-sidebar';
    
    // Create sidebar content
    const sidebarContent = document.createElement('div');
    sidebarContent.className = 'sidebar-content';
    sidebarContent.innerHTML = `
      <div class="loading">
        <p>Generating summary...</p>
        <div class="spinner"></div>
      </div>
    `;
    sidebar.appendChild(sidebarContent);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'sidebar-close';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
    sidebar.appendChild(closeButton);
    
    // Add toggle button
    const toggleButton = document.createElement('button');
    toggleButton.className = 'sidebar-toggle';
    toggleButton.innerHTML = '&#9776; Summary';
    toggleButton.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    // Append to body
    document.body.appendChild(sidebar);
    document.body.appendChild(toggleButton);
    
    sidebarCreated = true;
    
    // Open the sidebar
    sidebar.classList.add('open');
  }
}

// Update sidebar with error message
function updateSidebarWithError(errorMessage) {
  const sidebarContent = document.querySelector('.sidebar-content');
  if (sidebarContent) {
    sidebarContent.innerHTML = `
      <div class="error">
        <h3>Error</h3>
        <p>${errorMessage}</p>
        <p>Please try again or select a different AI model.</p>
      </div>
    `;
  }
}

// Function to extract transcript from YouTube
async function getTranscript() {
  // Find the transcript button and click it if not already open
  const transcriptButton = Array.from(document.querySelectorAll('button'))
    .find(button => button.textContent.includes('Show transcript'));
  
  if (transcriptButton) {
    transcriptButton.click();
    // Wait for transcript to load
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Find transcript container
  const transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer');
  
  if (!transcriptItems || transcriptItems.length === 0) {
    throw new Error('Transcript not available for this video');
  }
  
  // Extract text from transcript
  let transcriptText = '';
  transcriptItems.forEach(item => {
    const textElement = item.querySelector('#content');
    if (textElement) {
      transcriptText += textElement.textContent.trim() + ' ';
    }
  });
  
  return transcriptText.trim();
}

// Basic summarization algorithm
function basicSummarize(text, sentenceCount) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  // Simple frequency-based summarization
  const wordFrequency = {};
  sentences.forEach(sentence => {
    const words = sentence.toLowerCase().match(/\b\w+\b/g) || [];
    words.forEach(word => {
      if (word.length > 3) { // Ignore short words
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
  });
  
  // Score sentences based on word frequency
  const sentenceScores = sentences.map(sentence => {
    const words = sentence.toLowerCase().match(/\b\w+\b/g) || [];
    let score = 0;
    words.forEach(word => {
      if (wordFrequency[word]) {
        score += wordFrequency[word];
      }
    });
    return { sentence, score: score / words.length };
  });
  
  // Sort sentences by score and take top ones
  const topSentences = sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, sentenceCount)
    .sort((a, b) => {
      // Find the original position of each sentence
      const posA = sentences.indexOf(a.sentence);
      const posB = sentences.indexOf(b.sentence);
      return posA - posB;
    })
    .map(item => item.sentence);
  
  return topSentences.join(' ');
}

// Function to generate summary based on selected AI model
function summarizeText(text, model, sentenceCount = 5) {
  // For simplicity, just use the basic algorithm for all models in this demo
  return basicSummarize(text, sentenceCount);
}

// Function to get video metadata
function getVideoMetadata() {
  const title = document.querySelector('h1.title')?.textContent || 'Unknown Title';
  const channel = document.querySelector('#channel-name a')?.textContent || 'Unknown Channel';
  const viewCount = document.querySelector('.view-count')?.textContent || 'Unknown Views';
  
  return { title, channel, viewCount };
}

// Main function to generate summary
async function generateSummary(model) {
  try {
    const transcript = await getTranscript();
    const summary = summarizeText(transcript, model);
    const metadata = getVideoMetadata();
    
    summaryData = {
      title: metadata.title,
      channel: metadata.channel,
      views: metadata.viewCount,
      summary: summary,
      keyPoints: extractKeyPoints(summary),
      model: model
    };
    
    updateSidebar();
  } catch (error) {
    console.error('Error in generateSummary:', error);
    throw error;
  }
}

// Extract key points from summary
function extractKeyPoints(summary) {
  const sentences = summary.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.map(sentence => sentence.trim()).filter(s => s.length > 20);
}

// Update the sidebar with summary content
function updateSidebar() {
  if (!summaryData) return;
  
  // Update sidebar content
  const sidebarContent = document.querySelector('.sidebar-content');
  if (sidebarContent) {
    const modelName = getModelDisplayName(summaryData.model);
    
    sidebarContent.innerHTML = `
      <div class="summary-header">
        <h2>${summaryData.title}</h2>
        <p class="channel">${summaryData.channel}</p>
        <p class="views">${summaryData.views}</p>
        <p class="model-used">Summarized by: ${modelName}</p>
      </div>
      <div class="summary-section">
        <h3>Summary</h3>
        <p>${summaryData.summary}</p>
      </div>
      <div class="key-points-section">
        <h3>Key Points</h3>
        <ul>
          ${summaryData.keyPoints.map(point => `<li>${point}</li>`).join('')}
        </ul>
      </div>
    `;
    
    // Add copy buttons programmatically
    const summarySection = sidebarContent.querySelector('.summary-section');
    const keyPointsSection = sidebarContent.querySelector('.key-points-section');
    
    // Create summary copy button
    const summaryCopyBtn = document.createElement('button');
    summaryCopyBtn.textContent = '📋 COPY SUMMARY';
    summaryCopyBtn.id = 'copy-summary-btn';
    summaryCopyBtn.style.cssText = 'display: block; width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 10px 0; font-weight: bold; font-size: 14px;';
    
    // Create key points copy button
    const keyPointsCopyBtn = document.createElement('button');
    keyPointsCopyBtn.textContent = '📋 COPY KEY POINTS';
    keyPointsCopyBtn.id = 'copy-keypoints-btn';
    keyPointsCopyBtn.style.cssText = 'display: block; width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin: 10px 0; font-weight: bold; font-size: 14px;';
    
    // Insert buttons at the beginning of each section
    summarySection.insertBefore(summaryCopyBtn, summarySection.querySelector('p'));
    keyPointsSection.insertBefore(keyPointsCopyBtn, keyPointsSection.querySelector('ul'));
    
    // Add click event listeners
    summaryCopyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(summaryData.summary)
        .then(() => {
          this.textContent = '✓ COPIED!';
          setTimeout(() => {
            this.textContent = '📋 COPY SUMMARY';
          }, 1500);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
        });
    });
    
    keyPointsCopyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(summaryData.keyPoints.join(' '))
        .then(() => {
          this.textContent = '✓ COPIED!';
          setTimeout(() => {
            this.textContent = '📋 COPY KEY POINTS';
          }, 1500);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
        });
    });
  }
}


// Get display name for AI model
function getModelDisplayName(model) {
  const models = {
    'basic': 'Basic Summarizer',
    'advanced': 'Advanced AI',
    'gpt': 'GPT Summary',
    'bart': 'BART Summarizer',
    't5': 'T5 Transformer'
  };
  
  return models[model] || 'AI Summarizer';
}