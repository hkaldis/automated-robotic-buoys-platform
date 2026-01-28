import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, RefreshCw, ExternalLink, FileText, MapPin, Calendar, 
  Mail, Phone, Users, Globe, Clock, Trophy, Sailboat, ClipboardList,
  ChevronDown, ChevronRight, Building, Link as LinkIcon
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Manage2SailEntry {
  sailNumber: string;
  boatName?: string;
  boatType?: string;
  skipperName?: string;
  crew?: string;
  clubName?: string;
  country?: string;
  handicap?: number;
}

interface Manage2SailClass {
  id: string;
  name: string;
  entriesCount: number;
  entries: Manage2SailEntry[];
}

interface Manage2SailRaceResult {
  sailNumber: string;
  boatName?: string;
  position: number;
  points?: number;
  finishTime?: string;
}

interface Manage2SailRace {
  raceName: string;
  raceNumber?: number;
  date?: string;
  results: Manage2SailRaceResult[];
}

interface Manage2SailResults {
  className: string;
  classId: string;
  races: Manage2SailRace[];
  overallStandings?: Manage2SailRaceResult[];
  viewResultsUrl?: string;
}

interface Manage2SailDocument {
  title: string;
  url: string;
  date?: string;
  type?: string;
}

interface Manage2SailInfo {
  eventId?: string;
  eventName?: string;
  dates?: string;
  registrationPeriod?: string;
  club?: string;
  location?: string;
  address?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  website?: string;
  description?: string;
  classes: Manage2SailClass[];
  results: Manage2SailResults[];
  documents: Manage2SailDocument[];
  fetchedAt?: string;
}

interface DocumentInfo {
  title: string;
  url: string;
  date?: string;
}

interface RacingRulesInfo {
  eventName?: string;
  documents?: DocumentInfo[];
  resultsUrl?: string;
  eventSiteUrl?: string;
  fetchedAt?: string;
}

interface ExternalInfo {
  manage2Sail?: Manage2SailInfo;
  racingRules?: RacingRulesInfo;
}

interface ExternalInfoResponse {
  manage2SailUrl: string | null;
  racingRulesUrl: string | null;
  externalInfo: ExternalInfo | null;
}

interface EventExternalInfoProps {
  eventId: string;
  eventName: string;
  onClose?: () => void;
}

function ClassEntriesSection({ classes }: { classes: Manage2SailClass[] }) {
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  const toggleClass = (classId: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  const totalEntries = classes.reduce((sum, c) => sum + (c.entries?.length || c.entriesCount), 0);

  if (classes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Sailboat className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No class entries available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {classes.length} class{classes.length !== 1 ? 'es' : ''}, {totalEntries} total entries
        </span>
      </div>
      
      {classes.map((classInfo) => (
        <div key={classInfo.id} className="border rounded-md overflow-hidden">
          <button
            onClick={() => toggleClass(classInfo.id)}
            className="w-full flex items-center justify-between p-3 hover-elevate text-left"
            data-testid={`button-toggle-class-${classInfo.id}`}
          >
            <div className="flex items-center gap-3">
              {expandedClasses.has(classInfo.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Sailboat className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{classInfo.name}</span>
            </div>
            <Badge variant="secondary">
              {classInfo.entries?.length || classInfo.entriesCount} entries
            </Badge>
          </button>
          
          {expandedClasses.has(classInfo.id) && classInfo.entries && classInfo.entries.length > 0 && (
            <div className="border-t">
              <ScrollArea className="max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Sail #</th>
                      <th className="text-left p-2 font-medium">Boat</th>
                      <th className="text-left p-2 font-medium">Skipper</th>
                      <th className="text-left p-2 font-medium">Club</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classInfo.entries.map((entry, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2 font-mono">{entry.sailNumber}</td>
                        <td className="p-2">
                          <div>{entry.boatName || '-'}</div>
                          {entry.boatType && (
                            <div className="text-xs text-muted-foreground">{entry.boatType}</div>
                          )}
                        </td>
                        <td className="p-2">
                          <div>{entry.skipperName || '-'}</div>
                          {entry.crew && (
                            <div className="text-xs text-muted-foreground">{entry.crew}</div>
                          )}
                        </td>
                        <td className="p-2">
                          <div>{entry.clubName || '-'}</div>
                          {entry.country && (
                            <div className="text-xs text-muted-foreground">{entry.country}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ResultsSection({ results }: { results: Manage2SailResults[] }) {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleResult = (classId: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No race results available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((classResult) => (
        <div key={classResult.classId} className="border rounded-md overflow-hidden">
          <button
            onClick={() => toggleResult(classResult.classId)}
            className="w-full flex items-center justify-between p-3 hover-elevate text-left"
            data-testid={`button-toggle-results-${classResult.classId}`}
          >
            <div className="flex items-center gap-3">
              {expandedResults.has(classResult.classId) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{classResult.className}</span>
            </div>
            <Badge variant="secondary">
              {classResult.viewResultsUrl ? (
                <span className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  View
                </span>
              ) : (
                `${classResult.races.length} race${classResult.races.length !== 1 ? 's' : ''}`
              )}
            </Badge>
          </button>
          
          {expandedResults.has(classResult.classId) && (
            <div className="border-t p-3">
              {classResult.viewResultsUrl && (
                <div className="mb-4 p-4 bg-muted/30 rounded-md">
                  <p className="text-sm text-muted-foreground mb-3">
                    Race results are available on Manage2Sail
                  </p>
                  <a
                    href={classResult.viewResultsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                    data-testid={`link-view-results-${classResult.classId}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Results on Manage2Sail
                  </a>
                </div>
              )}
              
              {classResult.overallStandings && classResult.overallStandings.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Trophy className="h-4 w-4" /> Overall Standings
                  </h4>
                  <ScrollArea className="max-h-48">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Pos</th>
                          <th className="text-left p-2 font-medium">Sail #</th>
                          <th className="text-left p-2 font-medium">Boat</th>
                          <th className="text-right p-2 font-medium">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classResult.overallStandings.map((standing, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 font-medium">{standing.position}</td>
                            <td className="p-2 font-mono">{standing.sailNumber}</td>
                            <td className="p-2">{standing.boatName || '-'}</td>
                            <td className="p-2 text-right">{standing.points ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              )}
              
              {classResult.races.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Individual Races</h4>
                  <div className="space-y-2">
                    {classResult.races.map((race, raceIdx) => (
                      <div key={raceIdx} className="bg-muted/30 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{race.raceName}</span>
                          {race.date && (
                            <span className="text-xs text-muted-foreground">{race.date}</span>
                          )}
                        </div>
                        {race.results.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Top 3: {race.results.slice(0, 3).map((r, i) => (
                              <span key={i}>
                                {i > 0 && ', '}
                                {r.position}. {r.sailNumber}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DocumentsSection({ 
  manage2SailDocs, 
  racingRulesDocs 
}: { 
  manage2SailDocs: Manage2SailDocument[];
  racingRulesDocs: DocumentInfo[];
}) {
  const allDocs = [
    ...manage2SailDocs.map(d => ({ ...d, source: 'Manage2Sail' as const })),
    ...racingRulesDocs.map(d => ({ ...d, source: 'Racing Rules' as const })),
  ];

  if (allDocs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No documents available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground mb-4">
        {allDocs.length} document{allDocs.length !== 1 ? 's' : ''} available
      </div>
      
      <ScrollArea className="max-h-[400px]">
        <div className="space-y-2">
          {allDocs.map((doc, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-md border hover-elevate"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {doc.source}
                    </Badge>
                    {doc.date && <span>{doc.date}</span>}
                    {'type' in doc && doc.type && <span>{doc.type}</span>}
                  </div>
                </div>
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 ml-2"
                data-testid={`link-document-${index}`}
              >
                <Button variant="ghost" size="icon">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function EventExternalInfo({ eventId, eventName, onClose }: EventExternalInfoProps) {
  const { toast } = useToast();
  const [isFetching, setIsFetching] = useState(false);

  const { data, isLoading } = useQuery<ExternalInfoResponse>({
    queryKey: ["/api/events", eventId, "external-info"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/external-info`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch external info");
      return res.json();
    },
  });

  const fetchExternalInfoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/fetch-external-info`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "external-info"] });
      toast({
        title: "External info updated",
        description: "Successfully fetched latest information from external sources",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fetch failed",
        description: error.message || "Could not fetch external info",
        variant: "destructive",
      });
    },
  });

  const handleRefresh = async () => {
    setIsFetching(true);
    try {
      await fetchExternalInfoMutation.mutateAsync();
    } finally {
      setIsFetching(false);
    }
  };

  const manage2Sail = data?.externalInfo?.manage2Sail;
  const racingRules = data?.externalInfo?.racingRules;
  const hasUrls = data?.manage2SailUrl || data?.racingRulesUrl;
  const hasExternalInfo = manage2Sail || racingRules;

  const formatFetchedAt = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const totalClasses = manage2Sail?.classes?.length || 0;
  const totalEntries = manage2Sail?.classes?.reduce((sum, c) => sum + (c.entries?.length || c.entriesCount), 0) || 0;
  const totalResults = manage2Sail?.results?.length || 0;
  const totalDocs = (manage2Sail?.documents?.length || 0) + (racingRules?.documents?.length || 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h2 className="text-xl font-semibold">{eventName}</h2>
          <p className="text-sm text-muted-foreground">External Event Information</p>
        </div>
        <div className="flex items-center gap-2">
          {hasUrls && (
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isFetching}
              data-testid="button-refresh-external-info"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh Data
            </Button>
          )}
        </div>
      </div>

      {!hasUrls && (
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="py-12 text-center">
              <Globe className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-2">
                No external URLs configured
              </p>
              <p className="text-sm text-muted-foreground">
                Edit the event to add Manage2Sail or Racing Rules URLs.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {hasUrls && !hasExternalInfo && (
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-4">
                External URLs are configured but no data has been fetched yet.
              </p>
              <Button
                onClick={handleRefresh}
                disabled={isFetching}
                size="lg"
                data-testid="button-initial-fetch"
              >
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Fetch External Info
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {hasExternalInfo && (
        <div className="flex-1 overflow-hidden pt-4">
          <Tabs defaultValue="details" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 h-12">
              <TabsTrigger value="details" className="text-sm" data-testid="tab-details">
                <Building className="h-4 w-4 mr-2" />
                Details
              </TabsTrigger>
              <TabsTrigger value="entries" className="text-sm" data-testid="tab-entries">
                <Sailboat className="h-4 w-4 mr-2" />
                Entries
                {totalEntries > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {totalEntries}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="results" className="text-sm" data-testid="tab-results">
                <Trophy className="h-4 w-4 mr-2" />
                Results
                {totalResults > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {totalResults}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-sm" data-testid="tab-documents">
                <ClipboardList className="h-4 w-4 mr-2" />
                Docs
                {totalDocs > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {totalDocs}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex-1 overflow-auto mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {manage2Sail && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Manage2Sail
                        </CardTitle>
                        {manage2Sail.fetchedAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatFetchedAt(manage2Sail.fetchedAt)}
                          </span>
                        )}
                      </div>
                      {data?.manage2SailUrl && (
                        <CardDescription>
                          <a
                            href={data.manage2SailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                            data-testid="link-manage2sail"
                          >
                            View on Manage2Sail <ExternalLink className="h-3 w-3" />
                          </a>
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {manage2Sail.eventName && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Event</span>
                          <p className="font-medium text-lg">{manage2Sail.eventName}</p>
                        </div>
                      )}
                      
                      {manage2Sail.description && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Description</span>
                          <p className="text-sm">{manage2Sail.description}</p>
                        </div>
                      )}
                      
                      {manage2Sail.dates && (
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <span className="text-xs text-muted-foreground uppercase">Dates</span>
                            <p>{manage2Sail.dates}</p>
                          </div>
                        </div>
                      )}
                      
                      {manage2Sail.registrationPeriod && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Registration</span>
                          <p className="text-sm">{manage2Sail.registrationPeriod}</p>
                        </div>
                      )}
                      
                      {manage2Sail.club && (
                        <div className="flex items-start gap-2">
                          <Building className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <span className="text-xs text-muted-foreground uppercase">Club</span>
                            <p>{manage2Sail.club}</p>
                          </div>
                        </div>
                      )}
                      
                      {(manage2Sail.location || manage2Sail.city || manage2Sail.country) && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <span className="text-xs text-muted-foreground uppercase">Location</span>
                            <p>
                              {[manage2Sail.location, manage2Sail.address, manage2Sail.city, manage2Sail.country]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {manage2Sail.website && (
                        <div className="flex items-start gap-2">
                          <LinkIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <span className="text-xs text-muted-foreground uppercase">Website</span>
                            <p>
                              <a 
                                href={manage2Sail.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {manage2Sail.website}
                              </a>
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-4 pt-2">
                        {manage2Sail.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <a
                              href={`mailto:${manage2Sail.email}`}
                              className="text-primary hover:underline text-sm"
                              data-testid="link-email"
                            >
                              {manage2Sail.email}
                            </a>
                          </div>
                        )}
                        {manage2Sail.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{manage2Sail.phone}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Badge variant="outline">
                          <Sailboat className="h-3 w-3 mr-1" />
                          {totalClasses} classes
                        </Badge>
                        <Badge variant="outline">
                          <Users className="h-3 w-3 mr-1" />
                          {totalEntries} entries
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {racingRules && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Racing Rules of Sailing
                        </CardTitle>
                        {racingRules.fetchedAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatFetchedAt(racingRules.fetchedAt)}
                          </span>
                        )}
                      </div>
                      {data?.racingRulesUrl && (
                        <CardDescription>
                          <a
                            href={data.racingRulesUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                            data-testid="link-racingrules"
                          >
                            View on Racing Rules <ExternalLink className="h-3 w-3" />
                          </a>
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {racingRules.eventName && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Event</span>
                          <p className="font-medium">{racingRules.eventName}</p>
                        </div>
                      )}
                      
                      {racingRules.documents && racingRules.documents.length > 0 && (
                        <div className="border-t pt-3">
                          <Badge variant="outline">
                            <FileText className="h-3 w-3 mr-1" />
                            {racingRules.documents.length} documents
                          </Badge>
                        </div>
                      )}

                      {(racingRules.resultsUrl || racingRules.eventSiteUrl) && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {racingRules.resultsUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a
                                href={racingRules.resultsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid="link-results"
                              >
                                View Results <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          )}
                          {racingRules.eventSiteUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a
                                href={racingRules.eventSiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid="link-event-site"
                              >
                                Event Website <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="entries" className="flex-1 overflow-auto mt-4">
              <ClassEntriesSection classes={manage2Sail?.classes || []} />
            </TabsContent>

            <TabsContent value="results" className="flex-1 overflow-auto mt-4">
              <ResultsSection results={manage2Sail?.results || []} />
            </TabsContent>

            <TabsContent value="documents" className="flex-1 overflow-auto mt-4">
              <DocumentsSection 
                manage2SailDocs={manage2Sail?.documents || []} 
                racingRulesDocs={racingRules?.documents || []} 
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {onClose && (
        <div className="flex justify-end pt-4 border-t mt-4">
          <Button variant="outline" onClick={onClose} data-testid="button-close-external-info">
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
