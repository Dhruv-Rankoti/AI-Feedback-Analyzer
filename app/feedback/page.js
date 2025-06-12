"use client"; // Required for Next.js App Router

import { useState } from "react";
import { MessageSquare, ThumbsUp, ThumbsDown, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { useNotification } from "@/app/components/NotificationSystem";

export default function Feedback() {
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useNotification();
  const [examples, setExamples] = useState([
    "The customer service was excellent, but the product quality could be improved.",
    "I've been using this service for 3 months and I'm very satisfied with the results.",
    "The website is difficult to navigate and I couldn't find what I was looking for."
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/analyze-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze feedback");
      }

      const data = await response.json();
      setResult(data);
      success("Feedback analyzed successfully!");
    } catch (err) {
      showError("Error analyzing feedback. Please try again.");
    }

    setLoading(false);
  };

  const useExample = (example) => {
    setFeedback(example);
  };

  const getSentimentColor = (sentiment) => {
    if (!sentiment) return "bg-gray-200 dark:bg-gray-700";
    
    switch (sentiment.toLowerCase()) {
      case "positive":
        return "bg-green-500";
      case "negative":
        return "bg-red-500";
      case "neutral":
        return "bg-yellow-500";
      default:
        return "bg-gray-200 dark:bg-gray-700";
    }
  };

  const getSentimentIcon = (sentiment) => {
    if (!sentiment) return <AlertCircle className="h-6 w-6" />;
    
    switch (sentiment.toLowerCase()) {
      case "positive":
        return <ThumbsUp className="h-6 w-6" />;
      case "negative":
        return <ThumbsDown className="h-6 w-6" />;
      case "neutral":
        return <AlertCircle className="h-6 w-6" />;
      default:
        return <AlertCircle className="h-6 w-6" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 min-h-screen">
      <div className="text-center mb-10 text-white">
        <h1 className="text-3xl md:text-4xl font-bold dark:text-white mb-4">AI Feedback Analyzer</h1>
        <p className="text-lg  dark:text-gray-300 max-w-3xl mx-auto">
          Enter customer feedback below and our AI will analyze the sentiment, identify key topics, and provide actionable insights.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 flex items-center text-blue-500">
              <MessageSquare className="mr-2 h-5 w-5 text-blue-500" />
              Submit Feedback
            </h2>
            
            <form onSubmit={handleSubmit}>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 p-4 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter customer feedback here..."
                rows={6}
                required
              ></textarea>

              <button
                type="submit"
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg flex items-center justify-center transition-colors duration-200"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Analyze Feedback
                  </>
                )}
              </button>
            </form>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Try these examples:</h3>
              <div className="space-y-2">
                {examples.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => useExample(example)}
                    className="text-left text-sm p-2 w-full text-black bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          {result ? (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-blue-500" />
                Analysis Results
              </h2>

              <div className="space-y-6">
                {/* Sentiment Analysis */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="font-medium mb-3">Sentiment Analysis</h3>
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white mr-4" 
                      style={{ backgroundColor: getSentimentColor(result.sentiment) }}>
                      {getSentimentIcon(result.sentiment)}
                    </div>
                    <div>
                      <div className="font-bold text-lg">{result.sentiment}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Confidence: {result.confidence}%
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Rating: {result.rating} ⭐
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Topics */}
                {result.topics && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="font-medium mb-3">Key Topics</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.topics.map((topic, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {result.recommendations && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="font-medium mb-3">Recommendations</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      {result.recommendations.map((recommendation, index) => (
                        <li key={index}>{recommendation}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Customer Response */}
                {result.customerResponse && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="font-medium mb-3">Response to Customer</h3>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 rounded text-gray-700 dark:text-gray-300">
                      {result.customerResponse}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setResult(null)}
                className="mt-6 w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                Analyze Another Feedback
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg h-full flex items-center justify-center">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Enter feedback and click &quot;Analyze Feedback&quot; to see results here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
