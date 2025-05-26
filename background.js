// Listen for when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if it's a YouTube video page and the page has finished loading
  if (tab.url && tab.url.includes("youtube.com/watch") && changeInfo.status === 'complete') {
    // Inject the content script
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"]
    });
    
    // Inject the CSS
    chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ["sidebar.css"]
    });
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkYouTube") {
    // Check if current tab is a YouTube video
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes("youtube.com/watch")) {
        sendResponse({isYouTube: true});
      } else {
        sendResponse({isYouTube: false});
      }
    });
    return true; // Required for async sendResponse
  }
  
  if (request.action === "summarize") {
    // Forward the message to the content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
        sendResponse(response);
      });
    });
    return true; // Required for async sendResponse
  }
});