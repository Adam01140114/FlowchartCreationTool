# AI Legal Assistant Setup Guide

## Overview
This AI Legal Assistant is integrated into your FormWiz webpage and provides users with general legal guidance using OpenAI's ChatGPT API.

## Features
- **Interactive Chat Interface**: Modern, responsive chat UI with typing indicators
- **Quick Question Buttons**: Pre-defined legal topics for easy access
- **Conversation History**: Maintains context throughout the conversation
- **Mobile Responsive**: Works seamlessly on all devices
- **Legal Disclaimers**: Built-in warnings about the limitations of AI legal advice
- **API Key Management**: Secure storage of your OpenAI API key

## Setup Instructions

### 1. Get Your OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to the API section
4. Create a new API key
5. Copy the key (it starts with `sk-`)

### 2. Add Your API Key
You have two options:

#### Option A: Direct Configuration (Recommended)
1. Open `ai-config.js`
2. Replace `YOUR_API_KEY_HERE` with your actual API key
3. Save the file

#### Option B: Runtime Configuration
1. Open the webpage
2. Click "Enter API Key" when prompted
3. Enter your API key in the popup
4. The key will be stored securely in your browser

### 3. Test the Integration
1. Open `PlaceHolder.html` in your browser
2. Try asking a legal question like "What documents do I need for small claims?"
3. The AI should respond with helpful legal guidance

## Configuration Options

### Model Selection
You can change the AI model in `ai-config.js`:
- `gpt-3.5-turbo`: Faster, more cost-effective
- `gpt-4`: More accurate, higher cost

### Response Settings
- `maxTokens`: Maximum response length (default: 1000)
- `temperature`: Creativity level 0-1 (default: 0.7)

## Legal Considerations

### Important Disclaimers
The AI Legal Assistant includes built-in disclaimers that:
- Clarify this is general information only
- Recommend consulting qualified attorneys
- State that it cannot provide specific legal advice
- Emphasize educational purposes only

### Compliance
- The system is designed to be compliant with legal advertising rules
- All responses include appropriate disclaimers
- Users are clearly informed about limitations

## Security

### API Key Protection
- API keys are stored locally in the browser
- No keys are transmitted to external servers except OpenAI
- Users can clear their stored keys at any time

### Data Privacy
- Conversations are not stored on your servers
- Only the last 10 messages are sent to OpenAI for context
- No personal information is collected

## Troubleshooting

### Common Issues
1. **"API Key Required" message**: Add your API key using one of the methods above
2. **"Error calling OpenAI API"**: Check your API key and internet connection
3. **No response**: Verify your OpenAI account has sufficient credits

### Support
- Check OpenAI's API documentation for technical issues
- Ensure your API key has the correct permissions
- Verify your OpenAI account is active and funded

## Customization

### Adding Quick Questions
Edit the quick question buttons in `PlaceHolder.html`:
```html
<button class="quick-btn" data-question="Your question here">Button Text</button>
```

### Modifying the System Prompt
Edit the `systemPrompt` in `ai-config.js` to change how the AI behaves.

### Styling
All CSS is contained in the `<style>` section of `PlaceHolder.html` for easy customization.

## Cost Management

### Token Usage
- Each conversation uses tokens based on message length
- Monitor your OpenAI usage dashboard
- Consider implementing usage limits if needed

### Optimization Tips
- The system keeps only the last 10 messages for context
- Responses are limited to 1000 tokens by default
- Consider using gpt-3.5-turbo for cost efficiency

## Next Steps

1. Add your API key
2. Test the functionality
3. Customize the quick questions for your specific legal focus
4. Consider adding more specific legal disclaimers for your jurisdiction
5. Monitor usage and costs through OpenAI's dashboard

The AI Legal Assistant is now ready to help your users with their legal questions!
