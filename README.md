# YouTube Summary Sidebar

A Chrome extension that summarizes YouTube videos and displays the summary in a beautiful, aesthetic sidebar.

## Features

- Extracts YouTube video transcripts
- Generates concise summaries of video content
- Displays key points from the video
- Beautiful, modern UI with animations
- Easy-to-use toggle button

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. Navigate to any YouTube video to use the extension

## Usage

1. Go to any YouTube video
2. Click the extension icon in your browser toolbar
3. Click "Summarize This Video"
4. A sidebar will appear with the video summary and key points
5. Use the toggle button to show/hide the sidebar

## Requirements

- Google Chrome browser
- YouTube videos with available transcripts

## Note

Before using the extension, you need to add icon images to the `images` directory:
- icon16.png (16x16)
- icon48.png (48x48)
- icon128.png (128x128)

## How It Works

This extension:
1. Extracts the transcript from YouTube videos
2. Uses a simple algorithm to identify important sentences
3. Generates a concise summary and key points
4. Displays the results in a beautiful sidebar

## Limitations

- Works only on YouTube videos with available transcripts
- Summary quality depends on transcript quality
- Uses a simple summarization algorithm (not AI-powered)

## Future Improvements

- Add support for multiple languages
- Implement more advanced summarization algorithms
- Add options to customize summary length and style