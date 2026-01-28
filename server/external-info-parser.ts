import type { Event } from "@shared/schema";

const ALLOWED_DOMAINS = [
  'manage2sail.com',
  'www.manage2sail.com',
  'racingrulesofsailing.org',
  'www.racingrulesofsailing.org',
];

const FETCH_TIMEOUT_MS = 15000;

function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

function extractEventIdFromUrl(url: string): string | null {
  const match = url.match(/\/event\/([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/html, */*',
        ...options.headers,
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

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
  hasEntries?: boolean;
  hasResults?: boolean;
  hasDocuments?: boolean;
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

interface RacingRulesInfo {
  eventName?: string;
  documents?: Array<{
    title: string;
    url: string;
    date?: string;
  }>;
  resultsUrl?: string;
  eventSiteUrl?: string;
  fetchedAt?: string;
}

export interface ExternalInfo {
  manage2Sail?: Manage2SailInfo;
  racingRules?: RacingRulesInfo;
}

async function fetchManage2SailEventDetails(eventId: string): Promise<Partial<Manage2SailInfo>> {
  const info: Partial<Manage2SailInfo> = { eventId };
  
  try {
    const baseUrl = `https://www.manage2sail.com/en-US/event/${eventId}`;
    const response = await fetchWithTimeout(baseUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch Manage2Sail event page: ${response.status}`);
      return info;
    }
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      info.eventName = titleMatch[1].replace(/\s*-\s*Manage2Sail.*$/i, '').trim();
    }
    
    const eventDateMatch = html.match(/Event\s*:\s*<\/td>\s*<td[^>]*>([^<]+)/i);
    if (eventDateMatch) {
      info.dates = eventDateMatch[1].trim();
    }
    
    const regMatch = html.match(/Registration\s*:\s*<\/td>\s*<td[^>]*>([^<]+)/i);
    if (regMatch) {
      info.registrationPeriod = regMatch[1].trim();
    }
    
    const clubMatch = html.match(/Club\s*:\s*<\/td>\s*<td[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    if (clubMatch) {
      info.club = clubMatch[1].trim();
    }
    
    const locationMatch = html.match(/Location\s*:\s*<\/td>\s*<td[^>]*>([^<]+)/i);
    if (locationMatch) {
      info.location = locationMatch[1].trim();
    }
    
    const addressMatch = html.match(/Address\s*:\s*<\/td>\s*<td[^>]*>([^<]+)/i);
    if (addressMatch) {
      info.address = addressMatch[1].trim();
    }
    
    const cityMatch = html.match(/City\s*:\s*<\/td>\s*<td[^>]*>([^<]+)/i);
    if (cityMatch) {
      info.city = cityMatch[1].trim();
    }
    
    const countryMatch = html.match(/Country\s*:\s*<\/td>\s*<td[^>]*>([^<]+)/i);
    if (countryMatch) {
      info.country = countryMatch[1].trim();
    }
    
    const emailMatch = html.match(/Email\s*:\s*<\/td>\s*<td[^>]*>[\s\S]*?mailto:([^"]+)/i);
    if (emailMatch) {
      info.email = emailMatch[1].trim();
    }
    
    const phoneMatch = html.match(/Phone\s*:\s*<\/td>\s*<td[^>]*>([^<]+)/i);
    if (phoneMatch) {
      info.phone = phoneMatch[1].trim();
    }
    
    const websiteMatch = html.match(/Website\s*:\s*<\/td>\s*<td[^>]*>[\s\S]*?href="([^"]+)"/i);
    if (websiteMatch) {
      info.website = websiteMatch[1].trim();
    }
    
    const descMatch = html.match(/Description\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (descMatch) {
      info.description = descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    
  } catch (error) {
    console.error("Error fetching Manage2Sail event details:", error);
  }
  
  return info;
}

async function fetchManage2SailClasses(eventId: string): Promise<Manage2SailClass[]> {
  const classes: Manage2SailClass[] = [];
  
  try {
    const apiUrl = `https://www.manage2sail.com/api/event/${eventId}/regattas`;
    
    if (!isValidExternalUrl(apiUrl)) {
      console.error("Internal URL validation failed:", apiUrl);
      return [];
    }
    
    const response = await fetchWithTimeout(apiUrl);
    
    if (!response.ok) {
      console.log(`No regattas API available for event ${eventId}, trying HTML fallback`);
      return await fetchManage2SailClassesFromHtml(eventId);
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      for (const regatta of data) {
        const classInfo: Manage2SailClass = {
          id: regatta.Id || regatta.id || '',
          name: regatta.Name || regatta.name || 'Unknown Class',
          entriesCount: regatta.EntryCount || regatta.entryCount || 0,
          entries: [],
        };
        
        if (classInfo.id) {
          const entries = await fetchManage2SailEntries(eventId, classInfo.id);
          classInfo.entries = entries;
          classInfo.entriesCount = entries.length || classInfo.entriesCount;
        }
        
        classes.push(classInfo);
      }
    }
  } catch (error) {
    console.error("Error fetching Manage2Sail classes:", error);
    return await fetchManage2SailClassesFromHtml(eventId);
  }
  
  return classes;
}

async function fetchManage2SailClassesFromHtml(eventId: string): Promise<Manage2SailClass[]> {
  const classes: Manage2SailClass[] = [];
  
  try {
    const url = `https://www.manage2sail.com/en-US/event/${eventId}`;
    
    if (!isValidExternalUrl(url)) {
      console.error("Invalid URL for HTML fetch:", url);
      return [];
    }
    
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) return classes;
    
    const html = await response.text();
    
    // Look for embedded JSON objects with class/regatta data
    // Format: {"Id":"uuid","Name":"ClassName","HasEntries":true,"HasResults":true,...}
    const jsonRegex = /\{"Id":"([a-f0-9-]{36})","Name":"([^"]+)"[^}]*"HasEntries":(true|false)[^}]*"HasResults":(true|false)[^}]*"HasDocuments":(true|false)[^}]*\}/gi;
    let match;
    const foundClasses: Manage2SailClass[] = [];
    
    while ((match = jsonRegex.exec(html)) !== null) {
      try {
        const fullMatch = match[0];
        const classData = JSON.parse(fullMatch);
        
        foundClasses.push({
          id: classData.Id || '',
          name: classData.Name || 'Unknown Class',
          entriesCount: 0,
          hasEntries: classData.HasEntries === true,
          hasResults: classData.HasResults === true,
          hasDocuments: classData.HasDocuments === true,
          entries: [],
        });
      } catch (e) {
        // If JSON parsing fails, extract from regex groups
        foundClasses.push({
          id: match[1],
          name: match[2] || 'Unknown Class',
          entriesCount: 0,
          hasEntries: match[3] === 'true',
          hasResults: match[4] === 'true',
          hasDocuments: match[5] === 'true',
          entries: [],
        });
      }
    }
    
    // Fallback: extract class IDs from links if no embedded JSON found
    if (foundClasses.length === 0) {
      const classIdRegex = /classId=([a-f0-9-]{36})/gi;
      const classIds = new Set<string>();
      
      while ((match = classIdRegex.exec(html)) !== null) {
        classIds.add(match[1]);
      }
      
      for (const classId of Array.from(classIds)) {
        foundClasses.push({
          id: classId,
          name: 'Class',
          entriesCount: 0,
          hasEntries: true,
          hasResults: false,
          hasDocuments: false,
          entries: [],
        });
      }
    }
    
    // Now fetch entries for each class using the working API
    for (const classInfo of foundClasses) {
      if (classInfo.id) {
        const entries = await fetchManage2SailEntries(eventId, classInfo.id);
        classInfo.entries = entries;
        classInfo.entriesCount = entries.length;
        // Use name from entry data if class name is generic
        if (classInfo.name === 'Class' && entries.length > 0) {
          // Try to get class name from the entries response
        }
      }
      classes.push(classInfo);
    }
  } catch (error) {
    console.error("Error fetching classes from HTML:", error);
  }
  
  return classes;
}

async function fetchManage2SailEntries(eventId: string, classId: string): Promise<Manage2SailEntry[]> {
  const entries: Manage2SailEntry[] = [];
  
  try {
    const apiUrl = `https://www.manage2sail.com/api/event/${eventId}/regattaentry?regattaId=${classId}`;
    
    if (!isValidExternalUrl(apiUrl)) {
      console.error("Internal URL validation failed:", apiUrl);
      return [];
    }
    
    const response = await fetchWithTimeout(apiUrl);
    
    if (!response.ok) {
      console.log(`Failed to fetch entries for class ${classId}`);
      return entries;
    }
    
    const data = await response.json();
    
    if (data && data.Entries && Array.isArray(data.Entries)) {
      for (const entry of data.Entries) {
        entries.push({
          sailNumber: entry.SailNumber || entry.sailNumber || '',
          boatName: entry.BoatName || entry.boatName,
          boatType: entry.BoatType || entry.boatType,
          skipperName: entry.SkipperName || entry.skipperName,
          crew: entry.Crew || entry.crew,
          clubName: entry.ClubName || entry.clubName,
          country: entry.Country || entry.country,
          handicap: entry.Hcp || entry.hcp,
        });
      }
    }
  } catch (error) {
    console.error(`Error fetching entries for class ${classId}:`, error);
  }
  
  return entries;
}

async function fetchManage2SailResults(eventId: string, classes: Manage2SailClass[]): Promise<Manage2SailResults[]> {
  const allResults: Manage2SailResults[] = [];
  
  for (const classInfo of classes) {
    if (!classInfo.id) continue;
    
    // Always try API first - it works and returns 200
    try {
      const apiUrl = `https://www.manage2sail.com/api/event/${eventId}/regattaresult/${classInfo.id}`;
      
      if (!isValidExternalUrl(apiUrl)) {
        console.error("Internal URL validation failed:", apiUrl);
        continue;
      }
      
      const response = await fetchWithTimeout(apiUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        const classResults: Manage2SailResults = {
          className: data.RegattaName || classInfo.name,
          classId: classInfo.id,
          races: [],
          overallStandings: [],
        };
        
        // Parse EntryResults - the main results format from Manage2Sail
        // Contains overall standings with per-race breakdown
        if (data && data.EntryResults && Array.isArray(data.EntryResults)) {
          for (const entry of data.EntryResults) {
            classResults.overallStandings?.push({
              sailNumber: entry.SailNumber || '',
              boatName: entry.TeamName || entry.Name,
              position: entry.Rank || 0,
              points: parseFloat(entry.NetPoints) || parseFloat(entry.TotalPoints) || 0,
            });
          }
          
          // Build race results from EntryResults data
          if (data.RaceNames && Array.isArray(data.RaceNames)) {
            for (const raceInfo of data.RaceNames) {
              const race: Manage2SailRace = {
                raceName: raceInfo.Name || `Race ${raceInfo.RaceIndex || raceInfo.Index + 1}`,
                raceNumber: raceInfo.RaceIndex || raceInfo.Index + 1,
                results: [],
              };
              
              // Extract results for this race from each entry
              for (const entry of data.EntryResults) {
                if (entry.EntryRaceResults && Array.isArray(entry.EntryRaceResults)) {
                  const raceResult = entry.EntryRaceResults.find(
                    (r: any) => r.OverallRaceIndex === (raceInfo.RaceIndex || raceInfo.Index + 1)
                  );
                  if (raceResult) {
                    race.results.push({
                      sailNumber: entry.SailNumber || '',
                      boatName: entry.TeamName || entry.Name,
                      position: raceResult.Rank || 0,
                      points: parseFloat(raceResult.Points) || 0,
                    });
                  }
                }
              }
              
              // Sort by position
              race.results.sort((a, b) => (a.position || 999) - (b.position || 999));
              classResults.races.push(race);
            }
          }
        }
        
        // Fallback: Parse ScoringResults if available (alternative format)
        if ((classResults.overallStandings?.length ?? 0) === 0 && data && data.ScoringResults && Array.isArray(data.ScoringResults)) {
          for (const scoring of data.ScoringResults) {
            if (scoring.Results && Array.isArray(scoring.Results)) {
              for (const result of scoring.Results) {
                classResults.overallStandings?.push({
                  sailNumber: result.SailNumber || '',
                  boatName: result.BoatName || result.TeamName,
                  position: result.Rank || result.Position || 0,
                  points: result.Total || result.Points || result.TotalPoints,
                });
              }
            }
          }
        }
        
        // Fallback: Parse Standings if available
        if ((classResults.overallStandings?.length ?? 0) === 0 && data && data.Standings && Array.isArray(data.Standings)) {
          for (const standing of data.Standings) {
            classResults.overallStandings?.push({
              sailNumber: standing.SailNumber || standing.sailNumber || '',
              boatName: standing.BoatName || standing.boatName,
              position: standing.Rank || standing.Position || standing.rank || 0,
              points: standing.TotalPoints || standing.Points || standing.totalPoints,
            });
          }
        }
        
        // If we got actual results data from API, add it
        if (classResults.races.length > 0 || (classResults.overallStandings?.length ?? 0) > 0) {
          allResults.push(classResults);
          continue;
        }
      }
    } catch (error) {
      console.error(`Error fetching results for class ${classInfo.id}:`, error);
    }
    
    // Fallback: If API returned no data but HTML indicates results exist, provide link
    if (classInfo.hasResults) {
      const resultsUrl = `https://www.manage2sail.com/en-US/event/${eventId}#!/results?classId=${classInfo.id}`;
      allResults.push({
        className: classInfo.name,
        classId: classInfo.id,
        races: [],
        overallStandings: [],
        viewResultsUrl: resultsUrl,
      });
    }
  }
  
  return allResults;
}

async function fetchManage2SailDocuments(eventId: string, classes: Manage2SailClass[]): Promise<Manage2SailDocument[]> {
  const documents: Manage2SailDocument[] = [];
  
  // Try API first (may work for some events)
  try {
    const apiUrl = `https://www.manage2sail.com/api/event/${eventId}/documents`;
    
    if (isValidExternalUrl(apiUrl)) {
      const response = await fetchWithTimeout(apiUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
          for (const doc of data) {
            documents.push({
              title: doc.Name || doc.Title || doc.name || 'Document',
              url: doc.Url || doc.url || doc.DownloadUrl || '',
              date: doc.Date || doc.date || doc.PublishedDate,
              type: doc.Type || doc.type || doc.Category,
            });
          }
          // API worked and returned data, use it
          return documents;
        }
      }
    }
  } catch (error) {
    console.log(`Documents API not available for event ${eventId}, using fallback`);
  }
  
  // Fallback: Check if any class has documents from embedded HTML data
  const hasDocsFromClasses = classes.some(c => c.hasDocuments);
  
  if (hasDocsFromClasses) {
    // Provide a link to view documents on Manage2Sail
    documents.push({
      title: 'View Notice Board on Manage2Sail',
      url: `https://www.manage2sail.com/en-US/event/${eventId}#!/onb?tab=documents`,
      type: 'link',
    });
    
    // Also add class-specific document links
    for (const classInfo of classes) {
      if (classInfo.hasDocuments && classInfo.id) {
        documents.push({
          title: `${classInfo.name} - Documents`,
          url: `https://www.manage2sail.com/en-US/event/${eventId}#!/onb?tab=documents&classId=${classInfo.id}`,
          type: 'class_documents',
        });
      }
    }
  }
  
  return documents;
}

export async function parseManage2SailUrl(url: string): Promise<Manage2SailInfo | null> {
  try {
    const cleanUrl = url.split('#')[0];
    
    if (!isValidExternalUrl(cleanUrl)) {
      console.error("Invalid or unauthorized URL:", cleanUrl);
      return null;
    }
    
    const eventId = extractEventIdFromUrl(cleanUrl);
    if (!eventId) {
      console.error("Could not extract event ID from URL:", cleanUrl);
      return null;
    }
    
    console.log(`Parsing Manage2Sail event: ${eventId}`);
    
    const eventDetails = await fetchManage2SailEventDetails(eventId);
    
    const classes = await fetchManage2SailClasses(eventId);
    
    const [results, documents] = await Promise.all([
      fetchManage2SailResults(eventId, classes),
      fetchManage2SailDocuments(eventId, classes),
    ]);
    
    const info: Manage2SailInfo = {
      ...eventDetails,
      classes,
      results,
      documents,
      fetchedAt: new Date().toISOString(),
    };
    
    console.log(`Parsed Manage2Sail: ${classes.length} classes, ${results.length} results, ${documents.length} documents`);
    
    return info;
  } catch (error) {
    console.error("Error parsing Manage2Sail URL:", error);
    return null;
  }
}

export async function parseRacingRulesUrl(url: string): Promise<RacingRulesInfo | null> {
  try {
    if (!isValidExternalUrl(url)) {
      console.error("Invalid or unauthorized URL:", url);
      return null;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to fetch Racing Rules page: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const info: RacingRulesInfo = {
      documents: [],
      fetchedAt: new Date().toISOString(),
    };

    const titleMatch = html.match(/<h3[^>]*>([^<]+(?:Championship|Regatta|Cup|Series|Event|Worlds?)[^<]*)<\/h3>/i);
    if (titleMatch) {
      info.eventName = titleMatch[1].trim();
    }

    const docRegex = /<tr[^>]*>[\s\S]*?<a[^>]*href="([^"]*\/documents\/\d+)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/td>\s*\|\s*(\d{4}-\d{2}-\d{2})?/gi;
    let match;
    while ((match = docRegex.exec(html)) !== null) {
      info.documents?.push({
        url: match[1].startsWith('http') ? match[1] : `https://www.racingrulesofsailing.org${match[1]}`,
        title: match[2].trim(),
        date: match[3]?.trim(),
      });
    }

    if (info.documents?.length === 0) {
      const simpleDocRegex = /\[([^\]]+)\]\(([^)]*\/documents\/\d+)\)/g;
      while ((match = simpleDocRegex.exec(html)) !== null) {
        info.documents?.push({
          title: match[1].trim(),
          url: match[2].startsWith('http') ? match[2] : `https://www.racingrulesofsailing.org${match[2]}`,
        });
      }
    }

    const resultsMatch = html.match(/href="([^"]+)"[^>]*>Results<\/a>/i);
    if (resultsMatch) {
      info.resultsUrl = resultsMatch[1];
    }

    const eventSiteMatch = html.match(/href="([^"]+)"[^>]*>Event Site<\/a>/i);
    if (eventSiteMatch) {
      info.eventSiteUrl = eventSiteMatch[1];
    }

    return info;
  } catch (error) {
    console.error("Error parsing Racing Rules URL:", error);
    return null;
  }
}

export async function fetchExternalInfo(
  manage2SailUrl?: string | null,
  racingRulesUrl?: string | null
): Promise<ExternalInfo> {
  const info: ExternalInfo = {};

  const promises: Promise<void>[] = [];

  if (manage2SailUrl) {
    promises.push(
      parseManage2SailUrl(manage2SailUrl).then((result) => {
        if (result) info.manage2Sail = result;
      })
    );
  }

  if (racingRulesUrl) {
    promises.push(
      parseRacingRulesUrl(racingRulesUrl).then((result) => {
        if (result) info.racingRules = result;
      })
    );
  }

  await Promise.all(promises);

  return info;
}
