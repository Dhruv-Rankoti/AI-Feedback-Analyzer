import connectDB from "@/app/utils/db";
import ResponseModel from "@/app/models/Response";
import { analyzeSentimentWithModel } from "@/app/utils/sentimentAnalyzer";

// Fallback responses based on sentiment when offline/API unavailable
const FALLBACK_RESPONSES = {
  Positive:
    "Thank you for your positive feedback! We're delighted to hear that you had a great experience with our product. Your satisfaction is our priority, and we appreciate you taking the time to share your thoughts.",
  Negative:
    "We sincerely apologize for your experience. Your feedback is important to us, and we'll use it to improve our products and services. Please reach out to our customer service team if there's anything we can do to address your concerns.",
  Neutral:
    "Thank you for sharing your feedback. We appreciate your honest assessment and will take your comments into consideration as we continue to improve our products and services. Please don't hesitate to reach out if you have any other thoughts.",
};

export async function POST(req) {
  try {
    const { feedback, price, rating } = await req.json();

    if (!feedback || feedback.length < 3) {
      return Response.json({ error: "Feedback is too short." }, { status: 400 });
    }

    // Create a timeout promise for ML model
    const mlTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("ML model timeout")), 3000)
    );

    // Try ML model with timeout
    let sentimentResult;
    try {
      sentimentResult = await Promise.race([
        analyzeSentimentWithModel(feedback, price, rating),
        mlTimeout,
      ]);
    } catch (timeoutError) {
      console.log("ML model took too long, using Gemini API...");

      // Attempt Gemini API call
      if (process.env.GEMINI_API_KEY) {
        try {
          const prompt = `Analyze this customer feedback and provide sentiment (Positive/Negative/Neutral), confidence (0-100), and numeric rating (1-5):
            "${feedback}"
            Format: SENTIMENT: [result]\nCONFIDENCE: [number]%\nRATING: [number]`;

          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
              }),
            }
          );

          if (geminiResponse.ok) {
            const data = await geminiResponse.json();
            const text = data.candidates[0].content.parts[0].text;

            // Parse Gemini response
            const sentiment = text.match(/SENTIMENT: (.*)/)?.[1] || "Neutral";
            const confidence = parseInt(text.match(/CONFIDENCE: (\d+)/)?.[1] || "50");
            const rating = parseInt(text.match(/RATING: (\d+)/)?.[1] || "3");

            sentimentResult = { sentiment, confidence, rating };
          }
        } catch (geminiError) {
          console.error("Gemini API error:", geminiError);
        }
      }

      // Fallback if both ML and Gemini fail
      if (!sentimentResult) {
        sentimentResult = {
          sentiment: "Neutral",
          confidence: 50,
          rating: 3,
        };
      }
    }

    // Generate a fallback response based on the sentiment
    const fallbackResponse =
      FALLBACK_RESPONSES[sentimentResult.sentiment] ||
      "Thank you for your feedback. We value your input and will use it to improve our products and services.";

    // Get the API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    let customerResponse = fallbackResponse;
    let apiCallSuccessful = false;

    // Initialize result with default values
    let result = {
      sentiment: sentimentResult.sentiment,
      confidence: sentimentResult.confidence,
      rating: sentimentResult.rating,
      customerResponse: fallbackResponse,
      keyInsights: [],
      keywords: [],
      offline: true,
    };

    // Check if API key is valid and try to call Gemini API
    if (apiKey && apiKey !== "YOUR_ACTUAL_GEMINI_API_KEY_HERE") {
      try {
        // Step 2: Use Gemini API for generating customer response and extracting insights
        const prompt = `
          Analyze the following customer feedback which has been analyzed as ${sentimentResult.sentiment}:
          
          Customer feedback: "${feedback}"
          
          Provide the following:
          
          1. RESPONSE: A professional, empathetic and personalized response to the customer that acknowledges their feedback and matches the sentiment of their experience. Keep it under 3 sentences, natural and sincere.
          
          2. KEY_INSIGHTS: Identify 2-4 key insights from this feedback that would be valuable for the business. Each insight should be a short, actionable takeaway.
          
          3. KEYWORDS: Extract 3-6 most important keywords or phrases from the feedback that represent the main topics.
          
          Format your response exactly as:
          RESPONSE: [your customer response]
          KEY_INSIGHTS: [insight 1]; [insight 2]; [etc]
          KEYWORDS: [keyword1], [keyword2], [etc]
        `;

        console.log("Attempting to call Gemini API...");

        // Call the Gemini API with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }],
                },
              ],
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();

          if (
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content
          ) {
            const geminiResponse =
              data.candidates[0].content.parts[0].text.trim();
            apiCallSuccessful = true;
            console.log("Gemini API response:", geminiResponse);

            // Parse the structured response
            const responsePart = geminiResponse.match(
              /RESPONSE:(.*?)(?=KEY_INSIGHTS:|$)/s
            );
            const insightsPart = geminiResponse.match(
              /KEY_INSIGHTS:(.*?)(?=KEYWORDS:|$)/s
            );
            const keywordsPart = geminiResponse.match(/KEYWORDS:(.*?)(?=$)/s);

            customerResponse = responsePart
              ? responsePart[1].trim()
              : fallbackResponse;

            // Extract insights and convert to array
            const keyInsights = insightsPart
              ? insightsPart[1]
                  .split(";")
                  .map((insight) => insight.trim())
                  .filter(Boolean)
              : [];

            // Extract keywords and convert to array
            const keywords = keywordsPart
              ? keywordsPart[1]
                  .split(",")
                  .map((keyword) => keyword.trim())
                  .filter(Boolean)
              : [];

            result = {
              sentiment: sentimentResult.sentiment,
              confidence: sentimentResult.confidence,
              rating: sentimentResult.rating,
              customerResponse: customerResponse,
              keyInsights: keyInsights,
              keywords: keywords,
              offline: false,
            };
          } else {
            console.error("Unexpected Gemini API response format");
            result = {
              sentiment: sentimentResult.sentiment,
              confidence: sentimentResult.confidence,
              rating: sentimentResult.rating,
              customerResponse: fallbackResponse,
              offline: true,
            };
          }
        } else {
          const errorData = await response.json();
          console.error("Gemini API error:", errorData);
        }
      } catch (apiError) {
        console.error("Failed to call Gemini API:", apiError.message);
        // Continue with fallback response
      }
    } else {
      console.log("Using offline mode with fallback response");
    }

    // Update the final result with current values
    result = {
      sentiment: sentimentResult.sentiment,
      confidence: sentimentResult.confidence,
      rating: sentimentResult.rating,
      customerResponse: customerResponse,
      offline: !apiCallSuccessful,
      keyInsights: result.keyInsights || [],
      keywords: result.keywords || [],
    };

    // Save the response to MongoDB
    try {
      await connectDB();

      const newResponse = new ResponseModel({
        feedback: feedback,
        price: price || null,
        sentiment: result.sentiment,
        confidence: result.confidence,
        rating: sentimentResult.rating,
        topics: result.keywords || [],
        recommendations: result.keyInsights || [],
        customerResponse: result.customerResponse,
      });

      await newResponse.save();
      console.log("Response saved to database");
    } catch (dbError) {
      console.error("Error saving to database:", dbError);
    }

    return Response.json(result);
  } catch (error) {
    console.error("Server error:", error);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}