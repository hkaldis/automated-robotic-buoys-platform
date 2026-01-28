import type { Event } from "@shared/schema";

interface Manage2SailInfo {
  eventName?: string;
  eventDate?: string;
  registrationPeriod?: string;
  club?: string;
  location?: string;
  address?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  classes?: string[];
  entriesCount?: number;
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
  manage2sail?: Manage2SailInfo;
  racingRules?: RacingRulesInfo;
}

export async function parseManage2SailUrl(url: string): Promise<Manage2SailInfo | null> {
  try {
    const cleanUrl = url.split('#')[0];
    
    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch Manage2Sail page: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const info: Manage2SailInfo = {
      fetchedAt: new Date().toISOString(),
    };

    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) {
      info.eventName = titleMatch[1].trim();
    }

    const eventDateMatch = html.match(/Event\s*:\s*<\/td>\s*<td[^>]*>([^<]+)/i);
    if (eventDateMatch) {
      info.eventDate = eventDateMatch[1].trim();
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

    return info;
  } catch (error) {
    console.error("Error parsing Manage2Sail URL:", error);
    return null;
  }
}

export async function parseRacingRulesUrl(url: string): Promise<RacingRulesInfo | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

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
        if (result) info.manage2sail = result;
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
