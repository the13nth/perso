"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { useUser } from "@clerk/nextjs";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { CheckCircle2, Activity, Bike, Dumbbell, Heart, Zap, Trophy, Target, Mountain, Clock, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export interface UploadActivityFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function UploadActivityForm({ 
  onSuccess,
  onCancel
}: UploadActivityFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState("running");
  const [duration, setDuration] = useState("");
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState("miles");
  const [intensity, setIntensity] = useState("medium");
  const [howYouFeel, setHowYouFeel] = useState("good");
  const [goalSet, setGoalSet] = useState("");
  const [goalAchieved, setGoalAchieved] = useState("yes");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const { user } = useUser();

  const activities = [
    { value: "running", label: "Running", icon: <Zap className="h-4 w-4" /> },
    { value: "walking", label: "Walking", icon: <Activity className="h-4 w-4" /> },
    { value: "cycling", label: "Cycling", icon: <Bike className="h-4 w-4" /> },
    { value: "swimming", label: "Swimming", icon: <Activity className="h-4 w-4" /> },
    { value: "weightlifting", label: "Weightlifting", icon: <Dumbbell className="h-4 w-4" /> },
    { value: "yoga", label: "Yoga", icon: <Heart className="h-4 w-4" /> },
    { value: "basketball", label: "Basketball", icon: <Trophy className="h-4 w-4" /> },
    { value: "soccer", label: "Soccer", icon: <Trophy className="h-4 w-4" /> },
    { value: "tennis", label: "Tennis", icon: <Trophy className="h-4 w-4" /> },
    { value: "hiking", label: "Hiking", icon: <Mountain className="h-4 w-4" /> },
    { value: "dancing", label: "Dancing", icon: <Activity className="h-4 w-4" /> },
    { value: "boxing", label: "Boxing", icon: <Target className="h-4 w-4" /> },
    { value: "pilates", label: "Pilates", icon: <Heart className="h-4 w-4" /> },
    { value: "climbing", label: "Rock Climbing", icon: <Mountain className="h-4 w-4" /> },
    { value: "skateboarding", label: "Skateboarding", icon: <Activity className="h-4 w-4" /> },
    { value: "golf", label: "Golf", icon: <Trophy className="h-4 w-4" /> },
    { value: "baseball", label: "Baseball", icon: <Trophy className="h-4 w-4" /> },
    { value: "football", label: "Football", icon: <Trophy className="h-4 w-4" /> },
    { value: "volleyball", label: "Volleyball", icon: <Trophy className="h-4 w-4" /> },
    { value: "badminton", label: "Badminton", icon: <Trophy className="h-4 w-4" /> },
    { value: "crossfit", label: "CrossFit", icon: <Dumbbell className="h-4 w-4" /> },
    { value: "rowing", label: "Rowing", icon: <Activity className="h-4 w-4" /> },
    { value: "skiing", label: "Skiing", icon: <Mountain className="h-4 w-4" /> },
    { value: "surfing", label: "Surfing", icon: <Activity className="h-4 w-4" /> },
    { value: "martial_arts", label: "Martial Arts", icon: <Target className="h-4 w-4" /> },
    { value: "other", label: "Other", icon: <Activity className="h-4 w-4" /> },
  ];

  const durations = [
    { value: "15min", label: "15 minutes" },
    { value: "30min", label: "30 minutes" },
    { value: "45min", label: "45 minutes" },
    { value: "1hr", label: "1 hour" },
    { value: "1hr30min", label: "1 hour 30 minutes" },
    { value: "2hr", label: "2 hours" },
    { value: "2hr30min", label: "2 hours 30 minutes" },
    { value: "3hr", label: "3 hours" },
    { value: "3hr+", label: "3+ hours" },
    { value: "custom", label: "Custom" },
  ];

  const distanceUnits = [
    { value: "miles", label: "Miles" },
    { value: "km", label: "Kilometers" },
    { value: "meters", label: "Meters" },
    { value: "yards", label: "Yards" },
    { value: "laps", label: "Laps" },
    { value: "floors", label: "Floors" },
  ];

  const intensityLevels = [
    { value: "light", label: "Light", description: "Easy pace, could hold a conversation" },
    { value: "moderate", label: "Moderate", description: "Comfortable effort, slightly breathless" },
    { value: "vigorous", label: "Vigorous", description: "Hard effort, difficult to talk" },
    { value: "maximum", label: "Maximum", description: "All-out effort, cannot speak" },
  ];

  const feelings = [
    { value: "energized", label: "Energized", icon: "⚡" },
    { value: "great", label: "Great", icon: "😄" },
    { value: "good", label: "Good", icon: "😊" },
    { value: "okay", label: "Okay", icon: "😐" },
    { value: "tired", label: "Tired", icon: "😓" },
    { value: "exhausted", label: "Exhausted", icon: "😵" },
    { value: "sore", label: "Sore", icon: "😣" },
    { value: "accomplished", label: "Accomplished", icon: "🏆" },
  ];

  const goalAchievements = [
    { value: "exceeded", label: "Exceeded goal" },
    { value: "achieved", label: "Achieved goal" },
    { value: "partially", label: "Partially achieved" },
    { value: "not_achieved", label: "Did not achieve" },
    { value: "no_goal", label: "No specific goal" },
  ];

  // Helper function to format duration
  const getFormattedDuration = () => {
    if (duration === "custom") {
      const hours = parseInt(customHours) || 0;
      const minutes = parseInt(customMinutes) || 0;
      
      if (hours === 0 && minutes === 0) {
        return "Custom duration (not specified)";
      }
      
      let formatted = "";
      if (hours > 0) {
        formatted += `${hours} hour${hours === 1 ? '' : 's'}`;
      }
      if (minutes > 0) {
        if (formatted) formatted += " ";
        formatted += `${minutes} minute${minutes === 1 ? '' : 's'}`;
      }
      return formatted;
    }
    return duration;
  };

  // Helper function to validate duration
  const isDurationValid = () => {
    if (!duration) return false;
    if (duration === "custom") {
      const hours = parseInt(customHours) || 0;
      const minutes = parseInt(customMinutes) || 0;
      return hours > 0 || minutes > 0;
    }
    return true;
  };

  const saveActivity = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Build structured activity data
    const activityData = {
      activity: selectedActivity,
      duration: getFormattedDuration(),
      distance: distance ? `${distance} ${distanceUnit}` : "",
      intensity: intensity,
      feeling: howYouFeel,
      goalSet: goalSet,
      goalAchieved: goalAchieved,
      additionalNotes: additionalNotes,
    };

    // Create a formatted text summary for embedding
    const textSummary = `
Activity: ${activities.find(a => a.value === selectedActivity)?.label}
Duration: ${getFormattedDuration() || 'Not specified'}
${distance ? `Distance: ${distance} ${distanceUnit}` : ''}
Intensity: ${intensityLevels.find(i => i.value === intensity)?.label}
How I felt: ${feelings.find(f => f.value === howYouFeel)?.label}
${goalSet ? `Goal: ${goalSet}` : ''}
Goal achievement: ${goalAchievements.find(g => g.value === goalAchieved)?.label}
${additionalNotes ? `Notes: ${additionalNotes}` : ''}
    `.trim();

    setIsLoading(true);
    
    try {
      const response = await fetch("/api/retrieval/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textSummary,
          structuredData: activityData,
          activity: selectedActivity,
          userId: user?.id,
        }),
      });

      if (response.ok) {
        toast.success("Activity saved successfully!", {
          duration: 4000,
          position: "top-center",
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          description: `Your ${activities.find(a => a.value === selectedActivity)?.label.toLowerCase()} session has been logged.`
        });

        // Reset form
        setSelectedActivity("running");
        setDuration("");
        setCustomHours("");
        setCustomMinutes("");
        setDistance("");
        setDistanceUnit("miles");
        setIntensity("moderate");
        setHowYouFeel("good");
        setGoalSet("");
        setGoalAchieved("achieved");
        setAdditionalNotes("");
        
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
    } catch (error) {
      console.error("Error saving activity:", error);
      toast.error("Failed to save activity", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">Log Activity</h2>
        <p className="text-muted-foreground text-sm">
          Track your physical activities with detailed metrics. Fill in the relevant fields for your workout.
        </p>
      </div>

      <form onSubmit={saveActivity} className="space-y-4">
        {/* Activity Type */}
        <div className="space-y-2">
          <Label htmlFor="activity" className="text-sm font-medium">Activity Type</Label>
          <Select value={selectedActivity} onValueChange={setSelectedActivity}>
            <SelectTrigger className="w-full h-11 text-sm">
              <SelectValue placeholder="Select an activity" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {activities.map((activity) => (
                <SelectItem key={activity.value} value={activity.value} className="py-3">
                  <div className="flex items-center gap-2">
                    {activity.icon}
                    <span className="text-sm">{activity.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Duration and Distance Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-sm font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Duration
            </Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="w-full h-11 text-sm">
                <SelectValue placeholder="How long?" />
              </SelectTrigger>
              <SelectContent>
                {durations.map((dur) => (
                  <SelectItem key={dur.value} value={dur.value} className="py-2">
                    <span className="text-sm">{dur.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {duration === "custom" && (
              <div className="mt-3 p-3 bg-muted/30 rounded-lg border">
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Custom Duration
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      placeholder="0"
                      value={customHours}
                      onChange={(e) => setCustomHours(e.target.value)}
                      className="w-16 h-9 text-sm text-center"
                      disabled={isLoading}
                    />
                    <span className="text-xs text-muted-foreground">hrs</span>
                  </div>
                  <span className="text-muted-foreground">:</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      className="w-16 h-9 text-sm text-center"
                      disabled={isLoading}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {customHours || customMinutes ? (
                    `Total: ${customHours || '0'} hour${(customHours || '0') === '1' ? '' : 's'} ${customMinutes || '0'} minute${(customMinutes || '0') === '1' ? '' : 's'}`
                  ) : (
                    'Enter hours and/or minutes'
                  )}
                </div>
              </div>
            )}
          </div>

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
                className="h-11 text-sm"
                disabled={isLoading}
              />
              <Select value={distanceUnit} onValueChange={setDistanceUnit}>
                <SelectTrigger className="w-24 h-11 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {distanceUnits.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      <span className="text-sm">{unit.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Intensity and Feeling Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="intensity" className="text-sm font-medium">Intensity Level</Label>
            <Select value={intensity} onValueChange={setIntensity}>
              <SelectTrigger className="w-full h-11 text-sm">
                <SelectValue placeholder="Select intensity" />
              </SelectTrigger>
              <SelectContent>
                {intensityLevels.map((level) => (
                  <SelectItem key={level.value} value={level.value} className="py-3">
                    <div>
                      <div className="text-sm font-medium">{level.label}</div>
                      <div className="text-xs text-muted-foreground">{level.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feeling" className="text-sm font-medium">How You Feel</Label>
            <Select value={howYouFeel} onValueChange={setHowYouFeel}>
              <SelectTrigger className="w-full h-11 text-sm">
                <SelectValue placeholder="How do you feel?" />
              </SelectTrigger>
              <SelectContent>
                {feelings.map((feeling) => (
                  <SelectItem key={feeling.value} value={feeling.value} className="py-2">
                    <div className="flex items-center gap-2">
                      <span>{feeling.icon}</span>
                      <span className="text-sm">{feeling.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Goals Section */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
          <h3 className="text-sm font-medium">Goals & Achievement</h3>
          
          <div className="space-y-2">
            <Label htmlFor="goalSet" className="text-sm font-medium">Goal Set (optional)</Label>
            <Input
              id="goalSet"
              placeholder="e.g., Run 5K under 25 minutes, Complete 3 sets of 10 reps, etc."
              value={goalSet}
              onChange={(e) => setGoalSet(e.target.value)}
              className="h-11 text-sm"
              disabled={isLoading}
            />
          </div>

          {goalSet && (
            <div className="space-y-2">
              <Label htmlFor="goalAchieved" className="text-sm font-medium">Goal Achievement</Label>
              <Select value={goalAchieved} onValueChange={setGoalAchieved}>
                <SelectTrigger className="w-full h-11 text-sm">
                  <SelectValue placeholder="Did you achieve your goal?" />
                </SelectTrigger>
                <SelectContent>
                  {goalAchievements.map((achievement) => (
                    <SelectItem key={achievement.value} value={achievement.value} className="py-2">
                      <span className="text-sm">{achievement.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Additional Notes */}
        <div className="space-y-2">
          <Label htmlFor="additionalNotes" className="text-sm font-medium">Additional Notes (optional)</Label>
          <Textarea
            id="additionalNotes"
            placeholder="Any additional thoughts, observations, or details about your workout..."
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
            disabled={isLoading || !isDurationValid()}
            className="w-full sm:flex-1 h-11 text-sm font-medium"
          >
            {isLoading ? "Saving..." : "Save Activity"}
          </Button>
        </div>
      </form>
    </div>
  );
} 