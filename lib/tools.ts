import { Tool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

/**
 * Document Analysis Tool - Extract information from text
 */
export class DocumentAnalysisTool extends Tool {
  name = "document-analysis";
  description = "Analyze and extract key information from text documents. Input should be text content to analyze.";

  constructor() {
    super();
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    try {
      // In a real implementation, this would use more sophisticated analysis techniques
      const wordCount = input.split(/\s+/).length;
      const sentences = input.split(/[.!?]+/).filter(Boolean).length;
      const topWords = this.getTopWords(input);
      
      return JSON.stringify({
        summary: `Document contains ${wordCount} words and approximately ${sentences} sentences.`,
        topWords,
        estimatedReadingTime: `${Math.ceil(wordCount / 200)} minutes`,
        keyPoints: ["This is a mock extraction - in a real implementation, AI would identify actual key points from the text."]
      });
    } catch (error) {
      return `Error analyzing document: ${error}`;
    }
  }

  private getTopWords(text: string): Record<string, number> {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const wordCounts: Record<string, number> = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Return top 5 words
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .reduce((obj, [word, count]) => {
        obj[word] = count;
        return obj;
      }, {} as Record<string, number>);
  }
}

/**
 * Weather Tool - Get weather information for a location using OpenWeatherMap API
 */
export class WeatherTool extends Tool {
  name = "weather";
  description = "Get current weather conditions and forecasts for any city or location worldwide. Use this tool for ALL weather-related queries including: temperature, forecast, conditions, humidity, wind, etc. Input should be a city name or location (e.g., 'London', 'Tokyo, Japan', 'New York City').";
  private gemini: ChatGoogleGenerativeAI;

  constructor() {
    super();
    this.gemini = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      maxOutputTokens: 1024,
      temperature: 0.3,
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }

  /** @ignore */
  async _call(location: string): Promise<string> {
    try {
      // Get OpenWeatherMap API key from environment
      const apiKey = process.env.OPENWEATHERMAP_API_KEY;
      
      if (!apiKey) {
        return JSON.stringify({
          success: true,
          location: location,
          message: "🌤️ Weather Tool is working! However, you need to set up a free OpenWeatherMap API key to get real weather data.",
          instructions: {
            step1: "Go to https://openweathermap.org/api and sign up for free",
            step2: "Get your API key from the dashboard", 
            step3: "Add OPENWEATHERMAP_API_KEY=your_key_here to your .env.local file",
            step4: "Restart the development server with 'yarn dev'",
            note: "Free tier includes 1,000 API calls per day - perfect for testing!"
          },
          setupStatus: "API key missing - follow instructions above to get real weather data"
        });
      }

      // Fetch current weather data
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
      const weatherResponse = await fetch(weatherUrl);
      
      if (!weatherResponse.ok) {
        if (weatherResponse.status === 404) {
          return JSON.stringify({
            error: `Location "${location}" not found. Please check the spelling and try again.`,
            suggestion: "Try using a major city name or include country code (e.g., 'London, UK')"
          });
        }
        throw new Error(`Weather API error: ${weatherResponse.status}`);
      }

      const weatherData = await weatherResponse.json();

      // Fetch 5-day forecast
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
      const forecastResponse = await fetch(forecastUrl);
      const forecastData = forecastResponse.ok ? await forecastResponse.json() : null;

      // Use Gemini to create a natural, conversational weather summary
      const weatherPrompt = `
You are a helpful weather assistant. Based on the following weather data, create a natural, conversational summary that includes:

1. Current conditions with temperature and "feels like"
2. Weather description and any notable conditions
3. Wind and humidity if significant
4. Brief 3-day outlook if forecast data is available
5. Any weather recommendations or observations

Current Weather Data:
${JSON.stringify(weatherData, null, 2)}

Forecast Data (if available):
${forecastData ? JSON.stringify(forecastData.list.slice(0, 8), null, 2) : 'Not available'}

Respond in a friendly, conversational tone as if you're a local weather reporter. Keep it concise but informative.
`;

      const geminiResponse = await this.gemini.invoke(weatherPrompt);
      const naturalSummary = geminiResponse.content;

      // Return structured data with both raw data and natural summary
      return JSON.stringify({
        location: weatherData.name + (weatherData.sys.country ? `, ${weatherData.sys.country}` : ''),
        summary: naturalSummary,
        current: {
          temperature: Math.round(weatherData.main.temp),
          feelsLike: Math.round(weatherData.main.feels_like),
          condition: weatherData.weather[0].main,
          description: weatherData.weather[0].description,
          humidity: weatherData.main.humidity,
          windSpeed: weatherData.wind?.speed ? Math.round(weatherData.wind.speed * 3.6) : null, // Convert m/s to km/h
          windDirection: weatherData.wind?.deg,
          pressure: weatherData.main.pressure,
          visibility: weatherData.visibility ? Math.round(weatherData.visibility / 1000) : null // Convert to km
        },
        forecast: forecastData ? forecastData.list.slice(0, 6).map((item: any) => ({
          time: new Date(item.dt * 1000).toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit'
          }),
          temperature: Math.round(item.main.temp),
          condition: item.weather[0].main,
          description: item.weather[0].description
        })) : null,
        lastUpdated: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Weather tool error:', error);
      return JSON.stringify({
        error: `Failed to fetch weather data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fallback: "You can try asking for weather in a different format or check if the location name is spelled correctly."
      });
    }
  }
}

/**
 * Database Query Tool - Run natural language queries against a database
 */
export class DatabaseQueryTool extends Tool {
  name = "database-query";
  description = "Execute natural language queries against a database. Input should be a question about data.";

  constructor() {
    super();
  }

  /** @ignore */
  async _call(query: string): Promise<string> {
    try {
      // Mock implementation - in production, this would translate to SQL and execute
      return JSON.stringify({
        interpretedQuery: `SELECT * FROM users WHERE ${query.includes("active") ? "status = 'active'" : "created_at > '2023-01-01'"}`,
        results: [
          { id: 1, name: "John Doe", email: "john@example.com", status: "active" },
          { id: 2, name: "Jane Smith", email: "jane@example.com", status: "active" },
          { id: 3, name: "Robert Johnson", email: "robert@example.com", status: "inactive" }
        ],
        summary: "Found 3 users matching your criteria. 2 are active, 1 is inactive."
      });
    } catch (error) {
      return `Error executing database query: ${error}`;
    }
  }
}

/**
 * Image Generator Tool - Generate images from text descriptions
 */
export class ImageGeneratorTool extends Tool {
  name = "image-generator";
  description = "Generate an image based on a text description. Input should be a detailed description of the desired image. For different styles, include the style in your description (e.g., 'in a cartoon style').";

  constructor() {
    super();
  }

  /** @ignore */
  async _call(description: string): Promise<string> {
    try {
      // Extract style from description or default to realistic
      let style = "realistic";
      const styleMatch = description.match(/in a ([\w\s]+) style/i);
      if (styleMatch && styleMatch[1]) {
        style = styleMatch[1].toLowerCase();
      }
      
      // Mock implementation - in production, this would call an image generation API
      return JSON.stringify({
        success: true,
        imageUrl: "https://placehold.co/600x400/png?text=Generated+Image",
        prompt: description,
        style,
        message: `Successfully generated ${style} image based on: "${description}". In a real implementation, this would return an actual generated image URL.`
      });
    } catch (error) {
      return `Error generating image: ${error}`;
    }
  }
}

/**
 * Code Interpreter Tool - Execute code to solve problems
 */
export class CodeInterpreterTool extends Tool {
  name = "code-interpreter";
  description = "Execute code to solve problems or process data. Input should be JavaScript code to execute. If you need to include input data, add it as a JSON string after the code, separated by '---DATA---'.";

  constructor() {
    super();
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    try {
      // Split input into code and data if separator exists
      let code = input;
      let data = undefined;
      
      if (input.includes("---DATA---")) {
        const parts = input.split("---DATA---");
        code = parts[0].trim();
        data = parts[1].trim();
      }
      
      // Mock implementation - in a real setup, this would use a sandboxed environment
      return JSON.stringify({
        result: `Simulated execution of ${code.length} characters of JavaScript code.`,
        output: data ? `Processed input: ${data.substring(0, 50)}${data.length > 50 ? '...' : ''}` : "No input provided",
        executionTime: `${Math.floor(Math.random() * 500) + 10}ms`,
        message: "Note: This is a mock execution. In a real implementation, the code would be safely executed in a sandboxed environment."
      });
    } catch (error) {
      return `Error executing code: ${error}`;
    }
  }
} 