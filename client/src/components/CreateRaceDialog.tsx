import { useState } from "react";
import { Plus, Flag, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import type { CourseShape, EventType } from "@shared/schema";
import { useBoatClasses } from "@/hooks/use-api";

interface CreateRaceDialogProps {
  onCreateRace: (data: {
    name: string;
    type: EventType;
    boatClass: string;
    boatClassId: string | null;
    targetDuration: number;
    courseShape: CourseShape;
    courseName: string;
  }) => void;
  trigger?: React.ReactNode;
}

const COURSE_SHAPES: { value: CourseShape; label: string; description: string }[] = [
  { value: "triangle", label: "Triangle", description: "Classic 3-point triangular course" },
  { value: "trapezoid", label: "Trapezoid", description: "4-point trapezoidal course" },
  { value: "windward_leeward", label: "Windward-Leeward", description: "Up-down course with gates" },
  { value: "custom", label: "Custom", description: "Build your own course layout" },
];

export function CreateRaceDialog({ onCreateRace, trigger }: CreateRaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  
  const { data: boatClassesData, isLoading: boatClassesLoading } = useBoatClasses();
  const boatClasses = boatClassesData || [];
  
  const [name, setName] = useState("");
  const [type, setType] = useState<EventType>("race");
  const [selectedBoatClassId, setSelectedBoatClassId] = useState<string>("");
  const [customBoatClass, setCustomBoatClass] = useState("");
  const [targetDuration, setTargetDuration] = useState(40);
  
  const [courseShape, setCourseShape] = useState<CourseShape>("triangle");
  const [courseName, setCourseName] = useState("");
  
  const selectedBoatClass = boatClasses.find(bc => bc.id === selectedBoatClassId);

  const resetForm = () => {
    setStep(1);
    setName("");
    setType("race");
    setSelectedBoatClassId("");
    setCustomBoatClass("");
    setTargetDuration(40);
    setCourseShape("triangle");
    setCourseName("");
  };

  const handleNext = () => {
    if (step === 1) {
      setCourseName(`${name} Course`);
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const handleCreate = () => {
    const finalBoatClass = selectedBoatClassId === "other" 
      ? customBoatClass 
      : (selectedBoatClass?.name || "Unknown");
    
    onCreateRace({
      name,
      type,
      boatClass: finalBoatClass,
      boatClassId: selectedBoatClassId === "other" ? null : selectedBoatClassId || null,
      targetDuration,
      courseShape,
      courseName,
    });
    
    setOpen(false);
    resetForm();
  };

  const isStep1Valid = name.trim() && (selectedBoatClassId === "other" ? customBoatClass.trim() : selectedBoatClassId);
  const isStep2Valid = courseName.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2" data-testid="button-create-race">
            <Plus className="w-4 h-4" />
            New Race
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-primary" />
            {step === 1 ? "Create New Race" : "Course Setup"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? "Enter the basic details for your race event."
              : "Configure the course layout for this race."
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="race-name">Race Name</Label>
              <Input
                id="race-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Spring Regatta 2024"
                data-testid="input-race-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Event Type</Label>
              <RadioGroup value={type} onValueChange={(v) => setType(v as EventType)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="race" id="type-race" data-testid="radio-type-race" />
                  <Label htmlFor="type-race" className="cursor-pointer">Race</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="training" id="type-training" data-testid="radio-type-training" />
                  <Label htmlFor="type-training" className="cursor-pointer">Training</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="boat-class">Boat Class</Label>
              <Select value={selectedBoatClassId} onValueChange={setSelectedBoatClassId}>
                <SelectTrigger id="boat-class" data-testid="select-boat-class">
                  <SelectValue placeholder={boatClassesLoading ? "Loading..." : "Select boat class"} />
                </SelectTrigger>
                <SelectContent className="z-[10000] max-h-60">
                  {boatClassesLoading ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {boatClasses.map((bc) => (
                        <SelectItem key={bc.id} value={bc.id}>{bc.name}</SelectItem>
                      ))}
                      <SelectItem value="other">Other (custom)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {selectedBoatClassId === "other" && (
                <Input
                  value={customBoatClass}
                  onChange={(e) => setCustomBoatClass(e.target.value)}
                  placeholder="Enter boat class name"
                  className="mt-2"
                  data-testid="input-custom-boat-class"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-duration">Target Duration (minutes)</Label>
              <Input
                id="target-duration"
                type="number"
                value={targetDuration}
                onChange={(e) => setTargetDuration(parseInt(e.target.value) || 40)}
                min={15}
                max={120}
                data-testid="input-target-duration"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="course-name">Course Name</Label>
              <Input
                id="course-name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g., Triangle Course"
                data-testid="input-course-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Course Shape</Label>
              <div className="grid grid-cols-2 gap-3">
                {COURSE_SHAPES.map((shape) => (
                  <Card 
                    key={shape.value}
                    className={`cursor-pointer transition-colors hover-elevate ${
                      courseShape === shape.value ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setCourseShape(shape.value)}
                    data-testid={`card-shape-${shape.value}`}
                  >
                    <CardContent className="p-3">
                      <div className="font-medium text-sm">{shape.label}</div>
                      <div className="text-xs text-muted-foreground">{shape.description}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          {step === 2 && (
            <Button variant="outline" onClick={handleBack} className="gap-1">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {step === 1 ? (
              <Button 
                onClick={handleNext} 
                disabled={!isStep1Valid}
                className="gap-1"
                data-testid="button-next-step"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleCreate}
                disabled={!isStep2Valid}
                data-testid="button-create-race-confirm"
              >
                Create Race
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
