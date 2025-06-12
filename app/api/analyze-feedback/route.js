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

    // Add a timeout promise
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), 9000); // 9 seconds timeout (Vercel has 10s limit)
    });

    // Analyze sentiment with timeout
    const sentimentPromise = analyzeSentimentWithModel(feedback, price, rating);
    const sentimentResult = await Promise.race([sentimentPromise, timeout]).catch(
      (error) => {
        console.error("Sentiment analysis error or timeout:", error);
        // Fallback to basic sentiment analysis
        return {
          sentiment: "Neutral",
          confidence: 50,
          rating: 3,
        };
      }
    );

    // Generate response
    const fallbackResponse =
      FALLBACK_RESPONSES[sentimentResult.sentiment] ||
      FALLBACK_RESPONSES.Neutral;

    // Quick return if no API key or in development
    if (!process.env.GEMINI_API_KEY || process.env.NODE_ENV === "development") {
      return Response.json({
        sentiment: sentimentResult.sentiment,
        confidence: sentimentResult.confidence,
        rating: sentimentResult.rating,
        customerResponse: fallbackResponse,
        keyInsights: [],
        keywords: [],
        offline: true,
      });
    }

    // Try Gemini API with timeout
    try {
      const geminiPromise = fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this ${sentimentResult.sentiment} feedback: "${feedback}"`,
                  },
                ],
              },
            ],
          }),
        }
      );

      const response = await Promise.race([geminiPromise, timeout]);

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
  } catch (error) {
    console.error("Server error:", error);
    return Response.json(
      {
        error: "Server error",
        fallback: true,
        sentiment: "Neutral",
        confidence: 50,
        customerResponse: FALLBACK_RESPONSES.Neutral,
      },
      { status: 200 }
    ); // Return 200 with fallback instead of 500
  }
}