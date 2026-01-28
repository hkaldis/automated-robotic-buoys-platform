# Manage2Sail Integration Documentation

This document describes the integration with Manage2Sail for fetching sailing event data including entries, results, documents, and notice board information.

## Overview

The Alconmarks platform integrates with Manage2Sail to automatically fetch and display event information. The integration uses a combination of public APIs (where available) and HTML parsing (as fallback) to extract event data.

## API Base URL

```
https://www.manage2sail.com/api/event/{eventId}/
```

Where `{eventId}` is a UUID extracted from Manage2Sail event URLs.

Example event URL:
```
https://www.manage2sail.com/en-US/event/cd6c3e6b-ce9e-4ac9-ab38-360eee7de6a3#!/
```

## API Endpoints

### Working Public APIs (No Authentication Required)

| Endpoint | Method | Description | Response Format |
|----------|--------|-------------|-----------------|
| `/regattaentry?regattaId={classId}` | GET | Get entries for a specific class | JSON |
| `/regattaresult/{classId}` | GET | Get results for a specific class | JSON |
| `/protesttimes` | GET | Get protest submission times | JSON |
| `/hearingschedule` | GET | Get hearing schedule | JSON |
| `/sportcommunication` | GET | Get sport communications | JSON |
| `/CalendarItem` | GET | Get event calendar data | iCal format |

### APIs Requiring Authentication (Not Used)

| Endpoint | Status | Notes |
|----------|--------|-------|
| `/` (base event) | 401 Unauthorized | Requires login |
| `/schedule` | 401 Unauthorized | Requires login |

### Non-Existent APIs (404)

| Endpoint | Notes |
|----------|-------|
| `/info` | Event details not available via API |
| `/details` | Event details not available via API |
| `/documents` | Documents not available via API |
| `/notices` | Notices not available via API |
| `/startlists` | Start lists not available via API |
| `/jury` | Jury info not available via API |
| `/onwateractions` | On water actions not available via API |
| `/crewsubstitutions` | Crew substitutions not available via API |
| `/equipmentsubstitutions` | Equipment substitutions not available via API |
| `/scoringenquiries` | Scoring enquiries not available via API |

---

## Data Fetching Strategy

### 1. Event Details (HTML Parsing)

Since no API is available for event details, we parse the HTML page at:
```
https://www.manage2sail.com/en-US/event/{eventId}
```

**Extracted Fields:**
- Event Name (from `<title>` tag)
- Dates (from "Event :" table row)
- Registration Period (from "Registration :" table row)
- Club Name (from "Club :" table row with link)
- Location (from "Location :" table row)
- Address (from "Address :" table row)
- City (from "City :" table row)
- Country (from "Country :" table row)
- Email (from "Email :" table row, extracted from mailto: link)
- Phone (from "Phone :" table row)
- Website (from "Web :" table row, validated to exclude malformed URLs)

### 2. Classes (HTML Parsing with Embedded JSON)

Classes are extracted from embedded JSON in the HTML page. The parser looks for:
- Class IDs and names
- Entry counts
- Flags for hasEntries, hasResults, hasDocuments

### 3. Entries (API)

**Endpoint:** `GET /api/event/{eventId}/regattaentry?regattaId={classId}`

**Response Structure:**
```json
[
  {
    "Id": "uuid",
    "SailNumber": "238",
    "TeamName": "Wolfgang JOPPICH",
    "ClubName": "Yacht-Club am Tegernsee e.V.",
    "ClubCode": "YCAT",
    "Skipper": {
      "FirstName": "Wolfgang",
      "LastName": "Joppich"
    }
  }
]
```

**Extracted Fields:**
- Sail Number
- Skipper Name (from TeamName or Skipper object)
- Club Name
- Club Code
- Country (if available)

### 4. Results (API)

**Endpoint:** `GET /api/event/{eventId}/regattaresult/{classId}`

**Response Structure:**
```json
{
  "RegattaName": "Mini-Cupper",
  "RaceCount": 8,
  "IsOfficial": true,
  "RaceNames": [
    {"Index": 0, "Name": "R1", "RaceIndex": 1},
    {"Index": 1, "Name": "R2", "RaceIndex": 2}
  ],
  "EntryResults": [
    {
      "Rank": 1,
      "SailNumber": "238",
      "TeamName": "Wolfgang JOPPICH",
      "ClubCode": "YCAT",
      "TotalPoints": "18.0",
      "NetPoints": "9.0",
      "EntryRaceResults": [
        {
          "OverallRaceIndex": 1,
          "Points": "4.0",
          "Rank": 4,
          "PointsDiscarded": true
        }
      ]
    }
  ]
}
```

**Extracted Fields:**
- Overall Standings (Rank, SailNumber, TeamName, NetPoints)
- Per-Race Results (RaceName, Position, Points)
- Discarded races are marked

### 5. Notice Board (API + Fallback)

#### Protest Times
**Endpoint:** `GET /api/event/{eventId}/protesttimes`

```json
{
  "Data": [
    {
      "Time": "17:00",
      "Location": "Race Office",
      "Description": "Protest time limit"
    }
  ]
}
```

#### Hearing Schedule
**Endpoint:** `GET /api/event/{eventId}/hearingschedule`

```json
[
  {
    "Time": "18:00",
    "ProtestNumber": "P1",
    "Parties": "Boat 123 vs Boat 456",
    "Room": "Jury Room 1"
  }
]
```

#### Sport Communications
**Endpoint:** `GET /api/event/{eventId}/sportcommunication`

```json
[
  {
    "Date": "2026-01-18",
    "From": "Race Committee",
    "Subject": "Course Change",
    "Message": "Course A will be used today"
  }
]
```

#### Calendar
**Endpoint:** `GET /api/event/{eventId}/CalendarItem`

Returns iCal format:
```
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260117T230000Z
DTEND:20260117T230000Z
SUMMARY:Silberner Mini-Cupper 2026
LOCATION:Tegernsee - Seestr.42, Tegernsee, Germany
END:VEVENT
END:VCALENDAR
```

### 6. Documents (Fallback Links)

Since no documents API exists, we provide direct links to Manage2Sail:
- Main Notice Board: `https://www.manage2sail.com/en-US/event/{eventId}#!/onb?tab=documents`
- Class-specific: `https://www.manage2sail.com/en-US/event/{eventId}#!/onb?tab=documents&classId={classId}`

---

## Security

### URL Validation

All external URLs are validated against an allowlist before fetching:

```typescript
const ALLOWED_DOMAINS = [
  'manage2sail.com',
  'www.manage2sail.com',
  'racingrulesofsailing.org',
  'www.racingrulesofsailing.org',
];
```

- Only HTTPS URLs are allowed
- Domain must match exactly or be a subdomain of allowed domains
- Invalid URLs are rejected before any fetch attempt

### Timeout

All requests have a 15-second timeout to prevent hanging:

```typescript
const FETCH_TIMEOUT_MS = 15000;
```

---

## Data Flow

```
User provides Manage2Sail URL
           │
           ▼
   Extract Event ID (UUID)
           │
           ▼
   Validate URL domain
           │
           ▼
┌──────────┴──────────┐
│                     │
▼                     ▼
Fetch HTML Page    Fetch Classes
(Event Details)    (Embedded JSON)
│                     │
▼                     ▼
Parse Details      For each class:
                   ├─► Fetch Entries (API)
                   └─► Fetch Results (API)
                            │
                            ▼
                   Fetch Notice Board
                   ├─► Protest Times (API)
                   ├─► Hearing Schedule (API)
                   ├─► Sport Comms (API)
                   └─► Calendar (API)
                            │
                            ▼
                   Generate Document Links
                   (Fallback to Manage2Sail)
                            │
                            ▼
                   Store in Database
                   (event.externalInfo)
```

---

## UI Display

### Details Tab
- Event name, dates, registration period
- Club name and location
- Contact information (email, phone)
- Website link

### Entries Tab
- List of competitors per class
- Sail number, skipper name, club

### Results Tab
- Overall standings with points
- Per-race results (R1, R2, etc.)
- Expandable race details

### Documents Tab
- Links to Manage2Sail notice board
- Class-specific document links

### Notice Board Tab
- Calendar summary
- Protest times
- Hearing schedule
- Sport communications
- Link to full notice board on Manage2Sail

---

## Error Handling

1. **API Returns 404**: Fall back to HTML parsing or links
2. **API Returns 401**: Skip (requires authentication we don't have)
3. **API Returns 200 but Empty**: Display "No data" message in UI
4. **Network Timeout**: Log error, return partial data
5. **Invalid URL**: Reject before any fetch attempt

---

## Code Location

- **Parser**: `server/external-info-parser.ts`
- **API Routes**: `server/routes.ts` (endpoints: `/api/events/:id/external-info`, `/api/events/:id/fetch-external-info`)
- **Frontend Component**: `client/src/components/EventExternalInfo.tsx`
- **Database Schema**: `shared/schema.ts` (event.externalInfo jsonb field)

---

## Refresh Behavior

- External info is cached in the database (`events.externalInfo` field)
- User can manually refresh via "Refresh Data" button
- Each refresh fetches fresh data from all APIs
- `fetchedAt` timestamp shows when data was last updated

---

## Limitations

1. **No Authentication**: Cannot access protected APIs
2. **Rate Limiting**: Manage2Sail may rate-limit requests (not observed yet)
3. **HTML Structure Changes**: Parser may break if Manage2Sail changes HTML
4. **Empty APIs**: Some APIs return 200 with empty data (protest times, hearings)
5. **iCal Format**: Calendar endpoint returns iCal, not JSON
