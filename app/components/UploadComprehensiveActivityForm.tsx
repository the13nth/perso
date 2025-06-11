import { useState, type FormEvent } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Clock, Calendar, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

export interface UploadComprehensiveActivityFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function UploadComprehensiveActivityForm({ 
  onSuccess,
  onCancel
}: UploadComprehensiveActivityFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const activityCategory = "physical";
  const [activityDate, setActivityDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [location, setLocation] = useState("");
  const [howYouFeel, setHowYouFeel] = useState("good");
  const [productivity, setProductivity] = useState("medium");
  const [goalSet, setGoalSet] = useState("");
  const [goalAchieved, setGoalAchieved] = useState("achieved");
  const [additionalNotes, setAdditionalNotes] = useState("");
  
  // Physical activity specific
  const [selectedPhysicalActivity, setSelectedPhysicalActivity] = useState("running");
  const [distance, setDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState("km");
  const [intensity, setIntensity] = useState("moderate");

  const { user } = useUser();

  // Helper function to validate duration
  const isDurationValid = () => {
    const hoursNum = parseInt(hours) || 0;
    const minutesNum = parseInt(minutes) || 0;
    return hoursNum > 0 || minutesNum > 0;
  };

  // Helper function to format duration
  const getFormattedDuration = () => {
    const hoursNum = parseInt(hours) || 0;
    const minutesNum = parseInt(minutes) || 0;
    
    if (hoursNum === 0 && minutesNum === 0) {
      return "";
    }
    
    let formatted = "";
    if (hoursNum > 0) {
      formatted += `${hoursNum} hour${hoursNum === 1 ? '' : 's'}`;
    }
    if (minutesNum > 0) {
      if (formatted) formatted += " ";
      formatted += `${minutesNum} minute${minutesNum === 1 ? '' : 's'}`;
    }
    return formatted;
  };

  const saveActivity = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Build activity data based on category
    const timestamp = new Date().toISOString();
    const contentId = `activity_${user?.id}_${Date.now()}`;
    
    const baseData = {
      // Core Metadata - Required for all content types
      contentType: 'activity' as const,
      contentId: contentId,
      userId: user?.id || '',
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      status: 'active' as const,

      // Chunking Information (activities are single chunks)
      chunkIndex: 0,
      totalChunks: 1,
      isFirstChunk: true,

      // Access Control
      access: 'personal' as const,

      // Classification & Organization
      primaryCategory: 'physical',
      secondaryCategories: [],
      tags: [selectedPhysicalActivity, intensity],

      // Content Fields
      title: `${selectedPhysicalActivity} Activity - ${activityDate}`,
      text: `Activity Type: Physical\nActivity: ${selectedPhysicalActivity}\nDuration: ${getFormattedDuration()}\nDistance: ${distance ? `${distance} ${distanceUnit}` : 'N/A'}\nIntensity: ${intensity}\nEnergy Level: ${howYouFeel}\nProductivity: ${productivity}\nGoal: ${goalSet || 'No specific goal'}\nGoal Status: ${goalAchieved}\nLocation: ${location || 'N/A'}\nNotes: ${additionalNotes || 'No additional notes'}`,
      summary: `${selectedPhysicalActivity} activity for ${getFormattedDuration()}${distance ? ` covering ${distance} ${distanceUnit}` : ''} with ${intensity} intensity.`,

      // Search Optimization
      searchableText: `${selectedPhysicalActivity} physical activity ${activityDate} ${intensity} ${howYouFeel} ${productivity} ${goalSet || ''} ${location || ''} ${additionalNotes || ''}`,
      keywords: [selectedPhysicalActivity, intensity, howYouFeel, productivity],
      language: 'en',

      // Relationships
      relatedIds: [],
      references: [],

      // Activity-specific metadata
      activity: {
        // Basic Activity Info
        activityType: 'physical' as const,
        startTime: `${activityDate}T00:00:00Z`, // We should add time picker in future
        endTime: `${activityDate}T00:00:00Z`,   // We should add time picker in future
        duration: getFormattedDuration(),
        location: location || undefined,
        
        // Metrics (1-10 scale)
        energy: howYouFeel === 'energized' ? 10 :
                howYouFeel === 'great' ? 8 :
                howYouFeel === 'good' ? 6 :
                howYouFeel === 'okay' ? 4 :
                howYouFeel === 'tired' ? 2 : 1,
        productivity: productivity === 'very_high' ? 10 :
                     productivity === 'high' ? 8 :
                     productivity === 'medium' ? 6 :
                     productivity === 'low' ? 4 : 2,
        satisfaction: goalAchieved === 'exceeded' ? 10 :
                     goalAchieved === 'achieved' ? 8 :
                     goalAchieved === 'partially' ? 6 :
                     goalAchieved === 'not_achieved' ? 4 : 5,
        
        // Goals & Progress
        goalStatus: goalAchieved === 'exceeded' || goalAchieved === 'achieved' ? 'completed' as const :
                   goalAchieved === 'partially' ? 'in_progress' as const :
                   goalAchieved === 'not_achieved' ? 'failed' as const : 
                   'not_started' as const,
        goalProgress: goalAchieved === 'exceeded' ? 100 :
                     goalAchieved === 'achieved' ? 100 :
                     goalAchieved === 'partially' ? 50 :
                     goalAchieved === 'not_achieved' ? 0 : 0,
        
        // Activity-specific metrics
        metrics: {
          activity: selectedPhysicalActivity,
          distance: distance ? `${distance} ${distanceUnit}` : undefined,
          intensity: intensity
        }
      }
    };

    let activityData = { ...baseData };
    
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/retrieval/comprehensive-activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: activityData.text,
          structuredData: activityData,
          activity: selectedPhysicalActivity,
          category: activityCategory,
          userId: user?.id,
        }),
      });

      if (response.ok) {
        toast.success("Activity saved successfully!", {
          duration: 4000,
          position: "top-center",
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          description: `Your ${activityCategory} activity has been logged.`
        });

        // Reset form
        setActivityDate(() => {
          const today = new Date();
          return today.toISOString().split('T')[0];
        });
        setHours("");
        setMinutes("");
        setLocation("");
        setHowYouFeel("good");
        setProductivity("medium");
        setGoalSet("");
        setGoalAchieved("achieved");
        setAdditionalNotes("");
        setSelectedPhysicalActivity("running");
        setDistance("");
        setDistanceUnit("km");
        setIntensity("moderate");
        
        // Call success callback
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1500);
        }
      } else {
        const errorData = await response.json();
        toast.error("Failed to save activity", {
          description: errorData.message || "An error occurred while saving your activity.",
        });
      }
    } catch (_error) {
      console.error("Error saving activity:",  _error);
      toast.error("Failed to save activity", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <form onSubmit={saveActivity} className="space-y-4">
        {/* Activity Type */}
        <div className="space-y-2">
          <Label htmlFor="activity" className="text-sm font-medium">Physical Activity</Label>
          <select
            id="activity"
            value={selectedPhysicalActivity}
            onChange={(e) => setSelectedPhysicalActivity(e.target.value)}
            className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          >
            <option value="running">Running</option>
            <option value="walking">Walking</option>
            <option value="cycling">Cycling</option>
            <option value="swimming">Swimming</option>
            <option value="weightlifting">Weightlifting</option>
            <option value="yoga">Yoga</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Common Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="activityDate" className="text-sm font-medium flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Activity Date
            </Label>
            <Input
              id="activityDate"
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="h-11 text-sm"
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration" className="text-sm font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Duration
            </Label>
            <div className="flex items-center gap-2 h-11">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  placeholder="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-20 h-11 text-sm text-center"
                  disabled={isLoading}
                />
                <span className="text-sm">hrs</span>
              </div>
              <span className="text-muted-foreground">:</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="w-20 h-11 text-sm text-center"
                  disabled={isLoading}
                />
                <span className="text-sm">min</span>
              </div>
            </div>
            {(hours || minutes) && (
              <div className="text-xs text-muted-foreground mt-1">
                Total: {getFormattedDuration()}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-medium flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              Location (optional)
            </Label>
            <Input
              id="location"
              placeholder="Where did this take place?"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-11 text-sm"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Physical Activity Details */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
          <h3 className="text-sm font-medium">Physical Activity Details</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="distance" className="text-sm font-medium flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Distance (optional)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className="flex-1 h-11 text-sm"
                  disabled={isLoading}
                />
                <select
                  value={distanceUnit}
                  onChange={(e) => setDistanceUnit(e.target.value)}
                  className="w-24 h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoading}
                >
                  <option value="km">km</option>
                  <option value="mi">mi</option>
                  <option value="m">m</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="intensity" className="text-sm font-medium">Intensity Level</Label>
              <select
                id="intensity"
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
              >
                <option value="light">Light - Easy pace, could hold a conversation</option>
                <option value="moderate">Moderate - Comfortable effort, slightly breathless</option>
                <option value="vigorous">Vigorous - Hard effort, difficult to talk</option>
                <option value="maximum">Maximum - All-out effort, cannot speak</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feeling and Productivity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="feeling" className="text-sm font-medium">How You Feel</Label>
            <select
              id="feeling"
              value={howYouFeel}
              onChange={(e) => setHowYouFeel(e.target.value)}
              className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            >
              <option value="energized">⚡ Energized</option>
              <option value="great">😄 Great</option>
              <option value="good">😊 Good</option>
              <option value="okay">😐 Okay</option>
              <option value="tired">😓 Tired</option>
              <option value="exhausted">😵 Exhausted</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="productivity" className="text-sm font-medium">Productivity Level</Label>
            <select
              id="productivity"
              value={productivity}
              onChange={(e) => setProductivity(e.target.value)}
              className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            >
              <option value="very_high">Very High - Exceptional output and efficiency</option>
              <option value="high">High - Above average productivity</option>
              <option value="medium">Medium - Average productivity level</option>
              <option value="low">Low - Below average productivity</option>
              <option value="very_low">Very Low - Minimal productivity</option>
            </select>
          </div>
        </div>

        {/* Goals Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goalSet" className="text-sm font-medium">Goal Set (optional)</Label>
            <Input
              id="goalSet"
              placeholder="What goal did you set for this activity?"
              value={goalSet}
              onChange={(e) => setGoalSet(e.target.value)}
              className="w-full h-11 text-sm"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goalAchieved" className="text-sm font-medium">Goal Achievement</Label>
            <select
              id="goalAchieved"
              value={goalAchieved}
              onChange={(e) => setGoalAchieved(e.target.value)}
              className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            >
              <option value="exceeded">Exceeded goal</option>
              <option value="achieved">Achieved goal</option>
              <option value="partially">Partially achieved</option>
              <option value="not_achieved">Did not achieve</option>
              <option value="no_goal">No specific goal</option>
            </select>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="space-y-2">
          <Label htmlFor="additionalNotes" className="text-sm font-medium">Additional Notes (optional)</Label>
          <Textarea
            id="additionalNotes"
            placeholder="Any additional thoughts, observations, or details about your activity..."
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            rows={3}
            className="resize-none text-sm min-h-[80px] leading-relaxed"
            disabled={isLoading}
          />
          <div className="text-xs text-muted-foreground text-right">
            {additionalNotes.length}/500 characters
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 sm:pt-4">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={isLoading}
              className="w-full sm:w-auto h-11 text-sm"
            >
              Cancel
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={isLoading || !isDurationValid() || !activityDate}
            className="w-full sm:flex-1 h-11 text-sm font-medium"
          >
            {isLoading ? "Saving..." : "Save Activity"}
          </Button>
        </div>
      </form>
    </div>
  );
} 