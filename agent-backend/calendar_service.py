from datetime import datetime, timedelta
from googleapiclient.discovery import build
import auth_service
import logging

def _offset_to_iana(dt) -> str:
    """Convert a UTC offset from a datetime to the nearest IANA timezone name."""
    if dt.tzinfo is None:
        return "UTC"
    offset = dt.utcoffset()
    total_minutes = int(offset.total_seconds() / 60)
    # Common offsets → IANA name
    offset_map = {
        330: "Asia/Kolkata",
        0: "UTC",
        -300: "America/New_York",
        -360: "America/Chicago",
        -420: "America/Denver",
        -480: "America/Los_Angeles",
        60:  "Europe/London",
        120: "Europe/Paris",
        480: "Asia/Shanghai",
        540: "Asia/Tokyo",
        600: "Australia/Sydney",
    }
    return offset_map.get(total_minutes, "UTC")


def create_event(summary: str, start_time_iso: str, duration_minutes: int = 30):
    """Creates a calendar event with specific details."""
    creds = auth_service.get_credentials()
    if not creds:
        return {"error": "Not authenticated"}

    try:
        service = build('calendar', 'v3', credentials=creds)

        # Parse ISO string (handle offset if present)
        start_dt = datetime.fromisoformat(start_time_iso.replace("Z", "+00:00"))
        end_dt = start_dt + timedelta(minutes=duration_minutes)

        # Derive timezone name from offset (Google Calendar requires IANA name)
        iana_tz = _offset_to_iana(start_dt)

        event = {
            'summary': summary,
            'description': 'Created by Agent.',
            'start': {
                'dateTime': start_dt.isoformat(),
                'timeZone': iana_tz,
            },
            'end': {
                'dateTime': end_dt.isoformat(),
                'timeZone': iana_tz,
            },
        }

        created_event = service.events().insert(calendarId='primary', body=event).execute()
        return {"status": "success", "link": created_event.get('htmlLink')}


    except Exception as e:
        error_details = str(e)
        if hasattr(e, 'content'):
            try:
                error_details = e.content.decode('utf-8')
            except:
                pass
        logging.error(f"Calendar Error: {error_details}")
        return {"error": error_details}

def create_test_event():
    """Creates a hardcoded test event: 'Agent Test Event' in 10 minutes."""
    start_time = datetime.utcnow() + timedelta(minutes=10)
    return create_event("Agent Test Event", start_time.isoformat())
