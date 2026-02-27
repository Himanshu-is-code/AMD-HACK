"""
Google Meet REST API service (Meet v2).
Mirrors the structure of calendar_service.py and gmail_service.py.

Available functions:
  - create_meeting_space()              -> creates an instant Meet link
  - get_meeting_space(name)             -> fetches a space by resource name
  - list_participants(conference_name)  -> lists all participants in a conference record
  - list_participant_sessions(participant_name) -> lists sessions for one participant
  - get_transcripts(conference_name)    -> lists transcripts for a conference record
  - get_transcript_entries(transcript_name)     -> lists transcript entries (utterances)

All functions use auth_service.get_credentials() and the googleapiclient discovery client.
"""

import logging
from googleapiclient.discovery import build
import auth_service


def _get_meet_service():
    """Builds and returns an authenticated Google Meet v2 service client."""
    creds = auth_service.get_credentials()
    if not creds:
        return None
    return build("meet", "v2", credentials=creds)


# ---------------------------------------------------------------------------
# Meeting Spaces
# ---------------------------------------------------------------------------

def create_meeting_space() -> dict:
    """
    Creates a new instant meeting space.

    Returns:
        dict with keys: name, meetingCode, meetingUri
              OR       : error (str)
    """
    service = _get_meet_service()
    if not service:
        return {"error": "Not authenticated. Please connect your Google account."}

    try:
        # POST https://meet.googleapis.com/v2/spaces
        space = service.spaces().create(body={}).execute()
        logging.info(f"Meet: Created space {space.get('name')}")
        return {
            "name": space.get("name"),
            "meetingCode": space.get("meetingCode"),
            "meetingUri": space.get("meetingUri"),
        }
    except Exception as e:
        logging.error(f"Meet create_meeting_space error: {e}")
        return {"error": str(e)}


def get_meeting_space(space_name: str) -> dict:
    """
    Gets a meeting space by resource name (e.g. 'spaces/abc-xyz-def').

    Args:
        space_name: Full resource name of the space, e.g. 'spaces/jQCFfuBOdN5z'

    Returns:
        dict with space details OR error key.
    """
    service = _get_meet_service()
    if not service:
        return {"error": "Not authenticated. Please connect your Google account."}

    try:
        space = service.spaces().get(name=space_name).execute()
        logging.info(f"Meet: Retrieved space {space_name}")
        return {
            "name": space.get("name"),
            "meetingCode": space.get("meetingCode"),
            "meetingUri": space.get("meetingUri"),
            "activeConference": space.get("activeConference"),
        }
    except Exception as e:
        logging.error(f"Meet get_meeting_space error: {e}")
        return {"error": str(e)}


def list_conference_records(space_name: str = None) -> dict:
    """
    Lists conference records (completed meetings).
    Filter by space name to find records for a specific meeting link.

    Args:
        space_name: Optional. e.g. 'spaces/abc-xyz' to filter by meeting space.

    Returns:
        dict with 'conferenceRecords' list (most recent first) OR 'error' key.
    """
    service = _get_meet_service()
    if not service:
        return {"error": "Not authenticated. Please connect your Google account."}

    try:
        records = []
        page_token = None

        while True:
            kwargs = {}
            if space_name:
                kwargs["filter"] = f'space.name="{space_name}"'
            if page_token:
                kwargs["pageToken"] = page_token

            response = service.conferenceRecords().list(**kwargs).execute()
            records.extend(response.get("conferenceRecords", []))
            page_token = response.get("nextPageToken")
            if not page_token:
                break

        logging.info(f"Meet: Listed {len(records)} conference records")
        return {"conferenceRecords": records}
    except Exception as e:
        logging.error(f"Meet list_conference_records error: {e}")
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Conference Records & Participants
# ---------------------------------------------------------------------------

def list_participants(conference_record_name: str) -> dict:
    """
    Lists all participants in a conference record.

    Args:
        conference_record_name: e.g. 'conferenceRecords/abc123'

    Returns:
        dict with 'participants' list OR 'error' key.
    """
    service = _get_meet_service()
    if not service:
        return {"error": "Not authenticated. Please connect your Google account."}

    try:
        participants = []
        page_token = None

        while True:
            kwargs = {"parent": conference_record_name}
            if page_token:
                kwargs["pageToken"] = page_token

            response = (
                service.conferenceRecords()
                .participants()
                .list(**kwargs)
                .execute()
            )
            participants.extend(response.get("participants", []))
            page_token = response.get("nextPageToken")
            if not page_token:
                break

        logging.info(
            f"Meet: Listed {len(participants)} participants for {conference_record_name}"
        )
        return {"participants": participants}
    except Exception as e:
        logging.error(f"Meet list_participants error: {e}")
        return {"error": str(e)}


def list_participant_sessions(participant_name: str) -> dict:
    """
    Lists all sessions for a single participant.

    Args:
        participant_name: e.g. 'conferenceRecords/abc123/participants/def456'

    Returns:
        dict with 'participantSessions' list OR 'error' key.
    """
    service = _get_meet_service()
    if not service:
        return {"error": "Not authenticated. Please connect your Google account."}

    try:
        sessions = []
        page_token = None

        while True:
            kwargs = {"parent": participant_name}
            if page_token:
                kwargs["pageToken"] = page_token

            response = (
                service.conferenceRecords()
                .participants()
                .participantSessions()
                .list(**kwargs)
                .execute()
            )
            sessions.extend(response.get("participantSessions", []))
            page_token = response.get("nextPageToken")
            if not page_token:
                break

        logging.info(
            f"Meet: Listed {len(sessions)} sessions for participant {participant_name}"
        )
        return {"participantSessions": sessions}
    except Exception as e:
        logging.error(f"Meet list_participant_sessions error: {e}")
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Transcripts
# ---------------------------------------------------------------------------

def get_transcripts(conference_record_name: str) -> dict:
    """
    Lists all transcripts associated with a conference record.
    Note: Transcripts are only available after the meeting has ended and
    transcription was enabled by the host.

    Args:
        conference_record_name: e.g. 'conferenceRecords/abc123'

    Returns:
        dict with 'transcripts' list OR 'error' key.
    """
    service = _get_meet_service()
    if not service:
        return {"error": "Not authenticated. Please connect your Google account."}

    try:
        transcripts = []
        page_token = None

        while True:
            kwargs = {"parent": conference_record_name}
            if page_token:
                kwargs["pageToken"] = page_token

            response = (
                service.conferenceRecords()
                .transcripts()
                .list(**kwargs)
                .execute()
            )
            transcripts.extend(response.get("transcripts", []))
            page_token = response.get("nextPageToken")
            if not page_token:
                break

        logging.info(
            f"Meet: Listed {len(transcripts)} transcripts for {conference_record_name}"
        )
        return {"transcripts": transcripts}
    except Exception as e:
        logging.error(f"Meet get_transcripts error: {e}")
        return {"error": str(e)}


def get_transcript_entries(transcript_name: str) -> dict:
    """
    Lists all transcript entries (individual utterances) in a transcript.

    Args:
        transcript_name: e.g. 'conferenceRecords/abc123/transcripts/ghi789'

    Returns:
        dict with 'entries' list OR 'error' key.
        Each entry contains: name, participant, text, startTime, endTime
    """
    service = _get_meet_service()
    if not service:
        return {"error": "Not authenticated. Please connect your Google account."}

    try:
        entries = []
        page_token = None

        while True:
            kwargs = {"parent": transcript_name}
            if page_token:
                kwargs["pageToken"] = page_token

            response = (
                service.conferenceRecords()
                .transcripts()
                .entries()
                .list(**kwargs)
                .execute()
            )
            entries.extend(response.get("entries", []))
            page_token = response.get("nextPageToken")
            if not page_token:
                break

        logging.info(
            f"Meet: Retrieved {len(entries)} transcript entries from {transcript_name}"
        )
        return {"entries": entries}
    except Exception as e:
        logging.error(f"Meet get_transcript_entries error: {e}")
        return {"error": str(e)}
