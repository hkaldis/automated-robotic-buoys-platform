import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ExternalLink, FileText, MapPin, Calendar, Mail, Phone, Users, Globe, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Manage2SailInfo {
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

export function EventExternalInfo({ eventId, eventName, onClose }: EventExternalInfoProps) {
  const { toast } = useToast();
  const [isFetching, setIsFetching] = useState(false);

  const { data, isLoading, refetch } = useQuery<ExternalInfoResponse>({
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{eventName}</h2>
          <p className="text-sm text-muted-foreground">External Event Information</p>
        </div>
        {hasUrls && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid="button-refresh-external-info"
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        )}
      </div>

      {!hasUrls && (
        <Card>
          <CardContent className="py-8 text-center">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No external URLs configured for this event.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Edit the event to add Manage2Sail or Racing Rules URLs.
            </p>
          </CardContent>
        </Card>
      )}

      {hasUrls && !hasExternalInfo && (
        <Card>
          <CardContent className="py-8 text-center">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              External URLs are configured but no data has been fetched yet.
            </p>
            <Button
              onClick={handleRefresh}
              disabled={isFetching}
              className="mt-4"
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
      )}

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
          <CardContent className="space-y-3">
            {manage2Sail.eventName && (
              <div>
                <span className="text-xs text-muted-foreground uppercase">Event</span>
                <p className="font-medium">{manage2Sail.eventName}</p>
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
              <div>
                <span className="text-xs text-muted-foreground uppercase">Club</span>
                <p>{manage2Sail.club}</p>
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
            {(manage2Sail.email || manage2Sail.phone) && (
              <div className="flex flex-wrap gap-4">
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
            )}
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
              <div>
                <span className="text-xs text-muted-foreground uppercase mb-2 block">
                  Documents ({racingRules.documents.length})
                </span>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {racingRules.documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{doc.title}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {doc.date && (
                          <Badge variant="secondary" className="text-xs">
                            {doc.date}
                          </Badge>
                        )}
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          data-testid={`link-document-${index}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
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

      {onClose && (
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose} data-testid="button-close-external-info">
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
