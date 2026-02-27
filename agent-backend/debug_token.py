"""Quick script to verify what scopes the current access token actually has."""
import json, requests

with open("token.json") as f:
    data = json.load(f)

token = data["token"]
resp = requests.get(f"https://oauth2.googleapis.com/tokeninfo?access_token={token}")
info = resp.json()

print("=== ACTUAL GRANTED SCOPES ===")
scopes = info.get("scope", "").split()
for s in sorted(scopes):
    print(" ", s)

print("\n=== MEET SCOPES PRESENT? ===")
print("  meetings.space.created:", "meetings.space.created" in info.get("scope",""))
print("  meetings.space.readonly:", "meetings.space.readonly" in info.get("scope",""))
