document.addEventListener('DOMContentLoaded', function() {
  const summarizeButton = document.getElementById('summarize');
  const statusText = document.getElementById('status');
  const aiModel = document.getElementById('ai-model');

  summarizeButton.addEventListener('click', function() {
    const selectedModel = aiModel.value;
    statusText.textContent = `Generating summary...`;
    
    // Execute the content script directly
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0] || !tabs[0].id) {
        statusText.textContent = 'Error: Could not access current tab.';
        return;
      }
      
      // First check if we're on YouTube
      const url = tabs[0].url || '';
      if (!url.includes('youtube.com/watch')) {
        statusText.textContent = 'Please navigate to a YouTube video first.';
        return;
      }
      
      // Execute script to generate summary
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: generateSummary,
        args: [selectedModel]
      }).then(() => {
        statusText.textContent = 'Summary displayed in sidebar!';
      }).catch(error => {
        statusText.textContent = 'Error: ' + (error.message || 'Could not generate summary');
      });
    });
  });
});

// This function will be injected into the page
function generateSummary(model) {
  // Create sidebar
  let sidebarCreated = false;
  let summaryData = null;
  
  // Create sidebar with loading state
  function createSidebarWithLoading() {
    if (!sidebarCreated) {
      // Create sidebar container
      const sidebar = document.createElement('div');
      sidebar.id = 'yt-summary-sidebar';
      sidebar.style.position = 'fixed';
      sidebar.style.top = '0';
      sidebar.style.right = '0';
      sidebar.style.width = '380px';
      sidebar.style.height = '100vh';
      sidebar.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
      sidebar.style.boxShadow = '-5px 0 15px rgba(0, 0, 0, 0.1)';
      sidebar.style.zIndex = '9999';
      sidebar.style.overflowY = 'auto';
      sidebar.style.padding = '20px';
      sidebar.style.fontFamily = 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
      sidebar.style.color = '#2d3748';
      sidebar.style.borderLeft = '1px solid rgba(0, 0, 0, 0.1)';
      
      // Create sidebar content
      const sidebarContent = document.createElement('div');
      sidebarContent.className = 'sidebar-content';
      sidebarContent.innerHTML = `
        <div style="text-align: center; padding: 30px 0;">
          <p style="margin-bottom: 20px; font-size: 16px; color: #4a5568;">Generating summary...</p>
          <div style="width: 40px; height: 40px; margin: 0 auto; border: 4px solid rgba(0, 0, 0, 0.1); border-radius: 50%; border-top-color: #667eea; animation: spin 1s ease-in-out infinite;"></div>
        </div>
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      `;
      sidebar.appendChild(sidebarContent);
      
      // Add close button
      const closeButton = document.createElement('button');
      closeButton.style.position = 'absolute';
      closeButton.style.top = '10px';
      closeButton.style.right = '10px';
      closeButton.style.background = 'none';
      closeButton.style.border = 'none';
      closeButton.style.fontSize = '24px';
      closeButton.style.cursor = 'pointer';
      closeButton.style.color = '#4a5568';
      closeButton.innerHTML = '&times;';
      closeButton.addEventListener('click', () => {
        sidebar.style.display = 'none';
      });
      sidebar.appendChild(closeButton);
      
      // Append to body
      document.body.appendChild(sidebar);
      
      sidebarCreated = true;
    }
  }
  
  // Extract transcript from YouTube
  async function getTranscript() {
    try {
      // Try to find the transcript button
      let transcriptButton = Array.from(document.querySelectorAll('button'))
        .find(button => button.textContent.includes('Show transcript'));
      
      if (transcriptButton) {
        transcriptButton.click();
        // Wait for transcript to load
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Try different selectors for transcript items
      let transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer');
      
      // If not found, try alternative selectors
      if (!transcriptItems || transcriptItems.length === 0) {
        transcriptItems = document.querySelectorAll('.segment-text');
      }
      
      if (!transcriptItems || transcriptItems.length === 0) {
        // If still not found, try to find and click the transcript button again
        const moreActions = Array.from(document.querySelectorAll('button'))
          .find(button => button.getAttribute('aria-label') === 'More actions');
        
        if (moreActions) {
          moreActions.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const showTranscript = Array.from(document.querySelectorAll('tp-yt-paper-item'))
            .find(item => item.textContent.includes('Show transcript'));
          
          if (showTranscript) {
            showTranscript.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer');
          }
        }
      }
      
      if (!transcriptItems || transcriptItems.length === 0) {
        // If still no transcript, use video title and description as fallback
        const title = document.querySelector('h1.title')?.textContent || '';
        const description = document.querySelector('#description-text')?.textContent || '';
        return title + '. ' + description;
      }
      
      // Extract text from transcript
      let transcriptText = '';
      transcriptItems.forEach(item => {
        const textElement = item.querySelector('#content') || item;
        if (textElement && textElement.textContent) {
          transcriptText += textElement.textContent.trim() + ' ';
        }
      });
      
      return transcriptText.trim() || 'No transcript available';
    } catch (error) {
      console.error('Error getting transcript:', error);
      // Fallback to title and description
      const title = document.querySelector('h1.title')?.textContent || '';
      const description = document.querySelector('#description-text')?.textContent || '';
      return title + '. ' + description;
    }
  }
  
  // Basic summarization algorithm
  function summarizeText(text) {
    // If text is too short, return it as is
    if (text.length < 200) return text;
    
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    if (sentences.length <= 5) {
      return text;
    }
    
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
      if (words.length === 0) return { sentence, score: 0 };
      
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
      .slice(0, 5)
      .sort((a, b) => {
        // Find the original position of each sentence
        const posA = sentences.indexOf(a.sentence);
        const posB = sentences.indexOf(b.sentence);
        return posA - posB;
      })
      .map(item => item.sentence);
    
    return topSentences.join(' ');
  }
  
  // Function to get video metadata
  function getVideoMetadata() {
    try {
      const title = document.querySelector('h1.title')?.textContent || 
                   document.querySelector('h1.ytd-watch-metadata')?.textContent || 
                   'Unknown Title';
      
      const channel = document.querySelector('#channel-name a')?.textContent || 
                     document.querySelector('#owner-name a')?.textContent || 
                     'Unknown Channel';
      
      const viewCount = document.querySelector('.view-count')?.textContent || 
                       document.querySelector('#info-text')?.textContent || 
                       'Unknown Views';
      
      return { title, channel, viewCount };
    } catch (error) {
      console.error('Error getting metadata:', error);
      return { title: 'Video Title', channel: 'Channel', viewCount: 'Views' };
    }
  }
  
  // Extract key points from summary
  function extractKeyPoints(summary) {
    try {
      const sentences = summary.match(/[^.!?]+[.!?]+/g) || [];
      // If we have 5 or fewer sentences, each is a key point
      if (sentences.length <= 5) {
        return sentences.map(sentence => sentence.trim());
      }
      
      // Otherwise, select sentences with important keywords
      const keywordSentences = sentences.filter(sentence => {
        const lowercased = sentence.toLowerCase();
        return lowercased.includes('important') || 
               lowercased.includes('key') || 
               lowercased.includes('main') || 
               lowercased.includes('significant') ||
               lowercased.includes('essential') ||
               lowercased.includes('critical');
      });
      
      // If we found keyword sentences, use them
      if (keywordSentences.length > 0) {
        return keywordSentences.map(sentence => sentence.trim());
      }
      
      // Otherwise, just take the first sentence and a few high-impact ones
      const firstSentence = sentences[0];
      const middleSentences = sentences.slice(Math.floor(sentences.length / 2) - 1, Math.floor(sentences.length / 2) + 1);
      const lastSentence = sentences[sentences.length - 1];
      
      return [firstSentence, ...middleSentences, lastSentence].map(sentence => sentence.trim());
    } catch (error) {
      console.error('Error extracting key points:', error);
      return ['Could not extract key points from this video.'];
    }
  }
  
  // Update the sidebar with summary content
  function updateSidebar(summaryData) {
    const sidebarContent = document.querySelector('.sidebar-content');
    if (sidebarContent) {
      sidebarContent.innerHTML = `
        <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
          <h2 style="font-size: 18px; margin-bottom: 8px; color: #1a202c;">${summaryData.title}</h2>
          <p style="font-size: 14px; color: #4a5568; margin-bottom: 5px;">${summaryData.channel}</p>
          <p style="font-size: 12px; color: #718096; margin-bottom: 5px;">${summaryData.views}</p>
          <p style="font-size: 12px; color: #805ad5; font-weight: 600;">Summarized by: ${summaryData.model}</p>
        </div>
        <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
          <h3 style="font-size: 16px; margin-bottom: 10px; color: #2d3748; font-weight: 600;">Summary</h3>
          <p style="font-size: 14px; line-height: 1.6; color: #4a5568;">${summaryData.summary}</p>
        </div>
        <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
          <h3 style="font-size: 16px; margin-bottom: 10px; color: #2d3748; font-weight: 600;">Key Points</h3>
          <ul style="padding-left: 20px;">
            ${summaryData.keyPoints.map(point => `<li style="font-size: 14px; margin-bottom: 8px; color: #4a5568; line-height: 1.5;">${point}</li>`).join('')}
          </ul>
        </div>
      `;
    }
  }
  
  // Main function
  async function main() {
    try {
      createSidebarWithLoading();
      
      const transcript = await getTranscript();
      console.log("Transcript obtained:", transcript.substring(0, 100) + "...");
      
      const summary = summarizeText(transcript);
      console.log("Summary generated:", summary);
      
      const metadata = getVideoMetadata();
      console.log("Metadata:", metadata);
      
      const keyPoints = extractKeyPoints(summary);
      console.log("Key points:", keyPoints);
      
      const modelNames = {
        'chatgpt': 'ChatGPT',
        'gemini': 'Gemini',
        'claude': 'Claude AI'
      };
      
      summaryData = {
        title: metadata.title,
        channel: metadata.channel,
        views: metadata.views,
        summary: summary || "Could not generate summary for this video.",
        keyPoints: keyPoints.length > 0 ? keyPoints : ["No key points could be extracted."],
        model: modelNames[model] || model
      };
      
      updateSidebar(summaryData);
    } catch (error) {
      console.error('Error in generateSummary:', error);
      const sidebarContent = document.querySelector('.sidebar-content');
      if (sidebarContent) {
        sidebarContent.innerHTML = `
          <div style="padding: 20px; background-color: rgba(254, 215, 215, 0.3); border-left: 4px solid #fc8181; margin-bottom: 20px;">
            <h3 style="color: #c53030; margin-bottom: 10px;">Error</h3>
            <p style="color: #742a2a; margin-bottom: 10px;">${error.toString()}</p>
            <p style="color: #742a2a; margin-bottom: 10px;">Please try again or select a different AI model.</p>
          </div>
        `;
      }
    }
  }
  
  // Run the main function
  main();
}