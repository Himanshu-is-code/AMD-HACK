"""Fetch and display all conference records and their transcripts."""
import json, sys
import meet_service

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Step 1: List all conference records
print("=== ALL CONFERENCE RECORDS ===")
result = meet_service.list_conference_records()
records = result.get("conferenceRecords", [])
print(f"Found {len(records)} record(s)\n")
for r in records:
    print(json.dumps(r, indent=2))

if not records:
    print("No completed meetings found.")
    print("Make sure the meeting has ended and wait 2-5 minutes.")
else:
    for rec in records:
        conf_name = rec["name"]
        space = rec.get("space", "")
        print(f"\n=== TRANSCRIPTS for {conf_name} (space: {space}) ===")
        trans = meet_service.get_transcripts(conf_name)
        transcripts = trans.get("transcripts", [])
        print(f"Found {len(transcripts)} transcript(s)")

        if transcripts:
            for t in transcripts:
                tname = t["name"]
                print(f"\n--- Entries for {tname} ---")
                entries_result = meet_service.get_transcript_entries(tname)
                entries = entries_result.get("entries", [])
                if entries:
                    for e in entries:
                        speaker = e.get("participant", {}).get("signedinUser", {}).get("displayName", "Unknown")
                        text = e.get("text", "")
                        print(f"  {speaker}: {text}")
                else:
                    print("  (no entries in transcript)")
        else:
            print("  No transcripts. Transcription must be enabled during the meeting.")

        print(f"\n--- Participants for {conf_name} ---")
        p = meet_service.list_participants(conf_name)
        for participant in p.get("participants", []):
            name = participant.get("signedinUser", {}).get("displayName") or participant.get("anonymousUser", {}).get("displayName", "Unknown")
            print(f"  {name}")
