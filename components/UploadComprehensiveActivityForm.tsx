"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/nextjs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Activity, Bike, Dumbbell, Heart, Zap, Trophy, Target, Mountain, Clock, MapPin, Briefcase, BookOpen, Coffee, Monitor, Users, Calendar, FileText, Brain, Home, Moon, Sun, Utensils, Gamepad2 } from "lucide-react";
import Select, { StylesConfig } from 'react-select';

export interface UploadComprehensiveActivityFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface BaseActivityData {
  category: string;
  activityDate: string;
  activityTime: string;
  notes: string;
  activity: string;
}

interface PhysicalActivityData extends BaseActivityData {
  distance: string;
  intensity: string;
}

interface WorkActivityData extends BaseActivityData {
  projectName: string;
  collaborators: string;
  workTools: string;
  tasksCompleted: string;
  focusLevel: string;
}

interface StudyActivityData extends BaseActivityData {
  subject: string;
  studyMaterial: string;
  comprehensionLevel: string;
  notesCreated: string;
}

interface RoutineActivityData extends BaseActivityData {
  routineSteps: string;
  consistency: string;
  moodBefore: string;
  moodAfter: string;
}

type ActivityData = PhysicalActivityData | WorkActivityData | StudyActivityData | RoutineActivityData;

export function UploadComprehensiveActivityForm({ 
  onSuccess,
  onCancel
}: UploadComprehensiveActivityFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activityCategory, setActivityCategory] = useState("physical");
  
  // Common fields
  const [activityDate, setActivityDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  });
  const [duration, setDuration] = useState("");
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [howYouFeel, setHowYouFeel] = useState("good");
  const [productivity, setProductivity] = useState("medium");
  const [goalSet, setGoalSet] = useState("");
  const [goalAchieved, setGoalAchieved] = useState("achieved");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [location, setLocation] = useState("");
  
  // Physical activity specific
  const [selectedPhysicalActivity, setSelectedPhysicalActivity] = useState("running");
  const [distance, setDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState("km");
  const [intensity, setIntensity] = useState("moderate");
  
  // Work activity specific
  const [selectedWorkActivity, setSelectedWorkActivity] = useState("coding");
  const [projectName, setProjectName] = useState("");
  const [collaborators, setCollaborators] = useState("");
  const [workTools, setWorkTools] = useState("");
  const [tasksCompleted, setTasksCompleted] = useState("");
  const [focusLevel, setFocusLevel] = useState("high");
  
  // Study activity specific
  const [selectedStudyActivity, setSelectedStudyActivity] = useState("reading");
  const [subject, setSubject] = useState("");
  const [studyMaterial, setStudyMaterial] = useState("");
  const [comprehensionLevel, setComprehensionLevel] = useState("good");
  const [notesCreated, setNotesCreated] = useState("");
  
  // Routine activity specific
  const [selectedRoutineActivity, setSelectedRoutineActivity] = useState("morning_routine");
  const [routineSteps, setRoutineSteps] = useState("");
  const [consistency, setConsistency] = useState("consistent");
  const [moodBefore, setMoodBefore] = useState("neutral");
  const [moodAfter, setMoodAfter] = useState("good");

  const { user } = useUser();

  // Activity categories
  const activityCategories = [
    { value: "physical", label: "Physical", icon: <Activity className="h-4 w-4" />, description: "Exercise, sports, and physical activities" },
    { value: "work", label: "Work", icon: <Briefcase className="h-4 w-4" />, description: "Professional tasks and projects" },
    { value: "study", label: "Study", icon: <BookOpen className="h-4 w-4" />, description: "Learning and educational activities" },
    { value: "routine", label: "Routine", icon: <Clock className="h-4 w-4" />, description: "Daily routines and habits" },
  ];

  // Physical activities
  const physicalActivities = [
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
    { value: "other_physical", label: "Other Physical", icon: <Activity className="h-4 w-4" /> },
  ];

  // Work activities
  const workActivities = [
    { value: "coding", label: "Coding/Programming", icon: <Monitor className="h-4 w-4" /> },
    { value: "meeting", label: "Meeting", icon: <Users className="h-4 w-4" /> },
    { value: "planning", label: "Planning/Strategy", icon: <Calendar className="h-4 w-4" /> },
    { value: "writing", label: "Writing/Documentation", icon: <FileText className="h-4 w-4" /> },
    { value: "design", label: "Design/Creative", icon: <Brain className="h-4 w-4" /> },
    { value: "research", label: "Research", icon: <BookOpen className="h-4 w-4" /> },
    { value: "review", label: "Code/Content Review", icon: <FileText className="h-4 w-4" /> },
    { value: "debugging", label: "Debugging/Troubleshooting", icon: <Target className="h-4 w-4" /> },
    { value: "learning_work", label: "Professional Learning", icon: <Brain className="h-4 w-4" /> },
    { value: "admin", label: "Administrative Tasks", icon: <Briefcase className="h-4 w-4" /> },
    { value: "other_work", label: "Other Work", icon: <Briefcase className="h-4 w-4" /> },
  ];

  // Study activities
  const studyActivities = [
    { value: "reading", label: "Reading", icon: <BookOpen className="h-4 w-4" /> },
    { value: "course", label: "Online Course", icon: <Monitor className="h-4 w-4" /> },
    { value: "lecture", label: "Lecture/Seminar", icon: <Users className="h-4 w-4" /> },
    { value: "practice", label: "Practice/Exercises", icon: <Target className="h-4 w-4" /> },
    { value: "research_study", label: "Research", icon: <Brain className="h-4 w-4" /> },
    { value: "note_taking", label: "Note Taking", icon: <FileText className="h-4 w-4" /> },
    { value: "flashcards", label: "Flashcards/Memorization", icon: <Brain className="h-4 w-4" /> },
    { value: "tutorial", label: "Tutorial/Video Learning", icon: <Monitor className="h-4 w-4" /> },
    { value: "discussion", label: "Study Group/Discussion", icon: <Users className="h-4 w-4" /> },
    { value: "exam_prep", label: "Exam Preparation", icon: <FileText className="h-4 w-4" /> },
    { value: "other_study", label: "Other Study", icon: <BookOpen className="h-4 w-4" /> },
  ];

  // Routine activities
  const routineActivities = [
    { value: "morning_routine", label: "Morning Routine", icon: <Sun className="h-4 w-4" /> },
    { value: "evening_routine", label: "Evening Routine", icon: <Moon className="h-4 w-4" /> },
    { value: "meditation", label: "Meditation", icon: <Heart className="h-4 w-4" /> },
    { value: "meal_prep", label: "Meal Preparation", icon: <Utensils className="h-4 w-4" /> },
    { value: "cleaning", label: "Cleaning/Organizing", icon: <Home className="h-4 w-4" /> },
    { value: "personal_care", label: "Personal Care", icon: <Heart className="h-4 w-4" /> },
    { value: "relaxation", label: "Relaxation/Downtime", icon: <Coffee className="h-4 w-4" /> },
    { value: "social", label: "Social Time", icon: <Users className="h-4 w-4" /> },
    { value: "entertainment", label: "Entertainment", icon: <Gamepad2 className="h-4 w-4" /> },
    { value: "commute", label: "Commuting", icon: <MapPin className="h-4 w-4" /> },
    { value: "other_routine", label: "Other Routine", icon: <Clock className="h-4 w-4" /> },
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
    { value: "4hr", label: "4 hours" },
    { value: "5hr", label: "5 hours" },
    { value: "6hr", label: "6 hours" },
    { value: "8hr", label: "8 hours" },
    { value: "custom", label: "Custom duration" },
  ];

  const feelingOptions = [
    { value: "energized", label: "Energized", icon: "⚡" },
    { value: "great", label: "Great", icon: "😄" },
    { value: "good", label: "Good", icon: "😊" },
    { value: "okay", label: "Okay", icon: "😐" },
    { value: "tired", label: "Tired", icon: "😓" },
    { value: "exhausted", label: "Exhausted", icon: "😵" },
    { value: "frustrated", label: "Frustrated", icon: "😤" },
    { value: "accomplished", label: "Accomplished", icon: "🏆" },
    { value: "focused", label: "Focused", icon: "🎯" },
    { value: "distracted", label: "Distracted", icon: "😵‍💫" },
  ];

  const productivityLevels = [
    { value: "very_high", label: "Very High", description: "Exceptional output and efficiency" },
    { value: "high", label: "High", description: "Above average productivity" },
    { value: "medium", label: "Medium", description: "Average productivity level" },
    { value: "low", label: "Low", description: "Below average productivity" },
    { value: "very_low", label: "Very Low", description: "Minimal productivity" },
  ];

  const goalAchievements = [
    { value: "exceeded", label: "Exceeded goal" },
    { value: "achieved", label: "Achieved goal" },
    { value: "partially", label: "Partially achieved" },
    { value: "not_achieved", label: "Did not achieve" },
    { value: "no_goal", label: "No specific goal" },
  ];

  // Physical activity specific options
  const intensityLevels = [
    { value: "light", label: "Light", description: "Easy pace, could hold a conversation" },
    { value: "moderate", label: "Moderate", description: "Comfortable effort, slightly breathless" },
    { value: "vigorous", label: "Vigorous", description: "Hard effort, difficult to talk" },
    { value: "maximum", label: "Maximum", description: "All-out effort, cannot speak" },
  ];

  const distanceUnits = [
    { value: "km", label: "Kilometers" },
  ];

  // Work activity specific options
  const focusLevels = [
    { value: "very_high", label: "Very High", description: "Deep focus, minimal distractions" },
    { value: "high", label: "High", description: "Good focus, occasional distractions" },
    { value: "medium", label: "Medium", description: "Average focus level" },
    { value: "low", label: "Low", description: "Frequent distractions" },
    { value: "very_low", label: "Very Low", description: "Constant distractions" },
  ];

  // Study activity specific options
  const comprehensionLevels = [
    { value: "excellent", label: "Excellent", description: "Fully understood all concepts" },
    { value: "good", label: "Good", description: "Understood most concepts well" },
    { value: "fair", label: "Fair", description: "Understood some concepts" },
    { value: "poor", label: "Poor", description: "Struggled to understand" },
    { value: "very_poor", label: "Very Poor", description: "Did not understand much" },
  ];

  // Routine activity specific options
  const consistencyLevels = [
    { value: "perfect", label: "Perfect", description: "Completed exactly as planned" },
    { value: "consistent", label: "Consistent", description: "Mostly followed the routine" },
    { value: "partial", label: "Partial", description: "Completed some parts" },
    { value: "inconsistent", label: "Inconsistent", description: "Missed several parts" },
    { value: "skipped", label: "Skipped", description: "Mostly or completely skipped" },
  ];

  const moodOptions = [
    { value: "excellent", label: "Excellent", icon: "😄" },
    { value: "good", label: "Good", icon: "😊" },
    { value: "neutral", label: "Neutral", icon: "😐" },
    { value: "poor", label: "Poor", icon: "😞" },
    { value: "very_poor", label: "Very Poor", icon: "😢" },
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
    
    // Build activity data based on category
    const baseData: BaseActivityData = {
      category: activityCategory,
      activityDate: activityDate,
      activityTime: getFormattedDuration(),
      notes: additionalNotes,
      activity: "",
    };

    let activityData: ActivityData = { ...baseData } as ActivityData;
    let selectedActivity = "";
    let textSummary = "";

    // Add category-specific data
    switch (activityCategory) {
      case "physical":
        selectedActivity = selectedPhysicalActivity;
        activityData = {
          ...activityData,
          activity: selectedPhysicalActivity,
          distance: distance ? `${distance} ${distanceUnit}` : "",
          intensity: intensity,
        };
        textSummary = `
Physical Activity: ${physicalActivities.find(a => a.value === selectedPhysicalActivity)?.label}
Category: Physical, ${selectedPhysicalActivity}
Date: ${activityDate}
Duration: ${getFormattedDuration() || 'Not specified'}
${distance ? `Distance: ${distance} ${distanceUnit}` : ''}
Intensity: ${intensityLevels.find(i => i.value === intensity)?.label}
How I felt: ${feelingOptions.find(f => f.value === howYouFeel)?.label}
Productivity: ${productivityLevels.find(p => p.value === productivity)?.label}
${location ? `Location: ${location}` : ''}
${goalSet ? `Goal: ${goalSet}` : ''}
Goal achievement: ${goalAchievements.find(g => g.value === goalAchieved)?.label}
${additionalNotes ? `Notes: ${additionalNotes}` : ''}
        `.trim();
        break;

      case "work":
        selectedActivity = selectedWorkActivity;
        activityData = {
          ...activityData,
          activity: selectedWorkActivity,
          projectName: projectName,
          collaborators: collaborators,
          workTools: workTools,
          tasksCompleted: tasksCompleted,
          focusLevel: focusLevel,
        };
        textSummary = `
Work Activity: ${workActivities.find(a => a.value === selectedWorkActivity)?.label}
Category: Work, ${selectedWorkActivity}
Date: ${activityDate}
Duration: ${getFormattedDuration() || 'Not specified'}
${projectName ? `Project: ${projectName}` : ''}
${collaborators ? `Collaborators: ${collaborators}` : ''}
${workTools ? `Tools Used: ${workTools}` : ''}
${tasksCompleted ? `Tasks Completed: ${tasksCompleted}` : ''}
Focus Level: ${focusLevels.find(f => f.value === focusLevel)?.label}
How I felt: ${feelingOptions.find(f => f.value === howYouFeel)?.label}
Productivity: ${productivityLevels.find(p => p.value === productivity)?.label}
${location ? `Location: ${location}` : ''}
${goalSet ? `Goal: ${goalSet}` : ''}
Goal achievement: ${goalAchievements.find(g => g.value === goalAchieved)?.label}
${additionalNotes ? `Notes: ${additionalNotes}` : ''}
        `.trim();
        break;

      case "study":
        selectedActivity = selectedStudyActivity;
        activityData = {
          ...activityData,
          activity: selectedStudyActivity,
          subject: subject,
          studyMaterial: studyMaterial,
          comprehensionLevel: comprehensionLevel,
          notesCreated: notesCreated,
        };
        textSummary = `
Study Activity: ${studyActivities.find(a => a.value === selectedStudyActivity)?.label}
Category: Study, ${selectedStudyActivity}
Date: ${activityDate}
Duration: ${getFormattedDuration() || 'Not specified'}
${subject ? `Subject: ${subject}` : ''}
${studyMaterial ? `Study Material: ${studyMaterial}` : ''}
Comprehension Level: ${comprehensionLevels.find(c => c.value === comprehensionLevel)?.label}
${notesCreated ? `Notes Created: ${notesCreated}` : ''}
How I felt: ${feelingOptions.find(f => f.value === howYouFeel)?.label}
Productivity: ${productivityLevels.find(p => p.value === productivity)?.label}
${location ? `Location: ${location}` : ''}
${goalSet ? `Goal: ${goalSet}` : ''}
Goal achievement: ${goalAchievements.find(g => g.value === goalAchieved)?.label}
${additionalNotes ? `Notes: ${additionalNotes}` : ''}
        `.trim();
        break;

      case "routine":
        selectedActivity = selectedRoutineActivity;
        activityData = {
          ...activityData,
          activity: selectedRoutineActivity,
          routineSteps: routineSteps,
          consistency: consistency,
          moodBefore: moodBefore,
          moodAfter: moodAfter,
        };
        textSummary = `
Routine Activity: ${routineActivities.find(a => a.value === selectedRoutineActivity)?.label}
Category: Routine, ${selectedRoutineActivity}
Date: ${activityDate}
Duration: ${getFormattedDuration() || 'Not specified'}
${routineSteps ? `Routine Steps: ${routineSteps}` : ''}
Consistency: ${consistencyLevels.find(c => c.value === consistency)?.label}
Mood Before: ${moodOptions.find(m => m.value === moodBefore)?.label}
Mood After: ${moodOptions.find(m => m.value === moodAfter)?.label}
How I felt: ${feelingOptions.find(f => f.value === howYouFeel)?.label}
Productivity: ${productivityLevels.find(p => p.value === productivity)?.label}
${location ? `Location: ${location}` : ''}
${goalSet ? `Goal: ${goalSet}` : ''}
Goal achievement: ${goalAchievements.find(g => g.value === goalAchieved)?.label}
${additionalNotes ? `Notes: ${additionalNotes}` : ''}
        `.trim();
        break;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch("/api/retrieval/comprehensive-activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textSummary,
          structuredData: activityData,
          activity: selectedActivity,
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
        resetForm();
        
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

  const resetForm = () => {
    setActivityDate(() => {
      const today = new Date();
      return today.toISOString().split('T')[0];
    });
    setDuration("");
    setCustomHours("");
    setCustomMinutes("");
    setHowYouFeel("good");
    setProductivity("medium");
    setGoalSet("");
    setGoalAchieved("achieved");
    setAdditionalNotes("");
    setLocation("");
    
    // Reset physical activity fields
    setSelectedPhysicalActivity("running");
    setDistance("");
    setDistanceUnit("km");
    setIntensity("moderate");
    
    // Reset work activity fields
    setSelectedWorkActivity("coding");
    setProjectName("");
    setCollaborators("");
    setWorkTools("");
    setTasksCompleted("");
    setFocusLevel("high");
    
    // Reset study activity fields
    setSelectedStudyActivity("reading");
    setSubject("");
    setStudyMaterial("");
    setComprehensionLevel("good");
    setNotesCreated("");
    
    // Reset routine activity fields
    setSelectedRoutineActivity("morning_routine");
    setRoutineSteps("");
    setConsistency("consistent");
    setMoodBefore("neutral");
    setMoodAfter("good");
  };

  const getCurrentActivityList = () => {
    switch (activityCategory) {
      case "physical": return physicalActivities;
      case "work": return workActivities;
      case "study": return studyActivities;
      case "routine": return routineActivities;
      default: return physicalActivities;
    }
  };

  const getCurrentSelectedActivity = () => {
    switch (activityCategory) {
      case "physical": return selectedPhysicalActivity;
      case "work": return selectedWorkActivity;
      case "study": return selectedStudyActivity;
      case "routine": return selectedRoutineActivity;
      default: return selectedPhysicalActivity;
    }
  };

  const setCurrentSelectedActivity = (value: string) => {
    switch (activityCategory) {
      case "physical": setSelectedPhysicalActivity(value); break;
      case "work": setSelectedWorkActivity(value); break;
      case "study": setSelectedStudyActivity(value); break;
      case "routine": setSelectedRoutineActivity(value); break;
    }
  };

  // Create a reusable styles configuration
  const selectStyles: StylesConfig<{value: string, label: string}, false> = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '44px',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px',
      backgroundColor: 'hsl(var(--background))',
      boxShadow: state.isFocused ? '0 0 0 2px hsl(var(--ring))' : 'none',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))'
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? 'hsl(var(--accent))' 
        : state.isFocused 
          ? 'hsl(var(--accent) / 0.5)' 
          : 'transparent',
      color: 'hsl(var(--foreground))',
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'hsl(var(--foreground))'
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'hsl(var(--muted-foreground))'
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px'
    })
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">Log Activity</h2>
        <p className="text-muted-foreground text-sm">
          Track your activities across different categories with detailed metrics and insights.
        </p>
      </div>

      <form onSubmit={saveActivity} className="space-y-4">
        {/* Activity Category Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Activity Category</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {activityCategories.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => setActivityCategory(category.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  activityCategory === category.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {category.icon}
                  <span className="text-sm font-medium">{category.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{category.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Activity Type Selection */}
        <div className="space-y-2">
          <Label htmlFor="activity" className="text-sm font-medium">
            {activityCategories.find(c => c.value === activityCategory)?.label} Activity
          </Label>
          <Select
            options={getCurrentActivityList().map(activity => ({
              value: activity.value,
              label: activity.label
            }))}
            value={getCurrentActivityList().map(activity => ({
              value: activity.value,
              label: activity.label
            })).find(option => option.value === getCurrentSelectedActivity()) || null}
            onChange={(option) => setCurrentSelectedActivity(option?.value || "")}
            placeholder="Select an activity"
            isDisabled={isLoading}
            styles={selectStyles}
          />
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
            <Select
              options={durations.map(dur => ({
                value: dur.value,
                label: dur.label
              }))}
              value={durations.map(dur => ({
                value: dur.value,
                label: dur.label
              })).find(option => option.value === duration) || null}
              onChange={(option) => setDuration(option?.value || "")}
              placeholder="How long?"
              isDisabled={isLoading}
              styles={selectStyles}
            />
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

        {/* Category-specific fields */}
        {activityCategory === "physical" && (
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
                  <Select
                    options={distanceUnits.map(unit => ({
                      value: unit.value,
                      label: unit.label
                    }))}
                    value={distanceUnits.map(unit => ({
                      value: unit.value,
                      label: unit.label
                    })).find(option => option.value === distanceUnit) || null}
                    onChange={(option) => setDistanceUnit(option?.value || "")}
                    isDisabled={isLoading}
                    styles={selectStyles}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="intensity" className="text-sm font-medium">Intensity Level</Label>
                <Select
                  options={intensityLevels.map(level => ({
                    value: level.value,
                    label: `${level.label} - ${level.description}`
                  }))}
                  value={intensityLevels.map(level => ({
                    value: level.value,
                    label: `${level.label} - ${level.description}`
                  })).find(option => option.value === intensity) || null}
                  onChange={(option) => setIntensity(option?.value || "")}
                  placeholder="Select intensity"
                  isDisabled={isLoading}
                  styles={selectStyles}
                />
              </div>
            </div>
          </div>
        )}

        {activityCategory === "work" && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <h3 className="text-sm font-medium">Work Activity Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectName" className="text-sm font-medium">Project/Task Name</Label>
                <Input
                  id="projectName"
                  placeholder="What project or task were you working on?"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="h-11 text-sm"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="focusLevel" className="text-sm font-medium">Focus Level</Label>
                <Select
                  options={focusLevels.map(level => ({
                    value: level.value,
                    label: `${level.label} - ${level.description}`
                  }))}
                  value={focusLevels.map(level => ({
                    value: level.value,
                    label: `${level.label} - ${level.description}`
                  })).find(option => option.value === focusLevel) || null}
                  onChange={(option) => setFocusLevel(option?.value || "")}
                  placeholder="How focused were you?"
                  isDisabled={isLoading}
                  styles={selectStyles}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="collaborators" className="text-sm font-medium">Collaborators (optional)</Label>
                <Input
                  id="collaborators"
                  placeholder="Who did you work with?"
                  value={collaborators}
                  onChange={(e) => setCollaborators(e.target.value)}
                  className="h-11 text-sm"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workTools" className="text-sm font-medium">Tools/Technologies Used</Label>
                <Input
                  id="workTools"
                  placeholder="e.g., VS Code, Figma, Slack, etc."
                  value={workTools}
                  onChange={(e) => setWorkTools(e.target.value)}
                  className="h-11 text-sm"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tasksCompleted" className="text-sm font-medium">Tasks Completed (optional)</Label>
              <Textarea
                id="tasksCompleted"
                placeholder="What specific tasks or milestones did you complete?"
                value={tasksCompleted}
                onChange={(e) => setTasksCompleted(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {activityCategory === "study" && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <h3 className="text-sm font-medium">Study Activity Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm font-medium">Subject/Topic</Label>
                <Input
                  id="subject"
                  placeholder="What subject or topic did you study?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-11 text-sm"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="comprehensionLevel" className="text-sm font-medium">Comprehension Level</Label>
                <Select
                  options={comprehensionLevels.map(level => ({
                    value: level.value,
                    label: `${level.label} - ${level.description}`
                  }))}
                  value={comprehensionLevels.map(level => ({
                    value: level.value,
                    label: `${level.label} - ${level.description}`
                  })).find(option => option.value === comprehensionLevel) || null}
                  onChange={(option) => setComprehensionLevel(option?.value || "")}
                  placeholder="How well did you understand?"
                  isDisabled={isLoading}
                  styles={selectStyles}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="studyMaterial" className="text-sm font-medium">Study Material (optional)</Label>
                <Input
                  id="studyMaterial"
                  placeholder="Book, course, video, etc."
                  value={studyMaterial}
                  onChange={(e) => setStudyMaterial(e.target.value)}
                  className="h-11 text-sm"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notesCreated" className="text-sm font-medium">Notes Created (optional)</Label>
                <Input
                  id="notesCreated"
                  placeholder="Did you take notes or create summaries?"
                  value={notesCreated}
                  onChange={(e) => setNotesCreated(e.target.value)}
                  className="h-11 text-sm"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        )}

        {activityCategory === "routine" && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <h3 className="text-sm font-medium">Routine Activity Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="consistency" className="text-sm font-medium">Consistency Level</Label>
                <Select
                  options={consistencyLevels.map(level => ({
                    value: level.value,
                    label: `${level.label} - ${level.description}`
                  }))}
                  value={consistencyLevels.map(level => ({
                    value: level.value,
                    label: `${level.label} - ${level.description}`
                  })).find(option => option.value === consistency) || null}
                  onChange={(option) => setConsistency(option?.value || "")}
                  placeholder="How well did you follow the routine?"
                  isDisabled={isLoading}
                  styles={selectStyles}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="moodBefore" className="text-sm font-medium">Mood Before</Label>
                <Select
                  options={moodOptions.map(mood => ({
                    value: mood.value,
                    label: `${mood.icon} ${mood.label}`
                  }))}
                  value={moodOptions.map(mood => ({
                    value: mood.value,
                    label: `${mood.icon} ${mood.label}`
                  })).find(option => option.value === moodBefore) || null}
                  onChange={(option) => setMoodBefore(option?.value || "")}
                  placeholder="How did you feel before?"
                  isDisabled={isLoading}
                  styles={selectStyles}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="moodAfter" className="text-sm font-medium">Mood After</Label>
                <Select
                  options={moodOptions.map(mood => ({
                    value: mood.value,
                    label: `${mood.icon} ${mood.label}`
                  }))}
                  value={moodOptions.map(mood => ({
                    value: mood.value,
                    label: `${mood.icon} ${mood.label}`
                  })).find(option => option.value === moodAfter) || null}
                  onChange={(option) => setMoodAfter(option?.value || "")}
                  placeholder="How did you feel after?"
                  isDisabled={isLoading}
                  styles={selectStyles}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="routineSteps" className="text-sm font-medium">Routine Steps (optional)</Label>
              <Textarea
                id="routineSteps"
                placeholder="Describe the steps in your routine..."
                value={routineSteps}
                onChange={(e) => setRoutineSteps(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* Feeling and Productivity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="feeling" className="text-sm font-medium">How You Feel</Label>
            <Select
              options={feelingOptions.map(feeling => ({
                value: feeling.value,
                label: `${feeling.icon} ${feeling.label}`
              }))}
              value={feelingOptions.map(feeling => ({
                value: feeling.value,
                label: `${feeling.icon} ${feeling.label}`
              })).find(option => option.value === howYouFeel) || null}
              onChange={(option) => setHowYouFeel(option?.value || "")}
              placeholder="How do you feel?"
              isDisabled={isLoading}
              styles={selectStyles}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productivity" className="text-sm font-medium">Productivity Level</Label>
            <Select
              options={productivityLevels.map(level => ({
                value: level.value,
                label: `${level.label} - ${level.description}`
              }))}
              value={productivityLevels.map(level => ({
                value: level.value,
                label: `${level.label} - ${level.description}`
              })).find(option => option.value === productivity) || null}
              onChange={(option) => setProductivity(option?.value || "")}
              placeholder="How productive were you?"
              isDisabled={isLoading}
              styles={selectStyles}
            />
          </div>
        </div>

        {/* Goals Section */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
          <h3 className="text-sm font-medium">Goals & Achievement</h3>
          
          <div className="space-y-2">
            <Label htmlFor="goalSet" className="text-sm font-medium">Goal Set (optional)</Label>
            <Input
              id="goalSet"
              placeholder="What goal did you set for this activity?"
              value={goalSet}
              onChange={(e) => setGoalSet(e.target.value)}
              className="h-11 text-sm"
              disabled={isLoading}
            />
          </div>

          {goalSet && (
            <div className="space-y-2">
              <Label htmlFor="goalAchieved" className="text-sm font-medium">Goal Achievement</Label>
              <Select
                options={goalAchievements.map(achievement => ({
                  value: achievement.value,
                  label: achievement.label
                }))}
                value={goalAchievements.map(achievement => ({
                  value: achievement.value,
                  label: achievement.label
                })).find(option => option.value === goalAchieved) || null}
                onChange={(option) => setGoalAchieved(option?.value || "")}
                placeholder="Did you achieve your goal?"
                isDisabled={isLoading}
                styles={selectStyles}
              />
            </div>
          )}
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