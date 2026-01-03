
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to auth page after a short delay
    const timer = setTimeout(() => {
      navigate('/auth', { replace: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900">Siden ikke funnet</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Sender deg til innloggingssiden om 2 sekunder...
          </p>

          <div className="mt-4">
            <button
              onClick={() => navigate('/auth', { replace: true })}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Gå til innlogging nå
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
