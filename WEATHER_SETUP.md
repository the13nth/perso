# Weather Tool Setup Guide

## 🌤️ Real Weather Tool Implementation

The Weather Tool has been upgraded to use real weather data from OpenWeatherMap API with intelligent processing by Gemini.

## 🔑 Required API Keys

### 1. OpenWeatherMap API Key (Free)
1. Go to [OpenWeatherMap API](https://openweathermap.org/api)
2. Sign up for a free account
3. Navigate to API keys section
4. Copy your API key

### 2. Google AI API Key (for Gemini)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key

## 🔧 Configuration

Create a `.env.local` file in your project root with:

```env
# OpenWeatherMap API Key
OPENWEATHERMAP_API_KEY=your_openweathermap_api_key_here

# Google AI API Key (for Gemini)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key_here

# SerpAPI Key (for web search)
SERPAPI_API_KEY=your_serpapi_key_here
```

## ✨ Features

- **Real Weather Data**: Current conditions and 5-day forecast
- **AI-Powered Summaries**: Gemini creates natural, conversational weather reports
- **Smart Error Handling**: Helpful error messages and suggestions
- **Location Support**: Cities worldwide with country code support
- **Detailed Data**: Temperature, humidity, wind, pressure, visibility

## 🧪 Testing

Try these examples in the chat:
- "What's the weather in London?"
- "Show me the weather forecast for Tokyo, Japan"
- "How's the weather in New York City?"

## 🎯 Next Steps

1. Set up your API keys
2. Test the weather tool
3. Ready to implement more tools!

## 🐛 Troubleshooting

- **"API key not configured"**: Add your OpenWeatherMap API key to `.env.local`
- **"Location not found"**: Try using a major city name or include country code
- **Rate limits**: Free tier allows 1000 calls/day (more than enough for testing) 